using DDAAPI.DbContexts;

using DDAAPI.Models;
using DDAAPI.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Data;
using System.Net.Mail;
using System.Reflection.Metadata.Ecma335;
using System.Runtime.Intrinsics.X86;
using System.Security.Cryptography;
using System.Text;
using System.Web;
using static DDAAPI.Services.AuthService;

namespace DDAAPI.Services
{
    public class AuthMasterServices
    {
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _dbContext;
        private readonly EmailService _emailService;
        private readonly SMSService _smsService;
        private readonly int _tokenTimespan;

        public AuthMasterServices(IConfiguration configuration, AppDbContext dbContext, EmailService emailService, SMSService smsService)
        {
            _configuration = configuration;
            _dbContext = dbContext;
            _emailService = emailService ?? throw new ArgumentNullException(nameof(emailService));
            _smsService = smsService ?? throw new ArgumentNullException(nameof(smsService));
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

        public Client FindClient(string clientId)
        {
            try
            {
                var client = _dbContext.Clients.Find(clientId);
                return client;
            }
            catch (Exception ex)
            {
                // Handle exceptions here or let them bubble up
                //ErrorLog.AddErrorLog("AuthMaster/FindClient", ex.Message);
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        #endregion

        #region Encrypt&DecryptFuction

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
                //ErrorLog.AddErrorLog("AuthorizationServerProvider/Decrypt :- ", ex.Message);
                return null;
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

        #endregion

        #region UserCreation


        public List<UserWithRole> GetAllUsers(string ClientId)
        {
            try
            {
                var clientcheck = _dbContext.Clients.FirstOrDefault(e => e.Id == ClientId);
                if (clientcheck == null)
                {
                    throw new Exception("ClientId is Not exists");
                }

                var result = (from tb in _dbContext.Users
                              join tb1 in _dbContext.UserRoleMaps on tb.UserID equals tb1.UserID
                              join tb2 in _dbContext.Roles on tb1.RoleID equals tb2.RoleID
                              join tb3 in _dbContext.EmpInfos on tb.UserID equals tb3.EmpId
                              where tb1.IsActive && tb.ClientId == ClientId
                              orderby tb.CreatedOn descending
                              select new
                              {
                                  tb.UserID,
                                  tb.EmployeeId,
                                  tb.Email,
                                  tb.ContactNumber,
                                  tb.Password,
                                  tb.IsActive,
                                  tb.CreatedOn,
                                  tb.ModifiedOn,
                                  tb1.RoleID,
                                  tb2.RoleName,
                                  tb.Designation,
                                  tb.Division,
                                  tb.ClientId,
                                  tb3.FirstName,
                                  tb3.LastName,
                                  tb3.DateOfBirth,
                                  tb3.JoiningDate,
                                  tb3.Address
                              }).ToList();

                List<UserWithRole> userWithRoleList = result.Select(record => new UserWithRole
                {
                    UserID = record.UserID,
                    EmployeeId = record.EmployeeId,
                    Email = record.Email,
                    ContactNumber = record.ContactNumber,
                    Password = Decrypt(record.Password, true),
                    IsActive = record.IsActive,
                    RoleName = record.RoleName,
                    CreatedOn = record.CreatedOn,
                    ModifiedOn = record.ModifiedOn,
                    RoleID = record.RoleID,
                    Designation = record.Designation,
                    Division = record.Division,
                    ClientId = record.ClientId,
                    FirstName = record.FirstName,
                    LastName = record.LastName,
                    Address = record.Address,
                    DateOfBirth = record.DateOfBirth,
                    JoiningDate = record.JoiningDate
                }).ToList();

                return userWithRoleList;
            }
            catch (Exception ex)
            {
                // Handle exceptions here or let them bubble up
                //ErrorLog.AddErrorLog("AuthMster/GetAllUsers", ex.Message);
                throw new Exception(ex.Message ?? "Network Error");
            }
        }


        public List<UserReffdata> GetAdminUsers(string ClientId)
        {
            try
            {
                var clientcheck = _dbContext.Clients.FirstOrDefault(e => e.Id == ClientId);
                if (clientcheck == null)
                {
                    throw new Exception("ClientId is Not exists");
                }

                var result = (from tb in _dbContext.Users
                              join tb1 in _dbContext.UserRoleMaps on tb.UserID equals tb1.UserID
                              join tb2 in _dbContext.Roles on tb1.RoleID equals tb2.RoleID
                              join tb3 in _dbContext.EmpInfos on tb.UserID equals tb3.EmpId
                              where tb.IsActive && tb1.IsActive && tb2.IsActive && tb2.RoleName.ToLower().Contains("admin") && tb.ClientId == ClientId
                              orderby tb.CreatedOn descending
                              select new
                              {
                                  tb.UserID,
                                  tb.EmployeeId,
                                  tb.Email,
                                  tb1.RoleID,
                                  tb2.RoleName,
                                  tb.Designation,
                                  tb.Division,
                                  tb.ClientId,
                                  tb3.FirstName,
                                  tb3.LastName,
                                  tb.IsActive

                              }).ToList();
                List<UserReffdata> userList = result.Select(record => new UserReffdata
                {
                    UserID = record.UserID,
                    EmployeeId = record.EmployeeId,
                    Email = record.Email,
                    RoleName = record.RoleName,
                    RoleID = record.RoleID,
                    Designation = record.Designation,
                    Division = record.Division,
                    ClientId = record.ClientId,
                    FirstName = record.FirstName,
                    LastName = record.LastName,
                    IsActive = record.IsActive,
                }).ToList();
                return userList;
            }
            catch (Exception ex)
            {
                //ErrorLog.AddErrorLog("AuthMaster/GetAdminUsers :- ", ex.Message);
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public List<UserReffdata> GetAllSPOCUsers(string ClientId)
        {
            try
            {
                var clientcheck = _dbContext.Clients.FirstOrDefault(e => e.Id == ClientId);
                if (clientcheck == null)
                {
                    throw new Exception("ClientId is Not exists");
                }

                var result = (from tb in _dbContext.Users
                              join tb1 in _dbContext.UserRoleMaps on tb.UserID equals tb1.UserID
                              join tb2 in _dbContext.Roles on tb1.RoleID equals tb2.RoleID
                              join tb3 in _dbContext.EmpInfos on tb.UserID equals tb3.EmpId
                              where tb.IsActive && tb1.IsActive && tb2.IsActive && tb2.RoleName.ToLower().Contains("spoc") && tb.ClientId == ClientId
                              orderby tb.CreatedOn descending
                              select new
                              {
                                  tb.UserID,
                                  tb.EmployeeId,
                                  tb.Email,
                                  tb1.RoleID,
                                  tb2.RoleName,
                                  tb.Designation,
                                  tb.Division,
                                  tb.ClientId,
                                  tb3.FirstName,
                                  tb3.LastName,
                                  tb.IsActive

                              }).ToList();
                List<UserReffdata> userList = result.Select(record => new UserReffdata
                {
                    UserID = record.UserID,
                    EmployeeId = record.EmployeeId,
                    Email = record.Email,
                    RoleName = record.RoleName,
                    RoleID = record.RoleID,
                    Designation = record.Designation,
                    Division = record.Division,
                    ClientId = record.ClientId,
                    FirstName = record.FirstName,
                    LastName = record.LastName,
                    IsActive = record.IsActive,
                }).ToList();
                return userList;
            }
            catch (Exception ex)
            {
                // Handle exceptions here or let them bubble up
                //ErrorLog.AddErrorLog("AuthMaster/GetAllSPOCUsers", ex.Message);
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public List<UserReffdata> GetAllViewerUsers(string ClientId)
        {
            try
            {
                var clientcheck = _dbContext.Clients.FirstOrDefault(e => e.Id == ClientId);
                if (clientcheck == null)
                {
                    throw new Exception("ClientId is Not exists");
                }

                var result = (from tb in _dbContext.Users
                              join tb1 in _dbContext.UserRoleMaps on tb.UserID equals tb1.UserID
                              join tb2 in _dbContext.Roles on tb1.RoleID equals tb2.RoleID
                              join tb3 in _dbContext.EmpInfos on tb.UserID equals tb3.EmpId
                              where tb1.IsActive && tb2.IsActive && tb2.RoleName.ToLower().Contains("viewuser") && tb.ClientId == ClientId
                              orderby tb.CreatedOn descending
                              select new
                              {
                                  tb.UserID,
                                  tb.EmployeeId,
                                  tb.Email,
                                  tb1.RoleID,
                                  tb2.RoleName,
                                  tb.Designation,
                                  tb.Division,
                                  tb.ClientId,
                                  tb3.FirstName,
                                  tb3.LastName,
                                  tb.IsActive

                              }).ToList();
                List<UserReffdata> userList = result.Select(record => new UserReffdata
                {
                    UserID = record.UserID,
                    EmployeeId = record.EmployeeId,
                    Email = record.Email,
                    RoleName = record.RoleName,
                    RoleID = record.RoleID,
                    Designation = record.Designation,
                    Division = record.Division,
                    ClientId = record.ClientId,
                    FirstName = record.FirstName,
                    LastName = record.LastName,
                    IsActive = record.IsActive,
                }).ToList();
                return userList;
            }
            catch (Exception ex)
            {
                // Handle exceptions here or let them bubble up
                //ErrorLog.AddErrorLog("AuthMasters/GetAllViewerUsers", ex.Message);
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public List<UserReffdata> GetAllActiveViewUsers(string ClientId)
        {
            try
            {
                var clientcheck = _dbContext.Clients.FirstOrDefault(e => e.Id == ClientId);
                if (clientcheck == null)
                {
                    throw new Exception("ClientId is Not exists");
                }
                var result = (from tb in _dbContext.Users
                              join tb1 in _dbContext.UserRoleMaps on tb.UserID equals tb1.UserID
                              join tb2 in _dbContext.Roles on tb1.RoleID equals tb2.RoleID
                              join tb3 in _dbContext.EmpInfos on tb.UserID equals tb3.EmpId
                              where tb.IsActive && tb1.IsActive && tb2.IsActive &&
                                 tb2.RoleName.ToLower().Contains("viewuser") && tb.ClientId == ClientId
                              orderby tb.CreatedOn descending
                              select new
                              {
                                  tb.UserID,
                                  tb.EmployeeId,
                                  tb.Email,
                                  tb1.RoleID,
                                  tb2.RoleName,
                                  tb.Designation,
                                  tb.Division,
                                  tb.ClientId,
                                  tb3.FirstName,
                                  tb3.LastName,
                                  tb.IsActive

                              }).ToList();
                List<UserReffdata> userList = result.Select(record => new UserReffdata
                {
                    UserID = record.UserID,
                    EmployeeId = record.EmployeeId,
                    Email = record.Email,
                    RoleName = record.RoleName,
                    RoleID = record.RoleID,
                    Designation = record.Designation,
                    Division = record.Division,
                    ClientId = record.ClientId,
                    FirstName = record.FirstName,
                    LastName = record.LastName,
                    IsActive = record.IsActive,
                }).ToList();
                return userList;
            }
            catch (Exception ex)
            {
                // Handle exceptions here or let them bubble up
                //ErrorLog.AddErrorLog("AuthApp/GetAllActiveViewUsers", ex.Message);
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<List<EmpInfo>> GetAllEmpInfo()
        {
            return await _dbContext.EmpInfos.ToListAsync();
        }

        public async Task<EmpInfo> GetEmpInfoById(Guid id)
        {
            try
            {
                var empInfo = await _dbContext.EmpInfos.FindAsync(id);
                if (empInfo == null)
                {
                    throw new Exception("Employee not found!");
                }

                return empInfo;
            }
            catch (Exception ex)
            {
                //ErrorLog.AddErrorLog("AuthMaster/GetEmpInfoById", ex.Message);
                throw new Exception(ex.Message ?? "Network Error");
            }
        }
        public async Task<EmpInfo> UpdateFromEmployeeEmpInfo(FromEmployeeEmpInfo empInfo)
        {
            try
            {
                var existingEmp = await _dbContext.EmpInfos.FindAsync(empInfo.EmpId);
                if (existingEmp == null)
                {
                    throw new Exception("User Not Found");
                }

                existingEmp.FirstName = empInfo.FirstName;
                existingEmp.LastName = empInfo.LastName;
                existingEmp.Address = empInfo.Address;
                existingEmp.Mobile = empInfo.Mobile;
                existingEmp.DateOfBirth = empInfo.DateOfBirth;
                existingEmp.ModifiedBy = empInfo.ModifiedBy;
                existingEmp.ModifiedOn = DateTime.Now;


                await _dbContext.SaveChangesAsync();
                return existingEmp;
            }
            catch (Exception ex)
            {
                //ErrorLog.AddErrorLog("AuthMasters/UpdateFromEmployeeEmpInfo", ex.Message);
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<UserWithRole> CreateUser(UserWithRole userWithRole)
        {
            try
            {
                var clientcheck = _dbContext.Clients.FirstOrDefault(e => e.Id == userWithRole.ClientId);
                if (clientcheck == null)
                {
                    //UserErrorLog($"While Creating the User {userWithRole.EmployeeId} > ClientId is Not exists");
                    throw new Exception("ClientId is Not exists");
                }

                string portalAddress = _configuration["SiteURL"];

                // Check if the user with the same EmployeeId already exists
                var existingUserByEmployeeId = _dbContext.Users.FirstOrDefault(tb1 => tb1.EmployeeId == userWithRole.EmployeeId && tb1.IsActive);
                if (existingUserByEmployeeId != null)
                {

                    //UserErrorLog($"User Create {userWithRole.EmployeeId} > User with the same EmployeeId already exists");
                    throw new Exception("User with the same EmployeeId already exists");
                }

                // Check if the user with the same email already exists
                var existingUserByEmail = _dbContext.Users.FirstOrDefault(tb1 => tb1.Email == userWithRole.Email && tb1.IsActive);
                if (existingUserByEmail != null)
                {

                    //UserErrorLog($"User Create {userWithRole.EmployeeId} > User with the same email address already exists");
                    throw new Exception("User with the same email address already exists");
                }

                string filePath1 = null;
                string dbfilePath1 = null;
                if (userWithRole.ProfilePic != null)
                {
                    string folderPath = _configuration["FolderPath"];
                    string foldername = "/StaticFiles/";
                    string portalAddresslink = _configuration["ApiURL"];
                    // Save new profile picture
                    var fileName = $"{Guid.NewGuid()}_{userWithRole.ProfilePic.FileName.Replace(" ", "_")}";
                    filePath1 = Path.Combine(folderPath, fileName);
                    dbfilePath1 = portalAddresslink + Path.Combine(foldername, fileName);

                    using (var stream = new FileStream(filePath1, FileMode.Create))
                    {
                        await userWithRole.ProfilePic.CopyToAsync(stream);
                    }
                }

                // Creating User
                User user = new User
                {
                    UserID = Guid.NewGuid(),
                    EmployeeId = userWithRole.EmployeeId,
                    Email = userWithRole.Email.Replace(" ", ""),
                    Password = Encrypt(userWithRole.Password.Replace(" ", ""), true),
                    Designation = userWithRole.Designation,
                    Division = userWithRole.Division,
                    ContactNumber = userWithRole.ContactNumber,
                    ClientId = userWithRole.ClientId,
                    CreatedBy = userWithRole.CreatedBy,
                    IsActive = true,
                    CreatedOn = DateTime.Now,
                    IsLocked = false,
                    Attempts = 0,
                    ExpiryDate = DateTime.Now.AddDays(90),
                    ProfilePath = filePath1,
                    PicDbPath = dbfilePath1
                };
                _dbContext.Users.Add(user);
                await _dbContext.SaveChangesAsync();
                Log.DataLog(user.UserID.ToString(), $"User Created Successfully with email {user.Email}", "User Log");
                //UserLog(user.EmployeeId, $"User Created Success,for {user.Email}");

                EmpInfo empinfo = new EmpInfo
                {
                    EmpId = user.UserID,
                    FirstName = userWithRole.FirstName,
                    LastName = userWithRole.LastName,
                    Address = userWithRole.Address,
                    DateOfBirth = userWithRole.DateOfBirth,
                    JoiningDate = userWithRole.JoiningDate,
                    Department = userWithRole.Designation,
                    Email = userWithRole.Email,
                    Mobile = userWithRole.ContactNumber,
                    Plant = "Banglore",
                    IsActive = true,
                    CreatedBy = userWithRole.CreatedBy,
                    CreatedOn = DateTime.Now
                };
                _dbContext.EmpInfos.Add(empinfo);
                await _dbContext.SaveChangesAsync();
                Log.DataLog(user.UserID.ToString(), $"User Information Created Successfully,for {userWithRole.FirstName + userWithRole.LastName}", "User Log");
                //UserLog(user.EmployeeId, $"User Information Created Success,for {userWithRole.FirstName + userWithRole.LastName}");

                UserRoleMap userRole = new UserRoleMap
                {
                    RoleID = userWithRole.RoleID,
                    UserID = user.UserID,
                    IsActive = true,
                    CreatedOn = DateTime.Now
                };
                _dbContext.UserRoleMaps.Add(userRole);
                await _dbContext.SaveChangesAsync();
                Log.DataLog(user.UserID.ToString(), $"User Role {userRole.RoleID} Assigned Successfully for the user : {user.UserID}", "User Log");

                //UserLog(user.EmployeeId, $"User Role Assigned Success,for {user.Email}");

                UserWithRole userResult = new UserWithRole
                {
                    EmployeeId = user.EmployeeId,
                    Email = user.Email,
                    ContactNumber = user.ContactNumber,
                    UserID = user.UserID,
                    Password = user.Password,
                    RoleID = userRole.RoleID
                };

                // Send initialization email
                var emailResult = await _emailService.SendUserCreatedMailForUser(userWithRole.FirstName, userWithRole.LastName, userWithRole.Email, userWithRole.Password, portalAddress);
                //if (!emailResult)
                //{
                //    UserErrorLog($"User Create {userWithRole.EmployeeId} > Failed to send email");
                //    throw new Exception("Failed to send email");
                //}

                return userResult;
            }
            catch (Exception ex)
            {
                // Handle exceptions here or let them bubble up
                //ErrorLog.AddErrorLog("AuthMaster/CreateUser", ex.Message);
                //UserErrorLog($"User Create  Exception {userWithRole.EmployeeId} > {ex.Message}");
                Log.Error(userWithRole.EmployeeId, $"User Creation  Exception : {ex.Message}", "User Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }


        public async Task<UserWithRole> CreateRegisterUser(UserWithRole userWithRole)
        {
            try
            {
                var clientcheck = _dbContext.Clients.FirstOrDefault(e => e.Id == userWithRole.ClientId);
                if (clientcheck == null)
                {

                   // UserErrorLog($"User CreateRegisterUser {userWithRole.EmployeeId} > ClientId is Not exists");
                    throw new Exception("ClientId is Not exists");
                }


                // Check if the user with the same EmployeeId already exists
                var existingUserByEmployeeId = _dbContext.Users.FirstOrDefault(tb1 => tb1.EmployeeId == userWithRole.EmployeeId);
                if (existingUserByEmployeeId != null)
                {

                    //UserErrorLog($"User Create {userWithRole.EmployeeId} > User with the same EmployeeId already exists");
                    throw new Exception("User with the same EmployeeId already exists");
                }

                // Check if the user with the same email already exists
                var existingUserByEmail = _dbContext.Users.FirstOrDefault(tb1 => tb1.Email == userWithRole.Email);
                if (existingUserByEmail != null)
                {

                    //UserErrorLog($"User Create {userWithRole.EmployeeId} > User with the same email already exists");
                    throw new Exception("User with the same email address already exists");
                }

                string filePath1 = null;
                string dbfilePath1 = null;
                if (userWithRole.ProfilePic != null)
                {
                    string folderPath = _configuration["FolderPath"];
                    string foldername = "/ProfileAttachemants/";
                    string portalAddresslink = _configuration["ApiURL"];
                    // Save new profile picture
                    var fileName = $"{Guid.NewGuid()}_{userWithRole.ProfilePic.FileName.Replace(" ", "_")}";
                    filePath1 = Path.Combine(folderPath, fileName);
                    dbfilePath1 = portalAddresslink + Path.Combine(foldername, fileName);
                    if (!Directory.Exists(folderPath))
                    {
                        Directory.CreateDirectory(folderPath);
                    }
                    using (var stream = new FileStream(filePath1, FileMode.Create))
                    {
                        await userWithRole.ProfilePic.CopyToAsync(stream);
                    }
                }

                // Creating User
                User user = new User
                {
                    UserID = Guid.NewGuid(),
                    EmployeeId = userWithRole.EmployeeId,
                    Email = userWithRole.Email,
                    Password = Encrypt(userWithRole.Password, true),
                    Designation = userWithRole.Designation,
                    Division = userWithRole.Division,
                    ContactNumber = userWithRole.ContactNumber,
                    ClientId = userWithRole.ClientId,
                    CreatedBy = userWithRole.CreatedBy ?? " ",
                    IsActive = false,
                    CreatedOn = DateTime.Now,
                    IsLocked = false,
                    Attempts = 0,
                    ExpiryDate = DateTime.Now.AddDays(90),
                    ProfilePath = filePath1,
                    PicDbPath = dbfilePath1
                };
                _dbContext.Users.Add(user);
                await _dbContext.SaveChangesAsync();
                Log.DataLog(user.UserID.ToString(), $"User Registered Successfully with email {user.Email}", "User Register Log");
                //UserLog(user.EmployeeId, $"User Created Success,for {user.Email}");

                EmpInfo empinfo = new EmpInfo
                {
                    EmpId = user.UserID,
                    FirstName = userWithRole.FirstName,
                    LastName = userWithRole.LastName,
                    Address = userWithRole.Address,
                    DateOfBirth = userWithRole.DateOfBirth,
                    JoiningDate = userWithRole.JoiningDate,
                    Department = userWithRole.Designation,
                    Email = userWithRole.Email,
                    Mobile = userWithRole.ContactNumber,
                    Plant = "Banglore",
                    IsActive = true,
                    CreatedBy = userWithRole.CreatedBy,
                    CreatedOn = DateTime.Now
                };
                _dbContext.EmpInfos.Add(empinfo);
                await _dbContext.SaveChangesAsync();
                //UserLog(user.EmployeeId, $"User Information Created Success,for {userWithRole.FirstName + userWithRole.LastName}");
                Log.DataLog(user.UserID.ToString(), $"User Information Created Successfully,for {userWithRole.FirstName + userWithRole.LastName}", "User Log");


                UserRoleMap userRole = new UserRoleMap
                {
                    RoleID = userWithRole.RoleID,
                    UserID = user.UserID,
                    IsActive = true,
                    CreatedOn = DateTime.Now
                };
                _dbContext.UserRoleMaps.Add(userRole);
                await _dbContext.SaveChangesAsync();
                //UserLog(user.EmployeeId, $"User Role Assigned Success,for {user.Email}");
                Log.DataLog(user.UserID.ToString(), $"User Role {userRole.RoleID} Assigned Successfully for the user : {user.UserID}", "User Log");


                UserWithRole userResult = new UserWithRole
                {
                    EmployeeId = user.EmployeeId,
                    Email = user.Email,
                    ContactNumber = user.ContactNumber,
                    UserID = user.UserID,
                    Password = user.Password,
                    RoleID = userRole.RoleID
                };

                // Query to fetch admin users
                var adminUsers = await (from tb in _dbContext.Users
                                        join tb1 in _dbContext.UserRoleMaps on tb.UserID equals tb1.UserID
                                        join tb2 in _dbContext.Roles on tb1.RoleID equals tb2.RoleID
                                        join tb3 in _dbContext.EmpInfos on tb.UserID equals tb3.EmpId
                                        where tb.IsActive && tb1.IsActive && tb2.IsActive && tb2.RoleName.ToLower().Contains("admin")
                                        orderby tb.CreatedOn descending
                                        select new
                                        {
                                            UserId = tb.UserID,
                                            EmployeeId = tb.EmployeeId,
                                            Email = tb.Email,
                                            FirstName = tb3.FirstName,
                                            LastName = tb3.LastName
                                        }).ToListAsync();
                //var adminEmailResult = await _emailService.SendUserCreatedMailForUser(userWithRole.FirstName, userWithRole.LastName, userWithRole.Email, user.EmployeeId, _configuration["SiteURL"];);

                //if (!adminEmailResult)
                //{
                //    UserErrorLog($"Signup User Create Send Mail From Admin  {userWithRole.Email} > Failed to send email");
                //}
                foreach (var userdata in adminUsers)
                {
                    var adminEmailResult = await _emailService.SendSignUpUserRequestMailFromAdmin(userWithRole.FirstName, userWithRole.LastName, userdata.Email, user.EmployeeId, userWithRole.Email);

                    if (!adminEmailResult)
                    {
                        //UserErrorLog($"Signup User Create Send Mail From Admin  {userdata.Email} > Failed to send email");
                    }
                }

                return userResult;
            }
            catch (Exception ex)
            {
                // Handle exceptions here or let them bubble up
               // UserErrorLog($"User Create  Exception {userWithRole.EmployeeId} > {ex.Message}");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<string> ProfileUpdateUser(UserProfileUpdate userProfileUpdate)
        {
            try
            {


                var user1 = await _dbContext.Users.FirstOrDefaultAsync(tb1 => tb1.UserID == userProfileUpdate.UserID && tb1.IsActive);

                if (user1 != null)
                {
                    string NewfilePath1 = null;
                    string NewdbfilePath1 = null;
                    if (userProfileUpdate.ProfilePic != null)
                    {

                        if (user1.ProfilePath != null)
                        {
                            var filePath = user1.ProfilePath;
                            if (File.Exists(filePath))
                            {
                                File.Delete(filePath);
                            }
                        }

                        if (userProfileUpdate.ProfilePic != null)
                        {
                            string folderPath = _configuration["FolderPath"];
                            string foldername = "/StaticFiles/";
                            string portalAddresslink = _configuration["ApiURL"];
                            // Save new profile picture
                            var fileName = $"{Guid.NewGuid()}_{userProfileUpdate.ProfilePic.FileName.Replace(" ", "_")}";
                            NewfilePath1 = Path.Combine(folderPath, fileName);
                            NewdbfilePath1 = portalAddresslink + Path.Combine(foldername, fileName);

                            using (var stream = new FileStream(NewfilePath1, FileMode.Create))
                            {
                                await userProfileUpdate.ProfilePic.CopyToAsync(stream);
                            }
                        }
                        user1.ProfilePath = NewfilePath1;
                        user1.PicDbPath = NewdbfilePath1;
                        user1.ModifiedOn = DateTime.Now;
                        user1.ModifiedBy = userProfileUpdate.ModifiedBy;
                    }
                    await _dbContext.SaveChangesAsync();
                    Log.DataLog(userProfileUpdate.UserID.ToString(), $"Profile pic been changed successfully to the user {user1.UserID} with photo {userProfileUpdate.ProfilePic.FileName.Replace(" ", "_")}", "Profile Pic Log");

                    //UserLog(user1.EmployeeId.ToString(), $"User Profile Photo Added Success");
                    return NewdbfilePath1;
                }
                else
                {

                    Log.Error(userProfileUpdate.UserID.ToString(), $"User Profile Update Exception {userProfileUpdate.ProfilePic.Name} > User is Not exist or Not Active","User Log");
                    //UserErrorLog($"User ProfileUpdate Exception {userProfileUpdate.ProfilePic.Name} > User is Not exist or Not Active");
                    throw new Exception("User is Not exist or Not Active");
                }
            }
            catch (Exception ex)
            {
                Log.Error(userProfileUpdate.UserID.ToString(), $"User ProfileUpdate  Exception {userProfileUpdate.ProfilePic.Name} > {ex.Message}", "User Log");

                //ErrorLog.AddErrorLog("AuthMaster/ProfileUpdateUser", ex.Message);
                //UserErrorLog($"User ProfileUpdate  Exception {userProfileUpdate.ProfilePic.Name} > {ex.Message}");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<UserWithRole> UpdateUser(UserWithRole userWithRole)
        {
            try
            {
                var clientcheck = _dbContext.Clients.FirstOrDefault(e => e.Id == userWithRole.ClientId);
                if (clientcheck == null)
                {
                    throw new Exception("ClientId is Not exists");
                }

                string portalAddress = _configuration["SiteURL"];
                UserWithRole userResult = new UserWithRole();

                var user1 = await _dbContext.Users.FirstOrDefaultAsync(tb1 => tb1.EmployeeId == userWithRole.EmployeeId && tb1.UserID != userWithRole.UserID);

                if (user1 == null)
                {
                    var user2 = await _dbContext.Users.FirstOrDefaultAsync(tb1 => tb1.Email == userWithRole.Email && tb1.UserID != userWithRole.UserID);

                    if (user2 == null)
                    {
                        var user = await _dbContext.Users.FirstOrDefaultAsync(tb => tb.UserID == userWithRole.UserID && tb.ClientId == userWithRole.ClientId);
                        if (user != null)
                        {
                            user.EmployeeId = userWithRole.EmployeeId;
                            user.Email = userWithRole.Email.Replace(" ", "");
                            user.Password = Encrypt(userWithRole.Password.Replace(" ", ""), true);
                            user.Designation = userWithRole.Designation;
                            user.Division = userWithRole.Division;
                            user.ContactNumber = userWithRole.ContactNumber;
                            user.ClientId = userWithRole.ClientId;
                            if (!user.IsActive)
                            {
                                if (userWithRole.IsActive)
                                {
                                    var emailSendResult = await _emailService.SendSignUpUserCreatedMailForViewUser(
                                        userWithRole.FirstName,
                                        userWithRole.LastName,
                                        user.Email,
                                        Decrypt(user.Password.Replace(" ", ""), true),
                                        portalAddress
                                    );

                                    if (!emailSendResult)
                                    {
                                        //UserErrorLog($"User Create {user.EmployeeId} > Failed to send email");
                                    }
                                }
                            }
                            if (userWithRole.IsActive != null)
                            {
                                user.IsActive = userWithRole.IsActive;
                                if (userWithRole.IsActive == false)
                                {
                                    await RemoveUserFromGroupMappingsAsync(user.UserID.ToString(), userWithRole.ModifiedBy);
                                }
                            }
                            user.ModifiedOn = DateTime.Now;
                            user.ModifiedBy = userWithRole.ModifiedBy;

                            if (userWithRole.ProfilePic != null)
                            {

                                if (user.ProfilePath != null)
                                {
                                    var filePath = user.ProfilePath;
                                    if (File.Exists(filePath))
                                    {
                                        File.Delete(filePath);
                                    }
                                }
                                string NewfilePath1 = null;
                                string NewdbfilePath1 = null;
                                if (userWithRole.ProfilePic != null)
                                {
                                    string folderPath = _configuration["FolderPath"];
                                    string foldername = "/StaticFiles/";
                                    string portalAddresslink = _configuration["ApiURL"];
                                    // Save new profile picture
                                    var fileName = $"{Guid.NewGuid()}_{userWithRole.ProfilePic.FileName.Replace(" ", "_")}";
                                    NewfilePath1 = Path.Combine(folderPath, fileName);
                                    NewdbfilePath1 = portalAddresslink + Path.Combine(foldername, fileName);

                                    using (var stream = new FileStream(NewfilePath1, FileMode.Create))
                                    {
                                        await userWithRole.ProfilePic.CopyToAsync(stream);
                                    }
                                }
                                user.ProfilePath = NewfilePath1;
                                user.PicDbPath = NewdbfilePath1;
                            }


                            await _dbContext.SaveChangesAsync();

                            //update Empinfo
                            EmpInfo empinfo = _dbContext.EmpInfos.FirstOrDefault(x => x.EmpId == userWithRole.UserID);
                            if (empinfo != null)
                            {
                                empinfo.Address = userWithRole.Address;
                                empinfo.DateOfBirth = userWithRole.DateOfBirth;
                                empinfo.FirstName = userWithRole.FirstName;
                                empinfo.LastName = userWithRole.LastName;
                                empinfo.Email = userWithRole.Email;
                                empinfo.Department = userWithRole.Designation;
                                empinfo.Mobile = userWithRole.ContactNumber;
                                empinfo.JoiningDate = userWithRole.JoiningDate;
                                empinfo.ModifiedBy = userWithRole.ModifiedBy;
                                empinfo.ModifiedOn = userWithRole.ModifiedOn;
                                empinfo.IsActive = userWithRole.IsActive;
                            }
                            await _dbContext.SaveChangesAsync();


                            //UserLog(userWithRole.Email, $"User  User Changed the there information");

                            Log.DataLog(user.UserID.ToString(), $"User Information Updated Successfully,for {userWithRole.FirstName + userWithRole.LastName}", "User Log");



                            // Update User's role
                            UserRoleMap oldUserRole = _dbContext.UserRoleMaps.FirstOrDefault(x => x.UserID == userWithRole.UserID && x.IsActive);
                            if (oldUserRole != null && oldUserRole.RoleID != userWithRole.RoleID)
                            {
                                _dbContext.UserRoleMaps.Remove(oldUserRole);
                                await _dbContext.SaveChangesAsync();

                                UserRoleMap userRole = new UserRoleMap()
                                {
                                    RoleID = userWithRole.RoleID,
                                    UserID = user.UserID,
                                    IsActive = true,
                                    CreatedBy = userWithRole.ModifiedBy,
                                    CreatedOn = DateTime.Now,
                                };
                                _dbContext.UserRoleMaps.Add(userRole);
                                await _dbContext.SaveChangesAsync();
                                Log.DataLog(user.UserID.ToString(), $"User Role {userRole.RoleID} Assigned Successfully for the user : {user.UserID}", "User Log");



                                userResult.EmployeeId = user.EmployeeId;
                                userResult.Email = user.Email;
                                userResult.ContactNumber = user.ContactNumber;
                                userResult.UserID = user.UserID;
                                userResult.Password = user.Password;
                                userResult.RoleID = userRole.RoleID;
                                userResult.IsActive = userWithRole.IsActive;
                            }
                        }
                    }
                    else
                    {
                        Log.Error(user1.UserID.ToString(),$"User Update {userWithRole.EmployeeId} > User with the same email address already exists","User Log");
                        //UserErrorLog($"User Update {userWithRole.EmployeeId} > User with the same email address already exists");
                        throw new Exception("User with the same email address already exists");
                    }
                }
                else
                {
                    Log.Error(user1.UserID.ToString(), $"User Update {userWithRole.EmployeeId} > User with the same name already exists", "User Log");

                    //UserErrorLog($"User Update {userWithRole.EmployeeId} > User with the same name already exists");
                    throw new Exception("User with the same name already exists");
                }

                return userResult;
            }
            catch (Exception ex)
            {
                Log.Error(userWithRole.UserID.ToString(), $"While Updating user exception occured : {ex.Message} ", "User Log");
                // Handle exceptions here or let them bubble up
                //ErrorLog.AddErrorLog("AuthMaster/UpdateUser", ex.Message);
                //UserErrorLog($"User Update  Exception {userWithRole.EmployeeId} > {ex.Message}");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<UserWithRole> DeleteUser(string ClientId, Guid UserID)
        {
            try
            {
                var clientcheck = _dbContext.Clients.FirstOrDefault(e => e.Id == ClientId);
                if (clientcheck == null)
                {
                    
                    throw new Exception("ClientId is Not exists");
                }

                UserWithRole userResult = new UserWithRole();
                var user = await _dbContext.Users.FirstOrDefaultAsync(tb => tb.UserID == UserID && tb.ClientId == ClientId);
                if (user != null)
                {
                    _dbContext.Users.Remove(user);
                    Log.DataLog(user.UserID.ToString(), $"User id {user.UserID} and user data has been removed from the records ", "User Log");
                    //user.IsActive = false;
                    //await _dbContext.SaveChangesAsync();

                    await RemoveUserFromGroupMappingsAsync(user.UserID.ToString(), "System");



                    EmpInfo empData = _dbContext.EmpInfos.FirstOrDefault(x => x.EmpId == UserID);
                    if (empData != null)
                    {
                        _dbContext.EmpInfos.Remove(empData);
                        await _dbContext.SaveChangesAsync();
                    }

                    //UserLog(user.EmployeeId.ToString(), $"User Deleted there information");
                    // Delete User's role
                    UserRoleMap userRole = _dbContext.UserRoleMaps.FirstOrDefault(x => x.UserID == UserID && x.IsActive);
                    if (userRole != null)
                    {
                        _dbContext.UserRoleMaps.Remove(userRole);
            
                        await _dbContext.SaveChangesAsync();
                    }

                    userResult.EmployeeId = user.EmployeeId;
                    userResult.Email = user.Email;
                    userResult.ContactNumber = user.ContactNumber;
                    userResult.UserID = user.UserID;
                    userResult.Password = user.Password;
                    userResult.RoleID = userRole.RoleID;
                }
                return userResult;
            }
            catch (Exception ex)
            {
                Log.Error(UserID.ToString(), $"While deleting the User id {UserID} and user data following exception occured {ex.Message} ", "User Log");
                // Handle exceptions here or let them bubble up
                //ErrorLog.AddErrorLog("AuthMaster/DeleteUser", ex.Message);
                //UserErrorLog($"User Delete  Exception > {ex.Message}");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        private async Task RemoveUserFromGroupMappingsAsync(string userId, string? modifiedBy = null)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return;
            }

            try
            {
                var candidateGroups = await _dbContext.GroupMaster
                    .Where(g => g.GroupUserIds != null && g.GroupUserIds != "")
                    .ToListAsync();

                var updatedGroupNames = new List<string>();

                foreach (var group in candidateGroups)
                {
                    var ids = group.GroupUserIds!
                        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .ToList();

                    int removedCount = ids.RemoveAll(id => string.Equals(id, userId, StringComparison.OrdinalIgnoreCase));
                    if (removedCount > 0)
                    {
                        group.GroupUserIds = ids.Any() ? string.Join(",", ids) : null;
                        group.ModifiedOn = DateTime.Now;
                        group.ModifiedBy = modifiedBy ?? "System";
                        updatedGroupNames.Add(group.GroupName);
                    }
                }

                if (updatedGroupNames.Any())
                {
                    await _dbContext.SaveChangesAsync();
                    Log.DataLog(modifiedBy ?? "System",
                        $"Removed user {userId} from group mapping(s): {string.Join(", ", updatedGroupNames)}",
                        "GroupMaster Log");
                }
            }
            catch (Exception ex)
            {
                // Never let a group-unmapping failure block the actual user
                // deactivate/delete operation that triggered it.
                Log.Error(modifiedBy ?? "System", $"RemoveUserFromGroupMappingsAsync failed for user {userId}: {ex.Message}", "GroupMaster Log");
            }
        }

        #endregion

        #region RoleCreation

        public List<RoleWithApp> GetAllRoles(string ClientId)
        {
            try
            {
                var clientcheck = _dbContext.Clients.FirstOrDefault(e => e.Id == ClientId);
                if (clientcheck == null)
                {
                    throw new Exception("ClientId is Not exists");
                }

                List<RoleWithApp> RoleWithAppList = new List<RoleWithApp>();

                List<Role> RoleList = (from tb in _dbContext.Roles
                                       where tb.IsActive && tb.ClientId == ClientId
                                       orderby tb.CreatedOn descending
                                       select tb).ToList();

                foreach (Role rol in RoleList)
                {
                    RoleWithAppList.Add(new RoleWithApp()
                    {
                        RoleID = rol.RoleID,
                        RoleName = rol.RoleName,
                        IsActive = rol.IsActive,
                        CreatedOn = rol.CreatedOn,
                        ClientId = rol.ClientId,
                        ModifiedOn = rol.ModifiedOn,
                        AppIDList = _dbContext.RoleAppMaps
                            .Where(x => x.RoleID == rol.RoleID && x.IsActive)
                            .Select(r => r.AppID)
                            .ToArray()
                    });
                }

                return RoleWithAppList;
            }
            catch (Exception ex)
            {
                // Handle exceptions here or let them bubble up
                //ErrorLog.AddErrorLog("AuthMaster/GetAllRoles", ex.Message);
                //UserErrorLog($"Get Role Create Exception > {ex.Message}");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }


        public List<RoleWithAppView> GetAllRolesWithApp(string ClientId)
        {
            try
            {
                var clientcheck = _dbContext.Clients.FirstOrDefault(e => e.Id == ClientId);
                if (clientcheck == null)
                {
                    throw new Exception("ClientId is Not exists");
                }

                List<RoleWithAppView> RoleWithAppList = new List<RoleWithAppView>();
                HashSet<Guid> uniqueRoleIDs = new HashSet<Guid>();  // To track unique RoleIDs

                List<Role> RoleList = (from tb in _dbContext.Roles
                                       join tb1 in _dbContext.RoleAppMaps on tb.RoleID equals tb1.RoleID
                                       join tb2 in _dbContext.Apps on tb1.AppID equals tb2.AppID
                                       where tb.IsActive && tb.ClientId == ClientId
                                       orderby tb.CreatedOn descending
                                       select tb).ToList();

                foreach (Role rol in RoleList)
                {
                    // Check if the RoleID is already processed
                    if (uniqueRoleIDs.Contains(rol.RoleID))
                    {
                        continue;  // Skip processing if already added
                    }

                    List<int> appIDList = _dbContext.RoleAppMaps
                        .Where(x => x.RoleID == rol.RoleID && x.IsActive)
                        .Select(r => r.AppID)
                        .ToList();

                    List<string> appNameList = _dbContext.Apps
                        .Where(app => appIDList.Contains(app.AppID))
                        .Select(app => app.AppName)
                        .ToList();

                    RoleWithAppList.Add(new RoleWithAppView()
                    {
                        RoleID = rol.RoleID,
                        RoleName = rol.RoleName,
                        IsActive = rol.IsActive,
                        CreatedOn = rol.CreatedOn,
                        ClientId = rol.ClientId,
                        CreatedBy = rol.CreatedBy,
                        ModifiedOn = rol.ModifiedOn,
                        ModifiedBy = rol.ModifiedBy,
                        AppIDList = appIDList.ToArray(),
                        AppNames = string.Join(", ", appNameList)
                    });

                    // Add the processed RoleID to the HashSet
                    uniqueRoleIDs.Add(rol.RoleID);
                }

                return RoleWithAppList;
            }
            catch (Exception ex)
            {
                // Handle exceptions here or let them bubble up
                //ErrorLog.AddErrorLog("GetAllRolesWithApp/GetAllRolesWithApp :- ", ex.Message);
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<RoleWithApp> CreateRole(RoleWithApp roleWithApp)
        {
            try
            {
                var clientcheck = _dbContext.Clients.FirstOrDefault(e => e.Id == roleWithApp.ClientId);
                if (clientcheck == null)
                {
                    throw new Exception("ClientId is Not exists");
                }

                // Check if the role with the same name already exists
                bool roleExists = await _dbContext.Roles
                    .AnyAsync(tb => tb.IsActive && tb.RoleName == roleWithApp.RoleName);

                if (roleExists)
                {

                    //UserErrorLog($"Role Create Exception {roleWithApp.RoleName} > Role with the same name already exists");
                    throw new Exception("Role with the same name already exists");
                }

                Role role = new Role
                {
                    RoleID = Guid.NewGuid(),
                    RoleName = roleWithApp.RoleName,
                    CreatedOn = DateTime.Now,
                    CreatedBy = roleWithApp.CreatedBy,
                    ClientId = roleWithApp.ClientId,
                    IsActive = true
                };

                _dbContext.Roles.Add(role);

                // Save changes to add the new role
                await _dbContext.SaveChangesAsync();
                Log.DataLog(roleWithApp.CreatedBy.ToString(), $"Role Was created wit the role name {roleWithApp.RoleName}", "New Roles");
                //UserLog(role.RoleName.ToString(), $"Role Added");
                // Add role-app mappings
                foreach (int AppID in roleWithApp.AppIDList)
                {
                    RoleAppMap roleApp = new RoleAppMap
                    {
                        AppID = AppID,
                        RoleID = role.RoleID,
                        IsActive = true,
                        CreatedOn = DateTime.Now
                    };

                    _dbContext.RoleAppMaps.Add(roleApp);
                    Log.DataLog(roleWithApp.CreatedBy.ToString(), $"For the Role id {role.RoleID} App Id {AppID} was Added", "Role App Maps");
                }

                // Save changes to add role-app mappings
                await _dbContext.SaveChangesAsync();

                // Return the created role with apps
                return new RoleWithApp
                {
                    RoleID = role.RoleID,
                    RoleName = role.RoleName,
                    IsActive = role.IsActive,
                    CreatedOn = role.CreatedOn,
                    ModifiedOn = role.ModifiedOn,
                    AppIDList = roleWithApp.AppIDList,
                    ClientId = roleWithApp.ClientId
                };
            }
            catch (Exception ex)
            {
                Log.Error(roleWithApp.CreatedBy.ToString(), $"While creating new role following error occured {ex.Message}", "New Roles");
                // Log the exception if needed
                //ErrorLog.AddErrorLog("AuthMaster/RoleCreation", ex.Message);
                //UserErrorLog($"Role Create Exception {roleWithApp.RoleName} > {ex.Message}");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<RoleWithApp> UpdateRole(RoleWithApp roleWithApp)
        {
            try
            {
                var clientcheck = _dbContext.Clients.FirstOrDefault(e => e.Id == roleWithApp.ClientId);
                if (clientcheck == null)
                {
                    throw new Exception("ClientId is Not exists");
                }

                // Check if the role with the same name already exists and has a different ID
                bool roleExists = await _dbContext.Roles
                    .AnyAsync(tb => tb.IsActive && tb.RoleName == roleWithApp.RoleName && tb.RoleID != roleWithApp.RoleID && tb.ClientId == roleWithApp.ClientId);

                if (roleExists)
                {

                    //UserErrorLog($"Role Update Exception {roleWithApp.RoleName} > Role with the same name already exists");
                    throw new Exception("Role with the same name already exists");
                }

                // Find the role to update
                Role role = await _dbContext.Roles
                    .FirstOrDefaultAsync(tb => tb.IsActive && tb.RoleID == roleWithApp.RoleID && tb.ClientId == roleWithApp.ClientId);

                if (role != null)
                {
                    role.RoleName = roleWithApp.RoleName;
                    role.ClientId = roleWithApp.ClientId;
                    role.IsActive = true;
                    role.ModifiedOn = DateTime.Now;
                    role.ModifiedBy = roleWithApp.ModifiedBy;

                    // Save changes to update the role
                    await _dbContext.SaveChangesAsync();

                    // Get the existing role-app mappings
                    List<RoleAppMap> oldRoleAppList = await _dbContext.RoleAppMaps
                        .Where(x => x.RoleID == roleWithApp.RoleID && x.IsActive)
                        .ToListAsync();

                    // Identify role-app mappings that need to be removed
                    List<RoleAppMap> needToRemoveRoleAppList = oldRoleAppList
                        .Where(x => !roleWithApp.AppIDList.Any(y => y == x.AppID))
                        .ToList();

                    // Identify apps to be added to the role
                    List<int> needToAddAppList = roleWithApp.AppIDList
                        .Where(x => !oldRoleAppList.Any(y => y.AppID == x))
                        .ToList();

                    // Delete old role-app mappings
                    _dbContext.RoleAppMaps.RemoveRange(needToRemoveRoleAppList);
                    await _dbContext.SaveChangesAsync();

                    // Create new role-app mappings
                    foreach (int appID in needToAddAppList)
                    {
                        RoleAppMap roleApp = new RoleAppMap()
                        {
                            AppID = appID,
                            RoleID = role.RoleID,
                            IsActive = true,
                            CreatedOn = DateTime.Now,
                        };

                        _dbContext.RoleAppMaps.Add(roleApp);
                        Log.DataLog(roleWithApp.CreatedBy.ToString(), $"For the Role id {role.RoleID} all existing appids removed and added the App Id {appID} was Added", "Update Role App Maps");


                    }

                    // Save changes to add new role-app mappings
                    await _dbContext.SaveChangesAsync();
                    //UserLog(role.RoleName.ToString(), $"Role Updated");

                    return new RoleWithApp
                    {
                        RoleID = roleWithApp.RoleID,
                        RoleName = roleWithApp.RoleName,
                        AppIDList = roleWithApp.AppIDList,
                        ClientId = roleWithApp.ClientId,
                    };
                }
                else
                {
                 //   UserErrorLog($"Role Update Exception {roleWithApp.RoleName} > Role not found");
                    throw new Exception("Role not found");
                }
            }
            catch (Exception ex)
            {
                Log.Error(roleWithApp.CreatedBy.ToString(), $"While updating Role id {roleWithApp.RoleID} follworing errror occured : {ex.Message}", "Update Role");

                //ErrorLog.AddErrorLog("AuthMaster/UpdateRole", ex.Message);
                //UserErrorLog($"Role Update Exception {roleWithApp.RoleName} > {ex.Message}");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<RoleWithApp> DeleteRole(Guid roleId)
        {
            try
            {
                var roleToDelete = await _dbContext.Roles.FindAsync(roleId);

                if (roleToDelete == null)
                {

                    //UserErrorLog($"Role Delete Error {roleToDelete.RoleName} > Role not found");
                    throw new ArgumentException("Role not found");
                }

                _dbContext.Roles.Remove(roleToDelete);
                await _dbContext.SaveChangesAsync();

                // Change the status of the RoleApps related to the role
                var roleAppList = await _dbContext.RoleAppMaps
                    .Where(x => x.RoleID == roleId && x.IsActive)
                    .ToListAsync();

                _dbContext.RoleAppMaps.RemoveRange(roleAppList);
                await _dbContext.SaveChangesAsync();
                Log.DataLog(roleToDelete.CreatedBy, $"Role id {roleId} and its related app map was removed", "Delete Role");


                // Map the deleted role to a RoleWithApp object and return it
                var deletedRoleWithApp = new RoleWithApp
                {
                    RoleID = roleToDelete.RoleID,
                    RoleName = roleToDelete.RoleName
                };

               // UserLog(roleToDelete.RoleName.ToString(), $"Role Deleted");
                return deletedRoleWithApp;
            }
            catch (Exception ex)
            {
                Log.Error("Admin", $"While deleting Role {roleId} Delete error occured :  {ex.Message}", "Delete Role");
                // Log the exception if needed
                //ErrorLog.AddErrorLog("AuthMaster/DeleteRole", ex.Message);
                //UserErrorLog($"Role Delete Exception > {ex.Message}");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        #endregion

        #region AppControll


        public List<App> GetAllApps()
        {
            try
            {
                var apps = _dbContext.Apps
                    .Where(app => app.IsActive)
                    .ToList();

                return apps;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<App> CreateApp(App app)
        {
            try
            {

                var existingApp = await _dbContext.Apps
                    .FirstOrDefaultAsync(a => a.IsActive && a.AppName == app.AppName);

                if (existingApp != null)
                {
                    throw new InvalidOperationException("An app with the same name already exists");
                }

                app.CreatedOn = DateTime.Now;
                app.IsActive = true;
                _dbContext.Apps.Add(app);
                await _dbContext.SaveChangesAsync();
                Log.DataLog("Admin", $"New App created with app name {app.AppName}", "Apps");

                return app;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<App> UpdateApp(App app)
        {
            try
            {

                var existingApp = await _dbContext.Apps
                    .FirstOrDefaultAsync(a => a.IsActive && a.AppName == app.AppName && a.AppID != app.AppID);

                if (existingApp != null)
                {
                    throw new InvalidOperationException("An app with the same name already exists");
                }

                var appToUpdate = await _dbContext.Apps
                    .FirstOrDefaultAsync(a => a.IsActive && a.AppID == app.AppID);

                if (appToUpdate == null)
                {
                    throw new Exception("App not found");
                }
                Log.DataLog("Admin", $"Existing app name {appToUpdate.AppName} was updated to {app.AppName}", "Apps");
                appToUpdate.AppName = app.AppName;
                appToUpdate.AppRoute = app.AppRoute;
                appToUpdate.IsActive = true;
                appToUpdate.ModifiedOn = DateTime.Now;
                appToUpdate.ModifiedBy = app.ModifiedBy;

                await _dbContext.SaveChangesAsync();

                return app;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<App> DeleteApp(App app)
        {
            try
            {
                var appToDelete = await _dbContext.Apps
                    .FirstOrDefaultAsync(a => a.IsActive && a.AppID == app.AppID);

                if (appToDelete == null)
                {
                    throw new Exception("App not found");
                }
                Log.DataLog("Admin", $"App name {appToDelete.AppName} was removed successfully", "Apps");
                _dbContext.Apps.Remove(appToDelete);
         
                await _dbContext.SaveChangesAsync();

                return appToDelete;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        #endregion

        #region AddLoginHistoryControll

        public async Task<UserLoginHistory> AddLoginHistory(Guid userID, string employeeId)
        {
            try
            {
                var loginData = new UserLoginHistory
                {
                    UserID = userID,
                    EmployeeId = employeeId,
                    LoginTime = DateTime.Now
                };
                Log.DataLog(userID.ToString(), $"User Id {userID} login details added successfully", "Login Log");
                _dbContext.UserLoginHistory.Add(loginData);
                await _dbContext.SaveChangesAsync();

                return loginData;

            }
            catch (Exception ex)
            {
                throw new Exception("An error occurred while deleting the app", ex);
            }
        }

        public List<UserLoginHistory> GetAllUsersLoginHistory()
        {

            try
            {

                return _dbContext.UserLoginHistory
               .OrderByDescending(login => login.LoginTime)
               .ToList();
            }
            catch (Exception ex)
            {
                throw new Exception("An error occurred while deleting the app", ex);

            }
        }

        public List<UserLoginHistory> GetCurrentUserLoginHistory(Guid userID)
        {
            try
            {

                return _dbContext.UserLoginHistory
                    .Where(login => login.UserID == userID)
                    .OrderByDescending(login => login.LoginTime)
                    .ToList();
            }
            catch (Exception ex)
            {
                throw new Exception("An error occurred while deleting the app", ex);

            }
        }

        public async Task<UserLoginHistory> SignOut(Guid userID)
        {

            try
            {
                var result = await _dbContext.UserLoginHistory
                .Where(data => data.UserID == userID)
                .OrderByDescending(data => data.LoginTime)
                .FirstOrDefaultAsync();

                var userName = await _dbContext.Users.FirstOrDefaultAsync(e => e.UserID == userID);
                if (userName != null)
                {
                    //WriteLog.AddWriteLog(userName.EmployeeId, "Loged out successfully.");
                }

                if (result != null)
                {
                    result.LogoutTime = DateTime.Now;
                    await _dbContext.SaveChangesAsync();
                    Log.DataLog(userID.ToString(), $"User Id {userID} Logout details added successfully", "Logout Log");
                }

                return result;
            }
            catch (Exception ex)
            {
                throw new Exception("An error occurred while deleting the app", ex);

            }
        }

        #endregion

        #region PasswordChangeOption

        public async Task<User> ChangePassword(ChangePassword changePassword)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.EmployeeId == changePassword.EmployeeId && u.IsActive);

            if (user == null)
            {
                throw new Exception("User does not exist.");
            }

            string decryptedPassword = Decrypt(user.Password, true);

            if (decryptedPassword != changePassword.CurrentPassword)
            {
                throw new Exception("Current password is incorrect.");
            }

            string defaultPassword = changePassword.CurrentPassword;

            bool isNewPasswordRepeated = Enumerable.Range(1, 5)
                .Any(i => Decrypt(GetPropertyValue(user, $"Pass{i}"), true) == changePassword.NewPassword);

            if (changePassword.NewPassword == defaultPassword || isNewPasswordRepeated)
            {
                throw new Exception("New password should not be the same as the previous 5 passwords.");
            }

            string previousPassword = user.Password;
            user.Password = Encrypt(changePassword.NewPassword.Replace(" ", ""), true);
            var index = user.LastChangedPassword;
            var lastchangedIndex = 0;

            //To find lastchangedpassword
            if (!string.IsNullOrEmpty(index))
            {
                if (user.Pass1 != null)
                {
                    var strings = "user.Pass1";
                    if (strings.Contains(index))
                    {
                        lastchangedIndex = 2;
                    }
                }
                if (user.Pass2 != null)
                {
                    var strings = "user.Pass2";
                    if (strings.Contains(index))
                    {
                        lastchangedIndex = 3;
                    }
                }
                if (user.Pass3 != null)
                {
                    var strings = "user.Pass3";
                    if (strings.Contains(index))
                    {
                        lastchangedIndex = 4;
                    }
                }
                if (user.Pass4 != null)
                {
                    var strings = "user.Pass4";
                    if (strings.Contains(index))
                    {
                        lastchangedIndex = 5;
                    }
                }
                if (user.Pass5 != null)
                {
                    var strings = "user.Pass5";
                    if (strings.Contains(index))
                    {
                        lastchangedIndex = 1;
                    }
                }
            }

            if (lastchangedIndex <= 0)
            {
                lastchangedIndex = 1;
            }

            // TO change previous password
            if (lastchangedIndex == 1)
            {
                user.Pass1 = previousPassword;
            }
            else if (lastchangedIndex == 2)
            {
                user.Pass2 = previousPassword;
            }
            else if (lastchangedIndex == 3)
            {
                user.Pass3 = previousPassword;
            }
            else if (lastchangedIndex == 4)
            {
                user.Pass4 = previousPassword;
            }
            else if (lastchangedIndex == 5)
            {
                user.Pass5 = previousPassword;
            }

            user.LastChangedPassword = lastchangedIndex.ToString();
            user.IsActive = true;
            user.ModifiedOn = DateTime.Now;
            user.ExpiryDate = DateTime.Now.AddDays(90);
            Log.DataLog(user.UserID.ToString(), $"User Id {user.UserID} Password Chnaged successfully", "Change Password Log");
            await _dbContext.SaveChangesAsync();

            return user;
        }

        private string GetPropertyValue(object obj, string propertyName)
        {
            return obj.GetType().GetProperty(propertyName)?.GetValue(obj)?.ToString();
        }

        public async Task<AuthTokenHistory> SendResetLinkToMail(EmailModel emailModel)
        {
            try
            {
                string siteUrl = _configuration["SiteURL"];
                string finalpath = (siteUrl+emailModel.siteURL);
                DateTime ExpireDateTime = DateTime.Now.AddMinutes(_tokenTimespan);

                User user = _dbContext.Users.FirstOrDefault(tb => tb.Email == emailModel.EmailAddress && tb.IsActive);

                if (user == null)
                {
                    throw new Exception($"User name {emailModel.EmailAddress} is not registered!");
                }

                string code = Encrypt(user.UserID.ToString() + '|' + user.EmployeeId + '|' + ExpireDateTime, true);

                bool sendresult = await _emailService.SendMailForUserResetPasswordMail(HttpUtility.UrlEncode(code), user.EmployeeId, user.Email, user.UserID.ToString(), finalpath);

                if (!sendresult)
                {
                    throw new Exception("Sorry! There is some problem on sending mail");
                }

                var history1 = _dbContext.AuthTokenHistories.FirstOrDefault(tb => tb.UserID == user.UserID && !tb.IsUsed);

                if (history1 == null)
                {
                    AuthTokenHistory history = new AuthTokenHistory()
                    {
                        UserID = user.UserID,
                        Token = code,
                        EmployeeId = user.EmployeeId,
                        EmailAddress = user.Email,
                        CreatedOn = DateTime.Now,
                        ExpireOn = ExpireDateTime,
                        IsUsed = false,
                        Comment = "Reset Token sent successfully"
                    };
                    _dbContext.AuthTokenHistories.Add(history);
                }
                else
                {
                  //  ErrorLog.AddErrorLog("ResetPasswordLink/SendLinkToMail : Token already present, updating new token to the user whose mail id is " + user.Email, user.Email);
                    history1.Token = code;
                    history1.CreatedOn = DateTime.Now;
                    history1.ExpireOn = ExpireDateTime;
                }

                await _dbContext.SaveChangesAsync();

                return history1;
            }
            catch (Exception ex)
            {
                //ErrorLog.AddErrorLog("SendResetLinkToMail/Exception :- ", ex.Message);
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<ActionResult<AuthTokenHistory>> ForgotPassword(ForgotPassword forgotPassword)
        {
            string[] decryptedArray = new string[3];
            AuthTokenHistory tokenHistoryResult = new AuthTokenHistory();

            try
            {
                string result = Decrypt(forgotPassword.Token, true);

                if (result.Contains('|') && result.Split('|').Length == 3)
                {
                    decryptedArray = result.Split('|');
                }
                else
                {
                    throw new Exception("Invalid token!");
                }

                if (decryptedArray.Length == 3)
                {
                    DateTime date = DateTime.Parse(decryptedArray[2].Replace('+', ' '));

                    if (DateTime.Now > date)
                    {
                        throw new Exception("Token Expired");
                    }

                    var DecryptedUserID = decryptedArray[0];

                    User user = await _dbContext.Users.FirstOrDefaultAsync(tb => tb.UserID.ToString() == DecryptedUserID && tb.IsActive);

                    if (user != null && user.EmployeeId == decryptedArray[1] && forgotPassword.UserID == user.UserID)
                    {
                        string DefaultPassword = Decrypt(user.Password, true);

                        AuthTokenHistory history = await _dbContext.AuthTokenHistories.FirstOrDefaultAsync(x => x.UserID == user.UserID && !x.IsUsed && x.Token == forgotPassword.Token);

                        if (history != null)
                        {
                            if (forgotPassword.NewPassword == DefaultPassword || user.Pass1 != null && Decrypt(user.Pass1, true) == forgotPassword.NewPassword || user.Pass2 != null && Decrypt(user.Pass2, true) == forgotPassword.NewPassword ||
                                user.Pass3 != null && Decrypt(user.Pass3, true) == forgotPassword.NewPassword || user.Pass4 != null && Decrypt(user.Pass4, true) == forgotPassword.NewPassword || user.Pass5 != null && Decrypt(user.Pass5, true) == forgotPassword.NewPassword)
                            {
                                throw new Exception("Password should not be same as previous 5 passwords");
                            }
                            else
                            {
                                var index = user.LastChangedPassword;
                                var lastchangedIndex = 0;
                                var previousPWD = user.Password;

                                if (!string.IsNullOrEmpty(index))
                                {
                                    if (user.Pass1 != null && index.Contains("user.Pass1"))
                                    {
                                        lastchangedIndex = 2;
                                    }
                                    else if (user.Pass2 != null && index.Contains("user.Pass2"))
                                    {
                                        lastchangedIndex = 3;
                                    }
                                    else if (user.Pass3 != null && index.Contains("user.Pass3"))
                                    {
                                        lastchangedIndex = 4;
                                    }
                                    else if (user.Pass4 != null && index.Contains("user.Pass4"))
                                    {
                                        lastchangedIndex = 5;
                                    }
                                    else if (user.Pass5 != null && index.Contains("user.Pass5"))
                                    {
                                        lastchangedIndex = 1;
                                    }
                                }

                                if (lastchangedIndex <= 0)
                                {
                                    lastchangedIndex = 1;
                                }

                                if (lastchangedIndex == 1)
                                {
                                    user.Pass1 = previousPWD;
                                }
                                else if (lastchangedIndex == 2)
                                {
                                    user.Pass2 = previousPWD;
                                }
                                else if (lastchangedIndex == 3)
                                {
                                    user.Pass3 = previousPWD;
                                }
                                else if (lastchangedIndex == 4)
                                {
                                    user.Pass4 = previousPWD;
                                }
                                else if (lastchangedIndex == 5)
                                {
                                    user.Pass5 = previousPWD;
                                }

                                user.LastChangedPassword = lastchangedIndex.ToString();
                                user.Password = Encrypt(forgotPassword.NewPassword.Replace(" ", ""), true);
                                user.IsActive = true;
                                user.ModifiedOn = DateTime.Now;
                                user.ExpiryDate = DateTime.Now.AddDays(90);

                                await _dbContext.SaveChangesAsync();

                                history.UsedOn = DateTime.Now;
                                history.IsUsed = true;
                                history.Comment = "Token Used successfully";
                                Log.DataLog(user.UserID.ToString(), $"User id {user.UserID} Password changed successfully ", "Change Password");
                                await _dbContext.SaveChangesAsync();

                                tokenHistoryResult = history;

                                return tokenHistoryResult;
                            }
                        }
                        else
                        {
                            throw new Exception("Token Might have Already Used!");
                        }
                    }
                    else
                    {
                        throw new Exception("Requesting User Not Exist");
                    }
                }
            }
            catch (Exception ex)
            {
                //ErrorLog.AddErrorLog("Master/ForgotPassword : - ", ex.Message);
                throw new Exception(ex.Message ?? "Network error");
            }
            throw new Exception("Invalid Token");
        }

        #endregion


        #region LogsAdditionCode

        private void UserLog(string? username, string status)
        {
            string logEntry = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} -{username} - {status}";
            string logFilePath = Path.Combine("Logs", "AuthMaster.log.txt");
            if (!Directory.Exists(Path.GetDirectoryName(logFilePath)))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(logFilePath));
            }
            try
            {
                using (StreamWriter writer = System.IO.File.AppendText("Logs/AuthMaster.log.txt"))
                {
                    writer.WriteLine(logEntry);
                }
            }
            catch (Exception ex)
            {
               // UserErrorLog("Users Data Not Found");
                // Handle potential exceptions during file access (optional)
                Console.WriteLine($"UserLog: {ex.Message}");
            }
        }
        private void UserErrorLog(string status)
        {
            string logEntry = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} -  {status}";
            try
            {
                string logFilePath = Path.Combine("Logs", "AuthMasterError.log.txt");
                if (!Directory.Exists(Path.GetDirectoryName(logFilePath)))
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(logFilePath));
                }
                using (StreamWriter writer = System.IO.File.AppendText("Logs/AuthMasterError.log.txt"))
                {
                    writer.WriteLine(logEntry);
                }
            }
            catch (Exception ex)
            {
                // Handle potential exceptions during file access (optional)
                Console.WriteLine($"Error logging login attempt: {ex.Message}");
            }
        }


        public List<Userlog> GetUsersCLog()
        {
            List<Userlog> loginLogs = new List<Userlog>();
            try
            {
                string logFilePath = Path.Combine("Logs", "AuthMaster.log.txt");
                if (!Directory.Exists(Path.GetDirectoryName(logFilePath)))
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(logFilePath));
                }
                using (StreamReader reader = System.IO.File.OpenText("Logs/AuthMaster.log.txt"))
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
                // Handle potential exceptions during file access (optional)
                Console.WriteLine($"Error reading login log: {ex.Message}");
            }
            return loginLogs;
        }

        public List<ErrorLogEntry> GetAuthMasterErrorLog()
        {
            List<ErrorLogEntry> loginLogs = new List<ErrorLogEntry>();
            try
            {
                string logFilePath = Path.Combine("Logs", "AuthMasterError.log.txt");
                if (!Directory.Exists(Path.GetDirectoryName(logFilePath)))
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(logFilePath));
                }
                using (StreamReader reader = System.IO.File.OpenText("Logs/AuthMasterError.log.txt"))
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

            }
            return loginLogs;
        }


        private Userlog ParseLogEntry(string logLine)
        {
            string[] parts = logLine.Split('-');
            if (parts.Length != 5)
            {
                return null;
            }

            int year = int.Parse(parts[0].Trim());
            int month = int.Parse(parts[1].Trim());
            int day = int.Parse(parts[2].Trim().Split(' ')[0]);
            string time = parts[2].Trim().Split(' ')[1];
            string username = parts[3].Trim();
            string assetlog = parts[4].Trim();
            DateTime timestamp = DateTime.Parse($"{year}-{month}-{day} {time}");
            return new Userlog(timestamp, username, assetlog);
        }


        public class Userlog
        {
            public DateTime Timestamp { get; set; }
            public string Username { get; set; }
            public string Status { get; set; }

            public Userlog(DateTime timestamp, string username, string status)
            {
                Timestamp = timestamp;
                Username = username;
                Status = status;
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

        #endregion
    }
}

