using System;
using DDAAPI.DbContexts;
using DDAAPI.Models;
using Microsoft.EntityFrameworkCore;
using static System.Net.WebRequestMethods;

namespace DDAAPI.Services
{
	public class SMSService
	{

        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly AppDbContext _dbContext;
        public SMSService(IConfiguration configuration, IHttpClientFactory httpClientFactory, AppDbContext dbContext)
        {
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
            _dbContext = dbContext;
        }

        public async Task<string> GenerateAndSendOTP(string phoneNumber)
        {
            // Generate the OTP using your desired logic
            Random random = new Random();
            string genarateOtp = random.Next(100000, 999999).ToString();
            if (genarateOtp != "")
            {
                var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.ContactNumber == phoneNumber);
                if (user != null)
                {
                    DateTime expiryTime = DateTime.Now.AddMinutes(10);
                    // Save OTP details to the database
                    var passwordReset = new PasswordResetOtpHistory
                    {
                        MobileNo = phoneNumber,
                        OTP = genarateOtp,
                        OTPIsActive = true,
                        CreatedOn = DateTime.Now,
                        ExpiryOn = expiryTime,
                        CreatedBy = user.ContactNumber
                    };
                    var result = _dbContext.PasswordResetOtpHistorys.Add(passwordReset);
                    _dbContext.SaveChanges();
                }
              
            }

            // end generate otp logic
            if (genarateOtp != null)
            {
                var otpconfigue = _dbContext.otpConfiguration.ToList();
                var method = "";
                var message = "";
                var msgType = "";
                var userId = "";
                var authScheme = "";
                var Password = "";
                var versn = "";
                var Format = "";
                foreach (var configu in otpconfigue)
                {
                    method = configu.method;
                    message = configu.msg;
                    msgType = configu.msg_type;
                    userId = configu.userid;
                    authScheme = configu.auth_scheme;
                    Password = configu.password;
                    versn = configu.v;
                    Format = configu.format;
                }

                var apiUrl = "https://enterprise.smsgupshup.com/GatewayAPI/rest"; // Replace with the SMS GupShup API URL

                var requestUrl = $"{apiUrl}?method={method}&send_to={phoneNumber}&msg={genarateOtp} {message}&msg_type={msgType}" +
                    $"&userid={userId}&auth_scheme={authScheme}&password={Password}&v={versn}&format={Format}";
                var URL = requestUrl.Replace('"', ' ').Trim();
                var httpClient = _httpClientFactory.CreateClient();
                //var request = new HttpRequestMessage(HttpMethod.Get, URL);
                //var response = await httpClient.SendAsync(request);

                var response = await httpClient.GetAsync(requestUrl);

                if (response.IsSuccessStatusCode)
                {
                    return genarateOtp;
                }
            }
            // Handle the case when the OTP sending request fails
            // Throw an exception or return a default OTP value, etc.
            throw new Exception("Failed to send OTP");
        }

    }
}

