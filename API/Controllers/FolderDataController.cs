using DDAAPI.DbContexts;
using DDAAPI.Models;
using DDAAPI.Services;
using DDAAPI.Services;
using DDAAPI.Models;
using DDAAPI.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text.RegularExpressions;


namespace DDAAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class FolderDataController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly EmailService _emailService;
        private readonly FolderService _folderDataServices;
        private readonly AppDbContext _dbContext;
        private readonly GlobalAdminController _globalAdminController;

        public FolderDataController(AppDbContext dbContext, IConfiguration configuration, EmailService emailService, FolderService folderDataServices,
            GlobalAdminController globalAdminController)
        {
            _configuration = configuration;
            _emailService = emailService ?? throw new ArgumentNullException(nameof(emailService));
            _folderDataServices = folderDataServices;
            _dbContext = dbContext;
            _globalAdminController = globalAdminController;
        }


        #region  FolderData Controllers

        [HttpGet("GetAllFolders")]
        public async Task<IActionResult> GetAllFolders()
        {
            try
            {
                var folders = await _folderDataServices.GetAllFolders();
                return Ok(new { success = true, data = folders });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetAllFoldersByCreatedBy/{createdById}")]
        public async Task<IActionResult> GetAllFoldersByCreatedBy(Guid createdById)
        {
            try
            {
                var folders = await _folderDataServices.GetAllFoldersByCreatedBy(createdById);
                return Ok(new { success = true, data = folders });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetAllFoldersAndFilesByCreatedBy/{createdById}")]
        public async Task<IActionResult> GetAllFoldersAndFilesByCreatedBy(Guid createdById)
        {
            try
            {
                var folders = await _folderDataServices.GetAllFoldersAndFilesByCreatedBy(createdById);
                return Ok(new { success = true, data = folders });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }


        [HttpGet("GetFolderById/{folderId}")]
        public async Task<IActionResult> GetFolderById(int folderId)
        {
            try
            {
                var folder = await _folderDataServices.GetFolderById(folderId);
                return Ok(new { success = true, data = folder });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }


        [HttpGet("GetFolderByParentId/{parentFolderId}")]
        public async Task<IActionResult> GetFolderByParentId(int parentFolderId)
        {
            try
            {
                var folder = await _folderDataServices.GetFolderByParentId(parentFolderId);
                return Ok(new { success = true, data = folder });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetAllFilesAndFoldersByParentId/{parentFolderId}")]
        public async Task<IActionResult> GetAllFilesAndFoldersByParentId(int parentFolderId)
        {
            try
            {
                var items = await _folderDataServices.GetAllFilesAndFoldersByParentId(parentFolderId);
                return Ok(new { success = true, data = items });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CreateFolder")]
        public async Task<IActionResult> CreateFolder([FromBody] FolderCreateDTO input)
        {
            try
            {
                var result = await _folderDataServices.CreateFolder(input);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // NEW (this change): Feature 3 - Ownership + Access History.
        // Explicitly transfers a folder's ownership and records it in the
        // Ownership/Access History log (see api/Reports/GetOwnershipAccessHistory).
        [HttpPost("TransferFolderOwnership")]
        public async Task<IActionResult> TransferFolderOwnership([FromBody] TransferOwnershipDTO input)
        {
            try
            {
                var result = await _folderDataServices.TransferFolderOwnership(input);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CreateSubFolder")]
        public async Task<IActionResult> CreateSubFolder([FromBody] SubFolderCreateDTO input)
        {
            try
            {
                string result = await _folderDataServices.CreateSubFolder(input);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CreateSubFolderBehalf")]
        public async Task<IActionResult> CreateSubFolderBehalf([FromBody] SubFolderCreateBehalfDTO input)
        {
            try
            {
                string result = await _folderDataServices.CreateSubFolderBehalf(input);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("UpdateFolder")]
        public async Task<IActionResult> UpdateFolder([FromBody] FolderUpdateDTO input)
        {
            try
            {
                string result = await _folderDataServices.UpdateFolder(input);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("UpdateFolderBehalf")]
        public async Task<IActionResult> UpdateFolderBehalf([FromBody] FolderUpdateBehalfDTO input)
        {
            try
            {
                string result = await _folderDataServices.UpdateFolderBehalf(input);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("UpdateFolderName")]
        public async Task<IActionResult> UpdateFolderName([FromBody] FolderNameUpdateDTO input)
        {
            try
            {
                string result = await _folderDataServices.UpdateFolderName(input);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("MoveToFolderOrFile")]
        public async Task<IActionResult> MoveToFolderOrFile([FromBody] MoveToFolderDTO input)
        {
            try
            {
                string result = await _folderDataServices.MoveToFolderOrFile(input);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("SubUpdateFolder")]
        public async Task<IActionResult> SubUpdateFolder([FromBody] SubFolderUpdateDTO input)
        {
            try
            {
                string result = await _folderDataServices.SubUpdateFolder(input);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("SubUpdateFolderBehalf")]
        public async Task<IActionResult> SubUpdateFolderBehalf([FromBody] SubFolderUpdateBehalfDTO input)
        {
            try
            {
                string result = await _folderDataServices.SubUpdateFolderBehalf(input);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // NEW (this change): streams the ZIP directly to the response as it's built
        // instead of assembling a temp .zip on disk first. Bytes start reaching the
        // browser within a second or two of the request, so the download bar starts
        // moving immediately even for folders with many large files/subfolders,
        // instead of the user staring at a blank screen while the server works.
        //
        // Validation happens BEFORE any header is written, so a bad folderId still
        // comes back as a clean 400 JSON error exactly like before. Once streaming
        // starts, the response is already committed (200 OK) - that's an inherent
        // trade-off of streaming vs. build-then-send, see the chat writeup for details.
        [HttpGet("DownloadFolder")]
        public async Task<IActionResult> DownloadFolder([FromQuery] int folderId)
        {
            DDAAPI.Models.FolderData folder;
            try
            {
                folder = await _folderDataServices.GetFolderForDownloadAsync(folderId);
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }

            // NEW (this change): System.IO.Compression.ZipArchive writes its central
            // directory synchronously when disposed (there's no async Dispose for it),
            // and Kestrel blocks synchronous writes by default. Rather than allowing
            // sync I/O globally (which would silently permit blocking calls on every
            // endpoint), we enable it only for this one request/response - the actual
            // file content is still streamed asynchronously via CopyToAsync; only the
            // small end-of-archive header writes end up synchronous.
            var syncIOFeature = HttpContext.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpBodyControlFeature>();
            if (syncIOFeature != null)
            {
                syncIOFeature.AllowSynchronousIO = true;
            }

            // Disable ASP.NET Core's response buffering so bytes are flushed to the
            // client as they're written, not held until the whole response is done.
            var bufferingFeature = HttpContext.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpResponseBodyFeature>();
            bufferingFeature?.DisableBuffering();

            Response.ContentType = "application/zip";
            Response.Headers["Content-Disposition"] = $"attachment; filename=\"{folder.FolderName}.zip\"";
            // Content-Length is intentionally not set - the archive is being built as it
            // streams out, so the final size isn't known up front. The response is sent
            // as chunked transfer-encoding instead, which every modern browser and IIS
            // support natively for downloads.

            try
            {
                await _folderDataServices.WriteFolderZipToStreamAsync(folder, Response.Body);
            }
            catch (Exception ex)
            {
                // Headers (200 OK) are already sent by this point - we can't switch to a
                // JSON error response anymore. Log it and simply stop; let the connection
                // end so the client sees a truncated/failed download rather than letting
                // this bubble into the global exception handler, which can't write a
                // fresh response body once streaming has started and just produces a
                // confusing secondary error.
                // NOTE: swap this for your project's Log.Error(...) helper (Helpers/WriteLog.cs)
                // if you add a `using` for its namespace to this controller - not referenced
                // here today, so System.Diagnostics.Trace is used as a safe default.
                System.Diagnostics.Trace.TraceError($"DownloadFolder streaming failed for folder ID {folderId}: {ex}");
            }

            return new EmptyResult();
        }

        [HttpPost("DeleteFolder")]
        public async Task<IActionResult> DeleteFolder(FolderDeleteDTO folderDeleteDto)
        {
            try
            {
                var result = await _folderDataServices.DeleteFolder(folderDeleteDto);
                await _globalAdminController.UpdateUsedDataStorage();
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("DeleteSubFolder")]
        public async Task<IActionResult> DeleteSubFolder(SubFolderDeleteDTO subfolder)
        {
            try
            {
                var result = await _folderDataServices.DeleteSubFolder(subfolder);
                await _globalAdminController.UpdateUsedDataStorage();
                return Ok(new { success = true, message = result });


            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        #endregion


        #region FileData Controllers

        [HttpGet("GetAllFilesByFolderId/{folderId}")]
        public async Task<IActionResult> GetAllFilesByFolderId(int folderId)
        {
            try
            {
                var files = await _folderDataServices.GetAllFilesByFolderId(folderId);
                return Ok(new { success = true, data = files });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetFilesByFolderId/{folderId}")]
        public async Task<IActionResult> GetFilesByFolderId(int folderId)
        {
            try
            {
                var files = await _folderDataServices.GetFilesByFolderId(folderId);
                return Ok(new { success = true, data = files });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }


        [HttpPost("CreateFile")]
        public async Task<IActionResult> CreateFile([FromForm] CreateFileDataDTO input)
        {
            try
            {
                var result = await _folderDataServices.CreateFile(input);
                await _globalAdminController.UpdateUsedDataStorage();
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CreateFiles")]
        public async Task<IActionResult> CreateFiles([FromForm] CreateFilesDataDTO input)
        {
            try
            {
                var result = await _folderDataServices.CreateFiles(input);
                await _globalAdminController.UpdateUsedDataStorage();
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CreateFilesBeHalf")]
        public async Task<IActionResult> CreateFilesBeHalf([FromForm] CreateFilesBehalfDataDTO input)
        {
            try
            {
                var result = await _folderDataServices.CreateFilesBeHalf(input);
                await _globalAdminController.UpdateUsedDataStorage();
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("UpdateFile")]
        public async Task<IActionResult> UpdateFile([FromForm] UpdateFileDataDTO input)
        {
            try
            {
                var result = await _folderDataServices.UpdateFile(input);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("UpdateFileName")]
        public async Task<IActionResult> UpdateFileName([FromForm] UpdateFileNameDataDTO input)
        {
            try
            {
                var result = await _folderDataServices.UpdateFileName(input);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("DownloadFile")]
        public async Task<IActionResult> DownloadFile([FromQuery] int fileId)
        {
            return await _folderDataServices.DownloadFile(fileId);
        }

        [HttpPost("DeleteFile/{fileId}")]
        public async Task<IActionResult> DeleteFile(int fileId)
        {
            try
            {
                var result = await _folderDataServices.DeleteFile(fileId);
                await _globalAdminController.UpdateUsedDataStorage();
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        #endregion


        #region  ShareAccess Controllers

        [HttpGet("GetShareAccessByUserId/{accessUserId}")]
        public async Task<IActionResult> GetShareAccessByUserId(Guid accessUserId)
        {
            try
            {
                var accessData = await _folderDataServices.GetShareAccessByUserId(accessUserId);
                return Ok(new { success = true, data = accessData });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetShareAccessDetailsByAccessUserId")]
        public async Task<IActionResult> GetShareAccessDetailsByAccessUserId(Guid accessUserId)
        {
            try
            {
                var sharedaccessfolder = await _dbContext.ShareDocAccess.AsNoTracking().ToListAsync();

                var Folders = await _dbContext.FolderData.AsNoTracking().ToListAsync();
                var Files = await _dbContext.FileData.AsNoTracking().ToListAsync();

                var shareAccessRecords = (from s in sharedaccessfolder
                                          select new

                                          //.Where(s => s.AccessUserId == accessUserId)
                                          //.Select(s => new ShareDocAccessViewData

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

                                              ParentFolder = (from folder in Folders
                                                              where s.FolderOrFileId == folder.FolderId && s.DocType == "Folder"
                                                              select new
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
                                                                  SubFolders =
                                                              (from subfolder in Folders
                                                               where folder.FolderId == subfolder.ParentFolderId
                                                               select new
                                                               {
                                                                   subfolder.FolderId,
                                                                   subfolder.FolderName,
                                                                   subfolder.FolderPath,
                                                                   subfolder.ServerFolderPath,
                                                                   subfolder.FolderColor,
                                                                   subfolder.ParentFolderId,
                                                                   subfolder.Owner,
                                                                   subfolder.Size,
                                                                   subfolder.FileCount,
                                                                   subfolder.AccessCount,
                                                                   subfolder.Tags,
                                                                   subfolder.IsActive,
                                                                   subfolder.CreatedOn,
                                                                   subfolder.CreatedBy
                                                               }).ToList(),

                                                              }).ToList(),

                                              Documents = (from doc in Files
                                                           where s.DocType == "Document" && doc.FileId == s.FolderOrFileId

                                                           select new
                                                           {
                                                               doc.FileId,
                                                               doc.FolderId,
                                                               doc.FilePath,
                                                               doc.ServerFilePath,
                                                               doc.Owner,
                                                               doc.Size,
                                                               doc.AccessCount,
                                                               doc.IsActive,
                                                               doc.CreatedOn,
                                                               doc.CreatedBy,
                                                           }).ToList(),




                                          })
                    .ToList();


                return Ok(new { success = true, data = shareAccessRecords });
                // return shareAccessRecords;
            }
            catch (Exception ex)
            {
                // Handle or log the exception as needed
                throw new Exception(ex.Message ?? "Network Error");
            }
        }
        [HttpGet("GetShareAccessDetailsByUser/{accessUserId}")]
        public async Task<IActionResult> GetShareAccessDetailsByUser(Guid accessUserId)
        {
            try
            {
                var shareAccessDetails = await _folderDataServices.GetShareAccessDetailsByUser(accessUserId);
                return Ok(new { success = true, data = shareAccessDetails });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetShareAccessDetails/{folderOrFileId}/{docType}")]
        public async Task<IActionResult> GetShareAccessDetails(int folderOrFileId, string docType)
        {
            try
            {
                var shareAccessDetails = await _folderDataServices.GetShareAccessDetails(folderOrFileId, docType);
                return Ok(new { success = true, data = shareAccessDetails });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CreateShareAccessByList")]
        public async Task<IActionResult> CreateShareAccessByList([FromBody] List<CreateShareDocAccessDTO> shareAccessList)
        {
            try
            {
                var result = await _folderDataServices.CreateShareAccessByList(shareAccessList);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT api/shareaccess/update
        [HttpPost("UpdateShareAccessBySadID")]
        public async Task<IActionResult> UpdateShareAccessBySadID([FromBody] UpdateShareDocAccessDTO updateDto)
        {
            try
            {
                var result = await _folderDataServices.UpdateShareAccessBySadID(updateDto);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // POST api/shareaccess/create/document
        [HttpPost("CreateShareAccess")]
        public async Task<IActionResult> CreateShareAccess(DocumentAccessCreateDTO createDto)
        {
            try
            {
                var result = await _folderDataServices.CreateShareAccess(createDto);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT api/shareaccess/update/document
        [HttpPost("UpdateShareAccess")]
        public async Task<IActionResult> UpdateShareAccess([FromBody] DocumentAccessUpdateDTO updateDto)
        {
            try
            {
                var result = await _folderDataServices.UpdateShareAccess(updateDto);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // DELETE api/shareaccess/delete
        [HttpPost("DeleteShareAccess")]
        public async Task<IActionResult> DeleteShareAccess([FromBody] DocumentAccessDeleteDTO dto)
        {
            try
            {
                var result = await _folderDataServices.DeleteShareAccess(dto);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // DELETE api/shareaccess/delete/{sdaId}
        [HttpPost("DeleteShareAccessBySdaID/{sdaId}")]
        public async Task<IActionResult> DeleteShareAccessBySdaID(int sdaId)
        {
            try
            {
                var result = await _folderDataServices.DeleteShareAccessBySdaID(sdaId);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        #endregion

        #region External Share Access

        [HttpPost("CreateExternalShareAccess")]
        public async Task<IActionResult> CreateExternalShareAccess(DocShareExtAccessCreateDTO shareExtAccessList)
        {
            try
            {
                var result = await _folderDataServices.CreateExternalShareAccess(shareExtAccessList);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CheckValidityofToken")]
        public async Task<IActionResult> CheckValidityofToken(TokenValidateDTO tokenData)
        {
            try
            {
                var result = await _folderDataServices.CheckValidityofToken(tokenData);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }


        [HttpPost("VerifytheDocAccessOtp")]
        public async Task<IActionResult> VerifytheDocAccessOtp(TokenOTPVerifyRequest tokenData)
        {
            try
            {
                var result = await _folderDataServices.VerifytheDocAccessOtp(tokenData);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetShareAccessByEmailId/{accessUserEmailId}")]
        public async Task<IActionResult> GetShareAccessByEmailId(string accessUserEmailId)
        {
            try
            {
                var accessData = await _folderDataServices.GetShareAccessByEmailId(accessUserEmailId);
                return Ok(new { success = true, data = accessData });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        #endregion

        //added by shafi
        #region Log
        [HttpGet("GetAccessedFolderLog")]
        public async Task<IActionResult> GetAccessedFolderLog()
        {
            try
            {
                string logDirectory = Path.Combine("Logs", "Accessed Folder Log");
                string logFilePath1 = Path.Combine(logDirectory, $"Accessed Folder Log{DateTime.Now:yyyy-MM-dd}.txt");
                if (!Directory.Exists(logDirectory))
                {
                    return Ok(new { success = false, message = "Log file not found." });
                }

                List<object> logEntries = new List<object>();
                string[] logFiles = Directory.GetFiles(logDirectory, "*.txt");

                foreach (string logFilePath in logFiles)
                {
                    using (StreamReader reader = new StreamReader(logFilePath))
                    {
                        string? line;
                        while ((line = await reader.ReadLineAsync()) != null)
                        {
                            var match = Regex.Match(line, @"Date:\s*(.+?)\s*~\|\~\s*Message:\s*(.+?)\s*}");
                            if (match.Success)
                            {
                                var split = match.Groups[1].Value.Split("~|~");
                                string dateString = match.Groups[1].Value;
                                string folderName = match.Groups[2].Value.Replace("Accessed Folder ", "");
                                string Date = split[0].Trim();
                                string UserData = split[1].Replace("  User Id: ", "");
                                //var UserId = split[1].Split("and");
                                var UserData1 = UserData.Split("and");
                                var UserId = UserData1[0];
                                var UserName1 = UserData1[1].Replace(" UserName : ", "");


                                DateTime.TryParseExact(dateString, "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime logDate);

                                logEntries.Add(new { Date = Date, UserId = UserId, UserName = UserName1, folderName = folderName });

                            }
                        }
                    }
                }

                return Ok(new { success = true, logs = logEntries });
            }
            catch (Exception ex)
            {
                return Ok(new { success = false, message = ex.Message });
            }
        }
        //added by shafi 
        [HttpGet("GetSharedDataLog")]
        public async Task<IActionResult> GetSharedDataLog()
        {
            try
            {
                string logDirectory = Path.Combine("Logs", "Share Access Log");
                string logFilePath1 = Path.Combine(logDirectory, $"Share Access Log{DateTime.Now:yyyy-MM-dd}.txt");
                var senderuserid = "";
                var sendername = "";
                var receiveruserid = "";
                var receiverusername = "";
                var fileorfoldername = "";
                if (!Directory.Exists(logDirectory))
                {
                    return Ok(new { success = false, message = "Log file not found." });
                }

                List<object> logEntries = new List<object>();
                string[] logFiles = Directory.GetFiles(logDirectory, "*.txt");

                foreach (string logFilePath in logFiles)
                {
                    using (StreamReader reader = new StreamReader(logFilePath))
                    {
                        string? line;
                        while ((line = await reader.ReadLineAsync()) != null)
                        {
                            var match = Regex.Match(line, @"Date:\s*(.+?)\s*~\|\~\s*Message:\s*(.+?)\s*}");
                            if (match.Success)
                            {
                                var split = match.Groups[1].Value.Split("~|~");
                                string dateString = match.Groups[1].Value;

                                senderuserid = split[1].Replace("  User Id: ", "");
                                var sddata = match.Groups[2].Value.Split("~|~");
                                fileorfoldername = sddata[0].Replace("Folder name ", "");
                                sendername = sddata[2].Replace(" Shared user name ", "").Trim();
                                receiveruserid = sddata[3].Replace(" to Access the Receiver UserId ", "").Trim();
                                receiverusername = sddata[4].Replace(" receiver user name ", "").Trim();
                                //string folderName = match.Groups[2].Value.Replace("Accessed Folder ", "");
                                string Date = split[0].Trim();
                                //string UserData = split[1].Replace("  User Id: ", "");
                                ////var UserId = split[1].Split("and");
                                //var UserData1 = UserData.Split("and");
                                //var UserId = UserData1[0];
                                //var UserName1 = UserData1[1].Replace(" UserName : ", "");



                                DateTime.TryParseExact(dateString, "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime logDate);

                                logEntries.Add(new
                                {
                                    Date = Date,
                                    SenderUserId = senderuserid,
                                    SenderUserName = sendername,
                                    ReceiverUserId = receiveruserid,
                                    ReceiverUserName = receiverusername,
                                    FolderOrFileName = fileorfoldername
                                });

                            }
                        }
                    }
                }

                return Ok(new { success = true, logs = logEntries });
            }
            catch (Exception ex)
            {
                return Ok(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetAdminCreatedFolderLog")]
        public async Task<IActionResult> GetAdminCreatedFolderLog()
        {
            try
            {
                string logDirectory = Path.Combine("Logs", "Admin Created Folder Log");
                string logFilePath1 = Path.Combine(logDirectory, $"Admin Created Folder Log{DateTime.Now:yyyy-MM-dd}.txt");
                var AdminUserId = "";
                var FolderName = "";
                var AuthorizedUserId = "";
                var AdminName = "";
                var AuthorizedUserName = "";
                if (!Directory.Exists(logDirectory))
                {
                    return Ok(new { success = false, message = "Log file not found." });
                }

                List<object> logEntries = new List<object>();
                string[] logFiles = Directory.GetFiles(logDirectory, "*.txt");

                foreach (string logFilePath in logFiles)
                {
                    using (StreamReader reader = new StreamReader(logFilePath))
                    {
                        string? line;
                        while ((line = await reader.ReadLineAsync()) != null)
                        {
                            var match = Regex.Match(line, @"Date:\s*(.+?)\s*~\|\~\s*Message:\s*(.+?)\s*}");
                            if (match.Success)
                            {
                                var split = match.Groups[1].Value.Split("~|~");
                                string dateString = match.Groups[1].Value;

                                AdminUserId = split[1].Replace("  User Id: ", "");
                                var sddata = match.Groups[2].Value.Split("~|~");
                                FolderName = sddata[0].Replace("Folder Name ", "");
                                AuthorizedUserId = sddata[1].Replace(" created for the user Id ", "");
                                AuthorizedUserName = sddata[2].Replace(" User Name ", "");
                                AdminName = sddata[4].Replace(" admin user name ", "");


                                //string folderName = match.Groups[2].Value.Replace("Accessed Folder ", "");
                                string Date = split[0].Trim();
                                //string UserData = split[1].Replace("  User Id: ", "");
                                ////var UserId = split[1].Split("and");
                                //var UserData1 = UserData.Split("and");
                                //var UserId = UserData1[0];
                                //var UserName1 = UserData1[1].Replace(" UserName : ", "");



                                DateTime.TryParseExact(dateString, "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime logDate);

                                logEntries.Add(new
                                {
                                    Date = Date,
                                    AdminUserId = AdminUserId,
                                    AdminName = AdminName,
                                    FolderName = FolderName,
                                    AuthorizedUserId = AuthorizedUserId,
                                    AuthorizedUserName = AuthorizedUserName,

                                });

                            }
                        }
                    }
                }

                return Ok(new { success = true, logs = logEntries });
            }
            catch (Exception ex)
            {
                return Ok(new { success = false, message = ex.Message });
            }
        }


        #endregion
        //added by shafi
        #region update is view 
        [HttpPost("UpdateIsViewStatus")]
        public async Task<IActionResult> UpdateIsViewStatus()
        {
            try
            {
                var expirydays = Convert.ToInt16(_configuration["NewFileorFolderExpiryDays"]);
                var thresholdDate = DateTime.Now.AddDays(-expirydays);

                // Perform the flag update directly in the database (EF Core ExecuteUpdate) instead of
                // loading every matching row into memory, flipping the flag, then saving change tracker
                // entries one by one. Same net effect, far fewer round trips and no entity materialization.
                await _dbContext.FolderData
                    .Where(f => f.CreatedOn <= thresholdDate && f.IsView == false)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(f => f.IsView, true));

                await _dbContext.FileData
                    .Where(f => f.CreatedOn <= thresholdDate && f.IsView == false)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(f => f.IsView, true));

                await _dbContext.ShareDocAccess
                    .Where(f => f.CreatedOn <= thresholdDate && f.IsView == false)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(f => f.IsView, true));

                await _dbContext.ExternalShareAccessHistory
                    .Where(f => f.CreatedOn <= thresholdDate && f.IsView == false)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(f => f.IsView, true));

                return Ok(new
                {
                    success = true,
                    message = "Is View Data Updated Successfully"
                });
            }
            catch (Exception ex)
            {
                return Ok(new
                {
                    success = false,
                    message = "An error occurred while updating folder view status.",
                    error = ex.Message
                });
            }
        }

        #endregion 
    }
}