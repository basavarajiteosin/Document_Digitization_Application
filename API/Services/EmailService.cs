using DDAAPI.DbContexts;
//using DDAAPI.Helpers;
using DDAAPI.Models;
using DDAAPI.Services;
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

        public EmailService(IConfiguration configuration, AppDbContext dbContext)
        {
            _configuration = configuration;
            _dbContext = dbContext;
        }

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


        public async Task<bool> SendMFAOtpForAuthentivcationMail(string otp, string UserName, string toEmail)
        {
            try
            {
                var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);

                var STMPDetailsConfig = _configuration.GetSection("STMPDetails");
                string tableName = STMPDetailsConfig["TableName"];
                string connectionString = STMPDetailsConfig["EmailContext"];

                EMailDetails details = GetEMailDetails(ec.UserName, connectionString, tableName);

                if (ec != null)
                {
                    MailMessage message = new MailMessage();

                    using (SmtpClient smtp = new SmtpClient(ec.ServerAddress))
                    {
                        message.From = new MailAddress(ec.MailAddress);
                        message.To.Add(new MailAddress(toEmail));
                        message.Subject = "OTP for Login";
                        message.IsBodyHtml = true;

                        message.Body = $@" <html> <head> <style> /* CSS styles for responsive email */ @media only screen and (max-width: 600px) {{ /* Responsive styles here */ .container {{ width: 100%; padding: 10px; }} }} </style> </head> <body> <div style='border: 1px solid #dbdbdb;'> <div style='padding: 20px 20px; background-color: #fff06769; text-align: center; font-family: Segoe UI;'> <h2>Wipro User Authentication </h2> </div> <div style='background-color: #f8f7f7; padding: 20px 20px; font-family: Segoe UI;'> <div style='padding: 20px 20px; border: 1px solid white; background-color: white !important;'> <p>Dear {UserName},</p> <p>Your One-Time Password (OTP) for login is: <strong>{otp}</strong></p> <p>Please use this OTP to proceed with your login.</p> <p><em>This OTP will expire in 5 minutes.</em></p> <p>Regards,<br/>Admin</p> </div> </div> </div> </body> </html> ";

                        smtp.Port = int.Parse(ec.OutgoingPort);
                        smtp.EnableSsl = true;
                        smtp.Timeout = 60000;
                        smtp.UseDefaultCredentials = false;
                        smtp.Credentials = new NetworkCredential(ec.UserName, details.Password);
                        smtp.DeliveryMethod = SmtpDeliveryMethod.Network;

                        message.BodyEncoding = UTF8Encoding.UTF8;
                        message.DeliveryNotificationOptions = DeliveryNotificationOptions.OnFailure;

                        ServicePointManager.ServerCertificateValidationCallback +=
                            (sender, certificate, chain, sslPolicyErrors) => true;

                        await smtp.SendMailAsync(message);

                        Log.DataLog(
                            toEmail,
                            $"OTP has been sent successfully to {toEmail}",
                            "MFA OTP Mail Log");
                    }
                }
                else
                {
                    throw new Exception("Email configuration not found.");
                }

                return true;
            }
            catch (SmtpFailedRecipientsException ex)
            {
                for (int i = 0; i < ex.InnerExceptions.Length; i++)
                {
                    SmtpStatusCode status = ex.InnerExceptions[i].StatusCode;

                    if (status == SmtpStatusCode.MailboxBusy ||
                        status == SmtpStatusCode.MailboxUnavailable)
                    {
                        Log.Error(
                            toEmail,
                            $"MFAOtp/SendMail/MailboxBusy/MailboxUnavailable/SmtpFailedRecipientsException: {ex.Message}",
                            "MFA OTP Mail Log");
                    }
                    else
                    {
                        Log.Error(
                            toEmail,
                            $"MFAOtp/SendMail/SmtpFailedRecipientsException: {ex.Message}",
                            "MFA OTP Mail Log");
                    }
                }

                Log.Error(
                    toEmail,
                    $"MFAOtp/SendMail/SmtpFailedRecipientsException: {ex.Message}",
                    "MFA OTP Mail Log");

                return false;
            }
            catch (SmtpException ex)
            {
                Log.Error(
                    toEmail,
                    $"MFAOtp/SendMail/SmtpException: {ex.Message}",
                    "MFA OTP Mail Log");

                return false;
            }
            catch (Exception ex)
            {
                Log.Error(
                    toEmail,
                    $"MFAOtp/SendMail/Exception: {ex.Message}",
                    "MFA OTP Mail Log");

                return false;
            }
        }

        public async Task<bool> SendBehalfActionNotificationMail(string ownerEmail, string ownerName, string actingUserName, string itemName, string itemType, string actionType,string FolderName)
        {
            // itemType: "Folder" | "File"
            // actionType: "Created" | "Uploaded"
            try
            {
                var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);

                if (ec != null)
                {
                    MailMessage message = new MailMessage();
                    string subject = $"{itemType} {actionType} in Your Shared Folder";
                    StringBuilder sb = new StringBuilder();

                    sb.Append($@"
             <div style='padding:20px;'>
                 <div style='border:1px solid #dbdbdb;padding:20px'>
                     <div style='font-family: Segoe UI;'>
                         <h2 align='center'>Wipro DMS Notification</h2>
                         <div>
                             <div style='border:1px solid white;background-color: white !important'>
                                 <p>Dear {ownerName},</p>
                                 <p><b>{actingUserName}</b> has {actionType.ToLower()} the {itemType.ToLower()} <b>'{itemName}'</b> in your shared <b>'{FolderName}'</b> folder.</p>
                                 <p>&nbsp;</p>
                                 <p>Regards,</p>
                                 <p>Wipro Admin</p>
                                 <p align='center' style='font-size:10px;'>Sensitivity: Internal &amp; Restricted</p>
                             </div>
                         </div>
                     </div>
                 </div>
             </div>
             ");

                    SmtpClient client = new SmtpClient(ec.ServerAddress);
                    client.Port = int.Parse(ec.OutgoingPort);
                    client.EnableSsl = true;
                    client.Timeout = 60000;
                    client.UseDefaultCredentials = false;
                    client.Credentials = new System.Net.NetworkCredential(ec.MailAddress, ec.Password);

                    MailMessage reportEmail = new MailMessage(ec.UserName, ownerEmail, subject, sb.ToString());
                    reportEmail.BodyEncoding = UTF8Encoding.UTF8;
                    reportEmail.DeliveryNotificationOptions = DeliveryNotificationOptions.OnFailure;
                    reportEmail.IsBodyHtml = true;

                    ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;

                    await client.SendMailAsync(reportEmail);

                    Log.DataLog(ownerEmail, $"Notified owner {ownerEmail} that {actingUserName} {actionType.ToLower()} {itemType.ToLower()} '{itemName}'", "Behalf Action Notification Log");
                    return true;
                }
                else
                {
                    throw new Exception("Email configuration not found");
                }
            }
            catch (Exception ex)
            {
                // Never let a notification failure break the create/upload flow.
                Log.Error(ownerEmail, $"Behalf/SendBehalfActionNotificationMail/Exception:- {ex.Message}", "Behalf Action Notification Log");
                return false;
            }
        }

        public async Task<bool> SendUserCreatedMailForUser(string FirstName, string LastName, string toEmail, string Password, string url)
        {
            try
            {
                var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);
                var ebody = _dbContext.MailBodyConfigurations.FirstOrDefault(k => k.ID == 1);
                var STMPDetailsConfig = _configuration.GetSection("STMPDetails");
                string tableName = STMPDetailsConfig["TableName"];
                string connectionString = STMPDetailsConfig["EmailContext"];
                EMailDetails details = GetEMailDetails(ec.UserName, connectionString, tableName);
                if (ec != null && ebody != null)
                {
                    MailMessage message = new MailMessage();
                    using (SmtpClient smtp = new SmtpClient(ec.ServerAddress))
                    {
                        message.From = new MailAddress(ec.MailAddress);
                        message.To.Add(new MailAddress(toEmail));
                        message.Subject = ebody.MailSubject;
                        message.IsBodyHtml = false; //to make message body as html
                        message.Body = ebody.MailBody;
                        message.Body = message.Body.Replace("@LoginLink@", url);
                        message.Body = message.Body.Replace("@DearUser@", FirstName + " " + LastName);
                        message.Body = message.Body.Replace("@UserName@", toEmail);
                        message.Body = message.Body.Replace("@Password@", Password);
                        smtp.Port = int.Parse(ec.OutgoingPort);
                        smtp.EnableSsl = true;
                        smtp.Timeout = 60000;
                        smtp.UseDefaultCredentials = false;
                        smtp.Credentials = new NetworkCredential(ec.UserName, details.Password);
                        smtp.DeliveryMethod = SmtpDeliveryMethod.Network;
                        message.BodyEncoding = UTF8Encoding.UTF8;
                        message.DeliveryNotificationOptions = DeliveryNotificationOptions.OnFailure;
                        message.IsBodyHtml = true;
                        ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;
                        await smtp.SendMailAsync(message);
                        Log.DataLog(toEmail, $"User credentials has been shared successfully to the mail {toEmail}", "Email Log");
                    }
                }
                else
                {
                    throw new Exception("Email configuration or Invoice details not found");
                }
                //  WriteLog.AddMailWriteLog($"Registration link has been sent successfully to {toEmail}", toEmail);
                return true;
            }
            catch (SmtpFailedRecipientsException ex)
            {
                for (int i = 0; i < ex.InnerExceptions.Length; i++)
                {
                    SmtpStatusCode status = ex.InnerExceptions[i].StatusCode;
                    if (status == SmtpStatusCode.MailboxBusy || status == SmtpStatusCode.MailboxUnavailable)
                    {
                        Log.Error(toEmail, $"UserCreatedMailForUser/SendMail/MailboxBusy/MailboxUnavailable/SmtpFailedRecipientsException:Inner {ex.Message}", "Email Log");
                        //ErrorLog.AddMailErrorLog($"UserCreatedMailForUser/SendMail/MailboxBusy/MailboxUnavailable/SmtpFailedRecipientsException:Inner-", ex.Message);
                    }
                    else
                    {
                        Log.Error(toEmail, $"UserCreatedMailForUser/SendMail/SmtpFailedRecipientsException:Inner - {ex.Message}", "Email Log");

                        // ErrorLog.AddMailErrorLog($"UserCreatedMailForUser/SendMail/SmtpFailedRecipientsException:Inner- ", ex.Message);
                    }
                }
                Log.Error(toEmail, $"UserCreatedMailForUser/SendMail/SmtpFailedRecipientsException:- {ex.Message}", "Email Log");
                //ErrorLog.AddMailErrorLog($"UserCreatedMailForUser/SendMail/SmtpFailedRecipientsException:-", ex.Message);
                return false;
            }
            catch (SmtpException ex)
            {
                Log.Error(toEmail, $"UserCreatedMailForUser/SendMail/SmtpException:- {ex.Message}", "Email Log");
                //ErrorLog.AddMailErrorLog($"UserCreatedMailForUser/SendMail/SmtpException:-", ex.Message);
                return false;
            }
            catch (Exception ex)
            {
                Log.Error(toEmail, $"UserCreatedMailForUser/SendMail/Exception:- {ex.Message}", "Email Log");
                //ErrorLog.AddMailErrorLog($"UserCreatedMailForUser/SendMail/Exception:-", ex.Message);
                return false;
            }
        }
        public async Task<bool> SendSignUpUserCreatedMailForViewUser(string FirstName, string LastName, string toEmail, string Password, string url)
        {
            try
            {
                var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);
                var ebody = _dbContext.MailBodyConfigurations.FirstOrDefault(k => k.ID == 3);
                var STMPDetailsConfig = _configuration.GetSection("STMPDetails");
                string tableName = STMPDetailsConfig["TableName"];
                string connectionString = STMPDetailsConfig["EmailContext"];
                EMailDetails details = GetEMailDetails(ec.UserName, connectionString, tableName);
                if (ec != null && ebody != null)
                {
                    MailMessage message = new MailMessage();
                    using (SmtpClient smtp = new SmtpClient(ec.ServerAddress))
                    {
                        message.From = new MailAddress(ec.MailAddress);
                        message.To.Add(new MailAddress(toEmail));
                        message.Subject = ebody.MailSubject;
                        message.IsBodyHtml = false; //to make message body as html
                        message.Body = ebody.MailBody;
                        message.Body = message.Body.Replace("@LoginLink@", url);
                        message.Body = message.Body.Replace("@DearUser@", FirstName + " " + LastName);
                        message.Body = message.Body.Replace("@UserName@", toEmail);
                        // message.Body = message.Body.Replace("@Password@", Password);
                        smtp.Port = int.Parse(ec.OutgoingPort);
                        smtp.EnableSsl = true;
                        smtp.Timeout = 60000;
                        smtp.UseDefaultCredentials = false;
                        smtp.Credentials = new NetworkCredential(ec.UserName, details.Password);
                        smtp.DeliveryMethod = SmtpDeliveryMethod.Network;
                        message.BodyEncoding = UTF8Encoding.UTF8;
                        message.DeliveryNotificationOptions = DeliveryNotificationOptions.OnFailure;
                        message.IsBodyHtml = true;
                        ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;
                        await smtp.SendMailAsync(message);
                    }
                }
                else
                {
                    throw new Exception("Email configuration or Invoice details not found");
                }
                Log.DataLog(toEmail, $"User Registration mail has been sent successfully to {toEmail}", "User Credentils Share Log");
                //WriteLog.AddMailWriteLog($"Registration link has been sent successfully to {toEmail}", toEmail);
                return true;
            }
            catch (SmtpFailedRecipientsException ex)
            {
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

                        //ErrorLog.AddMailErrorLog($"SignUpUserCreatedMailForViewUser/SendMail/SmtpFailedRecipientsException:Inner-", ex.Message);
                    }
                }
                Log.Error(toEmail, $"SignUpUserCreatedMailForViewUser/SendMail/SmtpFailedRecipientsException:- {ex.Message}", "User Credentils Share Log");

                //ErrorLog.AddMailErrorLog($"SignUpUserCreatedMailForViewUser/SendMail/SmtpFailedRecipientsException:- ", ex.Message);
                return false;
            }
            catch (SmtpException ex)
            {
                Log.Error(toEmail, $"SignUpUserCreatedMailForViewUser/SendMail/SmtpException:- {ex.Message}", "User Credentils Share Log");

                //ErrorLog.AddMailErrorLog($"SignUpUserCreatedMailForViewUser/SendMail/SmtpException:- ", ex.Message);
                return false;
            }
            catch (Exception ex)
            {
                Log.Error(toEmail, $"SignUpUserCreatedMailForViewUser/SendMail/Exception:- {ex.Message}", "User Credentils Share Log");

                //ErrorLog.AddMailErrorLog($"SignUpUserCreatedMailForViewUser/SendMail/Exception:- ", ex.Message);
                return false;
            }
        }

        public async Task<bool> SendMailForUserResetPasswordMail(string code, string UserName, string toEmail, string userID, string siteURL)
        {
            try
            {
                var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);
                var ebody = _dbContext.MailBodyConfigurations.FirstOrDefault(k => k.ID == 2);
                var STMPDetailsConfig = _configuration.GetSection("STMPDetails");
                string tableName = STMPDetailsConfig["TableName"];
                string connectionString = STMPDetailsConfig["EmailContext"];
                EMailDetails details = GetEMailDetails(ec.UserName, connectionString, tableName);
                if (ec != null && ebody != null)
                {
                    MailMessage message = new MailMessage();
                    using (SmtpClient smtp = new SmtpClient(ec.ServerAddress))
                    {
                        message.From = new MailAddress(ec.MailAddress);
                        message.To.Add(new MailAddress(toEmail));
                        message.Subject = ebody.MailSubject;
                        message.IsBodyHtml = false; //to make message body as html
                        message.Body = ebody.MailBody;
                        message.Body = message.Body.Replace("@ResetLink@", siteURL + "?token=" + code + "&Id=" + userID);
                        message.Body = message.Body.Replace("@UserName@", UserName);
                        smtp.Port = int.Parse(ec.OutgoingPort);
                        smtp.EnableSsl = true;
                        smtp.Timeout = 60000;
                        smtp.UseDefaultCredentials = false;
                        smtp.Credentials = new NetworkCredential(ec.UserName, details.Password);
                        smtp.DeliveryMethod = SmtpDeliveryMethod.Network;
                        message.BodyEncoding = UTF8Encoding.UTF8;
                        message.DeliveryNotificationOptions = DeliveryNotificationOptions.OnFailure;
                        message.IsBodyHtml = true;
                        ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;
                        await smtp.SendMailAsync(message);
                        Log.DataLog(toEmail, $"Password Reset link has been sent successfully to the user email {toEmail}", "Password Reset mail Log");
                    }
                }
                else
                {
                    throw new Exception("Email configuration or Invoice details not found");
                }
                // WriteLog.AddMailWriteLog($"Registration link has been sent successfully to {toEmail}", toEmail);
                return true;
            }
            catch (SmtpFailedRecipientsException ex)
            {
                for (int i = 0; i < ex.InnerExceptions.Length; i++)
                {
                    SmtpStatusCode status = ex.InnerExceptions[i].StatusCode;
                    if (status == SmtpStatusCode.MailboxBusy || status == SmtpStatusCode.MailboxUnavailable)
                    {

                        Log.Error(toEmail, $"UserResetPassword/SendMail/MailboxBusy/MailboxUnavailable/SmtpFailedRecipientsException:Inner- {ex.Message}",
                         "Password Reset mail Log");
                        //ErrorLog.AddMailErrorLog($"UserResetPassword/SendMail/MailboxBusy/MailboxUnavailable/SmtpFailedRecipientsException:Inner-", ex.Message);
                    }
                    else
                    {
                        Log.Error(toEmail, $"UserResetPassword/SendMail/SmtpFailedRecipientsException:Inner- {ex.Message}",
                      "Password Reset mail Log");
                        //ErrorLog.AddMailErrorLog($"UserResetPassword/SendMail/SmtpFailedRecipientsException:Inner- ", ex.Message);
                    }
                }
                Log.Error(toEmail, $"UserResetPassword/SendMail/SmtpFailedRecipientsException:- {ex.Message}",
                    "Password Reset mail Log");
                //ErrorLog.AddMailErrorLog($"UserResetPassword/SendMail/SmtpFailedRecipientsException:-", ex.Message);
                return false;
            }
            catch (SmtpException ex)
            {
                Log.Error(toEmail, $"UserResetPassword/SendMail/SmtpException {ex.Message}",
                   "Password Reset mail Log");
                //ErrorLog.AddMailErrorLog($"UserResetPassword/SendMail/SmtpException:- ", ex.Message);
                return false;
            }
            catch (Exception ex)
            {
                Log.Error(toEmail, $"UserResetPassword/SendMail/Exception {ex.Message}",
                  "Password Reset mail Log");
                //ErrorLog.AddMailErrorLog($"UserResetPassword/SendMail/Exception:- ", ex.Message);
                return false;
            }
        }


        //public async Task<bool> SendOtpForDocAuthentivcationMail(string otp, string UserName, string toEmail)
        //{
        //    try
        //    {
        //        var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);

        //        if (ec != null)
        //        {
        //            // Prepare email message
        //            MailMessage message = new MailMessage();
        //            message.From = new MailAddress(ec.MailAddress); // Sender's email and name
        //            message.To.Add(new MailAddress(toEmail)); // Recipient's email
        //            message.Subject = "OTP for Access the Document"; // Email subject

        //            // Generate HTML content for the email
        //            string htmlBody = $@"
        //        <html>
        //        <head>
        //            <style>
        //                /* CSS styles for responsive email */
        //                @media only screen and (max-width: 600px) {{
        //                    /* Responsive styles here */
        //                    .container {{
        //                        width: 100%;
        //                        padding: 10px;
        //                    }}
        //                }}
        //            </style>
        //        </head>
        //        <body>
        //            <div style='border: 1px solid #dbdbdb;'>
        //                <div style='padding: 20px 20px; background-color: #fff06769; text-align: center; font-family: Segoe UI;'>
        //                    <h2>Wipro User Authentication </h2>
        //                </div>
        //                <div style='background-color: #f8f7f7; padding: 20px 20px; font-family: Segoe UI;'>
        //                    <div style='padding: 20px 20px; border: 1px solid white; background-color: white !important;'>
        //                        <p>Dear {UserName},</p>
        //                        <p>Your One-Time Password (OTP) for login is: <strong>{otp}</strong></p>
        //                        <p>Please use this OTP to proceed access your document.</p>
        //                        <p><em>This OTP will expire in 5 minutes.</em></p>
        //                        <p>Regards,<br/>Admin</p>
        //                    </div>
        //                </div>
        //            </div>
        //        </body>
        //        </html>
        //    ";

        //            message.Body = htmlBody;
        //            message.IsBodyHtml = true;

        //            // Configure SMTP client
        //            SmtpClient client = new SmtpClient(ec.ServerAddress);
        //            client.Port = int.Parse(ec.OutgoingPort);
        //            client.EnableSsl = true;
        //            client.Timeout = 60000;
        //            client.UseDefaultCredentials = false;
        //            client.Credentials = new System.Net.NetworkCredential(ec.MailAddress, ec.Password);

        //            // Send email asynchronously
        //            await client.SendMailAsync(message);

        //            ErrorLog.AddMailErrorLog(toEmail, $"OTP for Login has been sent successfully to {UserName}.");
        //            return true;
        //        }
        //        else
        //        {
        //            throw new Exception("Email configuration not found");
        //        }
        //    }
        //    catch (Exception ex)
        //    {
        //        ErrorLog.AddMailErrorLog($"UserResetPassword/SendMail/Exception:- ", ex.Message);
        //        return false;
        //    }
        //}

        public async Task<bool> SendOtpForDocAuthentivcationMail(string otp, string UserName, string toEmail)
        {
            try
            {
                var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);
                var ebody = _dbContext.MailBodyConfigurations.FirstOrDefault(k => k.ID == 6);
                var STMPDetailsConfig = _configuration.GetSection("STMPDetails");
                string tableName = STMPDetailsConfig["TableName"];
                string connectionString = STMPDetailsConfig["EmailContext"];
                EMailDetails details = GetEMailDetails(ec.UserName, connectionString, tableName);
                if (ec != null && ebody != null)
                {
                    MailMessage message = new MailMessage();
                    using (SmtpClient smtp = new SmtpClient(ec.ServerAddress))
                    {
                        message.From = new MailAddress(ec.MailAddress);
                        message.To.Add(new MailAddress(toEmail));
                        message.Subject = ebody.MailSubject;
                        message.IsBodyHtml = false; //to make message body as html
                        message.Body = ebody.MailBody;
                        message.Body = message.Body.Replace("@UserName@", UserName);
                        message.Body = message.Body.Replace("@otp@", otp);
                        smtp.Port = int.Parse(ec.OutgoingPort);
                        smtp.EnableSsl = true;
                        smtp.Timeout = 60000;
                        smtp.UseDefaultCredentials = false;
                        smtp.Credentials = new NetworkCredential(ec.UserName, details.Password);
                        smtp.DeliveryMethod = SmtpDeliveryMethod.Network;
                        message.BodyEncoding = UTF8Encoding.UTF8;
                        message.DeliveryNotificationOptions = DeliveryNotificationOptions.OnFailure;
                        message.IsBodyHtml = true;
                        ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;
                        await smtp.SendMailAsync(message);
                        Log.DataLog(toEmail, $"OTP for Login has been sent successfully to {UserName}.", "FolderorFileAccess OTP Log");
                        //ErrorLog.AddMailErrorLog(toEmail, $"OTP for Login has been sent successfully to {UserName}.");
                        return true;
                    }
                }
                else
                {
                    throw new Exception("Email configuration not found");
                }
            }
            catch (Exception ex)
            {
                Log.Error(toEmail, $"While sharing otp to {UserName} following error occured : {ex.Message}.", "FolderorFileAccess OTP Log");
                //ErrorLog.AddMailErrorLog($"UserResetPassword/SendMail/Exception:- ", ex.Message);
                return false;
            }
        }

        //public async Task<bool> SendMailForInternalDocAccessMail(string toEmail, string fromEmail, string docType, string docName, string siteURL)
        //{
        //    try
        //    {
        //        var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);

        //        if (ec != null)
        //        {
        //            MailMessage message = new MailMessage();
        //            string subject = "File Access Invitation";
        //            StringBuilder sb = new StringBuilder();
        //            sb.Append($@"
        //<html>
        //<head>
        //    <meta charset=""UTF-8"">
        //    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
        //    <title>File Access Invitation</title>
        //    <link href='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css' rel='stylesheet'/>
        //    <style>
        //        /* CSS styles for responsive email */
        //        @media only screen and (max-width: 600px) {{
        //            .container {{
        //                width: 100%;
        //                padding: 10px;
        //            }}
        //            .email-content {{
        //                max-width: 90%; /* More responsive on small screens */
        //            }}
        //            .button {{
        //                font-size: 14px; /* Adjust button text size for smaller screens */
        //                padding: 12px; /* Adjust padding for a better touch target */
        //            }}
        //        }}
        //        body {{
        //            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        //            background-color: #f3f2f1; 
        //            margin: 0; 
        //            padding: 0;
        //        }}
        //    </style>
        //</head>
        //<body>
        //    <div style='border: 1px solid #dbdbdb;'>
        //        <div style='padding: 20px 20px; background-color: #fff06769; text-align: center; font-family: Segoe UI;'>
        //            <h2>File Access Invitation</h2>
        //        </div>
        //        <div style='background-color: #f8f7f7; padding: 20px 20px; font-family: Segoe UI;'>
        //            <div style='padding: 20px 20px; border: 1px solid white; background-color: white !important; text-align: center;'>
        //                <h1 style='font-size: 20px; margin: 0; margin-bottom: 20px;'>
        //                    @fromEmail@ invited you to access a file
        //                </h1>
        //                <p style='font-size: 14px; margin: 0; margin-bottom: 20px;'>
        //                    File Type: 
        //                    <span style='background-color: yellow; padding: 2px 4px; border-radius: 4px;'>@docType@</span>.
        //                </p>
        //                <div style='border: 1px solid #e1e1e1; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;'>
        //                    <i class='fas fa-folder icon' style='font-size: 40px; color: #2b579a; margin-right: 10px;'></i>
        //                    <span style='font-size: 16px;'>@docName@ - Copy</span>
        //                </div>
        //                <p style='font-size: 14px; color: #107c10; margin-bottom: 20px;'>
        //                    This <span style='color: #107c10; font-weight: bold;'>link</span> will work for anyone.
        //                </p>
        //                <div style='text-align: center; margin-bottom: 20px;'>
        //                    <a href='@siteURL@'>
        //                        <button style='width: 120px; height: 36px; background-color: #0078d4; color: #ffffff; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;'>Open</button>
        //                    </a>
        //                </div>
        //                <div class='footer' style='font-size: 12px; color: #767676; margin-top: 20px; text-align: center;'>
        //                    <i class='fab fa-microsoft' style='font-size: 20px; vertical-align: middle;'></i>
        //                    <a href='#' style='color: #767676; text-decoration: none;'>Privacy Statement</a>
        //                </div>
        //            </div>
        //        </div>
        //    </div>
        //</body>
        //</html>");


        //            // Create a MailMessage object
        //            SmtpClient client = new SmtpClient(ec.ServerAddress);
        //            client.Port = int.Parse(ec.OutgoingPort);
        //            client.EnableSsl = true;
        //            client.Timeout = 60000;
        //            client.UseDefaultCredentials = false;
        //            client.Credentials = new System.Net.NetworkCredential(ec.MailAddress, ec.Password);

        //            MailMessage reportEmail = new MailMessage(ec.UserName, toEmail, subject, sb.ToString());
        //            reportEmail.BodyEncoding = UTF8Encoding.UTF8;
        //            reportEmail.DeliveryNotificationOptions = DeliveryNotificationOptions.OnFailure;
        //            reportEmail.IsBodyHtml = true;

        //            ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;

        //            // Send email asynchronously
        //            await client.SendMailAsync(reportEmail);

        //            // Log success
        //            WriteLog.AddMailWriteLog($" For internal User Mail. Email sent successfully to: {toEmail}", toEmail);

        //            return true;
        //        }
        //        else
        //        {
        //            throw new Exception("Email configuration not found");
        //        }
        //    }
        //    catch (Exception ex)
        //    {
        //        // Log error
        //        ErrorLog.AddMailErrorLog($"Error sending email to {toEmail}: ", ex.Message);
        //        return false;
        //    }
        //}


        public async Task<bool> SendMailForInternalDocAccessMail(string toEmail, string fromEmail, string docType, string docName, string siteURL)
        {
            try
            {
                var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);

                var ebody = _dbContext.MailBodyConfigurations.FirstOrDefault(k => k.ID == 4);
                var STMPDetailsConfig = _configuration.GetSection("STMPDetails");
                string tableName = STMPDetailsConfig["TableName"];
                string connectionString = STMPDetailsConfig["EmailContext"];
                EMailDetails details = GetEMailDetails(ec.UserName, connectionString, tableName);
                if (ec != null && ebody != null)
                {
                    MailMessage message = new MailMessage();
                    using (SmtpClient smtp = new SmtpClient(ec.ServerAddress))
                    {
                        message.From = new MailAddress(ec.MailAddress);
                        message.To.Add(new MailAddress(toEmail));
                        message.Subject = ebody.MailSubject;
                        message.IsBodyHtml = false; //to make message body as html
                        message.Body = ebody.MailBody;
                        message.Body = message.Body.Replace("@toEmail@", toEmail);
                        message.Body = message.Body.Replace("@fromEmail@", fromEmail);
                        message.Body = message.Body.Replace("@docType@", docType);
                        message.Body = message.Body.Replace("@docName@", docName);
                        message.Body = message.Body.Replace("@siteURL@", siteURL);
                        smtp.Port = int.Parse(ec.OutgoingPort);
                        smtp.EnableSsl = true;
                        smtp.Timeout = 60000;
                        smtp.UseDefaultCredentials = false;
                        smtp.Credentials = new NetworkCredential(ec.UserName, details.Password);
                        smtp.DeliveryMethod = SmtpDeliveryMethod.Network;
                        message.BodyEncoding = UTF8Encoding.UTF8;
                        message.DeliveryNotificationOptions = DeliveryNotificationOptions.OnFailure;
                        message.IsBodyHtml = true;
                        ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;
                        await smtp.SendMailAsync(message);
                    }
                }
                else
                {
                    throw new Exception("Email configuration or Invoice details not found");
                }
                Log.DataLog(toEmail, $"To access the files or folders for internal user mail {toEmail} has beensent successfully ", "Internal Share Access maillog");
                //WriteLog.AddMailWriteLog($" For internal User Mail. Email sent successfully to: {toEmail}", toEmail);
                return true;
            }
            catch (Exception ex)
            {
                Log.Error(toEmail, $"To access the files or folders for internal user mail {toEmail} following error occured {ex.Message} ", "Internal Share Access maillog");
                //ErrorLog.AddMailErrorLog($"Error sending email to {toEmail}: ", ex.Message);
                return false;
            }
        }
        public async Task<bool> SendSignUpUserRequestMailFromAdmin(string firstName, string lastName, string toEmail, string createdUser, string EmployeeMail)
        {
            try
            {
                var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);

                if (ec != null)
                {
                    MailMessage message = new MailMessage();
                    string subject = "User Creation";
                    StringBuilder sb = new StringBuilder();
                    string logingurl = _configuration["SiteURL"];
                    sb.Append($@"
                   <div style='font-family:Segoe UI; padding:20px;'>
                       <h3 style=""text-align: center;"">User Registration Notification</h3>
                       <p>A new user has registered on the portal.<br/> Please log in to the DMS Portal to review and activate their account.</p>
                       <table style='border-collapse:collapse; margin-top:10px;'>
                           <tr><td><b>Name:</b></td><td>{firstName} {lastName}</td></tr>
                           <tr><td><b>Email:</b></td><td>{EmployeeMail}</td></tr>
                           <tr><td><b>Employee ID : </b></td><td>{createdUser}</td></tr>
                       </table>
                       <p style='margin-top:20px;'>
                           <a href='{logingurl}' style='color:#fff; background-color:#007bff; padding:10px 20px; text-decoration:none; border-radius:5px;'>Login</a>
                       </p>
                       <p>Regards,</p>
                       <p>Wipro Admin</p>
  

                         <div style=""font-size: 14px; font-family: Arial; margin-top: 10px;"">
                         <p style=""text-align: center;"">Sensitivity: Internal &amp; Restricted</p>
                           <p>
                             'The information contained in this electronic message and any attachments to this message 
                             are intended for the exclusive use of the addressee(s) and may contain proprietary, 
                             confidential or privileged information. If you are not the intended recipient, you should 
                             not disseminate, distribute or copy this e-mail. Please notify the sender immediately and 
                             destroy all copies of this message and any attachments. 
                           
                             WARNING: Computer viruses can be transmitted via email. The recipient should check this 
                             email and any attachments for the presence of viruses. The company accepts no liability 
                             for any damage caused by any virus transmitted by this email. 
                             <a href=""https://www.wipro.com"" target=""_blank"">www.wipro.com</a>
                           </p>
                         </div>
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
                    Log.DataLog(toEmail, $"User registered with the the mail {toEmail} details has been shared successfully to the admins", "Email Log");

                    //WriteLog.AddWriteLog($"Registration link has been sent successfully to {toEmail}", toEmail);
                    return true;
                }
                else
                {
                    Log.Error(toEmail, $"Email configuration not found", "Email Log");

                    throw new Exception("Email configuration not found");
                }
            }
            catch (SmtpException ex)
            {
                // Log exception or handle appropriately
                return false;
            }
            catch (Exception ex)
            {
                // Log exception or handle appropriately
                return false;
            }
        }



        //public async Task<bool> SendSignUpUserRequestMailFromAdmin(string FirstName, string LastName, string toEmail, string CreatedUser)
        //{
        //    try
        //    {
        //        var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);
        //        var ebody = _dbContext.MailBodyConfigurations.FirstOrDefault(k => k.ID == 3);
        //        var STMPDetailsConfig = _configuration.GetSection("STMPDetails");
        //        string tableName = STMPDetailsConfig["TableName"];
        //        string connectionString = STMPDetailsConfig["EmailContext"];
        //        EMailDetails details = GetEMailDetails(ec.UserName, connectionString, tableName);


        //        if (ec != null && ebody != null)
        //        {
        //            MailMessage message = new MailMessage();
        //            using (SmtpClient smtp = new SmtpClient(ec.ServerAddress))
        //            {
        //                message.From = new MailAddress(ec.MailAddress);
        //                message.To.Add(new MailAddress(toEmail));
        //                message.Subject = ebody.MailSubject;
        //                message.IsBodyHtml = false; //to make message body as html
        //                message.Body = ebody.MailBody;
        //                message.Body = message.Body.Replace("@DearUser@", FirstName + " " + LastName);
        //                message.Body = message.Body.Replace("@CreatedUserName@", CreatedUser);
        //                message.Body = message.Body.Replace("@LoginLink@", CreatedUser);
        //                smtp.Port = int.Parse(ec.OutgoingPort);
        //                smtp.EnableSsl = true;
        //                smtp.Timeout = 60000;
        //                smtp.UseDefaultCredentials = false;
        //                smtp.Credentials = new NetworkCredential(ec.UserName, details.Password);
        //                smtp.DeliveryMethod = SmtpDeliveryMethod.Network;
        //                message.BodyEncoding = UTF8Encoding.UTF8;
        //                message.DeliveryNotificationOptions = DeliveryNotificationOptions.OnFailure;
        //                message.IsBodyHtml = true;
        //                ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;
        //                await smtp.SendMailAsync(message);
        //            }
        //        }
        //        else
        //        {
        //            throw new Exception("Email configuration or Invoice details not found");
        //        }
        //        //WriteLog.WriteToFile($"Registration link has been sent successfully to {toEmail}");
        //        return true;
        //    }
        //    catch (SmtpFailedRecipientsException ex)
        //    {
        //        for (int i = 0; i < ex.InnerExceptions.Length; i++)
        //        {
        //            SmtpStatusCode status = ex.InnerExceptions[i].StatusCode;
        //            if (status == SmtpStatusCode.MailboxBusy || status == SmtpStatusCode.MailboxUnavailable)
        //            {
        //                //WriteLog.WriteToFile($"UserRequestMailFromAdmin/SendMail/MailboxBusy/MailboxUnavailable/SmtpFailedRecipientsException:Inner- {ex.InnerExceptions[i].Message}");
        //            }
        //            else
        //            {
        //                //WriteLog.WriteToFile($"UserRequestMailFromAdmin/SendMail/SmtpFailedRecipientsException:Inner- {ex.InnerExceptions[i].Message}");
        //            }
        //        }
        //        //WriteLog.WriteToFile($"UserRequestMailFromAdmin/SendMail/SmtpFailedRecipientsException:- {ex.Message}", ex);
        //        return false;
        //    }
        //    catch (SmtpException ex)
        //    {
        //       // WriteLog.WriteToFile($"UserRequestMailFromAdmin/SendMail/SmtpException:- {ex.Message}", ex);
        //        return false;
        //    }
        //    catch (Exception ex)
        //    {
        //        //WriteLog.WriteToFile($"UserRequestMailFromAdmin/SendMail/Exception:- {ex.Message}", ex);
        //        return false;
        //    }
        //}


        //        public async Task<bool> SendMailForDocAccessMail(string token, int docID, string toEmail, string fromEmail, string docName, string docType, string comments, string siteURL)
        //        {
        //            try
        //            {
        //                var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);

        //                if (ec != null)
        //                {
        //                    string subject = "File Access Invitation";

        //                    // Construct the HTML body using the provided template
        //                    string htmlBody = $@"
        //<html>
        //<head>
        //    <meta charset=""UTF-8"">
        //    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
        //    <title>File Access Invitation</title>
        //    <link href='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css' rel='stylesheet'/>
        //    <style>
        //        /* CSS styles for responsive email */
        //        @media only screen and (max-width: 600px) {{
        //            .container {{
        //                width: 100%;
        //                padding: 10px;
        //            }}
        //            .email-content {{
        //                max-width: 90%; /* More responsive on small screens */
        //            }}
        //            .button {{
        //                font-size: 14px; /* Adjust button text size for smaller screens */
        //                padding: 12px; /* Adjust padding for a better touch target */
        //            }}
        //        }}
        //        body {{
        //            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        //            background-color: #f3f2f1; 
        //            margin: 0; 
        //            padding: 0;
        //        }}
        //    </style>
        //</head>
        //<body>
        //    <div style='border: 1px solid #dbdbdb;'>
        //        <div style='padding: 20px 20px; background-color: #fff06769; text-align: center; font-family: Segoe UI;'>
        //            <h2>File Access Invitation</h2>
        //        </div>
        //        <div style='background-color: #f8f7f7; padding: 20px 20px; font-family: Segoe UI;'>
        //            <div style='padding: 20px 20px; border: 1px solid white; background-color: white !important; text-align: center;'>
        //                <h1 style='font-size: 20px; margin: 0; margin-bottom: 20px;'>
        //                    {fromEmail} invited you to access a file
        //                </h1>
        //                <p style='font-size: 14px; margin: 0; margin-bottom: 20px;'>
        //                    File Type: 
        //                    <span style='background-color: yellow; padding: 2px 4px; border-radius: 4px;'>{docType}</span>.
        //                </p>
        //                <div style='border: 1px solid #e1e1e1; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;'>
        //                    <i class='fas fa-folder icon' style='font-size: 40px; color: #2b579a; margin-right: 10px;'></i>
        //                    <span style='font-size: 16px;'>{docName} - Copy</span>
        //                </div>
        //                <p style='font-size: 14px; color: #107c10; margin-bottom: 20px;'>
        //                    This <span style='color: #107c10; font-weight: bold;'>link</span> will work for anyone.
        //                </p>
        //                <div style='text-align: center; margin-bottom: 20px;'>
        //                    <a href='{siteURL}externalAccess?token={token}&EmailId={HttpUtility.UrlEncode(toEmail)}&ESAID={docID}'>
        //                        <button style='width: 120px; height: 36px; background-color: #0078d4; color: #ffffff; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;'>Open</button>
        //                    </a>
        //                </div>
        //                <div class='footer' style='font-size: 12px; color: #767676; margin-top: 20px; text-align: center;'>
        //                    <i class='fab fa-microsoft' style='font-size: 20px; vertical-align: middle;'></i>
        //                    <a href='#' style='color: #767676; text-decoration: none;'>Privacy Statement</a>
        //                </div>
        //            </div>
        //        </div>
        //    </div>
        //</body>
        //</html>";

        //                    // Create a MailMessage object
        //                    MailMessage message = new MailMessage(ec.MailAddress, toEmail, subject, htmlBody)
        //                    {
        //                        IsBodyHtml = true
        //                    };

        //                    // Configure SMTP client
        //                    SmtpClient client = new SmtpClient(ec.ServerAddress)
        //                    {
        //                        Port = int.Parse(ec.OutgoingPort),
        //                        EnableSsl = true,
        //                        Timeout = 60000,
        //                        UseDefaultCredentials = false,
        //                        Credentials = new System.Net.NetworkCredential(ec.MailAddress, ec.Password)
        //                    };

        //                    // Send email asynchronously
        //                    await client.SendMailAsync(message);

        //                    // Log success
        //                    WriteLog.AddMailWriteLog($" For internal User Mail. Email sent successfully to: {toEmail}", toEmail);

        //                    return true;
        //                }
        //                else
        //                {
        //                    throw new Exception("Email configuration not found");
        //                }
        //            }
        //            catch (Exception ex)
        //            {
        //                // Log error
        //                ErrorLog.AddMailErrorLog($"Error sending email to {toEmail}: ", ex.Message);
        //                return false;
        //            }
        //        }

        public async Task<bool> SendMailForDocAccessMail(string token, int docID, string toEmail, string fromEmail, string docName, string docType, string comments, string siteURL)
        {
            try
            {
                var ec = _dbContext.EmailConfiguration.FirstOrDefault(k => k.IsActive && !k.IsSSL && k.ID == 1);

                var ebody = _dbContext.MailBodyConfigurations.FirstOrDefault(k => k.ID == 5);
                var STMPDetailsConfig = _configuration.GetSection("STMPDetails");
                string tableName = STMPDetailsConfig["TableName"];
                string connectionString = STMPDetailsConfig["EmailContext"];
                EMailDetails details = GetEMailDetails(ec.UserName, connectionString, tableName);
                if (ec != null && ebody != null)
                {
                    MailMessage message = new MailMessage();
                    using (SmtpClient smtp = new SmtpClient(ec.ServerAddress))
                    {
                        message.From = new MailAddress(ec.MailAddress);
                        message.To.Add(new MailAddress(toEmail));
                        message.Subject = ebody.MailSubject;
                        message.IsBodyHtml = false; //to make message body as html
                        message.Body = ebody.MailBody;
                        message.Body = message.Body.Replace("@siteURL@", siteURL + "/externalAccess?token=" + token + "&EmailId=" + HttpUtility.UrlEncode(toEmail) + "&ESAID=" + docID);
                        message.Body = message.Body.Replace("@toEmail@", toEmail);
                        message.Body = message.Body.Replace("@fromEmail@", fromEmail);
                        message.Body = message.Body.Replace("@docType@", docType);
                        message.Body = message.Body.Replace("@docName@", docName);
                        smtp.Port = int.Parse(ec.OutgoingPort);
                        smtp.EnableSsl = true;
                        smtp.Timeout = 60000;
                        smtp.UseDefaultCredentials = false;
                        smtp.Credentials = new NetworkCredential(ec.UserName, details.Password);
                        smtp.DeliveryMethod = SmtpDeliveryMethod.Network;
                        message.BodyEncoding = UTF8Encoding.UTF8;
                        message.DeliveryNotificationOptions = DeliveryNotificationOptions.OnFailure;
                        message.IsBodyHtml = true;
                        ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;
                        await smtp.SendMailAsync(message);
                    }
                }
                else
                {
                    throw new Exception("Email configuration or Invoice details not found");
                }
                Log.DataLog(toEmail, $"To access the files or folders for internal user mail {toEmail} has beensent successfully ", "Share Access maillog");
                return true;
            }
            catch (Exception ex)
            {
                // Log error
                Log.Error(toEmail, $"To access the files or folders for  user mail {toEmail} following error occured {ex.Message} ", "Share Access maillog");
                return false;
            }
        }


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
                    //WriteLog.AddMailWriteLog($"Sent email to user {{0}} successfully\" to {email}", email);
                    return generatedOtp;
                }
                else
                {
                    throw new Exception("Email configuration not found");
                }
            }
            catch (Exception ex)
            {
                // Handle exceptions when sending email
                //ErrorLog.AddMailErrorLog("GenrateOtpSent", ex.Message);
                Log.Error(email, $"While sending or generating otp to send the mail for the user email {email} following error occured", "OTP Log");
                throw new Exception("Failed to send OTP via email", ex);
            }
        }

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
                //WriteLog.AddMailWriteLog($"Result Get Sucess For {username}", query);
            }
            catch (Exception ex)
            {
                //Erro/rLog.AddMailErrorLog("VendorOnBoardingRepository/GetEMailDetails/Exception:- ", ex.Message);
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
                //ErrorLog.AddMailErrorLog("GetEmailCredientalFromTableData:", ex.Message);
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

