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
        public string? SortBy { get; set; } = "created";  // relevance | name | created | size | type
        public string? SortDir { get; set; } = "desc";    // asc | desc
        public string? Owner { get; set; } = "All";       // All | Me | Others
        public double? MinSizeMB { get; set; }
        public double? MaxSizeMB { get; set; }
    }

    public class SearchFacetDTO
    {
        public string Key { get; set; } = "";
        public int Count { get; set; }
    }

    public class TagCountDTO
    {
        public string Tag { get; set; } = "";
        public int Count { get; set; }
    }

    public class SearchResultItemDTO
    {
        public int Id { get; set; }
        public string DocType { get; set; } = "";
        public string Name { get; set; } = "";
        public string Location { get; set; } = "";
        public string? Tags { get; set; }
        public string? OwnTags { get; set; }   // tags set on the item itself (files also show inherited ones in Tags)
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
        // navigation (open folder / open location)
        public int ContainerFolderId { get; set; }                 // folder to open (itself for a folder, parent for a file)
        public List<PathCrumbDTO> Path { get; set; } = new();     // breadcrumb root -> container
        public string NavTab { get; set; } = "current";           // current | shared
        public int? NavAccessType { get; set; }
        public string? NavOwnerId { get; set; }
    }

    public class PathCrumbDTO
    {
        public int FolderId { get; set; }
        public string FolderName { get; set; } = "";
    }

    public class SetTagsDTO
    {
        [Required] public string DocType { get; set; } = "Folder";   // Folder | Document
        [Required] public int Id { get; set; }
        public string? Tags { get; set; }
    }

    public class SearchResponseDTO
    {
        public List<SearchResultItemDTO> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
        public int FolderCount { get; set; }
        public int FileCount { get; set; }
        public List<SearchFacetDTO> Extensions { get; set; } = new();
    }

    public class SetFolderTagsDTO
    {
        [Required]
        public int FolderId { get; set; }
        public string? Tags { get; set; }   // comma separated
    }

    public class TagAccessDTO
    {
        public bool CanEdit { get; set; }
        public string? Reason { get; set; }
        public string? Tags { get; set; }
        public string Name { get; set; } = "";
    }
}