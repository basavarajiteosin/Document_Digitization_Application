using DDAAPI.DbContexts;
using DDAAPI.Services;
using DDAAPI.Models;
using DDAAPI.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DDAAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FieldMasterController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _dbContext;
        private readonly EmailService _emailService;
        private readonly FieldMasterServices _fieldMasterServices;

        public FieldMasterController(IConfiguration configuration, AppDbContext dbContext, EmailService emailService, FieldMasterServices fieldMasterServices)
        {
            _configuration = configuration;
            _dbContext = dbContext;
            _emailService = emailService ?? throw new ArgumentNullException(nameof(emailService));
            _fieldMasterServices = fieldMasterServices;
        }

        #region  Division Master

        [HttpGet("GetAllDivisionMasters")]
        public async Task<IActionResult> GetAllDivisionMasters()
        {
            try
            {
                var divisionMasters = await _fieldMasterServices.GetAllDivisionMaster();
                return Ok(new { success = true, message = "Successfully retrieved division masters", data = divisionMasters });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetDivisionMasterById/{id}")]
        public async Task<IActionResult> GetDivisionMasterById(int id)
        {
            try
            {
                var divisionMaster = await _fieldMasterServices.GetDivisionMasterById(id);
                if (divisionMaster == null)
                    return NotFound(new { success = false, message = "DivisionMaster not found" });

                return Ok(new { success = true, message = "Successfully retrieved division master", data = divisionMaster });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CreateDivisionMaster")]
        public async Task<IActionResult> CreateDivisionMaster(DivisionMaster divisionMaster)
        {
            try
            {
                var createdDivisionMaster = await _fieldMasterServices.CreateDivisionMaster(divisionMaster);
                return Ok(new { success = true, message = "Created Successfully", data = createdDivisionMaster });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("UpdateDivisionMaster")]
        public async Task<IActionResult> UpdateDivisionMaster(DivisionMaster divisionMaster)
        {
            try
            {
                var updatedDivisionMaster = await _fieldMasterServices.UpdateDivisionMaster(divisionMaster);
                return Ok(new { success = true, message = "DivisionMaster updated successfully", data = updatedDivisionMaster });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("DeleteDivisionMaster/{id}")]
        public async Task<IActionResult> DeleteDivisionMaster(int id)
        {
            try
            {
                var deletedDivisionMaster = await _fieldMasterServices.DeleteDivisionMaster(id);
                return Ok(new { success = true, message = "DivisionMaster deleted successfully", data = deletedDivisionMaster });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        #endregion


        #region  EmailDomain Master

        [HttpGet("GetAllEmailDomains")]
        public async Task<IActionResult> GetAllEmailDomains()
        {
            try
            {
                var emailDomains = await _fieldMasterServices.GetAllEmailDomains();
                return Ok(new { success = true, message = "Successfully retrieved email domains", data = emailDomains });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetEmailDomainById/{id}")]
        public async Task<IActionResult> GetEmailDomainById(int id)
        {
            try
            {
                var emailDomain = await _fieldMasterServices.GetEmailDomainById(id);
                if (emailDomain == null)
                    return NotFound(new { success = false, message = "EmailDomain not found" });

                return Ok(new { success = true, message = "Successfully retrieved email domain", data = emailDomain });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CreateEmailDomain")]
        public async Task<IActionResult> CreateEmailDomain(EmailDomainMaster emailDomain)
        {
            try
            {
                var createdEmailDomain = await _fieldMasterServices.CreateEmailDomain(emailDomain);
                return Ok(new { success = true, message = "Created Successfully", data = createdEmailDomain });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("UpdateEmailDomain")]
        public async Task<IActionResult> UpdateEmailDomain(EmailDomainMaster emailDomain)
        {
            try
            {
                
                var updatedEmailDomain = await _fieldMasterServices.UpdateEmailDomain(emailDomain);
                return Ok(new { success = true, message = "EmailDomain updated successfully", data = updatedEmailDomain });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("DeleteEmailDomain/{id}")]
        public async Task<IActionResult> DeleteEmailDomain(int id)
        {
            try
            {
                var deletedEmailDomain = await _fieldMasterServices.DeleteEmailDomain(id);
                return Ok(new { success = true, message = "EmailDomain deleted successfully", data = deletedEmailDomain });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        #endregion



        #region  AccessTypeMaster

        [HttpGet("GetAllAccessTypeMasters")]
        public async Task<IActionResult> GetAllAccessTypeMasters()
        {
            try
            {
                var getAllAccessMasters = await _fieldMasterServices.GetAllAccessTypeMaster();
                return Ok(new { success = true, message = "Successfully retrieved AccessTypeMasters", data = getAllAccessMasters });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetAccessTypeMasterById/{id}")]
        public async Task<IActionResult> GetAccessTypeMasterById(int id)
        {
            try
            {
                var accessMaster = await _fieldMasterServices.GetAccessTypeMasterById(id);
                if (accessMaster == null)
                    return NotFound(new { success = false, message = "AccessType Master not found" });

                return Ok(new { success = true, message = "Successfully retrieved AccessTypeMaster", data = accessMaster });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CreateAccessTypeMaster")]
        public async Task<IActionResult> CreateAccessTypeMaster(AccessTypeMaster accessMaster)
        {
            try
            {
                var createdAccessTypeMaster = await _fieldMasterServices.CreateAccessTypeMaster(accessMaster);
                return Ok(new { success = true, message = "AccessTypeMaster Created Successfully", data = createdAccessTypeMaster });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("UpdateAccessTypeMaster")]
        public async Task<IActionResult> UpdateAccessTypeMaster(AccessTypeMaster accessMaster)
        {
            try
            {
                var updatedAccessTypeMaster = await _fieldMasterServices.UpdateAccessTypeMaster(accessMaster);
                return Ok(new { success = true, message = "AccessType Master updated successfully", data = updatedAccessTypeMaster });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("DeleteAccessTypeMaster/{id}")]
        public async Task<IActionResult> DeleteAccessTypeMaster(int id)
        {
            try
            {
                var deletedAccessTypeMaster = await _fieldMasterServices.DeleteAccessTypeMaster(id);
                return Ok(new { success = true, message = "AccessType Master deleted successfully", data = deletedAccessTypeMaster });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        #endregion


        #region ActionMasters

        [HttpGet("GetAllActionMasters")]
        public async Task<IActionResult> GetAllActionMasters()
        {
            try
            {
                var actionMasters = await _fieldMasterServices.GetAllActionMasters();
                return Ok(new { success = true, message = "Successfully retrieved ActionMasters", data = actionMasters });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetActionMasterById/{id}")]
        public async Task<IActionResult> GetActionMasterById(int id)
        {
            try
            {
                var actionMasters = await _fieldMasterServices.GetActionMasterById(id);
                if (actionMasters == null)
                    return NotFound(new { success = false, message = "ActionMasters not found" });

                return Ok(new { success = true, message = "Successfully retrieved ActionMasters", data = actionMasters });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CreateActionMaster")]
        public async Task<IActionResult> CreateActionMaster(ActionMaster actionMaster)
        {
            try
            {
                var createdActionMaster = await _fieldMasterServices.CreateActionMaster(actionMaster);
                return Ok(new { success = true, message = "Created Successfully", data = createdActionMaster });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("UpdateActionMaster")]
        public async Task<IActionResult> UpdateActionMaster(ActionMaster actionMaster)
        {
            try
            {
                var updatedActionMaster = await _fieldMasterServices.UpdateActionMaster(actionMaster);
                return Ok(new { success = true, message = "ActionMaster updated successfully", data = actionMaster });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("DeleteActionMaster/{id}")]
        public async Task<IActionResult> DeleteActionMaster(int id)
        {
            try
            {
                var deletedActionMaster = await _fieldMasterServices.DeleteActionMaster(id);
                return Ok(new { success = true, message = "ActionMaster deleted successfully", data = deletedActionMaster });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        #endregion


        #region DocExtMaster

        [HttpGet("GetAllDocExts")]
        public async Task<IActionResult> GetAllDocExts()
        {
            try
            {
                var getDocExts = await _fieldMasterServices.GetAllDocExts();
                return Ok(new { success = true, message = "Successfully retrieved DocExts", data = getDocExts });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetDocExtsById/{id}")]
        public async Task<IActionResult> GetDocExtsById(int id)
        {
            try
            {
                var getDocExt = await _fieldMasterServices.GetDocExtMasterById(id);
                if (getDocExt == null)
                    return NotFound(new { success = false, message = "DocExts not found" });

                return Ok(new { success = true, message = "Successfully retrieved DocExts", data = getDocExt });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CreateDocExts")]
        public async Task<IActionResult> CreateDocExts(DocExtMaster docext)
        {
            try
            {
                var createdDocExts = await _fieldMasterServices.CreateDocExtMaster(docext);
                return Ok(new { success = true, message = "Created DocExts Successfully", data = createdDocExts });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("UpdateDocExts")]
        public async Task<IActionResult> UpdateDocExts(DocExtMaster currency)
        {
            try
            {
                var updatedDocExts = await _fieldMasterServices.UpdateDocExtMaster(currency);
                return Ok(new { success = true, message = "DocExt updated successfully", data = updatedDocExts });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("DeleteDocExt/{id}")]
        public async Task<IActionResult> DeleteDocExt(int id)
        {
            try
            {
                var deletedDocExt = await _fieldMasterServices.DeleteDocExtMaster(id);
                return Ok(new { success = true, message = "DocExt deleted successfully", data = deletedDocExt });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        #endregion



        #region GroupMaster (Cohort Master)

        // Full listing (active + inactive) - drives the mapped table with its
        // Edit/Delete actions.
        [HttpGet("GetAllGroupMasters")]
        public async Task<IActionResult> GetAllGroupMasters()
        {
            try
            {
                var groups = await _fieldMasterServices.GetAllGroupMasters();
                return Ok(new { success = true, message = "Successfully retrieved groups", data = groups });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // Active-only listing - for cohort selection dropdowns elsewhere in the app.
        [HttpGet("GetActiveGroupMasters")]
        public async Task<IActionResult> GetActiveGroupMasters()
        {
            try
            {
                var groups = await _fieldMasterServices.GetActiveGroupMasters();
                return Ok(new { success = true, message = "Successfully retrieved active groups", data = groups });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetGroupMasterById/{id}")]
        public async Task<IActionResult> GetGroupMasterById(int id)
        {
            try
            {
                var group = await _fieldMasterServices.GetGroupMasterById(id);
                if (group == null)
                    return NotFound(new { success = false, message = "GroupMaster not found" });

                return Ok(new { success = true, message = "Successfully retrieved group", data = group });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CreateGroupMaster")]
        public async Task<IActionResult> CreateGroupMaster(GroupMasterCreateDTO input)
        {
            try
            {
                var createdGroup = await _fieldMasterServices.CreateGroupMaster(input);
                return Ok(new { success = true, message = "Group Created Successfully", data = createdGroup });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("UpdateGroupMaster")]
        public async Task<IActionResult> UpdateGroupMaster(GroupMasterUpdateDTO input)
        {
            try
            {
                var updatedGroup = await _fieldMasterServices.UpdateGroupMaster(input);
                return Ok(new { success = true, message = "Group updated successfully", data = updatedGroup });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // NOTE: this deactivates the group (IsActive = false) rather than hard-deleting
        // it - see the comment on FieldMasterServices.DeleteGroupMaster for why.
        [HttpPost("DeleteGroupMaster/{id}")]
        public async Task<IActionResult> DeleteGroupMaster(int id, [FromQuery] string? deletedBy = null)
        {
            try
            {
                var deletedGroup = await _fieldMasterServices.DeleteGroupMaster(id, deletedBy);
                return Ok(new { success = true, message = "Group deleted successfully", data = deletedGroup });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        #endregion
    }
}
