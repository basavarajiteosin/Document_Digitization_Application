using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DDAAPI.Models
{
    public class DocComment
    {
        [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int CommentId { get; set; }
        [Required] public int FolderOrFileId { get; set; }
        [Required, MaxLength(20)] public string DocType { get; set; } = string.Empty; // Folder | Document
        public int? ParentCommentId { get; set; }
        [Required, MaxLength(2000)] public string CommentText { get; set; } = string.Empty;
        [Required, MaxLength(100)] public string CreatedBy { get; set; } = string.Empty;
        [Required] public DateTime CreatedOn { get; set; }
        public DateTime? ModifiedOn { get; set; }
        public bool IsResolved { get; set; }
        [MaxLength(100)] public string? ResolvedBy { get; set; }
        public DateTime? ResolvedOn { get; set; }
        public bool IsDeleted { get; set; }
    }

    public class DocReview
    {
        [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int ReviewId { get; set; }
        [Required] public int FolderOrFileId { get; set; }
        [Required, MaxLength(20)] public string DocType { get; set; } = string.Empty;
        [Required, MaxLength(100)] public string RequestedBy { get; set; } = string.Empty;
        [Required, MaxLength(100)] public string ReviewerId { get; set; } = string.Empty;
        [Required, MaxLength(30)] public string Status { get; set; } = "Pending"; // Pending|Approved|ChangesRequested|Cancelled
        [MaxLength(1000)] public string? RequestMessage { get; set; }
        [MaxLength(1000)] public string? ReviewerRemarks { get; set; }
        [Required] public DateTime RequestedOn { get; set; }
        public DateTime? ReviewedOn { get; set; }
    }

    public class AddCommentDTO
    {
        public string? DocType { get; set; }
        public int FolderOrFileId { get; set; }
        public string? CommentText { get; set; }
        public int? ParentCommentId { get; set; }
    }
    public class EditCommentDTO { public int CommentId { get; set; } public string? CommentText { get; set; } }
    public class ResolveCommentDTO { public int CommentId { get; set; } public bool IsResolved { get; set; } }
    public class RequestReviewDTO
    {
        public string? DocType { get; set; }
        public int FolderOrFileId { get; set; }
        public string? ReviewerId { get; set; }
        public string? RequestMessage { get; set; }
    }
    public class SubmitReviewDTO { public int ReviewId { get; set; } public string? Decision { get; set; } public string? Remarks { get; set; } }

    public class CommentDTO
    {
        public int CommentId { get; set; }
        public int? ParentCommentId { get; set; }
        public string CommentText { get; set; } = "";
        public string CreatedBy { get; set; } = "";
        public string CreatedByName { get; set; } = "";
        public DateTime CreatedOn { get; set; }
        public DateTime? ModifiedOn { get; set; }
        public bool IsResolved { get; set; }
        public string? ResolvedByName { get; set; }
        public bool IsDeleted { get; set; }
        public bool CanEdit { get; set; }
        public bool CanDelete { get; set; }
    }

    public class ReviewDTO
    {
        public int ReviewId { get; set; }
        public int FolderOrFileId { get; set; }
        public string DocType { get; set; } = "";
        public string ItemName { get; set; } = "";
        public string RequestedBy { get; set; } = "";
        public string RequestedByName { get; set; } = "";
        public string ReviewerId { get; set; } = "";
        public string ReviewerName { get; set; } = "";
        public string Status { get; set; } = "";
        public string? RequestMessage { get; set; }
        public string? ReviewerRemarks { get; set; }
        public DateTime RequestedOn { get; set; }
        public DateTime? ReviewedOn { get; set; }
        public bool CanDecide { get; set; }
        public bool CanCancel { get; set; }
    }
}
