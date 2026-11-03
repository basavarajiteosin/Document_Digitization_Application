using DDAAPI.DbContexts;
using DDAAPI.Models;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using System.Drawing;

namespace DDAAPI.Services
{
    public class ItemDetailsForbiddenException : Exception
    {
        public ItemDetailsForbiddenException(string m) : base(m) { }
    }

    public class ItemDetailsService
    {
        private readonly AppDbContext _db;
        private readonly IReportService _report;

        public ItemDetailsService(AppDbContext db, IReportService report) { _db = db; _report = report; }

        private sealed class Actor { public User User = null!; public string Uid = ""; public bool IsGA; }
        private sealed record Node(int FolderId, int? ParentFolderId, string FolderName, string? CreatedBy, string? AuthorizedUserId, bool IsHide);
        private sealed class Item
        {
            public string Type = ""; public int Id; public string Name = ""; public int ContainerId;
            public string? CreatedBy; public string? ModifiedBy; public DateTime CreatedOn; public DateTime? ModifiedOn;
            public long Size; public int Version; public string? Tags; public bool IsHide; public string? Owner; public string? Ext;
        }
        private sealed class Ctx { public Actor A = null!; public Item It = null!; public List<Node> Chain = new(); public Dictionary<int, Node> ById = new(); public List<Node> All = new(); public bool View; public bool Manage; }

        private static bool Eq(string? a, string b) => a != null && a.Equals(b, StringComparison.OrdinalIgnoreCase);

        private static string NormType(string? t)
        {
            if (string.Equals(t, "Folder", StringComparison.OrdinalIgnoreCase)) return "Folder";
            if (string.Equals(t, "Document", StringComparison.OrdinalIgnoreCase)) return "Document";
            throw new ArgumentException("DocType must be 'Folder' or 'Document'.");
        }

        private static string Label(int? t) => t switch { 1 => "Read-only", 2 => "Read/Write", 3 => "Read/Write/Download", _ => "Unknown" };

        private async Task<Actor> ResolveAsync(string? employeeId)
        {
            if (string.IsNullOrWhiteSpace(employeeId)) throw new UnauthorizedAccessException("Invalid session.");
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.EmployeeId == employeeId && u.IsActive)
                       ?? throw new UnauthorizedAccessException("User not found or inactive.");
            var role = await (from m in _db.UserRoleMaps
                              join r in _db.Roles on m.RoleID equals r.RoleID
                              where m.UserID == user.UserID && m.IsActive
                              select r.RoleName).FirstOrDefaultAsync();
            return new Actor { User = user, Uid = user.UserID.ToString().ToLower(), IsGA = role == "Global Admin" };
        }

        private async Task<Ctx> PrepareAsync(string? emp, string? docType, int id, bool needManage = false)
        {
            var a = await ResolveAsync(emp);
            var type = NormType(docType);
            var c = new Ctx { A = a };

            if (type == "Folder")
            {
                var f = await _db.FolderData.AsNoTracking().FirstOrDefaultAsync(x => x.FolderId == id && x.IsActive)
                        ?? throw new KeyNotFoundException("Folder not found.");
                c.It = new Item
                {
                    Type = type,
                    Id = f.FolderId,
                    Name = f.FolderName,
                    ContainerId = f.FolderId,
                    CreatedBy = f.CreatedBy,
                    ModifiedBy = f.ModifiedBy,
                    CreatedOn = f.CreatedOn,
                    ModifiedOn = f.ModifiedOn,
                    Version = f.CurrentVersion,
                    Tags = f.Tags,
                    IsHide = f.IsHide,
                    Owner = f.Owner
                };
            }
            else
            {
                var f = await _db.FileData.AsNoTracking().FirstOrDefaultAsync(x => x.FileId == id && x.IsActive)
                        ?? throw new KeyNotFoundException("File not found.");
                c.It = new Item
                {
                    Type = type,
                    Id = f.FileId,
                    Name = f.FileName,
                    ContainerId = f.FolderId,
                    CreatedBy = f.CreatedBy,
                    ModifiedBy = f.ModifiedBy,
                    CreatedOn = f.CreatedOn,
                    ModifiedOn = f.ModifiedOn,
                    Size = f.Size,
                    Version = f.CurrentVersion,
                    Tags = f.Tags,
                    IsHide = f.IsHide,
                    Owner = f.Owner,
                    Ext = Path.GetExtension(f.FileName).TrimStart('.').ToUpper()
                };
            }

            c.All = await _db.FolderData.AsNoTracking().Where(f => f.IsActive)
                .Select(f => new Node(f.FolderId, f.ParentFolderId, f.FolderName, f.CreatedBy, f.AuthorizedUserId, f.IsHide)).ToListAsync();
            c.ById = c.All.ToDictionary(n => n.FolderId);

            var cur = c.It.ContainerId; var guard = 0;
            while (cur != 0 && c.ById.TryGetValue(cur, out var n) && guard++ < 25) { c.Chain.Add(n); cur = n.ParentFolderId ?? 0; }

            if (a.IsGA) { c.View = true; c.Manage = true; }
            else if (!c.It.IsHide && !c.Chain.Any(n => n.IsHide))
            {
                var owner = (type == "Document" && Eq(c.It.CreatedBy, a.Uid)) ||
                            c.Chain.Any(n => Eq(n.CreatedBy, a.Uid) || Eq(n.AuthorizedUserId, a.Uid));
                if (owner) { c.View = true; c.Manage = true; }
                else
                {
                    var ids = c.Chain.Select(n => n.FolderId).ToList();
                    c.View = await _db.ShareDocAccess.AsNoTracking().AnyAsync(s => s.AccessUserId == a.User.UserID && s.IsActive &&
                        ((s.DocType == type && s.FolderOrFileId == id) || (s.DocType == "Folder" && ids.Contains(s.FolderOrFileId))));
                }
            }

            if (!c.View) throw new ItemDetailsForbiddenException("You do not have access to this item.");
            if (needManage && !c.Manage) throw new ItemDetailsForbiddenException("Only the owner or an administrator can manage access.");
            return c;
        }

