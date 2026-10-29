using Newtonsoft.Json;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DDAAPI.Models
{

    public class FolderData
    {
        [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int FolderId { get; set; }
        [Required]
        public string FolderName { get; set; }
        public string FolderPath { get; set; }
        public string ServerFolderPath { get; set; }
        public string FolderColor { get; set; }
        public int? ParentFolderId { get; set; }
        public string Owner { get; set; }
        public long Size { get; set; }
        public int? FileCount { get; set; }
        public int? AccessCount { get; set; }
        public string? Tags { get; set; }
        public bool IsActive { get; set; }
        [Required]
        public DateTime CreatedOn { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? ModifiedOn { get; set; }
        public string? ModifiedBy { get; set; }
        public bool IsView { get; set; } = false;
        public bool IsHide { get; set; } = false;
        public string? HideBy { get; set; }
        public string? AuthorizedUserId { get; set; }

        // NEW (this change): folder versioning. Always mirrors the latest
        // FolderVersion.VersionNumber row for this folder. Defaults to 1 so
        // existing rows (via migration default) don't break.
        public int CurrentVersion { get; set; } = 1;
    }

    public class FolderCreateDTO
    {
        public string? FolderName { get; set; }
        public string? FolderColor { get; set; }
        public string? CreatedBy { get; set; }
        public string? AuthorizedUserId { get; set; }
    }

    public class SubFolderCreateDTO
    {
        public int ParentFolderId { get; set; }
        public string FolderName { get; set; }
        public string FolderColor { get; set; }
        public string CreatedBy { get; set; }
    }

    public class SubFolderCreateBehalfDTO
    {
        public int ParentFolderId { get; set; }
        public string FolderName { get; set; }
        public string FolderColor { get; set; }
        public string CreatedBy { get; set; }
        public string? StoregeUserId { get; set; }
    }

    public class FolderUpdateDTO
    {
        public int? FolderId { get; set; }
        public string? FolderName { get; set; }
        public string? FolderPath { get; set; }
        public string? ServerFolderPath { get; set; }
        public string? FolderColor { get; set; }
        public int? ParentFolderId { get; set; }
        public string? Tags { get; set; }
        public string? CreatedBy { get; set; }
    }
    public class FolderUpdateBehalfDTO
    {
        public int? FolderId { get; set; }
        public string? FolderName { get; set; }
        public string? FolderPath { get; set; }
        public string? ServerFolderPath { get; set; }
        public string? FolderColor { get; set; }
        public int? ParentFolderId { get; set; }
        public string? Tags { get; set; }
        public string? CreatedBy { get; set; }
        public string? StoregeUserId { get; set; }
    }

    public class FolderNameUpdateDTO
    {
        public int? FolderId { get; set; }
        public string? FolderName { get; set; }
        public string? FolderPath { get; set; }
        public string? FolderColor { get; set; }
        public int? ParentFolderId { get; set; }
        public string? CreatedBy { get; set; }
    }

    public class MoveToFolderDTO
    {
        public int FromFolderOrFileId { get; set; }
        public int ToFolderOrFileId { get; set; }

        [Required]
        [RegularExpression("Folder|Document", ErrorMessage = "DocType must be either 'Folder' or 'Document'.")]
        public string DocType { get; set; }
        public int? ParentFolderId { get; set; }
        public string? CreatedBy { get; set; }
    }

    public class SubFolderUpdateDTO
    {
        public int ParentFolderId { get; set; }
        public int FolderId { get; set; }
        public string FolderName { get; set; }
        public string FolderPath { get; set; }
        public string? FolderColor { get; set; }
        public string? Tags { get; set; }
        public string? CreatedBy { get; set; }
    }

    public class SubFolderUpdateBehalfDTO
    {
        public int ParentFolderId { get; set; }
        public int FolderId { get; set; }
        public string FolderName { get; set; }
        public string FolderPath { get; set; }
        public string? FolderColor { get; set; }
        public string? Tags { get; set; }
        public string? CreatedBy { get; set; }
        public string? StoregeUserId { get; set; }
    }

    public class FolderDeleteDTO
    {
        public int FolderId { get; set; }
        public string? FolderName { get; set; }
        public string? DeletedBy { get; set; }
    }

    public class SubFolderDeleteDTO
    {
        public int FolderId { get; set; }
        public string? FolderName { get; set; }
        public string? DeletedBy { get; set; }
    }

    public class ShareDocAccess
    {
        [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int SDAId { get; set; }

        [Required]
        public int FolderOrFileId { get; set; }
        public string DocType { get; set; }
        public int FileExistFolId { get; set; }
        public string FolderOrFileName { get; set; }
        public string FolderOrFilePath { get; set; }
        public string ServerFolderOrFilePath { get; set; }

        [Required]
        public Guid AccessUserId { get; set; }
        public int AccessType { get; set; }
        public string? PermissionLevel { get; set; }
        public bool? IsExpiryDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public bool? IsEncryptionKey { get; set; }
        public string? EncryptionKey { get; set; }

        public string? Comment { get; set; }
        public bool IsActive { get; set; }
        [Required]
        public DateTime CreatedOn { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? ModifiedOn { get; set; }
        public string? ModifiedBy { get; set; }
        //added by shafi 
        public bool IsView { get; set; } = false;
        public bool IsHide { get; set; } = false;
        public string? HideBy { get; set; }

    }


    public class ExternalShareAccessHistory
    {
        [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int ESAID { get; set; }
        [Required]
        public int FolderOrFileId { get; set; }
        public string DocType { get; set; }
        public int FileExistFolId { get; set; }
        public string Token { get; set; }
        public string EmailAddress { get; set; }
        public string FolderOrFileName { get; set; }
        public string FolderOrFilePath { get; set; }
        public string ServerFolderOrFilePath { get; set; }
        public int AccessType { get; set; }
        public bool? IsExpiryDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public bool? IsEncryptionKey { get; set; }
        public string? EncryptionKey { get; set; }
        public DateTime ExpireOn { get; set; }
        public bool IsUsed { get; set; }
        public string? Comment { get; set; }

        [Required]
        public DateTime CreatedOn { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? UsedOn { get; set; }
        public string? UsedBy { get; set; }
        public bool IsView { get; set; } = false;

    }

    public class ExternalShareAccessViewData
    {
        public int ESAID { get; set; }
        public int FolderOrFileId { get; set; }
        public string DocType { get; set; }
        public int FileExistFolId { get; set; }
        public string? FoldeOrFileName { get; set; }
        public string? FolderOrFilePath { get; set; }
        public string? ServerFolderOrFilePath { get; set; }
        public string? FolderColor { get; set; }
        public string Token { get; set; }
        public string EmailAddress { get; set; }
        public int AccessType { get; set; }
        public string? Comment { get; set; }
        public bool? IsExpiryDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public bool? IsEncryptionKey { get; set; }
        public string? EncryptionKey { get; set; }
        public DateTime ExpireOn { get; set; }
        public bool IsUsed { get; set; }
        public DateTime CreatedOn { get; set; }
        public string? CreatedBy { get; set; }
        public long? FolderSize { get; set; }
        public int? FolderFilesCount { get; set; }
        public long? FileSize { get; set; }
        public int? SubFoldersCount { get; set; }
        public bool IsView { get; set; } = false;

    }



    public class DocShareExtAccessCreateDTO
    {
        public int FolderOrFileId { get; set; }

        [Required]
        [RegularExpression("Folder|Document", ErrorMessage = "DocType must be either 'Folder' or 'Document'.")]
        public string DocType { get; set; }
        public int FileExistFolId { get; set; }
        [Required]
        public List<string> AccessEmail { get; set; }
        public int AccessType { get; set; }
        public bool? IsExpiryDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public bool? IsEncryptionKey { get; set; }
        public string? EncryptionKey { get; set; }
        public string? Comments { get; set; }
        public string? siteURL { get; set; }
        public string? CreatedBy { get; set; }
    }

    public class TokenResponceForDocumentData
    {
        public int ESAID { get; set; }
        public int FolderOrFileId { get; set; }
        public string DocType { get; set; }
        public int FileExistFolId { get; set; }
        public string? FoldeOrFileName { get; set; }
        public string? FolderOrFilePath { get; set; }
        public string? ServerFolderOrFilePath { get; set; }
        public string? FolderColor { get; set; }
        public int AccessType { get; set; }
        public string? PermissionLevel { get; set; }
        public bool? IsExpiryDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public bool? IsEncryptionKey { get; set; }
        public string? EncryptionKey { get; set; }
        public string? Comment { get; set; }
        public DateTime CreatedOn { get; set; }
        public string? CreatedBy { get; set; }
    }

    public class TokenValidateDTO
    {
        public int ESAID { get; set; }
        public string Token { get; set; }
        [Required]
        [EmailAddress]
        public string AccessEmail { get; set; }
    }

    public class ShareDocAccessViewData
    {
        public int SDAId { get; set; }
        public int FolderOrFileId { get; set; }
        public string DocType { get; set; }
        public int FileExistFolId { get; set; }
        public string? FoldeOrFileName { get; set; }
        public string? FolderOrFilePath { get; set; }
        public string? ServerFolderOrFilePath { get; set; }
        public string? FolderColor { get; set; }
        public int AccessType { get; set; }
        public string? PermissionLevel { get; set; }
        public bool? IsExpiryDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public bool? IsEncryptionKey { get; set; }
        public string? EncryptionKey { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedOn { get; set; }
        public string? CreatedBy { get; set; }
        public int? ParentFolderCount { get; set; }
        public int? ParentFolderFilesCount { get; set; }
        public int? SubFolderCount { get; set; }
        public List<string>? SubFolderFilesCount { get; set; }
        public long? ParentFolderSize { get; set; }
        public bool IsView { get; set; } = false;
        public bool IsHide { get; set; } = false;
        public string? HideBy { get; set; }
        public long? Size { get; set; }

    }

    public class CreateShareDocAccessDTO
    {
        public int FolderOrFileId { get; set; }

        [Required]
        [RegularExpression("Folder|Document", ErrorMessage = "DocType must be either 'Folder' or 'Document'.")]
        public string DocType { get; set; }
        public int FileExistFolId { get; set; }
        public Guid AccessUserId { get; set; }
        public int AccessType { get; set; }
        public bool? IsExpiryDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public bool? IsEncryptionKey { get; set; }
        public string? EncryptionKey { get; set; }
        public string? CreatedBy { get; set; }
    }


    public class UpdateShareDocAccessDTO
    {
        public int SDAId { get; set; }
        public int FolderOrFileId { get; set; }

        [Required]
        [RegularExpression("Folder|Document", ErrorMessage = "DocType must be either 'Folder' or 'Document'.")]
        public string DocType { get; set; }
        public int FileExistFolId { get; set; }
        public Guid AccessUserId { get; set; }
        public int AccessType { get; set; }
        public string? PermissionLevel { get; set; }
        public bool? IsExpiryDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public bool? IsEncryptionKey { get; set; }
        public string? EncryptionKey { get; set; }
        public string? CreatedBy { get; set; }
    }


    public class DocumentAccessCreateDTO
    {
        public int FolderOrFileId { get; set; }

        [Required]
        [RegularExpression("Folder|Document", ErrorMessage = "DocType must be either 'Folder' or 'Document'.")]
        public string DocType { get; set; }
        public int FileExistFolId { get; set; }
        public List<string> AccessUserId { get; set; }
        public int AccessType { get; set; }
        public bool? IsExpiryDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public bool? IsEncryptionKey { get; set; }
        public string? EncryptionKey { get; set; }
        public string? Comment { get; set; }
        public string? CreatedBy { get; set; }
    }
    public class DocumentAccessUpdateDTO
    {
        public int FolderOrFileId { get; set; }

        [Required]
        [RegularExpression("Folder|Document", ErrorMessage = "DocType must be either 'Folder' or 'Document'.")]
        public string DocType { get; set; }
        public int FileExistFolId { get; set; }
        public List<Guid> AccessUserId { get; set; }
        public int AccessType { get; set; }
        public bool? IsExpiryDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public bool? IsEncryptionKey { get; set; }
        public string? EncryptionKey { get; set; }
        public string? CreatedBy { get; set; }
    }

    public class DocumentAccessDeleteDTO
    {
        public int FolderOrFileId { get; set; }

        [Required]
        [RegularExpression("Folder|Document", ErrorMessage = "DocType must be either 'Folder' or 'Document'.")]
        public string DocType { get; set; }
        public int? FileExistFolId { get; set; }
    }

    public class FileData
    {
        [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int FileId { get; set; }
        public int FolderId { get; set; }
        [Required]
        public string FileName { get; set; }
        public string FilePath { get; set; }
        public string ServerFilePath { get; set; }
        public string Owner { get; set; }
        public long Size { get; set; }
        public int? AccessCount { get; set; }
        public bool IsActive { get; set; }

        [Required]
        public DateTime CreatedOn { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? ModifiedOn { get; set; }
        public string? ModifiedBy { get; set; }
        public bool IsView { get; set; } = false;
        public bool IsHide { get; set; } = false;
        public string? HideBy { get; set; }

    }

    public class FileDataDTO
    {
        public int FileId { get; set; }
        public string FileName { get; set; }
        public string FilePath { get; set; }
        public string ServerFilePath { get; set; }
        public long Size { get; set; }
        public bool IsActive { get; set; }
    }


    public class CreateFileDataDTO
    {
        public int FolderId { get; set; }
        public IFormFile File { get; set; }
        public string? CreatedBy { get; set; }
    }

    public class CreateFilesDataDTO
    {
        public int FolderId { get; set; }
        public List<IFormFile> Files { get; set; }
        public string? CreatedBy { get; set; }
    }

    public class CreateFilesBehalfDataDTO
    {
        public int FolderId { get; set; }
        public List<IFormFile> Files { get; set; }
        public string? CreatedBy { get; set; }
        public string? StoregeUserId { get; set; }
    }

    public class UpdateFileDataDTO
    {
        public int FileId { get; set; }
        public int FolderId { get; set; }
        public string FileName { get; set; }
        public IFormFile File { get; set; }
        public string FilePath { get; set; }
        public string? CreatedBy { get; set; }
    }

    public class UpdateFileNameDataDTO
    {
        public int FileId { get; set; }
        public int FolderId { get; set; }
        public string FileName { get; set; }
        public string FilePath { get; set; }
        public string? CreatedBy { get; set; }
    }

    public class DivisionMaster
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int DivisionId { get; set; }
        public string? Description { get; set; }
    }

    public class EmailDomainMaster
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int EmailDomainId { get; set; }
        public string? Domain { get; set; }
    }

    public class AccessTypeMaster
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int AccessId { get; set; }
        public string? AccessDec { get; set; }
    }
    public class ActionMaster
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int AId { get; set; }
        public string? ActionDesc { get; set; }
    }

    public class DocExtMaster
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int DEId { get; set; }
        public string? ExtType { get; set; }
    }

    public class GroupMaster
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int GMId { get; set; }
        public string GroupName { get; set; }
        public string? TagName { get; set; }

        // Comma-separated list of selected user IDs (kept as a flat string to match
        // this table's simple-master style; use GroupMasterViewDTO.UserIds for the
        // parsed List<string> version returned to the UI).
        public string? GroupUserIds { get; set; }

        public bool IsActive { get; set; }
        public DateTime CreatedOn { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? ModifiedOn { get; set; }
        public string? ModifiedBy { get; set; }
    }

    // Request DTO for creating a group - takes the user selection as a proper list
    // instead of asking the caller to pre-join it into a comma string.
    public class GroupMasterCreateDTO
    {
        [Required]
        public string GroupName { get; set; }
        public string? TagName { get; set; }
        public List<string>? UserIds { get; set; }
        public string? CreatedBy { get; set; }
    }

    public class GroupMasterUpdateDTO
    {
        [Required]
        public int GMId { get; set; }
        [Required]
        public string GroupName { get; set; }
        public string? TagName { get; set; }
        public bool IsActive { get; set; }
        public List<string>? UserIds { get; set; }
        public string? ModifiedBy { get; set; }
    }

    // Response shape - GroupUserIds is parsed back into a List<string> so the UI
    // doesn't have to split the comma string itself.
    public class GroupMasterViewDTO
    {
        public int GMId { get; set; }
        public string GroupName { get; set; }
        public string? TagName { get; set; }
        public List<string> UserIds { get; set; } = new();
        public bool IsActive { get; set; }
        public DateTime CreatedOn { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? ModifiedOn { get; set; }
        public string? ModifiedBy { get; set; }
    }

    public class FileSystemItem
    {
        // Common fields for both FileData and FolderData
        public int Id { get; set; }
        public string? FolderName { get; set; }
        public string? FileName { get; set; }
        public string? FilePath { get; set; }
        public string? ServerFilePath { get; set; }
        public string? ServerFolderPath { get; set; }
        public string? FolderColor { get; set; }
        public int? ParentFolderId { get; set; }
        public string? Owner { get; set; }
        public long? Size { get; set; }
        public int? AccessCount { get; set; }
        public string? Tags { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedOn { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? ModifiedOn { get; set; }
        public string? ModifiedBy { get; set; }

        // Additional property to distinguish between File and Folder
        public FileSystemItemType ItemType { get; set; }
    }

    public enum FileSystemItemType
    {
        File,
        Folder
    }

    public class TokenVerifyOtpHistory
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int TVId { get; set; }
        public string? Email { get; set; }
        public string OTP { get; set; }
        public bool OTPIsActive { get; set; }
        public string CreatedBy { get; set; }
        public DateTime? CreatedOn { get; set; }
        public DateTime ExpiryOn { get; set; }
    }


    public class TokenOTPVerifyRequest
    {
        public int ESAID { get; set; }
        public string Email { get; set; }
        public string Otp { get; set; }
    }

    public class UpdateFolderHideStatusDto
    {
        [Required]
        public int FolderIdorFileId { get; set; }

        [Required]
        public bool IsHide { get; set; }
        [Required]
        public string DocType { get; set; } //Document or Folder

        [Required]
        public string HideByUserId { get; set; }
    }

    public class ToggleShareAccessStatusDto
    {
        [Required]
        public int SDAId { get; set; }

        [Required]
        public bool IsActive { get; set; }

        [Required]
        public string ModifiedByUserId { get; set; }
    }

    // =====================================================================
    // NEW (this change): Employee-wise access reporting
    // Records every "view/open", "download", "edit", "update" and "share" of a
    // folder or file - deduplicated per (user, item, action) so repeated views
    // don't create unbounded rows. See ReportService.LogFolderAccessAsync for
    // the upsert logic that increments AccessCount instead of inserting again.
    // =====================================================================
    public class FolderAccessLog
    {
        [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int AccessLogId { get; set; }

        [Required]
        public int FolderOrFileId { get; set; }

        [Required]
        [RegularExpression("Folder|Document", ErrorMessage = "DocType must be either 'Folder' or 'Document'.")]
        public string DocType { get; set; }

        public string? FolderOrFileName { get; set; }

        [Required]
        public string AccessedByUserId { get; set; }

        public string? AccessedByUserName { get; set; }

        // View | Download | Edit | Update | Share
        [Required]
        public string AccessType { get; set; }

        // NEW: how many times this exact (user, item, action) combination has
        // happened. Incremented on every repeat instead of inserting a new row.
        [Required]
        public int AccessCount { get; set; } = 1;

        [Required]
        public DateTime FirstAccessedOn { get; set; }

        // Timestamp of the most recent occurrence. (Kept as "AccessedOn" for
        // backward compatibility with the column name used by earlier queries -
        // treat it as "LastAccessedOn" going forward.)
        [Required]
        public DateTime AccessedOn { get; set; }
    }

    // View model returned by the Employee-wise Folder Access report
    public class EmployeeFolderAccessReportDTO
    {
        public string UserId { get; set; }
        public string? UserName { get; set; }
        public int TotalAccessCount { get; set; }
        public int ViewCount { get; set; }
        public int DownloadCount { get; set; }
        public int EditCount { get; set; }
        public int UpdateCount { get; set; }
        public int ShareCount { get; set; }
        public DateTime? LastAccessedOn { get; set; }
        public List<FolderAccessDetailDTO> AccessDetails { get; set; } = new();
    }

    public class FolderAccessDetailDTO
    {
        public int FolderOrFileId { get; set; }
        public string DocType { get; set; }
        public string? FolderOrFileName { get; set; }
        public string AccessType { get; set; }
        public int AccessCount { get; set; }
        public DateTime FirstAccessedOn { get; set; }
        public DateTime LastAccessedOn { get; set; }
    }

    // =====================================================================
    // NEW (this change): Folder versioning
    // A new row is inserted every time a folder is created, renamed, moved,
    // updated, has a subfolder added under it, or has a file added/updated in it.
    // FolderData.CurrentVersion always points at the latest VersionNumber.
    // =====================================================================
    public class FolderVersion
    {
        [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int VersionId { get; set; }

        [Required]
        public int FolderId { get; set; }

        [Required]
        public int VersionNumber { get; set; }

        public string? FolderName { get; set; }
        public string? FolderPath { get; set; }
        public string? ServerFolderPath { get; set; }
        public int? ParentFolderId { get; set; }

        // Created | Renamed | Moved | Updated | SubFolderAdded | FileAdded | FileUpdated | FileRenamed
        [Required]
        public string ChangeType { get; set; }

        // NEW: name of the subfolder/file that triggered this version (when applicable),
        // e.g. "Invoice.pdf" for a FileAdded entry, so the history reads clearly.
        public string? AffectedItemName { get; set; }

        public string? ModifiedBy { get; set; }

        [Required]
        public DateTime ModifiedOn { get; set; }

        public string? Remarks { get; set; }
    }

    public class FolderVersionDTO
    {
        public int VersionId { get; set; }
        public int FolderId { get; set; }
        public int VersionNumber { get; set; }
        public string? FolderName { get; set; }
        public string? FolderPath { get; set; }
        public string? ServerFolderPath { get; set; }
        public int? ParentFolderId { get; set; }
        public string ChangeType { get; set; }
        public string? AffectedItemName { get; set; }
        public string? ModifiedBy { get; set; }
        public DateTime ModifiedOn { get; set; }
        public string? Remarks { get; set; }
    }

    // =====================================================================
    // NEW (this change): Combined Ownership + Access history log
    // One row per ownership change or share-access grant/update/revoke,
    // for a folder or a document.
    // =====================================================================
    public class OwnershipAccessHistory
    {
        [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int HistoryId { get; set; }

        [Required]
        public int FolderOrFileId { get; set; }

        [Required]
        [RegularExpression("Folder|Document", ErrorMessage = "DocType must be either 'Folder' or 'Document'.")]
        public string DocType { get; set; }

        // OwnershipAssigned | OwnershipTransferred | Modified | AccessGranted | AccessUpdated | AccessRevoked
        [Required]
        public string ActionType { get; set; }

        public string? PreviousOwner { get; set; }
        public string? NewOwner { get; set; }

        public Guid? AccessUserId { get; set; }
        public string? PermissionLevel { get; set; }

        public string? ActionBy { get; set; }

        [Required]
        public DateTime ActionOn { get; set; }

        public string? Remarks { get; set; }
    }

    public class OwnershipAccessHistoryDTO
    {
        public int HistoryId { get; set; }
        public int FolderOrFileId { get; set; }
        public string DocType { get; set; }
        public string? FolderOrFileName { get; set; }
        public string ActionType { get; set; }
        public string? PreviousOwner { get; set; }
        public string? NewOwner { get; set; }
        public Guid? AccessUserId { get; set; }
        public string? PermissionLevel { get; set; }
        public string? ActionBy { get; set; }
        public DateTime ActionOn { get; set; }
        public string? Remarks { get; set; }
    }

    // NEW (this change): request payload for transferring folder ownership.
    public class TransferOwnershipDTO
    {
        [Required]
        public int FolderId { get; set; }

        [Required]
        public string NewOwnerId { get; set; }

        [Required]
        public string TransferredBy { get; set; }

        public string? Remarks { get; set; }
    }

}