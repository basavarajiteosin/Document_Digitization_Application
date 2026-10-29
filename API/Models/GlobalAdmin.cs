using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DDAAPI.Models
{
    public class GlobalAdmin
    {
    }
    public class UserStorage
    {
        [Key]
        public int Id { get; set; }
  
        public string? UserId { get; set; }
        public long? MaximumAllocatedStorage { get; set; }
        public long? UsedStorage { get; set; }
        public bool? LimitReachedStatus { get; set; }


        public DateTime CreatedOn { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? ModifiedOn { get; set; }
        public string? ModifiedBy { get; set; }
    }

    public class UserStoragedto
    {



        public string? UserId { get; set; }
        public long? MaximumAllocatedStorage { get; set; }
        //public long? UsedStorage { get; set; }
        //public bool? LimitReachedStatus { get; set; }

        public string? LoggedUserId { get; set; }
     
        
    }

}