        private async Task<Dictionary<string, string>> NamesAsync(IEnumerable<string?> ids)
        {
            var guids = ids.Where(i => !string.IsNullOrWhiteSpace(i)).Select(i => Guid.TryParse(i, out var g) ? g : (Guid?)null)
                .Where(g => g.HasValue).Select(g => g!.Value).Distinct().ToList();
            var rows = await _db.EmpInfos.AsNoTracking().Where(e => guids.Contains(e.EmpId))
                .Select(e => new { e.EmpId, e.FirstName, e.LastName }).ToListAsync();
            return rows.ToDictionary(r => r.EmpId.ToString().ToLower(), r => $"{r.FirstName} {r.LastName}".Trim());
        }

        private static string NameOf(Dictionary<string, string> m, string? id) =>
            string.IsNullOrWhiteSpace(id) ? "-" :
            m.TryGetValue(id.ToLower(), out var n) ? n : (Guid.TryParse(id, out _) ? "Unknown" : id);

        private static string? ExtEmail(string? remarks) =>
            remarks != null && remarks.StartsWith("External share to ", StringComparison.OrdinalIgnoreCase)
                ? remarks.Substring("External share to ".Length).Trim() : null;

        // ------------------------------------------------------------------ details
        public async Task<ItemDetailsDTO> GetDetailsAsync(string? emp, string? docType, int id)
        {
            var c = await PrepareAsync(emp, docType, id);
            var it = c.It;
            var names = await NamesAsync(new[] { it.CreatedBy, it.ModifiedBy });

            long size = it.Size; int subs = 0, files = 0;
            if (it.Type == "Folder")
            {
                var children = c.All.Where(n => n.ParentFolderId.HasValue && n.ParentFolderId.Value != 0).ToLookup(n => n.ParentFolderId!.Value);
                var seen = new HashSet<int> { it.Id }; var q = new Queue<int>(seen);
                while (q.Count > 0) foreach (var ch in children[q.Dequeue()]) if (seen.Add(ch.FolderId)) q.Enqueue(ch.FolderId);
                var list = seen.ToList();
                subs = list.Count - 1;
                size = await _db.FileData.AsNoTracking().Where(f => f.IsActive && list.Contains(f.FolderId)).SumAsync(f => (long?)f.Size) ?? 0;
                files = await _db.FileData.AsNoTracking().CountAsync(f => f.IsActive && list.Contains(f.FolderId));
            }

            var segs = c.Chain.AsEnumerable().Reverse().Select(n => n.FolderName).ToList();
            if (it.Type == "Document") segs.Add(it.Name);
            var path = "Home / " + string.Join(" / ", segs);

            var acc = await BuildAccessAsync(c);
            return new ItemDetailsDTO
            {
                DocType = it.Type,
                Id = it.Id,
                Name = it.Name,
                Type = it.Type == "Folder" ? "Folder" : (it.Ext ?? "File"),
                Path = path,
                SizeBytes = size,
                SubFolderCount = subs,
                FileCount = files,
                OwnerEmail = it.Owner,
                CreatedByName = NameOf(names, it.CreatedBy),
                CreatedOn = it.CreatedOn,
                ModifiedByName = it.ModifiedOn.HasValue ? NameOf(names, it.ModifiedBy) : null,
                ModifiedOn = it.ModifiedOn,
                CurrentVersion = it.Version,
                Tags = it.Tags,
                IsHidden = it.IsHide,
                CanManageAccess = c.Manage,
                Shared = acc.Summary
            };
        }

