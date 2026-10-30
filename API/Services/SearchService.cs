using DDAAPI.DbContexts;
using DDAAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace DDAAPI.Services
{
    public class SearchForbiddenException : Exception
    {
        public SearchForbiddenException(string message) : base(message) { }
    }

    public class SearchService
    {
        private readonly AppDbContext _db;
        private readonly IReportService _report;

        public SearchService(AppDbContext db, IReportService report)
        {
            _db = db;
            _report = report;
        }

        private class FolderNode
        {
            public int FolderId { get; set; }
            public int? ParentFolderId { get; set; }
            public string FolderName { get; set; } = "";
            public string? CreatedBy { get; set; }
            public string? AuthorizedUserId { get; set; }
        }

        private static bool Eq(string? a, string b) =>
            a != null && a.Equals(b, StringComparison.OrdinalIgnoreCase);

        private async Task<(User User, bool IsGlobalAdmin)> ResolveUserAsync(string? employeeId)
        {
            if (string.IsNullOrWhiteSpace(employeeId))
                throw new UnauthorizedAccessException("Invalid session.");

            var user = await _db.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.EmployeeId == employeeId && u.IsActive);
            if (user == null)
                throw new UnauthorizedAccessException("User not found or inactive.");

            var roleName = await (from m in _db.UserRoleMaps
                                  join r in _db.Roles on m.RoleID equals r.RoleID
                                  where m.UserID == user.UserID && m.IsActive
                                  select r.RoleName).FirstOrDefaultAsync();

            return (user, roleName == "Global Admin");
        }

        private static HashSet<int> Expand(IEnumerable<int> roots, ILookup<int, FolderNode> children)
        {
            var seen = new HashSet<int>(roots);
            var queue = new Queue<int>(seen);
            while (queue.Count > 0)
            {
                var id = queue.Dequeue();
                foreach (var c in children[id])
                    if (seen.Add(c.FolderId)) queue.Enqueue(c.FolderId);
            }
            return seen;
        }

        private static string Location(int? folderId, Dictionary<int, FolderNode> byId)
        {
            var names = new List<string>();
            var cur = folderId;
            var guard = 0;
            while (cur.HasValue && cur.Value != 0 && byId.TryGetValue(cur.Value, out var n) && guard++ < 25)
            {
                names.Add(n.FolderName);
                cur = n.ParentFolderId;
            }
            names.Reverse();
            names.Insert(0, "Home");
            return string.Join(" / ", names);
        }

        public async Task<SearchResponseDTO> SearchAsync(string? employeeId, SearchRequestDTO req)
        {
            var (user, isGA) = await ResolveUserAsync(employeeId);
            var uid = user.UserID.ToString().ToLower();

            var page = Math.Max(1, req.Page);
            var pageSize = Math.Clamp(req.PageSize, 1, 50);
            var docType = (req.DocType ?? "All").Trim();
            var ext = (req.Extension ?? "").Trim().TrimStart('.').ToLower();
            var tag = (req.Tag ?? "").Trim().ToLower();

            // Lightweight folder tree (used for access scope and "Home / A / B" locations)
            var nodes = await _db.FolderData.AsNoTracking()
                .Where(f => f.IsActive)
                .Select(f => new FolderNode
                {
                    FolderId = f.FolderId,
                    ParentFolderId = f.ParentFolderId,
                    FolderName = f.FolderName,
                    CreatedBy = f.CreatedBy,
                    AuthorizedUserId = f.AuthorizedUserId
                }).ToListAsync();

            var byId = nodes.ToDictionary(n => n.FolderId);
            var children = nodes.Where(n => n.ParentFolderId.HasValue && n.ParentFolderId.Value != 0)
                                .ToLookup(n => n.ParentFolderId!.Value);

            // ---- access scope ----
            List<int>? accessible = null;
            List<int> sharedFileIds = new();
            if (!isGA)
            {
                var roots = new HashSet<int>(nodes
                    .Where(n => Eq(n.CreatedBy, uid) || Eq(n.AuthorizedUserId, uid))
                    .Select(n => n.FolderId));

                var shares = await _db.ShareDocAccess.AsNoTracking()
                    .Where(s => s.AccessUserId == user.UserID && s.IsActive)
                    .Select(s => new { s.FolderOrFileId, s.DocType })
                    .ToListAsync();

                foreach (var s in shares.Where(s => s.DocType == "Folder"))
                    roots.Add(s.FolderOrFileId);
                sharedFileIds = shares.Where(s => s.DocType != "Folder")
                                      .Select(s => s.FolderOrFileId).ToList();

                accessible = Expand(roots, children).ToList();
            }

            // ---- tag filter: tagged folders + all their descendants ----
            List<int>? taggedScope = null;
            if (tag.Length > 0)
            {
                var tagged = await _db.FolderData.AsNoTracking()
                    .Where(f => f.IsActive && f.Tags != null && f.Tags.Contains(tag))
                    .Select(f => f.FolderId).ToListAsync();
                taggedScope = Expand(tagged, children).ToList();
            }

            var terms = (req.Query ?? "")
                .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Take(6).ToList();

            // ---- folders ----
            var includeFolders = (docType == "All" || docType == "Folder") && ext.Length == 0;
            var folderQ = _db.FolderData.AsNoTracking().Where(f => f.IsActive);
            if (!isGA)
                folderQ = folderQ.Where(f => accessible!.Contains(f.FolderId) && !f.IsHide);
            if (taggedScope != null)
                folderQ = folderQ.Where(f => taggedScope.Contains(f.FolderId));
            foreach (var t in terms)
            {
                var term = t;
                folderQ = folderQ.Where(f => f.FolderName.Contains(term) ||
                                             (f.Tags != null && f.Tags.Contains(term)));
            }
            if (req.FromDate.HasValue) folderQ = folderQ.Where(f => f.CreatedOn >= req.FromDate.Value.Date);
            if (req.ToDate.HasValue) folderQ = folderQ.Where(f => f.CreatedOn < req.ToDate.Value.Date.AddDays(1));

            // ---- files ----
            var includeFiles = docType == "All" || docType == "Document";
            var fileQ = _db.FileData.AsNoTracking().Where(f => f.IsActive);
            if (!isGA)
            {
                var acc = accessible!;
                var sf = sharedFileIds;
                fileQ = fileQ.Where(f => !f.IsHide &&
                    (acc.Contains(f.FolderId) || sf.Contains(f.FileId) || f.CreatedBy == uid));
            }
            if (taggedScope != null)
                fileQ = fileQ.Where(f => taggedScope.Contains(f.FolderId));
            foreach (var t in terms)
            {
                var term = t;
                fileQ = fileQ.Where(f => f.FileName.Contains(term));
            }
            if (ext.Length > 0)
            {
                var dotExt = "." + ext;
                fileQ = fileQ.Where(f => f.FileName.EndsWith(dotExt));
            }
            if (req.FromDate.HasValue) fileQ = fileQ.Where(f => f.CreatedOn >= req.FromDate.Value.Date);
            if (req.ToDate.HasValue) fileQ = fileQ.Where(f => f.CreatedOn < req.ToDate.Value.Date.AddDays(1));

            // ---- counts + top-N of each, then merge ----
            var folderTotal = includeFolders ? await folderQ.CountAsync() : 0;
            var fileTotal = includeFiles ? await fileQ.CountAsync() : 0;
            var take = page * pageSize;

            var folders = includeFolders
                ? await folderQ.OrderByDescending(f => f.CreatedOn).Take(take).ToListAsync()
                : new List<FolderData>();
            var files = includeFiles
                ? await fileQ.OrderByDescending(f => f.CreatedOn).Take(take).ToListAsync()
                : new List<FileData>();

            string SourceOf(string? createdBy) =>
                Eq(createdBy, uid) ? "My Files" : (isGA ? "Other user" : "Shared with me");

            var items = new List<SearchResultItemDTO>();
            items.AddRange(folders.Select(f => new SearchResultItemDTO
            {
                Id = f.FolderId,
                DocType = "Folder",
                Name = f.FolderName,
                Location = Location(f.ParentFolderId, byId),
                Tags = f.Tags,
                CreatedById = f.CreatedBy,
                CreatedOn = f.CreatedOn,
                Source = SourceOf(f.CreatedBy),
                ServerPath = f.ServerFolderPath,
                FolderColor = f.FolderColor,
                IsHide = f.IsHide,
                CanEditTags = isGA || Eq(f.CreatedBy, uid) || Eq(f.AuthorizedUserId, uid)
            }));
            items.AddRange(files.Select(f => new SearchResultItemDTO
            {
                Id = f.FileId,
                DocType = "Document",
                Name = f.FileName,
                Location = Location(f.FolderId, byId),
                Extension = Path.GetExtension(f.FileName).TrimStart('.').ToLower(),
                Size = f.Size,
                CreatedById = f.CreatedBy,
                CreatedOn = f.CreatedOn,
                Source = SourceOf(f.CreatedBy),
                ServerPath = f.ServerFilePath,
                IsHide = f.IsHide
            }));

            var paged = items.OrderByDescending(i => i.CreatedOn)
                             .Skip((page - 1) * pageSize).Take(pageSize).ToList();

            // creator display names
            var creatorGuids = paged.Select(i => Guid.TryParse(i.CreatedById, out var g) ? g : (Guid?)null)
                                    .Where(g => g.HasValue).Select(g => g!.Value).Distinct().ToList();
            var names = await _db.EmpInfos.AsNoTracking()
                .Where(e => creatorGuids.Contains(e.EmpId))
                .Select(e => new { e.EmpId, e.FirstName, e.LastName }).ToListAsync();
            var nameMap = names.ToDictionary(n => n.EmpId.ToString().ToLower(),
                                             n => $"{n.FirstName} {n.LastName}".Trim());
            foreach (var i in paged)
                i.CreatedByName = i.CreatedById != null && nameMap.TryGetValue(i.CreatedById.ToLower(), out var nm)
                    ? nm : "Unknown";

            var total = folderTotal + fileTotal;
            return new SearchResponseDTO
            {
                Items = paged,
                TotalCount = total,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(total / (double)pageSize)
            };
        }

        public async Task<string> SetFolderTagsAsync(string? employeeId, SetFolderTagsDTO dto)
        {
            var (user, isGA) = await ResolveUserAsync(employeeId);
            var uid = user.UserID.ToString().ToLower();

            var folder = await _db.FolderData.FirstOrDefaultAsync(f => f.FolderId == dto.FolderId && f.IsActive);
            if (folder == null) throw new KeyNotFoundException("Folder not found.");

            if (!(isGA || Eq(folder.CreatedBy, uid) || Eq(folder.AuthorizedUserId, uid)))
                throw new SearchForbiddenException("You do not have permission to edit tags on this folder.");

            var cleaned = (dto.Tags ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(t => t.ToLower())
                .Select(t => t.Length > 30 ? t.Substring(0, 30) : t)
                .Distinct().Take(10).ToList();

            folder.Tags = cleaned.Any() ? string.Join(",", cleaned) : null;
            folder.ModifiedOn = DateTime.Now;
            folder.ModifiedBy = uid;

            // Reuses the existing folder version history
            await _report.AddFolderVersionAsync(folder, "Updated", uid,
                $"Tags updated to '{folder.Tags ?? ""}'", saveChanges: false);

            await _db.SaveChangesAsync();
            return folder.Tags ?? "";
        }
    }
}