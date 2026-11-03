import React, { useRef, useEffect, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import axios from "axios";
import Select from "react-select";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import { useLoader } from "../../Customhook/LoaderContext";
import DataGrid from "../../shared/DataGrid";

const config = require("../../services/config.json");

const selectStyles = {
  control: (s, st) => ({
    ...s, minHeight: 34, fontSize: 13, borderRadius: 11,
    borderColor: st.isFocused ? "#2563eb" : "#dbe3f0", boxShadow: st.isFocused ? "0 0 0 3px rgba(37,99,235,.16)" : "none",
  }),
  multiValue: (s) => ({ ...s, background: "#eaf1ff", borderRadius: 999 }),
  multiValueLabel: (s) => ({ ...s, color: "#1d4ed8", fontSize: 11, fontWeight: 600 }),
  multiValueRemove: (s) => ({ ...s, color: "#1d4ed8", borderRadius: 999, ":hover": { background: "#c7dbff", color: "#e11d48" } }),
};

const ManageRoles = () => {
  const personalInfo = useSelector((s) => s.personalInformationReducer);
  const { showLoader, hideLoader } = useLoader();
  const nameRef = useRef(null);

  const [roles, setRoles] = useState([]);
  const [apps, setApps] = useState([]);
  const [roleName, setRoleName] = useState("");
  const [selectedApps, setSelectedApps] = useState([]);
  const [editId, setEditId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleteRole, setDeleteRole] = useState(null);

  const appName = (id) => apps.find((a) => a.appID === id)?.appName || "";
  const appOptions = apps.map((a) => ({ value: a.appID, label: a.appName }));

  const loadRoles = () => {
    showLoader();
    axios.get(`${config.DDA_API_API_URL}AuthMasterController/GetAllRoles?ClientId=${config.clientId}`, { headers: config.headers2 })
      .then((r) => {
        if (r.data.success === "success") setRoles(r.data.data || []);
        else toast.error(r.data.message);
      })
      .catch(() => toast.error("Oops, something went wrong. Please try again later."))
      .finally(hideLoader);
  };

  useEffect(() => {
    axios.get(`${config.DDA_API_API_URL}AuthMasterController/GetAllApps`, { headers: config.headers2 })
      .then((r) => { if (r.data.success === "success") setApps(r.data.data || []); else toast.error(r.data.message); })
      .catch(() => toast.error("Oops, something went wrong. Please try again later."));
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => { setRoleName(""); setSelectedApps([]); setEditId(""); setShowForm(false); nameRef.current?.classList.remove("is-invalid"); };

  const handleEdit = (r) => {
    setEditId(r.roleID);
    setRoleName(r.roleName);
    setSelectedApps((r.appIDList || []).map((id) => ({ value: id, label: appName(id) })));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!roleName.trim()) {
      toast.error("Please enter role name.");
      nameRef.current?.classList.add("is-invalid");
      nameRef.current?.focus();
      return;
    }
    if (selectedApps.length === 0) return toast.error("Select apps.");
    showLoader();
    axios.post(`${config.DDA_API_API_URL}AuthMasterController/${editId ? "UpdateRole" : "CreateRole"}`, {
      roleID: editId, createdBy: personalInfo.userID, modifiedBy: personalInfo.userID, clientId: config.clientId,
      roleName: roleName.trim(), appIDList: selectedApps.map((a) => a.value), isActive: true,
    }, { headers: config.headers2 })
      .then((r) => {
        if (r.data.success === "success") {
          toast.success(editId ? "Role updated successfully." : "Role created successfully.");
          reset();
          loadRoles();
        } else toast.error(r.data.message);
      })
      .catch((err) => toast.error(err.response?.data?.message || "Oops, something went wrong. Please try again later."))
      .finally(hideLoader);
  };

  const confirmDelete = () => {
    showLoader();
    axios.post(`${config.DDA_API_API_URL}AuthMasterController/DeleteRole?roleId=${deleteRole.roleID}`, null, { headers: config.headers2 })
      .then((r) => {
        if (r.data.success === "success") { toast.success("Role deleted successfully..."); setDeleteRole(null); loadRoles(); }
        else toast.error(r.data.message);
      })
      .catch((err) => toast.error(err.response?.data?.message || "Oops, something went wrong."))
      .finally(hideLoader);
  };

  const columns = useMemo(() => [
    { key: "sr", label: "#", sortable: false, noExport: true, width: 60, render: (_, i) => i + 1 },
    { key: "roleName", label: "Role Name" },
    {
      key: "apps", label: "Apps", value: (r) => (r.appIDList || []).map(appName).join(", "),
      render: (r) => (r.appIDList || []).map((id) => <span key={id} className="dg-badge dg-badge--app">{appName(id)}</span>),
    },
    { key: "appCount", label: "App Count", value: (r) => (r.appIDList || []).length, width: 100 },
    {
      key: "actions", label: "Actions", sortable: false, noExport: true, width: 100,
      render: (r) => (
        <div className="dg-actions">
          <button type="button" className="btn bg-gradient-warning btn-xs" title="Edit" onClick={() => handleEdit(r)}><FiEdit2 size={13} /></button>
          <button type="button" className="btn bg-gradient-danger btn-xs" title="Delete" onClick={() => setDeleteRole(r)}><FiTrash2 size={13} /></button>
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [apps, roles]);

  return (
    <>
      <section className="content scroll-content">
        <div className="container-fluid">
          {showForm && (
            <form className="card card-primary card-outline" onSubmit={handleSubmit} noValidate>
              <div className="card-header"><h3 className="card-title text-sm">{editId ? "Edit Role" : "Create New Role"}</h3></div>
              <div className="card-body text-sm">
                <div className="row">
                  <div className="form-group col-md-6">
                    <label htmlFor="roleName">Role Name<sup>*</sup></label>
                    <input id="roleName" ref={nameRef} className="form-control form-control-sm" value={roleName}
                      onChange={(e) => setRoleName(e.target.value)} placeholder="Role Name" />
                  </div>
                  <div className="form-group col-md-6">
                    <label>Select Apps<sup>*</sup></label>
                    <Select isMulti options={appOptions} value={selectedApps} onChange={(s) => setSelectedApps(s || [])}
                      placeholder="Select Apps.." styles={selectStyles} />
                  </div>
                </div>
              </div>
              <div className="card-footer text-sm">
                <button type="submit" className="btn btn-primary float-right btn-xs ml-2">{editId ? "Update & Submit" : "Save & Submit"}</button>
                <button type="button" className="btn btn-outline-primary float-right btn-xs" onClick={reset}>Cancel</button>
              </div>
            </form>
          )}

          <div className="card card-primary card-outline">
            <div className="card-header pg-head">
              <h3 className="card-title text-sm">Roles</h3>
              {!showForm && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}><FiPlus size={14} /> Add role</button>
              )}
            </div>
            <div className="card-body text-sm">
              <DataGrid title="Roles List" columns={columns} data={roles} rowKey="roleID" exportName="Roles" />
            </div>
          </div>
        </div>
      </section>

      {deleteRole && (
        <div className="sp-dialog-backdrop" role="dialog" aria-modal="true">
          <div className="sp-dialog">
            <div className="sp-dialog-head"><h2>Are you sure?</h2></div>
            <div className="sp-dialog-body">
              Delete the role <b>{deleteRole.roleName}</b> and its app mappings? This cannot be recovered.
            </div>
            <div className="sp-dialog-foot">
              <button className="btn btn-default btn-sm" onClick={() => setDeleteRole(null)}>Cancel</button>
              <button className="btn btn-warning btn-sm" onClick={confirmDelete}>Yes, delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ManageRoles;