        // ------------------------------------------------------------------ access
        public async Task<AccessResponseDTO> GetAccessAsync(string? emp, string? docType, int id)
        {
            var c = await PrepareAsync(emp, docType, id);
            return await BuildAccessAsync(c);
        }

        private async Task<AccessResponseDTO> BuildAccessAsync(Ctx c)
        {
            var it = c.It; var now = DateTime.Now;
            var res = new AccessResponseDTO { Name = it.Name, DocType = it.Type, CanManage = c.Manage };

            var internals = await _db.ShareDocAccess.AsNoTracking().Where(s => s.FolderOrFileId == it.Id && s.DocType == it.Type)
                .Select(s => new { s.SDAId, s.AccessUserId, s.AccessType, s.IsActive, s.CreatedOn, s.CreatedBy, s.Comment, s.IsExpiryDate, s.ExpiryDate }).ToListAsync();
            var externals = await _db.ExternalShareAccessHistory.AsNoTracking().Where(s => s.FolderOrFileId == it.Id && s.DocType == it.Type)
                .Select(s => new { s.ESAID, s.EmailAddress, s.AccessType, s.CreatedOn, s.CreatedBy, s.ExpireOn }).ToListAsync();
            var hist = await _db.OwnershipAccessHistory.AsNoTracking()
                .Where(h => h.FolderOrFileId == it.Id && h.DocType == it.Type && (h.ActionType == "AccessGranted" || h.ActionType == "AccessRevoked"))
                .OrderBy(h => h.ActionOn).ToListAsync();

            string? KeyOf(OwnershipAccessHistory h) => h.AccessUserId.HasValue ? h.AccessUserId.Value.ToString().ToLower() : ExtEmail(h.Remarks)?.ToLower();

            var userGuids = internals.Select(i => i.AccessUserId).Concat(hist.Where(h => h.AccessUserId.HasValue).Select(h => h.AccessUserId!.Value)).Distinct().ToList();
            var emails = await _db.Users.AsNoTracking().Where(u => userGuids.Contains(u.UserID)).Select(u => new { u.UserID, u.Email }).ToListAsync();
            var emailMap = emails.ToDictionary(e => e.UserID.ToString().ToLower(), e => e.Email);
            var names = await NamesAsync(userGuids.Select(g => g.ToString())
                .Concat(internals.Select(i => i.CreatedBy)).Concat(externals.Select(e => e.CreatedBy)).Concat(hist.Select(h => h.ActionBy)));

            foreach (var s in internals)
            {
                var project = s.Comment != null && s.Comment.StartsWith("project:", StringComparison.OrdinalIgnoreCase);
                var expired = s.IsExpiryDate == true && s.ExpiryDate.HasValue && s.ExpiryDate.Value < now;
                var uid = s.AccessUserId.ToString().ToLower();
                res.Entries.Add(new AccessEntryDTO
                {
                    Kind = "Internal",
                    EntryId = s.SDAId,
                    UserName = NameOf(names, uid),
                    Email = emailMap.GetValueOrDefault(uid),
                    AccessType = s.AccessType,
                    AccessLabel = Label(s.AccessType),
                    Status = s.IsActive && !expired ? "Active" : "Inactive",
                    Source = project ? "Project" : "Manual",
                    SharedOn = s.CreatedOn,
                    SharedByName = NameOf(names, s.CreatedBy),
                    ExpiresOn = s.IsExpiryDate == true ? s.ExpiryDate : null,
                    CanRemove = c.Manage && !project,
                    CanToggle = c.Manage && !project
                });
            }
            foreach (var e in externals)
            {
                res.Entries.Add(new AccessEntryDTO
                {
                    Kind = "External",
                    EntryId = e.ESAID,
                    UserName = e.EmailAddress,
                    Email = e.EmailAddress,
                    AccessType = e.AccessType,
                    AccessLabel = Label(e.AccessType),
                    Status = e.ExpireOn < now ? "Inactive" : "Active",
                    Source = "External",
                    SharedOn = e.CreatedOn,
                    SharedByName = NameOf(names, e.CreatedBy),
                    ExpiresOn = e.ExpireOn,
                    CanRemove = c.Manage,
                    CanToggle = false
                });
            }
            foreach (var r in hist.Where(h => h.ActionType == "AccessRevoked"))
            {
                var key = KeyOf(r); if (key == null) continue;
                var grant = hist.LastOrDefault(g => g.ActionType == "AccessGranted" && g.ActionOn <= r.ActionOn && KeyOf(g) == key);
                var ext = !r.AccessUserId.HasValue;
                res.Entries.Add(new AccessEntryDTO
                {
                    Kind = ext ? "External" : "Internal",
                    UserName = ext ? ExtEmail(r.Remarks)! : NameOf(names, key),
                    Email = ext ? ExtEmail(r.Remarks) : emailMap.GetValueOrDefault(key),
                    AccessLabel = string.IsNullOrWhiteSpace(r.PermissionLevel) ? "Unknown" : r.PermissionLevel!,
                    Status = "Removed",
                    Source = ext ? "External" : (r.Remarks != null && r.Remarks.StartsWith("Project", StringComparison.OrdinalIgnoreCase) ? "Project" : "Manual"),
                    SharedOn = grant?.ActionOn,
                    SharedByName = grant == null ? null : NameOf(names, grant.ActionBy),
                    RemovedOn = r.ActionOn,
                    RemovedByName = NameOf(names, r.ActionBy)
                });
            }

            res.Entries = res.Entries.OrderByDescending(e => e.RemovedOn ?? e.SharedOn).ToList();
            res.Summary = new AccessSummaryDTO
            {
                Total = res.Entries.Count,
                Active = res.Entries.Count(e => e.Status == "Active"),
                Inactive = res.Entries.Count(e => e.Status == "Inactive"),
                Removed = res.Entries.Count(e => e.Status == "Removed"),
                External = res.Entries.Count(e => e.Kind == "External")
            };
            return res;
        }

