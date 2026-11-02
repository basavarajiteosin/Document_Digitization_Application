import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FiFolder, FiFile } from "react-icons/fi";
import CommentsReviewModal, { Avatar, StatusPill } from "./CommentsReviewModal";
import "./Collaboration.css";

const config = require("../../services/config.json");

const MyReviews = () => {
  const [scope, setScope] = useState("assigned");
  const [status, setStatus] = useState("Pending");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openItem, setOpenItem] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${config.DDA_API_API_URL}Comments/MyReviews`, { params: { scope, status } });
      if (res.data.success) setRows(res.data.data || []);
      else toast.error(res.data.message || "Failed to load reviews");
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to load reviews");
    } finally { setLoading(false); }
  }, [scope, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="content scroll-content">
      <div className="container-fluid">
        <div className="sp-hero"><div><h2>My reviews</h2><p>Review requests assigned to you or sent by you</p></div></div>

        <div className="sp-mr-bar">
          <div className="sp-mr-pivot">
            <button className={scope === "assigned" ? "active" : ""} onClick={() => setScope("assigned")}>Assigned to me</button>
            <button className={scope === "requested" ? "active" : ""} onClick={() => setScope("requested")}>Requested by me</button>
          </div>
          <select className="custom-select custom-select-sm" style={{ maxWidth: 200, marginLeft: "auto" }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="All">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="ChangesRequested">Changes requested</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="sp-mr-list">
          <div className="sp-mr-row head">
            <span>Name</span><span>Status</span><span>{scope === "assigned" ? "Requested by" : "Reviewer"}</span>
            <span>Requested on</span><span>Message</span><span />
          </div>
          {loading ? (
            <div className="sp-cr-empty">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="sp-cr-empty">No reviews found.</div>
          ) : rows.map((r) => {
            const who = scope === "assigned" ? r.requestedByName : r.reviewerName;
            const gone = r.itemName === "(deleted item)";
            return (
              <div className="sp-mr-row" key={r.reviewId}>
                <span className="sp-mr-name">
                  {r.docType === "Folder" ? <FiFolder size={18} color="#c19c00" /> : <FiFile size={18} color="#0078d4" />}
                  <span title={r.itemName}>{r.itemName}</span>
                </span>
                <span><StatusPill status={r.status} /></span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={who} />{who}</span>
                <span>{new Date(r.requestedOn).toLocaleString()}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.requestMessage || ""}>{r.requestMessage || "-"}</span>
                <span>
                  <button className="sp-btn" disabled={gone}
                    onClick={() => setOpenItem({ docType: r.docType, id: r.folderOrFileId, name: r.itemName })}>Open</button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {openItem && (
        <CommentsReviewModal item={openItem} initialTab="reviews" onClose={() => { setOpenItem(null); load(); }} />
      )}
    </section>
  );
};

export default MyReviews;