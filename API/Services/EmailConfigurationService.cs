using DDAAPI.DbContexts;
//using DDAAPI.Helpers;
using DDAAPI.Models;
using DDAAPI.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace DDAAPI.Services
{
    public class EmailConfigurationService
    {
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _dbContext;
        private readonly EmailService _emailService;
        private readonly SMSService _smsService;

        public EmailConfigurationService(IConfiguration configuration, AppDbContext dbContext, EmailService emailService, SMSService smsService)
        {
            _configuration = configuration;
            _dbContext = dbContext;
            _emailService = emailService ?? throw new ArgumentNullException(nameof(emailService));
            _smsService = smsService ?? throw new ArgumentNullException(nameof(smsService));
        }

        public object GetMailConfiguration()
        {
            try
            {
                var EmailSetup = _dbContext.EmailConfiguration.FirstOrDefault(k => k.ID == 1);
                if (EmailSetup != null)
                {
                    var result = new EmailConfigurations()
                    {
                        ID = EmailSetup.ID,
                        MailID = EmailSetup.MailAddress,
                        MailPassword = EmailSetup.Password,
                        SmtpPort = EmailSetup.OutgoingPort,
                        SmtpServer = EmailSetup.ServerAddress,
                        UserName = EmailSetup.UserName,
                        IsSSL = EmailSetup.IsSSL
                    };
                    return result;
                }
                else
                {
                    //return NotFound("Email configuration not found");
                    throw new Exception("The user name or password is incorrect");
                }
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network error");
            }
        }
        public void UpdateMailConfiguration(EmailConfigurations configuration)
        {
            try
            {
                var em = _dbContext.EmailConfiguration.FirstOrDefault(k => k.ID == configuration.ID);
                if (em != null)
                {
                    em.MailAddress = configuration.MailID;
                    em.Password = configuration.MailPassword;
                    em.ServerAddress = configuration.SmtpServer;
                    em.OutgoingPort = configuration.SmtpPort;
                    em.IsSSL = configuration.IsSSL;
                    em.UserName = configuration.UserName;

                    _dbContext.SaveChanges();
                    Log.DataLog("Admin", $"Email Configuration id {configuration.ID} data was Updated", "Email Configuration");
                }
                else
                {
                    throw new NotFiniteNumberException("Email configuration not found");
                }
            }
            catch (Exception ex)
            {
                Log.Error("Admin", $"Ehile updating Email Configuration id {configuration.ID} following error occured : {ex.Message}", "Email Configuration");
                throw new Exception(ex.Message ?? "Network error");
            }
        }

        public async Task RequestOtp(string emailOrMobileNo)
        {
            try
            {
                User user = null;
                if (emailOrMobileNo.Contains('@') && emailOrMobileNo.Contains('.'))
                {
                    user = await _dbContext.Users.FirstOrDefaultAsync(tb => tb.Email == emailOrMobileNo);
                    if (user == null)
                    {
                        throw new Exception("Email ID not found");
                    }
                }
                else if (Regex.IsMatch(emailOrMobileNo, @"^\+?\d{10,12}$"))
                {
                    user = await _dbContext.Users.FirstOrDefaultAsync(tb => tb.ContactNumber == emailOrMobileNo);
                    if (user == null)
                    {
                        throw new Exception("Mobile number not found");
                    }
                }
                if (!Regex.IsMatch(emailOrMobileNo, @"^(.+)@(.+)$") && !Regex.IsMatch(emailOrMobileNo, @"^\d{10,12}$"))
                {
                    throw new Exception("Invalid input format");
                }

                // Find the user based on the provided EmployeeId or email
                user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == emailOrMobileNo || u.ContactNumber == emailOrMobileNo);
                if (user == null)
                {
                    throw new Exception("User not found");
                }

                if (!user.IsActive)
                {
                    throw new Exception("User is not active");
                }
                if (emailOrMobileNo.Contains('@') && emailOrMobileNo.Contains('.'))
                {
                    // Send OTP via email
                    await _emailService.GenerateAndSendOTP(emailOrMobileNo);
                }
                else if (Regex.IsMatch(emailOrMobileNo, @"^\+?\d{10,12}$"))
                {
                    // Send OTP via SMS
                    await _smsService.GenerateAndSendOTP(emailOrMobileNo);
                }
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to request OTP", ex);
            }
        }

        public async Task<bool> VerifyOtp(string emailOrMobileNo, string otp)
        {
            try
            {
                var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == emailOrMobileNo || u.ContactNumber == emailOrMobileNo);
                if (user == null)
                {
                    throw new Exception("User not found");
                }

                if (!user.IsActive)
                {
                    throw new Exception("User is not active");
                }

                var latestOtp = await _dbContext.PasswordResetOtpHistorys
                    .Where(pr => (pr.Email == emailOrMobileNo || pr.MobileNo == emailOrMobileNo) && pr.OTPIsActive)
                    .OrderByDescending(pr => pr.CreatedOn)
                    .FirstOrDefaultAsync();

                if (latestOtp == null || latestOtp.OTP != otp)
                {
                    throw new Exception("Invalid OTP");
                }

                // Check OTP expiry
                if (latestOtp.ExpiryOn < DateTime.Now)
                {
                    throw new Exception("OTP has expired. Please try with a new OTP");
                }

                // Deactivate the OTP in the PasswordResetotpHistry Table in the Database
                //latestOtp.OTPIsActive = false;
                //await _dbContext.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<string> ChangePasswordFormOtp(PasswordChangeRequest request)
        {
            try
            {
                User user = null;
                if (request.EmailorMobileNo.Contains('@') && request.EmailorMobileNo.Contains('.'))
                {
                    user = await _dbContext.Users.FirstOrDefaultAsync(tb => tb.Email == request.EmailorMobileNo);
                    if (user == null)
                    {
                        throw new Exception("Email ID not found");
                    }
                }
                else if (Regex.IsMatch(request.EmailorMobileNo, @"^\+?\d{10,12}$"))
                {
                    user = await _dbContext.Users.FirstOrDefaultAsync(tb => tb.ContactNumber == request.EmailorMobileNo);
                    if (user == null)
                    {
                        throw new Exception("Mobile number not found");
                    }
                }
                if (!Regex.IsMatch(request.EmailorMobileNo, @"^(.+)@(.+)$") && !Regex.IsMatch(request.EmailorMobileNo, @"^\d{10,12}$"))
                {
                    throw new Exception("Invalid input format");
                }

                // Find the user based on the provided username or email
                user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == request.EmailorMobileNo || u.ContactNumber == request.EmailorMobileNo);
                if (user == null)
                {
                    throw new Exception("User not found");
                }

                if (!user.IsActive)
                {
                    throw new Exception("User is not active");
                }

                // Find the latest active OTP for the user
                var latestOtp = await _dbContext.PasswordResetOtpHistorys
                    .Where(pr => (pr.Email == request.EmailorMobileNo || pr.MobileNo == request.EmailorMobileNo) && pr.OTPIsActive)
                    .OrderByDescending(pr => pr.CreatedOn)
                    .FirstOrDefaultAsync();

                if (latestOtp == null || latestOtp.OTP != request.Otp)
                {
                    throw new Exception("Invalid OTP");
                }

                if (latestOtp.ExpiryOn < DateTime.Now)
                {
                    throw new Exception("OTP has expired. Try with New OTP"); // OTP has expired
                }

                // Update the user's password with the new password
                user.Password = Encrypt(request.NewPassword, true);
                await _dbContext.SaveChangesAsync();

                // Deactivate the OTP
                latestOtp.OTPIsActive = false;
                await _dbContext.SaveChangesAsync();

                string messagedata = "Password changed successfull";
                if (user.UserID != null)
                {
                    Log.DataLog(user.UserID.ToString(), $"fot the user {user.UserID} passwor has been changed successfully", "Password change Log");

                }

                return messagedata;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        private string Encrypt(string Password, bool useHashing)
        {
            try
            {
                string EncryptionKey = "Iteos";
                byte[] KeyArray;
                byte[] ToEncryptArray = Encoding.UTF8.GetBytes(Password);
                if (useHashing)
                {
                    using (MD5CryptoServiceProvider hashmd5 = new MD5CryptoServiceProvider())
                    {
                        KeyArray = hashmd5.ComputeHash(Encoding.UTF8.GetBytes(EncryptionKey));
                    }
                }
                else
                {
                    KeyArray = Encoding.UTF8.GetBytes(EncryptionKey);
                }

                using (TripleDESCryptoServiceProvider tdes = new TripleDESCryptoServiceProvider())
                {
                    tdes.Key = KeyArray;
                    tdes.Mode = CipherMode.ECB;
                    tdes.Padding = PaddingMode.PKCS7;
                    ICryptoTransform cTransform = tdes.CreateEncryptor();
                    byte[] resultArray = cTransform.TransformFinalBlock(ToEncryptArray, 0, ToEncryptArray.Length);
                    return Convert.ToBase64String(resultArray, 0, resultArray.Length);
                }
            }
            catch (Exception ex)
            {
                //ErrorLog.AddErrorLog("AuthorizationServerProvider/Encrypt :- ", ex.Message);
                return null;
            }
        }

        public IEnumerable<MailBodyConfiguration> GetAllMailBodyConfigurations()
        {
            try
            {
                return _dbContext.MailBodyConfigurations.ToList();
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public MailBodyConfiguration GetMailBodyConfiguration(int id)
        {
            try
            {
                var exist = _dbContext.MailBodyConfigurations.FirstOrDefault(m => m.ID == id);
                if (exist == null)
                {
                    throw new Exception($"No mail body configuration found.");
                }
                return exist;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public MailBodyConfiguration GetMailBodyConfigurationByEmailType(string emailType)
        {
            try
            {
                var exist = _dbContext.MailBodyConfigurations.FirstOrDefault(m => m.MailType.ToLower() == emailType.ToLower());
                if (exist == null)
                {
                    throw new Exception($"No mail body configuration found.");
                }
                return exist;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<MailBodyConfiguration> AddMailBodyConfiguration(MailBodyConfiguration mailBodyConfiguration)
        {
            try
            {
                _dbContext.MailBodyConfigurations.Add(mailBodyConfiguration);
                _dbContext.SaveChanges();

                Log.DataLog("Admin", $"Mailbody Confiuration has been added succesfully mail Type {mailBodyConfiguration.MailType} with mail subjetc {mailBodyConfiguration.MailSubject}", "Mailbody configurations");
                return mailBodyConfiguration;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }



        public async Task<MailBodyConfiguration> UpdateMailBodyConfiguration(MailBodyConfiguration mailBodyConfiguration)
        {
            try
            {
                var exist = _dbContext.MailBodyConfigurations.FirstOrDefault(m => m.ID == mailBodyConfiguration.ID);
                if (exist == null)
                {
                    throw new Exception($"No mail body configuration found.");
                }
                exist.MailType = mailBodyConfiguration.MailType;
                exist.MailBody = mailBodyConfiguration.MailBody;
                exist.MailSubject = mailBodyConfiguration.MailSubject;

                _dbContext.SaveChanges();

                return exist;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<MailBodyConfiguration> DeleteMailBodyConfiguration(int id)
        {
            try
            {
                var mailBodyConfiguration = _dbContext.MailBodyConfigurations.Find(id);
                if (mailBodyConfiguration == null)
                {
                    throw new KeyNotFoundException("Mail body configuration not found");
                }

                _dbContext.MailBodyConfigurations.Remove(mailBodyConfiguration);
                _dbContext.SaveChanges();

                return mailBodyConfiguration;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }


        #region NotificationAPI
        public async Task<List<NewsAndNotification>> GetAllNewsAndNotifications()
        {
            try
            {
                return await _dbContext.NewsAndNotifications.ToListAsync();
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to retrieve news and notifications: " + ex.Message);
            }
        }

        public async Task<NewsAndNotification> GetNewsAndNotificationById(int id)
        {
            try
            {
                var newsAndNotification = await _dbContext.NewsAndNotifications.FindAsync(id);
                if (newsAndNotification == null)
                {
                    throw new Exception("News and notification not found!");
                }

                return newsAndNotification;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<NewsAndNotification> CreateNewsAndNotification(NewsAndNotificationDTO newsAndNotification)
        {
            try
            {
                NewsAndNotification data = new NewsAndNotification
                {
                    NTital = newsAndNotification.NTital,
                    NDate = newsAndNotification.NDate,
                    NDescription = newsAndNotification.NDescription,
                    IsActive = true,
                    CreatedBy = newsAndNotification.CreatedBy,
                    CreatedOn = DateTime.Now
                };
                _dbContext.NewsAndNotifications.Add(data);
                await _dbContext.SaveChangesAsync();

                return data;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<NewsAndNotification> UpdateNewsAndNotification(NewsAndNotificationDTO newsAndNotification)
        {
            try
            {
                var existingNewsAndNotification = await _dbContext.NewsAndNotifications.FindAsync(newsAndNotification.NID);
                if (existingNewsAndNotification == null)
                {
                    throw new Exception("News and notification not found!");
                }

                existingNewsAndNotification.NTital = newsAndNotification.NTital;
                existingNewsAndNotification.NDate = newsAndNotification.NDate;
                existingNewsAndNotification.NDescription = newsAndNotification.NDescription;
                existingNewsAndNotification.ModifiedBy = newsAndNotification.ModifiedBy;
                existingNewsAndNotification.ModifiedOn = DateTime.Now;

                await _dbContext.SaveChangesAsync();

                return existingNewsAndNotification;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<NewsAndNotification> DeleteNewsAndNotification(int id)
        {
            try
            {
                var newsAndNotification = await _dbContext.NewsAndNotifications.FindAsync(id);
                if (newsAndNotification == null)
                {
                    throw new Exception("News and notification not found!");
                }

                _dbContext.NewsAndNotifications.Remove(newsAndNotification);
                await _dbContext.SaveChangesAsync();

                return newsAndNotification;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }


        #endregion
    }
}

