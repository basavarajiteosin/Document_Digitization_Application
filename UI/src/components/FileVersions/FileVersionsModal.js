import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";

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
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
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

  const upload = async () => {
    if (!newFile) return toast.error("Please choose a file.");
    const fd = new FormData();
    fd.append("FileId", file.id);
    fd.append("File", newFile);
    fd.append("Note", note);
    setBusy(true);
    try {
      const res = await axios.post(`${API}Upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (res.data.success) {
        toast.success("New version uploaded");
        setNewFile(null);
        setNote("");
        if (inputRef.current) inputRef.current.value = "";
        await load();
        onChanged && onChanged();
      } else toast.error(res.data.message || "Upload failed");
    } catch (e) {
      toast.error(errMsg(e, "Upload failed"));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (v) => {
    if (!window.confirm(`Restore v${v.versionNumber}? The current version will be kept in history.`)) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API}Restore/${v.versionId}`);
      if (res.data.success) {
        toast.success("Version restored");
        await load();
        onChanged && onChanged();
      } else toast.error(res.data.message || "Restore failed");
    } catch (e) {
      toast.error(errMsg(e, "Restore failed"));
    } finally {
      setBusy(false);
    }
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
    } catch (e) {
      toast.error("Failed to download this version");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content-shared-access">
        <div className="modal-header">
          <h5 className="modal-title">Version History - {file.name}</h5>
          <button className="close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body text-sm shared-access-body">
          {loading ? (
            <div className="text-center"><p>Loading versions...</p></div>
          ) : !data ? (
            <div className="text-center"><p>Unable to load version history.</p></div>
          ) : (
            <>
              {data.canUpload && (
                <div className="mb-3 p-3" style={{ border: "1px solid var(--sp-border, #edebe9)", borderRadius: 4 }}>
                  <label className="mb-1">Upload a new version</label>
                  <input
                    type="file"
                    ref={inputRef}
                    className="form-control form-control-sm mb-2"
                    onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                  />
                  <input
                    type="text"
                    className="form-control form-control-sm mb-2"
                    maxLength={500}
                    placeholder="What changed? (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button className="btn btn-primary btn-sm" disabled={busy || !newFile} onClick={upload}>
                    {busy ? "Please wait..." : "Upload version"}
                  </button>
                  <small className="text-muted ml-2">Must be the same file type as the original.</small>
                </div>
              )}

              <div className="table-responsive">
                <table className="shared-access-table">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Modified</th>
                      <th>Modified by</th>
                      <th>Size</th>
                      <th>Note</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.versions.map((v) => (
                      <tr key={v.isCurrent ? "current" : v.versionId}>
                        <td>
                          v{v.versionNumber} {v.isCurrent && <span className="sp-pill ml-1">Current</span>}
                        </td>
                        <td>{fmtDate(v.createdOn)}</td>
                        <td>{v.createdByName}</td>
                        <td>{fmtSize(v.size)}</td>
                        <td>{v.note || "-"}</td>
                        <td>
                          <button className="btn btn-xs btn-outline-primary mr-1" title="Download" onClick={() => download(v)}>
                            <i className="fas fa-download"></i>
                          </button>
                          {!v.isCurrent && data.canUpload && (
                            <button className="btn btn-xs btn-outline-primary" title="Restore this version" disabled={busy} onClick={() => restore(v)}>
                              <i className="fas fa-undo"></i>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

export default FileVersionsModal;