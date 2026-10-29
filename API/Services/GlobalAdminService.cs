using DDAAPI.DbContexts;
using DDAAPI.Models;
using DDAAPI.Services;
using DDAAPI.Models;
using DDAAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DDAAPI.Services
{
    public interface IGlobalAdminService
    {
        Task<IActionResult> GetAllUsersDataLimitAsync();
        Task<IActionResult> GetUserDataLimitByUserIdAsync(string userId);
        Task<IActionResult> SetOrUpdateUserLimitAsync(UserStoragedto data);
        Task<IActionResult> UpdateUsedDataStorageAsync();
        Task<IActionResult> GetAllFoldersAndFilesDataAsync();
        IActionResult GetAllDescendantFolderIds(List<FolderData> allFolders, int parentFolderId);
        Task<IActionResult> GetFolderSizeByIdAsync(int folderId);
        Task<List<ShareDocAccess>> GetSharedListByIdAsync(int id, string? docType = null);
        Task<bool> ToggleShareAccessStatusAsync(ToggleShareAccessStatusDto dto);
        Task<bool> DeleteShareAccessRecordAsync(int sdaId);
        Task<bool> UpdateFolderHideStatusAsync(UpdateFolderHideStatusDto dto);
    }
    public class GlobalAdminService : IGlobalAdminService
    {
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _dbContext;
        private readonly EmailService _emailService;
        private readonly SMSService _smsService;
        private readonly int _tokenTimespan;

        public GlobalAdminService(IConfiguration configuration, AppDbContext dbContext, EmailService emailService, SMSService smsService)
        {
            _configuration = configuration;
            _dbContext = dbContext;
            _emailService = emailService ?? throw new ArgumentNullException(nameof(emailService));
            _smsService = smsService ?? throw new ArgumentNullException(nameof(smsService));
        }

        public async Task<IActionResult> GetAllUsersDataLimitAsync()
        {
            try
            {
                var data = await _dbContext.UserStorage.AsNoTracking().ToListAsync();
                await InternalUpdateUsedDataStorageAsync();
                return new OkObjectResult(new { success = true, message = "Data fetched successfully", data = data });
            }
            catch (Exception ex)
            {
                return new BadRequestObjectResult(new { success = false, message = ex.Message });
            }
        }

        public async Task<IActionResult> GetUserDataLimitByUserIdAsync(string UserId)
        {
            try
            {
                var data = await _dbContext.UserStorage.Where(x => x.UserId.ToLower() == UserId.ToLower()).FirstOrDefaultAsync();
                long useddata = 0;
                var usedstorage = await _dbContext.FileData.Where(x => x.CreatedBy.ToLower() == UserId.ToLower()).SumAsync(x => x.Size);
                if (usedstorage != null)
                {
                    useddata = usedstorage;
                    data.UsedStorage = useddata;
                }
                await _dbContext.SaveChangesAsync();
                await InternalUpdateUsedDataStorageAsync();
                return new OkObjectResult(new { success = true, message = "Data fetched successfully", data = data, UsedStorage = useddata });
            }
            catch (Exception ex)
            {
                return new BadRequestObjectResult(new { success = false, message = $"failed to fetched : {ex.Message}" });
            }
        }

        public async Task<IActionResult> SetOrUpdateUserLimitAsync(UserStoragedto data)
        {
            var transaction = await _dbContext.Database.BeginTransactionAsync();
            try
            {
                var existuser = await _dbContext.UserStorage.Where(x => x.UserId.ToLower() == data.UserId.ToLower()).FirstOrDefaultAsync();

                if (existuser != null)
                {
                    existuser.MaximumAllocatedStorage = data.MaximumAllocatedStorage;
                    existuser.ModifiedBy = data.LoggedUserId;
                    existuser.ModifiedOn = DateTime.Now;
                }
                else
                {
                    long useddata = 0;
                    var usedstorage = await _dbContext.FileData.Where(x => x.CreatedBy.ToLower() == data.UserId.ToLower()).SumAsync(x => x.Size);
                    if (usedstorage != null)
                    {
                        useddata = usedstorage;
                    }
                    var newdata = new UserStorage
                    {
                        UserId = data.UserId,
                        MaximumAllocatedStorage = data.MaximumAllocatedStorage,
                        LimitReachedStatus = false,
                        UsedStorage = useddata,
                        CreatedOn = DateTime.Now,
                        CreatedBy = data.LoggedUserId,
                    };
                    if (useddata >= data.MaximumAllocatedStorage)
                    {
                        newdata.LimitReachedStatus = true;
                        if (existuser != null)
                        {
                            existuser.LimitReachedStatus = true;
                        }
                        await _dbContext.SaveChangesAsync();
                        return new OkObjectResult(new { success = false, message = "The user has already utilized the maximum allocated storage.", data = existuser });
                    }
                    await _dbContext.AddRangeAsync(newdata);
                }
                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();

                await InternalUpdateUsedDataStorageAsync();

                return new OkObjectResult(new { success = true, message = "Storage limit allocated successfully", data = existuser });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return new OkObjectResult(new { success = false, message = ex.Message });
            }
        }

        public async Task<IActionResult> UpdateUsedDataStorageAsync()
        {
            return await InternalUpdateUsedDataStorageAsync();
        }

        private async Task<IActionResult> InternalUpdateUsedDataStorageAsync()
        {
            var transaction = await _dbContext.Database.BeginTransactionAsync();
            try
            {
                var datastorage = await _dbContext.UserStorage.ToListAsync();

                // Aggregate file sizes per user in a single grouped query instead of loading every
                // FileData row and re-scanning it for every UserStorage record (O(n*m) -> O(n)).
                var usageByUser = await _dbContext.FileData
                    .AsNoTracking()
                    .Where(x => x.CreatedBy != null)
                    .GroupBy(x => x.CreatedBy)
                    .Select(g => new { UserId = g.Key, TotalSize = g.Sum(x => x.Size) })
                    .ToDictionaryAsync(g => g.UserId, g => g.TotalSize);

                foreach (var data in datastorage)
                {
                    var storage = usageByUser.GetValueOrDefault(data.UserId, 0L);

                    data.UsedStorage = storage;
                    data.ModifiedOn = DateTime.Now;

                    if (data.MaximumAllocatedStorage <= storage)
                    {
                        data.LimitReachedStatus = true;
                    }
                }

                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();

                return new OkObjectResult(new { success = true, message = "Storage limit updated successfully", data = datastorage });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return new OkObjectResult(new { success = false, message = ex.Message });
            }
        }

        public async Task<IActionResult> GetAllFoldersAndFilesDataAsync()
        {
            try
            {
                var allFolders = await _dbContext.FolderData.AsNoTracking().ToListAsync();
                var allFiles = await _dbContext.FileData.AsNoTracking().ToListAsync();

                var rootFolders = allFolders
                    .Where(f => f.ParentFolderId == null || f.ParentFolderId == 0)
                    .Select(f => BuildFolderHierarchy(f, allFolders, allFiles))
                    .ToList();

                return new OkObjectResult(new { success = true, message = "Data fetched successfully", data = rootFolders });
            }
            catch (Exception ex)
            {
                return new BadRequestObjectResult(new { success = false, message = ex.Message });
            }
        }

        private object BuildFolderHierarchy(FolderData folder, List<FolderData> allFolders, List<FileData> allFiles)
        {
            var subFolders = allFolders
                .Where(f => f.ParentFolderId == folder.FolderId)
                .Select(f => BuildFolderHierarchy(f, allFolders, allFiles))
                .ToList();

            var folderFiles = allFiles
                .Where(f => f.FolderId == folder.FolderId)
                .ToList();

            long currentFolderSize = folderFiles.Sum(f => f.Size);

            long subFoldersTotalSize = subFolders.Sum(sf => (long)((dynamic)sf).TotalSize);
            long totalFolderSize = currentFolderSize + subFoldersTotalSize;

            return new
            {
                folder.FolderId,
                folder.FolderName,
                folder.FolderPath,
                folder.ServerFolderPath,
                folder.FolderColor,
                folder.ParentFolderId,
                folder.Owner,
                folder.Size,
                folder.FileCount,
                folder.AccessCount,
                folder.Tags,
                folder.IsActive,
                folder.CreatedOn,
                folder.CreatedBy,
                folder.ModifiedOn,
                folder.ModifiedBy,
                TotalSize = totalFolderSize,
                SubFolders = subFolders,
                MainFolderFiles = folderFiles.Select(file => new
                {
                    file.FileId,
                    file.FolderId,
                    file.FileName,
                    file.FilePath,
                    file.ServerFilePath,
                    file.Owner,
                    file.Size,
                    file.AccessCount,
                    file.IsActive,
                    file.CreatedOn,
                    file.CreatedBy,
                    file.ModifiedOn,
                    file.ModifiedBy
                }).ToList()
            };
        }

        public IActionResult GetAllDescendantFolderIds(List<FolderData> allFolders, int parentFolderId)
        {
            var descendantIds = new List<int>();
            var directChildren = allFolders.Where(f => f.ParentFolderId == parentFolderId).ToList();

            foreach (var child in directChildren)
            {
                descendantIds.Add(child.FolderId);
                var innerResult = (OkObjectResult)GetAllDescendantFolderIds(allFolders, child.FolderId);
                var innerData = (IEnumerable<int>)((dynamic)innerResult.Value).data;
                descendantIds.AddRange(innerData);
            }

            return new OkObjectResult(new { success = true, message = "Data fetched successfully", data = descendantIds });
        }

        public async Task<IActionResult> GetFolderSizeByIdAsync(int folderId)
        {
            try
            {
                var allFolders = await _dbContext.FolderData.AsNoTracking().ToListAsync();
                var allFiles = await _dbContext.FileData.AsNoTracking().ToListAsync();

                var targetFolder = allFolders.FirstOrDefault(f => f.FolderId == folderId);

                if (targetFolder == null)
                {
                    return new NotFoundObjectResult(new { success = false, message = "Folder not found" });
                }

                long totalSize = CalculateFolderSize(targetFolder, allFolders, allFiles);

                return new OkObjectResult(new { success = true, folderId = folderId, totalSizeInBytes = totalSize });
            }
            catch (Exception ex)
            {
                return new BadRequestObjectResult(new { success = false, message = ex.Message });
            }
        }

        public async Task<List<ShareDocAccess>> GetSharedListByIdAsync(int id, string? docType = null)
        {
            var query = _dbContext.ShareDocAccess
                .Where(x => x.FolderOrFileId == id);

            if (!string.IsNullOrWhiteSpace(docType))
            {
                query = query.Where(x => x.DocType.ToLower() == docType.ToLower());
            }

            return await query.AsNoTracking().ToListAsync();
        }

        // Toggle IsActive status
        public async Task<bool> ToggleShareAccessStatusAsync(ToggleShareAccessStatusDto dto)
        {
            var record = await _dbContext.ShareDocAccess.FirstOrDefaultAsync(s => s.SDAId == dto.SDAId);

            if (record == null)
            {
                return false;
            }

            record.IsActive = dto.IsActive;
            record.ModifiedOn = DateTime.Now;
            record.ModifiedBy = dto.ModifiedByUserId;

            _dbContext.ShareDocAccess.Update(record);
            return await _dbContext.SaveChangesAsync() > 0;
        }

        // Hard Delete record from database
        public async Task<bool> DeleteShareAccessRecordAsync(int sdaId)
        {
            var record = await _dbContext.ShareDocAccess.FirstOrDefaultAsync(s => s.SDAId == sdaId);

            if (record == null)
            {
                return false;
            }

            _dbContext.ShareDocAccess.Remove(record);
            return await _dbContext.SaveChangesAsync() > 0;
        }


        public async Task<bool> UpdateFolderHideStatusAsync(UpdateFolderHideStatusDto dto)
        {
            using var transaction = await _dbContext.Database.BeginTransactionAsync();

            try
            {
                bool isFolder = string.Equals(dto.DocType, "Folder", StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(dto.DocType, "Directory", StringComparison.OrdinalIgnoreCase);

                if (isFolder)
                {
                    // 1. Update target FolderData
                    var folder = await _dbContext.FolderData
                        .FirstOrDefaultAsync(f => f.FolderId == dto.FolderIdorFileId && f.IsActive);

                    if (folder == null)
                    {
                        return false;
                    }

                    folder.IsHide = dto.IsHide;
                    folder.HideBy = dto.HideByUserId;
                    folder.ModifiedOn = DateTime.Now;
                    folder.ModifiedBy = dto.HideByUserId;

                    _dbContext.FolderData.Update(folder);

                    // 2. Cascade update all FileData records inside this folder
                    var childFiles = await _dbContext.FileData
                        .Where(f => f.FolderId == dto.FolderIdorFileId && f.IsActive)
                        .ToListAsync();

                    if (childFiles.Any())
                    {
                        foreach (var file in childFiles)
                        {
                            file.IsHide = dto.IsHide;
                            file.HideBy = dto.HideByUserId;
                            file.ModifiedOn = DateTime.Now;
                            file.ModifiedBy = dto.HideByUserId;
                        }
                        _dbContext.FileData.UpdateRange(childFiles);
                    }

                    // Get IDs of all child files for updating ShareDocAccess
                    var childFileIds = childFiles.Select(f => f.FileId).ToList();

                    // 3. Update ShareDocAccess records for the Folder AND its child files
                    var sharedRecords = await _dbContext.ShareDocAccess
                        .Where(s => (s.FolderOrFileId == dto.FolderIdorFileId && s.DocType.ToLower() == "folder") ||
                                    (childFileIds.Contains(s.FolderOrFileId) && (s.DocType.ToLower() == "document" || s.DocType.ToLower() == "file")))
                        .ToListAsync();

                    if (sharedRecords.Any())
                    {
                        foreach (var record in sharedRecords)
                        {
                            record.IsHide = dto.IsHide;
                            record.HideBy = dto.HideByUserId;
                            record.ModifiedOn = DateTime.Now;
                            record.ModifiedBy = dto.HideByUserId;
                        }
                        _dbContext.ShareDocAccess.UpdateRange(sharedRecords);
                    }
                }
                else
                {
                    // 1. Update target FileData (Document)
                    var file = await _dbContext.FileData
                        .FirstOrDefaultAsync(f => f.FileId == dto.FolderIdorFileId && f.IsActive);

                    if (file == null)
                    {
                        return false;
                    }

                    file.IsHide = dto.IsHide;
                    file.HideBy = dto.HideByUserId;
                    file.ModifiedOn = DateTime.Now;
                    file.ModifiedBy = dto.HideByUserId;

                    _dbContext.FileData.Update(file);

                    // 2. Update ShareDocAccess records for this specific file (Fixed missing closing parenthesis)
                    var sharedFileRecords = await _dbContext.ShareDocAccess
                        .Where(s => s.FolderOrFileId == dto.FolderIdorFileId &&
                                    (s.DocType.ToLower() == "document" || s.DocType.ToLower() == "file"))
                        .ToListAsync();

                    if (sharedFileRecords.Any())
                    {
                        foreach (var record in sharedFileRecords)
                        {
                            record.IsHide = dto.IsHide;
                            record.HideBy = dto.HideByUserId;
                            record.ModifiedOn = DateTime.Now;
                            record.ModifiedBy = dto.HideByUserId;
                        }
                        _dbContext.ShareDocAccess.UpdateRange(sharedFileRecords);
                    }
                }

                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();

                return true;
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        private long CalculateFolderSize(FolderData folder, List<FolderData> allFolders, List<FileData> allFiles)
        {
            long currentFolderSize = allFiles
                .Where(f => f.FolderId == folder.FolderId)
                .Sum(f => f.Size);

            var subFolders = allFolders
                .Where(f => f.ParentFolderId == folder.FolderId)
                .ToList();

            long subFoldersSize = subFolders.Sum(sub => CalculateFolderSize(sub, allFolders, allFiles));

            return currentFolderSize + subFoldersSize;
        }
    }
}