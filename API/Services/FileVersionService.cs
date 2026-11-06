using DDAAPI.DbContexts;
using DDAAPI.Models;
using DDAAPI.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace DDAAPI.Services
{
    public class FileVersionForbiddenException : Exception
    {
        public FileVersionForbiddenException(string m) : base(m) { }
    }

    public class FileVersionService
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _cfg;
        private readonly IReportService _report;
        private readonly IHubContext<CollabHub> _hub;

        public FileVersionService(AppDbContext db, IConfiguration cfg, IReportService report, IHubContext<CollabHub> hub)
        {
            _db = db; _cfg = cfg; _report = report; _hub = hub;
        }

        private static bool Eq(string? a, string b) => a != null && a.Equals(b, StringComparison.OrdinalIgnoreCase);

        private async Task<(User User, bool IsGA)> ResolveAsync(string? employeeId)
        {
            if (string.IsNullOrWhiteSpace(employeeId)) throw new UnauthorizedAccessException("Invalid session.");
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.EmployeeId == employeeId && u.IsActive)
                       ?? throw new UnauthorizedAccessException("User not found or inactive.");
            var role = await (from m in _db.UserRoleMaps
                              join r in _db.Roles on m.RoleID equals r.RoleID
                              where m.UserID == user.UserID && m.IsActive
                              select r.RoleName).FirstOrDefaultAsync();
            return (user, role == "Global Admin");
        }

        // view = any access; write = owner/admin/authorized or share with AccessType 2 or 3
        private async Task<(bool View, bool Write)> AccessAsync(User u, bool ga, FileData f)
        {
            if (ga) return (true, true);
            if (f.IsHide) return (false, false);
            var uid = u.UserID.ToString();
            if (Eq(f.CreatedBy, uid)) return (true, true);

            var shares = await _db.ShareDocAccess.AsNoTracking()
                .Where(s => s.AccessUserId == u.UserID && s.IsActive)
                .Select(s => new { s.FolderOrFileId, s.DocType, s.AccessType }).ToListAsync();

            bool view = false, write = false;
            foreach (var s in shares.Where(s => s.DocType == "Document" && s.FolderOrFileId == f.FileId))
            { view = true; write |= s.AccessType >= 2; }

            var cur = f.FolderId; var guard = 0;
            while (cur != 0 && guard++ < 25)
            {
                var n = await _db.FolderData.AsNoTracking().Where(x => x.FolderId == cur && x.IsActive)
                    .Select(x => new { x.ParentFolderId, x.CreatedBy, x.AuthorizedUserId }).FirstOrDefaultAsync();
                if (n == null) break;
                if (Eq(n.CreatedBy, uid) || Eq(n.AuthorizedUserId, uid)) return (true, true);
                foreach (var s in shares.Where(s => s.DocType == "Folder" && s.FolderOrFileId == cur))
                { view = true; write |= s.AccessType >= 2; }
                cur = n.ParentFolderId ?? 0;
            }
            return (view, write);
        }

        private async Task<Dictionary<string, string>> NamesAsync(IEnumerable<string?> ids)
        {
            var guids = ids.Where(i => !string.IsNullOrWhiteSpace(i))
                           .Select(i => Guid.TryParse(i, out var g) ? g : (Guid?)null)
                           .Where(g => g.HasValue).Select(g => g!.Value).Distinct().ToList();
            var rows = await _db.EmpInfos.AsNoTracking().Where(e => guids.Contains(e.EmpId))
                .Select(e => new { e.EmpId, e.FirstName, e.LastName }).ToListAsync();
            return rows.ToDictionary(r => r.EmpId.ToString().ToLower(), r => $"{r.FirstName} {r.LastName}".Trim());
        }

        private static string NameOf(Dictionary<string, string> m, string? id) =>
            id != null && m.TryGetValue(id.ToLower(), out var n) ? n : "Unknown";

        // Copies the current live file into _FileVersions and returns the archive row (not yet saved).
        private FileVersion Archive(FileData f)
        {
            if (!File.Exists(f.FilePath)) throw new Exception("Current file is missing on the server.");
            var dir = Path.Combine(_cfg["BaseFolderPath"]!, "_FileVersions", f.FileId.ToString());
            Directory.CreateDirectory(dir);
            var name = $"v{f.CurrentVersion}_{f.FileName}";
            var dest = Path.Combine(dir, name);
            File.Copy(f.FilePath, dest, true);
            return new FileVersion
            {
                FileId = f.FileId,
                VersionNumber = f.CurrentVersion,
                FileName = f.FileName,
                StoredPath = dest,
                ServerPath = $"{_cfg["ApiURL"]}/StaticFiles/_FileVersions/{f.FileId}/{Uri.EscapeDataString(name)}",
                Size = f.Size,
                Note = f.VersionNote,
                CreatedBy = f.ModifiedBy ?? f.CreatedBy,
                CreatedOn = f.ModifiedOn ?? f.CreatedOn
            };
        }

        // Used by the SignalR hub: verifies the user can view the file, returns identity for presence.
        public async Task<(string UserId, string Name)> GetViewerAsync(string? emp, int fileId)
        {
            var (u, ga) = await ResolveAsync(emp);
            var f = await _db.FileData.AsNoTracking().FirstOrDefaultAsync(x => x.FileId == fileId && x.IsActive)
                    ?? throw new HubException("File not found.");
            var (view, _) = await AccessAsync(u, ga, f);
            if (!view) throw new HubException("You do not have access to this file.");
            var uid = u.UserID.ToString().ToLower();
            var names = await NamesAsync(new[] { uid });
            return (uid, NameOf(names, uid));
        }

        // Pushes a live event to everyone currently viewing the file. Never breaks the main operation.
        private async Task NotifyAsync(FileData f, string action, string uid, string message)
        {
            try
            {
                var names = await NamesAsync(new[] { uid });
                await _hub.Clients.Group(CollabHub.Group(f.FileId)).SendAsync("FileChanged", new
                {
                    fileId = f.FileId,
                    action,
                    byUserId = uid.ToLower(),
                    byName = NameOf(names, uid),
                    version = f.CurrentVersion,
                    message
                });
            }
            catch { }
        }

        private static void EnsureNotLockedByOther(FileData f, string uid)
        {
            if (!string.IsNullOrEmpty(f.CheckedOutBy) && !Eq(f.CheckedOutBy, uid))
                throw new ArgumentException("This file is checked out by another user. Ask them to check it in first.");
        }
        public async Task<FileVersionListDTO> ListAsync(string? emp, int fileId)
        {
            var (u, ga) = await ResolveAsync(emp);
            var uid = u.UserID.ToString();
            var f = await _db.FileData.AsNoTracking().FirstOrDefaultAsync(x => x.FileId == fileId && x.IsActive)
                    ?? throw new KeyNotFoundException("File not found.");
            var (view, write) = await AccessAsync(u, ga, f);
            if (!view) throw new FileVersionForbiddenException("You do not have access to this file.");

            var rows = await _db.FileVersions.AsNoTracking().Where(v => v.FileId == fileId)
                .OrderByDescending(v => v.VersionNumber).ToListAsync();
            var names = await NamesAsync(rows.Select(r => r.CreatedBy)
                .Append(f.ModifiedBy ?? f.CreatedBy).Append(f.CheckedOutBy));

            var locked = !string.IsNullOrEmpty(f.CheckedOutBy);
            var mine = locked && Eq(f.CheckedOutBy, uid);

            var result = new FileVersionListDTO
            {
                FileId = f.FileId,
                FileName = f.FileName,
                CurrentVersion = f.CurrentVersion,
                CanUpload = write && (!locked || mine),
                CanCheckOut = write && !locked,
                IsLocked = locked,
                LockedByMe = mine,
                LockedByName = locked ? NameOf(names, f.CheckedOutBy) : null,
                LockedOn = f.CheckedOutOn,
                CanForceRelease = locked && !mine && ga
            };
            result.Versions.Add(new FileVersionDTO
            {
                VersionId = 0,
                VersionNumber = f.CurrentVersion,
                FileName = f.FileName,
                Size = f.Size,
                Note = f.VersionNote,
                CreatedByName = NameOf(names, f.ModifiedBy ?? f.CreatedBy),
                CreatedOn = f.ModifiedOn ?? f.CreatedOn,
                IsCurrent = true
            });
            result.Versions.AddRange(rows.Select(r => new FileVersionDTO
            {
                VersionId = r.VersionId,
                VersionNumber = r.VersionNumber,
                FileName = r.FileName,
                Size = r.Size,
                Note = r.Note,
                CreatedByName = NameOf(names, r.CreatedBy),
                CreatedOn = r.CreatedOn
            }));
            return result;
        }

        public async Task<int> UploadNewVersionAsync(string? emp, UploadFileVersionDTO dto)
        {
            var (u, ga) = await ResolveAsync(emp);
            var uid = u.UserID.ToString();
            var f = await _db.FileData.FirstOrDefaultAsync(x => x.FileId == dto.FileId && x.IsActive)
                    ?? throw new KeyNotFoundException("File not found.");
            var (_, write) = await AccessAsync(u, ga, f);
            if (!write) throw new FileVersionForbiddenException("You do not have permission to upload a new version.");

            EnsureNotLockedByOther(f, uid);
            if (dto.ExpectedVersion.HasValue && dto.ExpectedVersion.Value != f.CurrentVersion)
                throw new ArgumentException($"Someone else saved a newer version (v{f.CurrentVersion}) while you were working. Reopen Version History and try again.");

            if (dto.File == null || dto.File.Length == 0) throw new ArgumentException("Please choose a file.");
            var oldExt = Path.GetExtension(f.FileName);
            if (!string.Equals(oldExt, Path.GetExtension(dto.File.FileName), StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException($"New version must be a {oldExt} file.");
            var note = (dto.Note ?? "").Trim();
            if (note.Length > 500) throw new ArgumentException("Note cannot exceed 500 characters.");

            if (!string.IsNullOrEmpty(f.CreatedBy))
            {
                var st = await _db.UserStorage.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.UserId != null && x.UserId.ToLower() == f.CreatedBy.ToLower());
                if (st != null && st.MaximumAllocatedStorage.HasValue &&
                    st.MaximumAllocatedStorage.Value <= (st.UsedStorage ?? 0) + dto.File.Length - f.Size)
                    throw new ArgumentException("There is no storage to save this version.");
            }

            _db.FileVersions.Add(Archive(f));

            using (var fs = new FileStream(f.FilePath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true))
                await dto.File.CopyToAsync(fs);

            f.Size = dto.File.Length;
            f.CurrentVersion += 1;
            f.VersionNote = note.Length == 0 ? null : note;
            f.ModifiedOn = DateTime.Now;
            f.ModifiedBy = uid;
            if (Eq(f.CheckedOutBy, uid)) { f.CheckedOutBy = null; f.CheckedOutOn = null; } // upload = check in
            await _db.SaveChangesAsync();

            await TouchFolderAsync(f, uid, $"File '{f.FileName}' new version v{f.CurrentVersion}");
            Log.DataLog(uid, $"New version v{f.CurrentVersion} uploaded for file '{f.FileName}' (ID {f.FileId})", "File Version Log");
            await NotifyAsync(f, "uploaded", uid, $"uploaded v{f.CurrentVersion}");
            return f.CurrentVersion;
        }

        public async Task<int> RestoreAsync(string? emp, int versionId)
        {
            var (u, ga) = await ResolveAsync(emp);
            var uid = u.UserID.ToString();
            var v = await _db.FileVersions.FirstOrDefaultAsync(x => x.VersionId == versionId)
                    ?? throw new KeyNotFoundException("Version not found.");
            var f = await _db.FileData.FirstOrDefaultAsync(x => x.FileId == v.FileId && x.IsActive)
                    ?? throw new KeyNotFoundException("File not found.");
            var (_, write) = await AccessAsync(u, ga, f);
            if (!write) throw new FileVersionForbiddenException("You do not have permission to restore versions.");

            EnsureNotLockedByOther(f, uid);

            if (!File.Exists(v.StoredPath)) throw new Exception("The stored version file is missing on the server.");

            _db.FileVersions.Add(Archive(f));
            File.Copy(v.StoredPath, f.FilePath, true);

            f.Size = v.Size;
            f.CurrentVersion += 1;
            f.VersionNote = $"Restored from v{v.VersionNumber}";
            f.ModifiedOn = DateTime.Now;
            f.ModifiedBy = uid;
            await _db.SaveChangesAsync();

            await TouchFolderAsync(f, uid, $"File '{f.FileName}' restored to v{v.VersionNumber} content (now v{f.CurrentVersion})");
            Log.DataLog(uid, $"File '{f.FileName}' (ID {f.FileId}) restored from v{v.VersionNumber}", "File Version Log");
            await NotifyAsync(f, "restored", uid, $"restored an older version (now v{f.CurrentVersion})");
            return f.CurrentVersion;
        }

        public async Task<bool> CheckOutAsync(string? emp, int fileId)
        {
            var (u, ga) = await ResolveAsync(emp);
            var uid = u.UserID.ToString();
            var f = await _db.FileData.FirstOrDefaultAsync(x => x.FileId == fileId && x.IsActive)
                    ?? throw new KeyNotFoundException("File not found.");
            var (_, write) = await AccessAsync(u, ga, f);
            if (!write) throw new FileVersionForbiddenException("You need write access to check out this file.");
            if (!string.IsNullOrEmpty(f.CheckedOutBy))
            {
                if (Eq(f.CheckedOutBy, uid)) return true; // already yours
                throw new ArgumentException("This file is already checked out by another user.");
            }
            f.CheckedOutBy = uid;
            f.CheckedOutOn = DateTime.Now;
            await _db.SaveChangesAsync();
            Log.DataLog(uid, $"File '{f.FileName}' (ID {f.FileId}) checked out", "File Version Log");
            await NotifyAsync(f, "checkedout", uid, "checked out this file");
            return true;
        }

        public async Task<bool> ReleaseAsync(string? emp, int fileId)
        {
            var (u, ga) = await ResolveAsync(emp);
            var uid = u.UserID.ToString();
            var f = await _db.FileData.FirstOrDefaultAsync(x => x.FileId == fileId && x.IsActive)
                    ?? throw new KeyNotFoundException("File not found.");
            if (string.IsNullOrEmpty(f.CheckedOutBy)) return true;
            if (!(ga || Eq(f.CheckedOutBy, uid)))
                throw new FileVersionForbiddenException("Only the person who checked out this file (or a Global Admin) can release it.");
            f.CheckedOutBy = null;
            f.CheckedOutOn = null;
            await _db.SaveChangesAsync();
            Log.DataLog(uid, $"File '{f.FileName}' (ID {f.FileId}) check-out released", "File Version Log");
            await NotifyAsync(f, "released", uid, "released the check-out");
            return true;
        }

        public async Task<(string Path, string Name)> GetVersionFileAsync(string? emp, int versionId)
        {
            var (u, ga) = await ResolveAsync(emp);
            var v = await _db.FileVersions.AsNoTracking().FirstOrDefaultAsync(x => x.VersionId == versionId)
                    ?? throw new KeyNotFoundException("Version not found.");
            var f = await _db.FileData.AsNoTracking().FirstOrDefaultAsync(x => x.FileId == v.FileId)
                    ?? throw new KeyNotFoundException("File not found.");
            var (view, _) = await AccessAsync(u, ga, f);
            if (!view) throw new FileVersionForbiddenException("You do not have access to this file.");
            if (!File.Exists(v.StoredPath)) throw new KeyNotFoundException("Stored version file is missing.");
            var ext = Path.GetExtension(v.FileName);
            return (v.StoredPath, $"{Path.GetFileNameWithoutExtension(v.FileName)}_v{v.VersionNumber}{ext}");
        }

        // Reuses existing folder version history + access report
        private async Task TouchFolderAsync(FileData f, string uid, string remarks)
        {
            if (f.FolderId == 0) return;
            var folder = await _db.FolderData.FirstOrDefaultAsync(x => x.FolderId == f.FolderId);
            if (folder == null) return;
            await _report.AddFolderVersionAsync(folder, "FileUpdated", uid, remarks, f.FileName);
            await _report.LogFolderAccessAsync(folder.FolderId, "Folder", folder.FolderName, uid, "Edit");
        }

        // Write access for co-authoring (respects shares and check-out locks).
        public async Task<bool> CanWriteAsync(string? emp, int fileId)
        {
            var (u, ga) = await ResolveAsync(emp);
            var f = await _db.FileData.AsNoTracking().FirstOrDefaultAsync(x => x.FileId == fileId && x.IsActive)
                    ?? throw new HubException("File not found.");
            var (_, write) = await AccessAsync(u, ga, f);
            if (write && !string.IsNullOrEmpty(f.CheckedOutBy) && !Eq(f.CheckedOutBy, u.UserID.ToString())) return false;
            return write;
        }
    }
}