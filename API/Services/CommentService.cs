using DDAAPI.DbContexts;
using DDAAPI.Models;
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
        public CommentService(AppDbContext db) { _db = db; }

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
            var names = await NamesAsync(rows.SelectMany(r => new[] { r.CreatedBy, r.ResolvedBy }));

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
                CanDelete = !c.IsDeleted && (Eq(c.CreatedBy, a.Uid) || a.IsGA)
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
            if (!await CanAccessAsync(reviewer, t, dto.FolderOrFileId))
                throw new ArgumentException("The selected reviewer has no access to this item. Share it with them first.");

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
    }
}
