using DDAAPI.DbContexts;
using DDAAPI.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

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
            public string? Tags { get; set; }
        }

        private class ParsedQuery
        {
            public List<string> Terms { get; } = new();   // keywords / "exact phrases"
            public List<string> Tags { get; } = new();    // tag:finance
            public List<string> Exts { get; } = new();    // ext:pdf | type:pdf
            public List<string> By { get; } = new();      // by:john | owner:john
        }

        // Supports: invoice  "purchase order"  tag:finance  ext:pdf  by:john  by:"john smith"
        private static readonly Regex TokenRe = new(
            "(?<k>\\w+):(?:\"(?<v>[^\"]+)\"|(?<v>\\S+))|\"(?<p>[^\"]+)\"|(?<w>\\S+)",
            RegexOptions.Compiled);

        private static ParsedQuery Parse(string? q)
        {
            var r = new ParsedQuery();
            foreach (Match m in TokenRe.Matches(q ?? ""))
            {
                if (m.Groups["k"].Success)
                {
                    var key = m.Groups["k"].Value.ToLower();
                    var val = m.Groups["v"].Value.Trim().TrimStart('.').ToLower();
                    if (val.Length == 0) continue;
                    if (key == "tag") r.Tags.Add(val);
                    else if (key == "ext" || key == "type") r.Exts.Add(val);
                    else if (key == "by" || key == "owner") r.By.Add(val);
                    else r.Terms.Add(m.Value.Trim());      // unknown operator -> plain text (e.g. "ref:123")
                }
                else if (m.Groups["p"].Success) r.Terms.Add(m.Groups["p"].Value.Trim());
                else if (m.Groups["w"].Success) r.Terms.Add(m.Groups["w"].Value.Trim());
            }
            r.Terms.RemoveAll(t => t.Length == 0);
            if (r.Terms.Count > 6) r.Terms.RemoveRange(6, r.Terms.Count - 6);
            if (r.Tags.Count > 5) r.Tags.RemoveRange(5, r.Tags.Count - 5);
            if (r.By.Count > 3) r.By.RemoveRange(3, r.By.Count - 3);
            return r;
        }

        // users (as lower-case id strings) whose first/last/full name contains the text
        private async Task<List<string>> UserIdsByNameAsync(string text)
        {
            var rows = await _db.EmpInfos.AsNoTracking()
                .Where(e => (e.FirstName + " " + e.LastName).Contains(text))
                .Select(e => e.EmpId).Take(200).ToListAsync();
            return rows.Select(g => g.ToString().ToLower()).ToList();
        }

        // folders carrying the tag (exact tag match) + every descendant
        private async Task<List<int>> TagScopeAsync(string tag, ILookup<int, FolderNode> children, bool exact)
        {
            var q = _db.FolderData.AsNoTracking().Where(f => f.IsActive && f.Tags != null);
            var tagged = exact
                ? await q.Where(f => ("," + f.Tags + ",").Contains("," + tag + ",")).Select(f => f.FolderId).ToListAsync()
                : await q.Where(f => f.Tags!.Contains(tag)).Select(f => f.FolderId).ToListAsync();
            return Expand(tagged, children).ToList();
        }

        private async Task<(Dictionary<int, int> Folders, Dictionary<int, int> Files)> ShareMapsAsync(User user)
        {
            var shares = await _db.ShareDocAccess.AsNoTracking()
                .Where(x => x.AccessUserId == user.UserID && x.IsActive)
                .Select(x => new { x.FolderOrFileId, x.DocType, x.AccessType }).ToListAsync();
            var folders = new Dictionary<int, int>(); var files = new Dictionary<int, int>();
            foreach (var x in shares)
            {
                var d = x.DocType == "Folder" ? folders : files;
                d[x.FolderOrFileId] = d.TryGetValue(x.FolderOrFileId, out var cur) ? Math.Max(cur, x.AccessType) : x.AccessType;
            }
            return (folders, files);
        }

        private static List<string> CleanTags(string? raw) =>
            (raw ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(t => t.ToLower()).Select(t => t.Length > 30 ? t.Substring(0, 30) : t)
                .Distinct().Take(10).ToList();

        // tags a file inherits from its nearest tagged ancestor folders
        private static string? InheritedTags(int folderId, Dictionary<int, FolderNode> byId, string? own = null)
        {
            var set = new List<string>();
            if (!string.IsNullOrWhiteSpace(own)) set.AddRange(CleanTags(own)); var cur = (int?)folderId; var guard = 0;
            while (cur.HasValue && cur.Value != 0 && byId.TryGetValue(cur.Value, out var n) && guard++ < 25)
            {
                if (!string.IsNullOrWhiteSpace(n.Tags))
                    foreach (var t in n.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                        if (!set.Contains(t)) set.Add(t);
                cur = n.ParentFolderId;
            }
            return set.Count == 0 ? null : string.Join(",", set.Take(10));
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

        private async Task<(List<int>? Accessible, List<int> SharedFileIds)> ScopeAsync(
            User user, bool isGA, string uid, List<FolderNode> nodes, ILookup<int, FolderNode> children)
        {
            if (isGA) return (null, new List<int>());
            var roots = new HashSet<int>(nodes
                .Where(n => Eq(n.CreatedBy, uid) || Eq(n.AuthorizedUserId, uid))
                .Select(n => n.FolderId));

            var shares = await _db.ShareDocAccess.AsNoTracking()
                .Where(s => s.AccessUserId == user.UserID && s.IsActive)
                .Select(s => new { s.FolderOrFileId, s.DocType })
                .ToListAsync();

            foreach (var s in shares.Where(s => s.DocType == "Folder")) roots.Add(s.FolderOrFileId);
            var sharedFiles = shares.Where(s => s.DocType != "Folder").Select(s => s.FolderOrFileId).ToList();
            return (Expand(roots, children).ToList(), sharedFiles);
        }

        // Tag suggestions (with counts) for folders the user can see
        public async Task<List<TagCountDTO>> TagsAsync(string? employeeId)
        {
            var (user, isGA) = await ResolveUserAsync(employeeId);
            var uid = user.UserID.ToString().ToLower();
            var nodes = await _db.FolderData.AsNoTracking().Where(f => f.IsActive)
                .Select(f => new FolderNode
                {
                    FolderId = f.FolderId,
                    ParentFolderId = f.ParentFolderId,
                    FolderName = f.FolderName,
                    CreatedBy = f.CreatedBy,
                    AuthorizedUserId = f.AuthorizedUserId,
                    Tags = f.Tags
                }).ToListAsync();
            var children = nodes.Where(n => n.ParentFolderId.HasValue && n.ParentFolderId.Value != 0)
                                .ToLookup(n => n.ParentFolderId!.Value);
            var (accessible, _) = await ScopeAsync(user, isGA, uid, nodes, children);

            var q = _db.FolderData.AsNoTracking().Where(f => f.IsActive && f.Tags != null && f.Tags != "");
            if (!isGA) q = q.Where(f => accessible!.Contains(f.FolderId) && !f.IsHide);
            var tagStrings = await q.Select(f => f.Tags!).ToListAsync();
            var fq = _db.FileData.AsNoTracking().Where(f => f.IsActive && f.Tags != null && f.Tags != "");
            if (!isGA) fq = fq.Where(f => !f.IsHide && (accessible!.Contains(f.FolderId) || f.CreatedBy == uid));
            tagStrings.AddRange(await fq.Select(f => f.Tags!).ToListAsync());
            return tagStrings.SelectMany(t => t.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                .GroupBy(t => t.ToLower())
                .Select(g => new TagCountDTO { Tag = g.Key, Count = g.Count() })
                .OrderByDescending(t => t.Count).ThenBy(t => t.Tag).Take(40).ToList();
        }

        public async Task<SearchResponseDTO> SearchAsync(string? employeeId, SearchRequestDTO req)
        {
            var (user, isGA) = await ResolveUserAsync(employeeId);
            var uid = user.UserID.ToString().ToLower();

            var page = Math.Max(1, req.Page);
            var pageSize = Math.Clamp(req.PageSize, 1, 50);
            var docType = (req.DocType ?? "All").Trim();
            var parsed = Parse(req.Query);
            var ext = (req.Extension ?? "").Trim().TrimStart('.').ToLower();
            if (ext.Length == 0 && parsed.Exts.Count > 0) ext = parsed.Exts[0];
            var tagFilters = new List<string>(parsed.Tags);
            var uiTag = (req.Tag ?? "").Trim().ToLower();
            if (uiTag.Length > 0 && !tagFilters.Contains(uiTag)) tagFilters.Add(uiTag);

            // Lightweight folder tree (used for access scope and "Home / A / B" locations)
            var nodes = await _db.FolderData.AsNoTracking()
                .Where(f => f.IsActive)
                .Select(f => new FolderNode
                {
                    FolderId = f.FolderId,
                    ParentFolderId = f.ParentFolderId,
                    FolderName = f.FolderName,
                    CreatedBy = f.CreatedBy,
                    AuthorizedUserId = f.AuthorizedUserId,
                    Tags = f.Tags
                }).ToListAsync();

            var byId = nodes.ToDictionary(n => n.FolderId);
            var children = nodes.Where(n => n.ParentFolderId.HasValue && n.ParentFolderId.Value != 0)
                                .ToLookup(n => n.ParentFolderId!.Value);

            // ---- access scope ----
            var (accessible, sharedFileIds) = await ScopeAsync(user, isGA, uid, nodes, children);

            // ---- tag filters (exact tag): tagged folders + all their descendants; several tags = all must match ----
            var tagScopes = new List<List<int>>();
            foreach (var t in tagFilters) tagScopes.Add(await TagScopeAsync(t, children, exact: true));

            // ---- by: operator -> creators matching the name ----
            List<string>? byIds = null;
            foreach (var b in parsed.By)
            {
                var ids = await UserIdsByNameAsync(b);
                byIds = byIds == null ? ids : byIds.Intersect(ids).ToList();
            }

            var terms = parsed.Terms;

            // ---- folders ----
            var includeFolders = (docType == "All" || docType == "Folder") && ext.Length == 0;
            var folderQ = _db.FolderData.AsNoTracking().Where(f => f.IsActive);
            if (!isGA)
                folderQ = folderQ.Where(f => accessible!.Contains(f.FolderId) && !f.IsHide);
            foreach (var sc in tagScopes)
            {
                var scope = sc;
                folderQ = folderQ.Where(f => scope.Contains(f.FolderId));
            }
            if (byIds != null) folderQ = folderQ.Where(f => byIds.Contains(f.CreatedBy!));
            foreach (var t in terms)
            {
                var term = t.ToLower();
                var creators = await UserIdsByNameAsync(term);   // metadata: creator name
                folderQ = folderQ.Where(f => f.FolderName.Contains(term) ||
                                             (f.Tags != null && f.Tags.Contains(term)) ||
                                             creators.Contains(f.CreatedBy!));
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
            for (var i = 0; i < tagScopes.Count; i++)
            {
                var scope = tagScopes[i]; var tg = tagFilters[i];
                fileQ = fileQ.Where(f => scope.Contains(f.FolderId) ||
                                         (f.Tags != null && ("," + f.Tags + ",").Contains("," + tg + ",")));
            }
            if (byIds != null) fileQ = fileQ.Where(f => byIds.Contains(f.CreatedBy!));
            foreach (var t in terms)
            {
                var term = t.ToLower();
                // a file matches on its name, version note, creator name, or a tag of a folder it sits in
                var tagScope = await TagScopeAsync(term, children, exact: false);
                var creators = await UserIdsByNameAsync(term);
                fileQ = fileQ.Where(f => f.FileName.Contains(term) ||
                                         (f.Tags != null && f.Tags.Contains(term)) ||
                                         (f.VersionNote != null && f.VersionNote.Contains(term)) ||
                                         tagScope.Contains(f.FolderId) ||
                                         creators.Contains(f.CreatedBy!));
            }

            var owner = (req.Owner ?? "All").Trim();
            if (owner == "Me")
            {
                folderQ = folderQ.Where(f => f.CreatedBy == uid);
                fileQ = fileQ.Where(f => f.CreatedBy == uid);
            }
            else if (owner == "Others")
            {
                folderQ = folderQ.Where(f => f.CreatedBy != uid);
                fileQ = fileQ.Where(f => f.CreatedBy != uid);
            }
            if (req.MinSizeMB.HasValue || req.MaxSizeMB.HasValue)
            {
                includeFolders = false; // size only applies to files
                if (req.MinSizeMB.HasValue) { var min = (long)(req.MinSizeMB.Value * 1048576); fileQ = fileQ.Where(f => f.Size >= min); }
                if (req.MaxSizeMB.HasValue) { var max = (long)(req.MaxSizeMB.Value * 1048576); fileQ = fileQ.Where(f => f.Size <= max); }
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

            var sortBy = (req.SortBy ?? "created").Trim().ToLower();
            var desc = !string.Equals(req.SortDir, "asc", StringComparison.OrdinalIgnoreCase);

            IOrderedQueryable<FolderData> OrderFolders(IQueryable<FolderData> q) => sortBy switch
            {
                "name" => desc ? q.OrderByDescending(f => f.FolderName) : q.OrderBy(f => f.FolderName),
                _ => desc ? q.OrderByDescending(f => f.CreatedOn) : q.OrderBy(f => f.CreatedOn)
            };
            IOrderedQueryable<FileData> OrderFiles(IQueryable<FileData> q) => sortBy switch
            {
                "name" => desc ? q.OrderByDescending(f => f.FileName) : q.OrderBy(f => f.FileName),
                "size" => desc ? q.OrderByDescending(f => f.Size) : q.OrderBy(f => f.Size),
                _ => desc ? q.OrderByDescending(f => f.CreatedOn) : q.OrderBy(f => f.CreatedOn)
            };

            var folders = includeFolders
                ? await OrderFolders(folderQ).Take(take).ToListAsync()
                : new List<FolderData>();
            var files = includeFiles
                ? await OrderFiles(fileQ).Take(take).ToListAsync()
                : new List<FileData>();

            // extension facet over the matching files (capped for speed)
            var facetNames = includeFiles
                ? await fileQ.Select(f => f.FileName).Take(2000).ToListAsync()
                : new List<string>();
            var extFacets = facetNames
                .Select(n => Path.GetExtension(n).TrimStart('.').ToLower())
                .Where(e => e.Length > 0)
                .GroupBy(e => e)
                .Select(g => new SearchFacetDTO { Key = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count).Take(8).ToList();

            // ---- navigation + edit permission data ----
            var (folderShares, fileShares) = await ShareMapsAsync(user);
            var ownRoots = new HashSet<int>(nodes.Where(n => Eq(n.CreatedBy, uid) || Eq(n.AuthorizedUserId, uid)).Select(n => n.FolderId));
            var rootSet = new HashSet<int>(ownRoots); rootSet.UnionWith(folderShares.Keys);
            var writeRoots = new HashSet<int>(ownRoots); writeRoots.UnionWith(folderShares.Where(k => k.Value >= 2).Select(k => k.Key));
            var writeScope = isGA ? null : Expand(writeRoots, children);

            void FillNav(SearchResultItemDTO i, int containerId)
            {
                i.ContainerFolderId = containerId;
                var chain = new List<FolderNode>(); var cur = containerId; var guard = 0;
                while (cur != 0 && byId.TryGetValue(cur, out var n) && guard++ < 25) { chain.Add(n); cur = n.ParentFolderId ?? 0; }
                chain.Reverse();
                if (!isGA)
                {
                    var idx = chain.FindIndex(n => rootSet.Contains(n.FolderId));
                    chain = idx < 0 ? new List<FolderNode>() : chain.Skip(idx).ToList();
                }
                i.Path = chain.Select(n => new PathCrumbDTO { FolderId = n.FolderId, FolderName = n.FolderName }).ToList();
                if (chain.Count == 0) return;
                var first = chain[0];
                var mine = isGA || ownRoots.Contains(first.FolderId);
                i.NavTab = mine ? "current" : "shared";
                i.NavAccessType = mine ? null : folderShares.GetValueOrDefault(first.FolderId, 1);
                i.NavOwnerId = first.CreatedBy;
            }

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
                CanEditTags = isGA || Eq(f.CreatedBy, uid) || Eq(f.AuthorizedUserId, uid) || (writeScope != null && writeScope.Contains(f.FolderId))
            }));
            items.AddRange(files.Select(f => new SearchResultItemDTO
            {
                Id = f.FileId,
                DocType = "Document",
                Name = f.FileName,
                Location = Location(f.FolderId, byId),
                Extension = Path.GetExtension(f.FileName).TrimStart('.').ToLower(),
                Tags = InheritedTags(f.FolderId, byId, f.Tags),
                OwnTags = f.Tags,
                CanEditTags = isGA || Eq(f.CreatedBy, uid) ||
                              (fileShares.TryGetValue(f.FileId, out var ft) && ft >= 2) ||
                              (writeScope != null && writeScope.Contains(f.FolderId)),
                Size = f.Size,
                CreatedById = f.CreatedBy,
                CreatedOn = f.CreatedOn,
                Source = SourceOf(f.CreatedBy),
                ServerPath = f.ServerFilePath,
                IsHide = f.IsHide
            }));

            var fileFolderById = files.ToDictionary(x => x.FileId, x => x.FolderId);
            foreach (var it in items) FillNav(it, it.DocType == "Folder" ? it.Id : fileFolderById[it.Id]);

            // folders first when sorting by name/type so the list stays predictable
            IEnumerable<SearchResultItemDTO> ordered = sortBy switch
            {
                "name" => desc ? items.OrderByDescending(i => i.Name, StringComparer.OrdinalIgnoreCase)
                               : items.OrderBy(i => i.Name, StringComparer.OrdinalIgnoreCase),
                "size" => desc ? items.OrderByDescending(i => i.Size ?? -1) : items.OrderBy(i => i.Size ?? -1),
                "type" => desc ? items.OrderByDescending(i => i.Extension ?? "").ThenByDescending(i => i.Name)
                               : items.OrderBy(i => i.Extension ?? "").ThenBy(i => i.Name),
                _ => desc ? items.OrderByDescending(i => i.CreatedOn) : items.OrderBy(i => i.CreatedOn)
            };
            var paged = ordered.Skip((page - 1) * pageSize).Take(pageSize).ToList();

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
                TotalPages = (int)Math.Ceiling(total / (double)pageSize),
                FolderCount = folderTotal,
                FileCount = fileTotal,
                Extensions = extFacets
            };
        }

        public Task<string> SetFolderTagsAsync(string? employeeId, SetFolderTagsDTO dto) =>
            SetTagsAsync(employeeId, new SetTagsDTO { DocType = "Folder", Id = dto.FolderId, Tags = dto.Tags });

        // ---- tag authorization (single source of truth for GetTagAccess + SetTags) ----
        private async Task<(bool Can, string? Reason, string? Tags, string Name)> TagAccessCoreAsync(
            User user, bool isGA, string uid, string docType, int id)
        {
            var nodes = await _db.FolderData.AsNoTracking().Where(f => f.IsActive)
                .Select(f => new FolderNode
                {
                    FolderId = f.FolderId,
                    ParentFolderId = f.ParentFolderId,
                    FolderName = f.FolderName,
                    CreatedBy = f.CreatedBy,
                    AuthorizedUserId = f.AuthorizedUserId
                }).ToListAsync();
            var children = nodes.Where(n => n.ParentFolderId.HasValue && n.ParentFolderId.Value != 0)
                                .ToLookup(n => n.ParentFolderId!.Value);
            var (folderShares, fileShares) = await ShareMapsAsync(user);
            var writeRoots = new HashSet<int>(nodes
                .Where(n => Eq(n.CreatedBy, uid) || Eq(n.AuthorizedUserId, uid)).Select(n => n.FolderId));
            writeRoots.UnionWith(folderShares.Where(k => k.Value >= 2).Select(k => k.Key));
            var writeScope = Expand(writeRoots, children);

            if (docType == "Document")
            {
                var file = await _db.FileData.AsNoTracking().FirstOrDefaultAsync(f => f.FileId == id && f.IsActive)
                           ?? throw new KeyNotFoundException("File not found.");
                if (!isGA && file.IsHide) return (false, "This file is not available.", file.Tags, file.FileName);
                var ok = isGA || Eq(file.CreatedBy, uid)
                         || (fileShares.TryGetValue(file.FileId, out var t) && t >= 2)
                         || writeScope.Contains(file.FolderId);
                if (!ok) return (false, "You have read-only access. Tags can be edited with Read/Write access or by the owner.", file.Tags, file.FileName);
                if (!string.IsNullOrEmpty(file.CheckedOutBy) && !Eq(file.CheckedOutBy, uid))
                    return (false, "This file is checked out by another user.", file.Tags, file.FileName);
                return (true, null, file.Tags, file.FileName);
            }

            var folder = await _db.FolderData.AsNoTracking().FirstOrDefaultAsync(f => f.FolderId == id && f.IsActive)
                         ?? throw new KeyNotFoundException("Folder not found.");
            if (!isGA && folder.IsHide) return (false, "This folder is not available.", folder.Tags, folder.FolderName);
            if (!(isGA || writeScope.Contains(folder.FolderId)))
                return (false, "You have read-only access. Tags can be edited with Read/Write access or by the owner.", folder.Tags, folder.FolderName);
            return (true, null, folder.Tags, folder.FolderName);
        }

        public async Task<TagAccessDTO> GetTagAccessAsync(string? employeeId, string? docType, int id)
        {
            var (user, isGA) = await ResolveUserAsync(employeeId);
            var uid = user.UserID.ToString().ToLower();
            var type = string.Equals(docType, "Document", StringComparison.OrdinalIgnoreCase) ? "Document" : "Folder";
            var r = await TagAccessCoreAsync(user, isGA, uid, type, id);
            return new TagAccessDTO { CanEdit = r.Can, Reason = r.Reason, Tags = r.Tags, Name = r.Name };
        }

        public async Task<string> SetTagsAsync(string? employeeId, SetTagsDTO dto)
        {
            var (user, isGA) = await ResolveUserAsync(employeeId);
            var uid = user.UserID.ToString().ToLower();
            var type = string.Equals(dto.DocType, "Document", StringComparison.OrdinalIgnoreCase) ? "Document" : "Folder";
            var cleaned = CleanTags(dto.Tags);
            var tags = cleaned.Any() ? string.Join(",", cleaned) : null;

            var access = await TagAccessCoreAsync(user, isGA, uid, type, dto.Id);
            if (!access.Can) throw new SearchForbiddenException(access.Reason ?? "You do not have permission to edit tags.");

            if (type == "Document")
            {
                var file = await _db.FileData.FirstAsync(f => f.FileId == dto.Id);
                file.Tags = tags;
                file.ModifiedOn = DateTime.Now;
                file.ModifiedBy = uid;
                var parent = await _db.FolderData.FirstOrDefaultAsync(f => f.FolderId == file.FolderId);
                if (parent != null)
                    await _report.AddFolderVersionAsync(parent, "FileUpdated", uid,
                        $"Tags of file '{file.FileName}' updated to '{tags ?? ""}'", file.FileName, saveChanges: false);
            }
            else
            {
                var folder = await _db.FolderData.FirstAsync(f => f.FolderId == dto.Id);
                folder.Tags = tags;
                folder.ModifiedOn = DateTime.Now;
                folder.ModifiedBy = uid;
                await _report.AddFolderVersionAsync(folder, "Updated", uid, $"Tags updated to '{tags ?? ""}'", saveChanges: false);
            }

            await _report.LogOwnershipOrAccessAsync(dto.Id, type, "Modified", null, null, null, null, uid,
                $"Tags set to '{tags ?? ""}'", saveChanges: false);
            await _db.SaveChangesAsync();
            await _report.LogFolderAccessAsync(dto.Id, type, access.Name, uid, "Update");
            return tags ?? "";
        }
    }
}
