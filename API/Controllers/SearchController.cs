using DDAAPI.Models;
using DDAAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DDAAPI.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class SearchController : ControllerBase
    {
        private readonly SearchService _searchService;

        public SearchController(SearchService searchService)
        {
            _searchService = searchService;
        }

        // GET api/Search/Documents?query=invoice&docType=Document&extension=pdf&tag=finance&fromDate=2026-01-01&page=1
        [HttpGet("Documents")]
        public async Task<IActionResult> Documents([FromQuery] SearchRequestDTO req)
        {
            try
            {
                var result = await _searchService.SearchAsync(User.Identity?.Name, req);
                return Ok(new { success = true, data = result });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("SetFolderTags")]
        public async Task<IActionResult> SetFolderTags([FromBody] SetFolderTagsDTO dto)
        {
            try
            {
                var tags = await _searchService.SetFolderTagsAsync(User.Identity?.Name, dto);
                return Ok(new { success = true, message = "Tags updated", data = tags });
            }
            catch (SearchForbiddenException ex)
            {
                return StatusCode(403, new { success = false, message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}