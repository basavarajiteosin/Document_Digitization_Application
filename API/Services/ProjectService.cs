using DDAAPI.DbContexts;
using DDAAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace DDAAPI.Services
{
    public class ProjectForbiddenException : Exception
    {
        public ProjectForbiddenException(string m) : base(m) { }
    }

    public class ProjectService
    {
        private readonly AppDbContext _db;
        private readonly IReportService _report;

        public ProjectService(AppDbContext db, IReportService report)
        {
            _db = db; _report = report;
        }

        private sealed class Actor { public Guid UserId; public string Uid = ""; public bool IsGA; }
        private sealed record ItemInfo(string Name, string Path, string ServerPath, int ExistFolId, string? CreatedBy, string? AuthorizedUserId);

        private static bool Eq(string? a, string b) => a != null && a.Equals(b, StringComparison.OrdinalIgnoreCase);

        private async Task<Actor> AdminAsync(string? employeeId)
        {
            if (string.IsNullOrWhiteSpace(employeeId)) throw new UnauthorizedAccessException("Invalid session.");
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.EmployeeId == employeeId && u.IsActive)
                       ?? throw new UnauthorizedAccessException("User not found or inactive.");
            var role = await (from m in _db.UserRoleMaps
                              join r in _db.Roles on m.RoleID equals r.RoleID
                              where m.UserID == user.UserID && m.IsActive
                              select r.RoleName).FirstOrDefaultAsync();
            if (role != "Global Admin" && role != "Administrator")
                throw new ProjectForbiddenException("Only Administrator or Global Admin can manage projects.");
            return new Actor { UserId = user.UserID, Uid = user.UserID.ToString().ToLower(), IsGA = role == "Global Admin" };
        }

        private static string NormType(string? t)
        {
            if (string.Equals(t, "Folder", StringComparison.OrdinalIgnoreCase)) return "Folder";
            if (string.Equals(t, "Document", StringComparison.OrdinalIgnoreCase)) return "Document";
            throw new ArgumentException("DocType must be 'Folder' or 'Document'.");
        }

        private async Task<ItemInfo?> InfoAsync(string docType, int id)
        {
            if (docType == "Folder")
            {
                var f = await _db.FolderData.AsNoTracking().FirstOrDefaultAsync(x => x.FolderId == id && x.IsActive);
                return f == null ? null : new ItemInfo(f.FolderName, f.FolderPath ?? "", f.ServerFolderPath ?? "", f.ParentFolderId ?? 0, f.CreatedBy, f.AuthorizedUserId);
            }
            var d = await _db.FileData.AsNoTracking().FirstOrDefaultAsync(x => x.FileId == id && x.IsActive);
            return d == null ? null : new ItemInfo(d.FileName, d.FilePath ?? "", d.ServerFilePath ?? "", d.FolderId, d.CreatedBy, null);
        }

        // ---------------------------------------------------------------- read
        public async Task<List<ProjectDTO>> ListAsync(string? emp)
        {
            await AdminAsync(emp);
            var projects = await _db.Projects.AsNoTracking().OrderByDescending(p => p.CreatedOn).ToListAsync();
            var ids = projects.Select(p => p.ProjectId).ToList();
            var members = await _db.ProjectMembers.AsNoTracking().Where(m => ids.Contains(m.ProjectId)).ToListAsync();
            var items = await _db.ProjectItems.AsNoTracking().Where(i => ids.Contains(i.ProjectId)).ToListAsync();

            var guids = members.Select(m => m.UserId).Distinct().ToList();
            var emps = await _db.EmpInfos.AsNoTracking().Where(e => guids.Contains(e.EmpId))
                .Select(e => new { e.EmpId, e.FirstName, e.LastName }).ToListAsync();
            var names = emps.ToDictionary(e => e.EmpId, e => $"{e.FirstName} {e.LastName}".Trim());

            var folderIds = items.Where(i => i.DocType == "Folder").Select(i => i.FolderOrFileId).Distinct().ToList();
            var fileIds = items.Where(i => i.DocType == "Document").Select(i => i.FolderOrFileId).Distinct().ToList();
            var folderNames = await _db.FolderData.AsNoTracking().Where(f => folderIds.Contains(f.FolderId))
                .ToDictionaryAsync(f => f.FolderId, f => f.FolderName);
            var fileNames = await _db.FileData.AsNoTracking().Where(f => fileIds.Contains(f.FileId))
                .ToDictionaryAsync(f => f.FileId, f => f.FileName);

            return projects.Select(p => new ProjectDTO
            {
                ProjectId = p.ProjectId,
                ProjectName = p.ProjectName,
                Description = p.Description,
                Division = p.Division,
                IsActive = p.IsActive,
                CreatedOn = p.CreatedOn,
                Members = members.Where(m => m.ProjectId == p.ProjectId).Select(m => new ProjectMemberDTO
                {
                    UserId = m.UserId.ToString(),
                    Name = names.GetValueOrDefault(m.UserId) ?? "Unknown"
                }).ToList(),
                Items = items.Where(i => i.ProjectId == p.ProjectId).Select(i => new ProjectItemDTO
                {
                    PIId = i.PIId,
                    DocType = i.DocType,
                    FolderOrFileId = i.FolderOrFileId,
                    AccessType = i.AccessType,
                    Name = (i.DocType == "Folder" ? folderNames : fileNames).GetValueOrDefault(i.FolderOrFileId) ?? "(deleted item)"
                }).ToList()
            }).ToList();
        }

        // ---------------------------------------------------------------- write
        public async Task<int> SaveAsync(string? emp, SaveProjectDTO dto)
        {
            var a = await AdminAsync(emp);
            var name = (dto.ProjectName ?? "").Trim();
            if (name.Length == 0) throw new ArgumentException("Project name is required.");
            if (name.Length > 200) throw new ArgumentException("Project name cannot exceed 200 characters.");
            var desc = (dto.Description ?? "").Trim();
            if (desc.Length > 1000) throw new ArgumentException("Description cannot exceed 1000 characters.");

            var memberIds = (dto.UserIds ?? new List<string>())
                .Select(s => Guid.TryParse(s, out var g) ? g : (Guid?)null)
                .Where(g => g.HasValue).Select(g => g!.Value).Distinct().ToList();

            Project p;
            if (dto.ProjectId.HasValue && dto.ProjectId.Value > 0)
            {
                p = await _db.Projects.FirstOrDefaultAsync(x => x.ProjectId == dto.ProjectId.Value)
                    ?? throw new KeyNotFoundException("Project not found.");
                if (await _db.Projects.AnyAsync(x => x.ProjectId != p.ProjectId && x.ProjectName == name))
                    throw new ArgumentException("A project with this name already exists.");
                p.ProjectName = name; p.Description = desc.Length == 0 ? null : desc;
                p.Division = string.IsNullOrWhiteSpace(dto.Division) ? null : dto.Division.Trim();
                p.IsActive = dto.IsActive; p.ModifiedOn = DateTime.Now; p.ModifiedBy = a.Uid;
            }
            else
            {
                if (await _db.Projects.AnyAsync(x => x.ProjectName == name))
                    throw new ArgumentException("A project with this name already exists.");
                p = new Project
                {
                    ProjectName = name,
                    Description = desc.Length == 0 ? null : desc,
                    Division = string.IsNullOrWhiteSpace(dto.Division) ? null : dto.Division.Trim(),
                    IsActive = true,
                    CreatedOn = DateTime.Now,
                    CreatedBy = a.Uid
                };
                _db.Projects.Add(p);
            }
            await _db.SaveChangesAsync();

            var current = await _db.ProjectMembers.Where(m => m.ProjectId == p.ProjectId).ToListAsync();
            _db.ProjectMembers.RemoveRange(current.Where(m => !memberIds.Contains(m.UserId)));
            var have = current.Select(m => m.UserId).ToHashSet();
            foreach (var uid in memberIds.Where(u => !have.Contains(u)))
                _db.ProjectMembers.Add(new ProjectMember { ProjectId = p.ProjectId, UserId = uid, AddedOn = DateTime.Now, AddedBy = a.Uid });
            await _db.SaveChangesAsync();

            await SyncAsync(p.ProjectId, a.Uid);
            Log.DataLog(a.Uid, $"Project '{p.ProjectName}' (ID {p.ProjectId}) saved with {memberIds.Count} member(s)", "Project Log");
            return p.ProjectId;
        }

        public async Task<bool> DeleteAsync(string? emp, int projectId)
        {
            var a = await AdminAsync(emp);
            var p = await _db.Projects.FirstOrDefaultAsync(x => x.ProjectId == projectId)
                    ?? throw new KeyNotFoundException("Project not found.");

            _db.ProjectItems.RemoveRange(_db.ProjectItems.Where(i => i.ProjectId == projectId));
            await _db.SaveChangesAsync();
            await SyncAsync(projectId, a.Uid);   // no items left -> revokes every project-granted share

            _db.ProjectMembers.RemoveRange(_db.ProjectMembers.Where(m => m.ProjectId == projectId));
            _db.Projects.Remove(p);
            await _db.SaveChangesAsync();
            Log.DataLog(a.Uid, $"Project '{p.ProjectName}' (ID {projectId}) deleted", "Project Log");
            return true;
        }

        public async Task<int> AssignItemAsync(string? emp, AssignProjectItemDTO dto)
        {
            var a = await AdminAsync(emp);
            var t = NormType(dto.DocType);
            if (dto.AccessType < 1 || dto.AccessType > 3) throw new ArgumentException("Please select an access type.");

            var p = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.ProjectId == dto.ProjectId)
                    ?? throw new KeyNotFoundException("Project not found.");
            if (!p.IsActive) throw new ArgumentException("This project is inactive.");

            var info = await InfoAsync(t, dto.FolderOrFileId) ?? throw new KeyNotFoundException("Item not found.");
            if (!(a.IsGA || Eq(info.CreatedBy, a.Uid) || Eq(info.AuthorizedUserId, a.Uid)))
                throw new ProjectForbiddenException("You can only assign items you own or are authorized for.");

            var row = await _db.ProjectItems.FirstOrDefaultAsync(i => i.ProjectId == dto.ProjectId
                        && i.FolderOrFileId == dto.FolderOrFileId && i.DocType == t);
            if (row != null) { row.AccessType = dto.AccessType; row.AssignedBy = a.Uid; row.AssignedOn = DateTime.Now; }
            else
            {
                row = new ProjectItem
                {
                    ProjectId = dto.ProjectId,
                    FolderOrFileId = dto.FolderOrFileId,
                    DocType = t,
                    AccessType = dto.AccessType,
                    AssignedBy = a.Uid,
                    AssignedOn = DateTime.Now
                };
                _db.ProjectItems.Add(row);
            }
            await _db.SaveChangesAsync();
            await SyncAsync(dto.ProjectId, a.Uid);
            Log.DataLog(a.Uid, $"{t} '{info.Name}' assigned to project '{p.ProjectName}'", "Project Log");
            return row.PIId;
        }

        public async Task<bool> UnassignItemAsync(string? emp, int piId)
        {
            var a = await AdminAsync(emp);
            var row = await _db.ProjectItems.FirstOrDefaultAsync(i => i.PIId == piId)
                      ?? throw new KeyNotFoundException("Assignment not found.");
            _db.ProjectItems.Remove(row);
            await _db.SaveChangesAsync();
            await SyncAsync(row.ProjectId, a.Uid);
            return true;
        }

        // ---------------------------------------------------------------- sync
        // Makes ShareDocAccess rows tagged "project:{id}" match (active members x assigned items).
        // Manual shares (other Comment values) are never touched.
        private async Task SyncAsync(int projectId, string actionBy)
        {
            var p = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.ProjectId == projectId);
            var tag = $"project:{projectId}";
            var existing = await _db.ShareDocAccess.Where(s => s.Comment == tag).ToListAsync();

            var pairs = new List<(Guid User, ProjectItem Item, ItemInfo Info)>();
            if (p != null && p.IsActive)
            {
                var memberIds = await _db.ProjectMembers.Where(m => m.ProjectId == projectId).Select(m => m.UserId).ToListAsync();
                var activeIds = await _db.Users.AsNoTracking().Where(u => memberIds.Contains(u.UserID) && u.IsActive)
                    .Select(u => u.UserID).ToListAsync();
                var items = await _db.ProjectItems.Where(i => i.ProjectId == projectId).ToListAsync();
                foreach (var item in items)
                {
                    var info = await InfoAsync(item.DocType, item.FolderOrFileId);
                    if (info == null) continue;
                    foreach (var uid in activeIds)
                    {
                        if (Eq(info.CreatedBy, uid.ToString())) continue; // owner already has access
                        pairs.Add((uid, item, info));
                    }
                }
            }

            // revoke what is no longer wanted
            foreach (var e in existing.ToList())
            {
                if (pairs.Any(x => x.User == e.AccessUserId && x.Item.FolderOrFileId == e.FolderOrFileId && x.Item.DocType == e.DocType)) continue;
                _db.ShareDocAccess.Remove(e);
                await _report.LogOwnershipOrAccessAsync(e.FolderOrFileId, e.DocType, "AccessRevoked", null, null,
                    e.AccessUserId, null, actionBy, $"Project '{p?.ProjectName}'", saveChanges: false);
            }

            // grant / update
            foreach (var (user, item, info) in pairs)
            {
                var cur = existing.FirstOrDefault(e => e.AccessUserId == user && e.FolderOrFileId == item.FolderOrFileId && e.DocType == item.DocType);
                if (cur != null)
                {
                    if (cur.AccessType != item.AccessType)
                    {
                        cur.AccessType = item.AccessType; cur.ModifiedOn = DateTime.Now; cur.ModifiedBy = actionBy; cur.IsActive = true;
                        await _report.LogOwnershipOrAccessAsync(item.FolderOrFileId, item.DocType, "AccessUpdated", null, null,
                            user, null, actionBy, $"Project '{p!.ProjectName}'", saveChanges: false);
                    }
                    continue;
                }

                var manual = await _db.ShareDocAccess.AnyAsync(s => s.AccessUserId == user && s.FolderOrFileId == item.FolderOrFileId
                                                                   && s.DocType == item.DocType && s.Comment != tag);
                if (manual) continue;

                _db.ShareDocAccess.Add(new ShareDocAccess
                {
                    FolderOrFileId = item.FolderOrFileId,
                    DocType = item.DocType,
                    FileExistFolId = info.ExistFolId,
                    FolderOrFileName = info.Name,
                    FolderOrFilePath = info.Path,
                    ServerFolderOrFilePath = info.ServerPath,
                    AccessUserId = user,
                    AccessType = item.AccessType,
                    IsActive = true,
                    Comment = tag,
                    CreatedOn = DateTime.Now,
                    CreatedBy = actionBy,
                    IsView = false
                });
                await _report.LogOwnershipOrAccessAsync(item.FolderOrFileId, item.DocType, "AccessGranted", null, null,
                    user, null, actionBy, $"Project '{p!.ProjectName}'", saveChanges: false);
            }

            await _db.SaveChangesAsync();
        }
    }
}