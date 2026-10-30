using DDAAPI.DbContexts;
//using DDAAPI.Helpers;
using DDAAPI.Models;
using DDAAPI.Services;
using DDAAPI.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.Json;
using Microsoft.IdentityModel.Tokens;
using Microsoft.VisualBasic;
using Newtonsoft.Json.Linq;
using OfficeOpenXml.FormulaParsing.LexicalAnalysis;
using Org.BouncyCastle.Asn1.X509;
using PdfSharpCore.Pdf.Content.Objects;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;
using System.IO.Compression;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Web;

namespace DDAAPI.Services
{
    public class FolderService
    {
        private readonly AppDbContext _dbContext;
        private readonly IConfiguration _configuration;
        private readonly EmailService _emailService;
        // NEW (this change): drives the employee access report, folder versioning,
        // and ownership/access history log. See ReportService.cs.
        private readonly IReportService _reportService;

        public FolderService(AppDbContext context, IConfiguration configuration, EmailService emailService, IReportService reportService)
        {
            _dbContext = context;
            _configuration = configuration;
            _emailService = emailService ?? throw new ArgumentNullException(nameof(emailService));
            _reportService = reportService ?? throw new ArgumentNullException(nameof(reportService));
        }


        #region FolderServices

        public async Task<IEnumerable<FolderData>> GetAllFolders()
        {
            try
            {
                var folder = await _dbContext.FolderData.AsNoTracking()
                    .Where(f => f.ParentFolderId == 0)
                    .ToListAsync();

                if (folder == null)
                {
                    throw new Exception($"Folder's was Not Exist!.");
                }

                return folder;
            }
            catch (Exception ex)
            {
                // Handle or log the exception as needed
                //ErrorLog.AddErrorLog("", ex.Message);
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<IEnumerable<object>> GetAllFoldersByCreatedBy(Guid createdById)
        {
            try
            {
                //var folders = await _dbContext.FolderData.AsNoTracking()
                //    .Where(f => f.CreatedBy == createdById.ToString() && (f.ParentFolderId == 0))
                //    .ToListAsync(); // Ensure this method is available
                var checkRole = await (from map in _dbContext.UserRoleMaps.AsNoTracking()
                                       join role in _dbContext.Roles.AsNoTracking()
                                       on map.RoleID equals role.RoleID
                                       where map.UserID == createdById
                                       select new
                                       {
                                           role.RoleName
                                       }).FirstOrDefaultAsync();

                var allfolders = await _dbContext.FolderData.AsNoTracking().ToListAsync();
                var Allfiles = await _dbContext.FileData.AsNoTracking().ToListAsync();
                var filteredfolders = allfolders.Where(x => x.ParentFolderId == 0).ToList();
                if (checkRole == null)
                {
                    var list = new List<object>();
                    var message = "There is no role assigned to the user";
                    list.Add(message);
                    return list;
                }
                if (checkRole.RoleName == "User")
                {



                    var folders = filteredfolders
                                    .Where(fd => fd.CreatedBy == createdById.ToString())
                                    .Select(fd =>
                                    {
                                        var subFolderIds = allfolders
                                            .Where(x => x.ParentFolderId == fd.FolderId)
                                            .Select(x => x.FolderId)
                                            .ToList();

                                        var parentFilesCount = Allfiles.Count(x => x.FolderId == fd.FolderId);
                                        var subFolderFilesSize = Allfiles
                                            .Where(x => subFolderIds.Contains(x.FolderId))
                                            .Sum(x => x.Size);

                                        var parentFolderFilesSize = Allfiles
                                            .Where(x => x.FolderId == fd.FolderId)
                                            .Sum(x => x.Size);

                                        return new

                                        {
                                            fd.AuthorizedUserId,
                                            fd.IsView,
                                            fd.FolderId,
                                            fd.FolderName,
                                            fd.FolderPath,
                                            fd.FolderColor,
                                            fd.ParentFolderId,
                                            fd.Owner,
                                            fd.Size,
                                            fd.FileCount,
                                            fd.AccessCount,
                                            fd.Tags,
                                            fd.IsActive,
                                            fd.IsHide,
                                            fd.HideBy,
                                            fd.CreatedBy,
                                            fd.CreatedOn,
                                            fd.ModifiedBy,
                                            fd.ModifiedOn,
                                            SubFoldersIds = subFolderIds,
                                            SubFolderCount = subFolderIds.Count,
                                            ParentFilesCount = parentFilesCount,
                                            ParentFolderSize = parentFolderFilesSize + subFolderFilesSize
                                        };
                                    })
                                        .ToList();

                    //  .Where(f => f.CreatedBy == createdById.ToString() && (f.ParentFolderId == 0))
                    // Ensure this method is available


                    return folders;
                }
                else
                {
                    var folders = filteredfolders
                                   .Where(fd => fd.AuthorizedUserId == createdById.ToString() || fd.CreatedBy == createdById.ToString())
                                   .Select(fd =>
                                   {
                                       var subFolderIds = allfolders
                                           .Where(x => x.ParentFolderId == fd.FolderId)
                                           .Select(x => x.FolderId)
                                           .ToList();

                                       var parentFilesCount = Allfiles.Count(x => x.FolderId == fd.FolderId);
                                       var subFolderFilesSize = Allfiles
                                           .Where(x => subFolderIds.Contains(x.FolderId))
                                           .Sum(x => x.Size);

                                       var parentFolderFilesSize = Allfiles
                                           .Where(x => x.FolderId == fd.FolderId)
                                           .Sum(x => x.Size);

                                       return new

                                       {
                                           fd.AuthorizedUserId,
                                           fd.IsView,
                                           fd.FolderId,
                                           fd.FolderName,
                                           fd.FolderPath,
                                           fd.FolderColor,
                                           fd.ParentFolderId,
                                           fd.Owner,
                                           fd.Size,
                                           fd.FileCount,
                                           fd.AccessCount,
                                           fd.Tags,
                                           fd.IsHide,
                                           fd.HideBy,
                                           fd.IsActive,
                                           fd.CreatedBy,
                                           fd.CreatedOn,
                                           fd.ModifiedBy,
                                           fd.ModifiedOn,
                                           SubFoldersIds = subFolderIds,
                                           SubFolderCount = subFolderIds.Count,
                                           ParentFilesCount = parentFilesCount,
                                           ParentFolderSize = parentFolderFilesSize + subFolderFilesSize
                                       };
                                   })
                                       .ToList();

                    //  .Where(f => f.CreatedBy == createdById.ToString() && (f.ParentFolderId == 0))
                    // Ensure this method is available


                    return folders;
                }
            }
            catch (Exception ex)
            {
                // Handle or log the exception as needed
                //ErrorLog.AddErrorLog("", ex.Message);
                throw new Exception(ex.Message ?? "Network Error");
            }
        }
        //modified by shafi
        public async Task<IEnumerable<object>> GetAllFoldersAndFilesByCreatedBy(Guid createdById)
        {
            try
            {
                var result = new List<object>();

                var folders = await _dbContext.FolderData.AsNoTracking()
                    .Where(f => f.CreatedBy == createdById.ToString() && f.ParentFolderId == 0)
                    .OrderByDescending(f => f.CreatedOn)
                    .ToListAsync();

                var files = await _dbContext.FileData.AsNoTracking()
                    .Where(f => f.CreatedBy == createdById.ToString()
                    //&& f.FolderId == 0
                    )
                    .OrderByDescending(f => f.CreatedOn)
                    .ToListAsync();

                result.AddRange(folders);
                result.AddRange(files);

                result = result.OrderByDescending(r => ((dynamic)r).CreatedOn).ToList();

                return result;
            }
            catch (Exception ex)
            {
                // Handle or log the exception as needed
                //ErrorLog.AddErrorLog("", ex.Message);
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        //public async Task<IEnumerable<object>> GetAllFoldersAndFilesByCreatedBy(Guid createdById)
        //{
        //    try
        //    {
        //        var result = new List<object>();

        //        // Fetch folders where CreatedBy matches and ParentFolderId is 0
        //        var folders = await _dbContext.FolderData.AsNoTracking()
        //            .Where(f => f.CreatedBy == createdById.ToString() && f.ParentFolderId == 0)
        //            .Select(f => new
        //            {
        //                Type = "Folder",
        //                FolderId = f.FolderId,
        //                FolderName = f.FolderName,
        //                FolderPath = f.FolderPath,
        //                ServerFolderPath = f.ServerFolderPath,
        //                FolderColor = f.FolderColor,
        //                Owner = f.Owner,
        //                Size = f.Size,
        //                FileCount = f.FileCount,
        //                AccessCount = f.AccessCount,
        //                Tags = f.Tags,
        //                IsActive = f.IsActive,
        //                CreatedOn = f.CreatedOn,
        //                CreatedBy = f.CreatedBy,
        //                ModifiedOn = f.ModifiedOn,
        //                ModifiedBy = f.ModifiedBy,
        //                Files = new List<object>() // Initialize an empty list for files
        //            })
        //            .ToListAsync();

        //        // Fetch files where CreatedBy matches and FolderId is 0
        //        var files = await _dbContext.FileData.AsNoTracking()
        //            .Where(f => f.CreatedBy == createdById.ToString() && f.FolderId == 0)
        //            .Select(f => new
        //            {
        //                Type = "File",
        //                FileId = f.FileId,
        //                FolderId = f.FolderId,
        //                FileName = f.FileName,
        //                FilePath = f.FilePath,
        //                ServerFilePath = f.ServerFilePath,
        //                Owner = f.Owner,
        //                Size = f.Size,
        //                AccessCount = f.AccessCount,
        //                IsActive = f.IsActive,
        //                CreatedOn = f.CreatedOn,
        //                CreatedBy = f.CreatedBy,
        //                ModifiedOn = f.ModifiedOn,
        //                ModifiedBy = f.ModifiedBy
        //            })
        //            .ToListAsync();

        //        // Add fetched folders and files to the result list
        //        result.AddRange(folders);
        //        result.AddRange(files);

        //        return result;
        //    }
        //    catch (Exception ex)
        //    {
        //        // Handle or log the exception as needed
        //        throw new Exception(ex.Message ?? "Network Error");
        //    }
        //}


        public async Task<FolderData> GetFolderById(int folderId)
        {
            try
            {
                var folder = await _dbContext.FolderData.AsNoTracking()
                    .FirstOrDefaultAsync(f => f.FolderId == folderId);

                if (folder == null)
                {
                    throw new Exception($"Folder with ID '{folderId}' not found.");
                }

                return folder;
            }
            catch (Exception ex)
            {
                // Handle or log the exception as needed
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<IEnumerable<FolderData>> GetFolderByParentId(int folderId)
        {
            try
            {
                var folder = await _dbContext.FolderData.AsNoTracking()
                    .Where(f => f.ParentFolderId == folderId)
                    .ToListAsync();

                if (folder == null)
                {
                    throw new Exception($"Folder with ID '{folderId}' not Haveing Sub Folder.");
                }

                return folder;
            }
            catch (Exception ex)
            {
                // Handle or log the exception as needed
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<IEnumerable<object>> GetAllFilesAndFoldersByParentId(int parentFolderId)
        {
            try
            {
                var newdata = new List<object>();
                var files = await _dbContext.FileData.AsNoTracking()
                    .Where(f => f.FolderId == parentFolderId)
                    .OrderBy(f => f.CreatedOn)
                    .ToListAsync();
                newdata.Add(files);
                //var folders = await _dbContext.FolderData.AsNoTracking()
                //    .Where(f => f.ParentFolderId == parentFolderId)
                //    .OrderBy(f => f.CreatedOn)
                //    .ToListAsync();
                var allfolders = await _dbContext.FolderData.AsNoTracking().ToListAsync();
                var allfiles = await _dbContext.FileData.AsNoTracking().ToListAsync();

                var foldername = allfolders.Where(x => x.FolderId == parentFolderId).FirstOrDefault();
                if (foldername != null)
                {
                    var checkempinfo = await _dbContext.EmpInfos.AsNoTracking().Where(x => x.EmpId.ToString().ToLower() == foldername.CreatedBy.ToLower()).FirstOrDefaultAsync();
                    if (checkempinfo != null)
                    {
                        Log.DataLog($"{checkempinfo.EmpId} and UserName : {checkempinfo.FirstName} {checkempinfo.LastName}", $"Accessed Folder {foldername.FolderName}", "Accessed Folder Log");

                        // NEW (this change): mirror the existing text-file "Accessed Folder" log into the
                        // FolderAccessLog table so it can be queried by the Employee-wise Folder Access
                        // report (api/Reports/GetEmployeeWiseFolderAccess). Uses the same identity this
                        // endpoint already resolves above; does not alter the response or existing log file.
                        await _reportService.LogFolderAccessAsync(foldername.FolderId, "Folder", foldername.FolderName,
                            checkempinfo.EmpId.ToString(), "View");
                    }
                    //else
                    //{
                    //    //Log.DataLog($"{accessUserEmailId} and UserName : {accessUserEmailId}", $"Accessed Folder {folder.FolderName}", "Accessed Folder Log");

                    //    Log.DataLog(accessUserEmailId, $"Accessed Folder {folder.FolderName}", "Accessed Folder Log");
                    //}

                }

                //var allSubFoldersCount = 0;
                var allSubFolders = allfolders.Where(x => x.ParentFolderId == parentFolderId).Select(x => x.FolderId).ToList();
                var allSubFoldersCount = allfolders.Where(x => allSubFolders.Contains(x.ParentFolderId ?? 0)).Select(x => x.FolderId).ToList();

                var folders = (from fd in allfolders
                               where fd.ParentFolderId == parentFolderId
                               select new
                               {
                                   fd.AuthorizedUserId,
                                   fd.IsView,
                                   fd.FolderId,
                                   fd.FolderName,
                                   fd.FolderPath,
                                   fd.FolderColor,
                                   fd.ParentFolderId,
                                   fd.Owner,
                                   fd.Size,
                                   fd.FileCount,
                                   fd.AccessCount,
                                   fd.Tags,
                                   fd.IsActive,
                                   fd.CreatedBy,
                                   fd.CreatedOn,
                                   fd.ModifiedBy,
                                   fd.ModifiedOn,
                                   fd.IsHide,
                                   fd.HideBy,
                                   Foldersize = allfiles.Where(x => x.FolderId == fd.FolderId).Sum(x => x.Size),
                                   FolderFilesCount = allfiles.Where(x => x.FolderId == fd.FolderId).Count(),
                                   SubFolderCount = allfolders.Where(X => X.ParentFolderId == fd.FolderId).Count(),

                               }
                                     )
                    //.Where(f => f.ParentFolderId == parentFolderId)
                    .OrderBy(f => f.CreatedOn)
                    .ToList();
                newdata.Add(folders);
                // Combine files and folders into a single list of objects
                var allItems = files.Cast<object>().Concat(folders.Cast<object>());

                // Order by CreatedBy (assuming CreatedBy is a string property)
                var orderedItems = allItems.OrderBy(item =>
                {
                    if (item is FileData file)
                        return file.CreatedOn;
                    else if (item is FolderData folder)
                        return folder.CreatedOn;
                    else
                        throw new InvalidOperationException("Unknown type encountered in the list.");
                });

                //var files = await _dbContext.FileData.AsNoTracking()
                //   .Where(f => f.FolderId == parentFolderId)
                //   .OrderBy(f => f.CreatedOn)
                //   .ToListAsync();
                //var allfolder = await _dbContext.FolderData.AsNoTracking()
                //.Where(f => f.FolderId == parentFolderId)
                //.OrderBy(f => f.CreatedOn)
                //.ToListAsync();
                //var folders =  (from fd in allfolder
                //                     where fd.ParentFolderId == parentFolderId
                //                     select new
                //                     {
                //                         fd.FolderId,
                //                         fd.FolderName,
                //                         fd.FolderPath,
                //                         fd.FolderColor,
                //                         fd.ParentFolderId,
                //                         fd.Owner,
                //                         fd.Size,
                //                         fd.FileCount,
                //                         fd.AccessCount,
                //                         fd.Tags,
                //                         fd.IsActive,
                //                         fd.CreatedBy,
                //                         fd.CreatedOn,
                //                         fd.ModifiedBy,
                //                         fd.ModifiedOn,
                //                         Foldersize = files.Sum(x=>x.Size),
                //                     })
                //    //.Where(f => f.ParentFolderId == parentFolderId)
                //    .OrderBy(f => f.CreatedOn)
                //    .ToList();


                //// Combine files and folders into a single list of objects
                //var allItems = files.Cast<object>().Concat(folders.Cast<object>());

                //// Order by CreatedBy (assuming CreatedBy is a string property)
                //var orderedItems = allItems.OrderBy(item =>
                //{
                //    if (item is FileData file)
                //        return file.CreatedOn;
                //    else if (item is FolderData folder)
                //        return folder.CreatedOn;
                //    else
                //        throw new InvalidOperationException("Unknown type encountered in the list.");
                //});


                return allItems;
            }
            catch (Exception ex)
            {
                // Handle or log the exception as needed
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<string> CreateFolder(FolderCreateDTO input)
        {
            try
            {
                // Retrieve base folder path from configuration
                string baseFolderPath = _configuration["BaseFolderPath"];

                // Get owner ID if provided
                string? owner = null;
                if (input.CreatedBy != null)
                {
                    owner = await GetEmployeeIdAsync(input.CreatedBy);
                }
                //if(input.AuthorizedUserId != null)
                //{
                //    owner = await GetEmployeeIdAsync(input.AuthorizedUserId);
                //}

                // Validate user ID
                Guid UserId;
                if (!Guid.TryParse(input.CreatedBy, out UserId))
                {
                    throw new Exception("Invalid user ID.");
                }

                // Check if user exists
                var userExists = await _dbContext.Users
                        .AnyAsync(u => u.UserID == UserId && u.IsActive);

                if (!userExists)
                {
                    throw new Exception($"User with ID '{input.CreatedBy}' does not exist.");
                }

                // Create user-specific folder path based on user's ID
                string userFolderPath = Path.Combine(baseFolderPath, UserId.ToString());

                // Create user folder if it doesn't exist
                if (!Directory.Exists(userFolderPath))
                {
                    Directory.CreateDirectory(userFolderPath);
                }

                // Trim and validate folder name
                string inputFolderName = input.FolderName?.Trim();
                if (string.IsNullOrEmpty(inputFolderName))
                {
                    throw new Exception("Folder name is required.");
                }

                // Combine base folder path with new folder name
                string newFolderPath = Path.Combine(userFolderPath, inputFolderName);

                // Check if folder already exists
                if (Directory.Exists(newFolderPath))
                {
                    // Folder already exists
                    throw new Exception("Already Folder Name is Exist! With Same Name");
                }

                // Create the directory
                Directory.CreateDirectory(newFolderPath);

                // Construct the URL path for the folder (if needed)
                string portalAddress = _configuration["ApiURL"];
                string foldername = "/StaticFiles/";
                string dbFilePath = portalAddress + Path.Combine(foldername, UserId.ToString(), inputFolderName);

                // Prepare FolderData entity to store in the database
                var folderData = new FolderData
                {
                    FolderName = inputFolderName,
                    FolderPath = newFolderPath, // Store the actual folder path
                    ServerFolderPath = dbFilePath,
                    FolderColor = input.FolderColor,
                    ParentFolderId = 0,
                    Owner = owner,
                    Size = 0,
                    FileCount = 0,
                    AccessCount = 0,
                    IsActive = true,
                    CreatedOn = DateTime.Now,
                    CreatedBy = input.CreatedBy,
                    IsView = false,
                    AuthorizedUserId = input.AuthorizedUserId,
                };

                // Add to context and save changes to the database
                _dbContext.FolderData.Add(folderData);
                await _dbContext.SaveChangesAsync();

                // NEW (this change): initial version snapshot (Folder Versioning) and ownership
                // assignment record (Ownership + Access History report).
                await _reportService.AddFolderVersionAsync(folderData, "Created", input.CreatedBy, "Folder created");
                await _reportService.LogOwnershipOrAccessAsync(folderData.FolderId, "Folder", "OwnershipAssigned",
                    null, input.AuthorizedUserId ?? input.CreatedBy, null, null, input.CreatedBy, "Folder created");

                if (input.AuthorizedUserId != null)
                {
                    var Emp = await _dbContext.EmpInfos.ToListAsync();
                    var admindata = Emp.Where(x => x.EmpId.ToString().ToLower() == input.AuthorizedUserId.ToLower()).FirstOrDefault();
                    var Userdata = Emp.Where(x => x.EmpId.ToString().ToLower() == input.CreatedBy.ToLower()).FirstOrDefault();
                    if (Userdata != null && admindata != null)
                    {
                        Log.DataLog(input.AuthorizedUserId, $"Folder Name {inputFolderName} ~|~ created for the user Id {input.CreatedBy} ~|~ User Name {Userdata.FirstName} {Userdata.LastName}" +
                            $"~|~ by the admin id {input.AuthorizedUserId} ~|~ admin user name {admindata.FirstName} {admindata.LastName}", "Admin Created Folder Log");

                        //Log.DataLog(input.CreatedBy, $"Folder Name {inputFolderName} ~|~ has created for the Authorized user id {input.AuthorizedUserId} ~|~ Authorized User Name {AdminUser.FirstName} {AdminUser.LastName} ~|~ by the Admin User Id {input.AuthorizedUserId} ~|~ Admin User Name {authorizedUser.FirstName} {authorizedUser.LastName}", "Admin Created Folder Log");
                    }
                }
                else
                {
                    Log.DataLog(input?.CreatedBy, $"{input.CreatedBy} successfully created a folder with name of '{inputFolderName}'", "Folder Log");
                }
                return "Folder created successfully.";
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"{input.CreatedBy} : Error while creating folder '{input.FolderName}' - {ex.Message}", "Folder Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        // =====================================================================
        // NEW (this change): Feature 3 - Ownership + Access History.
        // Explicitly transfers a folder's ownership from its current Owner to a
        // new owner, and records a "OwnershipTransferred" entry with the previous
        // and new owner so the full ownership lineage of a folder can be audited
        // (Created -> Shared -> Modified -> Transferred -> Modified again, etc.)
        // via GET api/Reports/GetOwnershipAccessHistory?folderOrFileId={id}&docType=Folder
        // =====================================================================
        public async Task<string> TransferFolderOwnership(TransferOwnershipDTO input)
        {
            try
            {
                var folder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.FolderId);

                if (folder == null)
                {
                    throw new Exception($"Folder with ID '{input.FolderId}' not found.");
                }

                if (!folder.IsActive)
                {
                    throw new Exception("Cannot transfer ownership of an inactive folder.");
                }

                string? previousOwner = folder.Owner;

                if (string.Equals(previousOwner, input.NewOwnerId, StringComparison.OrdinalIgnoreCase))
                {
                    throw new Exception("The selected user already owns this folder.");
                }

                folder.Owner = input.NewOwnerId;
                folder.ModifiedOn = DateTime.Now;
                folder.ModifiedBy = input.TransferredBy;

                _dbContext.FolderData.Update(folder);

                // Version snapshot so "who changed what, when" is visible in the version
                // history too, not just the ownership history.
                await _reportService.AddFolderVersionAsync(folder, "Updated", input.TransferredBy,
                    $"Ownership transferred from '{previousOwner}' to '{input.NewOwnerId}'"
                        + (string.IsNullOrWhiteSpace(input.Remarks) ? "" : $" - {input.Remarks}"),
                    saveChanges: false);

                await _dbContext.SaveChangesAsync();

                // The actual ownership-transfer audit entry, with previous/new owner captured.
                await _reportService.LogOwnershipOrAccessAsync(folder.FolderId, "Folder", "OwnershipTransferred",
                    previousOwner, input.NewOwnerId, null, null, input.TransferredBy, input.Remarks);

                await _reportService.LogFolderAccessAsync(folder.FolderId, "Folder", folder.FolderName, input.TransferredBy, "Update");

                Log.DataLog(input.TransferredBy,
                    $"{input.TransferredBy} transferred ownership of folder '{folder.FolderName}' (ID: {folder.FolderId}) from '{previousOwner}' to '{input.NewOwnerId}'",
                    "Ownership Transfer Log");

                return "Folder ownership transferred successfully.";
            }
            catch (Exception ex)
            {
                Log.Error(input?.TransferredBy, $"Ownership transfer failed for folder ID '{input?.FolderId}'. Error: {ex.Message}", "Ownership Transfer Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<string> CreateSubFolder(SubFolderCreateDTO input)
        {
            try
            {
                string baseFolderPath = _configuration["BaseFolderPath"];
                var parentFolder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.ParentFolderId);
                string inputFolderName = input.FolderName.TrimEnd();
                if (parentFolder == null)
                {
                    throw new Exception("Parent folder does not exist.");
                }

                string? owner = null;
                if (input.CreatedBy != null)
                {
                    owner = await GetEmployeeIdAsync(input.CreatedBy);
                }

                string newFolderPath = Path.Combine(parentFolder.FolderPath, inputFolderName);

                if (Directory.Exists(newFolderPath))
                {
                    // Folder already exists
                    throw new Exception("A folder with the same name already exists.");
                }

                // Create the directory
                Directory.CreateDirectory(newFolderPath);

                // Construct the URL path for the folder (if needed)
                string portalAddress = _configuration["ApiURL"];
                string dbRmPath = newFolderPath.Substring(baseFolderPath.Length).TrimStart(Path.DirectorySeparatorChar);
                string foldername = "/StaticFiles/";
                string dbFilePath = portalAddress + Path.Combine(foldername, dbRmPath);

                // Prepare FolderData entity to store in the database
                var folderData = new FolderData
                {
                    FolderName = inputFolderName,
                    FolderPath = newFolderPath, // Store the actual folder path
                    ServerFolderPath = dbFilePath,
                    FolderColor = input.FolderColor,
                    ParentFolderId = input.ParentFolderId,
                    Owner = owner,
                    Size = 0, // Initialize size as needed
                    FileCount = 0,
                    AccessCount = 0,
                    IsActive = true,
                    CreatedOn = DateTime.Now,
                    CreatedBy = input.CreatedBy,
                    IsView = false,
                };

                // Add to context and save changes to the database
                _dbContext.FolderData.Add(folderData);
                await _dbContext.SaveChangesAsync();

                // NEW (this change): version + ownership snapshot for the new subfolder itself,
                // AND bump the PARENT folder's version since its contents changed.
                await _reportService.AddFolderVersionAsync(folderData, "Created", input.CreatedBy, "Subfolder created");
                await _reportService.LogOwnershipOrAccessAsync(folderData.FolderId, "Folder", "OwnershipAssigned",
                    null, input.CreatedBy, null, null, input.CreatedBy, "Subfolder created");
                await _reportService.AddFolderVersionAsync(parentFolder, "SubFolderAdded", input.CreatedBy,
                    $"Subfolder '{inputFolderName}' added", inputFolderName);

                Log.DataLog(input?.CreatedBy, $"{input.CreatedBy} successfully created a subfolder with mane of '{inputFolderName}' under parent folder ID {input.ParentFolderId}", "SubFolder Log");
                return "Folder Created Successflly";
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"{input.CreatedBy} : Error while creating subfolder '{input.FolderName}' - {ex.Message}", "SubFolder Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }


        public async Task<string> CreateSubFolderBehalf(SubFolderCreateBehalfDTO input)
        {
            try
            {
                string baseFolderPath = _configuration["BaseFolderPath"];
                var parentFolder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.ParentFolderId);
                string inputFolderName = input.FolderName.TrimEnd();
                if (parentFolder == null)
                {
                    throw new Exception("Parent folder does not exist.");
                }

                string? owner = null;
                if (input.CreatedBy != null)
                {
                    owner = await GetEmployeeIdAsync(input.CreatedBy);
                }

                string newFolderPath = Path.Combine(parentFolder.FolderPath, inputFolderName);

                if (Directory.Exists(newFolderPath))
                {
                    // Folder already exists
                    throw new Exception("A folder with the same name already exists.");
                }

                // Create the directory
                Directory.CreateDirectory(newFolderPath);

                // Construct the URL path for the folder (if needed)
                string portalAddress = _configuration["ApiURL"];
                string dbRmPath = newFolderPath.Substring(baseFolderPath.Length).TrimStart(Path.DirectorySeparatorChar);
                string foldername = "/StaticFiles/";
                string dbFilePath = portalAddress + Path.Combine(foldername, dbRmPath);

                // Prepare FolderData entity to store in the database
                var folderData = new FolderData
                {
                    FolderName = inputFolderName,
                    FolderPath = newFolderPath, // Store the actual folder path
                    ServerFolderPath = dbFilePath,
                    FolderColor = input.FolderColor,
                    ParentFolderId = input.ParentFolderId,
                    Owner = owner,
                    Size = 0, // Initialize size as needed
                    FileCount = 0,
                    AccessCount = 0,
                    IsActive = true,
                    CreatedOn = DateTime.Now,
                    CreatedBy = input.StoregeUserId,
                    IsView = false,
                };

                // Add to context and save changes to the database
                _dbContext.FolderData.Add(folderData);
                await _dbContext.SaveChangesAsync();

                // NEW (this change): version snapshot + ownership assignment. This is the
                // "behalf" flow (admin = input.CreatedBy acting for the storage owner
                // input.StoregeUserId), so we record the storage owner as the new owner and
                // the acting admin as who performed the action.
                await _reportService.AddFolderVersionAsync(folderData, "Created", input.CreatedBy, "Subfolder created on behalf of user");
                await _reportService.LogOwnershipOrAccessAsync(folderData.FolderId, "Folder", "OwnershipAssigned",
                    null, input.StoregeUserId, null, null, input.CreatedBy, "Subfolder created on behalf of user");

                // NEW (this change): bump the PARENT folder's version too, since its contents changed.
                await _reportService.AddFolderVersionAsync(parentFolder, "SubFolderAdded", input.CreatedBy,
                    $"Subfolder '{inputFolderName}' added on behalf of user", inputFolderName);

                Log.DataLog(input?.CreatedBy, $"{input.CreatedBy} successfully created a subfolder with mane of '{inputFolderName}' under parent folder ID {input.ParentFolderId}", "SubFolder Log");

                // NEW (this change): notify the original shared-folder owner (StoregeUserId) that
                // input.CreatedBy created this subfolder on their behalf.
                var (ownerEmail, ownerName) = await GetUserNotifyDetailsAsync(input.StoregeUserId);
                if (!string.IsNullOrEmpty(ownerEmail))
                {
                    var (_, actingUserName) = await GetUserNotifyDetailsAsync(input.CreatedBy);
                    await _emailService.SendBehalfActionNotificationMail(
                        ownerEmail, ownerName, actingUserName ?? input.CreatedBy, inputFolderName, "Folder", "Created", parentFolder.FolderName);
                }

                return "Folder Created Successflly";
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"{input.CreatedBy} : Error while creating subfolder '{input.FolderName}' - {ex.Message}", "SubFolder Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }


        public async Task<string> UpdateFolder(FolderUpdateDTO input)
        {
            try
            {
                string baseFolderPath = _configuration["BaseFolderPath"];

                // Retrieve the existing folder data from the database based on FolderId
                var existingFolder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.FolderId);

                if (existingFolder == null)
                {
                    throw new Exception($"Folder with ID '{input.FolderId}' not found.");
                }
                string inputFolderName = input.FolderName.TrimEnd();
                // Retrieve employee ID if CreatedBy is provided
                string? owner = null;
                if (input.CreatedBy != null)
                {
                    owner = await GetEmployeeIdAsync(input.CreatedBy);
                }

                // Construct the current and new folder paths
                string currentFolderPath = existingFolder.FolderPath;
                // NEW (fix): preserve the parent directory (e.g. the user-id segment) instead of
                // rebuilding the path from BaseFolderPath, which was dropping that segment.
                string newFolderPath = Path.Combine(Path.GetDirectoryName(currentFolderPath), inputFolderName);

                // NEW (fix): capture the name-changed result BEFORE FolderName is overwritten below.
                // Previously this check was re-evaluated after existingFolder.FolderName had already
                // been set to inputFolderName, so it always compared inputFolderName to itself and
                // was always false - UpdateSubfoldersAndFiles (which fixes FileData paths) never ran.
                bool folderNameChanged = !string.Equals(existingFolder.FolderName, inputFolderName, StringComparison.OrdinalIgnoreCase);

                // Rename the folder if the name is different
                if (folderNameChanged)
                {
                    // Ensure the new folder path does not already exist
                    if (Directory.Exists(newFolderPath))
                    {
                        throw new Exception("A folder with the new name already exists.");
                    }

                    // Rename the folder
                    if (Directory.Exists(currentFolderPath))
                    {
                        Directory.Move(currentFolderPath, newFolderPath);
                    }
                    else
                    {
                        throw new Exception("Current folder path does not exist.");
                    }
                }

                // Construct the URL path for the folder
                string portalAddress = _configuration["ApiURL"];
                string folderNamePath = "/StaticFiles/";
                // NEW (fix): derive from newFolderPath (which now retains the user-id segment)
                // instead of rebuilding from just the folder name.
                string dbRmPath = newFolderPath.Substring(baseFolderPath.Length).TrimStart(Path.DirectorySeparatorChar);
                string dbFilePath = portalAddress + Path.Combine(folderNamePath, dbRmPath);

                // Update the properties of the existing folder entity
                existingFolder.FolderName = inputFolderName;
                existingFolder.FolderPath = newFolderPath;
                existingFolder.ServerFolderPath = dbFilePath;
                existingFolder.FolderColor = input.FolderColor;
                existingFolder.Tags = input.Tags;
                existingFolder.ModifiedOn = DateTime.Now;
                existingFolder.ModifiedBy = input.CreatedBy;

                if (folderNameChanged)
                {
                    // Update subfolders and files
                    await UpdateSubfoldersAndFiles(existingFolder.FolderId, newFolderPath, dbFilePath);
                }

                Log.DataLog(input?.CreatedBy, $"{input.CreatedBy} successfully updated folder name  {existingFolder.FolderName} to '{inputFolderName}' (ID: {input.FolderId})", "Folder Log");
                // Save changes to the database
                _dbContext.FolderData.Update(existingFolder);

                // NEW (this change): version snapshot, saved together with the folder update above.
                await _reportService.AddFolderVersionAsync(existingFolder, "Updated", input.CreatedBy, saveChanges: false);

                // NEW (this change): ownership/access history "Modified" entry.
                await _reportService.LogOwnershipOrAccessAsync(existingFolder.FolderId, "Folder", "Modified",
                    null, null, null, null, input.CreatedBy, "Folder updated", saveChanges: false);

                await _dbContext.SaveChangesAsync();

                // NEW (this change): record this as an "Update" for the Employee-wise Folder Access report.
                await _reportService.LogFolderAccessAsync(existingFolder.FolderId, "Folder", existingFolder.FolderName, input.CreatedBy, "Update");

                return "Folder Updated Successfully.";
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"{input.CreatedBy} : Error updating folder '{input.FolderName}' (ID: {input.FolderId}) - {ex.Message}", "Folder Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<string> UpdateFolderBehalf(FolderUpdateBehalfDTO input)
        {
            try
            {
                string baseFolderPath = _configuration["BaseFolderPath"];

                // Retrieve the existing folder data from the database based on FolderId
                var existingFolder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.FolderId);

                if (existingFolder == null)
                {
                    throw new Exception($"Folder with ID '{input.FolderId}' not found.");
                }
                string inputFolderName = input.FolderName.TrimEnd();
                // Retrieve employee ID if CreatedBy is provided
                string? owner = null;
                if (input.CreatedBy != null)
                {
                    owner = await GetEmployeeIdAsync(input.CreatedBy);
                }

                // Construct the current and new folder paths
                string currentFolderPath = existingFolder.FolderPath;
                // NEW (fix): preserve the parent directory (e.g. the user-id segment) instead of
                // rebuilding the path from BaseFolderPath, which was dropping that segment.
                string newFolderPath = Path.Combine(Path.GetDirectoryName(currentFolderPath), inputFolderName);

                // NEW (fix): capture the name-changed result BEFORE FolderName is overwritten below.
                // Previously this check was re-evaluated after existingFolder.FolderName had already
                // been set to inputFolderName, so it always compared inputFolderName to itself and
                // was always false - UpdateSubfoldersAndFiles (which fixes FileData paths) never ran.
                bool folderNameChanged = !string.Equals(existingFolder.FolderName, inputFolderName, StringComparison.OrdinalIgnoreCase);

                // Rename the folder if the name is different
                if (folderNameChanged)
                {
                    // Ensure the new folder path does not already exist
                    if (Directory.Exists(newFolderPath))
                    {
                        throw new Exception("A folder with the new name already exists.");
                    }

                    // Rename the folder
                    if (Directory.Exists(currentFolderPath))
                    {
                        Directory.Move(currentFolderPath, newFolderPath);
                    }
                    else
                    {
                        throw new Exception("Current folder path does not exist.");
                    }
                }

                // Construct the URL path for the folder
                string portalAddress = _configuration["ApiURL"];
                string folderNamePath = "/StaticFiles/";
                // NEW (fix): derive from newFolderPath (which now retains the user-id segment)
                // instead of rebuilding from just the folder name.
                string dbRmPath = newFolderPath.Substring(baseFolderPath.Length).TrimStart(Path.DirectorySeparatorChar);
                string dbFilePath = portalAddress + Path.Combine(folderNamePath, dbRmPath);

                // Update the properties of the existing folder entity
                existingFolder.FolderName = inputFolderName;
                existingFolder.FolderPath = newFolderPath;
                existingFolder.ServerFolderPath = dbFilePath;
                existingFolder.FolderColor = input.FolderColor;
                existingFolder.Tags = input.Tags;
                existingFolder.ModifiedOn = DateTime.Now;
                existingFolder.ModifiedBy = input.StoregeUserId;

                if (folderNameChanged)
                {
                    // Update subfolders and files
                    await UpdateSubfoldersAndFiles(existingFolder.FolderId, newFolderPath, dbFilePath);
                }

                Log.DataLog(input?.CreatedBy, $"{input.CreatedBy} successfully updated folder name  {existingFolder.FolderName} to '{inputFolderName}' (ID: {input.FolderId})", "Folder Log");
                // Save changes to the database
                _dbContext.FolderData.Update(existingFolder);

                // NEW (this change): version snapshot, saved together with the folder update above.
                await _reportService.AddFolderVersionAsync(existingFolder, "Updated", input.CreatedBy, "Updated on behalf of storage owner", saveChanges: false);

                // NEW (this change): ownership/access history "Modified" entry.
                await _reportService.LogOwnershipOrAccessAsync(existingFolder.FolderId, "Folder", "Modified",
                    null, null, null, null, input.CreatedBy, "Folder updated on behalf of storage owner", saveChanges: false);

                await _dbContext.SaveChangesAsync();

                // NEW (this change): record this as an "Update" for the Employee-wise Folder Access report.
                await _reportService.LogFolderAccessAsync(existingFolder.FolderId, "Folder", existingFolder.FolderName, input.CreatedBy, "Update");

                return "Folder Updated Successfully.";
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"{input.CreatedBy} : Error updating folder '{input.FolderName}' (ID: {input.FolderId}) - {ex.Message}", "Folder Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }


        public async Task<string> UpdateFolderName(FolderNameUpdateDTO input)
        {
            try
            {
                string baseFolderPath = _configuration["BaseFolderPath"];

                // Retrieve the existing folder data from the database based on FolderId
                var existingFolder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.FolderId);

                if (existingFolder == null)
                {
                    throw new Exception($"Folder with ID '{input.FolderId}' not found.");
                }
                string inputFolderName = input.FolderName.TrimEnd();
                // Retrieve employee ID if CreatedBy is provided
                string? owner = null;
                if (input.CreatedBy != null)
                {
                    owner = await GetEmployeeIdAsync(input.CreatedBy);
                }

                // Construct the current and new folder paths
                string currentFolderPath = existingFolder.FolderPath;
                // NEW (fix): preserve the parent directory (e.g. the user-id segment) instead of
                // rebuilding the path from BaseFolderPath, which was dropping that segment.
                string newFolderPath = Path.Combine(Path.GetDirectoryName(currentFolderPath), inputFolderName);

                // NEW (fix): capture the name-changed result BEFORE FolderName is overwritten below.
                // Previously this check was re-evaluated after existingFolder.FolderName had already
                // been set to inputFolderName, so it always compared inputFolderName to itself and
                // was always false - UpdateSubfoldersAndFiles (which fixes FileData paths) never ran.
                bool folderNameChanged = !string.Equals(existingFolder.FolderName, inputFolderName, StringComparison.OrdinalIgnoreCase);

                // Rename the folder if the name is different
                if (folderNameChanged)
                {
                    // Ensure the new folder path does not already exist
                    if (Directory.Exists(newFolderPath))
                    {
                        throw new Exception("A folder with the new name already exists.");
                    }

                    // Rename the folder
                    if (Directory.Exists(currentFolderPath))
                    {
                        Directory.Move(currentFolderPath, newFolderPath);
                    }
                    else
                    {
                        throw new Exception("Current folder path does not exist.");
                    }
                }

                // Construct the URL path for the folder
                string portalAddress = _configuration["ApiURL"];
                string folderNamePath = "/StaticFiles/";
                // NEW (fix): derive from newFolderPath (which now retains the user-id segment)
                // instead of rebuilding from just the folder name.
                string dbRmPath = newFolderPath.Substring(baseFolderPath.Length).TrimStart(Path.DirectorySeparatorChar);
                string dbFilePath = portalAddress + Path.Combine(folderNamePath, dbRmPath);

                // Update the properties of the existing folder entity
                existingFolder.FolderName = inputFolderName;
                existingFolder.FolderPath = newFolderPath;
                existingFolder.ServerFolderPath = dbFilePath;
                existingFolder.FolderColor = input.FolderColor;
                existingFolder.ModifiedOn = DateTime.Now;
                existingFolder.ModifiedBy = input.CreatedBy;

                if (folderNameChanged)
                {
                    // Update subfolders and files
                    await UpdateSubfoldersAndFiles(existingFolder.FolderId, newFolderPath, dbFilePath);
                }
                Log.DataLog(input?.CreatedBy, $"{input.CreatedBy} successfully updated folder name {existingFolder.FolderName} to '{input.FolderName}' (ID: {input.FolderId})", "Folder Log");

                // Save changes to the database
                _dbContext.FolderData.Update(existingFolder);

                // NEW (this change): version snapshot, saved together with the folder update above.
                await _reportService.AddFolderVersionAsync(existingFolder, "Renamed", input.CreatedBy, saveChanges: false);

                // NEW (this change): ownership/access history "Modified" entry.
                await _reportService.LogOwnershipOrAccessAsync(existingFolder.FolderId, "Folder", "Modified",
                    null, null, null, null, input.CreatedBy, "Folder renamed", saveChanges: false);

                await _dbContext.SaveChangesAsync();

                // NEW (this change): record this as an "Update" for the Employee-wise Folder Access report.
                await _reportService.LogFolderAccessAsync(existingFolder.FolderId, "Folder", existingFolder.FolderName, input.CreatedBy, "Update");

                return "Folder Updated Successfully.";
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"{input.CreatedBy} : Error updating folder name for folder ID {input.FolderId} - {ex.Message}", "Folder Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }


        public async Task<string> MoveToFolderOrFile(MoveToFolderDTO input)
        {
            try
            {
                string baseFolderPath = _configuration["BaseFolderPath"];

                if (input.DocType == "Folder")
                {
                    // Retrieve the existing folder data from the database based on FromFolderId
                    var existingFolder = await _dbContext.FolderData
                        .FirstOrDefaultAsync(f => f.FolderId == input.FromFolderOrFileId);

                    if (existingFolder == null)
                    {
                        throw new Exception($"Folder with ID '{input.FromFolderOrFileId}' not found.");
                    }

                    // Retrieve the destination folder data from the database based on ToFolderId
                    var destinationFolder = await _dbContext.FolderData
                        .FirstOrDefaultAsync(f => f.FolderId == input.ToFolderOrFileId);

                    if (destinationFolder == null)
                    {
                        throw new Exception($"Destination folder with ID '{input.ToFolderOrFileId}' not found.");
                    }

                    // Retrieve employee ID if CreatedBy is provided
                    string? owner = null;
                    if (input.CreatedBy != null)
                    {
                        owner = await GetEmployeeIdAsync(input.CreatedBy);
                    }

                    // Construct the current and new folder paths
                    string currentFolderPath = existingFolder.FolderPath;
                    string newFolderPath = Path.Combine(destinationFolder.FolderPath, existingFolder.FolderName);

                    // Move the folder to the new location
                    if (Directory.Exists(currentFolderPath))
                    {
                        Directory.Move(currentFolderPath, newFolderPath);
                    }
                    else
                    {
                        throw new Exception("Current folder path does not exist.");
                    }
                    Log.DataLog(input.CreatedBy, $"folder moved from '{existingFolder.FolderPath}' folder '{destinationFolder.FolderPath}' by user '{input.CreatedBy}'", "Folder Log");

                    // Update the properties of the existing folder entity
                    existingFolder.FolderPath = newFolderPath;
                    existingFolder.ParentFolderId = destinationFolder.FolderId;
                    existingFolder.ServerFolderPath = Path.Combine(destinationFolder.ServerFolderPath, existingFolder.FolderName);
                    existingFolder.ModifiedOn = DateTime.Now;
                    existingFolder.ModifiedBy = input.CreatedBy;
                    // Update subfolders and files
                    await UpdateSubfoldersAndFilesforMoveTo(existingFolder.FolderId, newFolderPath, existingFolder.ServerFolderPath);

                    // Save changes to the database
                    _dbContext.FolderData.Update(existingFolder);

                    // NEW (this change): version snapshot for the move, saved together with the update above.
                    await _reportService.AddFolderVersionAsync(existingFolder, "Moved", input.CreatedBy,
                        $"Moved to folder ID {destinationFolder.FolderId}", saveChanges: false);

                    // NEW (this change): ownership/access history "Modified" entry, and bump the
                    // destination folder's version since its contents changed (a subfolder arrived).
                    await _reportService.LogOwnershipOrAccessAsync(existingFolder.FolderId, "Folder", "Modified",
                        null, null, null, null, input.CreatedBy, $"Folder moved to folder ID {destinationFolder.FolderId}", saveChanges: false);
                    await _reportService.AddFolderVersionAsync(destinationFolder, "SubFolderAdded", input.CreatedBy,
                        $"Folder '{existingFolder.FolderName}' moved in", existingFolder.FolderName, saveChanges: false);

                    await _dbContext.SaveChangesAsync();

                    // NEW (this change): record this as an "Update" for the Employee-wise Folder Access report.
                    await _reportService.LogFolderAccessAsync(existingFolder.FolderId, "Folder", existingFolder.FolderName, input.CreatedBy, "Update");

                    return "Folder moved successfully.";
                }
                else if (input.DocType == "Document")
                {
                    // Retrieve the existing file data from the database based on FromFolderOrFileId
                    var existingFile = await _dbContext.FileData
                        .FirstOrDefaultAsync(f => f.FileId == input.FromFolderOrFileId);

                    if (existingFile == null)
                    {
                        throw new Exception($"File with ID '{input.FromFolderOrFileId}' not found.");
                    }

                    // Retrieve the destination folder data from the database based on ToFolderId
                    var destinationFolder = await _dbContext.FolderData
                        .FirstOrDefaultAsync(f => f.FolderId == input.ToFolderOrFileId);

                    if (destinationFolder == null)
                    {
                        throw new Exception($"Destination folder with ID '{input.ToFolderOrFileId}' not found.");
                    }

                    // Retrieve employee ID if CreatedBy is provided
                    string? owner = null;
                    if (input.CreatedBy != null)
                    {
                        owner = await GetEmployeeIdAsync(input.CreatedBy);
                    }

                    // Construct the current and new file paths
                    string currentFilePath = existingFile.FilePath;
                    string newFilePath = Path.Combine(destinationFolder.FolderPath, Path.GetFileName(currentFilePath));

                    // Move the file to the new location
                    if (File.Exists(currentFilePath))
                    {
                        File.Move(currentFilePath, newFilePath);
                    }
                    else
                    {
                        throw new Exception("Current file path does not exist.");
                    }
                    Log.DataLog(input.CreatedBy, $"File moved from '{existingFile.FilePath}' moved to  '{newFilePath}' by user '{input.CreatedBy}'", "Folder Log");

                    // Update the properties of the existing file entity
                    existingFile.FilePath = newFilePath;
                    existingFile.ServerFilePath = Path.Combine(destinationFolder.ServerFolderPath, Path.GetFileName(currentFilePath));
                    existingFile.FolderId = destinationFolder.FolderId;
                    existingFile.ModifiedOn = DateTime.Now;
                    existingFile.ModifiedBy = input.CreatedBy;

                    // Save changes to the database
                    _dbContext.FileData.Update(existingFile);
                    await _dbContext.SaveChangesAsync();

                    return "File moved successfully.";
                }
                else
                {
                    Log.Error(input?.CreatedBy, $"Invalid DocType '{input.DocType}' provided. Must be 'Folder' or 'Document'.", "Folder Log");
                    throw new Exception("Invalid DocType. It should be either 'Folder' or 'Document'.");
                }
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"Move operation failed. Error: {ex.Message}", "Folder Log");

                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        private async Task UpdateSubfoldersAndFilesforMoveTo(int parentFolderId, string newFolderPath, string newServerFolderPath)
        {
            // Update subfolders
            var subfolders = await _dbContext.FolderData
                .Where(f => f.ParentFolderId == parentFolderId)
                .ToListAsync();

            foreach (var subfolder in subfolders)
            {
                string oldSubfolderPath = subfolder.FolderPath;
                string newSubfolderPath = Path.Combine(newFolderPath, subfolder.FolderName);
                string newSubfolderServerPath = Path.Combine(newServerFolderPath, subfolder.FolderName);

                // Move subfolder to the new location
                if (Directory.Exists(oldSubfolderPath))
                {
                    Directory.Move(oldSubfolderPath, newSubfolderPath);
                }

                // Update subfolder paths in the database
                subfolder.FolderPath = newSubfolderPath;
                subfolder.ServerFolderPath = newSubfolderServerPath;
                _dbContext.FolderData.Update(subfolder);

                // Recursively update sub-subfolders and files
                await UpdateSubfoldersAndFilesforMoveTo(subfolder.FolderId, newSubfolderPath, newSubfolderServerPath);
            }

            // Update files
            var files = await _dbContext.FileData
                .Where(f => f.FolderId == parentFolderId)
                .ToListAsync();

            foreach (var file in files)
            {
                // Construct new file path
                string oldFilePath = file.FilePath;
                string newFilePath = Path.Combine(newFolderPath, Path.GetFileName(oldFilePath));
                string newFileServerPath = Path.Combine(newServerFolderPath, Path.GetFileName(oldFilePath));

                // Move file to the new location
                if (File.Exists(oldFilePath))
                {
                    File.Move(oldFilePath, newFilePath);
                }

                // Update file paths in the database
                file.FilePath = newFilePath;
                file.ServerFilePath = newFileServerPath;
                _dbContext.FileData.Update(file);
            }
        }

        private async Task UpdateSubfoldersAndFiles(int parentFolderId, string newFolderPath, string newServerFolderPath)
        {
            // Update subfolders
            var subfolders = await _dbContext.FolderData
                .Where(f => f.ParentFolderId == parentFolderId)
                .ToListAsync();

            foreach (var subfolder in subfolders)
            {
                string oldSubfolderPath = subfolder.FolderPath;
                string newSubfolderPath = Path.Combine(newFolderPath, subfolder.FolderName);
                string newSubfolderServerPath = newServerFolderPath + "/" + subfolder.FolderName;

                // Rename subfolder in the file system
                if (Directory.Exists(oldSubfolderPath))
                {
                    Directory.Move(oldSubfolderPath, newSubfolderPath);
                }

                // Update subfolder paths in the database
                subfolder.FolderPath = newSubfolderPath;
                subfolder.ServerFolderPath = newSubfolderServerPath;
                _dbContext.FolderData.Update(subfolder);

                // Recursively update sub-subfolders and files
                await UpdateSubfoldersAndFiles(subfolder.FolderId, newSubfolderPath, newSubfolderServerPath);
            }

            // Update files
            var files = await _dbContext.FileData
                .Where(f => f.FolderId == parentFolderId)
                .ToListAsync();

            foreach (var file in files)
            {
                // Construct new file path
                string oldFilePath = file.FilePath;
                string newFilePath = Path.Combine(newFolderPath, Path.GetFileName(oldFilePath));
                string newFileServerPath = newServerFolderPath + "/" + Path.GetFileName(oldFilePath);

                // Rename file in the file system
                if (File.Exists(oldFilePath))
                {
                    File.Move(oldFilePath, newFilePath);
                }

                // Update file paths in the database
                file.FilePath = newFilePath;
                file.ServerFilePath = newFileServerPath;
                _dbContext.FileData.Update(file);
            }
        }


        public async Task<string> SubUpdateFolder(SubFolderUpdateDTO input)
        {
            try
            {
                string baseFolderPath = _configuration["BaseFolderPath"];

                // Retrieve the folder to update from the database
                var folder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.FolderId);

                if (folder == null)
                {
                    throw new Exception("Folder does not exist.");
                }

                string inputFolderName = input.FolderName.TrimEnd();

                // Retrieve the parent folder
                var parentFolder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.ParentFolderId);

                if (parentFolder == null)
                {
                    throw new Exception("Parent folder does not exist.");
                }

                // Construct the new folder path
                string currentFolderPath = folder.FolderPath;
                string newFolderPath = Path.Combine(parentFolder.FolderPath, inputFolderName);

                // Rename the folder if the name or parent folder has changed
                if (currentFolderPath != newFolderPath)
                {
                    if (Directory.Exists(newFolderPath))
                    {
                        throw new Exception("A folder with the new name already exists.");
                    }

                    if (Directory.Exists(currentFolderPath))
                    {
                        Directory.Move(currentFolderPath, newFolderPath);
                    }
                    else
                    {
                        throw new Exception("Current folder path does not exist.");
                    }

                }

                // Construct the URL path for the folder
                string portalAddress = _configuration["ApiURL"];
                string dbRmPath = newFolderPath.Substring(baseFolderPath.Length).TrimStart(Path.DirectorySeparatorChar);
                string foldername = "/StaticFiles/";
                string dbFilePath = portalAddress + Path.Combine(foldername, dbRmPath);
                Log.DataLog(input?.CreatedBy, $"Existing Folder name '{input.FolderName}' changed to {inputFolderName}", "SubFolder Log");
                // Update the FolderData entity
                folder.FolderName = inputFolderName;
                folder.FolderPath = newFolderPath; // Update the folder path
                folder.ServerFolderPath = dbFilePath;
                folder.FolderColor = input.FolderColor;
                folder.Tags = input.Tags;
                folder.ModifiedOn = DateTime.Now;
                folder.ModifiedBy = input.CreatedBy;

                if (currentFolderPath != newFolderPath)
                {
                    await UpdateSubfoldersAndFiles(folder.FolderId, newFolderPath, dbFilePath);
                }

                // Save changes to the database
                _dbContext.FolderData.Update(folder);

                // NEW (this change): version snapshot, saved together with the update above.
                await _reportService.AddFolderVersionAsync(folder, "Updated", input.CreatedBy, saveChanges: false);

                // NEW (this change): ownership/access history "Modified" entry.
                await _reportService.LogOwnershipOrAccessAsync(folder.FolderId, "Folder", "Modified",
                    null, null, null, null, input.CreatedBy, "Subfolder updated", saveChanges: false);

                await _dbContext.SaveChangesAsync();

                // NEW (this change): record this as an "Update" for the Employee-wise Folder Access report.
                await _reportService.LogFolderAccessAsync(folder.FolderId, "Folder", folder.FolderName, input.CreatedBy, "Update");

                return "Folder updated successfully";
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"Folder update failed for folder ID '{input.FolderId}'. Error: {ex.Message}", "SubFolder Error Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }



        public async Task<string> SubUpdateFolderBehalf(SubFolderUpdateBehalfDTO input)
        {
            try
            {
                string baseFolderPath = _configuration["BaseFolderPath"];

                // Retrieve the folder to update from the database
                var folder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.FolderId);

                if (folder == null)
                {
                    throw new Exception("Folder does not exist.");
                }

                string inputFolderName = input.FolderName.TrimEnd();

                // Retrieve the parent folder
                var parentFolder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.ParentFolderId);

                if (parentFolder == null)
                {
                    throw new Exception("Parent folder does not exist.");
                }

                // Construct the new folder path
                string currentFolderPath = folder.FolderPath;
                string newFolderPath = Path.Combine(parentFolder.FolderPath, inputFolderName);

                // Rename the folder if the name or parent folder has changed
                if (currentFolderPath != newFolderPath)
                {
                    if (Directory.Exists(newFolderPath))
                    {
                        throw new Exception("A folder with the new name already exists.");
                    }

                    if (Directory.Exists(currentFolderPath))
                    {
                        Directory.Move(currentFolderPath, newFolderPath);
                    }
                    else
                    {
                        throw new Exception("Current folder path does not exist.");
                    }

                }

                // Construct the URL path for the folder
                string portalAddress = _configuration["ApiURL"];
                string dbRmPath = newFolderPath.Substring(baseFolderPath.Length).TrimStart(Path.DirectorySeparatorChar);
                string foldername = "/StaticFiles/";
                string dbFilePath = portalAddress + Path.Combine(foldername, dbRmPath);
                Log.DataLog(input?.CreatedBy, $"Existing Folder name '{input.FolderName}' changed to {inputFolderName}", "SubFolder Log");
                // Update the FolderData entity
                folder.FolderName = inputFolderName;
                folder.FolderPath = newFolderPath; // Update the folder path
                folder.ServerFolderPath = dbFilePath;
                folder.FolderColor = input.FolderColor;
                folder.Tags = input.Tags;
                folder.ModifiedOn = DateTime.Now;
                folder.ModifiedBy = input.StoregeUserId;

                if (currentFolderPath != newFolderPath)
                {
                    await UpdateSubfoldersAndFiles(folder.FolderId, newFolderPath, dbFilePath);
                }

                // Save changes to the database
                _dbContext.FolderData.Update(folder);

                // NEW (this change): version snapshot, saved together with the update above.
                await _reportService.AddFolderVersionAsync(folder, "Updated", input.CreatedBy, "Updated on behalf of storage owner", saveChanges: false);

                // NEW (this change): ownership/access history "Modified" entry.
                await _reportService.LogOwnershipOrAccessAsync(folder.FolderId, "Folder", "Modified",
                    null, null, null, null, input.CreatedBy, "Subfolder updated on behalf of storage owner", saveChanges: false);

                await _dbContext.SaveChangesAsync();

                // NEW (this change): record this as an "Update" for the Employee-wise Folder Access report.
                await _reportService.LogFolderAccessAsync(folder.FolderId, "Folder", folder.FolderName, input.CreatedBy, "Update");

                return "Folder updated successfully";
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"Folder update failed for folder ID '{input.FolderId}'. Error: {ex.Message}", "SubFolder Error Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        // =====================================================================
        // NEW (this change): folder ZIP download rewritten to STREAM the archive
        // directly onto the HTTP response as it's built, instead of writing a
        // full temp .zip to disk first and then re-reading it. See
        // FolderDataController.DownloadFolder for the part of this that has to
        // live in the controller (setting response headers before any bytes are
        // written, and disabling response buffering).
        //
        // GetFolderForDownloadAsync validates everything BEFORE any header is
        // sent, so a "folder not found" style error still comes back as a clean
        // 400 response. Once WriteFolderZipToStreamAsync starts, headers are
        // already committed (200 OK) - if something fails mid-archive, the
        // connection is simply cut short. WriteFolderZipToStreamAsync therefore
        // catches per-file errors internally and skips the bad file (logging it)
        // instead of aborting the whole download over one unreadable file.
        // =====================================================================
        public async Task<FolderData> GetFolderForDownloadAsync(int folderId)
        {
            var folder = await _dbContext.FolderData.AsNoTracking()
                .FirstOrDefaultAsync(f => f.FolderId == folderId);

            if (folder == null)
            {
                throw new Exception("Requested folder path does not exist.");
            }

            if (!Directory.Exists(folder.FolderPath))
            {
                throw new Exception("Folder does not exist on the server.");
            }

            // Record the download for the Employee-wise Folder Access report. Same
            // CreatedBy-attribution note as before: this endpoint doesn't take a
            // caller/user id today.
            await _reportService.LogFolderAccessAsync(folder.FolderId, "Folder", folder.FolderName, folder.CreatedBy, "Download");

            return folder;
        }

        public async Task WriteFolderZipToStreamAsync(FolderData folder, Stream outputStream)
        {
            // leaveOpen: true - outputStream is the live HTTP response body, owned by
            // ASP.NET Core. ZipArchive must NOT close it when the archive is disposed.
            using var archive = new ZipArchive(outputStream, ZipArchiveMode.Create, leaveOpen: true);
            await AddFolderToZipStreamed(archive, folder.FolderPath, folder.FolderName);
        }

        // File types that are already compressed (images, video, office docs, pdfs,
        // archives). Re-compressing them inside the zip burns CPU for essentially no
        // size reduction, so they're stored instead of deflated.
        private static readonly HashSet<string> _alreadyCompressedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".zip", ".rar", ".7z", ".gz",
            ".jpg", ".jpeg", ".png", ".gif", ".webp",
            ".mp4", ".mov", ".avi", ".mp3",
            ".pdf", ".docx", ".xlsx", ".pptx"
        };

        private async Task AddFolderToZipStreamed(ZipArchive archive, string folderPath, string folderName)
        {
            var files = Directory.GetFiles(folderPath);
            foreach (var file in files)
            {
                try
                {
                    string entryName = Path.Combine(folderName, Path.GetFileName(file)).Replace('\\', '/');
                    var level = _alreadyCompressedExtensions.Contains(Path.GetExtension(file))
                        ? CompressionLevel.NoCompression
                        : CompressionLevel.Fastest;

                    var entry = archive.CreateEntry(entryName, level);

                    using var entryStream = entry.Open();
                    using var sourceStream = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.Read,
                        bufferSize: 81920, useAsync: true);
                    await sourceStream.CopyToAsync(entryStream);
                }
                catch (Exception ex)
                {
                    // Don't let one unreadable/locked file abort the whole archive -
                    // skip it and keep going so the user still gets everything else.
                    Log.Error("System", $"Skipped file '{file}' while zipping folder '{folderName}': {ex.Message}", "Download Folder Log");
                }
            }

            var subdirectories = Directory.GetDirectories(folderPath);
            foreach (var subdirectory in subdirectories)
            {
                string subFolderName = Path.Combine(folderName, Path.GetFileName(subdirectory)).Replace('\\', '/');
                archive.CreateEntry(subFolderName + "/");
                await AddFolderToZipStreamed(archive, subdirectory, subFolderName);
            }
        }

        public async Task<string> DeleteFolder(FolderDeleteDTO input)
        {
            try
            {
                // Retrieve the folder from the database
                var folder = await _dbContext.FolderData
                  .FirstOrDefaultAsync(f => f.FolderId == input.FolderId);

                if (folder == null)
                {
                    throw new Exception($"Folder with ID '{input.FolderId}' not found.");
                }
                var files = await _dbContext.FileData
              .Where(f => f.FolderId == input.FolderId).ToListAsync();
                if (files != null)
                {
                    _dbContext.RemoveRange(files);
                }


                // Log the deletion (if needed)
                // LogDeletion(input.DeletedBy, folder.FolderId, folder.FolderName);

                // Delete all subfolders recursively
                await DeleteSubfolders(folder);


                // Remove share access records related to the subfolder
                var shareAccessRecords = await _dbContext.ShareDocAccess
                    .Where(s => s.FolderOrFileId == input.FolderId && s.DocType == "Folder")
                    .ToListAsync();

                if (shareAccessRecords.Count > 0)
                {
                    _dbContext.ShareDocAccess.RemoveRange(shareAccessRecords);
                }

                var externalShareAccessRecords = await _dbContext.ExternalShareAccessHistory
                    .Where(s => s.FolderOrFileId == input.FolderId && s.DocType == "Folder")
                    .ToListAsync();

                if (externalShareAccessRecords.Count > 0)
                {
                    _dbContext.ExternalShareAccessHistory.RemoveRange(externalShareAccessRecords);
                }

                // Remove folder from the file system
                if (Directory.Exists(folder.FolderPath))
                {
                    Directory.Delete(folder.FolderPath, true); // True to delete recursively
                }
                Log.DataLog(input?.DeletedBy, $"Folder '{folder.FolderName}' (ID: {folder.FolderId}) successfully deleted by user '{input.DeletedBy}'", "Folder Log");
                // Remove folder from the database
                _dbContext.FolderData.Remove(folder);

                await _dbContext.SaveChangesAsync();

                return "Successfully Deleted the Folder.";
            }
            catch (Exception ex)
            {
                Log.Error(input?.DeletedBy, $"Folder deletion failed for folder ID '{input.FolderId}'. Error: {ex.Message}", "Folder Error Log");

                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<string> DeleteSubFolder(SubFolderDeleteDTO input)
        {
            try
            {
                // Retrieve the folder to be deleted from the database
                var folder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.FolderId);

                if (folder == null)
                {
                    throw new Exception("Folder does not exist.");
                }

                // Recursively delete subfolders and associated files
                await DeleteSubfolders(folder);

                // Remove folder from the file system
                if (Directory.Exists(folder.FolderPath))
                {
                    Directory.Delete(folder.FolderPath, true); // True to delete recursively
                }

                Log.DataLog(input?.DeletedBy, $"Folder '{folder.FolderName}' (ID: {folder.FolderId}) successfully deleted by user '{input.DeletedBy}'", "SubFolder Log");
                _dbContext.FolderData.Remove(folder);
                await _dbContext.SaveChangesAsync();

                return "Folder deleted successfully.";
            }
            catch (Exception ex)
            {
                Log.Error(input?.DeletedBy, $"Folder deletion failed for folder ID '{input?.FolderId}'. Error: {ex.Message}", "SubFolder Error Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        private async Task DeleteSubfolders(FolderData folder)
        {
            // Retrieve all subfolders
            var subfolders = await _dbContext.FolderData
                .Where(f => f.ParentFolderId == folder.FolderId)
                .ToListAsync();

            foreach (var subfolder in subfolders)
            {
                // Recursively delete subfolders
                await DeleteSubfolders(subfolder);

                // Remove associated file records from the database
                var filesInFolder = await _dbContext.FileData
                    .Where(f => f.FolderId == subfolder.FolderId)
                    .ToListAsync();

                if (filesInFolder.Count > 0)
                {
                    _dbContext.FileData.RemoveRange(filesInFolder);
                }

                // Remove share access records related to the subfolder
                var shareAccessRecords = await _dbContext.ShareDocAccess
                    .Where(s => s.FileExistFolId == subfolder.FolderId)
                    .ToListAsync();

                if (shareAccessRecords.Count > 0)
                {
                    _dbContext.ShareDocAccess.RemoveRange(shareAccessRecords);
                }

                var externalShareAccessRecords = await _dbContext.ExternalShareAccessHistory
                   .Where(s => s.FileExistFolId == subfolder.FolderId)
                   .ToListAsync();

                if (externalShareAccessRecords.Count > 0)
                {
                    _dbContext.ExternalShareAccessHistory.RemoveRange(externalShareAccessRecords);
                }

                // Delete subfolder from the file system
                if (Directory.Exists(subfolder.FolderPath))
                {
                    Directory.Delete(subfolder.FolderPath, true); // True to delete recursively
                }

                // Remove subfolder record from the database
                _dbContext.FolderData.Remove(subfolder);
            }
        }


        #endregion


        #region  FileDataServices

        public async Task<List<FileData>> GetAllFilesByFolderId(int folderId)
        {
            try
            {
                var files = await _dbContext.FileData.AsNoTracking()
                    .Where(f => f.FolderId == folderId && f.IsActive) // Optionally filter by IsActive
                    .ToListAsync();

                return files;
            }
            catch (Exception ex)
            {
                // Log exception if needed
                throw new Exception(ex.Message ?? "Network Error");
            }
        }


        public async Task<List<FileDataDTO>> GetFilesByFolderId(int folderId)
        {
            try
            {
                var files = await _dbContext.FileData.AsNoTracking()
                    .Where(f => f.FolderId == folderId && f.IsActive) // You can filter by IsActive if needed
                    .Select(f => new FileDataDTO
                    {
                        FileId = f.FileId,
                        FileName = f.FileName,
                        FilePath = f.FilePath,
                        ServerFilePath = f.ServerFilePath,
                        Size = f.Size,
                        IsActive = f.IsActive,
                        //IsView = f.IsView,
                    })
                    .ToListAsync();

                return files;
            }
            catch (Exception ex)
            {
                // Log exception if needed
                throw new Exception(ex.Message ?? "Network Error");
            }
        }


        public async Task<string> CreateFile(CreateFileDataDTO input)
        {
            try
            {
                // Get the base folder path from configuration
                string baseFolderPath = _configuration["BaseFolderPath"];
                var filesize = input.File.Length;
                // Get owner ID if provided
                string? owner = null;
                if (input.CreatedBy != null)
                {
                    owner = await GetEmployeeIdAsync(input.CreatedBy);
                }

                // Validate user ID
                Guid UserId;
                if (!Guid.TryParse(input.CreatedBy, out UserId))
                {
                    throw new Exception("Invalid user ID.");
                }

                // Check if user exists
                var userExists = await _dbContext.Users
                        .AnyAsync(u => u.UserID == UserId && u.IsActive);

                if (!userExists)
                {
                    throw new Exception($"User with ID '{input.CreatedBy}' does not exist.");
                }

                // Create user-specific folder path based on user's ID
                string userFolderPath = Path.Combine(baseFolderPath, UserId.ToString());

                // Create user folder if it doesn't exist
                if (!Directory.Exists(userFolderPath))
                {
                    Directory.CreateDirectory(userFolderPath);
                }

                // Retrieve the folder from the database
                var folder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.FolderId);


                // Ensure the folder path exists
                string folderPath;
                if (folder != null)
                {
                    folderPath = folder.FolderPath;
                    if (!Directory.Exists(folderPath))
                    {
                        throw new DirectoryNotFoundException($"The specified folder path '{folderPath}' does not exist.");
                    }
                }
                else if (input.FolderId == 0)
                {
                    folderPath = userFolderPath;
                }
                else
                {
                    throw new ArgumentException("The specified folder does not exist.", nameof(input.FolderId));
                }

                // Generate a unique file name if a file with the same name already exists
                string fileName = Path.GetFileNameWithoutExtension(input.File.FileName);
                string fileExtension = Path.GetExtension(input.File.FileName);
                string uniqueFileName = fileName;
                string filePath = Path.Combine(folderPath, uniqueFileName + fileExtension);

                // Check if the file already exists and generate a unique file name
                int counter = 1;
                while (File.Exists(filePath))
                {
                    uniqueFileName = $"{fileName}({counter})";
                    filePath = Path.Combine(folderPath, uniqueFileName + fileExtension);
                    counter++;
                }

                // Save the file to the folder
                using (var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None, bufferSize: 81920, useAsync: true))
                {
                    await input.File.CopyToAsync(stream);
                }

                // Get the server path for the file
                string portalAddress = _configuration["ApiURL"];
                string dbRmPath = filePath.Substring(baseFolderPath.Length).TrimStart(Path.DirectorySeparatorChar);
                string serverFilePath = portalAddress + "/StaticFiles/" + dbRmPath;

                // Create a FileData entity to store in the database
                var fileData = new FileData
                {
                    FolderId = input.FolderId,
                    FileName = uniqueFileName + fileExtension,
                    FilePath = filePath,
                    ServerFilePath = serverFilePath,
                    Owner = owner,
                    Size = input.File.Length,
                    AccessCount = 0,
                    IsActive = true,
                    CreatedOn = DateTime.Now,
                    CreatedBy = input.CreatedBy,
                    IsView = false,
                };
                Log.DataLog(input?.CreatedBy, $"{input.CreatedBy} successfully uploaded file '{fileData.FileName}' to folder ID {input.FolderId}", "File Log");
                // Add to context and save changes to the database
                _dbContext.FileData.Add(fileData);
                await _dbContext.SaveChangesAsync();

                // NEW (this change): bump the owning folder's version since its contents changed,
                // and record the upload as an "Edit" for the Employee-wise Folder Access report.
                if (folder != null)
                {
                    await _reportService.AddFolderVersionAsync(folder, "FileAdded", input.CreatedBy,
                        $"File '{fileData.FileName}' added", fileData.FileName);
                }
                await _reportService.LogFolderAccessAsync(input.FolderId, "Folder", folder?.FolderName, input.CreatedBy, "Edit");

                return "File uploaded successfully";
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"File upload failed for user '{input.CreatedBy}'. Error: {ex.Message}", "File Error Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<string> CreateFiles(CreateFilesDataDTO input)
        {
            try
            {
                string baseFolderPath = _configuration["BaseFolderPath"];

                var filesize = input.Files.Sum(x => x.Length);
                var usedstorage = await _dbContext.UserStorage.AsNoTracking().Where(x => x.UserId.ToLower() == input.CreatedBy.ToLower()).FirstOrDefaultAsync();
                if (usedstorage != null)
                {
                    if (usedstorage.MaximumAllocatedStorage <= usedstorage.UsedStorage + filesize)
                    {
                        throw new Exception("There is no storage to save these files");
                    }
                }

                string? owner = null;
                if (input.CreatedBy != null)
                {
                    owner = await GetEmployeeIdAsync(input.CreatedBy);
                }
                // Validate user ID
                Guid UserId;
                if (!Guid.TryParse(input.CreatedBy, out UserId))
                {
                    throw new Exception("Invalid user ID.");
                }

                // Check if user exists
                var userExists = await _dbContext.Users
                        .AnyAsync(u => u.UserID == UserId && u.IsActive);

                if (!userExists)
                {
                    throw new Exception($"User with ID '{input.CreatedBy}' does not exist.");
                }

                // Create user-specific folder path based on user's ID
                string userFolderPath = Path.Combine(baseFolderPath, UserId.ToString());

                // Create user folder if it doesn't exist
                if (!Directory.Exists(userFolderPath))
                {
                    Directory.CreateDirectory(userFolderPath);
                }

                // Retrieve the folder from the database
                var folder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.FolderId);

                // Ensure the folder path exists
                string folderPath;
                if (folder != null)
                {
                    folderPath = folder.FolderPath;
                    if (!Directory.Exists(folderPath))
                    {
                        throw new DirectoryNotFoundException($"The specified folder path '{folderPath}' does not exist.");
                    }
                }
                else if (input.FolderId == 0)
                {
                    folderPath = userFolderPath;
                }
                else
                {
                    throw new ArgumentException("The specified folder does not exist.", nameof(input.FolderId));
                }

                foreach (var file in input.Files)
                {
                    // Prepare the file name and path
                    string fileName = Path.GetFileNameWithoutExtension(file.FileName);
                    string fileExtension = Path.GetExtension(file.FileName);
                    string uniqueFileName = fileName;
                    string filePath = Path.Combine(folderPath, uniqueFileName + fileExtension);

                    // Check if the file already exists and generate a unique file name
                    int counter = 1;
                    while (File.Exists(filePath))
                    {
                        uniqueFileName = $"{fileName}({counter})";
                        filePath = Path.Combine(folderPath, uniqueFileName + fileExtension);
                        counter++;
                    }

                    // Save the file to the folder
                    using (var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None, bufferSize: 81920, useAsync: true))
                    {
                        await file.CopyToAsync(stream);
                    }

                    // Get the server path for the file
                    string portalAddress = _configuration["ApiURL"];
                    string dbRmPath = filePath.Substring(baseFolderPath.Length).TrimStart(Path.DirectorySeparatorChar);
                    string serverFilePath = portalAddress + "/StaticFiles/" + dbRmPath;

                    // Create a FileData entity to store in the database
                    var fileData = new FileData
                    {
                        FolderId = input.FolderId,
                        FileName = uniqueFileName + fileExtension,
                        FilePath = filePath,
                        ServerFilePath = serverFilePath,
                        Owner = owner,
                        Size = file.Length,
                        AccessCount = 0,
                        IsActive = true,
                        CreatedOn = DateTime.Now,
                        CreatedBy = input.CreatedBy,
                        IsView = false,
                    };

                    // Add to context and save changes to the database
                    _dbContext.FileData.Add(fileData);
                    Log.DataLog(input?.CreatedBy, $"{input.Files.Count} file uploaded successfully to the folder id {input.FolderId}", "File Log");
                }

                // Save all changes to the database
                await _dbContext.SaveChangesAsync();

                // NEW (this change): one version bump for the whole batch (not per file), and one
                // "Edit" access entry for the report (de-duped by LogFolderAccessAsync already).
                if (folder != null)
                {
                    string uploadedNames = string.Join(", ", input.Files.Select(f => f.FileName));
                    await _reportService.AddFolderVersionAsync(folder, "FileAdded", input.CreatedBy,
                        $"{input.Files.Count} file(s) added", uploadedNames);
                }
                await _reportService.LogFolderAccessAsync(input.FolderId, "Folder", folder?.FolderName, input.CreatedBy, "Edit");

                return "Files uploaded successfully";
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"File upload failed. Error: {ex.Message}", "File Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }
        //not using


        public async Task<string> CreateFilesBeHalf(CreateFilesBehalfDataDTO input)
        {
            try
            {
                string baseFolderPath = _configuration["BaseFolderPath"];

                var filesize = input.Files.Sum(x => x.Length);
                var usedstorage = await _dbContext.UserStorage.AsNoTracking().Where(x => x.UserId.ToLower() == input.StoregeUserId.ToLower()).FirstOrDefaultAsync();
                if (usedstorage != null)
                {
                    if (usedstorage.MaximumAllocatedStorage <= usedstorage.UsedStorage + filesize)
                    {
                        throw new Exception("There is no storage to save these files");
                    }
                }

                string? owner = null;
                if (input.CreatedBy != null)
                {
                    owner = await GetEmployeeIdAsync(input.CreatedBy);
                }
                // Validate user ID
                Guid UserId;
                if (!Guid.TryParse(input.StoregeUserId, out UserId))
                {
                    throw new Exception("Invalid user ID.");
                }

                // Check if user exists
                var userExists = await _dbContext.Users
                        .AnyAsync(u => u.UserID == UserId && u.IsActive);

                if (!userExists)
                {
                    throw new Exception($"User with ID '{UserId}' does not exist.");
                }

                // Create user-specific folder path based on user's ID
                string userFolderPath = Path.Combine(baseFolderPath, UserId.ToString());

                // Create user folder if it doesn't exist
                if (!Directory.Exists(userFolderPath))
                {
                    Directory.CreateDirectory(userFolderPath);
                }

                // Retrieve the folder from the database
                var folder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.FolderId);

                // Ensure the folder path exists
                string folderPath;
                if (folder != null)
                {
                    folderPath = folder.FolderPath;
                    if (!Directory.Exists(folderPath))
                    {
                        throw new DirectoryNotFoundException($"The specified folder path '{folderPath}' does not exist.");
                    }
                }
                else if (input.FolderId == 0)
                {
                    folderPath = userFolderPath;
                }
                else
                {
                    throw new ArgumentException("The specified folder does not exist.", nameof(input.FolderId));
                }

                foreach (var file in input.Files)
                {
                    // Prepare the file name and path
                    string fileName = Path.GetFileNameWithoutExtension(file.FileName);
                    string fileExtension = Path.GetExtension(file.FileName);
                    string uniqueFileName = fileName;
                    string filePath = Path.Combine(folderPath, uniqueFileName + fileExtension);

                    // Check if the file already exists and generate a unique file name
                    int counter = 1;
                    while (File.Exists(filePath))
                    {
                        uniqueFileName = $"{fileName}({counter})";
                        filePath = Path.Combine(folderPath, uniqueFileName + fileExtension);
                        counter++;
                    }

                    // Save the file to the folder
                    using (var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None, bufferSize: 81920, useAsync: true))
                    {
                        await file.CopyToAsync(stream);
                    }

                    // Get the server path for the file
                    string portalAddress = _configuration["ApiURL"];
                    string dbRmPath = filePath.Substring(baseFolderPath.Length).TrimStart(Path.DirectorySeparatorChar);
                    string serverFilePath = portalAddress + "/StaticFiles/" + dbRmPath;

                    // Create a FileData entity to store in the database
                    var fileData = new FileData
                    {
                        FolderId = input.FolderId,
                        FileName = uniqueFileName + fileExtension,
                        FilePath = filePath,
                        ServerFilePath = serverFilePath,
                        Owner = owner,
                        Size = file.Length,
                        AccessCount = 0,
                        IsActive = true,
                        CreatedOn = DateTime.Now,
                        CreatedBy = input.StoregeUserId,
                        IsView = false,
                    };

                    // Add to context and save changes to the database
                    _dbContext.FileData.Add(fileData);
                    Log.DataLog(input?.CreatedBy, $"{input.Files.Count} file uploaded successfully to the folder id {input.FolderId}", "File Log");
                }

                // Save all changes to the database
                await _dbContext.SaveChangesAsync();

                // NEW (this change): one version bump for the whole batch, and one "Edit" access entry.
                if (folder != null)
                {
                    string uploadedNames = string.Join(", ", input.Files.Select(f => f.FileName));
                    await _reportService.AddFolderVersionAsync(folder, "FileAdded", input.CreatedBy,
                        $"{input.Files.Count} file(s) added on behalf of user", uploadedNames);
                }
                await _reportService.LogFolderAccessAsync(input.FolderId, "Folder", folder?.FolderName, input.CreatedBy, "Edit");

                // NEW (this change): notify the original shared-folder owner (StoregeUserId) that
                // input.CreatedBy uploaded these files on their behalf.
                var (ownerEmail, ownerName) = await GetUserNotifyDetailsAsync(input.StoregeUserId);
                if (!string.IsNullOrEmpty(ownerEmail))
                {
                    var (_, actingUserName) = await GetUserNotifyDetailsAsync(input.CreatedBy);
                    string uploadedFileNames = string.Join(", ", input.Files.Select(f => f.FileName));
                    await _emailService.SendBehalfActionNotificationMail(
                        ownerEmail, ownerName, actingUserName ?? input.CreatedBy, uploadedFileNames, "File", "Uploaded", folder?.FolderName);
                }

                return "Files uploaded successfully";
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"File upload failed. Error: {ex.Message}", "File Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }


        public async Task<string> UpdateFile(UpdateFileDataDTO input)
        {
            try
            {
                // Retrieve the existing file data from the database
                var existingFile = await _dbContext.FileData
                    .FirstOrDefaultAsync(f => f.FileId == input.FileId);

                if (existingFile == null)
                {
                    throw new Exception("File does not exist.");
                }

                // Check if the folder exists
                var folder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.FolderId);

                if (folder == null)
                {
                    throw new Exception("The specified folder does not exist.");
                }

                string baseFolderPath = _configuration["BaseFolderPath"];
                string fileExtension = Path.GetExtension(input.File.FileName);
                string currentFilePath = existingFile.FilePath;
                string newFilePath = Path.Combine(folder.FolderPath, input.FileName, fileExtension);

                // Rename the file if the name or path has changed
                if (existingFile.FileName != input.FileName || existingFile.FolderId != input.FolderId)
                {
                    if (File.Exists(currentFilePath))
                    {
                        // Rename the file if the name has changed
                        if (File.Exists(newFilePath))
                        {
                            throw new Exception("A file with the new name already exists.");
                        }

                        // Move the file to the new location
                        File.Move(currentFilePath, newFilePath);
                    }
                    else
                    {
                        throw new Exception("Current file path does not exist.");
                    }
                }
                else
                {
                    // Ensure the new file path is correct
                    newFilePath = currentFilePath;
                }

                // Save the uploaded file if it has been provided
                if (input.File != null && input.File.Length > 0)
                {
                    using (var stream = new FileStream(newFilePath, FileMode.Create))
                    {
                        await input.File.CopyToAsync(stream);
                    }
                }

                // Construct the URL path for the file
                string portalAddress = _configuration["ApiURL"];
                string dbRmPath = newFilePath.Substring(baseFolderPath.Length).TrimStart(Path.DirectorySeparatorChar);
                string serverFilePath = portalAddress + "/StaticFiles/" + dbRmPath;
                Log.DataLog(input?.CreatedBy,
                    $"Existing folder id {existingFile.FolderId} changed to {input.FolderId} and the existing file {existingFile.FileName} changed to {input.FileName} ", "File Log");

                // Update the file data entity
                existingFile.FolderId = input.FolderId;
                existingFile.FileName = input.FileName;
                existingFile.FilePath = newFilePath;
                existingFile.ServerFilePath = serverFilePath;
                existingFile.ModifiedOn = DateTime.Now;
                existingFile.ModifiedBy = input.CreatedBy;

                // Save changes to the database
                _dbContext.FileData.Update(existingFile);

                // NEW (this change): bump the owning folder's version, saved together with the update above.
                await _reportService.AddFolderVersionAsync(folder, "FileUpdated", input.CreatedBy,
                    $"File '{existingFile.FileName}' updated", existingFile.FileName, saveChanges: false);

                await _dbContext.SaveChangesAsync();

                // NEW (this change): record this as an "Edit" for the Employee-wise Folder Access report.
                await _reportService.LogFolderAccessAsync(input.FolderId, "Folder", folder.FolderName, input.CreatedBy, "Edit");

                return "File updated successfully.";
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"File update failed for File ID '{input?.FileId}'. Error: {ex.Message}", "File Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<string> UpdateFileName(UpdateFileNameDataDTO input)
        {
            try
            {
                // Retrieve the existing file data from the database
                var existingFile = await _dbContext.FileData
                    .FirstOrDefaultAsync(f => f.FileId == input.FileId);

                if (existingFile == null)
                {
                    throw new Exception("File does not exist.");
                }

                // Check if the folder exists
                var folder = await _dbContext.FolderData
                    .FirstOrDefaultAsync(f => f.FolderId == input.FolderId);

                if (folder == null)
                {
                    throw new Exception("The specified folder does not exist.");
                }

                string baseFolderPath = _configuration["BaseFolderPath"];
                // Get the current file path and file extension
                string currentFilePath = existingFile.FilePath;
                string fileExtension = Path.GetExtension(currentFilePath);

                // Construct the new file path with the desired file name
                string newFilePath = Path.Combine(folder.FolderPath, input.FileName + fileExtension);
                string portalAddress = _configuration["ApiURL"];
                string dbRmPath = newFilePath.Substring(baseFolderPath.Length).TrimStart(Path.DirectorySeparatorChar);
                string serverFilePath = portalAddress + "/StaticFiles/" + dbRmPath;

                // Check if the new file path already exists
                if (File.Exists(newFilePath))
                {
                    throw new Exception("A file with the new name already exists in the destination folder.");
                }

                // Rename the file by moving it to the new location
                File.Move(currentFilePath, newFilePath);

                // Update the file data entity in the database
                existingFile.FileName = input.FileName;
                existingFile.FilePath = newFilePath;
                existingFile.ServerFilePath = serverFilePath;
                existingFile.ModifiedOn = DateTime.Now;
                existingFile.ModifiedBy = input.CreatedBy;
                Log.DataLog(input?.CreatedBy, $"File renamed from '{existingFile.FileName}' to '{input.FileName}'", "File Log");
                // Save changes to the database
                _dbContext.FileData.Update(existingFile);

                // NEW (this change): bump the owning folder's version, saved together with the update above.
                await _reportService.AddFolderVersionAsync(folder, "FileRenamed", input.CreatedBy,
                    $"File renamed to '{input.FileName}'", input.FileName, saveChanges: false);

                await _dbContext.SaveChangesAsync();

                // NEW (this change): record this as an "Edit" for the Employee-wise Folder Access report.
                await _reportService.LogFolderAccessAsync(input.FolderId, "Folder", folder.FolderName, input.CreatedBy, "Edit");

                return "File renamed successfully.";
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"File rename operation failed for File ID '{input?.FileId}'. Error: {ex.Message}", "File Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<IActionResult> DownloadFile(int fileId)
        {
            try
            {
                // Retrieve the file data from the database
                var fileData = await _dbContext.FileData.AsNoTracking()
                    .FirstOrDefaultAsync(f => f.FileId == fileId);

                if (fileData == null)
                {
                    return new NotFoundResult(); // File not found
                }

                // Check if the file exists on the server
                if (!System.IO.File.Exists(fileData.FilePath))
                {
                    return new NotFoundResult(); // File does not exist on the server
                }

                // NEW (this change): record the download for the Employee-wise Folder Access report.
                // Same CreatedBy-attribution note as GetFolderForDownloadAsync above.
                await _reportService.LogFolderAccessAsync(fileData.FileId, "Document", fileData.FileName, fileData.CreatedBy, "Download");

                // Stream the file instead of buffering the whole thing in memory first.
                var fileStream = new FileStream(fileData.FilePath, FileMode.Open, FileAccess.Read, FileShare.Read, bufferSize: 81920, options: FileOptions.Asynchronous);
                return new FileStreamResult(fileStream, "application/octet-stream")
                {
                    FileDownloadName = fileData.FileName
                };
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }

        }

        public async Task<string> DeleteFile(int fileId)
        {
            try
            {
                // Retrieve the file data from the database
                var file = await _dbContext.FileData
                    .FirstOrDefaultAsync(f => f.FileId == fileId);

                if (file == null)
                {
                    throw new Exception("File does not exist.");
                }

                // Remove associated access records from ShareDocAccess
                var shareDocAccessRecords = await _dbContext.ShareDocAccess
                    .Where(s => s.FolderOrFileId == fileId && s.DocType == "Document")
                    .ToListAsync();

                if (shareDocAccessRecords.Any())
                {
                    _dbContext.ShareDocAccess.RemoveRange(shareDocAccessRecords);
                }

                // Delete the file from the file system
                if (File.Exists(file.FilePath))
                {
                    File.Delete(file.FilePath);
                }
                else
                {
                    throw new Exception("File does not exist on the file system.");
                }

                var oldVersions = await _dbContext.FileVersions.Where(v => v.FileId == fileId).ToListAsync();
                if (oldVersions.Any())
                {
                    _dbContext.FileVersions.RemoveRange(oldVersions);
                    var vDir = Path.Combine(_configuration["BaseFolderPath"], "_FileVersions", fileId.ToString());
                    if (Directory.Exists(vDir)) Directory.Delete(vDir, true);
                }

                Log.DataLog(file.CreatedBy, $"File '{file.FileName}' with ID {fileId} was successfully deleted", "File Log");
                _dbContext.FileData.Remove(file);
                await _dbContext.SaveChangesAsync();

                return "File deleted successfully.";
            }
            catch (Exception ex)
            {
                Log.Error("System", $"DeleteFile operation failed for File ID: {fileId}. Error: {ex.Message}", "File Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        #endregion


        #region ShareAccessData Service

        public async Task<IEnumerable<ShareDocAccess>> GetShareAccessByUserId(Guid accessUserId)
        {
            try
            {
                var shareAccessRecords = await _dbContext.ShareDocAccess.AsNoTracking()
                    .Where(s => s.AccessUserId == accessUserId)
                    .ToListAsync();

                return shareAccessRecords;
            }
            catch (Exception ex)
            {
                // Handle or log the exception as needed
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<IEnumerable<ShareDocAccessViewData>> GetShareAccessDetailsByUser(Guid accessUserId)
        {
            try
            {
                // Fetch ShareDocAccess records based on AccessUserId
                var shareAccessRecords = await _dbContext.ShareDocAccess.AsNoTracking()
                    .Where(s => s.AccessUserId == accessUserId)
                    .Select(s => new ShareDocAccessViewData

                    {
                        SDAId = s.SDAId,
                        FolderOrFileId = s.FolderOrFileId,
                        DocType = s.DocType,
                        FileExistFolId = s.FileExistFolId,
                        AccessType = s.AccessType,
                        PermissionLevel = s.PermissionLevel,
                        IsExpiryDate = s.IsExpiryDate,
                        ExpiryDate = s.ExpiryDate,
                        IsEncryptionKey = s.IsEncryptionKey,
                        EncryptionKey = s.EncryptionKey,
                        IsActive = s.IsActive,
                        CreatedOn = s.CreatedOn,
                        CreatedBy = s.CreatedBy,
                        IsView = s.IsView,
                        HideBy = s.HideBy,
                        IsHide = s.IsHide,





                    })
                    .ToListAsync();

                // Enhance each record with FolderData or FileData
                foreach (var record in shareAccessRecords)
                {
                    if (record.DocType == "Folder")
                    {
                        var folders = await _dbContext.FolderData.AsNoTracking().ToListAsync();
                        var filedata = await _dbContext.FileData.AsNoTracking().ToListAsync();

                        var folder = folders.FirstOrDefault(f => f.FolderId == record.FolderOrFileId);
                        var parentfolder = folders.Where(f => f.ParentFolderId == record.FolderOrFileId).ToList();
                        var SUBFOLDER = parentfolder.Select(X => X.FolderId).ToList();
                        var SUBFOLDERSIZE = filedata.Where(X => SUBFOLDER.Contains(X.FolderId)).Sum(X => X.Size);

                        if (folder != null)
                        {
                            record.FoldeOrFileName = folder.FolderName;
                            record.FolderOrFilePath = folder.FolderPath;
                            record.ServerFolderOrFilePath = folder.ServerFolderPath;
                            record.FolderColor = folder.FolderColor;

                            record.ParentFolderCount = folders.Count(x => x.FolderId == record.FolderOrFileId);
                            record.ParentFolderFilesCount = filedata.Count(x => x.FolderId == record.FolderOrFileId);
                            record.ParentFolderSize = filedata.Where(x => x.FolderId == record.FolderOrFileId).Sum(X => X.Size) + SUBFOLDERSIZE;
                            // ✅ Fetch all recursive subfolders
                            var allSubFolderIds = GetAllDescendantFolderIds(folders, folder.FolderId);
                            record.SubFolderCount = parentfolder.Count;

                            if (record.SubFolderFilesCount == null)
                                record.SubFolderFilesCount = new List<string>();

                            foreach (var subFolderId in allSubFolderIds)
                            {
                                var count = filedata.Count(x => x.FolderId == subFolderId);
                                var subcount = folders.Count(x => x.ParentFolderId == subFolderId);

                                record.SubFolderFilesCount.Add($"FolderId: {subFolderId}, SubFoldersCount :{subcount} FilesCount: {count}");
                            }
                            if (folder.FolderName != null)
                            {
                                var checkempinfo = await _dbContext.EmpInfos.AsNoTracking().Where(x => x.EmpId == accessUserId).FirstOrDefaultAsync();
                                if (checkempinfo != null)
                                {
                                    Log.DataLog($"{checkempinfo.EmpId} and UserName : {checkempinfo.FirstName} {checkempinfo.LastName}", $"Accessed Folder {folder.FolderName}", "Accessed Folder Log");
                                }
                                else
                                {
                                    Log.DataLog($"{accessUserId.ToString()} and UserName : {accessUserId.ToString()}", $"Accessed Folder {folder.FolderName}", "Accessed Folder Log");

                                    //Log.DataLog(accessUserId.ToString(), $"Accessed Folder {folder.FolderName}", "Accessed Folder Log");
                                }

                            }
                        }
                    }
                    else if (record.DocType == "Document")
                    {
                        var file = await _dbContext.FileData.AsNoTracking().FirstOrDefaultAsync(f => f.FileId == record.FolderOrFileId);
                        if (file != null)
                        {
                            record.FoldeOrFileName = file.FileName;
                            record.FolderOrFilePath = file.FilePath;
                            record.ServerFolderOrFilePath = file.ServerFilePath;
                            record.Size = file.Size;
                        }
                    }
                }


                return shareAccessRecords;
            }
            catch (Exception ex)
            {
                // Handle or log the exception as needed
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        // Place this helper function inside the same class
        private List<int> GetAllDescendantFolderIds(List<FolderData> allFolders, int parentFolderId)
        {
            var descendantIds = new List<int>();
            var directChildren = allFolders.Where(f => f.ParentFolderId == parentFolderId).ToList();

            foreach (var child in directChildren)
            {
                descendantIds.Add(child.FolderId);
                descendantIds.AddRange(GetAllDescendantFolderIds(allFolders, child.FolderId));
            }

            return descendantIds;
        }

        public async Task<IEnumerable<ShareDocAccessViewData>> GetShareAccessDetails(int folderOrFileId, string docType)
        {
            try
            {
                var query = _dbContext.ShareDocAccess.AsNoTracking()
                    .Where(s => s.FolderOrFileId == folderOrFileId && s.DocType == docType)
                    .Select(s => new ShareDocAccessViewData
                    {
                        SDAId = s.SDAId,
                        FolderOrFileId = s.FolderOrFileId,
                        DocType = s.DocType,
                        FileExistFolId = s.FileExistFolId,
                        AccessType = s.AccessType,
                        PermissionLevel = s.PermissionLevel,
                        IsExpiryDate = s.IsExpiryDate,
                        ExpiryDate = s.ExpiryDate,
                        IsEncryptionKey = s.IsEncryptionKey,
                        EncryptionKey = s.EncryptionKey,
                        IsActive = s.IsActive,
                        CreatedOn = s.CreatedOn,
                        CreatedBy = s.CreatedBy
                    });

                var shareAccessRecords = await query.ToListAsync();

                foreach (var record in shareAccessRecords)
                {
                    if (record.DocType == "Folder")
                    {
                        var folder = await _dbContext.FolderData.AsNoTracking()
                            .FirstOrDefaultAsync(f => f.FolderId == record.FolderOrFileId);

                        if (folder != null)
                        {
                            record.FoldeOrFileName = folder.FolderName;
                            record.FolderOrFilePath = folder.FolderPath;
                            record.ServerFolderOrFilePath = folder.ServerFolderPath;
                        }
                    }
                    else if (record.DocType == "Document")
                    {
                        var file = await _dbContext.FileData.AsNoTracking()
                            .FirstOrDefaultAsync(f => f.FileId == record.FolderOrFileId);

                        if (file != null)
                        {
                            record.FoldeOrFileName = file.FileName;
                            record.FolderOrFilePath = file.FilePath;
                            record.ServerFolderOrFilePath = file.ServerFilePath;
                        }
                    }
                }

                return shareAccessRecords;
            }
            catch (Exception ex)
            {
                // Handle or log the exception as needed
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<string> CreateShareAccessByList(List<CreateShareDocAccessDTO> shareAccessList)
        {
            try
            {
                // Create a list to hold the ShareDocAccess entities
                var shareDocAccessList = new List<ShareDocAccess>();
                var foldername = "";
                var filename = "";
                var userid = "";
                var Receiverusername = "";
                var SharedUserName = "";


                foreach (var dto in shareAccessList)
                {
                    // Check if the user exists
                    //var userExists = await _dbContext.Users
                    //    .AnyAsync(u => u.UserID == dto.AccessUserId && u.IsActive);
                    //if (!userExists)
                    //{
                    //    throw new Exception($"User with ID '{dto.AccessUserId}' does not exist.");
                    //}
                    var sender = await _dbContext.EmpInfos
                        .Where(u => u.EmpId.ToString().ToLower() == dto.CreatedBy.ToLower() && u.IsActive)

                        .FirstOrDefaultAsync();
                    if (sender != null)
                    {
                        SharedUserName = $"{sender.FirstName} {sender.LastName}";
                    }

                    var user = await _dbContext.Users
                            .Where(u => u.UserID == dto.AccessUserId && u.IsActive)
                            .FirstOrDefaultAsync();

                    if (user == null)
                    {
                        throw new Exception($"User with ID '{dto.AccessUserId}' does not exist");
                    }
                    userid = user.UserID.ToString();
                    var receiver = await _dbContext.EmpInfos
                            .Where(u => u.EmpId == dto.AccessUserId && u.IsActive)
                            .FirstOrDefaultAsync();
                    if (receiver != null)
                    {
                        Receiverusername = $"{receiver.FirstName} {receiver.LastName}";
                    }


                    // Validate based on DocType
                    if (dto.DocType == "Folder")
                    {
                        // Check if the folder exists
                        //var folderExists = await _dbContext.FolderData
                        //    .AnyAsync(f => f.FolderId == dto.FolderOrFileId);

                        //if (!folderExists)
                        //{
                        //    throw new Exception($"Folder with ID '{dto.FolderOrFileId}' does not exist.");
                        //}
                        var folder = await _dbContext.FolderData
                                        .Where(f => f.FolderId == dto.FolderOrFileId).FirstOrDefaultAsync();

                        if (folder == null)
                        {
                            throw new Exception($"Folder with ID '{dto.FolderOrFileId}' does not exist.");
                        }

                        foldername = folder.FolderName;
                    }
                    else if (dto.DocType == "Document")
                    {
                        // Check if the document exists
                        //var documentExists = await _dbContext.FileData
                        //    .AnyAsync(f => f.FileId == dto.FolderOrFileId); // Assuming FileId is used for documents

                        //if (!documentExists)
                        //{
                        //    throw new Exception($"Document with ID '{dto.FolderOrFileId}' does not exist.");
                        //}
                        var documentExists = await _dbContext.FileData
                          .Where(f => f.FileId == dto.FolderOrFileId).FirstOrDefaultAsync(); // Assuming FileId is used for documents

                        if (documentExists == null)
                        {
                            throw new Exception($"Document with ID '{dto.FolderOrFileId}' does not exist.");
                        }
                        filename = documentExists.FileName;
                    }
                    else
                    {
                        throw new Exception($"Invalid DocType '{dto.DocType}'.");
                    }

                    // Check if the same entry already exists in ShareDocAccess
                    var accessExists = await _dbContext.ShareDocAccess
                        .AnyAsync(s => s.FolderOrFileId == dto.FolderOrFileId &&
                                       s.DocType == dto.DocType &&
                                       s.AccessUserId == dto.AccessUserId);

                    if (accessExists)
                    {
                        throw new Exception($"Access already exists for DocType '{dto.DocType}' with ID '{dto.FolderOrFileId}' and User ID '{dto.AccessUserId}'.");
                    }

                    // Map DTO to ShareDocAccess entity
                    var shareDocAccess = new ShareDocAccess
                    {
                        FolderOrFileId = dto.FolderOrFileId,
                        DocType = dto.DocType,
                        FileExistFolId = dto.FileExistFolId,
                        AccessUserId = dto.AccessUserId,
                        AccessType = dto.AccessType,
                        IsExpiryDate = dto.IsExpiryDate,
                        ExpiryDate = dto.ExpiryDate,
                        IsEncryptionKey = dto.IsEncryptionKey,
                        EncryptionKey = dto.EncryptionKey,
                        IsActive = true,
                        CreatedOn = DateTime.Now,
                        CreatedBy = dto.CreatedBy,
                        IsView = false,
                    };

                    // Add entity to list
                    shareDocAccessList.Add(shareDocAccess);
                    if (shareDocAccess.DocType == "Folder")
                    {
                        Log.DataLog(dto.CreatedBy, $"Folder name {foldername} ~|~ was shared from the Shared user id {dto.CreatedBy} ~|~ Shared user name {SharedUserName} ~|~ to Access the Receiver UserId {dto.AccessUserId} ~|~ receiver user name {Receiverusername}", "Share Access Log");
                    }
                    if (shareDocAccess.DocType == "Document")
                    {
                        Log.DataLog(dto.CreatedBy, $"File name {foldername} ~|~ was shared from the Shared user id {dto.CreatedBy} ~|~ Shared user name {SharedUserName} ~|~ to Access the Receiver UserId {dto.AccessUserId} ~|~ receiver user name {Receiverusername}", "Share Access Log");

                    }
                }

                // Add all entities to the database
                await _dbContext.ShareDocAccess.AddRangeAsync(shareDocAccessList);
                await _dbContext.SaveChangesAsync();

                // NEW (this change): Ownership + Access History log - one entry per access grant.
                foreach (var granted in shareDocAccessList)
                {
                    await _reportService.LogOwnershipOrAccessAsync(granted.FolderOrFileId, granted.DocType, "AccessGranted",
                        null, null, granted.AccessUserId, granted.PermissionLevel, granted.CreatedBy, saveChanges: false);
                }
                await _dbContext.SaveChangesAsync();

                // NEW (this change): record each grant as a "Share" for the Employee-wise Folder
                // Access report, attributed to the person who performed the share.
                foreach (var granted in shareDocAccessList)
                {
                    await _reportService.LogFolderAccessAsync(granted.FolderOrFileId, granted.DocType,
                        granted.FolderOrFileName, granted.CreatedBy, "Share");
                }

                return "Document Was Shared SuccessFully.";
            }
            catch (Exception ex)
            {
                Log.Error("System", $"CreateShareAccessByList failed. Error: {ex.Message}", "Share Access Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }



        public async Task<string> UpdateShareAccessBySadID(UpdateShareDocAccessDTO updateDto)
        {
            try
            {
                // Check if the ShareDocAccess entry exists
                var existingShareAccess = await _dbContext.ShareDocAccess
                    .FirstOrDefaultAsync(s => s.SDAId == updateDto.SDAId);

                if (existingShareAccess == null)
                {
                    throw new Exception($"ShareDocAccess entry with ID '{updateDto.SDAId}' not found.");
                }

                // Validate user existence
                var userExists = await _dbContext.Users
                    .AnyAsync(u => u.UserID == updateDto.AccessUserId);

                if (!userExists)
                {
                    throw new Exception($"User with ID '{updateDto.AccessUserId}' does not exist.");
                }

                // Validate folder or document existence based on DocType
                if (updateDto.DocType == "Folder")
                {
                    // Check if the folder exists
                    var folderExists = await _dbContext.FolderData
                        .AnyAsync(f => f.FolderId == updateDto.FolderOrFileId);

                    if (!folderExists)
                    {
                        throw new Exception($"Folder with ID '{updateDto.FolderOrFileId}' does not exist.");
                    }
                }
                else if (updateDto.DocType == "Document")
                {
                    // Check if the document exists
                    var documentExists = await _dbContext.FileData
                        .AnyAsync(f => f.FileId == updateDto.FolderOrFileId); // Assuming FileId is used for documents

                    if (!documentExists)
                    {
                        throw new Exception($"Document with ID '{updateDto.FolderOrFileId}' does not exist.");
                    }
                }
                else
                {
                    throw new Exception($"Invalid DocType '{updateDto.DocType}'.");
                }

                // Update the existing ShareDocAccess entry
                existingShareAccess.FolderOrFileId = updateDto.FolderOrFileId;
                existingShareAccess.DocType = updateDto.DocType;
                existingShareAccess.FileExistFolId = updateDto.FileExistFolId;
                existingShareAccess.AccessUserId = updateDto.AccessUserId;
                existingShareAccess.AccessType = updateDto.AccessType;
                existingShareAccess.PermissionLevel = updateDto.PermissionLevel;
                existingShareAccess.IsExpiryDate = updateDto.IsExpiryDate;
                existingShareAccess.ExpiryDate = updateDto.ExpiryDate;
                existingShareAccess.IsEncryptionKey = updateDto.IsEncryptionKey;
                existingShareAccess.EncryptionKey = updateDto.EncryptionKey;
                existingShareAccess.ModifiedOn = DateTime.Now;
                existingShareAccess.ModifiedBy = updateDto.CreatedBy;


                Log.DataLog(updateDto.CreatedBy, $"{updateDto.CreatedBy} share access id {updateDto.SDAId} data updated successfully", "Share Access Log");
                // Save changes to the database
                _dbContext.ShareDocAccess.Update(existingShareAccess);

                // NEW (this change): Ownership + Access History log.
                await _reportService.LogOwnershipOrAccessAsync(existingShareAccess.FolderOrFileId, existingShareAccess.DocType, "AccessUpdated",
                    null, null, existingShareAccess.AccessUserId, existingShareAccess.PermissionLevel, updateDto.CreatedBy, saveChanges: false);

                await _dbContext.SaveChangesAsync();

                // NEW (this change): record this as a "Share" for the Employee-wise Folder Access report.
                await _reportService.LogFolderAccessAsync(existingShareAccess.FolderOrFileId, existingShareAccess.DocType,
                    existingShareAccess.FolderOrFileName, updateDto.CreatedBy, "Share");

                return "Shared Document Updated Successfully.";
            }
            catch (Exception ex)
            {
                Log.Error("System", $"Unable to update the share document accessid {updateDto.SDAId} due to the Error: {ex.Message}", "Share Access Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<string> CreateShareAccess(DocumentAccessCreateDTO createDto)
        {
            try
            {
                string portalAddress = _configuration["ApiURL"];
                string baseFolderPath = _configuration["BaseFolderPath"];
                string docName = "";
                string? owner = null;

                if (createDto.CreatedBy != null)
                {
                    owner = await GetEmployeeIdAsync(createDto.CreatedBy);
                }

                // Validate Folder or Document existence
                if (createDto.DocType == "Folder")
                {
                    var folderExists = await _dbContext.FolderData
                        .FirstOrDefaultAsync(f => f.FolderId == createDto.FolderOrFileId);


                    if (folderExists == null)
                    {
                        throw new Exception($"Folder with ID '{createDto.FolderOrFileId}' does not exist.");
                    }

                    docName = folderExists.FolderName;

                    // Create the shared folder path
                    string sharedFolderPath = Path.Combine(baseFolderPath, "SharedFoldersAndFiles", folderExists.FolderName);
                    if (!Directory.Exists(sharedFolderPath))
                    {
                        Directory.CreateDirectory(sharedFolderPath);
                    }

                    // Update the server folder path
                    string serverFolderPath = portalAddress + "/StaticFiles/" + sharedFolderPath.Substring(baseFolderPath.Length).TrimStart(Path.DirectorySeparatorChar);


                    // Create new ShareDocAccess entries for users
                    foreach (var userId in createDto.AccessUserId)
                    {
                        if (userId.Contains("@"))
                        {
                            var userEmailisExist = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == userId && u.IsActive);
                            if (userEmailisExist != null)
                            {
                                await ProcessInternalUserAccess(createDto, userEmailisExist.UserID.ToString(), folderExists, sharedFolderPath, serverFolderPath, owner, docName);
                            }
                            else
                            {
                                await ProcessExternalUserAccess(createDto, userId, folderExists, sharedFolderPath, serverFolderPath, owner, docName);
                            }
                        }
                        else
                        {
                            await ProcessInternalUserAccess(createDto, userId, folderExists, sharedFolderPath, serverFolderPath, owner, docName);
                        }
                        // Log.DataLog(createDto.CreatedBy, $"Folder od file name {docName} has shared to {createDto.AccessUserId}", "ShareAccess Log");
                    }

                }
                else if (createDto.DocType == "Document")
                {
                    var documentExists = await _dbContext.FileData
                        .FirstOrDefaultAsync(f => f.FileId == createDto.FolderOrFileId);

                    if (documentExists == null)
                    {
                        throw new Exception($"Document with ID '{createDto.FolderOrFileId}' does not exist.");
                    }

                    docName = documentExists.FileName;

                    string sharedFolderPath = Path.Combine(baseFolderPath, "SharedFoldersAndFiles");

                    // Create the shared file path
                    string sharedFilePath = Path.Combine(sharedFolderPath, docName);

                    // Create the shared folder if it doesn't exist
                    if (!Directory.Exists(sharedFolderPath))
                    {
                        Directory.CreateDirectory(sharedFolderPath);
                    }

                    // Copy the file to the shared folder if it doesn't exist
                    if (!File.Exists(sharedFilePath))
                    {
                        File.Copy(documentExists.FilePath, sharedFilePath);
                    }

                    // Update the server file path
                    string serverFilePath = portalAddress + "/StaticFiles/" + sharedFilePath.Substring(baseFolderPath.Length).TrimStart(Path.DirectorySeparatorChar);

                    // Create new ShareDocAccess entries for users
                    foreach (var userId in createDto.AccessUserId)
                    {
                        if (userId.Contains("@"))
                        {
                            var userEmailisExist = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == userId && u.IsActive);
                            if (userEmailisExist != null)
                            {
                                await ProcessInternalUserAccess(createDto, userEmailisExist.UserID.ToString(), documentExists, sharedFilePath, serverFilePath, owner, docName);
                            }
                            else
                            {
                                await ProcessExternalUserAccess(createDto, userId, documentExists, sharedFilePath, serverFilePath, owner, docName);
                            }
                        }
                        else
                        {
                            await ProcessInternalUserAccess(createDto, userId, documentExists, sharedFilePath, serverFilePath, owner, docName);
                        }
                    }


                }
                else
                {
                    //ErrorLog.AddErrorLog($"CreateShareAccess was Executed Sucessfully time: {DateTime.Now} ms", createDto.DocType);
                    throw new Exception($"Invalid DocType '{createDto.DocType}'.");
                }


                return "Share Access Was Created Successfully.";
            }
            catch (Exception ex)
            {
                Log.Error(createDto.CreatedBy ?? "System", $"CreateShareAccess failed: {ex.Message}", "ShareAccess Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        // Process external user access
        private async Task ProcessExternalUserAccess(DocumentAccessCreateDTO createDto, string userId, dynamic item, string sharedPath, string serverPath, string? owner, string docName)
        {
            string token = GenerateToken(userId, createDto.DocType);
            var FileOrFolderName =
            (item.GetType().GetProperty("FolderName")?.GetValue(item) ??
             item.GetType().GetProperty("FileName")?.GetValue(item))?.ToString();

            var newShareAccessEntry = new ExternalShareAccessHistory
            {
                FolderOrFileId = createDto.FolderOrFileId,
                DocType = createDto.DocType,
                FileExistFolId = createDto.FileExistFolId,
                Token = token,
                EmailAddress = userId,
                AccessType = createDto.AccessType,
                IsExpiryDate = createDto.IsExpiryDate,
                ExpiryDate = createDto.ExpiryDate,
                IsEncryptionKey = createDto.IsEncryptionKey,
                EncryptionKey = createDto.EncryptionKey,
                ExpireOn = createDto.ExpiryDate ?? DateTime.Now.AddDays(30),
                IsUsed = false,
                Comment = createDto.Comment,
                CreatedOn = DateTime.Now,
                CreatedBy = createDto.CreatedBy,
                FolderOrFileName = FileOrFolderName,
                FolderOrFilePath = sharedPath,
                ServerFolderOrFilePath = serverPath,
                IsView = false,
            };

            _dbContext.ExternalShareAccessHistory.Add(newShareAccessEntry);
            await _dbContext.SaveChangesAsync();

            // NEW (this change): Ownership + Access History log for the external share grant.
            await _reportService.LogOwnershipOrAccessAsync(newShareAccessEntry.FolderOrFileId, newShareAccessEntry.DocType,
                "AccessGranted", null, null, null, null, createDto.CreatedBy, $"External share to {userId}");

            // NEW (this change): record this as a "Share" for the Employee-wise Folder Access report.
            await _reportService.LogFolderAccessAsync(newShareAccessEntry.FolderOrFileId, newShareAccessEntry.DocType,
                newShareAccessEntry.FolderOrFileName, createDto.CreatedBy, "Share");

            bool emailSentResult = await _emailService.SendMailForDocAccessMail(HttpUtility.UrlEncode(token), newShareAccessEntry.ESAID, userId, owner, docName, createDto.DocType, createDto.Comment, _configuration["SiteURL"]);
            var users = await _dbContext.Users.ToListAsync();
            var empinfo = await _dbContext.EmpInfos.ToListAsync();
            var senderdata = users.Where(x => x.UserID.ToString().ToLower() == createDto.CreatedBy.ToLower()).FirstOrDefault();
            var senderusername = "";
            var receiverusername = userId;
            var senderuserid = "";
            var receiveruserid = userId;
            if (senderdata != null)
            {
                senderuserid = senderdata.UserID.ToString();
                var sendername = empinfo.Where(x => x.EmpId.ToString().ToLower() == createDto.CreatedBy.ToLower()).FirstOrDefault();

                if (sendername != null)
                {
                    senderusername = $"{sendername.FirstName} {sendername.LastName}";
                }
                receiveruserid = userId.ToString();
                var receivername = empinfo.Where(x => x.EmpId.ToString().ToLower() == userId.ToLower()).FirstOrDefault();
                if (receivername != null)
                {
                    receiverusername = $"{receivername.FirstName} {receivername.LastName}";
                }


            }

            if (newShareAccessEntry.DocType == "Folder")
            {
                Log.DataLog(senderuserid, $"Folder name {docName} ~|~ was shared from the Shared user id {senderuserid} ~|~ Shared user name {senderusername} ~|~ to Access the Receiver UserId {receiveruserid} ~|~ receiver user name {receiverusername}", "Share Access Log");
            }
            if (newShareAccessEntry.DocType == "Document")
            {
                Log.DataLog(senderuserid, $"File name {docName} ~|~ was shared from the Shared user id {senderuserid} ~|~ Shared user name {senderusername} ~|~ to Access the Receiver UserId {receiveruserid} ~|~ receiver user name {receiverusername}", "Share Access Log");

            }

            //if (!emailSentResult)
            //{
            //    throw new Exception($"Sorry! There was a problem sending the email to user ID '{userId}'.");
            //}
            // ErrorLog.AddErrorLog($"ProcessExternalUserAccess was Executed Completed Sucessfully time: {DateTime.Now} ", FileOrFolderName);
        }

        private async Task ProcessInternalUserAccess(DocumentAccessCreateDTO createDto, string userId, dynamic item, string sharedPath, string serverPath, string? owner, string docName)
        {

            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserID == new Guid(userId) && u.IsActive)
                       ?? throw new Exception($"User with ID '{new Guid(userId)}' does not exist.");

            bool sendMailResult = await _emailService.SendMailForInternalDocAccessMail(user.Email, owner, createDto.DocType, docName, _configuration["SiteURL"]);
            var existingRequests = await _dbContext.ShareDocAccess
                .Where(e => e.AccessUserId == new Guid(userId) && e.FolderOrFileId == createDto.FolderOrFileId && e.DocType == createDto.DocType && e.CreatedBy == createDto.CreatedBy)
                .ToListAsync();

            if (existingRequests.Any())
            {
                _dbContext.ShareDocAccess.RemoveRange(existingRequests);
                await _dbContext.SaveChangesAsync();
            }

            var FileOrFolderName =
    (item.GetType().GetProperty("FolderName")?.GetValue(item) ??
    item.GetType().GetProperty("FileName")?.GetValue(item))?.ToString();


            var newShareAccessEntry = new ShareDocAccess
            {
                FolderOrFileId = createDto.FolderOrFileId,
                DocType = createDto.DocType,
                FileExistFolId = createDto.FileExistFolId,
                AccessUserId = new Guid(userId),
                AccessType = createDto.AccessType,
                PermissionLevel = null,
                IsExpiryDate = createDto.IsExpiryDate,
                ExpiryDate = createDto.ExpiryDate,
                IsEncryptionKey = createDto.IsEncryptionKey,
                EncryptionKey = createDto.EncryptionKey,
                IsActive = true,
                CreatedOn = DateTime.Now,
                CreatedBy = createDto.CreatedBy,
                FolderOrFileName = FileOrFolderName,
                FolderOrFilePath = sharedPath,
                ServerFolderOrFilePath = serverPath,
                IsView = false,
            };

            _dbContext.ShareDocAccess.Add(newShareAccessEntry);
            await _dbContext.SaveChangesAsync();

            // NEW (this change): Ownership + Access History log for the internal share grant.
            await _reportService.LogOwnershipOrAccessAsync(newShareAccessEntry.FolderOrFileId, newShareAccessEntry.DocType,
                "AccessGranted", null, null, newShareAccessEntry.AccessUserId, newShareAccessEntry.PermissionLevel, createDto.CreatedBy);

            // NEW (this change): record this as a "Share" for the Employee-wise Folder Access report.
            await _reportService.LogFolderAccessAsync(newShareAccessEntry.FolderOrFileId, newShareAccessEntry.DocType,
                newShareAccessEntry.FolderOrFileName, createDto.CreatedBy, "Share");

            var users = await _dbContext.Users.ToListAsync();
            var empinfo = await _dbContext.EmpInfos.ToListAsync();
            var senderdata = users.Where(x => x.UserID.ToString().ToLower() == createDto.CreatedBy.ToLower()).FirstOrDefault();
            var senderusername = "";
            var receiverusername = userId;
            var senderuserid = "";
            var receiveruserid = userId;
            if (senderdata != null)
            {
                senderuserid = senderdata.UserID.ToString();
                var sendername = empinfo.Where(x => x.EmpId.ToString().ToLower() == createDto.CreatedBy.ToLower()).FirstOrDefault();

                if (sendername != null)
                {
                    senderusername = $"{sendername.FirstName} {sendername.LastName}";
                }
                receiveruserid = userId.ToString();
                var receivername = empinfo.Where(x => x.EmpId.ToString().ToLower() == userId.ToLower()).FirstOrDefault();
                if (receivername != null)
                {
                    receiverusername = $"{receivername.FirstName} {receivername.LastName}";
                }


            }

            if (newShareAccessEntry.DocType == "Folder")
            {
                Log.DataLog(senderuserid, $"Folder name {docName} ~|~ was shared from the Shared user id {senderuserid} ~|~ Shared user name {senderusername} ~|~ to Access the Receiver UserId {receiveruserid} ~|~ receiver user name {receiverusername}", "Share Access Log");
            }
            if (newShareAccessEntry.DocType == "Document")
            {
                Log.DataLog(senderuserid, $"File name {docName} ~|~ was shared from the Shared user id {senderuserid} ~|~ Shared user name {senderusername} ~|~ to Access the Receiver UserId {receiveruserid} ~|~ receiver user name {receiverusername}", "Share Access Log");

            }

            //if (!sendMailResult)
            //{
            //    throw new Exception($"Sorry! There was a problem sending the email to user ID '{userId}'.");
            //}

            //WriteLog.AddWriteLog($"ProcessInternalUserAccess was Executed Completed Sucessfully time: {DateTime.Now}", FileOrFolderName);
        }




        private async Task CopyFolderContents(string sourceFolderPath, string destinationFolderPath)
        {
            // Ensure the destination folder exists
            if (!Directory.Exists(destinationFolderPath))
            {
                Directory.CreateDirectory(destinationFolderPath);
            }

            Console.WriteLine("Called This Function");

            // Copy files from source to destination
            foreach (var file in Directory.GetFiles(sourceFolderPath))
            {
                string fileName = Path.GetFileName(file);
                string destinationFilePath = Path.Combine(destinationFolderPath, fileName);

                if (File.Exists(destinationFilePath))
                {
                    File.Delete(destinationFilePath);
                }

                File.Copy(file, destinationFilePath);
            }

            // Recursively copy subdirectories
            foreach (var subfolder in Directory.GetDirectories(sourceFolderPath))
            {
                string subfolderName = Path.GetFileName(subfolder);
                string destinationSubfolderPath = Path.Combine(destinationFolderPath, subfolderName);

                // If the subfolder exists, delete it before copying
                if (Directory.Exists(destinationSubfolderPath))
                {
                    Directory.Delete(destinationSubfolderPath, true);
                }

                Directory.CreateDirectory(destinationSubfolderPath);
                Console.WriteLine("Ended This Function");
                await CopyFolderContents(subfolder, destinationSubfolderPath);
            }
        }

        private async Task CopyFolderContentsForDb(string sourceFolderPath, string destinationFolderPath, int folderOrFile)
        {

            if (!Directory.Exists(sourceFolderPath))
            {
                Console.WriteLine($"Source directory not found: {sourceFolderPath}");
                return; // Exit if the source folder does not exist
            }

            // Ensure the destination folder exists
            if (!Directory.Exists(destinationFolderPath))
            {
                Directory.CreateDirectory(destinationFolderPath);
            }

            Console.WriteLine("Called This Function");

            // Exit if the source folder does not exist
            string[] files;
            try
            {
                files = Directory.GetFiles(sourceFolderPath);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error accessing files in '{sourceFolderPath}': {ex.Message}");
                return; // Exit if there's an issue accessing files
            }

            foreach (var file in files)
            {
                string fileName = Path.GetFileName(file);
                string destinationFilePath = Path.Combine(destinationFolderPath, fileName);

                // If the file exists at the destination, delete it
                if (File.Exists(destinationFilePath))
                {
                    File.Delete(destinationFilePath);
                }

                // Copy the file to the destination
                try
                {
                    File.Copy(file, destinationFilePath);
                    Console.WriteLine($"Copied file: {fileName}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error copying file '{fileName}': {ex.Message}");
                }
            }

            // Recursively copy subdirectories
            string[] subdirectories;
            try
            {
                subdirectories = Directory.GetDirectories(sourceFolderPath);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error accessing directories: {ex.Message}");
                return; // Exit if there's an issue accessing directories
            }

            foreach (var subfolder in subdirectories)
            {
                try
                {
                    string subfolderName = Path.GetFileName(subfolder);
                    string destinationSubfolderPath = Path.Combine(destinationFolderPath, subfolderName);

                    // If the subfolder exists, delete it before copying
                    if (Directory.Exists(destinationSubfolderPath))
                    {
                        Directory.Delete(destinationSubfolderPath, true);
                    }

                    // Create the destination subfolder
                    Directory.CreateDirectory(destinationSubfolderPath);
                    Console.WriteLine($"Created subfolder: {subfolderName}");

                    // Recursively copy the contents of the subfolder
                    await CopyFolderContentsForDb(subfolder, destinationSubfolderPath, folderOrFile);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error processing subfolder '{subfolder}': {ex.Message}");
                }
            }
        }


        public async Task<string> UpdateShareAccess(DocumentAccessUpdateDTO updateDto)
        {
            try
            {
                // Validate Folder or Document existence
                if (updateDto.DocType == "Folder")
                {
                    var folderExists = await _dbContext.FolderData
                        .AnyAsync(f => f.FolderId == updateDto.FolderOrFileId);

                    if (!folderExists)
                    {
                        throw new Exception($"Folder with ID '{updateDto.FolderOrFileId}' does not exist.");
                    }
                }
                else if (updateDto.DocType == "Document")
                {
                    var documentExists = await _dbContext.FileData
                        .AnyAsync(f => f.FileId == updateDto.FolderOrFileId); // Assuming FileId is used for documents

                    if (!documentExists)
                    {
                        throw new Exception($"Document with ID '{updateDto.FolderOrFileId}' does not exist.");
                    }
                }
                else
                {
                    throw new Exception($"Invalid DocType '{updateDto.DocType}'.");
                }

                // Validate user existence
                var existingUsers = await _dbContext.Users
                    .Where(u => updateDto.AccessUserId.Contains(u.UserID))
                    .Select(u => u.UserID)
                    .ToListAsync();

                if (existingUsers.Count != updateDto.AccessUserId.Count)
                {
                    var invalidUsers = updateDto.AccessUserId.Except(existingUsers);
                    throw new Exception($"Users with IDs '{string.Join(", ", invalidUsers)}' do not exist.");
                }

                // Retrieve existing ShareDocAccess entries
                var existingAccessEntries = await _dbContext.ShareDocAccess
                    .Where(s => s.FolderOrFileId == updateDto.FolderOrFileId
                                && s.DocType == updateDto.DocType)
                    .ToListAsync();

                // Determine which entries to update and which to remove
                var existingAccessUserIds = existingAccessEntries.Select(s => s.AccessUserId).ToList();
                var newAccessUserIds = updateDto.AccessUserId;
                var userIdsToRemove = existingAccessUserIds.Except(newAccessUserIds).ToList();
                var userIdsToUpdate = newAccessUserIds.Intersect(existingAccessUserIds).ToList();
                var userIdsToAdd = newAccessUserIds.Except(existingAccessUserIds).ToList();

                // Remove entries for users who no longer need access
                var entriesToRemove = existingAccessEntries
                    .Where(s => userIdsToRemove.Contains(s.AccessUserId))
                    .ToList();

                if (entriesToRemove.Any())
                {
                    foreach (var e in entriesToRemove)
                    {
                        if (e.DocType == "Folder")
                        {
                            Log.DataLog(updateDto.CreatedBy, $"Folder Id {e.FolderOrFileId} Access removed for the User {e.AccessUserId}", "Remove Access Log");
                        }

                        if (e.DocType == "Document")
                        {
                            Log.DataLog(updateDto.CreatedBy, $"File Id {e.FolderOrFileId} Access removed for the User {e.AccessUserId}", "Remove Access Log");
                        }
                    }
                    _dbContext.ShareDocAccess.RemoveRange(entriesToRemove);


                }

                // Update existing entries
                var entriesToUpdate = existingAccessEntries
                    .Where(s => userIdsToUpdate.Contains(s.AccessUserId))
                    .ToList();

                foreach (var entry in entriesToUpdate)
                {
                    var dtoEntry = updateDto;
                    entry.AccessType = dtoEntry.AccessType;
                    entry.IsExpiryDate = dtoEntry.IsExpiryDate;
                    entry.ExpiryDate = dtoEntry.ExpiryDate;
                    entry.IsEncryptionKey = dtoEntry.IsEncryptionKey;
                    entry.EncryptionKey = dtoEntry.EncryptionKey;
                    entry.ModifiedOn = DateTime.Now;
                    entry.ModifiedBy = dtoEntry.CreatedBy;
                    if (entry.DocType == "Folder")
                    {
                        Log.DataLog(updateDto.CreatedBy, $"Folder Id {entry.FolderOrFileId} Access Updated", "Remove Access Log");
                    }

                    if (entry.DocType == "Document")
                    {
                        Log.DataLog(updateDto.CreatedBy, $"File Id {entry.FolderOrFileId} Access Updated", "Remove Access Log");
                    }
                }

                // Add new entries
                var newShareAccessEntries = userIdsToAdd.Select(userId => new ShareDocAccess
                {
                    FolderOrFileId = updateDto.FolderOrFileId,
                    DocType = updateDto.DocType,
                    FileExistFolId = updateDto.FileExistFolId,
                    AccessUserId = userId,
                    AccessType = updateDto.AccessType,
                    PermissionLevel = null, // Assuming PermissionLevel is optional
                    IsExpiryDate = updateDto.IsExpiryDate,
                    ExpiryDate = updateDto.ExpiryDate,
                    IsEncryptionKey = updateDto.IsEncryptionKey,
                    EncryptionKey = updateDto.EncryptionKey,
                    IsActive = true, // Default to active
                    CreatedOn = DateTime.Now,
                    CreatedBy = updateDto.CreatedBy,
                    ModifiedOn = null,
                    ModifiedBy = null
                }).ToList();

                if (newShareAccessEntries.Any())
                {

                    await _dbContext.ShareDocAccess.AddRangeAsync(newShareAccessEntries);
                    foreach (var share in newShareAccessEntries)
                    {
                        var users = await _dbContext.Users.ToListAsync();
                        var empinfo = await _dbContext.EmpInfos.ToListAsync();
                        var senderdata = users.Where(x => x.UserID.ToString().ToLower() == share.CreatedBy.ToLower()).FirstOrDefault();
                        var senderusername = "";
                        var receiverusername = share.AccessUserId.ToString();
                        var senderuserid = "";
                        var receiveruserid = share.AccessUserId;
                        if (senderdata != null)
                        {
                            senderuserid = senderdata.UserID.ToString();
                            var sendername = empinfo.Where(x => x.EmpId.ToString().ToLower() == share.CreatedBy.ToLower()).FirstOrDefault();

                            if (sendername != null)
                            {
                                senderusername = $"{sendername.FirstName} {sendername.LastName}";
                            }
                            receiveruserid = share.AccessUserId;
                            var receivername = empinfo.Where(x => x.EmpId.ToString() == share.AccessUserId.ToString()).FirstOrDefault();
                            if (receivername != null)
                            {
                                receiverusername = $"{receivername.FirstName} {receivername.LastName}";
                            }


                        }

                        if (share.DocType == "Folder")
                        {
                            var foldername = await _dbContext.FolderData.Where(x => x.FolderId == share.FolderOrFileId).Select(x => x.FolderName).FirstOrDefaultAsync();
                            if (foldername != null)
                            {
                                Log.DataLog(senderuserid, $"Folder name {foldername} ~|~ was shared from the Shared user id {senderuserid} ~|~ Shared user name {senderusername} ~|~ to Access the Receiver UserId {receiveruserid} ~|~ receiver user name {receiverusername}", "Update Share Access Log");

                            }
                        }
                        if (share.DocType == "Document")
                        {
                            var filename = await _dbContext.FileData.Where(x => x.FileId == share.FolderOrFileId).Select(x => x.FileName).FirstOrDefaultAsync();
                            if (filename != null)
                            {
                                Log.DataLog(senderuserid, $"File name {filename} ~|~ was shared from the Shared user id {senderuserid} ~|~ Shared user name {senderusername} ~|~ to Access the Receiver UserId {receiveruserid} ~|~ receiver user name {receiverusername}", "Update Share Access Log");
                            }
                        }
                    }
                }

                // NEW (this change): Ownership + Access History log for every add/update/remove above.
                foreach (var removed in entriesToRemove)
                {
                    await _reportService.LogOwnershipOrAccessAsync(removed.FolderOrFileId, removed.DocType, "AccessRevoked",
                        null, null, removed.AccessUserId, removed.PermissionLevel, updateDto.CreatedBy, saveChanges: false);
                }
                foreach (var updated in entriesToUpdate)
                {
                    await _reportService.LogOwnershipOrAccessAsync(updated.FolderOrFileId, updated.DocType, "AccessUpdated",
                        null, null, updated.AccessUserId, updated.PermissionLevel, updateDto.CreatedBy, saveChanges: false);
                }
                foreach (var added in newShareAccessEntries)
                {
                    await _reportService.LogOwnershipOrAccessAsync(added.FolderOrFileId, added.DocType, "AccessGranted",
                        null, null, added.AccessUserId, added.PermissionLevel, updateDto.CreatedBy, saveChanges: false);
                }

                // Save changes to the database
                await _dbContext.SaveChangesAsync();

                // NEW (this change): record each add/update/remove as a "Share" for the
                // Employee-wise Folder Access report (de-duped, so repeated edits to the
                // same document's share list by the same user just bump one counter).
                foreach (var item in entriesToRemove.Concat(entriesToUpdate).Concat(newShareAccessEntries))
                {
                    await _reportService.LogFolderAccessAsync(item.FolderOrFileId, item.DocType,
                        item.FolderOrFileName, updateDto.CreatedBy, "Share");
                }

                return "Share Access Was Update Successfully.";
            }
            catch (Exception ex)
            {
                Log.Error("System", $"Update share access failed: {ex.Message}", "Update ShareAccess Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<string> DeleteShareAccess(DocumentAccessDeleteDTO dto)
        {
            try
            {
                // Validate DocType
                if (dto.DocType != "Folder" && dto.DocType != "Document")
                {
                    throw new ArgumentException("DocType must be either 'Folder' or 'Document'.");
                }

                // Build the query based on DocType
                IQueryable<ShareDocAccess> query = _dbContext.ShareDocAccess;

                if (dto.DocType == "Folder")
                {
                    query = query.Where(s => s.FolderOrFileId == dto.FolderOrFileId && s.FileExistFolId == dto.FileExistFolId);
                }
                else if (dto.DocType == "Document")
                {
                    query = query.Where(s => s.FolderOrFileId == dto.FolderOrFileId && s.FileExistFolId == dto.FileExistFolId);
                }

                // Retrieve the records to delete
                var recordsToDelete = await query.ToListAsync();

                if (!recordsToDelete.Any())
                {
                    throw new Exception("No matching share access records found for deletion.");
                }

                // Remove the records from the database
                _dbContext.ShareDocAccess.RemoveRange(recordsToDelete);
                if (recordsToDelete != null)
                {
                    foreach (var a in recordsToDelete)
                    {
                        Log.DataLog("Admin", $"Successfully deleted ShareAccess id : {a.SDAId} data", "Delete ShareAccess Log");
                    }
                }

                // NEW (this change): Ownership + Access History log for the revoked access.
                foreach (var removed in recordsToDelete)
                {
                    await _reportService.LogOwnershipOrAccessAsync(removed.FolderOrFileId, removed.DocType, "AccessRevoked",
                        null, null, removed.AccessUserId, removed.PermissionLevel, "Admin", saveChanges: false);
                }

                // Save changes to the database
                await _dbContext.SaveChangesAsync();

                // NEW (this change): record each revoke as a "Share" for the Employee-wise
                // Folder Access report (revocation is still a share-management action).
                foreach (var removed in recordsToDelete)
                {
                    await _reportService.LogFolderAccessAsync(removed.FolderOrFileId, removed.DocType,
                        removed.FolderOrFileName, "Admin", "Share");
                }

                return "ShareAccess Deleted Successfully";
            }
            catch (Exception ex)
            {
                Log.Error("System", $"DeleteShareAccess failed for FolderOrFileId: {dto.FolderOrFileId}, FileExistFolId: {dto.FileExistFolId}. Error: {ex.Message}", "Delete ShareAccess Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<string> DeleteShareAccessBySdaID(int sdaId)
        {
            try
            {

                // Find the ShareDocAccess entry by SDAId
                var shareAccess = await _dbContext.ShareDocAccess
                    .FirstOrDefaultAsync(s => s.SDAId == sdaId);

                if (shareAccess == null)
                {
                    throw new Exception($"Share access with ID '{sdaId}' not found.");
                }

                // Remove the entry from the database
                _dbContext.ShareDocAccess.Remove(shareAccess);
                Log.DataLog("Admin", $"Successfully deleted ShareAccess id : {sdaId} data", "Delete ShareAccess Log");

                // NEW (this change): Ownership + Access History log for the revoked access.
                await _reportService.LogOwnershipOrAccessAsync(shareAccess.FolderOrFileId, shareAccess.DocType, "AccessRevoked",
                    null, null, shareAccess.AccessUserId, shareAccess.PermissionLevel, "Admin", saveChanges: false);

                await _dbContext.SaveChangesAsync();

                // NEW (this change): record this as a "Share" for the Employee-wise Folder Access report.
                await _reportService.LogFolderAccessAsync(shareAccess.FolderOrFileId, shareAccess.DocType,
                    shareAccess.FolderOrFileName, "Admin", "Share");

                return "ShareAccess Deleted Successfully.";
            }
            catch (Exception ex)
            {
                Log.Error("System", $"DeleteShareAccess failed for share accessid : {sdaId}. Error: {ex.Message}", "Delete ShareAccess Log");


                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        #endregion

        #region ShareAccessData External

        public async Task<string> CreateExternalShareAccess(DocShareExtAccessCreateDTO createDto)
        {
            try
            {
                string portalAddress = _configuration["SiteURL"];
                string docName = "";
                string? owner = null;
                if (createDto.CreatedBy != null)
                {
                    owner = await GetEmployeeIdAsync(createDto.CreatedBy);
                }
                // Validate Folder or Document existence
                if (createDto.DocType == "Folder")
                {
                    var folderExists = await _dbContext.FolderData
                        .FirstOrDefaultAsync(f => f.FolderId == createDto.FolderOrFileId);

                    if (folderExists == null)
                    {
                        throw new Exception($"Folder with ID '{createDto.FolderOrFileId}' does not exist.");
                    }

                    docName = folderExists.FolderName;
                }
                else if (createDto.DocType == "Document")
                {
                    var documentExists = await _dbContext.FileData
                        .FirstOrDefaultAsync(f => f.FileId == createDto.FolderOrFileId);

                    if (documentExists == null)
                    {
                        throw new Exception($"Document with ID '{createDto.FolderOrFileId}' does not exist.");
                    }

                    docName = documentExists.FileName;
                }
                else
                {
                    throw new Exception($"Invalid DocType '{createDto.DocType}'.");
                }

                // Check for existing ExternalShareAccessHistory entries to avoid duplicates
                var existingAccessEntries = await _dbContext.ExternalShareAccessHistory
                    .Where(s => createDto.AccessEmail.Contains(s.EmailAddress)
                                && s.FolderOrFileId == createDto.FolderOrFileId
                                && s.DocType == createDto.DocType)
                    .ToListAsync();

                // Delete existing entries if needed
                _dbContext.ExternalShareAccessHistory.RemoveRange(existingAccessEntries);

                // Process each email in AccessEmail list
                foreach (var createEmail in createDto.AccessEmail)
                {
                    // Generate token
                    string token = GenerateToken(createEmail, createDto.DocType);

                    // Create new ExternalShareAccessHistory entry
                    var newShareAccessEntry = new ExternalShareAccessHistory
                    {
                        FolderOrFileId = createDto.FolderOrFileId,
                        DocType = createDto.DocType,
                        FileExistFolId = createDto.FileExistFolId,
                        Token = token,
                        EmailAddress = createEmail, // Assuming single email for simplicity
                        AccessType = createDto.AccessType,
                        IsExpiryDate = createDto.IsExpiryDate,
                        ExpiryDate = createDto.ExpiryDate,
                        IsEncryptionKey = createDto.IsEncryptionKey,
                        EncryptionKey = createDto.EncryptionKey,
                        ExpireOn = createDto.ExpiryDate.HasValue ? createDto.ExpiryDate.Value : DateTime.Now.AddDays(30), // Example expiration time (adjust as needed)
                        IsUsed = false,
                        Comment = createDto.Comments,
                        CreatedOn = DateTime.Now,
                        CreatedBy = createDto.CreatedBy,
                        IsView = false,
                    };

                    // Add new entry to the database
                    await _dbContext.ExternalShareAccessHistory.AddAsync(newShareAccessEntry);
                    await _dbContext.SaveChangesAsync();

                    // Send email with token
                    bool sendResult = await _emailService.SendMailForDocAccessMail(HttpUtility.UrlEncode(token), newShareAccessEntry.ESAID, createEmail, owner, docName, createDto.DocType, createDto.Comments, createDto.siteURL);

                    if (!sendResult)
                    {
                        throw new Exception("Sorry! There is some problem on sending mail");
                    }
                }

                // Save changes to the database
                await _dbContext.SaveChangesAsync();

                return "Share Access Was Created Successfully.";
            }
            catch (Exception ex)
            {
                // Handle exceptions as needed
                throw new Exception(ex.Message ?? "Error occurred while creating share access.");
            }
        }

        public async Task<string> CheckValidityofToken(TokenValidateDTO tokenData)
        {
            TokenResponceForDocumentData tokenHistoryResult = null; // Initialize as null

            try
            {
                string tokenDecoed = HttpUtility.UrlDecode(tokenData.Token);
                // Decrypt the token
                string decryptedResult = Decrypt(tokenData.Token, true);

                // Validate the token format
                string[] decryptedArray = decryptedResult.Split('|');
                if (decryptedArray.Length != 3)
                {
                    throw new Exception("Invalid token format!");
                }

                // Check token expiration
                DateTime expirationDate = DateTime.Parse(decryptedArray[2].Replace('+', ' '));
                if (DateTime.Now > expirationDate)
                {
                    throw new Exception("Token Expired");
                }

                // Get the decrypted user email
                string decryptedUserEmail = decryptedArray[0];

                // Validate access data for the email
                var accessData = await _dbContext.ExternalShareAccessHistory
                    .FirstOrDefaultAsync(tb => tb.EmailAddress == decryptedUserEmail && !tb.IsUsed);

                if (accessData == null)
                {
                    throw new Exception("Token might have already been used or invalid email!");
                }

                // Validate token and access email
                var history = await _dbContext.ExternalShareAccessHistory
                    .FirstOrDefaultAsync(x => x.EmailAddress == tokenData.AccessEmail && !x.IsUsed && x.Token == tokenData.Token);

                if (history == null)
                {
                    throw new Exception("Token might have already been used!");
                }



                Random random = new Random();
                string generatedOtp = random.Next(100000, 999999).ToString();
                if (!string.IsNullOrEmpty(generatedOtp))
                {
                    var emailResult = await _emailService.SendOtpForDocAuthentivcationMail(generatedOtp, tokenData.AccessEmail, tokenData.AccessEmail);
                    if (!emailResult)
                    {
                        throw new Exception("Failed to send Otp");
                    }

                    if (emailResult)
                    {
                        var otpRecords = await _dbContext.TokenVerifyOtpHistory
                        .Where(pr => pr.Email == tokenData.AccessEmail)
                            .ToListAsync();
                        if (otpRecords.Any())
                        {
                            // Remove the OTP records from the context
                            _dbContext.TokenVerifyOtpHistory.RemoveRange(otpRecords);
                            await _dbContext.SaveChangesAsync();
                        }

                        if (tokenData.AccessEmail != null)
                        {
                            DateTime expiryTime = DateTime.Now.AddMinutes(5);
                            // Save OTP details to the database
                            var docAuthOtp = new TokenVerifyOtpHistory
                            {
                                Email = tokenData.AccessEmail,
                                OTP = generatedOtp,
                                OTPIsActive = true,
                                CreatedOn = DateTime.Now,
                                ExpiryOn = expiryTime,
                                CreatedBy = tokenData.AccessEmail
                            };
                            _dbContext.TokenVerifyOtpHistory.Add(docAuthOtp);
                            await _dbContext.SaveChangesAsync();
                        }
                    }
                }

                // Mark the token as used
                //history.IsUsed = true;
                //history.UsedOn = DateTime.Now;
                await _dbContext.SaveChangesAsync();

                // Return the populated token history result
                return "Otp Was Sent to Your EmailId";
            }
            catch (Exception ex)
            {
                //ErrorLog.AddErrorLog("Master/CheckValidityofToken : - ", ex.Message);
                return ex.Message ?? "Network error";
            }
        }




        private string GenerateToken(string userEmail, string docType)
        {
            // Example token generation logic
            // Concatenate email, doc type, and other necessary information to create a unique token
            string code = Encrypt(userEmail + '|' + docType + '|' + DateTime.Now.AddDays(30), true);
            return code;
        }


        public async Task<ActionResult<TokenResponceForDocumentData>> VerifytheDocAccessOtp(TokenOTPVerifyRequest request)
        {
            try
            {
                TokenResponceForDocumentData tokenHistoryResult = null; // Initialize as null

                // Find the latest active OTP for the user
                var latestOtp = await _dbContext.TokenVerifyOtpHistory
                    .Where(pr => (pr.Email == request.Email) && pr.OTPIsActive)
                    .OrderByDescending(pr => pr.CreatedOn)
                    .FirstOrDefaultAsync();

                if (latestOtp == null || latestOtp.OTP != request.Otp)
                {
                    throw new Exception("Invalid OTP");
                }

                if (latestOtp.ExpiryOn < DateTime.Now)
                {
                    throw new Exception("OTP has expired. Try with New OTP"); // OTP has expired
                }

                // Deactivate the OTP
                latestOtp.OTPIsActive = false;
                await _dbContext.SaveChangesAsync();

                // Get document data
                var docData = await _dbContext.ExternalShareAccessHistory.FirstOrDefaultAsync(db => db.ESAID == request.ESAID);
                if (docData == null)
                {
                    throw new Exception("Document data not found.");
                }


                // Populate the response object
                tokenHistoryResult = new TokenResponceForDocumentData
                {
                    ESAID = docData.ESAID,
                    AccessType = docData.AccessType,
                    DocType = docData.DocType,
                    EncryptionKey = docData.EncryptionKey,
                    IsEncryptionKey = docData.IsEncryptionKey,
                    IsExpiryDate = docData.IsExpiryDate,
                    ExpiryDate = docData.ExpiryDate,
                    Comment = docData.Comment,
                    CreatedBy = docData.CreatedBy,
                    CreatedOn = docData.CreatedOn,
                    FileExistFolId = docData.FileExistFolId,
                    FolderOrFileId = docData.FolderOrFileId
                };

                // Enhance record with Folder or File data
                if (docData.DocType == "Folder")
                {
                    var folder = await _dbContext.FolderData
                        .FirstOrDefaultAsync(f => f.FolderId == tokenHistoryResult.FolderOrFileId);

                    if (folder != null)
                    {
                        tokenHistoryResult.FoldeOrFileName = folder.FolderName;
                        tokenHistoryResult.FolderOrFilePath = folder.FolderPath;
                        tokenHistoryResult.ServerFolderOrFilePath = folder.ServerFolderPath;
                        tokenHistoryResult.FolderColor = folder.FolderColor;
                        Log.DataLog(request.Email, $" For the {folder.FolderName} Access has been verified with otp {request.Otp} successfully for the mail {request.Email}", "Doc access otp verification Log");
                    }
                }
                else if (docData.DocType == "Document")
                {
                    var file = await _dbContext.FileData
                        .FirstOrDefaultAsync(f => f.FileId == tokenHistoryResult.FolderOrFileId);

                    if (file != null)
                    {
                        tokenHistoryResult.FoldeOrFileName = file.FileName;
                        tokenHistoryResult.FolderOrFilePath = file.FilePath;
                        tokenHistoryResult.ServerFolderOrFilePath = file.ServerFilePath;
                    }
                }


                //docData.IsUsed = true;
                //docData.UsedOn = DateTime.Now;
                await _dbContext.SaveChangesAsync();
                return tokenHistoryResult;
            }
            catch (Exception ex)
            {
                //ErrorLog.AddErrorLog($"OTPVerifiycation - {request.Email}", ex.Message);
                throw new Exception(ex.Message ?? "Network Error");
            }
        }


        public async Task<IEnumerable<ExternalShareAccessViewData>> GetShareAccessByEmailId(string accessUserEmailId)
        {
            try
            {
                // Fetch external share access records based on the email ID
                var shareExternalAccessRecords = await _dbContext.ExternalShareAccessHistory.AsNoTracking()
                    .Where(s => s.EmailAddress == accessUserEmailId)
                    .Select(s => new ExternalShareAccessViewData
                    {
                        ESAID = s.ESAID,
                        FolderOrFileId = s.FolderOrFileId,
                        DocType = s.DocType,
                        FileExistFolId = s.FileExistFolId,
                        Token = s.Token,
                        EmailAddress = s.EmailAddress,
                        AccessType = s.AccessType,
                        Comment = s.Comment,
                        IsExpiryDate = s.IsExpiryDate,
                        ExpiryDate = s.ExpiryDate,
                        IsEncryptionKey = s.IsEncryptionKey,
                        EncryptionKey = s.EncryptionKey,
                        ExpireOn = s.ExpireOn,
                        IsUsed = s.IsUsed,
                        CreatedOn = s.CreatedOn,
                        CreatedBy = s.CreatedBy,
                        IsView = s.IsView,
                        //FolderSize = 0,
                        //FileSize = 0,
                    })
                    .ToListAsync();

                var allfiles = await _dbContext.FileData.AsNoTracking().ToListAsync();
                var allfolders = await _dbContext.FolderData.AsNoTracking().ToListAsync();
                foreach (var record in shareExternalAccessRecords)
                {
                    if (record.DocType == "Folder")
                    {
                        var folder = allfolders
                            .FirstOrDefault(f => f.FolderId == record.FolderOrFileId);
                        var subfolder = allfolders
                            .Where(f => f.ParentFolderId == record.FolderOrFileId).Select(x => x.FolderId);

                        if (folder != null)
                        {
                            record.FoldeOrFileName = folder.FolderName;
                            record.FolderOrFilePath = folder.FolderPath;
                            record.ServerFolderOrFilePath = folder.ServerFolderPath;
                            record.FolderColor = folder.FolderColor;
                            long size = 0;
                            size = allfiles.Where(x => x.FolderId == record.FolderOrFileId).Sum(x => x.Size);
                            var count = allfiles.Where(x => x.FolderId == record.FolderOrFileId).ToList();
                            long subfolderssize = 0;
                            if (subfolder != null)
                            {
                                subfolderssize = allfiles.Where(x => subfolder.Contains(x.FolderId)).Sum(x => x.Size);
                            }
                            record.FolderSize = size + subfolderssize;

                            record.FolderFilesCount = count.Count();
                            record.SubFoldersCount = subfolder?.Count();

                            if (folder.FolderName != null)
                            {
                                var checkempinfo = await _dbContext.EmpInfos.AsNoTracking().Where(x => x.Email.ToLower() == accessUserEmailId).FirstOrDefaultAsync();
                                if (checkempinfo != null)
                                {
                                    Log.DataLog($"{checkempinfo.EmpId} and UserName : {checkempinfo.FirstName} {checkempinfo.LastName}", $"Accessed Folder {folder.FolderName}", "Accessed Folder Log");
                                }
                                else
                                {
                                    Log.DataLog($"{accessUserEmailId} and UserName : {accessUserEmailId}", $"Accessed Folder {folder.FolderName}", "Accessed Folder Log");

                                    //Log.DataLog(accessUserEmailId, $"Accessed Folder {folder.FolderName}", "Accessed Folder Log");
                                }

                            }

                        }
                    }
                    else if (record.DocType == "Document")
                    {
                        var file = allfiles
                            .FirstOrDefault(f => f.FileId == record.FolderOrFileId);

                        if (file != null)
                        {
                            record.FoldeOrFileName = file.FileName;
                            record.FolderOrFilePath = file.FilePath;
                            record.ServerFolderOrFilePath = file.ServerFilePath;
                            var size = allfiles.Where(x => x.FolderId == record.FolderOrFileId).Sum(x => x.Size);
                            if (size != null)
                            {
                                //aded by shafi 
                                record.FileSize = file.Size;
                            }
                            if (file.FileName != null)
                            {
                                var checkempinfo = await _dbContext.EmpInfos.AsNoTracking().Where(x => x.Email.ToLower() == accessUserEmailId).FirstOrDefaultAsync();
                                if (checkempinfo != null)
                                {
                                    Log.DataLog($"{checkempinfo.Email} and UserName : {checkempinfo.FirstName} {checkempinfo.LastName}", $"Accessed File {file.FileName}", "Accessed File Log");


                                }
                                else
                                {
                                    Log.DataLog($"{accessUserEmailId} and UserName : {accessUserEmailId}", $"Accessed File {file.FileName}", "Accessed File Log");




                                }

                            }
                        }
                    }
                }

                return shareExternalAccessRecords;
            }
            catch (Exception ex)
            {
                Log.Error($"{accessUserEmailId} and UserName : {accessUserEmailId}", $"Error occured while accessing through mail : {ex.Message}", "Share Access Log");


                // Handle or log the exception as needed
                throw new Exception(ex.Message ?? "Network Error");
            }
        }



        #endregion

        #region HelperFunction

        // NEW (this change): resolves a user's notification email + display name from
        // Users/EmpInfos, used to notify a shared-folder's original owner (StoregeUserId)
        // when another user (CreatedBy) creates a subfolder or uploads files on their behalf.
        private async Task<(string? Email, string? Name)> GetUserNotifyDetailsAsync(string? userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId) || !Guid.TryParse(userId, out var parsedUserId))
                {
                    return (null, null);
                }

                var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserID == parsedUserId);
                if (user == null || string.IsNullOrWhiteSpace(user.Email))
                {
                    return (null, null);
                }

                var empInfo = await _dbContext.EmpInfos.AsNoTracking().FirstOrDefaultAsync(e => e.EmpId == parsedUserId);
                string name = empInfo != null
                    ? $"{empInfo.FirstName} {empInfo.LastName}".Trim()
                    : user.Email;

                return (user.Email, string.IsNullOrWhiteSpace(name) ? user.Email : name);
            }
            catch
            {
                return (null, null);
            }
        }

        private async Task<string?> GetEmployeeIdAsync(string userId)
        {
            try
            {
                var parsedUserId = Guid.Parse(userId);
                var user = await _dbContext.Users.AsNoTracking()
                    .FirstOrDefaultAsync(u => u.UserID == parsedUserId);

                if (user != null)
                {
                    var empInfo = await _dbContext.EmpInfos.AsNoTracking().FirstOrDefaultAsync(u => u.EmpId == parsedUserId);

                    if (empInfo != null)
                    {
                        // Assuming you want to concatenate first name and last name with a space
                        return empInfo.Email;
                    }
                    else
                    {
                        return "Not Found";
                    }
                }
                else
                {
                    return "Not Found";
                }
            }
            catch (Exception ex)
            {
                return "Not Found";
            }
        }

        private string Encrypt(string Password, bool useHashing)
        {
            try
            {
                string EncryptionKey = "Iteos";
                byte[] KeyArray;
                byte[] ToEncryptArray = Encoding.UTF8.GetBytes(Password);
                if (useHashing)
                {
                    using (MD5CryptoServiceProvider hashmd5 = new MD5CryptoServiceProvider())
                    {
                        KeyArray = hashmd5.ComputeHash(Encoding.UTF8.GetBytes(EncryptionKey));
                    }
                }
                else
                {
                    KeyArray = Encoding.UTF8.GetBytes(EncryptionKey);
                }

                using (TripleDESCryptoServiceProvider tdes = new TripleDESCryptoServiceProvider())
                {
                    tdes.Key = KeyArray;
                    tdes.Mode = CipherMode.ECB;
                    tdes.Padding = PaddingMode.PKCS7;
                    ICryptoTransform cTransform = tdes.CreateEncryptor();
                    byte[] resultArray = cTransform.TransformFinalBlock(ToEncryptArray, 0, ToEncryptArray.Length);
                    return Convert.ToBase64String(resultArray, 0, resultArray.Length);
                }
            }
            catch (Exception ex)
            {
                //ErrorLog.AddErrorLog("FolderService/Encrypt :- ", ex.Message);
                return null;
            }
        }

        private string Decrypt(string Password, bool UseHashing)
        {
            try
            {
                string EncryptionKey = "Iteos";
                byte[] KeyArray;
                byte[] ToEncryptArray = Convert.FromBase64String(Password);
                if (UseHashing)
                {
                    using (MD5CryptoServiceProvider hashmd5 = new MD5CryptoServiceProvider())
                    {
                        KeyArray = hashmd5.ComputeHash(Encoding.UTF8.GetBytes(EncryptionKey));
                    }
                }
                else
                {
                    KeyArray = Encoding.UTF8.GetBytes(EncryptionKey);
                }

                using (TripleDESCryptoServiceProvider tdes = new TripleDESCryptoServiceProvider())
                {
                    tdes.Key = KeyArray;
                    tdes.Mode = CipherMode.ECB;
                    tdes.Padding = PaddingMode.PKCS7;
                    ICryptoTransform cTransform = tdes.CreateDecryptor();
                    byte[] resultArray = cTransform.TransformFinalBlock(ToEncryptArray, 0, ToEncryptArray.Length);
                    return Encoding.UTF8.GetString(resultArray);
                }
            }
            catch (Exception ex)
            {
                //ErrorLog.AddErrorLog("FolderService/Decrypt :- ", ex.Message);
                return null;
            }
        }

        #endregion
    }
}