import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FiX, FiFolder, FiFile } from "react-icons/fi";
import { SpFacepile } from "../../shared/SpAvatar";

const config = require("../../services/config.json");
const API = `${config.DDA_API_API_URL}Projects/`;

const ACCESS = [
  { v: "1", title: "Read-only", desc: "Members can view the item." },
  { v: "2", title: "Read/Write", desc: "Members can view, edit and upload." },
  { v: "3", title: "Read/Write/Download", desc: "Members can also download." },
];

/** item = { docType: "Folder" | "Document", id: number, name: string } */
const AssignProjectModal = ({ item, onClose }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [accessType, setAccessType] = useState("");

  useEffect(() => {
    axios
      .get(`${API}List`)
      .then((res) => {
        if (res.data.success) setProjects((res.data.data || []).filter((p) => p.isActive));
        else toast.error(res.data.message || "Failed to load projects");
      })
      .catch((e) => toast.error(e.response?.data?.message || "Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  const selectedProject = projects.find((p) => String(p.projectId) === String(projectId));

  const assign = async () => {
    if (!projectId) return toast.error("Please select a project.");
    if (!accessType) return toast.error("Please select an access type.");
    setBusy(true);
    try {
      const res = await axios.post(`${API}AssignItem`, {
        projectId: Number(projectId),
        docType: item.docType,
        folderOrFileId: item.id,
        accessType: Number(accessType),
      });
      if (res.data.success) {
        toast.success("Assigned. Project members now have access.");
        onClose();
      } else toast.error(res.data.message || "Assign failed");
    } catch (e) {
      toast.error(e.response?.data?.message || "Assign failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sp-dlg-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sp-dlg sp-dlg--sm" role="dialog" aria-modal="true" aria-label="Assign to project">
        <div className="sp-dlg-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="sp-dlg-title">Assign to project</h2>
            <div className="sp-dlg-sub">
              {item.docType === "Folder" ? <FiFolder size={14} /> : <FiFile size={14} />} {item.name}
            </div>
          </div>
          <button type="button" className="sp-icon-btn" onClick={onClose} aria-label="Close"><FiX size={18} /></button>
        </div>

        <div className="sp-dlg-body">
          {loading ? (
            <div aria-busy="true">
              <span className="sp-skel" style={{ height: 34, margin: "8px 0" }} />
              <span className="sp-skel" style={{ height: 60, margin: "8px 0" }} />
            </div>
          ) : projects.length === 0 ? (
            <div className="sp-empty">No active projects. Create one under All Masters → Projects.</div>
          ) : (
            <>
              <div className="form-group">
                <label>Project</label>
                <select className="form-control form-control-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">Select a project</option>
                  {projects.map((p) => (
                    <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
                  ))}
                </select>
                {selectedProject && (
                  <div className="d-flex align-items-center mt-2" style={{ gap: 8 }}>
                    <SpFacepile names={selectedProject.members.map((m) => m.name)} max={5} />
                    <span className="sp-hint">
                      {selectedProject.members.length === 0
                        ? "No members yet"
                        : `${selectedProject.members.length} member(s) will get access`}
                    </span>
                  </div>
                )}
              </div>

              <div className="form-group mb-0">
                <label>Permission</label>
                <div className="sp-choices">
                  {ACCESS.map((a) => (
                    <label key={a.v} className={`sp-choice ${accessType === a.v ? "selected" : ""}`}>
                      <input type="radio" name="projAccess" value={a.v} checked={accessType === a.v} onChange={(e) => setAccessType(e.target.value)} />
                      <div>
                        <strong>{a.title}</strong>
                        <span>{a.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="sp-dlg-foot">
          <button className="btn btn-outline-primary btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={assign} disabled={busy || loading || projects.length === 0}>
            {busy ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignProjectModal;