using DDAAPI.DbContexts;
using DDAAPI.Models;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System.Data;
using System.Net;
using System.Net.Mail;
using System.Text;
using System.Web;

namespace DDAAPI.Services
{
    public class EmailService
    {
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _dbContext;

        // MailBodyConfigurations IDs
        private const int TPL_USER_CREATION = 1;
        private const int TPL_RESET_PASSWORD = 2;
        private const int TPL_USER_ACTIVATION = 3;
        private const int TPL_FILE_ACCESS_INTERNAL = 4;
        private const int TPL_FILE_ACCESS_EXTERNAL = 5;
        private const int TPL_DOC_ACCESS_OTP = 6;
        private const int TPL_BEHALF_ACTION = 8;

        // New templates are looked up by MailType
        private const string TPL_MFA_OTP = "MFA OTP";
        private const string TPL_REGISTRATION_REQUEST = "User Registration Request";
        private const string TPL_MENTION = "Mention Notification";

        public EmailService(IConfiguration configuration, AppDbContext dbContext)
        {
            _configuration = configuration;
            _dbContext = dbContext;
        }

        #region Shared helpers

        private static string H(string? s) => WebUtility.HtmlEncode(s ?? "");

        private async Task LogMailAsync(string mailType, string? toEmail, string? subject, bool success, string? error = null)
        {
            try
            {
                _dbContext.MailLogs.Add(new MailLog
                {
                    MailType = mailType,
                    ToEmail = toEmail,
                    Subject = subject != null && subject.Length > 500 ? subject.Substring(0, 500) : subject,
                    Status = success ? "Sent" : "Failed",
                    ErrorMessage = error != null && error.Length > 2000 ? error.Substring(0, 2000) : error,
                    CreatedOn = DateTime.Now
                });
                await _dbContext.SaveChangesAsync();
            }
            catch { /* mail logging must never break the mail flow */ }
        }

        private EmailConfiguration GetEmailConfig()
        {
            return _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1)
                   ?? throw new Exception("Email configuration not found");
        }

        private MailBodyConfiguration GetTemplate(int id)
        {
            return _dbContext.MailBodyConfigurations.FirstOrDefault(k => k.ID == id)
                   ?? throw new Exception($"Mail template (ID {id}) not found in MailBodyConfigurations");
        }

        private MailBodyConfiguration GetTemplate(string mailType)
        {
            return _dbContext.MailBodyConfigurations.FirstOrDefault(k => k.MailType == mailType)
                   ?? throw new Exception($"Mail template '{mailType}' not found in MailBodyConfigurations");
        }

        /// <summary>
        /// Fills the template placeholders (subject + body), sends the mail and returns the final subject.
        /// useVaultPassword = true  -> SMTP password comes from the STMPDetails table (EMailDetails)
        /// useVaultPassword = false -> SMTP password comes from EmailConfiguration
        /// </summary>
        private async Task<string> SendFromTemplateAsync(EmailConfiguration ec, MailBodyConfiguration tpl, string toEmail,
            IDictionary<string, string> tokens, bool useVaultPassword)
        {
            string Fill(string text)
            {
                foreach (var kv in tokens) text = text.Replace(kv.Key, kv.Value ?? "");
                return text;
            }

            string subject = Fill(tpl.MailSubject ?? "");
            string body = Fill(tpl.MailBody ?? "");

            NetworkCredential credentials;
            if (useVaultPassword)
            {
                var smtpCfg = _configuration.GetSection("STMPDetails");
                EMailDetails details = GetEMailDetails(ec.UserName, smtpCfg["EmailContext"], smtpCfg["TableName"]);
                credentials = new NetworkCredential(ec.UserName, details.Password);
            }
            else
            {
                credentials = new NetworkCredential(ec.MailAddress, ec.Password);
            }

            using var message = new MailMessage();
            message.From = new MailAddress(ec.MailAddress);
            message.To.Add(new MailAddress(toEmail));
            message.Subject = subject;
            message.Body = body;
            message.IsBodyHtml = true;
            message.BodyEncoding = UTF8Encoding.UTF8;
            message.DeliveryNotificationOptions = DeliveryNotificationOptions.OnFailure;

            using var smtp = new SmtpClient(ec.ServerAddress);
            smtp.Port = int.Parse(ec.OutgoingPort);
            smtp.EnableSsl = true;
            smtp.Timeout = 60000;
            smtp.UseDefaultCredentials = false;
            smtp.Credentials = credentials;
            smtp.DeliveryMethod = SmtpDeliveryMethod.Network;

            ServicePointManager.ServerCertificateValidationCallback += (s, c, ch, e) => true;
            await smtp.SendMailAsync(message);

            return subject;
        }

        #endregion

        #region SendInitializationMail (unchanged)

        public async Task<bool> SendInitializationMail(string FirstName, string LastName, string toEmail, string Password, string url)
        {
            try
            {
                var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);

                if (ec != null)
                {
                    MailMessage message = new MailMessage();
                    string subject = "User Creation";
                    StringBuilder sb = new StringBuilder();

                    sb.Append($@"
                     <div style='padding:20px;'>
                         <div style='border:1px solid #dbdbdb;padding:20px'>
                             <div style='font-family: Segoe UI;'>
                                 <h2 align='center'>DDAAPI</h2>
                                 <div>
                                     <div style='border:1px solid white;background-color: white !important'>
                                         <p>Dear {FirstName} {LastName},</p>
                                         <p>Your account has been created.</p>
                                         <p>Account Details Is Following</p>
                                         <p><a href='{url}/#' rel='noopener noreferrer' target='_blank'>Login</a></p>
                                         <p>UserName: {toEmail}</p>
                                         <p>Password: {Password}</p>
                                         <p></p>
                                         <p>&nbsp;</p>
                                         <p>Regards,</p>
                                         <p>Admin</p>
                                         <p></p>
                                         <p align='center' style='font-size:10px;'>Sensitivity: Internal &amp; Restricted</p>
                                     </div>
                                 </div>
                             </div>
                         </div>&apos;The information contained in this electronic message and any attachments to this message are intended for the exclusive use of the addressee(s) and may contain proprietary, confidential or privileged information. If you are not the intended recipient, you should not disseminate, distribute or copy this e-mail. Please notify the sender immediately and destroy all copies of this message and any attachments. WARNING: Computer viruses can be transmitted via email. The recipient should check this email and any attachments for the presence of viruses. The company accepts no liability for any damage caused by any virus transmitted by this email.&apos;
                     </div>
                     ");

                    SmtpClient client = new SmtpClient(ec.ServerAddress);
                    client.Port = int.Parse(ec.OutgoingPort);
                    client.EnableSsl = true;
                    client.Timeout = 60000;
                    client.UseDefaultCredentials = false;
                    client.Credentials = new System.Net.NetworkCredential(ec.MailAddress, ec.Password);

                    MailMessage reportEmail = new MailMessage(ec.UserName, toEmail, subject, sb.ToString());
                    reportEmail.BodyEncoding = UTF8Encoding.UTF8;
                    reportEmail.DeliveryNotificationOptions = DeliveryNotificationOptions.OnFailure;
                    reportEmail.IsBodyHtml = true;

                    ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;

                    await client.SendMailAsync(reportEmail);

                    Log.DataLog(toEmail, $"User Registration Credentials and login link has been sent successfully to {toEmail}", "User Credentils Share Log");
                    return true;
                }
                else
                {
                    throw new Exception("Email configuration not found");
                }
            }
            catch (SmtpFailedRecipientsException ex)
            {
                for (int i = 0; i < ex.InnerExceptions.Length; i++)
                {
                    SmtpStatusCode status = ex.InnerExceptions[i].StatusCode;
                    if (status == SmtpStatusCode.MailboxBusy || status == SmtpStatusCode.MailboxUnavailable)
                    {
                        Log.Error(toEmail, $"User/SendMail/MailboxBusy/MailboxUnavailable/SmtpFailedRecipientsException:Inner- {ex.Message}", "User Credentils Share Log");
                    }
                    else
                    {
                        Log.Error(toEmail, $"User/SendMail/SmtpFailedRecipientsException:Inner- {ex.Message}", "User Credentils Share Log");
                    }
                }
                Log.Error(toEmail, $"User/SendMail/SmtpFailedRecipientsException:- {ex.Message}", "User Credentils Share Log");
                return false;
            }
            catch (SmtpException ex)
            {
                Log.Error(toEmail, $"User/SendMail/SmtpException:- {ex.Message}", "User Credentils Share Log");
                return false;
            }
            catch (Exception ex)
            {
                Log.Error(toEmail, $"User/SendMail/Exception:- {ex.Message}", "User Credentils Share Log");

                return false;
            }
        }

