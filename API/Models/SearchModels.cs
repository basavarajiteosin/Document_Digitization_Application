using System.ComponentModel.DataAnnotations;

namespace DDAAPI.Models
{
    public class SearchRequestDTO
    {
        public string? Query { get; set; }
        public string? DocType { get; set; } = "All";   // All | Folder | Document
        public string? Extension { get; set; }           // e.g. pdf
        public string? Tag { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 10;
    }

    public class SearchResultItemDTO
    {
        public int Id { get; set; }
        public string DocType { get; set; } = "";
        public string Name { get; set; } = "";
        public string Location { get; set; } = "";
        public string? Tags { get; set; }
        public string? Extension { get; set; }
        public long? Size { get; set; }
        public string? CreatedById { get; set; }
        public string? CreatedByName { get; set; }
        public DateTime CreatedOn { get; set; }
        public string Source { get; set; } = "";
        public string? ServerPath { get; set; }
        public string? FolderColor { get; set; }
        public bool IsHide { get; set; }
        public bool CanEditTags { get; set; }
    }

    public class SearchResponseDTO
    {
        public List<SearchResultItemDTO> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }

    public class SetFolderTagsDTO
    {
        [Required]
        public int FolderId { get; set; }
        public string? Tags { get; set; }   // comma separated
    }
}