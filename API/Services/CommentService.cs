using DDAAPI.DbContexts;
using DDAAPI.Models;
using DDAAPI.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace DDAAPI.Services
{
    public class CollabForbiddenException : Exception
    {
        public CollabForbiddenException(string message) : base(message) { }
    }

    /// <summary>
    /// Comments (threaded, resolvable) and review requests (Approve / Request changes)
    /// on folders and documents. Access follows the same rules as SearchService:
    /// Global Admin = everything; others = items they created / are authorized for,
    /// plus anything actively shared with them (folders include their descendants).
    /// </summary>
    public class CommentService
    {
        private readonly AppDbContext _db;
        private readonly IHubContext<CollabHub> _hub;
        private readonly EmailService _email;
        private readonly IConfiguration _cfg;
        public CommentService(AppDbContext db, IHubContext<CollabHub> hub, EmailService email, IConfiguration cfg)
        { _db = db; _hub = hub; _email = email; _cfg = cfg; }
        private sealed class Actor
        {
            public Guid UserId;
            public string Uid = "";
            public string Name = "";
            public bool IsGA;
        }

        private static bool Eq(string? a, string b) => a != null && a.Equals(b, StringComparison.OrdinalIgnoreCase);

        private static string NormType(string? t)
        {
            if (string.Equals(t, "Folder", StringComparison.OrdinalIgnoreCase)) return "Folder";
            if (string.Equals(t, "Document", StringComparison.OrdinalIgnoreCase)) return "Document";
            throw new ArgumentException("DocType must be 'Folder' or 'Document'.");
        }

        // ------------------------------------------------------------ identity / access
        private async Task<Actor> BuildActorAsync(User user)
        {
            var role = await (from m in _db.UserRoleMaps
                              join r in _db.Roles on m.RoleID equals r.RoleID
                              where m.UserID == user.UserID && m.IsActive
                              select r.RoleName).FirstOrDefaultAsync();
            var emp = await _db.EmpInfos.AsNoTracking().FirstOrDefaultAsync(e => e.EmpId == user.UserID);
            var name = emp != null ? $"{emp.FirstName} {emp.LastName}".Trim() : (user.Email ?? "User");
            return new Actor { UserId = user.UserID, Uid = user.UserID.ToString().ToLower(), Name = name, IsGA = role == "Global Admin" };
        }

        private async Task<Actor> ResolveAsync(string? employeeId)
        {
            if (string.IsNullOrWhiteSpace(employeeId)) throw new UnauthorizedAccessException("Invalid session.");
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.EmployeeId == employeeId && u.IsActive);
            if (user == null) throw new UnauthorizedAccessException("User not found or inactive.");
            return await BuildActorAsync(user);
        }

        private async Task<bool> FolderAccessAsync(Actor a, int folderId)
        {
            var shared = await _db.ShareDocAccess.AsNoTracking()
                .Where(s => s.AccessUserId == a.UserId && s.IsActive && s.DocType == "Folder")
                .Select(s => s.FolderOrFileId).ToListAsync();

            var cur = folderId; var guard = 0;
            while (cur != 0 && guard++ < 25)
            {
                var n = await _db.FolderData.AsNoTracking().Where(x => x.FolderId == cur && x.IsActive)
                    .Select(x => new { x.ParentFolderId, x.CreatedBy, x.AuthorizedUserId, x.IsHide })
                    .FirstOrDefaultAsync();
                if (n == null || n.IsHide) return false;
                if (Eq(n.CreatedBy, a.Uid) || Eq(n.AuthorizedUserId, a.Uid) || shared.Contains(cur)) return true;
                cur = n.ParentFolderId ?? 0;
            }
            return false;
        }

        private async Task<bool> CanAccessAsync(Actor a, string docType, int id)
        {
            if (a.IsGA) return true;
            if (docType == "Folder") return await FolderAccessAsync(a, id);

            var f = await _db.FileData.AsNoTracking().FirstOrDefaultAsync(x => x.FileId == id && x.IsActive);
            if (f == null || f.IsHide) return false;
            if (Eq(f.CreatedBy, a.Uid)) return true;
            if (await _db.ShareDocAccess.AnyAsync(s => s.FolderOrFileId == id && s.DocType == "Document"
                                                      && s.AccessUserId == a.UserId && s.IsActive)) return true;
            return await FolderAccessAsync(a, f.FolderId);
        }

        private async Task<string?> ItemNameAsync(string docType, int id) =>
            docType == "Folder"
                ? await _db.FolderData.AsNoTracking().Where(f => f.FolderId == id).Select(f => f.FolderName).FirstOrDefaultAsync()
                : await _db.FileData.AsNoTracking().Where(f => f.FileId == id).Select(f => f.FileName).FirstOrDefaultAsync();

        private async Task EnsureAccessAsync(Actor a, string docType, int id)
        {
            if (await ItemNameAsync(docType, id) == null) throw new KeyNotFoundException("Item not found.");
            if (!await CanAccessAsync(a, docType, id)) throw new CollabForbiddenException("You do not have access to this item.");
        }

        private async Task<Dictionary<string, string>> NamesAsync(IEnumerable<string?> ids)
        {
            var guids = ids.Where(i => !string.IsNullOrWhiteSpace(i))
                           .Select(i => Guid.TryParse(i, out var g) ? g : (Guid?)null)
                           .Where(g => g.HasValue).Select(g => g!.Value).Distinct().ToList();
            var rows = await _db.EmpInfos.AsNoTracking().Where(e => guids.Contains(e.EmpId))
                .Select(e => new { e.EmpId, e.FirstName, e.LastName }).ToListAsync();
            return rows.ToDictionary(r => r.EmpId.ToString().ToLower(), r => $"{r.FirstName} {r.LastName}".Trim());
        }

        private static string NameOf(Dictionary<string, string> m, string? id) =>
            id != null && m.TryGetValue(id.ToLower(), out var n) ? n : "Unknown";

        // ------------------------------------------------------------ comments
        public async Task<List<CommentDTO>> GetCommentsAsync(string? emp, string? docType, int id)
        {
            var a = await ResolveAsync(emp); var t = NormType(docType);
            await EnsureAccessAsync(a, t, id);

            var rows = await _db.DocComments.AsNoTracking()
                .Where(c => c.FolderOrFileId == id && c.DocType == t)
                .OrderBy(c => c.CreatedOn).ToListAsync();
            var cids = rows.Select(r => r.CommentId).ToList();
            var ments = await _db.DocMentions.AsNoTracking().Where(m => cids.Contains(m.CommentId)).ToListAsync();
            var names = await NamesAsync(rows.SelectMany(r => new[] { r.CreatedBy, r.ResolvedBy })
                                            .Concat(ments.Select(m => (string?)m.MentionedUserId)));

            return rows.Select(c => new CommentDTO
            {
                CommentId = c.CommentId,
                ParentCommentId = c.ParentCommentId,
                CommentText = c.IsDeleted ? "This comment was deleted." : c.CommentText,
                CreatedBy = c.CreatedBy,
                CreatedByName = NameOf(names, c.CreatedBy),
                CreatedOn = c.CreatedOn,
                ModifiedOn = c.ModifiedOn,
                IsResolved = c.IsResolved,
                ResolvedByName = c.ResolvedBy == null ? null : NameOf(names, c.ResolvedBy),
                IsDeleted = c.IsDeleted,
                CanEdit = !c.IsDeleted && Eq(c.CreatedBy, a.Uid),
                CanDelete = !c.IsDeleted && (Eq(c.CreatedBy, a.Uid) || a.IsGA),
                Mentions = c.IsDeleted ? new List<MentionDTO>() : ments.Where(m => m.CommentId == c.CommentId)
                    .Select(m => new MentionDTO { UserId = m.MentionedUserId, Name = NameOf(names, m.MentionedUserId) }).ToList()
            }).ToList();
        }

        public async Task<int> AddCommentAsync(string? emp, AddCommentDTO dto)
        {
            var a = await ResolveAsync(emp); var t = NormType(dto.DocType);
            var text = (dto.CommentText ?? "").Trim();
            if (text.Length == 0) throw new ArgumentException("Comment cannot be empty.");
            if (text.Length > 2000) throw new ArgumentException("Comment cannot exceed 2000 characters.");
            await EnsureAccessAsync(a, t, dto.FolderOrFileId);

            int? parentId = null;
            if (dto.ParentCommentId.HasValue)
            {
                var p = await _db.DocComments.FirstOrDefaultAsync(c => c.CommentId == dto.ParentCommentId.Value
                            && c.FolderOrFileId == dto.FolderOrFileId && c.DocType == t)
                        ?? throw new KeyNotFoundException("Parent comment not found.");
                if (p.IsDeleted) throw new ArgumentException("Cannot reply to a deleted comment.");
                parentId = p.ParentCommentId ?? p.CommentId; // threads are one level deep
            }

            var entity = new DocComment
            {
                FolderOrFileId = dto.FolderOrFileId, DocType = t, ParentCommentId = parentId,
                CommentText = text, CreatedBy = a.Uid, CreatedOn = DateTime.Now
            };
            _db.DocComments.Add(entity);
            await _db.SaveChangesAsync();
            Log.DataLog(a.Uid, $"{a.Name} commented on {t} ID {dto.FolderOrFileId}", "Comments Log");
            var mentionIds = (dto.MentionedUserIds ?? new List<string>())
    .Select(s => Guid.TryParse(s, out var g) ? g.ToString().ToLower() : null)
    .Where(s => s != null && s != a.Uid).Select(s => s!).Distinct().ToList();
            if (mentionIds.Count > 0) await NotifyMentionsAsync(a, t, dto.FolderOrFileId, entity, mentionIds);
            if (t == "Document")
            {
                try
                {
                    await _hub.Clients.Group(CollabHub.Group(dto.FolderOrFileId))
                        .SendAsync("CommentsChanged", new { fileId = dto.FolderOrFileId, byUserId = a.Uid, byName = a.Name });
                }
                catch { }
            }
            return entity.CommentId;
        }

        public async Task<bool> EditCommentAsync(string? emp, EditCommentDTO dto)
        {
            var a = await ResolveAsync(emp);
            var c = await _db.DocComments.FirstOrDefaultAsync(x => x.CommentId == dto.CommentId)
                    ?? throw new KeyNotFoundException("Comment not found.");
            if (c.IsDeleted) throw new ArgumentException("Comment was deleted.");
            if (!Eq(c.CreatedBy, a.Uid)) throw new CollabForbiddenException("You can only edit your own comments.");
            var text = (dto.CommentText ?? "").Trim();
            if (text.Length == 0 || text.Length > 2000) throw new ArgumentException("Comment must be 1-2000 characters.");
            c.CommentText = text; c.ModifiedOn = DateTime.Now;
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteCommentAsync(string? emp, int commentId)
        {
            var a = await ResolveAsync(emp);
            var c = await _db.DocComments.FirstOrDefaultAsync(x => x.CommentId == commentId)
                    ?? throw new KeyNotFoundException("Comment not found.");
            if (!(a.IsGA || Eq(c.CreatedBy, a.Uid))) throw new CollabForbiddenException("You can only delete your own comments.");
            c.IsDeleted = true; c.ModifiedOn = DateTime.Now;
            await _db.SaveChangesAsync();
            Log.DataLog(a.Uid, $"{a.Name} deleted comment {commentId}", "Comments Log");
            return true;
        }

        public async Task<bool> ResolveCommentAsync(string? emp, ResolveCommentDTO dto)
        {
            var a = await ResolveAsync(emp);
            var c = await _db.DocComments.FirstOrDefaultAsync(x => x.CommentId == dto.CommentId)
                    ?? throw new KeyNotFoundException("Comment not found.");
            if (c.IsDeleted) throw new ArgumentException("Comment was deleted.");
            await EnsureAccessAsync(a, c.DocType, c.FolderOrFileId);
            c.IsResolved = dto.IsResolved;
            c.ResolvedBy = dto.IsResolved ? a.Uid : null;
            c.ResolvedOn = dto.IsResolved ? DateTime.Now : null;
            await _db.SaveChangesAsync();
            return true;
        }

        // ------------------------------------------------------------ reviews
        private async Task<List<ReviewDTO>> MapReviewsAsync(List<DocReview> rows, Actor a)
        {
            var names = await NamesAsync(rows.SelectMany(r => new[] { r.RequestedBy, r.ReviewerId }));
            var folderIds = rows.Where(r => r.DocType == "Folder").Select(r => r.FolderOrFileId).Distinct().ToList();
            var fileIds = rows.Where(r => r.DocType == "Document").Select(r => r.FolderOrFileId).Distinct().ToList();
            var folderNames = await _db.FolderData.AsNoTracking().Where(f => folderIds.Contains(f.FolderId))
                .ToDictionaryAsync(f => f.FolderId, f => f.FolderName);
            var fileNames = await _db.FileData.AsNoTracking().Where(f => fileIds.Contains(f.FileId))
                .ToDictionaryAsync(f => f.FileId, f => f.FileName);

            return rows.Select(r =>
            {
                var itemName = (r.DocType == "Folder" ? folderNames : fileNames).GetValueOrDefault(r.FolderOrFileId) ?? "(deleted item)";
                var pending = r.Status == "Pending";
                return new ReviewDTO
                {
                    ReviewId = r.ReviewId, FolderOrFileId = r.FolderOrFileId, DocType = r.DocType, ItemName = itemName,
                    RequestedBy = r.RequestedBy, RequestedByName = NameOf(names, r.RequestedBy),
                    ReviewerId = r.ReviewerId, ReviewerName = NameOf(names, r.ReviewerId),
                    Status = r.Status, RequestMessage = r.RequestMessage, ReviewerRemarks = r.ReviewerRemarks,
                    RequestedOn = r.RequestedOn, ReviewedOn = r.ReviewedOn,
                    CanDecide = pending && Eq(r.ReviewerId, a.Uid),
                    CanCancel = pending && (Eq(r.RequestedBy, a.Uid) || a.IsGA)
                };
            }).ToList();
        }

        public async Task<List<ReviewDTO>> GetReviewsAsync(string? emp, string? docType, int id)
        {
            var a = await ResolveAsync(emp); var t = NormType(docType);
            await EnsureAccessAsync(a, t, id);
            var rows = await _db.DocReviews.AsNoTracking()
                .Where(r => r.FolderOrFileId == id && r.DocType == t)
                .OrderByDescending(r => r.RequestedOn).ToListAsync();
            return await MapReviewsAsync(rows, a);
        }

        public async Task<List<ReviewDTO>> GetMyReviewsAsync(string? emp, string? scope, string? status)
        {
            var a = await ResolveAsync(emp);
            var q = _db.DocReviews.AsNoTracking().AsQueryable();
            q = string.Equals(scope, "requested", StringComparison.OrdinalIgnoreCase)
                ? q.Where(r => r.RequestedBy == a.Uid)
                : q.Where(r => r.ReviewerId == a.Uid);
            if (!string.IsNullOrWhiteSpace(status) && status != "All") q = q.Where(r => r.Status == status);
            var rows = await q.OrderByDescending(r => r.RequestedOn).Take(200).ToListAsync();
            return await MapReviewsAsync(rows, a);
        }

        public async Task<int> RequestReviewAsync(string? emp, RequestReviewDTO dto)
        {
            var a = await ResolveAsync(emp); var t = NormType(dto.DocType);
            await EnsureAccessAsync(a, t, dto.FolderOrFileId);

            if (!Guid.TryParse(dto.ReviewerId, out var rid)) throw new ArgumentException("Please select a reviewer.");
            if (rid == a.UserId) throw new ArgumentException("You cannot assign a review to yourself.");
            var ru = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserID == rid && u.IsActive)
                     ?? throw new ArgumentException("Reviewer not found or inactive.");
            var reviewer = await BuildActorAsync(ru);
            var participants = await ParticipantIdsAsync(t, dto.FolderOrFileId);
            if (!participants.ContainsKey(reviewer.Uid) && !reviewer.IsGA)
                throw new ArgumentException("Reviews can only be sent to the owner or users this item is shared with.");
            if (await _db.DocReviews.AnyAsync(r => r.FolderOrFileId == dto.FolderOrFileId && r.DocType == t
                                                  && r.ReviewerId == reviewer.Uid && r.Status == "Pending"))
                throw new ArgumentException("This reviewer already has a pending review for this item.");

            var msg = (dto.RequestMessage ?? "").Trim();
            if (msg.Length > 1000) throw new ArgumentException("Message cannot exceed 1000 characters.");

            var entity = new DocReview
            {
                FolderOrFileId = dto.FolderOrFileId, DocType = t, RequestedBy = a.Uid, ReviewerId = reviewer.Uid,
                Status = "Pending", RequestMessage = msg.Length == 0 ? null : msg, RequestedOn = DateTime.Now
            };
            _db.DocReviews.Add(entity);
            await _db.SaveChangesAsync();
            Log.DataLog(a.Uid, $"{a.Name} requested review of {t} ID {dto.FolderOrFileId} from {reviewer.Name}", "Comments Log");
            return entity.ReviewId;
        }

        public async Task<bool> SubmitReviewAsync(string? emp, SubmitReviewDTO dto)
        {
            var a = await ResolveAsync(emp);
            var r = await _db.DocReviews.FirstOrDefaultAsync(x => x.ReviewId == dto.ReviewId)
                    ?? throw new KeyNotFoundException("Review not found.");
            if (!Eq(r.ReviewerId, a.Uid)) throw new CollabForbiddenException("Only the assigned reviewer can submit this review.");
            if (r.Status != "Pending") throw new ArgumentException("This review is already completed or cancelled.");
            await EnsureAccessAsync(a, r.DocType, r.FolderOrFileId);

            string decision;
            if (string.Equals(dto.Decision, "Approved", StringComparison.OrdinalIgnoreCase)) decision = "Approved";
            else if (string.Equals(dto.Decision, "ChangesRequested", StringComparison.OrdinalIgnoreCase)) decision = "ChangesRequested";
            else throw new ArgumentException("Decision must be 'Approved' or 'ChangesRequested'.");

            var remarks = (dto.Remarks ?? "").Trim();
            if (remarks.Length > 1000) throw new ArgumentException("Remarks cannot exceed 1000 characters.");
            if (decision == "ChangesRequested" && remarks.Length == 0)
                throw new ArgumentException("Please explain what needs to change.");

            var now = DateTime.Now;
            r.Status = decision; r.ReviewerRemarks = remarks.Length == 0 ? null : remarks; r.ReviewedOn = now;

            // Mirror the decision into the comment thread so the history reads in one place.
            var label = decision == "Approved" ? "Approved" : "Changes requested";
            var text = remarks.Length == 0 ? $"[Review: {label}]" : $"[Review: {label}] {remarks}";
            _db.DocComments.Add(new DocComment
            {
                FolderOrFileId = r.FolderOrFileId, DocType = r.DocType, CommentText = text,
                CreatedBy = a.Uid, CreatedOn = now
            });
            await _db.SaveChangesAsync();
            Log.DataLog(a.Uid, $"{a.Name} marked review {r.ReviewId} as {decision}", "Comments Log");
            return true;
        }

        public async Task<bool> CancelReviewAsync(string? emp, int reviewId)
        {
            var a = await ResolveAsync(emp);
            var r = await _db.DocReviews.FirstOrDefaultAsync(x => x.ReviewId == reviewId)
                    ?? throw new KeyNotFoundException("Review not found.");
            if (!(a.IsGA || Eq(r.RequestedBy, a.Uid))) throw new CollabForbiddenException("Only the requester can cancel this review.");
            if (r.Status != "Pending") throw new ArgumentException("Only pending reviews can be cancelled.");
            r.Status = "Cancelled"; r.ReviewedOn = DateTime.Now;
            await _db.SaveChangesAsync();
            return true;
        }

        // uid -> "Owner" | "Shared". Owner = creator/authorized user of the item or any parent folder.
        // Shared = active share on the item or any parent folder.
        private async Task<Dictionary<string, string>> ParticipantIdsAsync(string docType, int id)
        {
            var map = new Dictionary<string, string>();
            void Add(string? uid, string role)
            {
                if (string.IsNullOrWhiteSpace(uid) || !Guid.TryParse(uid, out var g)) return;
                var k = g.ToString().ToLower();
                if (role == "Owner" || !map.ContainsKey(k)) map[k] = role;
            }

            int folderId;
            if (docType == "Document")
            {
                var f = await _db.FileData.AsNoTracking().FirstOrDefaultAsync(x => x.FileId == id)
                        ?? throw new KeyNotFoundException("Item not found.");
                Add(f.CreatedBy, "Owner");
                folderId = f.FolderId;
                var fileShares = await _db.ShareDocAccess.AsNoTracking()
                    .Where(s => s.IsActive && s.DocType == "Document" && s.FolderOrFileId == id)
                    .Select(s => s.AccessUserId).ToListAsync();
                foreach (var g in fileShares) Add(g.ToString(), "Shared");
            }
            else folderId = id;

            var chain = new List<int>(); var cur = folderId; var guard = 0;
            while (cur != 0 && guard++ < 25)
            {
                var n = await _db.FolderData.AsNoTracking().Where(x => x.FolderId == cur)
                    .Select(x => new { x.ParentFolderId, x.CreatedBy, x.AuthorizedUserId }).FirstOrDefaultAsync();
                if (n == null) break;
                chain.Add(cur); Add(n.CreatedBy, "Owner"); Add(n.AuthorizedUserId, "Owner");
                cur = n.ParentFolderId ?? 0;
            }
            if (docType == "Folder" && chain.Count == 0) throw new KeyNotFoundException("Item not found.");

            var folderShares = await _db.ShareDocAccess.AsNoTracking()
                .Where(s => s.IsActive && s.DocType == "Folder" && chain.Contains(s.FolderOrFileId))
                .Select(s => s.AccessUserId).ToListAsync();
            foreach (var g in folderShares) Add(g.ToString(), "Shared");
            return map;
        }

        public async Task<List<ParticipantDTO>> GetParticipantsAsync(string? emp, string? docType, int id)
        {
            var a = await ResolveAsync(emp); var t = NormType(docType);
            await EnsureAccessAsync(a, t, id);
            var map = await ParticipantIdsAsync(t, id);
            map.Remove(a.Uid);
            var guids = map.Keys.Select(Guid.Parse).ToList();
            var users = await _db.Users.AsNoTracking().Where(u => guids.Contains(u.UserID) && u.IsActive)
                .Select(u => new { u.UserID, u.Email }).ToListAsync();
            var names = await NamesAsync(map.Keys);
            return users.Select(u =>
            {
                var k = u.UserID.ToString().ToLower();
                return new ParticipantDTO { UserId = k, Name = NameOf(names, k), Email = u.Email ?? "", Role = map[k] };
            }).OrderBy(p => p.Role != "Owner").ThenBy(p => p.Name).ToList();
        }


        // ------------------------------------------------------------ mentions
        private async Task<string> PathAsync(string docType, int id)
        {
            int folderId = id;
            if (docType == "Document")
                folderId = await _db.FileData.AsNoTracking().Where(f => f.FileId == id).Select(f => f.FolderId).FirstOrDefaultAsync();
            var names = new List<string>(); var cur = folderId; var guard = 0;
            while (cur != 0 && guard++ < 25)
            {
                var n = await _db.FolderData.AsNoTracking().Where(x => x.FolderId == cur)
                    .Select(x => new { x.FolderName, x.ParentFolderId }).FirstOrDefaultAsync();
                if (n == null) break;
                names.Add(n.FolderName); cur = n.ParentFolderId ?? 0;
            }
            names.Reverse(); names.Insert(0, "Home");
            return string.Join(" / ", names);
        }

        private async Task NotifyMentionsAsync(Actor a, string t, int id, DocComment c, List<string> ids)
        {
            try
            {
                // only authorised users (owner / users the item is shared with) can be mentioned
                var allowed = await ParticipantIdsAsync(t, id);
                var valid = ids.Where(allowed.ContainsKey).ToList();
                if (valid.Count == 0) return;

                var itemName = await ItemNameAsync(t, id) ?? "";
                var location = await PathAsync(t, id);
                var guids = valid.Select(Guid.Parse).ToList();
                var users = await _db.Users.AsNoTracking().Where(u => guids.Contains(u.UserID) && u.IsActive)
                    .Select(u => new { u.UserID, u.Email }).ToListAsync();
                var names = await NamesAsync(valid);
                var now = DateTime.Now;

                foreach (var u in users)
                    _db.DocMentions.Add(new DocMention
                    {
                        CommentId = c.CommentId,
                        FolderOrFileId = id,
                        DocType = t,
                        MentionedUserId = u.UserID.ToString().ToLower(),
                        MentionedBy = a.Uid,
                        CreatedOn = now
                    });
                await _db.SaveChangesAsync();

                var site = (_cfg["SiteURL"] ?? "").TrimEnd('/');
                var link = $"{site}/dashboard?mentionDocType={t}&mentionId={id}&mentionName={Uri.EscapeDataString(itemName)}";
                foreach (var u in users)
                {
                    if (string.IsNullOrWhiteSpace(u.Email)) continue;
                    var uid = u.UserID.ToString().ToLower();
                    await _email.SendMentionNotificationMail(u.Email, NameOf(names, uid), a.Name, t, itemName, location, c.CommentText, link);
                }
                Log.DataLog(a.Uid, $"{a.Name} mentioned {users.Count} user(s) on {t} ID {id}", "Comments Log");
            }
            catch (Exception ex)
            {
                // a mention/notification failure must never break posting the comment
                Log.Error(a.Uid, $"NotifyMentions failed: {ex.Message}", "Comments Log");
            }
        }

        public async Task<List<MentionNotificationDTO>> GetMentionNotificationsAsync(string? emp)
        {
            var a = await ResolveAsync(emp);
            var rows = await _db.DocMentions.AsNoTracking().Where(m => m.MentionedUserId == a.Uid)
                .OrderByDescending(m => m.CreatedOn).Take(30).ToListAsync();
            if (rows.Count == 0) return new List<MentionNotificationDTO>();

            var cids = rows.Select(r => r.CommentId).ToList();
            var comments = await _db.DocComments.AsNoTracking().Where(c => cids.Contains(c.CommentId))
                .ToDictionaryAsync(c => c.CommentId);
            var folderIds = rows.Where(r => r.DocType == "Folder").Select(r => r.FolderOrFileId).Distinct().ToList();
            var fileIds = rows.Where(r => r.DocType == "Document").Select(r => r.FolderOrFileId).Distinct().ToList();
            var folderNames = await _db.FolderData.AsNoTracking().Where(f => folderIds.Contains(f.FolderId))
                .ToDictionaryAsync(f => f.FolderId, f => f.FolderName);
            var fileNames = await _db.FileData.AsNoTracking().Where(f => fileIds.Contains(f.FileId))
                .ToDictionaryAsync(f => f.FileId, f => f.FileName);
            var names = await NamesAsync(rows.Select(r => (string?)r.MentionedBy));

            return rows.Select(r =>
            {
                comments.TryGetValue(r.CommentId, out var c);
                return new MentionNotificationDTO
                {
                    MentionId = r.MentionId,
                    CommentId = r.CommentId,
                    FolderOrFileId = r.FolderOrFileId,
                    DocType = r.DocType,
                    ItemName = (r.DocType == "Folder" ? folderNames : fileNames).GetValueOrDefault(r.FolderOrFileId) ?? "(deleted item)",
                    CommentText = c == null || c.IsDeleted ? "This comment was deleted." : c.CommentText,
                    MentionedByName = NameOf(names, r.MentionedBy),
                    CreatedOn = r.CreatedOn,
                    IsRead = r.IsRead
                };
            }).ToList();
        }

        public async Task<bool> MarkMentionReadAsync(string? emp, int mentionId)
        {
            var a = await ResolveAsync(emp);
            var m = await _db.DocMentions.FirstOrDefaultAsync(x => x.MentionId == mentionId && x.MentionedUserId == a.Uid);
            if (m == null) throw new KeyNotFoundException("Notification not found.");
            if (!m.IsRead) { m.IsRead = true; m.ReadOn = DateTime.Now; await _db.SaveChangesAsync(); }
            return true;
        }

        public async Task<bool> MarkAllMentionsReadAsync(string? emp)
        {
            var a = await ResolveAsync(emp);
            var rows = await _db.DocMentions.Where(m => m.MentionedUserId == a.Uid && !m.IsRead).ToListAsync();
            foreach (var m in rows) { m.IsRead = true; m.ReadOn = DateTime.Now; }
            if (rows.Count > 0) await _db.SaveChangesAsync();
            return true;
        }
    }
}