        public async Task<bool> RevokeAsync(string? emp, RevokeAccessDTO dto)
        {
            var c = await PrepareAsync(emp, dto.DocType, dto.Id, needManage: true);
            var it = c.It;

            if (string.Equals(dto.Kind, "External", StringComparison.OrdinalIgnoreCase))
            {
                var e = await _db.ExternalShareAccessHistory.FirstOrDefaultAsync(x => x.ESAID == dto.EntryId && x.FolderOrFileId == it.Id && x.DocType == it.Type)
                        ?? throw new KeyNotFoundException("Share not found.");
                _db.ExternalShareAccessHistory.Remove(e);
                await _report.LogOwnershipOrAccessAsync(it.Id, it.Type, "AccessRevoked", null, null, null, Label(e.AccessType), c.A.Uid,
                    $"External share to {e.EmailAddress}", saveChanges: false);
            }
            else
            {
                var s = await _db.ShareDocAccess.FirstOrDefaultAsync(x => x.SDAId == dto.EntryId && x.FolderOrFileId == it.Id && x.DocType == it.Type)
                        ?? throw new KeyNotFoundException("Share not found.");
                if (s.Comment != null && s.Comment.StartsWith("project:", StringComparison.OrdinalIgnoreCase))
                    throw new ArgumentException("This access is granted through a project. Remove the item or member from the project instead.");
                _db.ShareDocAccess.Remove(s);
                await _report.LogOwnershipOrAccessAsync(it.Id, it.Type, "AccessRevoked", null, null, s.AccessUserId, Label(s.AccessType), c.A.Uid,
                    "Removed from Manage Access", saveChanges: false);
            }
            await _db.SaveChangesAsync();
            Log.DataLog(c.A.Uid, $"Access removed on {it.Type} '{it.Name}' (ID {it.Id}), entry {dto.EntryId}", "Remove Access Log");
            return true;
        }