        #endregion

        #region MFA OTP  (template: MailType "MFA OTP")  tokens: @UserName@ @otp@

        public async Task<bool> SendMFAOtpForAuthentivcationMail(string otp, string UserName, string toEmail)
        {
            try
            {
                var ec = GetEmailConfig();
                var tpl = GetTemplate(TPL_MFA_OTP);

                var subject = await SendFromTemplateAsync(ec, tpl, toEmail, new Dictionary<string, string>
                {
                    ["@UserName@"] = H(UserName),
                    ["@otp@"] = H(otp)
                }, useVaultPassword: true);

                Log.DataLog(toEmail, $"OTP has been sent successfully to {toEmail}", "MFA OTP Mail Log");
                await LogMailAsync("MFA OTP", toEmail, subject, true);
                return true;
            }
            catch (SmtpFailedRecipientsException ex)
            {
                await LogMailAsync("MFA OTP", toEmail, null, false, ex.Message);
                for (int i = 0; i < ex.InnerExceptions.Length; i++)
                {
                    SmtpStatusCode status = ex.InnerExceptions[i].StatusCode;
                    if (status == SmtpStatusCode.MailboxBusy || status == SmtpStatusCode.MailboxUnavailable)
                    {
                        Log.Error(toEmail, $"MFAOtp/SendMail/MailboxBusy/MailboxUnavailable/SmtpFailedRecipientsException: {ex.Message}", "MFA OTP Mail Log");
                    }
                    else
                    {
                        Log.Error(toEmail, $"MFAOtp/SendMail/SmtpFailedRecipientsException: {ex.Message}", "MFA OTP Mail Log");
                    }
                }
                Log.Error(toEmail, $"MFAOtp/SendMail/SmtpFailedRecipientsException: {ex.Message}", "MFA OTP Mail Log");
                return false;
            }
            catch (SmtpException ex)
            {
                await LogMailAsync("MFA OTP", toEmail, null, false, ex.Message);
                Log.Error(toEmail, $"MFAOtp/SendMail/SmtpException: {ex.Message}", "MFA OTP Mail Log");
                return false;
            }
            catch (Exception ex)
            {
                await LogMailAsync("MFA OTP", toEmail, null, false, ex.Message);
                Log.Error(toEmail, $"MFAOtp/SendMail/Exception: {ex.Message}", "MFA OTP Mail Log");
                return false;
            }
        }

        #endregion

        #region Behalf action (ID 8)

        public async Task<bool> SendBehalfActionNotificationMail(string ownerEmail, string ownerName, string actingUserName, string itemName, string itemType, string actionType, string FolderName)
        {
            // itemType: "Folder" | "File", actionType: "Created" | "Uploaded"
            try
            {
                var ec = GetEmailConfig();
                var tpl = GetTemplate(TPL_BEHALF_ACTION);

                var subject = await SendFromTemplateAsync(ec, tpl, ownerEmail, new Dictionary<string, string>
                {
                    ["@OwnerName@"] = H(ownerName),
                    ["@ActingUser@"] = H(actingUserName),
                    ["@Action@"] = H(actionType.ToLower()),
                    ["@ItemType@"] = H(itemType.ToLower()),
                    ["@ItemName@"] = H(itemName),
                    ["@FolderName@"] = H(FolderName)
                }, useVaultPassword: false);

                Log.DataLog(ownerEmail, $"Notified owner {ownerEmail} that {actingUserName} {actionType.ToLower()} {itemType.ToLower()} '{itemName}'", "Behalf Action Notification Log");
                await LogMailAsync("Behalf Action Notification", ownerEmail, subject, true);
                return true;
            }
            catch (Exception ex)
            {
                // Never let a notification failure break the create/upload flow.
                await LogMailAsync("Behalf Action Notification", ownerEmail, null, false, ex.Message);
                Log.Error(ownerEmail, $"Behalf/SendBehalfActionNotificationMail/Exception:- {ex.Message}", "Behalf Action Notification Log");
                return false;
            }
        }

        #endregion

        #region Mention (template: MailType "Mention Notification")
        // tokens: @UserName@ @ByName@ @ItemType@ @ItemName@ @Location@ @Comment@ @Link@

