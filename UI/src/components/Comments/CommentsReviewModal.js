import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import "./Collaboration.css";

const config = require("../../services/config.json");
const API = `${config.DDA_API_API_URL}Comments/`;

const fmt = (d) => (d ? new Date(d).toLocaleString() : "-");
const errMsg = (e, fallback) => e.response?.data?.message || fallback;

export const statusBadge = (s) =>
  ({
    Pending: "badge badge-warning",
    Approved: "badge badge-success",
    ChangesRequested: "badge badge-danger",
    Cancelled: "badge badge-secondary",
  }[s] || "badge badge-secondary");

export const statusLabel = (s) => (s === "ChangesRequested" ? "Changes requested" : s);

/**
 * item = { docType: "Folder" | "Document", id: number, name: string }
 */
const CommentsReviewModal = ({ item, initialTab = "comments", onClose }) => {
  const personalInfo = useSelector((state) => state.personalInformationReducer);
  const params = { docType: item.docType, id: item.id };

  const [tab, setTab] = useState(initialTab);
  const [comments, setComments] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newText, setNewText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  const [users, setUsers] = useState([]);
  const [reviewerId, setReviewerId] = useState("");
  const [requestMsg, setRequestMsg] = useState("");
  const [remarks, setRemarks] = useState({});

  const loadComments = useCallback(async () => {
    try {
      const res = await axios.get(`${API}List`, { params });
      if (res.data.success) setComments(res.data.data || []);
      else toast.error(res.data.message || "Failed to load comments");
    } catch (e) {
      toast.error(errMsg(e, "Failed to load comments"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.docType, item.id]);

  const loadReviews = useCallback(async () => {
    try {
      const res = await axios.get(`${API}Reviews`, { params });
      if (res.data.success) setReviews(res.data.data || []);
      else toast.error(res.data.message || "Failed to load reviews");
    } catch (e) {
      toast.error(errMsg(e, "Failed to load reviews"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.docType, item.id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadComments(), loadReviews()]);
      setLoading(false);
    })();
  }, [loadComments, loadReviews]);

  useEffect(() => {
    axios
      .get(`${config.DDA_API_API_URL}AuthMasterController/GetAllUsers?ClientId=dmsApp`)
      .then((res) => {
        const list = (res.data.data || []).filter(
          (u) => u.isActive && u.userID !== personalInfo.userID
        );
        setUsers(list);
      })
      .catch(() => {});
  }, [personalInfo.userID]);

  const post = async (path, body, okMsg) => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}${path}`, body);
      if (res.data.success) {
        if (okMsg) toast.success(okMsg);
        return true;
      }
      toast.error(res.data.message || "Request failed");
    } catch (e) {
      toast.error(errMsg(e, "Request failed"));
    } finally {
      setBusy(false);
    }
    return false;
  };

  /* ---------------- comment actions ---------------- */
  const addComment = async (text, parentCommentId = null) => {
    if (!text.trim()) return toast.error("Please type a comment.");
    const ok = await post(
      "Add",
      { docType: item.docType, folderOrFileId: item.id, commentText: text, parentCommentId },
      "Comment added"
    );
    if (ok) {
      setNewText("");
      setReplyText("");
      setReplyTo(null);
      loadComments();
    }
  };

  const saveEdit = async () => {
    if (!editText.trim()) return toast.error("Comment cannot be empty.");
    const ok = await post("Edit", { commentId: editId, commentText: editText }, "Comment updated");
    if (ok) {
      setEditId(null);
      setEditText("");
      loadComments();
    }
  };

  const deleteComment = async (id) => {
    if (!window.confirm("Delete this comment?")) return;
    if (await post(`Delete/${id}`, null, "Comment deleted")) loadComments();
  };

  const toggleResolve = async (c) => {
    if (await post("Resolve", { commentId: c.commentId, isResolved: !c.isResolved })) loadComments();
  };

  /* ---------------- review actions ---------------- */
  const requestReview = async () => {
    if (!reviewerId) return toast.error("Please select a reviewer.");
    const ok = await post(
      "RequestReview",
      { docType: item.docType, folderOrFileId: item.id, reviewerId, requestMessage: requestMsg },
      "Review requested"
    );
    if (ok) {
      setReviewerId("");
      setRequestMsg("");
      loadReviews();
    }
  };

  const submitReview = async (r, decision) => {
    const text = remarks[r.reviewId] || "";
    if (decision === "ChangesRequested" && !text.trim())
      return toast.error("Please explain what needs to change.");
    const ok = await post(
      "SubmitReview",
      { reviewId: r.reviewId, decision, remarks: text },
      "Review submitted"
    );
    if (ok) {
      setRemarks((p) => ({ ...p, [r.reviewId]: "" }));
      loadReviews();
      loadComments();
    }
  };

  const cancelReview = async (r) => {
    if (!window.confirm("Cancel this review request?")) return;
    if (await post(`CancelReview/${r.reviewId}`, null, "Review cancelled")) loadReviews();
  };

  /* ---------------- render helpers ---------------- */
  const topLevel = comments.filter((c) => !c.parentCommentId);
  const repliesOf = (id) => comments.filter((c) => c.parentCommentId === id);

  const renderComment = (c, isReply) => (
    <div
      key={c.commentId}
      className={`${isReply ? "cr-reply" : "cr-comment"} ${c.isResolved && !isReply ? "resolved" : ""}`}
    >
      <div className="cr-meta">
        <strong>{c.createdByName}</strong> · {fmt(c.createdOn)}
        {c.modifiedOn && !c.isDeleted ? " (edited)" : ""}
        {c.isResolved && !isReply && (
          <span className="badge badge-success ml-2">Resolved by {c.resolvedByName}</span>
        )}
      </div>

      {editId === c.commentId ? (
        <>
          <textarea
            className="form-control form-control-sm"
            rows={2}
            value={editText}
            maxLength={2000}
            onChange={(e) => setEditText(e.target.value)}
          />
          <div className="cr-actions">
            <button className="btn btn-primary btn-xs" disabled={busy} onClick={saveEdit}>Save</button>
            <button className="btn btn-default btn-xs" onClick={() => setEditId(null)}>Cancel</button>
          </div>
        </>
      ) : (
        <div className="cr-text" style={c.isDeleted ? { color: "#999", fontStyle: "italic" } : null}>
          {c.commentText}
        </div>
      )}

      {!c.isDeleted && editId !== c.commentId && (
        <div className="cr-actions">
          {!isReply && (
            <button className="cr-link" onClick={() => { setReplyTo(c.commentId); setReplyText(""); }}>Reply</button>
          )}
          {!isReply && (
            <button className="cr-link" onClick={() => toggleResolve(c)}>
              {c.isResolved ? "Reopen" : "Resolve"}
            </button>
          )}
          {c.canEdit && (
            <button className="cr-link" onClick={() => { setEditId(c.commentId); setEditText(c.commentText); }}>Edit</button>
          )}
          {c.canDelete && (
            <button className="cr-link danger" onClick={() => deleteComment(c.commentId)}>Delete</button>
          )}
        </div>
      )}

      {replyTo === c.commentId && (
        <div className="cr-form">
          <textarea
            className="form-control form-control-sm"
            rows={2}
            maxLength={2000}
            placeholder="Write a reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <div className="cr-actions">
            <button className="btn btn-primary btn-xs" disabled={busy} onClick={() => addComment(replyText, c.commentId)}>Reply</button>
            <button className="btn btn-default btn-xs" onClick={() => setReplyTo(null)}>Cancel</button>
          </div>
        </div>
      )}

      {!isReply && repliesOf(c.commentId).map((r) => renderComment(r, true))}
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content-shared-access">
        <div className="modal-header">
          <h5 className="modal-title">Comments &amp; Review - {item.name}</h5>
          <button className="close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body text-sm">
          <div className="cr-tabs">
            <button className={`cr-tab ${tab === "comments" ? "active" : ""}`} onClick={() => setTab("comments")}>
              Comments ({comments.filter((c) => !c.isDeleted).length})
            </button>
            <button className={`cr-tab ${tab === "reviews" ? "active" : ""}`} onClick={() => setTab("reviews")}>
              Reviews ({reviews.length})
            </button>
          </div>

          {loading ? (
            <div className="cr-empty">Loading...</div>
          ) : tab === "comments" ? (
            <>
              <div className="cr-body">
                {topLevel.length === 0 ? (
                  <div className="cr-empty">No comments yet. Start the discussion below.</div>
                ) : (
                  topLevel.map((c) => renderComment(c, false))
                )}
              </div>
              <div className="cr-form">
                <textarea
                  className="form-control form-control-sm"
                  rows={3}
                  maxLength={2000}
                  placeholder="Add a comment..."
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                />
                <div className="cr-actions">
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => addComment(newText)}>
                    Post comment
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="cr-body">
                {reviews.length === 0 ? (
                  <div className="cr-empty">No review requests for this item.</div>
                ) : (
                  reviews.map((r) => (
                    <div className="cr-review" key={r.reviewId}>
                      <div className="cr-meta">
                        <span className={statusBadge(r.status)}>{statusLabel(r.status)}</span>{" "}
                        Requested by <strong>{r.requestedByName}</strong> from{" "}
                        <strong>{r.reviewerName}</strong> · {fmt(r.requestedOn)}
                      </div>
                      {r.requestMessage && <div className="cr-text">{r.requestMessage}</div>}
                      {r.reviewedOn && (
                        <div className="cr-meta mt-1">
                          {statusLabel(r.status)} on {fmt(r.reviewedOn)}
                          {r.reviewerRemarks ? `: ${r.reviewerRemarks}` : ""}
                        </div>
                      )}
                      {r.canDecide && (
                        <div className="cr-form">
                          <textarea
                            className="form-control form-control-sm"
                            rows={2}
                            maxLength={1000}
                            placeholder="Remarks (required when requesting changes)"
                            value={remarks[r.reviewId] || ""}
                            onChange={(e) => setRemarks((p) => ({ ...p, [r.reviewId]: e.target.value }))}
                          />
                          <div className="cr-actions">
                            <button className="btn btn-success btn-xs" disabled={busy} onClick={() => submitReview(r, "Approved")}>Approve</button>
                            <button className="btn btn-danger btn-xs" disabled={busy} onClick={() => submitReview(r, "ChangesRequested")}>Request changes</button>
                          </div>
                        </div>
                      )}
                      {r.canCancel && (
                        <div className="cr-actions">
                          <button className="cr-link danger" onClick={() => cancelReview(r)}>Cancel request</button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="cr-form">
                <label>Request a review</label>
                <select className="form-control form-control-sm mb-2" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
                  <option value="">Select reviewer</option>
                  {users.map((u) => (
                    <option key={u.userID} value={u.userID}>
                      {u.firstName} {u.lastName} - {u.email}
                    </option>
                  ))}
                </select>
                <textarea
                  className="form-control form-control-sm"
                  rows={2}
                  maxLength={1000}
                  placeholder="Message to reviewer (optional)"
                  value={requestMsg}
                  onChange={(e) => setRequestMsg(e.target.value)}
                />
                <div className="cr-actions">
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={requestReview}>Send for review</button>
                </div>
                <small className="text-muted">The reviewer must already have access to this item (share it first if needed).</small>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline-primary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default CommentsReviewModal;
