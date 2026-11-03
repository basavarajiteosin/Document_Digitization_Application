import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  FiX, FiFolder, FiFile, FiDownload, FiTrash2, FiSearch, FiUsers, FiUserCheck, FiUserX, FiClock,
  FiInfo, FiShield, FiChevronDown, FiChevronUp,
} from "react-icons/fi";
import "./itemDetails.css";

const config = require("../../services/config.json");
const API = `${config.DDA_API_API_URL}ItemDetails/`;
const PAGE_SIZE = 8;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
const fmtSize = (b) => {
  b = Number(b) || 0;
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + " GB";
  if (b >= 1048576) return (b / 1048576).toFixed(2) + " MB";
  if (b >= 1024) return (b / 1024).toFixed(2) + " KB";
  return b + " Bytes";
};
const errMsg = (e, fb) => e.response?.data?.message || fb;
const initials = (n = "") => n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";

const Row = ({ label, children }) => (
  <div className="sfd-kv"><span className="sfd-k">{label}</span><span className="sfd-v">{children || "-"}</span></div>
);

/** item = { docType: "Folder" | "Document", id, name }  tab = "details" | "access" */
const ItemDetailsModal = ({ item, initialTab = "details", onClose, onChanged }) => {
  const params = useMemo(() => ({ docType: item.docType, id: item.id }), [item.docType, item.id]);
  const [tab, setTab] = useState(initialTab);
  const [details, setDetails] = useState(null);
  const [access, setAccess] = useState(null);
  const [loadingD, setLoadingD] = useState(true);
  const [loadingA, setLoadingA] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);

  const loadDetails = useCallback(async () => {
    try {
      const r = await axios.get(`${API}Get`, { params });
      if (r.data.success) setDetails(r.data.data);
      else toast.error(r.data.message || "Failed to load details");
    } catch (e) { toast.error(errMsg(e, "Failed to load details")); onClose(); }
    finally { setLoadingD(false); }
  }, [params]); // eslint-disable-line

  const loadAccess = useCallback(async () => {
    setLoadingA(true);
    try {
      const r = await axios.get(`${API}Access`, { params });
      if (r.data.success) setAccess(r.data.data);
      else toast.error(r.data.message || "Failed to load access");
    } catch (e) { toast.error(errMsg(e, "Failed to load access")); }
    finally { setLoadingA(false); }
  }, [params]);

  useEffect(() => { loadDetails(); }, [loadDetails]);
  useEffect(() => { if (tab === "access" && !access) loadAccess(); }, [tab]); // eslint-disable-line

  const refresh = async () => { await Promise.all([loadAccess(), loadDetails()]); onChanged && onChanged(); };

  const remove = async (e) => {
    if (!window.confirm(`Remove ${e.AccessLabel || e.accessLabel} access for ${e.userName}?`)) return;
    setBusy(true);
    try {
      const r = await axios.post(`${API}Revoke`, { docType: item.docType, id: item.id, kind: e.kind, entryId: e.entryId });
      if (r.data.success) { toast.success("Access removed"); await refresh(); }
      else toast.error(r.data.message || "Failed");
    } catch (err) { toast.error(errMsg(err, "Failed to remove access")); }
    finally { setBusy(false); }
  };

  const toggle = async (e) => {
    setBusy(true);
    try {
      const r = await axios.post(`${API}Toggle`, { docType: item.docType, id: item.id, entryId: e.entryId, isActive: e.status !== "Active" });
      if (r.data.success) { toast.success(e.status === "Active" ? "Access deactivated" : "Access activated"); await refresh(); }
      else toast.error(r.data.message || "Failed");
    } catch (err) { toast.error(errMsg(err, "Failed to update access")); }
    finally { setBusy(false); }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await axios.get(`${API}Export`, { params, responseType: "blob" });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(details?.name || item.name).replace(/[\\/:*?"<>|]/g, "_")}_Access_Report.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) { toast.error("Failed to export the report"); }
    finally { setExporting(false); }
  };

  const entries = access?.entries || [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) =>
      (status === "All" || e.status === status) &&
      (!q || `${e.userName} ${e.email || ""} ${e.accessLabel} ${e.sharedByName || ""}`.toLowerCase().includes(q)));
  }, [entries, status, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [status, search]);

  const s = access?.summary || details?.shared || { total: 0, active: 0, inactive: 0, removed: 0 };
  const Icon = item.docType === "Folder" ? FiFolder : FiFile;

  return (
    <div className="sfd-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="sfd-panel" role="dialog" aria-modal="true" aria-label="Details">
        <header className="sfd-head">
          <span className="sfd-ico"><Icon size={20} /></span>
          <div className="sfd-headtxt">
            <h3 title={item.name}>{item.name}</h3>
            <small>{item.docType === "Folder" ? "Folder" : "Document"} details</small>
          </div>
          <button type="button" className="sfd-x" onClick={onClose} aria-label="Close"><FiX size={18} /></button>
        </header>

        <nav className="sfd-tabs">
          <button className={tab === "details" ? "active" : ""} onClick={() => setTab("details")}><FiInfo size={14} /> Details</button>
          <button className={tab === "access" ? "active" : ""} onClick={() => setTab("access")}>
            <FiShield size={14} /> Manage access{details && <span className="sfd-n">{details.shared.total}</span>}
          </button>
        </nav>

        <div className="sfd-body">
          {tab === "details" && (loadingD ? <div className="sfd-skel" /> : details && (
            <>
              <div className="sfd-cards">
                <div className="sfd-card"><FiUsers /><b>{details.shared.total}</b><span>Shared</span></div>
                <div className="sfd-card ok"><FiUserCheck /><b>{details.shared.active}</b><span>Active</span></div>
                <div className="sfd-card warn"><FiClock /><b>{details.shared.inactive}</b><span>Inactive</span></div>
                <div className="sfd-card bad"><FiUserX /><b>{details.shared.removed}</b><span>Removed</span></div>
              </div>
              <section className="sfd-sec">
                <h6>General</h6>
                <Row label="Name">{details.name}</Row>
                <Row label="Type">{details.type}</Row>
                <Row label="Size">{fmtSize(details.sizeBytes)}</Row>
                {details.docType === "Folder" && <Row label="Contents">{`${details.subFolderCount} subfolder(s), ${details.fileCount} file(s)`}</Row>}
                <Row label="Path"><span className="sfd-path">{details.path}</span></Row>
                <Row label="Version">{`v${details.currentVersion}`}</Row>
                <Row label="Tags">{details.tags ? details.tags.split(",").map((t) => <span key={t} className="sfd-tag">{t}</span>) : null}</Row>
                {details.isHidden && <Row label="Visibility"><span className="sfd-st Inactive">Hidden</span></Row>}
              </section>
              <section className="sfd-sec">
                <h6>Ownership and activity</h6>
                <Row label="Owner">{details.ownerEmail}</Row>
                <Row label="Created by">{details.createdByName}</Row>
                <Row label="Created on">{fmtDate(details.createdOn)}</Row>
                <Row label="Modified by">{details.modifiedByName}</Row>
                <Row label="Modified on">{fmtDate(details.modifiedOn)}</Row>
              </section>
              {details.canManageAccess && (
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setTab("access")}>
                  <FiShield size={14} /> Manage access
                </button>
              )}
            </>
          ))}

          {tab === "access" && (
            <>
              <div className="sfd-cards">
                <div className="sfd-card"><FiUsers /><b>{s.total}</b><span>Total shared</span></div>
                <div className="sfd-card ok"><FiUserCheck /><b>{s.active}</b><span>Active</span></div>
                <div className="sfd-card warn"><FiClock /><b>{s.inactive}</b><span>Inactive</span></div>
                <div className="sfd-card bad"><FiUserX /><b>{s.removed}</b><span>Removed</span></div>
              </div>

              <div className="sfd-bar">
                <div className="sfd-search"><FiSearch size={14} />
                  <input placeholder="Search user, access, shared by" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <button type="button" className="btn btn-primary btn-sm" disabled={exporting || loadingA} onClick={exportExcel}>
                  <FiDownload size={14} /> {exporting ? "Exporting..." : "Export Excel"}
                </button>
              </div>
              <div className="sfd-pills">
                {["All", "Active", "Inactive", "Removed"].map((k) => (
                  <button key={k} className={status === k ? "active" : ""} onClick={() => setStatus(k)}>
                    {k}<span>{k === "All" ? s.total : s[k.toLowerCase()]}</span>
                  </button>
                ))}
              </div>

              {loadingA ? <div className="sfd-skel tall" /> : shown.length === 0 ? (
                <div className="sfd-empty">{entries.length === 0 ? "This item has never been shared." : "No results match your filters."}</div>
              ) : (
                <ul className="sfd-list">
                  {shown.map((e, i) => {
                    const key = `${e.kind}-${e.entryId ?? "r"}-${i}-${page}`;
                    const isOpen = open === key;
                    return (
                      <li key={key} className={`sfd-entry ${e.status}`}>
                        <div className="sfd-main">
                          <span className="sfd-av">{initials(e.userName)}</span>
                          <div className="sfd-who">
                            <b title={e.userName}>{e.userName}</b>
                            <small>{e.email || "-"}{e.kind === "External" ? " (external)" : ""}</small>
                          </div>
                          <span className="sfd-acc">{e.accessLabel}</span>
                          <span className={`sfd-st ${e.status}`}>{e.status}</span>
                          <button type="button" className="sfd-ib" aria-label="More" onClick={() => setOpen(isOpen ? null : key)}>
                            {isOpen ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                          </button>
                        </div>
                        {isOpen && (
                          <div className="sfd-more">
                            <Row label="Shared on">{fmtDate(e.sharedOn)}</Row>
                            <Row label="Shared by">{e.sharedByName}</Row>
                            <Row label="Source">{e.source}</Row>
                            {e.expiresOn && <Row label="Expires on">{fmtDate(e.expiresOn)}</Row>}
                            {e.status === "Removed" && <Row label="Removed on">{fmtDate(e.removedOn)}</Row>}
                            {e.status === "Removed" && <Row label="Removed by">{e.removedByName}</Row>}
                            {(e.canToggle || e.canRemove) && (
                              <div className="sfd-actions">
                                {e.canToggle && (
                                  <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy} onClick={() => toggle(e)}>
                                    {e.status === "Active" ? "Deactivate" : "Activate"}
                                  </button>
                                )}
                                {e.canRemove && (
                                  <button type="button" className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => remove(e)}>
                                    <FiTrash2 size={13} /> Remove access
                                  </button>
                                )}
                              </div>
                            )}
                            {e.source === "Project" && e.status !== "Removed" && (
                              <div className="sfd-note">Granted through a project. Manage it from All Masters, Projects.</div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {pages > 1 && (
                <div className="sfd-pager">
                  <button className="btn btn-outline-primary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                  <span>Page {page} of {pages}</span>
                  <button className="btn btn-outline-primary btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
};

export default ItemDetailsModal;