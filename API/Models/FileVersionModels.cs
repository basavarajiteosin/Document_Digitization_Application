using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DDAAPI.Models
{
    // Archived (older) versions only. The live/current version is the FileData row itself.
    public class FileVersion
    {
        [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int VersionId { get; set; }
        public int FileId { get; set; }
        public int VersionNumber { get; set; }
        [Required] public string FileName { get; set; } = "";
        [Required] public string StoredPath { get; set; } = "";
        public string? ServerPath { get; set; }
        public long Size { get; set; }
        public string? Note { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime CreatedOn { get; set; }
    }

    public class UploadFileVersionDTO
    {
        public int FileId { get; set; }
        public IFormFile File { get; set; } = null!;
        public string? Note { get; set; }
        public int? ExpectedVersion { get; set; }
    }

    public class FileVersionDTO
    {
        public int VersionId { get; set; }          // 0 for the current version
        public int VersionNumber { get; set; }
        public string FileName { get; set; } = "";
        public long Size { get; set; }
        public string? Note { get; set; }
        public string? CreatedByName { get; set; }
        public DateTime CreatedOn { get; set; }
        public bool IsCurrent { get; set; }
    }

    public class FileVersionListDTO
    {
        public int FileId { get; set; }
        public string FileName { get; set; } = "";
        public int CurrentVersion { get; set; }
        public bool CanUpload { get; set; }
        public bool CanCheckOut { get; set; }
        public bool IsLocked { get; set; }
        public bool LockedByMe { get; set; }
        public string? LockedByName { get; set; }
        public DateTime? LockedOn { get; set; }
        public bool CanForceRelease { get; set; }
        public List<FileVersionDTO> Versions { get; set; } = new();
    }

}