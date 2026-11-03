using DDAAPI.Models;
using DDAAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DDAAPI.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ItemDetailsController : ControllerBase
    {
        private readonly ItemDetailsService _svc;
        public ItemDetailsController(ItemDetailsService svc) { _svc = svc; }

        private string? Emp => User.Identity?.Name;

        private IActionResult Fail(Exception ex) => ex switch
        {
            ItemDetailsForbiddenException => StatusCode(403, new { success = false, message = ex.Message }),
            UnauthorizedAccessException => Unauthorized(new { success = false, message = ex.Message }),
            KeyNotFoundException => NotFound(new { success = false, message = ex.Message }),
            _ => BadRequest(new { success = false, message = ex.Message })
        };

        private async Task<IActionResult> Run<T>(Func<Task<T>> action, string? message = null)
        {
            try { return Ok(new { success = true, message, data = await action() }); }
            catch (Exception ex) { return Fail(ex); }
        }

        [HttpGet("Get")]
        public Task<IActionResult> Get([FromQuery] string docType, [FromQuery] int id) =>
            Run(() => _svc.GetDetailsAsync(Emp, docType, id));

        [HttpGet("Access")]
        public Task<IActionResult> Access([FromQuery] string docType, [FromQuery] int id) =>
            Run(() => _svc.GetAccessAsync(Emp, docType, id));

        [HttpPost("Revoke")]
        public Task<IActionResult> Revoke([FromBody] RevokeAccessDTO dto) =>
            Run(() => _svc.RevokeAsync(Emp, dto), "Access removed");

        [HttpPost("Toggle")]
        public Task<IActionResult> Toggle([FromBody] ToggleAccessDTO dto) =>
            Run(() => _svc.ToggleAsync(Emp, dto), "Access updated");

        [HttpGet("Export")]
        public async Task<IActionResult> Export([FromQuery] string docType, [FromQuery] int id)
        {
            try
            {
                var (bytes, name) = await _svc.ExportAsync(Emp, docType, id);
                return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name);
            }
            catch (Exception ex) { return Fail(ex); }
        }
    }
}