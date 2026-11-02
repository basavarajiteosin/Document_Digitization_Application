import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { FiX, FiDownload, FiRotateCcw, FiLock, FiUnlock, FiUploadCloud, FiFile } from "react-icons/fi";
import { useCollab } from "../../hooks/useCollab";
import { SpAvatar, SpFacepile } from "../../shared/SpAvatar";

const config = require("../../services/config.json");
const API = `${config.DDA_API_API_URL}FileVersion/`;

const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "-");
const fmtSize = (b) => {
  b = Number(b) || 0;
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + " GB";
  if (b >= 1048576) return (b / 1048576).toFixed(2) + " MB";
  if (b >= 1024) return (b / 1024).toFixed(2) + " KB";
  return b + " Bytes";
};
const errMsg = (e, fb) => e.response?.data?.message || fb;

/** file = { id: fileId, name: string } */
const FileVersionsModal = ({ file, onClose, onChanged }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newFile, setNewFile] = useState(null);
  const [note, setNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}List`, { params: { fileId: file.id } });
      if (res.data.success) setData(res.data.data);
      else toast.error(res.data.message || "Failed to load versions");
    } catch (e) {
      toast.error(errMsg(e, "Failed to load versions"));
    } finally {
      setLoading(false);
    }
  }, [file.id]);

  useEffect(() => { load(); }, [load]);

  // ---- real-time ----
  const myId = (useSelector((s) => s.personalInformationReducer.userID) || "").toLowerCase();
  const { viewers } = useCollab(file.id, {
    onFileChanged: (p) => {
      if (p.byUserId === myId) return;
      toast.info(`${p.byName} ${p.message}`);
      load();
      onChanged && onChanged();
    },
  });
  const others = viewers.filter((v) => v.userId !== myId);

  const refreshAll = async () => { await load(); onChanged && onChanged(); };

  const pick = (f) => { if (f) setNewFile(f); };

  const upload = async () => {
    if (!newFile) return toast.error("Please choose a file.");
    const fd = new FormData();
    fd.append("FileId", file.id);
    fd.append("File", newFile);
    fd.append("Note", note);
    fd.append("ExpectedVersion", data.currentVersion);
    setBusy(true);
    try {
      const res = await axios.post(`${API}Upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (res.data.success) {
        toast.success(data.lockedByMe ? "New version saved and file checked in" : "New version uploaded");
        setNewFile(null);
        setNote("");
        if (inputRef.current) inputRef.current.value = "";
        await refreshAll();
      } else toast.error(res.data.message || "Upload failed");
    } catch (e) {
      toast.error(errMsg(e, "Upload failed"));
      load();
    } finally {
      setBusy(false);
    }
  };

  const restore = async (v) => {
    if (!window.confirm(`Restore v${v.versionNumber}? The current version will be kept in history.`)) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API}Restore/${v.versionId}`);
      if (res.data.success) { toast.success("Version restored"); await refreshAll(); }
      else toast.error(res.data.message || "Restore failed");
    } catch (e) {
      toast.error(errMsg(e, "Restore failed"));
      load();
    } finally {
      setBusy(false);
    }
  };

  const lockAction = async (path, okMsg) => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}${path}`);
      if (res.data.success) { toast.success(okMsg); await refreshAll(); }
      else toast.error(res.data.message || "Request failed");
    } catch (e) {
      toast.error(errMsg(e, "Request failed"));
      load();
    } finally {
      setBusy(false);
    }
  };
  const checkOut = () => lockAction(`CheckOut/${file.id}`, "File checked out. Others can't upload until you check it in.");
  const release = () => {
    if (!window.confirm("Release the check-out without saving a new version?")) return;
    lockAction(`Release/${file.id}`, "Check-out released");
  };

  const download = async (v) => {
    if (v.isCurrent) {
      const a = document.createElement("a");
      a.href = `${config.DDA_API_API_URL}FolderData/DownloadFile?fileId=${file.id}`;
      a.target = "_self";
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    try {
      const res = await axios.get(`${API}Download`, { params: { versionId: v.versionId }, responseType: "blob" });
      const ext = v.fileName.includes(".") ? "." + v.fileName.split(".").pop() : "";
      const base = v.fileName.replace(/\.[^.]+$/, "");
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}_v${v.versionNumber}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download this version");
    }
  };

  return (
    <div className="sp-dlg-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sp-dlg" role="dialog" aria-modal="true" aria-label="Version history">
        <div className="sp-dlg-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="sp-dlg-title">Version history</h2>
            <div className="sp-dlg-sub"><FiFile size={14} /> {file.name}</div>
          </div>
          <div className="sp-dlg-headright">
            {others.length > 0 && (
              <>
                <span className="sp-presence-label">Also viewing</span>
                <SpFacepile names={others.map((v) => v.name)} />
              </>
            )}
            <button type="button" className="sp-icon-btn" onClick={onClose} aria-label="Close"><FiX size={18} /></button>
          </div>
        </div>

        <div className="sp-dlg-body">
          {loading ? (
            <div aria-busy="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className="sp-skel" style={{ height: 44, margin: "8px 0", width: `${100 - i * 8}%` }} />
              ))}
            </div>
          ) : !data ? (
            <div className="sp-empty">Unable to load version history.</div>
          ) : (
            <>
              {/* Check-out status */}
              <div className={`sp-msgbar ${data.isLocked ? "sp-msgbar--warn" : "sp-msgbar--info"}`}>
                <span className="sp-msgbar-text">
                  {data.isLocked ? <FiLock size={16} /> : <FiUnlock size={16} />}
                  <span>
                    {data.isLocked
                      ? <>
                          {data.lockedByMe ? "You have checked out this file" : <>Checked out by <strong>{data.lockedByName}</strong></>}
                          {data.lockedOn ? ` since ${fmtDate(data.lockedOn)}` : ""}
                        </>
                      : "Not checked out. Anyone with edit access can check it out."}
                  </span>
                </span>
                <span className="sp-msgbar-actions">
                  {data.canCheckOut && (
                    <button className="sp-cmd" disabled={busy} onClick={checkOut}><FiLock size={16} />Check out</button>
                  )}
                  {(data.lockedByMe || data.canForceRelease) && (
                    <button className="sp-cmd" disabled={busy} onClick={release}>
                      <FiUnlock size={16} />{data.lockedByMe ? "Release" : "Force release"}
                    </button>
                  )}
                </span>
              </div>

              {/* Upload new version */}
              {data.canUpload && (
                <div
                  className={`sp-drop ${dragging ? "dragging" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
                >
                  <label className="sp-drop-pick">
                    <FiUploadCloud size={20} />
                    <span>{newFile ? <strong>{newFile.name}</strong> : "Click or drag a file here to upload a new version"}</span>
                    <input
                      type="file"
                      ref={inputRef}
                      style={{ display: "none" }}
                      onChange={(e) => pick(e.target.files?.[0])}
                    />
                  </label>
                  <div className="sp-drop-row">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      maxLength={500}
                      placeholder="What changed? (optional)"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <button className="btn btn-primary btn-sm" disabled={busy || !newFile} onClick={upload}>
                      {busy ? "Please wait..." : "Upload"}
                    </button>
                  </div>
                  <div className="sp-hint">
                    Must be the same file type.{data.lockedByMe ? " Uploading will also check the file in." : ""}
                  </div>
                </div>
              )}

              {/* Version list */}
              <div className="sp-vlist">
                {data.versions.map((v) => (
                  <div key={v.isCurrent ? "current" : v.versionId} className={`sp-vrow ${v.isCurrent ? "current" : ""}`}>
                    <div className="sp-vbadge">v{v.versionNumber}</div>
                    <div className="sp-vmain">
                      <div className="sp-vtop">
                        <SpAvatar name={v.createdByName} />
                        <span>{v.createdByName}</span>
                        {v.isCurrent && <span className="sp-pill">Current</span>}
                      </div>
                      <div className="sp-vsub">{fmtDate(v.createdOn)} · {fmtSize(v.size)}</div>
                      {v.note && <div className="sp-vnote">{v.note}</div>}
                    </div>
                    <div className="sp-vactions">
                      <button className="sp-icon-btn" title="Download" aria-label="Download" onClick={() => download(v)}>
                        <FiDownload size={16} />
                      </button>
                      {!v.isCurrent && data.canUpload && (
                        <button className="sp-icon-btn" title="Restore this version" aria-label="Restore" disabled={busy} onClick={() => restore(v)}>
                          <FiRotateCcw size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="sp-dlg-foot">
          <button className="btn btn-outline-primary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default FileVersionsModal;