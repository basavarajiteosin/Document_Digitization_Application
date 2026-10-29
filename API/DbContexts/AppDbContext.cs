using System;
using DDAAPI.Models;
using DDAAPI.Models;
using DDAAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace DDAAPI.DbContexts
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Client> Clients { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<UserRoleMap> UserRoleMaps { get; set; }
        public DbSet<App> Apps { get; set; }
        public DbSet<RoleAppMap> RoleAppMaps { get; set; }
        public DbSet<UserLoginHistory> UserLoginHistory { get; set; }
        public DbSet<AuthTokenHistory> AuthTokenHistories { get; set; }
        public DbSet<EmailConfiguration> EmailConfiguration { get; set; }
        public DbSet<otpConfiguration> otpConfiguration { get; set; }
        public DbSet<PasswordResetOtpHistory> PasswordResetOtpHistorys { get; set; }
        public DbSet<EmpInfo> EmpInfos { get; set; }
        public DbSet<MailBodyConfiguration> MailBodyConfigurations { get; set; }
        public DbSet<NewsAndNotification> NewsAndNotifications { get; set; }
        public DbSet<DivisionMaster> DivisionMaster { get; set; }
        public DbSet<EmailDomainMaster> EmailDomainMaster { get; set; }
        public DbSet<AccessTypeMaster> AccessTypeMaster { get; set; }
        public DbSet<ActionMaster> ActionMaster { get; set; }
        public DbSet<DocExtMaster> DocExtMaster { get; set; }
        public DbSet<GroupMaster> GroupMaster { get; set; }
        public DbSet<FolderData> FolderData { get; set; }
        public DbSet<ShareDocAccess> ShareDocAccess { get; set; }
        public DbSet<ExternalShareAccessHistory> ExternalShareAccessHistory { get; set; }
        public DbSet<FileData> FileData { get; set; }
        //public DbSet<FolderOrFileData> FolderOrFileData { get; set; }
        public DbSet<TokenVerifyOtpHistory> TokenVerifyOtpHistory { get; set; }
        //08072025
        public DbSet<UserStorage> UserStorage { get; set; }

        public DbSet<MFAUserOtpHistory> MFAUserOtpHistory { get; set; }

        // ==========================================================
        // NEW (this change) - see FolderClasses.cs for entity shapes,
        // ReportService.cs for how they're read/written, and
        // FolderService.cs for the write points hooked into existing flows.
        // ==========================================================
        public DbSet<FolderAccessLog> FolderAccessLog { get; set; }
        public DbSet<FolderVersion> FolderVersion { get; set; }
        public DbSet<OwnershipAccessHistory> OwnershipAccessHistory { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<RoleAppMap>(
           build =>
           {
               build.HasKey(t => new { t.RoleID, t.AppID });
           });
            modelBuilder.Entity<UserRoleMap>(
            build =>
            {
                build.HasKey(t => new { t.UserID, t.RoleID });
            });

            // Helpful indexes for the new reporting/versioning tables (report & history
            // endpoints filter/group by these columns).
            modelBuilder.Entity<FolderAccessLog>(build =>
            {
                build.HasIndex(t => t.AccessedByUserId);
                build.HasIndex(t => new { t.FolderOrFileId, t.DocType });
            });

            modelBuilder.Entity<FolderVersion>(build =>
            {
                build.HasIndex(t => t.FolderId);
            });

            modelBuilder.Entity<OwnershipAccessHistory>(build =>
            {
                build.HasIndex(t => new { t.FolderOrFileId, t.DocType });
            });

        }
    }
}