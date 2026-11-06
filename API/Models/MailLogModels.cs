using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DDAAPI.Models
{
    public class MailLog
    {
        [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int MailLogId { get; set; }
        [Required, MaxLength(100)] public string MailType { get; set; } = "";
        [MaxLength(256)] public string? ToEmail { get; set; }
        [MaxLength(500)] public string? Subject { get; set; }
        [Required, MaxLength(20)] public string Status { get; set; } = "Sent";
        [MaxLength(2000)] public string? ErrorMessage { get; set; }
        public DateTime CreatedOn { get; set; }
    }

    public class MailLogDTO
    {
        public int MailLogId { get; set; }
        public string MailType { get; set; } = "";
        public string? ToEmail { get; set; }
        public string? Subject { get; set; }
        public string Status { get; set; } = "";
        public string? ErrorMessage { get; set; }
        public DateTime Date { get; set; }
    }
}