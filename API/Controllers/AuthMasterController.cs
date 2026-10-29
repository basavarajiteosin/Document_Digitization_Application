using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Web;
using DDAAPI.DbContexts;
//using DDAAPI.Helpers;
using DDAAPI.Models;
using DDAAPI.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using static DDAAPI.Services.AuthService;

// For more information on enabling MVC for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace DDAAPI.Controllers
{
    [ApiController]
    [Route("api/AuthMasterController")]
    public class AuthMasterController : Controller
    {
        private readonly AppDbContext _dbContext;
        private readonly IConfiguration _configuration;
        private readonly AuthMasterServices _authMasterService;
        private readonly int _tokenTimespan;

        public AuthMasterController(AppDbContext dbContext, IConfiguration configuration, AuthMasterServices authMasterService)
        {
            _dbContext = dbContext;
            _configuration = configuration;
            _authMasterService = authMasterService;
            try
            {
                var span = "30";
                if (span != "")
                    _tokenTimespan = Convert.ToInt32(span.ToString());
                if (_tokenTimespan <= 0)
                {
                    _tokenTimespan = 30;
                }
            }
            catch
            {
                _tokenTimespan = 30;
            }
        }

        #region Authentication

        [HttpGet("FindClient")]
        public IActionResult FindClient(string clientId)
        {
            try
            {
                var client = _authMasterService.FindClient(clientId);
                if (client != null)
                {
                    //return Ok(client);
                    return Json(new { success = "success", message = "You have successfully get data", data = client });
                }
                else
                {
                    //return NotFound();
                    return Json(new { success = "error", message = "Data Not Found" });
                }
            }
            catch (Exception ex)
            {
                //return StatusCode(500, "An error occurred while finding the client.");
                return Json(new { success = "error", message = ex.Message });
            }
        }



        #endregion

        #region UserControll

        [HttpGet("GetAllUsers")]
        public IActionResult GetAllUsers(string ClientId)
        {
            try
            {
                var users = _authMasterService.GetAllUsers(ClientId);
                //return Ok(users);
                return Json(new { success = "success", message = "You have successfully get user data", data = users });

            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpGet("GetAdminUsers")]
        public IActionResult GetAdminUsers(string ClientId)
        {
            try
            {
                var adminUsers = _authMasterService.GetAdminUsers(ClientId);
                //return Ok(adminUsers);
                return Json(new { success = "success", message = "You have successfully get user data", data = adminUsers });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpGet("GetAllSPOCUsers")]
        public IActionResult GetAllSPOCUsers(string ClientId)
        {
            try
            {
                var spocUsers = _authMasterService.GetAllSPOCUsers(ClientId);
                //return Ok(adminUsers);
                return Json(new { success = "success", message = "You have successfully get user data", data = spocUsers });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpGet("GetAllViewerUsers")]
        public IActionResult GetAllViewerUsers(string ClientId)
        {
            try
            {
                var viewUsers = _authMasterService.GetAllViewerUsers(ClientId);
                //return Ok(adminUsers);
                return Json(new { success = "success", message = "You have successfully get user data", data = viewUsers });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }


        [HttpGet("GetAllActiveViewUsers")]
        public IActionResult GetAllActiveViewUsers(string ClientId)
        {
            try
            {
                var empUsers = _authMasterService.GetAllActiveViewUsers(ClientId);
                //return Ok(adminUsers);
                return Json(new { success = "success", message = "You have successfully get user data", data = empUsers });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpGet("GetAllEmpInfo")]
        public async Task<IActionResult> GetAllEmpInfo()
        {
            try
            {
                var empInfoList = await _authMasterService.GetAllEmpInfo();
                return Json(new { success = true, message = "You have successfully retrieved user data", data = empInfoList });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }


        [HttpGet("GetEmpInfoByEmpId")]
        public async Task<IActionResult> GetEmpInfoByEmpId(Guid id)
        {
            try
            {
                var empInfo = await _authMasterService.GetEmpInfoById(id);
                if (empInfo == null)
                    return NotFound();

                return Ok(new { success = true, message = "Data Fetched successfully", data = empInfo });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CreateUser")]
        public async Task<IActionResult> CreateUser(UserWithRole userWithRole)
        {
            try
            {
                var userResult = await _authMasterService.CreateUser(userWithRole);
                //return Ok(userResult);
                return Json(new { success = "success", message = "You have successfully created the user.", data = userResult });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }




        [HttpPost("CreateRegisterUser")]
        public async Task<IActionResult> CreateRegisterUser(UserWithRole userWithRole)
        {
            try
            {
                var userResult = await _authMasterService.CreateRegisterUser(userWithRole);
                //return Ok(userResult);
                return Json(new { success = "success", message = "Thank you, registration completed successfully.", data = userResult });
            }
            catch (Exception ex)
            {
                // Log the exception if needed
                //return StatusCode(500, "An error occurred while creating the user.");
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPost("ProfileUpdateUser")]
        public async Task<ActionResult> ProfileUpdateUser([FromForm] UserProfileUpdate userProfileUpdate)
        {
            try
            {
                var userResult = await _authMasterService.ProfileUpdateUser(userProfileUpdate);
                return Json(new { success = "success", message = "Profile image updated successfully...", data = userResult });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }
     

        [HttpPost("UpdateFromEmployeeEmpInfo")]
        public async Task<IActionResult> UpdateFromEmployeeEmpInfo(FromEmployeeEmpInfo empInfo)
        {
            try
            {
                var userResult= await _authMasterService.UpdateFromEmployeeEmpInfo(empInfo);
                return Ok(new { success = true, message = "Employee information updated successfully", data = userResult });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("UpdateUser")]
        public async Task<ActionResult<UserWithRole>> UpdateUser(UserWithRole userWithRole)
        {
            try
            {
                var userResult = await _authMasterService.UpdateUser(userWithRole);
                //return Ok(userResult);
                return Json(new { success = "success", message = "You have successfully updated user data", data = userResult });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPost("DeleteUser")]
        public async Task<ActionResult<UserWithRole>> DeleteUser(string ClientId,Guid UserID)
        {
            try
            {
                var userResult = await _authMasterService.DeleteUser(ClientId, UserID);
                //return Ok(userResult);
                return Json(new { success = "success", message = "You have successfully Deleted User", data = userResult });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }


        #endregion

        #region RoleControll

        [HttpGet("GetAllRoles")]
        public IActionResult GetAllRoles(string ClientId)
        {
            try
            {
                var roles = _authMasterService.GetAllRoles(ClientId);
                return Json(new { success = "success", message = "You have successfully get the  Data", data = roles });
            }
            catch (Exception ex)
            {
                // Log the exception if needed
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpGet("GetAllRolesWithApp")]
        public IActionResult GetAllRolesWithApp(string ClientId)
        {
            try
            {
                var rolesWithApp = _authMasterService.GetAllRolesWithApp(ClientId);
                return Json(new { success = "success", message = "You have successfully get the Data", data = rolesWithApp });
            }
            catch (Exception ex)
            {
                // Log the exception if needed
                return Json(new { success = "error", message = ex.Message });
            }
        }


        [HttpPost("CreateRole")]
        public async Task<IActionResult> CreateRole(RoleWithApp roleWithApp)
        {
            try
            {
                var createdRole = await _authMasterService.CreateRole(roleWithApp);
                return Json(new { success = "success", message = "You have successfully Created Data", data = createdRole });
            }
            catch (Exception ex)
            {
                // Log the exception if needed
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPost("UpdateRole")]
        public async Task<IActionResult> UpdateRole(RoleWithApp roleWithApp)
        {
            try
            {
                var updatedRole = await _authMasterService.UpdateRole(roleWithApp);
                return Json(new { success = "success", message = "You have successfully Update Data", data = updatedRole });
            }
            catch (Exception ex)
            {
                // Log the exception if needed
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPost("DeleteRole")]
        public async Task<IActionResult> DeleteRole(Guid roleId)
        {
            try
            {
                var result = await _authMasterService.DeleteRole(roleId);
                return Json(new { success = "success", message = "You have successfully Deleted Data", data = result });
            }
            catch (Exception ex)
            {
                // Log the exception if needed
                return Json(new { success = "error", message = ex.Message });
            }
        }

        #endregion

        #region AppControll


        [HttpGet("GetAllApps")]
        public IActionResult GetAllApps()
        {
            try
            {
                var apps = _authMasterService.GetAllApps();
                return Json(new { success = "success", message = "You have successfully Update Data", data = apps });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPost("CreateApp")]
        public async Task<IActionResult> CreateApp(App app)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    throw new ArgumentException("Model state is not valid");
                }

                var createdApp = await _authMasterService.CreateApp(app);
                return Json(new { success = "success", message = "You have successfully Created Data", data = createdApp });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPut("UpdateApp")]
        public async Task<IActionResult> UpdateApp(App app)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    throw new ArgumentException("Model state is not valid");
                }

                var updatedApp = await _authMasterService.UpdateApp(app);
                return Json(new { success = "success", message = "You have successfully Update Data", data = updatedApp });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpDelete("DeleteApp")]
        public async Task<IActionResult> DeleteApp(App app)
        {
            try
            {
                var deletedApp = await _authMasterService.DeleteApp(app);
                return Json(new { success = "success", message = "You have successfully Deleted App", data = deletedApp });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }


        #endregion

        #region LoginHistoryControll


        [HttpPost("LoginHistory")]
        public async Task<IActionResult> LoginHistory(Guid userID, string username)
        {
            try
            {
                var loginData = await _authMasterService.AddLoginHistory(userID, username);
                //return Ok(loginData);
                return Json(new { success = "success", message = "You have successfully get user data", data = loginData });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpGet("GetAllUsersLoginHistory")]
        public IActionResult GetAllUsersLoginHistory()
        {
            try
            {
                var userLoginHistoryList = _authMasterService.GetAllUsersLoginHistory();
                //return Ok(userLoginHistoryList);
                return Json(new { success = "success", message = "You have successfully get user data", data = userLoginHistoryList });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpGet("GetCurrentUserLoginHistory")]
        public IActionResult GetCurrentUserLoginHistory(Guid userID)
        {
            try
            {
                var userLoginHistoryList = _authMasterService.GetCurrentUserLoginHistory(userID);
                //return Ok(userLoginHistoryList);
                return Json(new { success = "success", message = "You have successfully get user data", data = userLoginHistoryList });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPost("SignOut")]
        public async Task<IActionResult> SignOut(Guid userID)
        {
            try
            {
                var result = await _authMasterService.SignOut(userID);
                //return Ok(result);
                return Json(new { success = "success", message = "You have successfully loggeout from the Portal", data = result });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }


        #endregion

        #region ChangePasswordControl

        [HttpPost("ChangePassword")]
        public async Task<IActionResult> ChangePassword([FromForm] ChangePassword changePassword)
        {
            try
            {
                var result = await _authMasterService.ChangePassword(changePassword);
                //return Ok(result);
                return Json(new { success = "success", message = "You have successfully Reseted the Password", data = result });

            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPost("SendResetLinkToMail")]
        public async Task<ActionResult<AuthTokenHistory>> SendResetLinkToMail(EmailModel emailModel)
        {
            try
            {
                var result = await _authMasterService.SendResetLinkToMail(emailModel);
                //return Ok(result);
                return Json(new { success = "success", message = "You have successfully Sent Mail", data = result });

            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }


        [HttpPost("ForgotPassword")]
        public async Task<ActionResult> ForgotPassword(ForgotPassword forgotPassword)
        {
            try
            {
                var result = await _authMasterService.ForgotPassword(forgotPassword);
                //return Ok();
                return Json(new { success = "success", message = "You have successfully Reseted password", data = result });

            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        #endregion

        #region LogGetApi's

        [HttpGet("GetUsersCLog")]
        public ActionResult<List<ErrorLogEntry>> GetUsersCLog()
        {
            var errorLogs = _authMasterService.GetUsersCLog();
            return Ok(errorLogs);
        }

        [HttpGet("GetAuthMasterErrorLog")]
        public ActionResult<List<LoginLogEntry>> GetAuthMasterErrorLog()
        {
            var loginLogs = _authMasterService.GetAuthMasterErrorLog();
            return Ok(loginLogs);
        }

        #endregion

    }

}