        public async Task<bool> ToggleAsync(string? emp, ToggleAccessDTO dto)
        {
            var c = await PrepareAsync(emp, dto.DocType, dto.Id, needManage: true);
            var it = c.It;
            var s = await _db.ShareDocAccess.FirstOrDefaultAsync(x => x.SDAId == dto.EntryId && x.FolderOrFileId == it.Id && x.DocType == it.Type)
                    ?? throw new KeyNotFoundException("Share not found.");
            if (s.Comment != null && s.Comment.StartsWith("project:", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("This access is managed by a project.");
            s.IsActive = dto.IsActive; s.ModifiedOn = DateTime.Now; s.ModifiedBy = c.A.Uid;
            await _report.LogOwnershipOrAccessAsync(it.Id, it.Type, "AccessUpdated", null, null, s.AccessUserId, Label(s.AccessType), c.A.Uid,
                dto.IsActive ? "Access activated" : "Access deactivated", saveChanges: false);
            await _db.SaveChangesAsync();
            return true;
        }

        // ------------------------------------------------------------------ export
        public async Task<(byte[] Bytes, string FileName)> ExportAsync(string? emp, string? docType, int id)
        {
            var d = await GetDetailsAsync(emp, docType, id);
            var c = await PrepareAsync(emp, docType, id);
            var acc = await BuildAccessAsync(c);

            using var pkg = new ExcelPackage();
            var navy = Color.FromArgb(11, 42, 94); var line = Color.FromArgb(219, 227, 240);

            // ---- sheet 1: details ----
            var ws = pkg.Workbook.Worksheets.Add("Details");
            ws.Cells["A1"].Value = $"{d.DocType} details - {d.Name}";
            ws.Cells["A1:B1"].Merge = true;
            ws.Cells["A1"].Style.Font.Bold = true; ws.Cells["A1"].Style.Font.Size = 14; ws.Cells["A1"].Style.Font.Color.SetColor(navy);
            var rows = new (string, object?)[]
            {
                ("Name", d.Name), ("Type", d.Type), ("Path", d.Path), ("Size", FormatSize(d.SizeBytes)),
                ("Sub folders", d.DocType == "Folder" ? d.SubFolderCount : null), ("Files inside", d.DocType == "Folder" ? d.FileCount : null),
                ("Owner", d.OwnerEmail), ("Created by", d.CreatedByName), ("Created on", d.CreatedOn),
                ("Modified by", d.ModifiedByName), ("Modified on", d.ModifiedOn), ("Version", d.CurrentVersion), ("Tags", d.Tags),
                ("Total shared (all time)", d.Shared.Total), ("Active", d.Shared.Active), ("Inactive", d.Shared.Inactive), ("Removed", d.Shared.Removed),
                ("Exported on", DateTime.Now)
            };
            var r = 3;
            foreach (var (k, v) in rows)
            {
                ws.Cells[r, 1].Value = k; ws.Cells[r, 1].Style.Font.Bold = true; ws.Cells[r, 1].Style.Fill.PatternType = ExcelFillStyle.Solid;
                ws.Cells[r, 1].Style.Fill.BackgroundColor.SetColor(Color.FromArgb(244, 247, 252));
                ws.Cells[r, 2].Value = v ?? "-";
                if (v is DateTime) ws.Cells[r, 2].Style.Numberformat.Format = "dd-mmm-yyyy hh:mm AM/PM";
                ws.Cells[r, 2].Style.HorizontalAlignment = ExcelHorizontalAlignment.Left;
                r++;
            }
            ws.Cells[3, 1, r - 1, 2].Style.Border.Bottom.Style = ExcelBorderStyle.Thin;
            ws.Cells[3, 1, r - 1, 2].Style.Border.Bottom.Color.SetColor(line);
            ws.Column(1).Width = 26; ws.Column(2).Width = 70; ws.Cells[3, 2, r - 1, 2].Style.WrapText = true;

            // ---- sheet 2: access history ----
            var wa = pkg.Workbook.Worksheets.Add("Access History");
            wa.Cells["A1"].Value = $"Access history - {d.Name}";
            wa.Cells["A1"].Style.Font.Bold = true; wa.Cells["A1"].Style.Font.Size = 14; wa.Cells["A1"].Style.Font.Color.SetColor(navy);
            wa.Cells["A2"].Value = $"Total {acc.Summary.Total}  |  Active {acc.Summary.Active}  |  Inactive {acc.Summary.Inactive}  |  Removed {acc.Summary.Removed}";
            wa.Cells["A2"].Style.Font.Color.SetColor(Color.FromArgb(100, 116, 139));

            var heads = new[] { "#", "User", "Email", "Type", "Access", "Status", "Source", "Shared on", "Shared by", "Expires on", "Removed on", "Removed by" };
            const int hr = 4;
            for (var i = 0; i < heads.Length; i++) wa.Cells[hr, i + 1].Value = heads[i];
            var hrng = wa.Cells[hr, 1, hr, heads.Length];
            hrng.Style.Font.Bold = true; hrng.Style.Font.Color.SetColor(Color.White);
            hrng.Style.Fill.PatternType = ExcelFillStyle.Solid; hrng.Style.Fill.BackgroundColor.SetColor(navy);
            hrng.Style.VerticalAlignment = ExcelVerticalAlignment.Center; wa.Row(hr).Height = 22;

            var n = 0; var row = hr + 1;
            foreach (var e in acc.Entries)
            {
                n++;
                wa.Cells[row, 1].Value = n; wa.Cells[row, 2].Value = e.UserName; wa.Cells[row, 3].Value = e.Email ?? "-";
                wa.Cells[row, 4].Value = e.Kind; wa.Cells[row, 5].Value = e.AccessLabel; wa.Cells[row, 6].Value = e.Status; wa.Cells[row, 7].Value = e.Source;
                SetDate(wa.Cells[row, 8], e.SharedOn); wa.Cells[row, 9].Value = e.SharedByName ?? "-";
                SetDate(wa.Cells[row, 10], e.ExpiresOn); SetDate(wa.Cells[row, 11], e.RemovedOn); wa.Cells[row, 12].Value = e.RemovedByName ?? "-";

                var st = wa.Cells[row, 6]; st.Style.Font.Bold = true; st.Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
                st.Style.Fill.PatternType = ExcelFillStyle.Solid;
                (Color bg, Color fg) = e.Status switch
                {
                    "Active" => (Color.FromArgb(220, 252, 231), Color.FromArgb(22, 101, 52)),
                    "Inactive" => (Color.FromArgb(254, 243, 199), Color.FromArgb(146, 64, 14)),
                    _ => (Color.FromArgb(254, 226, 226), Color.FromArgb(153, 27, 27))
                };
                st.Style.Fill.BackgroundColor.SetColor(bg); st.Style.Font.Color.SetColor(fg);
                if (n % 2 == 0)
                    foreach (var col in new[] { 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12 })
                    { wa.Cells[row, col].Style.Fill.PatternType = ExcelFillStyle.Solid; wa.Cells[row, col].Style.Fill.BackgroundColor.SetColor(Color.FromArgb(248, 250, 252)); }
                row++;
            }
            if (n == 0) { wa.Cells[row, 1].Value = "This item has never been shared."; wa.Cells[row, 1, row, heads.Length].Merge = true; }
            else
            {
                var body = wa.Cells[hr, 1, row - 1, heads.Length];
                body.Style.Border.Bottom.Style = ExcelBorderStyle.Thin; body.Style.Border.Bottom.Color.SetColor(line);
                wa.Cells[hr, 1, row - 1, heads.Length].AutoFilter = true;
            }
            wa.View.FreezePanes(hr + 1, 3);
            wa.Cells[hr, 1, Math.Max(row - 1, hr + 1), heads.Length].AutoFitColumns(10, 42);
            wa.Column(1).Width = 6;
            wa.PrinterSettings.Orientation = eOrientation.Landscape; wa.PrinterSettings.FitToPage = true; wa.PrinterSettings.FitToWidth = 1; wa.PrinterSettings.FitToHeight = 0;

            var safe = string.Concat(d.Name.Where(ch => !Path.GetInvalidFileNameChars().Contains(ch)));
            return (pkg.GetAsByteArray(), $"{safe}_Access_Report_{DateTime.Now:yyyyMMdd_HHmm}.xlsx");
        }

        private static void SetDate(ExcelRange cell, DateTime? d)
        {
            if (d.HasValue) { cell.Value = d.Value; cell.Style.Numberformat.Format = "dd-mmm-yyyy hh:mm AM/PM"; }
            else cell.Value = "-";
            cell.Style.HorizontalAlignment = ExcelHorizontalAlignment.Left;
        }

        private static string FormatSize(long b) =>
            b >= 1073741824 ? $"{b / 1073741824.0:0.##} GB" : b >= 1048576 ? $"{b / 1048576.0:0.##} MB" : b >= 1024 ? $"{b / 1024.0:0.##} KB" : $"{b} Bytes";
    }
}