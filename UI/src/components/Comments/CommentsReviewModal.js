import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FiX, FiFolder, FiFile, FiSend, FiMessageSquare } from "react-icons/fi";
import "./Collaboration.css";

const config = require("../../services/config.json");
const API = `${config.DDA_API_API_URL}Comments/`;

const fmt = (d) => (d ? new Date(d).toLocaleString() : "-");
const errMsg = (e, fb) => e.response?.data?.message || fb;

export const initials = (name = "") =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";

export const Avatar = ({ name, alt }) => (
  <span className={`sp-avatar-sm ${alt ? "alt" : ""}`} title={name}>{initials(name)}</span>
);

export const statusClass = (s) =>
  ({ Pending: "pending", Approved: "approved", ChangesRequested: "changes", Cancelled: "cancelled" }[s] || "cancelled");
export const statusLabel = (s) => (s === "ChangesRequested" ? "Changes requested" : s);
export const StatusPill = ({ status }) => (
  <span className={`sp-pill-s ${statusClass(status)}`}>{statusLabel(status)}</span>
);

/** item = { docType: "Folder" | "Document", id, name } */
const CommentsReviewModal = ({ item, initialTab = "comments", onClose }) => {
  const params = { docType: item.docType, id: item.id };
  const [tab, setTab] = useState(initialTab);
  const [comments, setComments] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [people, setPeople] = useState([]); // owner + shared users only
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newText, setNewText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [requestMsg, setRequestMsg] = useState("");
  const [remarks, setRemarks] = useState({});

  const get = async (path, set, fb) => {
    try {
      const res = await axios.get(`${API}${path}`, { params });
      if (res.data.success) set(res.data.data || []);
      else toast.error(res.data.message || fb);
    } catch (e) { toast.error(errMsg(e, fb)); }
  };
  const loadComments = useCallback(() => get("List", setComments, "Failed to load comments"), [item.docType, item.id]); // eslint-disable-line
  const loadReviews = useCallback(() => get("Reviews", setReviews, "Failed to load reviews"), [item.docType, item.id]); // eslint-disable-line
  const loadPeople = useCallback(() => get("Participants", setPeople, "Failed to load users"), [item.docType, item.id]); // eslint-disable-line

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadComments(), loadReviews(), loadPeople()]);
      setLoading(false);
    })();
  }, [loadComments, loadReviews, loadPeople]);

  const post = async (path, body, okMsg) => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}${path}`, body);
      if (res.data.success) { if (okMsg) toast.success(okMsg); return true; }
      toast.error(res.data.message || "Request failed");
    } catch (e) { toast.error(errMsg(e, "Request failed")); }
    finally { setBusy(false); }
    return false;
  };

  const addComment = async (text, parentCommentId = null) => {
    if (!text.trim()) return toast.error("Please type a comment.");
    if (await post("Add", { docType: item.docType, folderOrFileId: item.id, commentText: text, parentCommentId })) {
      setNewText(""); setReplyText(""); setReplyTo(null); loadComments();
    }
  };
  const saveEdit = async () => {
    if (!editText.trim()) return toast.error("Comment cannot be empty.");
    if (await post("Edit", { commentId: editId, commentText: editText }, "Comment updated")) {
      setEditId(null); loadComments();
    }
  };
  const deleteComment = async (id) => {
    if (window.confirm("Delete this comment?") && (await post(`Delete/${id}`, null, "Comment deleted"))) loadComments();
  };
  const toggleResolve = async (c) => {
    if (await post("Resolve", { commentId: c.commentId, isResolved: !c.isResolved })) loadComments();
  };
  const requestReview = async () => {
    if (!reviewerId) return toast.error("Please select a reviewer.");
    if (await post("RequestReview", { docType: item.docType, folderOrFileId: item.id, reviewerId, requestMessage: requestMsg }, "Review requested")) {
      setReviewerId(""); setRequestMsg(""); loadReviews();
    }
  };
  const submitReview = async (r, decision) => {
    const text = remarks[r.reviewId] || "";
    if (decision === "ChangesRequested" && !text.trim()) return toast.error("Please explain what needs to change.");
    if (await post("SubmitReview", { reviewId: r.reviewId, decision, remarks: text }, "Review submitted")) {
      setRemarks((p) => ({ ...p, [r.reviewId]: "" })); loadReviews(); loadComments();
    }
  };
  const cancelReview = async (r) => {
    if (window.confirm("Cancel this review request?") && (await post(`CancelReview/${r.reviewId}`, null, "Review cancelled"))) loadReviews();
  };

  const topLevel = comments.filter((c) => !c.parentCommentId);
  const repliesOf = (id) => comments.filter((c) => c.parentCommentId === id);
  const owners = people.filter((p) => p.role === "Owner");
  const shared = people.filter((p) => p.role !== "Owner");

  const renderComment = (c, isReply) => (
    <div key={c.commentId} className={`sp-cm ${c.isResolved && !isReply ? "resolved" : ""}`}>
      <Avatar name={c.createdByName} alt={isReply} />
      <div className="sp-cm-body">
        <div className="sp-cm-meta">
          <strong>{c.createdByName}</strong>{fmt(c.createdOn)}{c.modifiedOn && !c.isDeleted ? " · edited" : ""}
          {c.isResolved && !isReply && <> <span className="sp-pill-s resolved">Resolved by {c.resolvedByName}</span></>}
        </div>

        {editId === c.commentId ? (
          <>
            <textarea rows={2} maxLength={2000} value={editText} onChange={(e) => setEditText(e.target.value)} />
            <div className="sp-cm-actions">
              <button disabled={busy} onClick={saveEdit}>Save</button>
              <button onClick={() => setEditId(null)}>Cancel</button>
            </div>
          </>
        ) : (
          <div className={`sp-cm-text ${c.isDeleted ? "deleted" : ""}`}>{c.commentText}</div>
        )}

        {!c.isDeleted && editId !== c.commentId && (
          <div className="sp-cm-actions">
            {!isReply && <button onClick={() => { setReplyTo(c.commentId); setReplyText(""); }}>Reply</button>}
            {!isReply && <button onClick={() => toggleResolve(c)}>{c.isResolved ? "Reopen" : "Resolve"}</button>}
            {c.canEdit && <button onClick={() => { setEditId(c.commentId); setEditText(c.commentText); }}>Edit</button>}
            {c.canDelete && <button className="danger" onClick={() => deleteComment(c.commentId)}>Delete</button>}
          </div>
        )}

        {replyTo === c.commentId && (
          <div style={{ marginTop: 8 }}>
            <textarea rows={2} maxLength={2000} placeholder="Write a reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} />
            <div className="sp-cm-actions" style={{ marginTop: 6 }}>
              <button disabled={busy} onClick={() => addComment(replyText, c.commentId)}>Reply</button>
              <button onClick={() => setReplyTo(null)}>Cancel</button>
            </div>
          </div>
        )}

        {!isReply && repliesOf(c.commentId).length > 0 && (
          <div className="sp-cm-replies">{repliesOf(c.commentId).map((r) => renderComment(r, true))}</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="sp-cr-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="sp-cr-panel" role="dialog" aria-label="Comments and review">
        <div className="sp-cr-head">
          <div style={{ minWidth: 0 }}>
            <h3 className="sp-cr-title">Comments &amp; Review</h3>
            <div className="sp-cr-item">
              {item.docType === "Folder" ? <FiFolder size={14} /> : <FiFile size={14} />}
              <span title={item.name}>{item.name}</span>
            </div>
          </div>
          <button className="sp-cr-close" onClick={onClose} aria-label="Close"><FiX size={18} /></button>
        </div>

        <div className="sp-cr-pivot">
          <button className={tab === "comments" ? "active" : ""} onClick={() => setTab("comments")}>
            Comments<span className="sp-cr-count">{comments.filter((c) => !c.isDeleted).length}</span>
          </button>
          <button className={tab === "reviews" ? "active" : ""} onClick={() => setTab("reviews")}>
            Reviews<span className="sp-cr-count">{reviews.length}</span>
          </button>
        </div>

        {loading ? (
          <div className="sp-cr-scroll"><div className="sp-cr-empty">Loading...</div></div>
        ) : tab === "comments" ? (
          <>
            <div className="sp-cr-scroll">
              {topLevel.length === 0 ? (
                <div className="sp-cr-empty"><FiMessageSquare size={36} />No comments yet. Start the conversation.</div>
              ) : topLevel.map((c) => renderComment(c, false))}
            </div>
            <div className="sp-composer">
              <div className="row-in">
                <textarea rows={2} maxLength={2000} placeholder="Add a comment" value={newText} onChange={(e) => setNewText(e.target.value)} />
              </div>
              <div className="bar">
                <button className="sp-btn primary" disabled={busy} onClick={() => addComment(newText)}><FiSend size={14} /> Post</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="sp-cr-scroll">
              {reviews.length === 0 ? (
                <div className="sp-cr-empty">No review requests for this item.</div>
              ) : reviews.map((r) => (
                <div className="sp-rv" key={r.reviewId}>
                  <div className="sp-rv-top">
                    <span className="sp-rv-who"><strong>{r.requestedByName}</strong> → <strong>{r.reviewerName}</strong></span>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="sp-rv-meta">Requested {fmt(r.requestedOn)}</div>
                  {r.requestMessage && <div className="sp-cm-text">{r.requestMessage}</div>}
                  {r.reviewedOn && (
                    <div className="sp-rv-meta" style={{ marginTop: 6 }}>
                      {statusLabel(r.status)} on {fmt(r.reviewedOn)}{r.reviewerRemarks ? ` - ${r.reviewerRemarks}` : ""}
                    </div>
                  )}
                  {r.canDecide && (
                    <div style={{ marginTop: 8 }}>
                      <textarea rows={2} maxLength={1000} placeholder="Remarks (required when requesting changes)"
                        value={remarks[r.reviewId] || ""} onChange={(e) => setRemarks((p) => ({ ...p, [r.reviewId]: e.target.value }))} />
                      <div className="sp-rv-actions">
                        <button className="sp-btn ok" disabled={busy} onClick={() => submitReview(r, "Approved")}>Approve</button>
                        <button className="sp-btn danger" disabled={busy} onClick={() => submitReview(r, "ChangesRequested")}>Request changes</button>
                      </div>
                    </div>
                  )}
                  {r.canCancel && (
                    <div className="sp-rv-actions"><button className="sp-btn" onClick={() => cancelReview(r)}>Cancel request</button></div>
                  )}
                </div>
              ))}
            </div>
            <div className="sp-composer">
              <div className="sp-field">
                <label>Request a review from</label>
                <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
                  <option value="">Select owner or shared user</option>
                  {owners.length > 0 && (
                    <optgroup label="Owner">
                      {owners.map((p) => <option key={p.userId} value={p.userId}>{p.name} ({p.email})</option>)}
                    </optgroup>
                  )}
                  {shared.length > 0 && (
                    <optgroup label="Shared with">
                      {shared.map((p) => <option key={p.userId} value={p.userId}>{p.name} ({p.email})</option>)}
                    </optgroup>
                  )}
                </select>
                {people.length === 0 && <div className="sp-hint">No other users are linked to this item. Share it first.</div>}
                <label>Message (optional)</label>
                <textarea rows={2} maxLength={1000} value={requestMsg} onChange={(e) => setRequestMsg(e.target.value)} />
              </div>
              <div className="bar">
                <button className="sp-btn primary" disabled={busy || !reviewerId} onClick={requestReview}><FiSend size={14} /> Send for review</button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
};

export default CommentsReviewModal;