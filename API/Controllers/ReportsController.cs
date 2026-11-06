using DDAAPI.Services;
using Microsoft.AspNetCore.Mvc;

namespace DDAAPI.Controllers
{
    /// <summary>
    /// NEW (this change). Exposes the three client-requested reports:
    ///   1) GetEmployeeWiseFolderAccess  - employee-wise folder access report
    ///   2) GetFolderVersionHistory      - folder versioning history
    ///   3) GetOwnershipAccessHistory    - ownership + access history log
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class ReportsController : ControllerBase
    {
        private readonly IReportService _reportService;

        public ReportsController(IReportService reportService)
        {
            _reportService = reportService;
        }

        // GET api/Reports/GetEmployeeWiseFolderAccess
        // GET api/Reports/GetEmployeeWiseFolderAccess?userId=xxxxx  (single employee)
        [HttpGet("GetEmployeeWiseFolderAccess")]
        public async Task<IActionResult> GetEmployeeWiseFolderAccess([FromQuery] string? userId = null)
        {
            return await _reportService.GetEmployeeWiseFolderAccessReportAsync(userId);
        }

        // GET api/Reports/GetFolderVersionHistory/{folderId}
        [HttpGet("GetFolderVersionHistory/{folderId}")]
        public async Task<IActionResult> GetFolderVersionHistory(int folderId)
        {
            return await _reportService.GetFolderVersionHistoryAsync(folderId);
        }

        // GET api/Reports/GetOwnershipAccessHistory
        // GET api/Reports/GetOwnershipAccessHistory?folderOrFileId=5&docType=Folder
        [HttpGet("GetOwnershipAccessHistory")]
        public async Task<IActionResult> GetOwnershipAccessHistory([FromQuery] int? folderOrFileId = null, [FromQuery] string? docType = null)
        {
            return await _reportService.GetOwnershipAccessHistoryAsync(folderOrFileId, docType);
        }


        // GET api/Reports/GetMailLogs?fromDate=2026-01-01&toDate=2026-01-31&status=Failed&mailType=MFA OTP
        [HttpGet("GetMailLogs")]
        public async Task<IActionResult> GetMailLogs([FromQuery] DateTime? fromDate = null, [FromQuery] DateTime? toDate = null,
            [FromQuery] string? status = null, [FromQuery] string? mailType = null)
        {
            return await _reportService.GetMailLogsAsync(fromDate, toDate, status, mailType);
        }
    }
}