        public async Task<bool> SendMentionNotificationMail(string toEmail, string toName, string byName, string itemType,
            string itemName, string location, string commentText, string link)
        {
            try
            {
                var ec = GetEmailConfig();
                var tpl = GetTemplate(TPL_MENTION);

                var subject = await SendFromTemplateAsync(ec, tpl, toEmail, new Dictionary<string, string>
                {
                    ["@UserName@"] = H(toName),
                    ["@ByName@"] = H(byName),
                    ["@ItemType@"] = H(itemType),
                    ["@ItemName@"] = H(itemName),
                    ["@Location@"] = H(location),
                    ["@Comment@"] = H(commentText),
                    ["@Link@"] = H(link)
                }, useVaultPassword: false);

                Log.DataLog(toEmail, $"Mention notification sent to {toEmail} by {byName} on {itemType} '{itemName}'", "Mention Mail Log");
                await LogMailAsync("Mention Notification", toEmail, subject, true);
                return true;
            }
            catch (Exception ex)
            {
                await LogMailAsync("Mention Notification", toEmail, null, false, ex.Message);
                Log.Error(toEmail, $"Mention/SendMail/Exception:- {ex.Message}", "Mention Mail Log");
                return false;
            }
        }

        #endregion

        #region User Creation (ID 1)

        public async Task<bool> SendUserCreatedMailForUser(string FirstName, string LastName, string toEmail, string Password, string url)
        {
            try
            {
                var ec = GetEmailConfig();
                var tpl = GetTemplate(TPL_USER_CREATION);

                var subject = await SendFromTemplateAsync(ec, tpl, toEmail, new Dictionary<string, string>
                {
                    ["@LoginLink@"] = url,
                    ["@DearUser@"] = FirstName + " " + LastName,
                    ["@UserName@"] = toEmail,
                    ["@Password@"] = Password
                }, useVaultPassword: true);

                Log.DataLog(toEmail, $"User credentials has been shared successfully to the mail {toEmail}", "Email Log");
                await LogMailAsync("User Created", toEmail, subject, true);
                return true;
            }
            catch (SmtpFailedRecipientsException ex)
            {
                await LogMailAsync("User Created", toEmail, null, false, ex.Message);
                for (int i = 0; i < ex.InnerExceptions.Length; i++)
                {
                    SmtpStatusCode status = ex.InnerExceptions[i].StatusCode;
                    if (status == SmtpStatusCode.MailboxBusy || status == SmtpStatusCode.MailboxUnavailable)
                    {
                        Log.Error(toEmail, $"UserCreatedMailForUser/SendMail/MailboxBusy/MailboxUnavailable/SmtpFailedRecipientsException:Inner {ex.Message}", "Email Log");
                    }
                    else
                    {
                        Log.Error(toEmail, $"UserCreatedMailForUser/SendMail/SmtpFailedRecipientsException:Inner - {ex.Message}", "Email Log");
                    }
                }
                Log.Error(toEmail, $"UserCreatedMailForUser/SendMail/SmtpFailedRecipientsException:- {ex.Message}", "Email Log");
                return false;
            }
            catch (SmtpException ex)
            {
                await LogMailAsync("User Created", toEmail, null, false, ex.Message);
                Log.Error(toEmail, $"UserCreatedMailForUser/SendMail/SmtpException:- {ex.Message}", "Email Log");
                return false;
            }
            catch (Exception ex)
            {
                await LogMailAsync("User Created", toEmail, null, false, ex.Message);
                Log.Error(toEmail, $"UserCreatedMailForUser/SendMail/Exception:- {ex.Message}", "Email Log");
                return false;
            }
        }

        #endregion

        #region User Activation (ID 3)

