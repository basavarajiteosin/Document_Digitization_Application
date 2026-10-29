using DDAAPI.DbContexts;
using DDAAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DDAAPI.Services
{
    /// <summary>
    /// NEW (this change).
    /// Handles the three client-requested features:
    ///   1) Employee-wise folder access report (dedup'd - repeated View/Download/Edit/
    ///      Update/Share of the same item by the same user increments a counter
    ///      instead of inserting a new row every time)
    ///   2) Folder versioning (bumped on create, rename, move, update, subfolder
    ///      added, file added, file updated)
    ///   3) Ownership + access history log (created, transferred, modified, shared)
    ///
    /// All write methods swallow their own exceptions (logged failures never break the
    /// primary folder/file operation the user actually asked for).
    /// </summary>
    public interface IReportService
    {
        // ---- Reads (used by ReportsController) ----
        Task<IActionResult> GetEmployeeWiseFolderAccessReportAsync(string? userId = null);
        Task<IActionResult> GetFolderVersionHistoryAsync(int folderId);
        Task<IActionResult> GetOwnershipAccessHistoryAsync(int? folderOrFileId, string? docType);

        // ---- Writes (called from FolderService at existing action points) ----

        /// <summary>
        /// Records a View/Download/Edit/Update/Share of a folder or file.
        /// De-duplicated: if the same user already has a log row for the same
        /// item + action type, this increments AccessCount and bumps AccessedOn
        /// (last-seen) instead of inserting a new row - so 100 views of the same
        /// folder by the same person produce ONE row with AccessCount = 100, not
        /// 100 rows.
        /// </summary>
        Task LogFolderAccessAsync(int folderOrFileId, string docType, string? name, string? userId, string accessType);

        Task AddFolderVersionAsync(FolderData folder, string changeType, string? modifiedBy, string? remarks = null,
            string? affectedItemName = null, bool saveChanges = true);

        Task LogOwnershipOrAccessAsync(int folderOrFileId, string docType, string actionType, string? previousOwner,
            string? newOwner, Guid? accessUserId, string? permissionLevel, string? actionBy, string? remarks = null, bool saveChanges = true);
    }

    public class ReportService : IReportService
    {
        private readonly AppDbContext _dbContext;

        public ReportService(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        #region Write hooks

        public async Task LogFolderAccessAsync(int folderOrFileId, string docType, string? name, string? userId, string accessType)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                {
                    return;
                }

                // NEW: de-dup key is (user, item, docType, action). If a row already
                // exists for this exact combination, bump its counter/timestamp instead
                // of inserting a new one - keeps the table production-sized even for
                // users who open the same folder hundreds of times.
                var existing = await _dbContext.FolderAccessLog
                    .Where(x => x.AccessedByUserId == userId
                             && x.FolderOrFileId == folderOrFileId
                             && x.DocType == docType
                             && x.AccessType == accessType)
                    .FirstOrDefaultAsync();

                if (existing != null)
                {
                    existing.AccessCount += 1;
                    existing.AccessedOn = DateTime.Now;
                    if (!string.IsNullOrWhiteSpace(name))
                    {
                        existing.FolderOrFileName = name; // keep name current (e.g. after a rename)
                    }
                    _dbContext.FolderAccessLog.Update(existing);
                    await _dbContext.SaveChangesAsync();
                    return;
                }

                string? userName = null;
                if (Guid.TryParse(userId, out var empGuid))
                {
                    var emp = await _dbContext.EmpInfos.AsNoTracking()
                        .Where(e => e.EmpId == empGuid)
                        .Select(e => new { e.FirstName, e.LastName })
                        .FirstOrDefaultAsync();

                    if (emp != null)
                    {
                        userName = $"{emp.FirstName} {emp.LastName}".Trim();
                    }
                }

                var now = DateTime.Now;
                _dbContext.FolderAccessLog.Add(new FolderAccessLog
                {
                    FolderOrFileId = folderOrFileId,
                    DocType = docType,
                    FolderOrFileName = name,
                    AccessedByUserId = userId,
                    AccessedByUserName = userName,
                    AccessType = accessType,
                    AccessCount = 1,
                    FirstAccessedOn = now,
                    AccessedOn = now
                });

                await _dbContext.SaveChangesAsync();
            }
            catch
            {
                // Access logging must never break the read/write the user is performing.
            }
        }

        public async Task AddFolderVersionAsync(FolderData folder, string changeType, string? modifiedBy, string? remarks = null,
            string? affectedItemName = null, bool saveChanges = true)
        {
            try
            {
                if (folder == null)
                {
                    return;
                }

                if (folder.CurrentVersion <= 0)
                {
                    folder.CurrentVersion = 1;
                }
                else if (!string.Equals(changeType, "Created", StringComparison.OrdinalIgnoreCase))
                {
                    folder.CurrentVersion += 1;
                }

                _dbContext.FolderVersion.Add(new FolderVersion
                {
                    FolderId = folder.FolderId,
                    VersionNumber = folder.CurrentVersion,
                    FolderName = folder.FolderName,
                    FolderPath = folder.FolderPath,
                    ServerFolderPath = folder.ServerFolderPath,
                    ParentFolderId = folder.ParentFolderId,
                    ChangeType = changeType,
                    AffectedItemName = affectedItemName,
                    ModifiedBy = modifiedBy,
                    ModifiedOn = DateTime.Now,
                    Remarks = remarks
                });

                if (saveChanges)
                {
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch
            {
                // Versioning must never block the folder/file create/update/move operation.
            }
        }

        public async Task LogOwnershipOrAccessAsync(int folderOrFileId, string docType, string actionType, string? previousOwner,
            string? newOwner, Guid? accessUserId, string? permissionLevel, string? actionBy, string? remarks = null, bool saveChanges = true)
        {
            try
            {
                _dbContext.OwnershipAccessHistory.Add(new OwnershipAccessHistory
                {
                    FolderOrFileId = folderOrFileId,
                    DocType = docType,
                    ActionType = actionType,
                    PreviousOwner = previousOwner,
                    NewOwner = newOwner,
                    AccessUserId = accessUserId,
                    PermissionLevel = permissionLevel,
                    ActionBy = actionBy,
                    ActionOn = DateTime.Now,
                    Remarks = remarks
                });

                if (saveChanges)
                {
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch
            {
                // History logging must never block the share/unshare/ownership operation.
            }
        }

        #endregion

        #region Reports

        public async Task<IActionResult> GetEmployeeWiseFolderAccessReportAsync(string? userId = null)
        {
            try
            {
                var query = _dbContext.FolderAccessLog.AsNoTracking().AsQueryable();

                if (!string.IsNullOrWhiteSpace(userId))
                {
                    query = query.Where(x => x.AccessedByUserId == userId);
                }

                var logs = await query.OrderByDescending(x => x.AccessedOn).ToListAsync();

                var report = logs
                    .GroupBy(x => new { x.AccessedByUserId, x.AccessedByUserName })
                    .Select(g => new EmployeeFolderAccessReportDTO
                    {
                        UserId = g.Key.AccessedByUserId,
                        UserName = g.Key.AccessedByUserName,
                        TotalAccessCount = g.Sum(x => x.AccessCount),
                        ViewCount = g.Where(x => x.AccessType == "View").Sum(x => x.AccessCount),
                        DownloadCount = g.Where(x => x.AccessType == "Download").Sum(x => x.AccessCount),
                        EditCount = g.Where(x => x.AccessType == "Edit").Sum(x => x.AccessCount),
                        UpdateCount = g.Where(x => x.AccessType == "Update").Sum(x => x.AccessCount),
                        ShareCount = g.Where(x => x.AccessType == "Share").Sum(x => x.AccessCount),
                        LastAccessedOn = g.Max(x => x.AccessedOn),
                        AccessDetails = g.Select(x => new FolderAccessDetailDTO
                        {
                            FolderOrFileId = x.FolderOrFileId,
                            DocType = x.DocType,
                            FolderOrFileName = x.FolderOrFileName,
                            AccessType = x.AccessType,
                            AccessCount = x.AccessCount,
                            FirstAccessedOn = x.FirstAccessedOn,
                            LastAccessedOn = x.AccessedOn
                        })
                        .OrderByDescending(x => x.LastAccessedOn)
                        .ToList()
                    })
                    .OrderByDescending(x => x.LastAccessedOn)
                    .ToList();

                return new OkObjectResult(new { success = true, message = "Data fetched successfully", data = report });
            }
            catch (Exception ex)
            {
                return new BadRequestObjectResult(new { success = false, message = ex.Message });
            }
        }

        public async Task<IActionResult> GetFolderVersionHistoryAsync(int folderId)
        {
            try
            {
                var versions = await _dbContext.FolderVersion.AsNoTracking()
                    .Where(v => v.FolderId == folderId)
                    .OrderByDescending(v => v.VersionNumber)
                    .Select(v => new FolderVersionDTO
                    {
                        VersionId = v.VersionId,
                        FolderId = v.FolderId,
                        VersionNumber = v.VersionNumber,
                        FolderName = v.FolderName,
                        FolderPath = v.FolderPath,
                        ServerFolderPath = v.ServerFolderPath,
                        ParentFolderId = v.ParentFolderId,
                        ChangeType = v.ChangeType,
                        AffectedItemName = v.AffectedItemName,
                        ModifiedBy = v.ModifiedBy,
                        ModifiedOn = v.ModifiedOn,
                        Remarks = v.Remarks
                    })
                    .ToListAsync();

                if (!versions.Any())
                {
                    return new NotFoundObjectResult(new { success = false, message = "No version history found for this folder." });
                }

                return new OkObjectResult(new { success = true, message = "Data fetched successfully", data = versions });
            }
            catch (Exception ex)
            {
                return new BadRequestObjectResult(new { success = false, message = ex.Message });
            }
        }

        public async Task<IActionResult> GetOwnershipAccessHistoryAsync(int? folderOrFileId, string? docType)
        {
            try
            {
                var query = _dbContext.OwnershipAccessHistory.AsNoTracking().AsQueryable();

                if (folderOrFileId.HasValue && folderOrFileId.Value > 0)
                {
                    query = query.Where(x => x.FolderOrFileId == folderOrFileId.Value);
                }

                if (!string.IsNullOrWhiteSpace(docType))
                {
                    query = query.Where(x => x.DocType.ToLower() == docType.ToLower());
                }

                var history = await query.OrderByDescending(x => x.ActionOn).ToListAsync();

                // Enrich with the current folder/file name for readability without an N+1 lookup.
                var folderIds = history.Where(h => h.DocType == "Folder").Select(h => h.FolderOrFileId).Distinct().ToList();
                var fileIds = history.Where(h => h.DocType == "Document").Select(h => h.FolderOrFileId).Distinct().ToList();

                var folderNames = await _dbContext.FolderData.AsNoTracking()
                    .Where(f => folderIds.Contains(f.FolderId))
                    .ToDictionaryAsync(f => f.FolderId, f => f.FolderName);

                var fileNames = await _dbContext.FileData.AsNoTracking()
                    .Where(f => fileIds.Contains(f.FileId))
                    .ToDictionaryAsync(f => f.FileId, f => f.FileName);

                var result = history.Select(h => new OwnershipAccessHistoryDTO
                {
                    HistoryId = h.HistoryId,
                    FolderOrFileId = h.FolderOrFileId,
                    DocType = h.DocType,
                    FolderOrFileName = h.DocType == "Folder"
                        ? folderNames.GetValueOrDefault(h.FolderOrFileId)
                        : fileNames.GetValueOrDefault(h.FolderOrFileId),
                    ActionType = h.ActionType,
                    PreviousOwner = h.PreviousOwner,
                    NewOwner = h.NewOwner,
                    AccessUserId = h.AccessUserId,
                    PermissionLevel = h.PermissionLevel,
                    ActionBy = h.ActionBy,
                    ActionOn = h.ActionOn,
                    Remarks = h.Remarks
                }).ToList();

                return new OkObjectResult(new { success = true, message = "Data fetched successfully", data = result });
            }
            catch (Exception ex)
            {
                return new BadRequestObjectResult(new { success = false, message = ex.Message });
            }
        }

        #endregion
    }
}