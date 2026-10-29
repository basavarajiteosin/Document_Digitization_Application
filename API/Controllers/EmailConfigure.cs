using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using DDAAPI.DbContexts;
//using DDAAPI.Helpers;
using DDAAPI.Models;
using DDAAPI.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;


namespace DDAAPI.Controllers
{
    [ApiController]
    [Route("api/EmailCofigureController")]
    public class EmailConfigure : Controller
    {
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _dbContext;
        private readonly EmailService _emailService;
        private readonly SMSService _smsService;
        private readonly EmailConfigurationService _emailConfigurationService;

        public EmailConfigure(IConfiguration configuration, AppDbContext dbContext, EmailService emailService, SMSService smsService, EmailConfigurationService emailConfigurationService)
        {
            _configuration = configuration;
            _dbContext = dbContext;
            _emailService = emailService ?? throw new ArgumentNullException(nameof(emailService));
            _smsService = smsService ?? throw new ArgumentNullException(nameof(smsService));
            _emailConfigurationService = emailConfigurationService;
        }

        [HttpGet("GetMailConfiguration")]
        public IActionResult GetMailConfiguration()
        {
            try
            {
                var emailSetup =  _emailConfigurationService.GetMailConfiguration();
                if (emailSetup != null)
                {
                    //return Ok(result);
                    return Json(new { success = "success", message = "You have successfully get user data", data = emailSetup });
                }
                else
                {
                    //return NotFound("Email configuration not found");
                    return Json(new { success = "success", message = "Email configuration not found" });
                }
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPost("UpdateMailConfiguration")]
        public IActionResult UpdateMailConfiguration(EmailConfigurations configuration)
        {
            try
            {
                _emailConfigurationService.UpdateMailConfiguration(configuration);
                //return Ok("Email configuration updated successfully");
                return Json(new { success = "success", message = "Email configuration updated successfully" });
            }
            catch (NotFiniteNumberException ex)
            {
                //return NotFound(ex.Message);

                return Json(new { success = "error", message = ex.Message });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPost("RequestOtp")]
        public async Task<IActionResult> RequestOtp(string emailOrMobileNo)
        {
            try
            {
                var result = _emailConfigurationService.RequestOtp(emailOrMobileNo);
                //return Ok("OTP Sent successfully");
                return Json(new { success = "success", message = "OTP Send successfully", data = result });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPost("VerifyOtp")]
        public async Task<IActionResult> VerifyOtp(string emailOrMobileNo, string otp)
        {
            try
            {
                var result = await _emailConfigurationService.VerifyOtp(emailOrMobileNo, otp);
                //return Ok("OTP verified successfully");
                return Json(new { success = "success", message = "OTP verified successfully", data = result });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }


        [HttpPost("ChangePasswordFormOtp")]
        public async Task<IActionResult> ChangePasswordFormOtp(PasswordChangeRequest request)
        {
            try
            {
                var result = await _emailConfigurationService.ChangePasswordFormOtp(request);
                return Json(new { success = "success", message = "Password Changed successfully", data = result });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpGet("GetAllMailBodyConfigurations")]
        public IActionResult GetAllMailBodyConfigurations()
        {
            try
            {
                var emailbody = _emailConfigurationService.GetAllMailBodyConfigurations();
                return Json(new { success = "success", message = "You have successfully get Data", data = emailbody });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }


        [HttpGet("GetMailBodyConfiguration")]
        public IActionResult GetMailBodyConfiguration(int id)
        {
            try
            {
                var emailbody = _emailConfigurationService.GetMailBodyConfiguration(id);
                return Json(new { success = "success", message = "You have successfully get Data", data = emailbody });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpGet("GetMailBodyConfigurationByEmailType")]
        public IActionResult GetMailBodyConfigurationByEmailType(string emailType)
        {
            try
            {
                var emailbody = _emailConfigurationService.GetMailBodyConfigurationByEmailType(emailType);
                return Json(new { success = "success", message = "You have successfully get Data", data = emailbody });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPost("AddMailBodyConfiguration")]
        public async Task<IActionResult> AddMailBodyConfiguration(MailBodyConfiguration mailbody)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    throw new ArgumentException("Model state is not valid");
                }

                var createdmailbody = await _emailConfigurationService.AddMailBodyConfiguration(mailbody);
                return Json(new { success = "success", message = "You have successfully Created EmailConfigBody", data = createdmailbody });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPost("UpdateMailBodyConfiguration")]
        public async Task<IActionResult> UpdateMailBodyConfiguration(MailBodyConfiguration mailbody)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    throw new ArgumentException("Model state is not valid");
                }

                var updatedEmialBody = await _emailConfigurationService.UpdateMailBodyConfiguration(mailbody);
                return Json(new { success = "success", message = "You have successfully Update EmailConfigBody", data = updatedEmialBody });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        [HttpPost("DeleteMailBodyConfiguration")]
        public async Task<IActionResult> DeleteMailBodyConfiguration(int id)
        {
            try
            {
                var deletedApp = await _emailConfigurationService.DeleteMailBodyConfiguration(id);
                return Json(new { success = "success", message = "You have successfully Deleted EmailConfigBody", data = deletedApp });
            }
            catch (Exception ex)
            {
                return Json(new { success = "error", message = ex.Message });
            }
        }

        //[HttpGet("GetAllManagerUserMaps")]
        //public async Task<IActionResult> GetAllManagerUserMaps()
        //{
        //    try
        //    {
        //        var managerUserMaps = await _emailConfigurationService.GetAllManagerUserMaps();
        //        return Ok(new { success = true, data = managerUserMaps });
        //    }
        //    catch (Exception ex)
        //    {
        //        return BadRequest(new { success = false, message = ex.Message });
        //    }
        //}

        //[HttpGet("GetManagerUserMapById")]
        //public async Task<IActionResult> GetManagerUserMapById(Guid managerId)
        //{
        //    try
        //    {
        //        var map = await _emailConfigurationService.GetManagerUserMapById(managerId);
        //        if (map == null)
        //        {
        //            return NotFound(new { success = false, message = "ManagerUserMap not found" });
        //        }
        //        return Ok(new { success = true, data = map });
        //    }
        //    catch (Exception ex)
        //    {
        //        return BadRequest(new { success = false, message = ex.Message });
        //    }
        //}

        //[HttpPost("CreateManagerUserMap")]
        //public async Task<IActionResult> CreateManagerUserMap(ManagerUserMapDTO map)
        //{
        //    try
        //    {
        //        var createdMap = await _emailConfigurationService.CreateManagerUserMap(map);
        //        return Ok(new { success = true, message = "ManagerUserMap created successfully", data = createdMap });
        //    }
        //    catch (Exception ex)
        //    {
        //        return BadRequest(new { success = false, message = ex.Message });
        //    }
        //}

        //[HttpPost("UpdateManagerUserMap")]
        //public async Task<IActionResult> UpdateManagerUserMap(ManagerUserMapDTO map)
        //{
        //    try
        //    {
        //        var updatedMap = await _emailConfigurationService.UpdateManagerUserMap(map);
        //        return Ok(new { success = true, message = "ManagerUserMap updated successfully", data = updatedMap });
        //    }
        //    catch (Exception ex)
        //    {
        //        return BadRequest(new { success = false, message = ex.Message });
        //    }
        //}

        //[HttpPost("DeleteManagerUserMap")]
        //public async Task<IActionResult> DeleteManagerUserMap(Guid managerId)
        //{
        //    try
        //    {
        //        var deletedMap = await _emailConfigurationService.DeleteManagerUserMap(managerId);
        //        return Ok(new { success = true, message = "ManagerUserMap deleted successfully", data = deletedMap });
        //    }
        //    catch (Exception ex)
        //    {
        //        return BadRequest(new { success = false, message = ex.Message });
        //    }
        //}

        //[HttpGet("GetByManagerId/{managerId}")]
        //public async Task<IActionResult> GetManagerUserMapByManagerId(Guid managerId)
        //{
        //    try
        //    {
        //        var managerUserMaps = await _emailConfigurationService.GetManagerUserMapByManagerId(managerId);
        //        return Ok(new { success = true, data = managerUserMaps });
        //    }
        //    catch (Exception ex)
        //    {
        //        return BadRequest(new { success = false, message = ex.Message });
        //    }
        //}


        [HttpGet("GetAllNewsAndNotifications")]
        public async Task<IActionResult> GetAllNewsAndNotifications()
        {
            try
            {
                var newsAndNotifications = await _emailConfigurationService.GetAllNewsAndNotifications();
                return Ok(new { success = true, message = "Successfully retrieved news and notifications", data = newsAndNotifications });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("GetNewsAndNotificationById/{id}")]
        public async Task<IActionResult> GetNewsAndNotificationById(int id)
        {
            try
            {
                var newsAndNotification = await _emailConfigurationService.GetNewsAndNotificationById(id);
                if (newsAndNotification == null)
                    return NotFound(new { success = false, message = "News and notification not found" });

                return Ok(new { success = true, message = "Successfully retrieved news and notification", data = newsAndNotification });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("CreateNewsAndNotification")]
        public async Task<IActionResult> CreateNewsAndNotification(NewsAndNotificationDTO newsAndNotification)
        {
            try
            {
                var createdNewsAndNotification = await _emailConfigurationService.CreateNewsAndNotification(newsAndNotification);
                return Ok(new { success = true, message = "Created Successfully", data = createdNewsAndNotification });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("UpdateNewsAndNotification")]
        public async Task<IActionResult> UpdateNewsAndNotification(NewsAndNotificationDTO newsAndNotification)
        {
            try
            {

                var updatedata = await _emailConfigurationService.UpdateNewsAndNotification(newsAndNotification);
                return Ok(new { success = true, message = "News and notification updated successfully", data = updatedata });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("DeleteNewsAndNotification/{id}")]
        public async Task<IActionResult> DeleteNewsAndNotification(int id)
        {
            try
            {
                var deletdate = await _emailConfigurationService.DeleteNewsAndNotification(id);
                return Ok(new { success = true, message = "News and notification deleted successfully", data = deletdate });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}