        public async Task<bool> SendSignUpUserCreatedMailForViewUser(string FirstName, string LastName, string toEmail, string Password, string url)
        {
            try
            {
                var ec = GetEmailConfig();
                var tpl = GetTemplate(TPL_USER_ACTIVATION);

                var subject = await SendFromTemplateAsync(ec, tpl, toEmail, new Dictionary<string, string>
                {
                    ["@LoginLink@"] = url,
                    ["@DearUser@"] = FirstName + " " + LastName,
                    ["@UserName@"] = toEmail
                }, useVaultPassword: true);

                Log.DataLog(toEmail, $"User Registration mail has been sent successfully to {toEmail}", "User Credentils Share Log");
                await LogMailAsync("Registration Approved", toEmail, subject, true);
                return true;
            }
            catch (SmtpFailedRecipientsException ex)
            {
                await LogMailAsync("Registration Approved", toEmail, null, false, ex.Message);
                for (int i = 0; i < ex.InnerExceptions.Length; i++)
                {
                    SmtpStatusCode status = ex.InnerExceptions[i].StatusCode;
                    if (status == SmtpStatusCode.MailboxBusy || status == SmtpStatusCode.MailboxUnavailable)
                    {
                        Log.Error(toEmail, $"SignUpUserCreatedMailForViewUser/SendMail/MailboxBusy/MailboxUnavailable/SmtpFailedRecipientsException:Inner- {ex.Message}", "User Credentils Share Log");
                    }
                    else
                    {
                        Log.Error(toEmail, $"SignUpUserCreatedMailForViewUser/SendMail/SmtpFailedRecipientsException:Inner- {ex.Message}", "User Credentils Share Log");
                    }
                }
                Log.Error(toEmail, $"SignUpUserCreatedMailForViewUser/SendMail/SmtpFailedRecipientsException:- {ex.Message}", "User Credentils Share Log");
                return false;
            }
            catch (SmtpException ex)
            {
                await LogMailAsync("Registration Approved", toEmail, null, false, ex.Message);
                Log.Error(toEmail, $"SignUpUserCreatedMailForViewUser/SendMail/SmtpException:- {ex.Message}", "User Credentils Share Log");
                return false;
            }
            catch (Exception ex)
            {
                await LogMailAsync("Registration Approved", toEmail, null, false, ex.Message);
                Log.Error(toEmail, $"SignUpUserCreatedMailForViewUser/SendMail/Exception:- {ex.Message}", "User Credentils Share Log");
                return false;
            }
        }

        #endregion

        #region Reset Password (ID 2)

        public async Task<bool> SendMailForUserResetPasswordMail(string code, string UserName, string toEmail, string userID, string siteURL)
        {
            try
            {
                var ec = GetEmailConfig();
                var tpl = GetTemplate(TPL_RESET_PASSWORD);

                var subject = await SendFromTemplateAsync(ec, tpl, toEmail, new Dictionary<string, string>
                {
                    ["@ResetLink@"] = siteURL + "?token=" + code + "&Id=" + userID,
                    ["@UserName@"] = UserName
                }, useVaultPassword: true);

                Log.DataLog(toEmail, $"Password Reset link has been sent successfully to the user email {toEmail}", "Password Reset mail Log");
                await LogMailAsync("Password Reset Link", toEmail, subject, true);
                return true;
            }
            catch (SmtpFailedRecipientsException ex)
            {
                await LogMailAsync("Password Reset Link", toEmail, null, false, ex.Message);
                for (int i = 0; i < ex.InnerExceptions.Length; i++)
                {
                    SmtpStatusCode status = ex.InnerExceptions[i].StatusCode;
                    if (status == SmtpStatusCode.MailboxBusy || status == SmtpStatusCode.MailboxUnavailable)
                    {
                        Log.Error(toEmail, $"UserResetPassword/SendMail/MailboxBusy/MailboxUnavailable/SmtpFailedRecipientsException:Inner- {ex.Message}", "Password Reset mail Log");
                    }
                    else
                    {
                        Log.Error(toEmail, $"UserResetPassword/SendMail/SmtpFailedRecipientsException:Inner- {ex.Message}", "Password Reset mail Log");
                    }
                }
                Log.Error(toEmail, $"UserResetPassword/SendMail/SmtpFailedRecipientsException:- {ex.Message}", "Password Reset mail Log");
                return false;
            }
            catch (SmtpException ex)
            {
                await LogMailAsync("Password Reset Link", toEmail, null, false, ex.Message);
                Log.Error(toEmail, $"UserResetPassword/SendMail/SmtpException {ex.Message}", "Password Reset mail Log");
                return false;
            }
            catch (Exception ex)
            {
                await LogMailAsync("Password Reset Link", toEmail, null, false, ex.Message);
                Log.Error(toEmail, $"UserResetPassword/SendMail/Exception {ex.Message}", "Password Reset mail Log");
                return false;
            }
        }

        #endregion

        #region Document access OTP (ID 6)

