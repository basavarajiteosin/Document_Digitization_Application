using DDAAPI.DbContexts;
//using DDAAPI.Helpers;
using DDAAPI.Models;
using DDAAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using static DDAAPI.Services.AuthService;

namespace DDAAPI.Controllers
{
    [ApiController]
    [Route("api/AuthController")]
    public class AuthController : Controller
    {
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _dbContext;
        private readonly AuthService _authService;

        public AuthController(IConfiguration configuration, AppDbContext dbContext, AuthService authService)
        {
            _configuration = configuration;
            _authService = authService;
        }

        [HttpPost("token")]
        public async Task<IActionResult> GetToken(LoginModel loginModel)
        {
            try
            {
                var authenticationResult = await _authService.GetToken(loginModel);
                if (authenticationResult != null)
                {
                    return Json(new { success = "success", message = "You have successfully logged in", data = authenticationResult });
                }
                else
                {
                    return Json(new { success = "error", message = "The user name or password is incorrect" });
                }
            }
            catch (Exception ex)
            {
                string error = ex.Message;
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPost("VerifytheMfaOtp")]
        public async Task<IActionResult> VerifytheMfaOtp(MfaOtpVerifyRequest otpModel)
        {
            try
            {
                var authenticationResult = await _authService.VerifytheMfaOtp(otpModel);
                if (authenticationResult != null)
                {
                    return Json(new { success = "success", message = "You have successfully logged in", data = authenticationResult });
                }
                else
                {
                    return Json(new { success = "error", message = "The user name or password is incorrect" });
                }
            }
            catch (Exception ex)
            {
                string error = ex.Message;
                return Json(new { success = "error", message = ex.Message });
            }
        }


        [Authorize]
        [HttpPost("signout")]
        public async Task<IActionResult> SignOut(SignOutRequest input, CancellationToken ct = default)
        {
            try
            {

                var result = await _authService.SignOutAsync(input, ct);

                return Ok(new
                {
                    success = result.Success ? "success" : "error",
                    message = result.Message
                });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = "error", message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = "error",
                    message = "Sign out failed. Please try again."
                });
            }
        }

        // ============================
        // MICROSOFT TOKEN LOGIN
        // ============================
        [HttpPost("microsoft-token")]
        public async Task<IActionResult> GetMicrosoftToken([FromBody] MicrosoftLoginModel model)
        {
            try
            {
                var authResult = await _authService.LoginWithMicrosoftAsync(model.IdToken);

                authResult.Token = BuildJwt(authResult);

                return Ok(new
                {
                    success = "success",
                    message = "You have successfully logged in via Microsoft",
                    data = authResult
                });
            }
            catch (Exception ex)
            {
                return Unauthorized(new
                {
                    success = "error",
                    message = ex.Message
                });
            }
        }


        private string BuildJwt(AuthenticationResult authResult)
        {
            var jwtSection = _configuration.GetSection("Jwt");

            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(
                    jwtSection["Key"]
                    ?? throw new InvalidOperationException("Jwt:Key is missing.")));

            var claims = new List<Claim>
            {
                new(ClaimTypes.Name,  authResult.EmployeeId),
                new(ClaimTypes.Role,  authResult.UserRole),
                new(ClaimTypes.Email, authResult.EmailAddress)
            };

            // Use DateTime.UtcNow — DateTime.Now causes subtle bugs with ClockSkew = Zero.
            var expireMinutes = Convert.ToInt32(jwtSection["ExpireMinutes"] ?? "30");

            var token = new JwtSecurityToken(
                issuer: jwtSection["Issuer"],
                audience: jwtSection["Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(expireMinutes),
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

            return new JwtSecurityTokenHandler().WriteToken(token);
        }



        [HttpGet("getErrorLog")]
        public ActionResult<List<ErrorLogEntry>> GetErrorLog()
        {
            var errorLogs = _authService.GetErrorLog();
            return Ok(errorLogs);
        }

        [HttpGet("getLoginLogs")]
        public ActionResult<List<LoginLogEntry>> GetLoginLogs()
        {
            var loginLogs = _authService.GetLoginLogs();
            return Ok(loginLogs);
        }

    }
}

