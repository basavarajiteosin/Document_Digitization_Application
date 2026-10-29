using DDAAPI.DbContexts;
using DDAAPI.Services;
using DDAAPI.Controllers;
using DDAAPI.Services;
using DDAAPI.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using OfficeOpenXml;
using System.Text;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
var provider = builder.Services.BuildServiceProvider();
var configuration = provider.GetRequiredService<IConfiguration>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<AuthMasterServices>();
builder.Services.AddScoped<EmailConfigurationService>();
builder.Services.AddScoped<SMSService>();
builder.Services.AddScoped<FieldMasterServices>();
builder.Services.AddScoped<PdfValidationService>();
builder.Services.AddScoped<FolderService>();
builder.Services.AddScoped<GlobalAdminController>();
builder.Services.AddScoped<FolderDataController>();
builder.Services.AddScoped<IGlobalAdminService, GlobalAdminService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddHttpClient();
// Using this for MSSQL
builder.Services.AddDbContext<AppDbContext>(item => item.UseSqlServer(configuration.GetConnectionString("myconn")));


// ════════════════════════════════════════════════════════════════════════
// Authentication — JWT  (your existing config preserved exactly)
// ════════════════════════════════════════════════════════════════════════
var key = Encoding.ASCII.GetBytes(
    configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key is missing from configuration."));

builder.Services.AddSingleton<IConfigurationManager<OpenIdConnectConfiguration>>(sp =>
{
    var authority = configuration["AzureAd:Authority"];
    return new ConfigurationManager<OpenIdConnectConfiguration>(
        $"{authority}/v2.0/.well-known/openid-configuration",
        new OpenIdConnectConfigurationRetriever());
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidIssuer = configuration["Jwt:Issuer"],
            ValidAudience = configuration["Jwt:Audience"],
            ClockSkew = TimeSpan.Zero
        };
    });


//builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddControllers().AddNewtonsoftJson();

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 2147483647; // 4 GB
});

// Kestrel configuration (still needed even when behind IIS)
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MaxRequestBodySize = 2147483647; // 4 GB
});
ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
var app = builder.Build();

Timer updatetimer = new Timer(updateviewstatus, app, TimeSpan.Zero, TimeSpan.FromHours(1));

// Get project root
var projectRoot = app.Environment.ContentRootPath;

// Folder paths
var profileAttachmentsPath = Path.Combine(projectRoot, "ProfileAttachments");
var folderDirectoryPath = Path.Combine(projectRoot, "FolderDirectory");

// Create folders if they don't exist
Directory.CreateDirectory(profileAttachmentsPath);
Directory.CreateDirectory(folderDirectoryPath);

// Create providers
var profileAttachmentsProvider = new PhysicalFileProvider(profileAttachmentsPath);
var folderDirectoryProvider = new PhysicalFileProvider(folderDirectoryPath);

// Combine providers
var compositeProvider = new CompositeFileProvider(
    profileAttachmentsProvider,
    folderDirectoryProvider);

// Serve static files
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = compositeProvider,
    RequestPath = "/StaticFiles",

    OnPrepareResponse = ctx =>
    {
        // For development, "*" is fine. 
        // For production, change "*" to your actual frontend domain, e.g., "https://my-react-app.com"
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Methods", "GET, OPTIONS");
    }
});

app.UseRouting();


if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}

app.UseCors(policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
app.UseAuthentication(); // Ensure authentication is used
app.UseAuthorization();

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.MapControllers();

app.Run();

static async void updateviewstatus(object state)
{
    var app = (WebApplication)state;

    using (var scope = app.Services.CreateScope())
    {
        var serviceProvider = scope.ServiceProvider;

        var course = serviceProvider.GetRequiredService<FolderDataController>();

        await course.UpdateIsViewStatus();
    }
}
