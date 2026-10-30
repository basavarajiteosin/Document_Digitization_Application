using DDAAPI.Models;
using DDAAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DDAAPI.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class FileVersionController : ControllerBase
    {
        private readonly FileVersionService _svc;
        public FileVersionController(FileVersionService svc) { _svc = svc; }

        private string? Emp => User.Identity?.Name;

        private async Task<IActionResult> Run<T>(Func<Task<T>> action, string? message = null)
        {
            try { return Ok(new { success = true, message, data = await action() }); }
            catch (FileVersionForbiddenException ex) { return StatusCode(403, new { success = false, message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Unauthorized(new { success = false, message = ex.Message }); }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
            catch (Exception ex) { return BadRequest(new { success = false, message = ex.Message }); }
        }

        [HttpGet("List")]
        public Task<IActionResult> List([FromQuery] int fileId) => Run(() => _svc.ListAsync(Emp, fileId));

        [HttpPost("Upload")]
        public Task<IActionResult> Upload([FromForm] UploadFileVersionDTO dto) =>
            Run(() => _svc.UploadNewVersionAsync(Emp, dto), "New version uploaded");

        [HttpPost("Restore/{versionId}")]
        public Task<IActionResult> Restore(int versionId) =>
            Run(() => _svc.RestoreAsync(Emp, versionId), "Version restored");

        [HttpGet("Download")]
        public async Task<IActionResult> Download([FromQuery] int versionId)
        {
            try
            {
                var (path, name) = await _svc.GetVersionFileAsync(Emp, versionId);
                var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, FileOptions.Asynchronous);
                return new FileStreamResult(stream, "application/octet-stream") { FileDownloadName = name };
            }
            catch (FileVersionForbiddenException ex) { return StatusCode(403, new { success = false, message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Unauthorized(new { success = false, message = ex.Message }); }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
            catch (Exception ex) { return BadRequest(new { success = false, message = ex.Message }); }
        }
    }
}