        public async Task<bool> SendOtpForDocAuthentivcationMail(string otp, string UserName, string toEmail)
        {
            try
            {
                var ec = GetEmailConfig();
                var tpl = GetTemplate(TPL_DOC_ACCESS_OTP);

                var subject = await SendFromTemplateAsync(ec, tpl, toEmail, new Dictionary<string, string>
                {
                    ["@UserName@"] = UserName,
                    ["@otp@"] = otp
                }, useVaultPassword: true);

                Log.DataLog(toEmail, $"OTP for Login has been sent successfully to {UserName}.", "FolderorFileAccess OTP Log");
                await LogMailAsync("Document Access OTP", toEmail, subject, true);
                return true;
            }
            catch (Exception ex)
            {
                await LogMailAsync("Document Access OTP", toEmail, null, false, ex.Message);
                Log.Error(toEmail, $"While sharing otp to {UserName} following error occured : {ex.Message}.", "FolderorFileAccess OTP Log");
                return false;
            }
        }

        #endregion

        #region File access - internal (ID 4)

        public async Task<bool> SendMailForInternalDocAccessMail(string toEmail, string fromEmail, string docType, string docName, string siteURL)
        {
            try
            {
                var ec = GetEmailConfig();
                var tpl = GetTemplate(TPL_FILE_ACCESS_INTERNAL);

                var subject = await SendFromTemplateAsync(ec, tpl, toEmail, new Dictionary<string, string>
                {
                    ["@toEmail@"] = toEmail,
                    ["@fromEmail@"] = fromEmail,
                    ["@docType@"] = docType,
                    ["@docName@"] = docName,
                    ["@siteURL@"] = siteURL
                }, useVaultPassword: true);

                Log.DataLog(toEmail, $"To access the files or folders for internal user mail {toEmail} has beensent successfully ", "Internal Share Access maillog");
                await LogMailAsync("Internal Share Access", toEmail, subject, true);
                return true;
            }
            catch (Exception ex)
            {
                await LogMailAsync("Internal Share Access", toEmail, null, false, ex.Message);
                Log.Error(toEmail, $"To access the files or folders for internal user mail {toEmail} following error occured {ex.Message} ", "Internal Share Access maillog");
                return false;
            }
        }

        #endregion

        #region Registration request to admins (template: MailType "User Registration Request")
        // tokens: @FirstName@ @LastName@ @EmployeeMail@ @EmployeeId@ @LoginLink@

        public async Task<bool> SendSignUpUserRequestMailFromAdmin(string firstName, string lastName, string toEmail, string createdUser, string EmployeeMail)
        {
            try
            {
                var ec = GetEmailConfig();
                var tpl = GetTemplate(TPL_REGISTRATION_REQUEST);

                var subject = await SendFromTemplateAsync(ec, tpl, toEmail, new Dictionary<string, string>
                {
                    ["@FirstName@"] = H(firstName),
                    ["@LastName@"] = H(lastName),
                    ["@EmployeeMail@"] = H(EmployeeMail),
                    ["@EmployeeId@"] = H(createdUser),
                    ["@LoginLink@"] = H(_configuration["SiteURL"])
                }, useVaultPassword: false);

                Log.DataLog(toEmail, $"User registered with the the mail {toEmail} details has been shared successfully to the admins", "Email Log");
                await LogMailAsync("Registration Request (Admin)", toEmail, subject, true);
                return true;
            }
            catch (SmtpException ex)
            {
                await LogMailAsync("Registration Request (Admin)", toEmail, null, false, ex.Message);
                Log.Error(toEmail, $"SignUpUserRequestMailFromAdmin/SendMail/SmtpException:- {ex.Message}", "Email Log");
                return false;
            }
            catch (Exception ex)
            {
                await LogMailAsync("Registration Request (Admin)", toEmail, null, false, ex.Message);
                Log.Error(toEmail, $"SignUpUserRequestMailFromAdmin/SendMail/Exception:- {ex.Message}", "Email Log");
                return false;
            }
        }

        #endregion

        #region File access - external (ID 5)

