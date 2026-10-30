import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import CommentsReviewModal, { statusBadge, statusLabel } from "./CommentsReviewModal";

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
      const res = await axios.get(`${config.DDA_API_API_URL}Comments/MyReviews`, {
        params: { scope, status },
      });
      if (res.data.success) setRows(res.data.data || []);
      else toast.error(res.data.message || "Failed to load reviews");
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [scope, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="content scroll-content">
      <div className="container-fluid">
        <div className="card card-primary card-outline">
          <div className="card-header">
            <h3 className="card-title text-sm">My Reviews</h3>
          </div>
          <div className="card-body text-sm">
            <div className="d-flex mb-3 align-items-center">
              <button className={`btn btn-sm mr-2 ${scope === "assigned" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setScope("assigned")}>
                Assigned to me
              </button>
              <button className={`btn btn-sm mr-3 ${scope === "requested" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setScope("requested")}>
                Requested by me
              </button>
              <select className="custom-select custom-select-sm" style={{ maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="All">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="ChangesRequested">Changes requested</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="table table-bordered table-sm">
                <thead>
                  <tr>
                    <th>Item</th><th>Type</th>
                    <th>{scope === "assigned" ? "Requested by" : "Reviewer"}</th>
                    <th>Status</th><th>Requested on</th><th>Message</th><th style={{ width: "8%" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="7" className="text-center">Loading...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan="7" className="text-center">No reviews found.</td></tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.reviewId}>
                        <td>{r.itemName}</td>
                        <td>{r.docType}</td>
                        <td>{scope === "assigned" ? r.requestedByName : r.reviewerName}</td>
                        <td><span className={statusBadge(r.status)}>{statusLabel(r.status)}</span></td>
                        <td>{new Date(r.requestedOn).toLocaleString()}</td>
                        <td>{r.requestMessage || "-"}</td>
                        <td className="text-center">
                          <button
                            className="btn btn-xs btn-outline-primary"
                            disabled={r.itemName === "(deleted item)"}
                            onClick={() => setOpenItem({ docType: r.docType, id: r.folderOrFileId, name: r.itemName })}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {openItem && (
        <CommentsReviewModal
          item={openItem}
          initialTab="reviews"
          onClose={() => { setOpenItem(null); load(); }}
        />
      )}
    </section>
  );
};

export default MyReviews;
