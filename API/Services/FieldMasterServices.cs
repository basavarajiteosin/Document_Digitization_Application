using DDAAPI.DbContexts;
using DDAAPI.Services;
using DDAAPI.Services;
using DDAAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace DDAAPI.Services
{
    public class FieldMasterServices
    {
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _dbContext;
        private readonly EmailService _emailService;

        public FieldMasterServices(IConfiguration configuration, AppDbContext dbContext, EmailService emailService)
        {
            _configuration = configuration;
            _dbContext = dbContext;
            _emailService = emailService ?? throw new ArgumentNullException(nameof(emailService));
        }

        #region  DivisionServices

        public async Task<List<DivisionMaster>> GetAllDivisionMaster()
        {
            try
            {
                return await _dbContext.DivisionMaster.ToListAsync();
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Issue");
            }
        }

        public async Task<DivisionMaster> GetDivisionMasterById(int id)
        {
            try
            {
                var technology = await _dbContext.DivisionMaster.FindAsync(id);
                if (technology == null)
                {
                    throw new Exception("DivisionMaster not found!");
                }

                return technology;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<DivisionMaster> CreateDivisionMaster(DivisionMaster divisionMaster)
        {
            try
            {
                var existingDivisionMaster = await _dbContext.DivisionMaster.FirstOrDefaultAsync(t => t.Description == divisionMaster.Description);
                if (existingDivisionMaster != null)
                {
                    throw new Exception("DivisionMaster already exists!");
                }
                Log.DataLog("Admin", $"Admin successfully created DivisionMaster with description: {divisionMaster.Description}", "DivisionMaster Log");
                _dbContext.DivisionMaster.Add(divisionMaster);
                await _dbContext.SaveChangesAsync();

                return divisionMaster;
            }
            catch (Exception ex)
            {
                Log.Error("Admin", $"Admin : Error creating DivisionMaster - {ex.Message}", "DivisionMaster  Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<DivisionMaster> UpdateDivisionMaster(DivisionMaster divisionMaster)
        {
            try
            {
                var existingDivisionMaster = await _dbContext.DivisionMaster.FindAsync(divisionMaster.DivisionId);
                if (existingDivisionMaster == null)
                {
                    throw new Exception("DivisionMaster not found!");
                }
                if(existingDivisionMaster.Description != divisionMaster.Description)
                {
                    Log.DataLog("Admin", $"Admin successfully Update existing DivisionMaster  description: {existingDivisionMaster.Description} to {divisionMaster.Description}", "DivisionMaster Log");

                }

                existingDivisionMaster.Description = divisionMaster.Description;


                await _dbContext.SaveChangesAsync();

                return divisionMaster;
            }
            catch (Exception ex)
            {
                Log.Error("Admin", $"Admin : Error While updating  DivisionMaster id {divisionMaster.DivisionId} - {ex.Message}", "DivisionMaster Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<DivisionMaster> DeleteDivisionMaster(int id)
        {
            try
            {
                var existingDivisionMaster = await _dbContext.DivisionMaster.FindAsync(id);
                if (existingDivisionMaster == null)
                {
                    throw new Exception("DivisionMaster not found!");
                }
                Log.DataLog("System", $"DivisionMaster ID {id} deleted successfully ", "DivisionMaster Log");


                _dbContext.DivisionMaster.Remove(existingDivisionMaster);
                await _dbContext.SaveChangesAsync();

                return existingDivisionMaster;
            }
            catch (Exception ex)
            {
                Log.Error("System", $"DeleteDivisionMaster failed for ID {id} : {ex.Message}", "DivisionMaster Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        #endregion


        #region EmailDomainDataServices

        public async Task<List<EmailDomainMaster>> GetAllEmailDomains()
        {
            try
            {
                return await _dbContext.EmailDomainMaster.ToListAsync();
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to retrieve email domains: " + ex.Message);
            }
        }

        public async Task<EmailDomainMaster> GetEmailDomainById(int id)
        {
            try
            {
                var emailDomain = await _dbContext.EmailDomainMaster.FindAsync(id);
                if (emailDomain == null)
                {
                    throw new Exception("EmailDomain not found!");
                }

                return emailDomain;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<EmailDomainMaster> CreateEmailDomain(EmailDomainMaster emailDomain)
        {
            try
            {
                var existingEmailDomain = await _dbContext.EmailDomainMaster.FirstOrDefaultAsync(d => d.Domain == emailDomain.Domain);
                if (existingEmailDomain != null)
                {
                    throw new Exception("EmailDomain already exists!");
                }
                Log.DataLog("Admin", $"Admin successfully created EmailDomain with domain: {emailDomain.Domain}", "EmailDomain Log");
                _dbContext.EmailDomainMaster.Add(emailDomain);
                await _dbContext.SaveChangesAsync();

                return emailDomain;
            }
            catch (Exception ex)
            {
                Log.Error("Admin", $"Admin : Error creating EmailDomain - {ex.Message}", "EmailDomain Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<EmailDomainMaster> UpdateEmailDomain(EmailDomainMaster emailDomain)
        {
            try
            {
                var existingEmailDomain = await _dbContext.EmailDomainMaster.FindAsync(emailDomain.EmailDomainId);
                if (existingEmailDomain == null)
                {
                    throw new Exception("EmailDomain not found!");
                }

                var existingEmailDomainName = await _dbContext.EmailDomainMaster.Where(e => e.EmailDomainId != emailDomain.EmailDomainId && e.Domain == emailDomain.Domain).FirstOrDefaultAsync();
                if (existingEmailDomainName != null)
                {
                    throw new Exception("Domain Already Exist!");
                }
                if(existingEmailDomain.Domain != emailDomain.Domain)
                {
                    Log.DataLog("Admin", $"Admin successfully Updated exisitng Email domain: {existingEmailDomain.Domain} to {emailDomain.Domain}", "EmailDomain Log");
                }
                existingEmailDomain.Domain = emailDomain.Domain;
                await _dbContext.SaveChangesAsync();

                return emailDomain;
            }
            catch (Exception ex)
            {
                Log.Error("Admin", $"Admin : Error Updating EmailDomain id {emailDomain.EmailDomainId} - {ex.Message}", "EmailDomain Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<EmailDomainMaster> DeleteEmailDomain(int id)
        {
            try
            {
                var existingEmailDomain = await _dbContext.EmailDomainMaster.FindAsync(id);
                if (existingEmailDomain == null)
                {
                    throw new Exception("EmailDomain not found!");
                }
                Log.DataLog("System", $"EmailDomain with ID {id} deleted successfully at {DateTime.Now}", "EmailDomain Log");
                _dbContext.EmailDomainMaster.Remove(existingEmailDomain);
                await _dbContext.SaveChangesAsync();

                return existingEmailDomain;
            }
            catch (Exception ex)
            {
                Log.Error("System", $"Deleting EmailDomain failed for ID {id} : {ex.Message}", "EmailDomain Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        #endregion


        #region AccessTypeMasterDataServices

        public async Task<List<AccessTypeMaster>> GetAllAccessTypeMaster()
        {
            try
            {
                return await _dbContext.AccessTypeMaster.ToListAsync();
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<AccessTypeMaster> GetAccessTypeMasterById(int id)
        {
            try
            {
                var accessMaster = await _dbContext.AccessTypeMaster.FindAsync(id);
                if (accessMaster == null)
                {
                    throw new Exception("AccessType Master not found!");
                }

                return accessMaster;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<AccessTypeMaster> CreateAccessTypeMaster(AccessTypeMaster accessMaster)
        {
            try
            {
                var existingAccessTypeMaster = await _dbContext.AccessTypeMaster.FirstOrDefaultAsync(d => d.AccessDec == accessMaster.AccessDec);
                if (existingAccessTypeMaster != null)
                {
                    throw new Exception("AccessType Master already exists!");
                }
                Log.DataLog("Admin", $"Admin successfully created AccessTypeMaster with description: {accessMaster.AccessDec}", "AccessTypeMaster Log");
                _dbContext.AccessTypeMaster.Add(accessMaster);
                await _dbContext.SaveChangesAsync();

                return accessMaster;
            }
            catch (Exception ex)
            {
                Log.Error("Admin", $"Admin : Error creating AccessTypeMaster - {ex.Message}", "Create AccessTypeMaster Error Log");

                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<AccessTypeMaster> UpdateAccessTypeMaster(AccessTypeMaster accessMaster)
        {
            try
            {
                var existingAccessTypeMaster = await _dbContext.AccessTypeMaster.FindAsync(accessMaster.AccessId);
                if (existingAccessTypeMaster == null)
                {
                    throw new Exception("AccessType Master not found!");
                }

                var existingAccessTypeMasterWithSameName = await _dbContext.AccessTypeMaster.FirstOrDefaultAsync(e => e.AccessId != accessMaster.AccessId  && e.AccessDec == accessMaster.AccessDec);
                if (existingAccessTypeMasterWithSameName != null)
                {
                    throw new Exception("Another AccessType Master with the same name already exists!");
                }
                if (existingAccessTypeMaster.AccessDec != accessMaster.AccessDec)
                {
                    Log.DataLog("System", $"AccessTypeMaster with ID {accessMaster.AccessId} updated successfully at {DateTime.Now}", "AccessTypeMaster Log");
                }
                existingAccessTypeMaster.AccessDec = accessMaster.AccessDec;
                await _dbContext.SaveChangesAsync();

                return accessMaster;
            }
            catch (Exception ex)
            {
                Log.Error("System", $"UpdateAccessTypeMaster failed for ID {accessMaster.AccessId}: {ex.Message}", "AccessTypeMaster Error Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<AccessTypeMaster> DeleteAccessTypeMaster(int id)
        {
            try
            {
                var existingAccessTypeMaster = await _dbContext.AccessTypeMaster.FindAsync(id);
                if (existingAccessTypeMaster == null)
                {
                    throw new Exception("AccessType Master not found!");
                }
                Log.DataLog("System", $"AccessTypeMaster data ID {id} deleted successfully at {DateTime.Now}", "AccessTypeMaster Log");
                _dbContext.AccessTypeMaster.Remove(existingAccessTypeMaster);
                await _dbContext.SaveChangesAsync();

                return existingAccessTypeMaster;
            }
            catch (Exception ex)
            {
                Log.Error("System", $"DeleteAccessTypeMaster failed for ID {id}: {ex.Message}", "AccessTypeMaster Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        #endregion


        #region  ActionMaster

        public async Task<List<ActionMaster>> GetAllActionMasters()
        {
            try
            {
                return await _dbContext.ActionMaster.ToListAsync();
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message);
            }
        }

        public async Task<ActionMaster> GetActionMasterById(int id)
        {
            try
            {
                var actionMaster = await _dbContext.ActionMaster.FindAsync(id);
                if (actionMaster == null)
                {
                    throw new Exception("ActionMaster not found!");
                }

                return actionMaster;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<ActionMaster> CreateActionMaster(ActionMaster actionMaster)
        {
            try
            {
                var existingActionMaster = await _dbContext.ActionMaster.FirstOrDefaultAsync(i => i.ActionDesc == actionMaster.ActionDesc);
                if (existingActionMaster != null)
                {
                    throw new Exception("ActionMaster already exists!");
                }
                Log.DataLog("Admin", $"Admin successfully created ActionMaster with description: {actionMaster.ActionDesc}", "ActionMaster Log");
                _dbContext.ActionMaster.Add(actionMaster);
                await _dbContext.SaveChangesAsync();

                return actionMaster;
            }
            catch (Exception ex)
            {
                Log.Error("Admin", $"Admin : Error creating ActionMaster - {ex.Message}", "ActionMaster Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<ActionMaster> UpdateActionMaster(ActionMaster actionMaster)
        {
            try
            {
                var existingActionMaster = await _dbContext.ActionMaster.FindAsync(actionMaster.AId);
                if (existingActionMaster == null)
                {
                    throw new Exception("ActionMaster not found!");
                }

                var existingActionMasterDesc = await _dbContext.ActionMaster.Where(i => i.AId != actionMaster.AId && i.ActionDesc == actionMaster.ActionDesc).FirstOrDefaultAsync();
                if (existingActionMasterDesc != null)
                {
                    throw new Exception("ActionDesc already exists!");
                }
                if (existingActionMaster.ActionDesc != actionMaster.ActionDesc)
                {
                    Log.DataLog("Admin", $"ActionMaster with ID {actionMaster.AId} of existing description {existingActionMaster.ActionDesc} to {actionMaster.ActionDesc} updated successfully ", "ActionMaster Log");
                }
                existingActionMaster.ActionDesc = actionMaster.ActionDesc;
                await _dbContext.SaveChangesAsync();

                return actionMaster;
            }
            catch (Exception ex)
            {
                Log.Error("System", $"UpdateActionMaster failed for ID {actionMaster.AId}: {ex.Message}", "ActionMaster Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<ActionMaster> DeleteActionMaster(int id)
        {
            try
            {
                var existingActionMaster = await _dbContext.ActionMaster.FindAsync(id);
                if (existingActionMaster == null)
                {
                    throw new Exception("ActionMaster not found!");
                }
                Log.DataLog("Admin", $"ActionMaster with ID {id} deleted successfully", "ActionMaster Log");

                _dbContext.ActionMaster.Remove(existingActionMaster);
                await _dbContext.SaveChangesAsync();

                return existingActionMaster;
            }
            catch (Exception ex)
            {
                Log.Error("Syatem", $"DeleteActionMaster failed for ID {id}: {ex.Message}", "ActionMaster Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        #endregion


        #region  DocExtMaster

        public async Task<List<DocExtMaster>> GetAllDocExts()
        {
            try
            {
                return await _dbContext.DocExtMaster.ToListAsync();
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<DocExtMaster> GetDocExtMasterById(int id)
        {
            try
            {
                var ext = await _dbContext.DocExtMaster.FindAsync(id);
                if (ext == null)
                {
                    throw new Exception("DocExt not found!");
                }

                return ext;
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<DocExtMaster> CreateDocExtMaster(DocExtMaster docext)
        {
            try
            {
                var existingDocExtMaster = await _dbContext.DocExtMaster.FirstOrDefaultAsync(c => c.ExtType == docext.ExtType);
                if (existingDocExtMaster != null)
                {
                    throw new Exception("DocExt already exists!");
                }
                Log.DataLog("Admin", $"Admin successfully created DocExtMaster with extension type: {docext.ExtType}", "DocExtMaster Log");
                _dbContext.DocExtMaster.Add(docext);
                await _dbContext.SaveChangesAsync();

                return docext;
            }
            catch (Exception ex)
            {
                Log.Error("Admin", $"Admin : Error creating DocExtMaster - {ex.Message}", "DocExtMaster Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<DocExtMaster> UpdateDocExtMaster(DocExtMaster docext)
        {
            try
            {
                var existingDocExtMaster = await _dbContext.DocExtMaster.FindAsync(docext.DEId);
                if (existingDocExtMaster == null)
                {
                    throw new Exception("DocExtMaster not found!");
                }
                if (existingDocExtMaster.ExtType != docext.ExtType)
                {
                    Log.DataLog("Admin", $"DocExtMaster with ID {docext.DEId} updated successfully at {DateTime.Now}", "DocExtMaster Log");
                }
                var existingDocExt = await _dbContext.DocExtMaster.Where(c => c.DEId != docext.DEId && c.ExtType == docext.ExtType).FirstOrDefaultAsync();
                if (existingDocExt != null)
                {
                    throw new Exception("DocExt already exists!");
                }

                existingDocExtMaster.ExtType = docext.ExtType;
                await _dbContext.SaveChangesAsync();

                return docext;
            }
            catch (Exception ex)
            {
                Log.Error("System", $"UpdateDocExtMaster failed for ID {docext.DEId}: {ex.Message}", "DocExtMaster Error Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<DocExtMaster> DeleteDocExtMaster(int id)
        {
            try
            {
                var existingDocExtMaster = await _dbContext.DocExtMaster.FindAsync(id);
                if (existingDocExtMaster == null)
                {
                    throw new Exception("DocExtMaster not found!");
                }

                Log.DataLog("Admin", $"DocExtMaster with ID {id} deleted successfully at {DateTime.Now}", "DocExtMaster Log");

                _dbContext.DocExtMaster.Remove(existingDocExtMaster);
                await _dbContext.SaveChangesAsync();

                return existingDocExtMaster;
            }
            catch (Exception ex)
            {
                Log.Error("System", $"DeleteDocExtMaster failed for ID {id}: {ex.Message}", "DocExtMaster Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        #endregion



        #region GroupMaster (Cohort Master)

        // NEW: helper to turn a stored comma-separated GroupUserIds string back into
        // a clean List<string> for the response (skips empty entries, trims whitespace).
        private static List<string> ParseGroupUserIds(string? groupUserIds)
        {
            if (string.IsNullOrWhiteSpace(groupUserIds))
            {
                return new List<string>();
            }

            return groupUserIds
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();
        }

        private static GroupMasterViewDTO ToGroupMasterViewDTO(GroupMaster group)
        {
            return new GroupMasterViewDTO
            {
                GMId = group.GMId,
                GroupName = group.GroupName,
                TagName = group.TagName,
                UserIds = ParseGroupUserIds(group.GroupUserIds),
                IsActive = group.IsActive,
                CreatedOn = group.CreatedOn,
                CreatedBy = group.CreatedBy,
                ModifiedOn = group.ModifiedOn,
                ModifiedBy = group.ModifiedBy
            };
        }

        // Full listing (active + inactive) - used to populate the mapped table with
        // its Edit/Delete actions, so deactivated groups are still visible to admins.
        public async Task<List<GroupMasterViewDTO>> GetAllGroupMasters()
        {
            try
            {
                var groups = await _dbContext.GroupMaster.AsNoTracking()
                    .OrderByDescending(g => g.CreatedOn)
                    .ToListAsync();

                return groups.Select(ToGroupMasterViewDTO).ToList();
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        // Active-only listing - used wherever a group/cohort needs to be picked
        // elsewhere in the app (e.g. a "share with cohort" dropdown).
        public async Task<List<GroupMasterViewDTO>> GetActiveGroupMasters()
        {
            try
            {
                var groups = await _dbContext.GroupMaster.AsNoTracking()
                    .Where(g => g.IsActive)
                    .OrderBy(g => g.GroupName)
                    .ToListAsync();

                return groups.Select(ToGroupMasterViewDTO).ToList();
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<GroupMasterViewDTO> GetGroupMasterById(int id)
        {
            try
            {
                var group = await _dbContext.GroupMaster.AsNoTracking()
                    .FirstOrDefaultAsync(g => g.GMId == id);

                if (group == null)
                {
                    throw new Exception("GroupMaster not found!");
                }

                return ToGroupMasterViewDTO(group);
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<GroupMasterViewDTO> CreateGroupMaster(GroupMasterCreateDTO input)
        {
            try
            {
                var existingGroup = await _dbContext.GroupMaster
                    .FirstOrDefaultAsync(g => g.GroupName == input.GroupName);
                if (existingGroup != null)
                {
                    throw new Exception("Group already exists!");
                }

                var group = new GroupMaster
                {
                    GroupName = input.GroupName,
                    TagName = input.TagName,
                    GroupUserIds = input.UserIds != null && input.UserIds.Any()
                        ? string.Join(",", input.UserIds)
                        : null,
                    IsActive = true,
                    CreatedOn = DateTime.Now,
                    CreatedBy = input.CreatedBy
                };

                Log.DataLog(input?.CreatedBy, $"{input.CreatedBy} successfully created Group '{group.GroupName}' with {input.UserIds?.Count ?? 0} user(s)", "GroupMaster Log");

                _dbContext.GroupMaster.Add(group);
                await _dbContext.SaveChangesAsync();

                return ToGroupMasterViewDTO(group);
            }
            catch (Exception ex)
            {
                Log.Error(input?.CreatedBy, $"{input?.CreatedBy} : Error creating Group '{input?.GroupName}' - {ex.Message}", "GroupMaster Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        public async Task<GroupMasterViewDTO> UpdateGroupMaster(GroupMasterUpdateDTO input)
        {
            try
            {
                var existingGroup = await _dbContext.GroupMaster.FindAsync(input.GMId);
                if (existingGroup == null)
                {
                    throw new Exception("GroupMaster not found!");
                }

                var duplicateName = await _dbContext.GroupMaster
                    .Where(g => g.GMId != input.GMId && g.GroupName == input.GroupName)
                    .FirstOrDefaultAsync();
                if (duplicateName != null)
                {
                    throw new Exception("Group name already exists!");
                }

                if (existingGroup.GroupName != input.GroupName)
                {
                    Log.DataLog(input?.ModifiedBy, $"{input.ModifiedBy} successfully updated Group name '{existingGroup.GroupName}' to '{input.GroupName}'", "GroupMaster Log");
                }

                existingGroup.GroupName = input.GroupName;
                existingGroup.TagName = input.TagName;
                existingGroup.GroupUserIds = input.UserIds != null && input.UserIds.Any()
                    ? string.Join(",", input.UserIds)
                    : null;
                existingGroup.IsActive = input.IsActive;
                existingGroup.ModifiedOn = DateTime.Now;
                existingGroup.ModifiedBy = input.ModifiedBy;

                await _dbContext.SaveChangesAsync();

                return ToGroupMasterViewDTO(existingGroup);
            }
            catch (Exception ex)
            {
                Log.Error(input?.ModifiedBy, $"{input?.ModifiedBy} : Error updating Group ID {input?.GMId} - {ex.Message}", "GroupMaster Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        // Soft delete (deactivate) rather than a hard remove - GroupMaster carries
        // IsActive/audit columns and "Get Active Groups" is one of the required
        // endpoints, so a deactivated group stays visible in the mapped table/history
        // but drops out of the active list used elsewhere for cohort selection.
        // Swap this for a real _dbContext.GroupMaster.Remove(...) if a hard delete
        // is what's actually wanted instead.
        public async Task<GroupMasterViewDTO> DeleteGroupMaster(int id, string? deletedBy = null)
        {
            try
            {
                var existingGroup = await _dbContext.GroupMaster.FindAsync(id);
                if (existingGroup == null)
                {
                    throw new Exception("GroupMaster not found!");
                }

                existingGroup.IsActive = false;
                existingGroup.ModifiedOn = DateTime.Now;
                existingGroup.ModifiedBy = deletedBy;

                Log.DataLog(deletedBy, $"Group '{existingGroup.GroupName}' (ID {id}) deactivated successfully", "GroupMaster Log");

                await _dbContext.SaveChangesAsync();

                return ToGroupMasterViewDTO(existingGroup);
            }
            catch (Exception ex)
            {
                Log.Error(deletedBy, $"DeleteGroupMaster failed for ID {id}: {ex.Message}", "GroupMaster Log");
                throw new Exception(ex.Message ?? "Network Error");
            }
        }

        #endregion
    }
}
