using DDAAPI.Models;
using DDAAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DDAAPI.Controllers
{
    /// <summary>Comments + review workflow on folders/documents. JWT required (same as SearchController).</summary>
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class CommentsController : ControllerBase
    {
        private readonly CommentService _svc;
        public CommentsController(CommentService svc) { _svc = svc; }

        private string? Emp => User.Identity?.Name;

        private async Task<IActionResult> Run<T>(Func<Task<T>> action, string? message = null)
        {
            try
            {
                var data = await action();
                return Ok(new { success = true, message, data });
            }
            catch (CollabForbiddenException ex) { return StatusCode(403, new { success = false, message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Unauthorized(new { success = false, message = ex.Message }); }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
            catch (ArgumentException ex) { return BadRequest(new { success = false, message = ex.Message }); }
            catch (Exception ex) { return BadRequest(new { success = false, message = ex.Message }); }
        }

        [HttpGet("List")]
        public Task<IActionResult> List([FromQuery] string docType, [FromQuery] int id) =>
            Run(() => _svc.GetCommentsAsync(Emp, docType, id));

        [HttpPost("Add")]
        public Task<IActionResult> Add([FromBody] AddCommentDTO dto) =>
            Run(() => _svc.AddCommentAsync(Emp, dto), "Comment added");

        [HttpPost("Edit")]
        public Task<IActionResult> Edit([FromBody] EditCommentDTO dto) =>
            Run(() => _svc.EditCommentAsync(Emp, dto), "Comment updated");

        [HttpPost("Delete/{commentId}")]
        public Task<IActionResult> Delete(int commentId) =>
            Run(() => _svc.DeleteCommentAsync(Emp, commentId), "Comment deleted");

        [HttpPost("Resolve")]
        public Task<IActionResult> Resolve([FromBody] ResolveCommentDTO dto) =>
            Run(() => _svc.ResolveCommentAsync(Emp, dto));

        [HttpGet("Reviews")]
        public Task<IActionResult> Reviews([FromQuery] string docType, [FromQuery] int id) =>
            Run(() => _svc.GetReviewsAsync(Emp, docType, id));

        [HttpGet("MyReviews")]
        public Task<IActionResult> MyReviews([FromQuery] string? scope = "assigned", [FromQuery] string? status = "All") =>
            Run(() => _svc.GetMyReviewsAsync(Emp, scope, status));

        [HttpPost("RequestReview")]
        public Task<IActionResult> RequestReview([FromBody] RequestReviewDTO dto) =>
            Run(() => _svc.RequestReviewAsync(Emp, dto), "Review requested");

        [HttpPost("SubmitReview")]
        public Task<IActionResult> SubmitReview([FromBody] SubmitReviewDTO dto) =>
            Run(() => _svc.SubmitReviewAsync(Emp, dto), "Review submitted");

        [HttpPost("CancelReview/{reviewId}")]
        public Task<IActionResult> CancelReview(int reviewId) =>
            Run(() => _svc.CancelReviewAsync(Emp, reviewId), "Review cancelled");
    }
}
