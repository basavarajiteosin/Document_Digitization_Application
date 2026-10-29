using DDAAPI.Models;
using DDAAPI.Services;
using DDAAPI.Models;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace DDAAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GlobalAdminController : ControllerBase
    {
        private readonly IGlobalAdminService _globalAdminService;

        public GlobalAdminController(IGlobalAdminService globalAdminService)
        {
            _globalAdminService = globalAdminService;
        }

        [HttpGet("GetAllUsersDataLimit")]
        public async Task<IActionResult> GetAllUsersDataLimit()
        {
            return await _globalAdminService.GetAllUsersDataLimitAsync();
        }

        [HttpGet("GetUserDataLimitByUserId")]
        public async Task<IActionResult> GetUserDataLimitByUserId(string UserId)
        {
            return await _globalAdminService.GetUserDataLimitByUserIdAsync(UserId);
        }

        [HttpPost("SetOrUpdateUserLimit")]
        public async Task<IActionResult> SetOrUpdateUserLimit(UserStoragedto data)
        {
            return await _globalAdminService.SetOrUpdateUserLimitAsync(data);
        }

        [HttpPost("UpdateUsedDataStorage")]
        public async Task<IActionResult> UpdateUsedDataStorage()
        {
            return await _globalAdminService.UpdateUsedDataStorageAsync();
        }

        [HttpGet("GetAllFoldersAndFilesData")]
        public async Task<IActionResult> GetAllFoldersAndFilesData()
        {
            return await _globalAdminService.GetAllFoldersAndFilesDataAsync();
        }

        [HttpGet("GetAllDescendantFolderIds")]
        public IActionResult GetAllDescendantFolderIds(List<FolderData> allFolders, int parentFolderId)
        {
            // Purely synchronous work under the hood - no need for the async state machine overhead.
            return _globalAdminService.GetAllDescendantFolderIds(allFolders, parentFolderId);
        }

        [HttpGet("GetFolderSizeById")]
        public async Task<IActionResult> GetFolderSizeById(int folderId)
        {
            return await _globalAdminService.GetFolderSizeByIdAsync(folderId);
        }

        [HttpPost("UpdateFolderHideStatus")]
        public async Task<IActionResult> UpdateFolderHideStatus([FromBody] UpdateFolderHideStatusDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { status = false, message = "Invalid payload.", errors = ModelState });
            }

            try
            {
                var isUpdated = await _globalAdminService.UpdateFolderHideStatusAsync(dto);

                if (!isUpdated)
                {
                    return NotFound(new { status = false, message = "Folder not found or active status is false." });
                }

                string actionMessage = dto.IsHide ? "hidden" : "unhidden";
                return Ok(new { status = true, message = $"{dto.DocType} is now {actionMessage}." });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { status = false, message = ex.Message });
            }
        }

        [HttpGet("GetSharedListById/{id}")]
        public async Task<IActionResult> GetSharedListById(int id, [FromQuery] string? docType = null)
        {
            if (id <= 0)
            {
                return BadRequest(new { status = false, message = "Invalid ID." });
            }

            try
            {
                var result = await _globalAdminService.GetSharedListByIdAsync(id, docType);

                if (result == null || !result.Any())
                {
                    return Ok(new { status = false, message = "No shared records found." });
                }

                return Ok(new { status = true, data = result });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { status = false, message = ex.Message });
            }
        }
        [HttpPost("ToggleShareAccessStatus")]
        public async Task<IActionResult> ToggleShareAccessStatus([FromBody] ToggleShareAccessStatusDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { status = false, message = "Invalid payload.", errors = ModelState });
            }

            try
            {
                var isUpdated = await _globalAdminService.ToggleShareAccessStatusAsync(dto);

                if (!isUpdated)
                {
                    return NotFound(new { status = false, message = "Shared access record not found." });
                }

                string statusText = dto.IsActive ? "activated" : "deactivated";
                return Ok(new { status = true, message = $"Share access record successfully {statusText}." });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { status = false, message = ex.Message });
            }
        }

        // 2. Hard Delete Record Directly
        [HttpPost("DeleteShareAccess/{sdaId}")]
        public async Task<IActionResult> DeleteShareAccess(int sdaId)
        {
            if (sdaId <= 0)
            {
                return BadRequest(new { status = false, message = "Invalid SDAId." });
            }

            try
            {
                var isDeleted = await _globalAdminService.DeleteShareAccessRecordAsync(sdaId);

                if (!isDeleted)
                {
                    return NotFound(new { status = false, message = "Shared access record not found." });
                }

                return Ok(new { status = true, message = "Share access record permanently deleted." });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { status = false, message = ex.Message });
            }
        }

    }
}