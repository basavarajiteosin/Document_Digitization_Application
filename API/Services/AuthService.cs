using DDAAPI.DbContexts;
//using DDAAPI.Helpers;
using DDAAPI.Models;
using DDAAPI.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace DDAAPI.Services
{
    public class AuthService
    {
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _dbContext;
        private readonly EmailService _emailService;
        private readonly IConfigurationManager<OpenIdConnectConfiguration> _oidcConfigManager;
        public AuthService(IConfiguration configuration, AppDbContext dbContext, IConfigurationManager<OpenIdConnectConfiguration> oidcConfigManager, EmailService emailService)
        {
            _configuration = configuration;
            _dbContext = dbContext;
            _oidcConfigManager = oidcConfigManager;
            _emailService = emailService;
        }


        public Client FindClient(string clientId)
        {
            try
            {
                var client = _dbContext.Clients.Find(clientId);
                return client;
            }
            catch (Exception ex)
            {
                return null;
            }
        }


        public async Task<AuthenticationResult> GetToken(LoginModel loginModel)
        {
            try
            {
                string mfaType = _configuration["MFAUse"];

                Client client = FindClient(loginModel.clientId);
                if (client == null)
                {
                    var errorMessage = $"{loginModel.EmployeeId}, Invalid client id.";
                    ErrorLogAdd(errorMessage);
                    throw new Exception("Invalid client id");
                }

                AuthenticationResult authenticationResult = null;

                if (mfaType == "0")
                {
                    authenticationResult = await AuthenticateUser(loginModel.EmployeeId, loginModel.Password);
                }
                else if (mfaType == "1")
                {
                    authenticationResult = await AuthenticateUserForOtp(loginModel.EmployeeId, loginModel.Password);
                }
                else
                {
                    throw new Exception("Invalid MFA type configuration.");
                }

                if (authenticationResult != null)
                {
                    if (mfaType == "0")
                    {
                        // Configure JWT settings
                        IConfiguration JWTSecurityConfig = _configuration.GetSection("Jwt");
                        string securityKey = JWTSecurityConfig.GetValue<string>("Key");
                        string issuer = JWTSecurityConfig.GetValue<string>("Issuer");
                        string audience = JWTSecurityConfig.GetValue<string>("Audience");

                        // Create claims for JWT
                        var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, authenticationResult.EmployeeId),
                    new Claim(ClaimTypes.Role, authenticationResult.UserRole)
                    // Add more claims as needed
                };

                        // Create JWT token
                        var symmetricSecurityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(securityKey));
                        var signingCredentials = new SigningCredentials(symmetricSecurityKey, SecurityAlgorithms.HmacSha256Signature);
                        var token = new JwtSecurityToken(
                            issuer: issuer,
                            audience: audience,
                            expires: DateTime.Now.AddMinutes(24),
                            signingCredentials: signingCredentials,
                            claims: claims
                        );

                        // Write token to AuthenticationResult
                        authenticationResult.Token = new JwtSecurityTokenHandler().WriteToken(token);
                    }

                    return authenticationResult;
                }
                else
                {
                    var errorMessage = "The user name or password is incorrect.";
                    LogLoginAttempt(loginModel.EmployeeId, errorMessage);
                    throw new Exception(errorMessage);
                }
            }
            catch (Exception ex)
            {
                ErrorLogAdd($"Exception occurred in LoginUser method for username '{loginModel.EmployeeId}': {ex.Message}");
                string error = ex.Message;
                throw new Exception(error);
            }
        }



        public async Task<Models.SignOutResult> SignOutAsync(
    SignOutRequest request,
    CancellationToken ct = default)
        {
            try
            {
                // ── 1. Update UserLoginHistory — set LogoutTime ───────────────────
                //
                //  Find the most recent login record for this user that has no
                //  LogoutTime yet (the active session). If the user has multiple
                //  open sessions (different devices), only the latest is closed here.
                //  Extend to session-token tracking if per-device logout is needed.
                //
                var activeSession = await _dbContext.UserLoginHistory
                    .Where(h => h.UserID == request.UserId
                             && h.LogoutTime == null)
                    .OrderByDescending(h => h.LoginTime)
                    .FirstOrDefaultAsync(ct);

                if (activeSession is not null)
                {
                    activeSession.LogoutTime = DateTime.Now;
                    await _dbContext.SaveChangesAsync(ct);

                }
                else
                {

                }


                return new Models.SignOutResult
                {
                    Success = true,
                    Message = "Signed out successfully."
                };
            }
            catch (Exception ex)
            {

                throw;
            }
        }

        public async Task<AuthenticationResult> LoginWithMicrosoftAsync(string idToken)
        {
            try
            {
                // 1. Token Validation Setup
                var validationParams = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    IssuerValidator = (issuer, token, parameters) =>
                    {
                        if (!issuer.StartsWith(_configuration["AzureAd:Authority"]))
                            throw new SecurityTokenInvalidIssuerException();
                        return issuer;
                    },
                    ValidateAudience = true,
                    ValidAudience = _configuration["AzureAd:ClientId"],
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(2),
                    IssuerSigningKeyResolver = (token, securityToken, kid, parameters) =>
                    {
                        var openIdConfig = _oidcConfigManager
                            .GetConfigurationAsync(CancellationToken.None)
                            .GetAwaiter()
                            .GetResult();
                        return openIdConfig.SigningKeys;
                    }
                };

                var handler = new JwtSecurityTokenHandler();
                var principal = handler.ValidateToken(idToken, validationParams, out var validatedToken);

                // 2. Extract Identifier (Email)
                var email = principal.FindFirst("preferred_username")?.Value
                            ?? principal.FindFirst(ClaimTypes.Email)?.Value;

                if (string.IsNullOrEmpty(email))
                    throw new Exception("Email not found in Microsoft token.");

                // 3. Find User & Validate Status (Matches AuthenticateUser logic)
                var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());

                if (user == null)
                {
                    LogLoginAttempt(email, "The user does not exist in the system.");
                    throw new Exception("User does not exist. Contact administrator.");
                }

                if (!user.IsActive)
                {
                    throw new Exception("Account is Disabled please contact the admin");
                }

                // 4. Lock Check
                if (user.IsLocked && DateTime.Now < user.IsLockDuration)
                {
                    var reason = "Your Account Has Been Locked Due To Incorrect Password. Please Login After 15 minutes";
                    ErrorLogAdd($"{email}, {reason}");
                    throw new Exception(reason);
                }

                // 5. Reset Login Attempts on Successful SSO
                user.Attempts = 0;
                user.IsLocked = false;
                // Optimization from original: GC.Collect() is generally not recommended in web apps 
                // but included if you want to strictly match the provided AuthenticateUser pattern.

                // 6. Fetch Role Information
                Role userRole = await (from tb1 in _dbContext.Roles
                                       join tb2 in _dbContext.UserRoleMaps on tb1.RoleID equals tb2.RoleID
                                       join tb3 in _dbContext.Users on tb2.UserID equals tb3.UserID
                                       where tb3.UserID == user.UserID && tb1.IsActive && tb2.IsActive && tb3.IsActive
                                       select tb1).FirstOrDefaultAsync();

                // 7. Fetch Employee Info
                EmpInfo userinfo = await (from tb1 in _dbContext.EmpInfos
                                          join tb4 in _dbContext.Users on tb1.EmpId equals tb4.UserID
                                          where tb4.UserID == user.UserID
                                          select tb1).FirstOrDefaultAsync();

                // 8. Fetch App/Menu Permissions
                List<App> MenuItemList = new List<App>();
                if (userRole != null)
                {
                    MenuItemList = await (from tb1 in _dbContext.Apps
                                          join tb2 in _dbContext.RoleAppMaps on tb1.AppID equals tb2.AppID
                                          where tb2.RoleID == userRole.RoleID && tb1.IsActive && tb2.IsActive
                                          && tb1.ClientId.Contains(user.ClientId)
                                          select tb1).ToListAsync();
                }

                // 9. Map to AuthenticationResult
                var authenticationResult = new AuthenticationResult
                {
                    UserID = user.UserID,
                    EmployeeId = user.EmployeeId,
                    DisplayName = user.EmployeeId,
                    EmailAddress = user.Email,
                    FirstName = userinfo?.FirstName ?? "",
                    LastName = userinfo?.LastName ?? "",
                    ProfilePic = user.PicDbPath,
                    MenuItemNames = MenuItemList,
                    IsSuccess = true,
                    Message = "Login Success",
                    Designation = user.Designation ?? "",
                    Division = user.Division,
                    UserRole = userRole != null ? userRole.RoleName : "",
                    RoleID = userRole.RoleID,
                    IsChangePasswordRequired = "No" // Usually No for Microsoft SSO
                };

                await _dbContext.SaveChangesAsync();
                LogLoginAttempt(email, "Logged in successfully via Microsoft.");

                return authenticationResult;
            }
            catch (SecurityTokenException ex)
            {
                ErrorLogAdd($"Exception occurred in LoginWithMicrosoftAsync for token validation: {ex.Message}");
                throw new Exception("Invalid Microsoft token.");
            }
            catch (Exception ex)
            {
                ErrorLogAdd($"Exception occurred in LoginWithMicrosoftAsync: {ex.Message}");
                throw;
            }
        }

        public async Task<AuthenticationResult> AuthenticateUser(string UserName, string Password)
        {
            try
            {

                string userId = string.Empty, role = string.Empty;
                List<App> MenuItemList = new List<App>();
                string MenuItemNames = "";
                User user = null;
                var active = false;
                var Success = true;
                string isChangePasswordRequired = "No";
                string DefaultPassword = _configuration.GetValue<string>("DefaultPassword");
                if (UserName.Contains('@') && UserName.Contains('.'))
                {
                    user = _dbContext.Users.FirstOrDefault(tb => tb.Email.ToLower() == UserName.ToLower());
                }
                else
                {
                    user = _dbContext.Users.FirstOrDefault(tb => tb.EmployeeId == UserName);
                }

                if (user != null)
                {
                    if (!user.IsActive)
                    {
                        ErrorLogAdd($"{UserName}, Account is Disabled.");
                        throw new Exception("Account is Disabled");
                    }
                    bool isValidUser = false;
                    var authenticationResult = new AuthenticationResult();
                    string DecryptedPassword = Decrypt(user.Password, true);
                    isValidUser = DecryptedPassword == Password;

                    if (isValidUser)
                    {
                        if (!user.IsLocked || user.IsLocked && DateTime.Now >= user.IsLockDuration)
                        {
                            user.IsLocked = false;
                            user.Attempts = 0;
                            GC.Collect();
                            GC.WaitForPendingFinalizers();

                            if (user.Pass1 == null)
                            {
                                isChangePasswordRequired = "Yes";
                                authenticationResult.ReasonForReset = "Please Enter new Password to login";
                            }
                            if (user.ExpiryDate != null && DateTime.Now > user.ExpiryDate)
                            {
                                isChangePasswordRequired = "Yes";
                                authenticationResult.ReasonForReset = "Your Password has been expired. Please Enter a new Password to login";
                            }

                            Role userRole = (from tb1 in _dbContext.Roles
                                             join tb2 in _dbContext.UserRoleMaps on tb1.RoleID equals tb2.RoleID
                                             join tb3 in _dbContext.Users on tb2.UserID equals tb3.UserID
                                             where tb3.UserID == user.UserID && tb1.IsActive && tb2.IsActive && tb3.IsActive
                                             select tb1).FirstOrDefault();

                            EmpInfo userinfo = await (from tb1 in _dbContext.EmpInfos
                                                      join tb4 in _dbContext.Users on tb1.EmpId equals tb4.UserID
                                                      where tb4.UserID == user.UserID
                                                      select tb1).FirstOrDefaultAsync();


                            if (userRole != null)
                            {
                                MenuItemList = (from tb1 in _dbContext.Apps
                                                join tb2 in _dbContext.RoleAppMaps on tb1.AppID equals tb2.AppID
                                                where tb2.RoleID == userRole.RoleID && tb1.IsActive && tb2.IsActive
                                                where tb1.ClientId.Contains(user.ClientId)
                                                select tb1).ToList();
                            }


                            authenticationResult.UserID = user.UserID;
                            authenticationResult.EmployeeId = user.EmployeeId;
                            authenticationResult.DisplayName = user.EmployeeId;
                            authenticationResult.EmailAddress = user.Email;
                            authenticationResult.FirstName = userinfo.FirstName;
                            authenticationResult.LastName = userinfo.LastName;
                            authenticationResult.ProfilePic = user.PicDbPath;
                            authenticationResult.MenuItemNames = MenuItemList;
                            authenticationResult.IsSuccess = Success;
                            authenticationResult.Message = "Login Success";
                            authenticationResult.Designation = user.Designation == null ? "" : user.Designation;
                            authenticationResult.Division = user.Division;
                            authenticationResult.UserRole = userRole != null ? userRole.RoleName : "";
                            authenticationResult.IsChangePasswordRequired = isChangePasswordRequired;
                            await _dbContext.SaveChangesAsync();
                            LogLoginAttempt(UserName, "Logged in successfully.");
                            return authenticationResult;
                        }
                        else
                        {
                            ErrorLogAdd($"{UserName}, Your Account has been locked due to multiple incorrect password login attempts. Please try again after 15 minutes.");
                            var reason = "Your Account Has Been Locked Due To Incorrect Password. Please Login After 15 minutes";
                            throw new Exception(reason);
                        }
                    }
                    else
                    {
                        user.Attempts++;
                        var reason = "The user name or password is incorrect.";
                        if (user.Attempts == 5)
                        {
                            user.IsLocked = true;
                            user.IsActive = false;  //ChandSir Told to today 10/22/2024
                            reason = "Your Account is Locked Due To Multiple Incorrect Password. Please Contact Admin";
                            user.IsLockDuration = DateTime.Now.AddMinutes(15);
                        }
                        await _dbContext.SaveChangesAsync();

                        ErrorLogAdd($"{UserName} is Failed to login : {reason}");
                        throw new Exception(reason);
                    }
                }
                else
                {
                    var errorMessage = "The user name or password is incorrect.";
                    LogLoginAttempt(UserName, "The user name or password is incorrect.");
                    throw new Exception(errorMessage);
                }
            }
            catch (Exception ex)
            {
                ErrorLogAdd($"Exception occurred in LoginUser method for username '{UserName}': {ex.Message}");
                throw ex;
            }
        }

        public async Task<AuthenticationResult> AuthenticateUserForOtp(string UserName, string Password)
        {
            try
            {

                string userId = string.Empty, role = string.Empty;
                string MenuItemNames = "";
                User user = null;
                var active = false;
                var Success = true;
                string isChangePasswordRequired = "No";
                string DefaultPassword = _configuration.GetValue<string>("DefaultPassword");
                if (UserName.Contains('@') && UserName.Contains('.'))
                {
                    user = _dbContext.Users.FirstOrDefault(tb => tb.Email.ToLower() == UserName.ToLower());
                }
                else
                {
                    user = _dbContext.Users.FirstOrDefault(tb => tb.EmployeeId == UserName);
                }

                if (user != null)
                {
                    if (!user.IsActive)
                    {
                        ErrorLogAdd($"{UserName}, Account is Disabled.");
                        throw new Exception("Account is Disabled");
                    }
                    bool isValidUser = false;
                    var authenticationResult = new AuthenticationResult();
                    string DecryptedPassword = Decrypt(user.Password, true);
                    isValidUser = DecryptedPassword == Password;

                    if (isValidUser)
                    {
                        if (!user.IsLocked || user.IsLocked && DateTime.Now >= user.IsLockDuration)
                        {
                            user.IsLocked = false;
                            user.Attempts = 0;
                            GC.Collect();
                            GC.WaitForPendingFinalizers();

                            if (user.Pass1 == null)
                            {
                                isChangePasswordRequired = "Yes";
                                authenticationResult.ReasonForReset = "Please Enter new Password to login";
                            }
                            if (user.ExpiryDate != null && DateTime.Now > user.ExpiryDate)
                            {
                                isChangePasswordRequired = "Yes";
                                authenticationResult.ReasonForReset = "Your Password has been expired. Please Enter a new Password to login";
                            }

                            EmpInfo userinfo = await (from tb1 in _dbContext.EmpInfos
                                                      join tb4 in _dbContext.Users on tb1.EmpId equals tb4.UserID
                                                      where tb4.UserID == user.UserID
                                                      select tb1).FirstOrDefaultAsync();

                            Random random = new Random();
                            string generatedOtp = random.Next(100000, 999999).ToString();

                            if (!string.IsNullOrEmpty(generatedOtp))
                            {
                                var emailResult = await _emailService.SendMFAOtpForAuthentivcationMail(
                                    generatedOtp,
                                    userinfo.FirstName + " " + userinfo.LastName,
                                    user.Email
                                );

                                if (!emailResult)
                                {
                                    throw new Exception("Failed to send OTP");
                                }
                                else
                                {
                                    if (user != null)
                                    {
                                        DateTime expiryTime = DateTime.Now.AddMinutes(5);

                                        // 1. Check if an existing record exists for this UserID / Email
                                        var existingOtpRecord = await _dbContext.MFAUserOtpHistory
                                            .FirstOrDefaultAsync(x => x.UserID == user.UserID || x.Email.ToLower() == user.Email.ToLower());

                                        if (existingOtpRecord != null)
                                        {
                                            // 2. Update existing record
                                            existingOtpRecord.OTP = generatedOtp;
                                            existingOtpRecord.OTPIsActive = true;
                                            existingOtpRecord.CreatedOn = DateTime.Now;
                                            existingOtpRecord.ExpiryOn = expiryTime;
                                            existingOtpRecord.CreatedBy = user.Email;

                                            _dbContext.MFAUserOtpHistory.Update(existingOtpRecord);
                                        }
                                        else
                                        {
                                            // 3. Insert new record if first time
                                            var mfaAuthOtp = new MFAUserOtpHistory
                                            {
                                                Email = user.Email,
                                                UserID = user.UserID,
                                                OTP = generatedOtp,
                                                OTPIsActive = true,
                                                CreatedOn = DateTime.Now,
                                                ExpiryOn = expiryTime,
                                                CreatedBy = user.Email
                                            };
                                            _dbContext.MFAUserOtpHistory.Add(mfaAuthOtp);
                                        }

                                        await _dbContext.SaveChangesAsync();
                                    }
                                }
                            }

                            authenticationResult.UserID = user.UserID;
                            authenticationResult.EmployeeId = user.EmployeeId;
                            authenticationResult.DisplayName = user.EmployeeId;
                            authenticationResult.EmailAddress = user.Email;
                            authenticationResult.IsSuccess = false;
                            authenticationResult.Message = "OTP Sent";
                            await _dbContext.SaveChangesAsync();
                            return authenticationResult;
                        }
                        else
                        {
                            ErrorLogAdd($"{UserName}, Your Account has been locked due to multiple incorrect password login attempts. Please try again after 15 minutes.");
                            var reason = "Your Account Has Been Locked Due To Incorrect Password. Please Login After 15 minutes";
                            throw new Exception(reason);
                        }
                    }
                    else
                    {
                        user.Attempts++;
                        var reason = "The user name or password is incorrect.";
                        if (user.Attempts == 5)
                        {
                            user.IsLocked = true;
                            user.IsActive = false;
                            reason = "Your Account is Locked Due To Multiple Incorrect Password. Please Contact Admin";
                            user.IsLockDuration = DateTime.Now.AddMinutes(15);
                        }
                        await _dbContext.SaveChangesAsync();

                        ErrorLogAdd($"{UserName} is Failed to login : {reason}");
                        throw new Exception(reason);
                    }
                }
                else
                {
                    var errorMessage = "The user name or password is incorrect.";
                    LogLoginAttempt(UserName, "The user name or password is incorrect.");
                    throw new Exception(errorMessage);
                }
            }
            catch (Exception ex)
            {
                ErrorLogAdd($"Exception occurred in LoginUser method for username '{UserName}': {ex.Message}");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<AuthenticationResult> VerifytheMfaOtp(MfaOtpVerifyRequest request)
        {
            try
            {
                string userId = string.Empty, role = string.Empty;
                List<App> MenuItemList = new List<App>();
                string MenuItemNames = "";
                User user = null;
                var active = false;
                var Success = true;
                string isChangePasswordRequired = "No";
                var authenticationResult = new AuthenticationResult();
                if (request.Email.Contains('@') && request.Email.Contains('.'))
                {
                    user = await _dbContext.Users.FirstOrDefaultAsync(tb => tb.Email.ToLower() == request.Email.ToLower());
                    if (user == null)
                    {
                        throw new Exception("Email ID not found");
                    }
                }

                // Find the user based on the provided username or email
                user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());
                if (user == null)
                {
                    throw new Exception("User not found");
                }

                if (!user.IsActive)
                {
                    throw new Exception("User is not active");
                }

                // Find the latest active OTP for the user
                var latestOtp = await _dbContext.MFAUserOtpHistory
                    .Where(pr => (pr.Email.ToLower() == request.Email.ToLower() && pr.UserID == request.UserId) && pr.OTPIsActive)
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

                // Deactivate the OTP
                latestOtp.OTPIsActive = false;
                await _dbContext.SaveChangesAsync();

                if (user.Pass1 == null)
                {
                    isChangePasswordRequired = "Yes";
                    authenticationResult.ReasonForReset = "Please Enter new Password to login";
                }
                if (user.ExpiryDate != null && DateTime.Now > user.ExpiryDate)
                {
                    isChangePasswordRequired = "Yes";
                    authenticationResult.ReasonForReset = "Your Password has been expired. Please Enter a new Password to login";
                }

                Role userRole = (from tb1 in _dbContext.Roles
                                 join tb2 in _dbContext.UserRoleMaps on tb1.RoleID equals tb2.RoleID
                                 join tb3 in _dbContext.Users on tb2.UserID equals tb3.UserID
                                 where tb3.UserID == user.UserID && tb1.IsActive && tb2.IsActive && tb3.IsActive
                                 select tb1).FirstOrDefault();

                EmpInfo userinfo = await (from tb1 in _dbContext.EmpInfos
                                          join tb4 in _dbContext.Users on tb1.EmpId equals tb4.UserID
                                          where tb4.UserID == user.UserID
                                          select tb1).FirstOrDefaultAsync();


                if (userRole != null)
                {
                    MenuItemList = (from tb1 in _dbContext.Apps
                                    join tb2 in _dbContext.RoleAppMaps on tb1.AppID equals tb2.AppID
                                    where tb2.RoleID == userRole.RoleID && tb1.IsActive && tb2.IsActive
                                    where tb1.ClientId.Contains(user.ClientId)
                                    select tb1).ToList();
                }




                authenticationResult.UserID = user.UserID;
                authenticationResult.EmployeeId = user.EmployeeId;
                authenticationResult.DisplayName = user.EmployeeId;
                authenticationResult.EmailAddress = user.Email;
                authenticationResult.FirstName = userinfo.FirstName;
                authenticationResult.LastName = userinfo.LastName;
                authenticationResult.ProfilePic = user.PicDbPath;
                authenticationResult.MenuItemNames = MenuItemList;
                authenticationResult.IsSuccess = Success;
                authenticationResult.Message = "Login Success";
                authenticationResult.Designation = user.Designation == null ? "" : user.Designation;
                authenticationResult.Division = user.Division;
                authenticationResult.UserRole = userRole != null ? userRole.RoleName : "";
                authenticationResult.IsChangePasswordRequired = isChangePasswordRequired;
                if (userinfo != null)
                {
                    // Configure JWT settings
                    IConfiguration JWTSecurityConfig = _configuration.GetSection("Jwt");
                    string securityKey = JWTSecurityConfig.GetValue<string>("Key");
                    string issuer = JWTSecurityConfig.GetValue<string>("Issuer");
                    string audience = JWTSecurityConfig.GetValue<string>("Audience");

                    // Create claims for JWT
                    var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, authenticationResult.EmployeeId),
                    new Claim(ClaimTypes.Role, authenticationResult.UserRole)
                    // Add more claims as needed
                };

                    // Create JWT token
                    var symmetricSecurityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(securityKey));
                    var signingCredentials = new SigningCredentials(symmetricSecurityKey, SecurityAlgorithms.HmacSha256Signature);
                    var token = new JwtSecurityToken(
                        issuer: issuer,
                        audience: audience,
                        expires: DateTime.Now.AddMinutes(24),
                        signingCredentials: signingCredentials,
                        claims: claims
                    );

                    // Write token to AuthenticationResult
                    authenticationResult.Token = new JwtSecurityTokenHandler().WriteToken(token);
                }

                await _dbContext.SaveChangesAsync();
                return authenticationResult;
            }
            catch (Exception ex)
            {
                ErrorLogAdd($"Exception occurred in LoginUser method for username '{request.Email}': {ex.Message}");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }


        private string Decrypt(string Password, bool UseHashing)
        {
            try
            {
                string EncryptionKey = "Iteos";
                byte[] KeyArray;
                byte[] ToEncryptArray = Convert.FromBase64String(Password);
                if (UseHashing)
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
                    ICryptoTransform cTransform = tdes.CreateDecryptor();
                    byte[] resultArray = cTransform.TransformFinalBlock(ToEncryptArray, 0, ToEncryptArray.Length);
                    return Encoding.UTF8.GetString(resultArray);
                }
            }
            catch (Exception ex)
            {
                return null;
            }
        }

        public List<LoginLogEntry> GetLoginLogs()
        {
            List<LoginLogEntry> loginLogs = new List<LoginLogEntry>();
            try
            {
                using (StreamReader reader = System.IO.File.OpenText("Logs/Auth.log.txt"))
                {
                    string line;
                    while ((line = reader.ReadLine()) != null)
                    {
                        var logEntry = ParseLogEntry(line);
                        if (logEntry != null)
                        {
                            loginLogs.Add(logEntry);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error reading login log: {ex.Message}");
            }
            return loginLogs;
        }
        private LoginLogEntry ParseLogEntry(string logLine)
        {
            // Assuming the format is YYYY-MM-DD HH:MM:SS - Username - Status
            string[] parts = logLine.Split('-');
            if (parts.Length != 5)
            {
                return null; // Handle invalid log entry format
            }

            int year = int.Parse(parts[0].Trim());
            int month = int.Parse(parts[1].Trim());
            int day = int.Parse(parts[2].Trim().Split(' ')[0]); // Extract day before space
            string time = parts[2].Trim().Split(' ')[1]; // Extract time after space
            string username = parts[3].Trim();
            string status = parts[4].Trim();
            DateTime timestamp = DateTime.Parse($"{year}-{month}-{day} {time}");

            return new LoginLogEntry(timestamp, username, status);
        }

        public class LoginLogEntry
        {
            public DateTime Timestamp { get; set; }
            public string Username { get; set; }
            public string Status { get; set; }

            public LoginLogEntry(DateTime timestamp, string username, string status)
            {
                Timestamp = timestamp;
                Username = username;
                Status = status;
            }
        }


        private void LogLoginAttempt(string username, string status)
        {
            string maskedMessage = MaskEmails(username);
            string maskedStatus = MaskEmails(status);


            string logEntry = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} - {maskedMessage} - {maskedStatus}";
            string logFilePath = Path.Combine("Logs", "Auth.log.txt");
            if (!Directory.Exists(Path.GetDirectoryName(logFilePath)))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(logFilePath));
            }
            try
            {
                using (StreamWriter writer = System.IO.File.AppendText("Logs/Auth.log.txt"))
                {
                    writer.WriteLine(logEntry);
                }
            }
            catch (Exception ex)
            {

            }
        }

        private void ErrorLogAdd(string status)
        {
            string logEntry = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} -  {status}";
            try
            {
                string logFilePath = Path.Combine("Logs", "Error.log.txt");
                if (!Directory.Exists(Path.GetDirectoryName(logFilePath)))
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(logFilePath));
                }
                using (StreamWriter writer = System.IO.File.AppendText("Logs/Error.log.txt"))
                {
                    writer.WriteLine(logEntry);
                }
            }
            catch (Exception ex)
            {

            }
        }

        public List<ErrorLogEntry> GetErrorLog()
        {
            List<ErrorLogEntry> loginLogs = new List<ErrorLogEntry>();
            try
            {
                string logFilePath = Path.Combine("Logs", "Error.log.txt");
                if (!Directory.Exists(Path.GetDirectoryName(logFilePath)))
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(logFilePath));
                }
                using (StreamReader reader = System.IO.File.OpenText("Logs/Error.log.txt"))
                {
                    string line;
                    while ((line = reader.ReadLine()) != null)
                    {
                        var logEntry = ParseErrorEntry(line);
                        if (logEntry != null)
                        {
                            loginLogs.Add(logEntry);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error reading login log: {ex.Message}");
            }
            return loginLogs;
        }

        private static string MaskEmails(string input)
        {
            // Regular expression to match email addresses
            string pattern = @"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b";

            // Check if the input matches the email pattern
            if (Regex.IsMatch(input, pattern))
            {
                // Replace each matched email with masked version
                return Regex.Replace(input, pattern, delegate (Match match)
                {
                    string email = match.ToString();
                    string[] parts = email.Split('@');
                    if (parts.Length == 2)
                    {
                        string name = parts[0];
                        string domain = parts[1];

                        // Masking logic for the name part
                        StringBuilder maskedName = new StringBuilder();
                        for (int i = 0; i < name.Length; i++)
                        {
                            if (i == 0 || i == name.Length - 1 || i % 2 == 0)
                            {
                                maskedName.Append(name[i]); // Keep first, last, and every 2nd character visible
                            }
                            else
                            {
                                maskedName.Append("*"); // Mask other characters
                            }
                        }

                        // Masking logic for the domain part
                        StringBuilder maskedDomain = new StringBuilder();
                        for (int j = 0; j < domain.Length; j++)
                        {
                            if (j < 2 || j >= domain.Length - 2 || j % 2 == 0)
                            {
                                maskedDomain.Append(domain[j]); // Keep first 2, last 2, and every 2nd character visible
                            }
                            else
                            {
                                maskedDomain.Append("*"); // Mask other characters
                            }
                        }

                        return $"{maskedName.ToString()}@{maskedDomain.ToString()}";
                    }
                    return email; // In case of unexpected format, return original email
                });
            }
            else
            {
                return input; // Return original input if it's not an email
            }
        }

        private ErrorLogEntry ParseErrorEntry(string logLine)
        {
            string[] parts = logLine.Split('-');
            if (parts.Length != 4)
            {
                return null;
            }
            int year = int.Parse(parts[0].Trim());
            int month = int.Parse(parts[1].Trim());
            int day = int.Parse(parts[2].Trim().Split(' ')[0]); // Extract day before space
            string time = parts[2].Trim().Split(' ')[1]; // Extract time after space
            string error = parts[3].Trim();
            //string status = parts[4].Trim();
            DateTime timestamp = DateTime.Parse($"{year}-{month}-{day} {time}");


            return new ErrorLogEntry(timestamp, error);
        }

        public class ErrorLogEntry
        {
            public DateTime Timestamp { get; set; }
            public string Error { get; set; }


            public ErrorLogEntry(DateTime timestamp, string error)
            {
                Timestamp = timestamp;
                Error = error;

            }
        }


    }
}

