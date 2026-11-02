import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Select from "react-select";
import { toast } from "react-toastify";
import { FiEdit2, FiTrash2, FiX, FiFolder, FiFile, FiUsers } from "react-icons/fi";
import { SpFacepile } from "../../../shared/SpAvatar";

const config = require("../../../services/config.json");
const API = `${config.DDA_API_API_URL}Projects/`;
const ACCESS = { 1: "Read-only", 2: "Read/Write", 3: "Read/Write/Download" };
const errMsg = (e, fb) => e.response?.data?.message || fb;

const selectStyles = {
  control: (s, st) => ({
    ...s, minHeight: 32, fontSize: 13, borderRadius: 2,
    borderColor: st.isFocused ? "#0078d4" : "#8a8886",
    boxShadow: st.isFocused ? "0 0 0 1px #0078d4" : "none",
  }),
  multiValue: (s) => ({ ...s, background: "#eff6fc", borderRadius: 12 }),
  multiValueLabel: (s) => ({ ...s, color: "#323130", fontSize: 12 }),
  multiValueRemove: (s) => ({ ...s, color: "#605e5c", borderRadius: 12, ":hover": { background: "#c7e0f4", color: "#d13438" } }),
};

const ProjectMaster = () => {
  const nameRef = useRef(null);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [editId, setEditId] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [division, setDivision] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selected, setSelected] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}List`);
      if (res.data.success) setProjects(res.data.data || []);
      else toast.error(res.data.message || "Failed to load projects");
    } catch (e) {
      toast.error(errMsg(e, "Failed to load projects"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    axios
      .get(`${config.DDA_API_API_URL}AuthMasterController/GetAllUsers?ClientId=dmsApp`)
      .then((r) => setUsers((r.data.data || []).filter((u) => u.isActive)))
      .catch(() => {});
    axios
      .get(`${config.DDA_API_API_URL}FieldMaster/GetAllDivisionMasters`)
      .then((r) => setDivisions((r.data.data || []).sort((a, b) => a.description.localeCompare(b.description))))
      .catch(() => {});
  }, []);

  const userOptions = users.map((u) => ({
    value: u.userID,
    label: `${u.firstName} ${u.lastName} (${u.email})`,
    division: u.division,
  }));

  const reset = () => {
    setEditId(null); setName(""); setDescription(""); setDivision(""); setIsActive(true); setSelected([]);
    nameRef.current?.classList.remove("is-invalid");
  };

  const addAllFromDepartment = () => {
    if (!division) return toast.error("Select a department first.");
    const deptUsers = userOptions.filter((o) => o.division === division);
    if (deptUsers.length === 0) return toast.info("No active users in this department.");
    const map = new Map(selected.map((s) => [s.value, s]));
    deptUsers.forEach((o) => map.set(o.value, o));
    setSelected([...map.values()]);
    toast.success(`${deptUsers.length} user(s) from ${division} added.`);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter the project name.");
      nameRef.current?.classList.add("is-invalid");
      nameRef.current?.focus();
      return;
    }
    try {
      const res = await axios.post(`${API}Save`, {
        projectId: editId, projectName: name, description, division, isActive,
        userIds: selected.map((s) => s.value),
      });
      if (res.data.success) {
        toast.success(editId ? "Project updated" : "Project created");
        reset();
        load();
      } else toast.error(res.data.message || "Save failed");
    } catch (err) {
      toast.error(errMsg(err, "Save failed"));
    }
  };

  const handleEdit = (p) => {
    setEditId(p.projectId);
    setName(p.projectName);
    setDescription(p.description || "");
    setDivision(p.division || "");
    setIsActive(p.isActive);
    setSelected(
      p.members.map((m) => userOptions.find((x) => x.value === m.userId) || { value: m.userId, label: m.name })
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete project "${p.projectName}"? Access granted through it will be removed.`)) return;
    try {
      const res = await axios.post(`${API}Delete/${p.projectId}`);
      if (res.data.success) {
        toast.success("Project deleted");
        if (editId === p.projectId) reset();
        load();
      } else toast.error(res.data.message || "Delete failed");
    } catch (err) {
      toast.error(errMsg(err, "Delete failed"));
    }
  };

  const handleUnassign = async (item) => {
    if (!window.confirm(`Remove "${item.name}" from this project? Members will lose the access granted through it.`)) return;
    try {
      const res = await axios.post(`${API}UnassignItem/${item.piId}`);
      if (res.data.success) { toast.success("Removed from project"); load(); }
      else toast.error(res.data.message || "Failed");
    } catch (err) {
      toast.error(errMsg(err, "Failed"));
    }
  };

  return (
    <div>
      {/* ---------- Create / edit form ---------- */}
      <form className="sp-pj-form" onSubmit={handleSave}>
        <div className="sp-pj-formtitle">{editId ? "Edit project" : "New project"}</div>
        <div className="row">
          <div className="form-group col-md-4">
            <label>Project name <span className="text-danger">*</span></label>
            <input
              type="text" ref={nameRef} className="form-control form-control-sm" maxLength={200}
              placeholder="Enter project name" value={name} onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-group col-md-4">
            <label>Department (optional)</label>
            <div className="d-flex">
              <select className="form-control form-control-sm" value={division} onChange={(e) => setDivision(e.target.value)}>
                <option value="">None</option>
                {divisions.map((d) => <option key={d.divisionId} value={d.description}>{d.description}</option>)}
              </select>
              <button type="button" className="sp-cmd ml-1" onClick={addAllFromDepartment} title="Add every active user of this department">
                <FiUsers size={16} />Add all
              </button>
            </div>
          </div>
          <div className="form-group col-md-4">
            <label>Description (optional)</label>
            <input
              type="text" className="form-control form-control-sm" maxLength={1000}
              placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-group col-md-12">
            <label>Members</label>
            <Select
              isMulti options={userOptions} value={selected} onChange={(s) => setSelected(s || [])}
              placeholder="Search and select users..." styles={selectStyles}
            />
          </div>
        </div>
        <div className="d-flex align-items-center justify-content-between">
          <div>
            {editId && (
              <div className="custom-control custom-switch">
                <input type="checkbox" className="custom-control-input" id="projectActiveSwitch" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <label className="custom-control-label" htmlFor="projectActiveSwitch">{isActive ? "Active" : "Inactive"}</label>
              </div>
            )}
          </div>
          <div>
            {editId && <button type="button" className="btn btn-outline-primary btn-sm mr-2" onClick={reset}>Cancel</button>}
            <button type="submit" className="btn btn-primary btn-sm">{editId ? "Save changes" : "Create project"}</button>
          </div>
        </div>
      </form>

      {/* ---------- Project cards ---------- */}
      <div className="sp-pj-count">{loading ? "Loading..." : `${projects.length} project(s)`}</div>

      {loading ? (
        <div className="sp-pj-grid" aria-busy="true">
          {[0, 1, 2].map((i) => <span key={i} className="sp-skel" style={{ height: 150 }} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="sp-empty">No projects yet. Create one above.</div>
      ) : (
        <div className="sp-pj-grid">
          {projects.map((p) => (
            <div key={p.projectId} className={`sp-pj-card ${p.isActive ? "" : "inactive"}`}>
              <div className="sp-pj-head">
                <div className="sp-pj-tile">{(p.projectName || "?").charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sp-pj-name" title={p.projectName}>{p.projectName}</div>
                  <div className="sp-pj-meta">{p.division || "No department"}</div>
                </div>
                <span className="sp-pill">{p.isActive ? "Active" : "Inactive"}</span>
                <button className="sp-icon-btn" title="Edit" aria-label="Edit" onClick={() => handleEdit(p)}><FiEdit2 size={16} /></button>
                <button className="sp-icon-btn danger" title="Delete" aria-label="Delete" onClick={() => handleDelete(p)}><FiTrash2 size={16} /></button>
              </div>

              {p.description && <div className="sp-pj-desc">{p.description}</div>}

              <div>
                <div className="sp-pj-section">Members</div>
                <div className="sp-pj-members">
                  {p.members.length === 0 ? (
                    <span className="sp-hint">No members</span>
                  ) : (
                    <>
                      <SpFacepile names={p.members.map((m) => m.name)} max={5} />
                      <span className="sp-hint">{p.members.length} member(s)</span>
                    </>
                  )}
                </div>
              </div>

              <div>
                <div className="sp-pj-section">Folders and files</div>
                {p.items.length === 0 ? (
                  <span className="sp-hint">Use "Assign to Project" in a folder's or file's menu.</span>
                ) : (
                  <div className="sp-pj-items">
                    {p.items.map((it) => (
                      <span key={it.piId} className="sp-itemchip" title={`${it.name} - ${ACCESS[it.accessType]}`}>
                        {it.docType === "Folder" ? <FiFolder size={14} /> : <FiFile size={14} />}
                        <span className="name">{it.name}</span>
                        <span className="acc">· {ACCESS[it.accessType]}</span>
                        <button type="button" aria-label="Remove from project" title="Remove from project" onClick={() => handleUnassign(it)}>
                          <FiX size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectMaster;