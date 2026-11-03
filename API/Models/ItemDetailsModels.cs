namespace DDAAPI.Models
{
    public class AccessSummaryDTO
    {
        public int Total { get; set; }
        public int Active { get; set; }
        public int Inactive { get; set; }
        public int Removed { get; set; }
        public int External { get; set; }
    }

    public class ItemDetailsDTO
    {
        public string DocType { get; set; } = "";
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string Type { get; set; } = "";
        public string Path { get; set; } = "";
        public long SizeBytes { get; set; }
        public int SubFolderCount { get; set; }
        public int FileCount { get; set; }
        public string? OwnerEmail { get; set; }
        public string CreatedByName { get; set; } = "";
        public DateTime CreatedOn { get; set; }
        public string? ModifiedByName { get; set; }
        public DateTime? ModifiedOn { get; set; }
        public int CurrentVersion { get; set; }
        public string? Tags { get; set; }
        public bool IsHidden { get; set; }
        public bool CanManageAccess { get; set; }
        public AccessSummaryDTO Shared { get; set; } = new();
    }

    public class AccessEntryDTO
    {
        public string Kind { get; set; } = "Internal";      // Internal | External
        public int? EntryId { get; set; }                    // SDAId / ESAID (null for removed)
        public string UserName { get; set; } = "";
        public string? Email { get; set; }
        public int? AccessType { get; set; }
        public string AccessLabel { get; set; } = "Unknown";
        public string Status { get; set; } = "";             // Active | Inactive | Removed
        public string Source { get; set; } = "Manual";       // Manual | Project | External
        public DateTime? SharedOn { get; set; }
        public string? SharedByName { get; set; }
        public DateTime? ExpiresOn { get; set; }
        public DateTime? RemovedOn { get; set; }
        public string? RemovedByName { get; set; }
        public bool CanRemove { get; set; }
        public bool CanToggle { get; set; }
    }

    public class AccessResponseDTO
    {
        public string Name { get; set; } = "";
        public string DocType { get; set; } = "";
        public bool CanManage { get; set; }
        public AccessSummaryDTO Summary { get; set; } = new();
        public List<AccessEntryDTO> Entries { get; set; } = new();
    }

    public class RevokeAccessDTO
    {
        public string? DocType { get; set; }
        public int Id { get; set; }
        public string? Kind { get; set; }
        public int EntryId { get; set; }
    }

    public class ToggleAccessDTO
    {
        public string? DocType { get; set; }
        public int Id { get; set; }
        public int EntryId { get; set; }
        public bool IsActive { get; set; }
    }
}