        public async Task<bool> SendMailForDocAccessMail(string token, int docID, string toEmail, string fromEmail, string docName, string docType, string comments, string siteURL)
        {
            try
            {
                var ec = GetEmailConfig();
                var tpl = GetTemplate(TPL_FILE_ACCESS_EXTERNAL);

                var subject = await SendFromTemplateAsync(ec, tpl, toEmail, new Dictionary<string, string>
                {
                    ["@siteURL@"] = siteURL + "/externalAccess?token=" + token + "&EmailId=" + HttpUtility.UrlEncode(toEmail) + "&ESAID=" + docID,
                    ["@toEmail@"] = toEmail,
                    ["@fromEmail@"] = fromEmail,
                    ["@docType@"] = docType,
                    ["@docName@"] = docName
                }, useVaultPassword: true);

                Log.DataLog(toEmail, $"To access the files or folders for internal user mail {toEmail} has beensent successfully ", "Share Access maillog");
                await LogMailAsync("External Share Access", toEmail, subject, true);
                return true;
            }
            catch (Exception ex)
            {
                await LogMailAsync("External Share Access", toEmail, null, false, ex.Message);
                Log.Error(toEmail, $"To access the files or folders for  user mail {toEmail} following error occured {ex.Message} ", "Share Access maillog");
                return false;
            }
        }

        #endregion

        #region Password reset OTP (no template configured - logging added)

        public async Task<string> GenerateAndSendOTP(string email)
        {
            // Generate the OTP using your desired logic
            Random random = new Random();
            string generatedOtp = random.Next(100000, 999999).ToString();
            if (!string.IsNullOrEmpty(generatedOtp))
            {
                var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == email);
                if (user != null)
                {
                    DateTime expiryTime = DateTime.Now.AddMinutes(10);
                    // Save OTP details to the database
                    var passwordReset = new PasswordResetOtpHistory
                    {
                        Email = email,
                        OTP = generatedOtp,
                        OTPIsActive = true,
                        CreatedOn = DateTime.Now,
                        ExpiryOn = expiryTime,
                        CreatedBy = user.Email
                    };
                    _dbContext.PasswordResetOtpHistorys.Add(passwordReset);
                    await _dbContext.SaveChangesAsync();
                }
            }

            // Send OTP via email
            try
            {
                var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);

                if (ec != null)
                {
                    MailMessage message = new MailMessage();
                    SmtpClient smtp = new SmtpClient(ec.ServerAddress);

                    message.From = new MailAddress(ec.MailAddress);
                    message.To.Add(new MailAddress(email));
                    message.Subject = "Password Reset OTP";
                    message.IsBodyHtml = false;
                    string messageBody = $"Your OTP is: {generatedOtp}. Please use it within 5 minutes.";
                    message.Body = messageBody;


                    smtp.Port = int.Parse(ec.OutgoingPort);
                    smtp.EnableSsl = true;
                    smtp.Timeout = 60000;
                    smtp.UseDefaultCredentials = false;
                    smtp.Credentials = new NetworkCredential(ec.MailAddress, ec.Password);
                    smtp.DeliveryMethod = SmtpDeliveryMethod.Network;

                    await smtp.SendMailAsync(message);
                    Log.DataLog(email, $"OTP {generatedOtp} has been sent to the usere email {email} to reset the password", "OTP Log");
                    await LogMailAsync("Password Reset OTP", email, message.Subject, true);
                    return generatedOtp;
                }
                else
                {
                    throw new Exception("Email configuration not found");
                }
            }
            catch (Exception ex)
            {
                await LogMailAsync("Password Reset OTP", email, "Password Reset OTP", false, ex.Message);
                Log.Error(email, $"While sending or generating otp to send the mail for the user email {email} following error occured", "OTP Log");
                throw new Exception("Failed to send OTP via email", ex);
            }
        }

        #endregion

        #region  GetMailConfigurationPassword

        public EMailDetails GetEMailDetails(string username, string connectionString, string tableName)
        {
            try
            {
                string query = @$"select * from {tableName} where ID=16";
                DataTable table = GetTableData(query, connectionString);
                string JSONString = JsonConvert.SerializeObject(table);
                var result = JsonConvert.DeserializeObject<List<EMailDetails>>(JSONString);
                return result[0];
            }
            catch (Exception ex)
            {
                throw ex;
            }
        }

        public DataTable GetTableData(string SQL, string connectionString)
        {
            try
            {
                DataTable dt = new DataTable();
                SqlConnection con = new SqlConnection(connectionString);
                SqlCommand cmd = new SqlCommand(SQL);
                cmd.Connection = con;
                using (SqlDataAdapter da = new SqlDataAdapter(cmd))
                {
                    da.Fill(dt);
                }
                cmd.Dispose();
                con.Close();
                return dt;
            }
            catch (Exception ex)
            {
                return null;
            }
        }

        public class EMailDetails
        {
            public string Email { get; set; }
            public string Password { get; set; }
        }

        #endregion
    }
}