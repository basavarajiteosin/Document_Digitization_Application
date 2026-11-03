using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DDAAPI.Models
{
    public class Project
    {
        [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int ProjectId { get; set; }
        [Required, MaxLength(200)] public string ProjectName { get; set; } = "";
        [MaxLength(1000)] public string? Description { get; set; }
        [MaxLength(500)] public string? DivisionIds { get; set; }  
        public bool IsActive { get; set; } = true;
        public DateTime CreatedOn { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? ModifiedOn { get; set; }
        public string? ModifiedBy { get; set; }
    }

    public class ProjectMember
    {
        [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int PMId { get; set; }
        public int ProjectId { get; set; }
        public Guid UserId { get; set; }
        public DateTime AddedOn { get; set; }
        public string? AddedBy { get; set; }
    }

    public class ProjectItem
    {
        [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int PIId { get; set; }
        public int ProjectId { get; set; }
        public int FolderOrFileId { get; set; }
        [Required] public string DocType { get; set; } = "";   // Folder | Document
        public int AccessType { get; set; }                     // 1 Read-only, 2 Read/Write, 3 Read/Write/Download
        public string? AssignedBy { get; set; }
        public DateTime AssignedOn { get; set; }
    }

    public class SaveProjectDTO
    {
        public int? ProjectId { get; set; }
        public string? ProjectName { get; set; }
        public string? Description { get; set; }
        public List<int>? DivisionIds { get; set; }
        public bool IsActive { get; set; } = true;
        public List<string>? UserIds { get; set; }
    }

    public class AssignProjectItemDTO
    {
        public int ProjectId { get; set; }
        public string? DocType { get; set; }
        public int FolderOrFileId { get; set; }
        public int AccessType { get; set; }
    }

    public class ProjectMemberDTO
    {
        public string UserId { get; set; } = "";
        public string Name { get; set; } = "";
    }

    public class ProjectItemDTO
    {
        public int PIId { get; set; }
        public string DocType { get; set; } = "";
        public int FolderOrFileId { get; set; }
        public string Name { get; set; } = "";
        public int AccessType { get; set; }
    }

    public class ProjectDTO
    {
        public int ProjectId { get; set; }
        public string ProjectName { get; set; } = "";
        public string? Description { get; set; }
        public List<int> DivisionIds { get; set; } = new();
        public List<string> DivisionNames { get; set; } = new();
        public bool IsActive { get; set; }
        public DateTime CreatedOn { get; set; }
        public List<ProjectMemberDTO> Members { get; set; } = new();
        public List<ProjectItemDTO> Items { get; set; } = new();
    }
}