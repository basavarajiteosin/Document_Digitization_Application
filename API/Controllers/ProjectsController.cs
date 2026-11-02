using DDAAPI.Models;
using DDAAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DDAAPI.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ProjectsController : ControllerBase
    {
        private readonly ProjectService _svc;
        public ProjectsController(ProjectService svc) { _svc = svc; }

        private string? Emp => User.Identity?.Name;

        private async Task<IActionResult> Run<T>(Func<Task<T>> action, string? message = null)
        {
            try { return Ok(new { success = true, message, data = await action() }); }
            catch (ProjectForbiddenException ex) { return StatusCode(403, new { success = false, message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Unauthorized(new { success = false, message = ex.Message }); }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
            catch (Exception ex) { return BadRequest(new { success = false, message = ex.Message }); }
        }

        [HttpGet("List")]
        public Task<IActionResult> List() => Run(() => _svc.ListAsync(Emp));

        [HttpPost("Save")]
        public Task<IActionResult> Save([FromBody] SaveProjectDTO dto) =>
            Run(() => _svc.SaveAsync(Emp, dto), "Project saved");

        [HttpPost("Delete/{projectId}")]
        public Task<IActionResult> Delete(int projectId) =>
            Run(() => _svc.DeleteAsync(Emp, projectId), "Project deleted");

        [HttpPost("AssignItem")]
        public Task<IActionResult> AssignItem([FromBody] AssignProjectItemDTO dto) =>
            Run(() => _svc.AssignItemAsync(Emp, dto), "Assigned to project");

        [HttpPost("UnassignItem/{piId}")]
        public Task<IActionResult> UnassignItem(int piId) =>
            Run(() => _svc.UnassignItemAsync(Emp, piId), "Removed from project");
    }
}