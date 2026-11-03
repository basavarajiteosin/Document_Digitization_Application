import React, { useRef, useEffect, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import axios from "axios";
import Switch from "react-switch";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import { removeExtraSpaces } from "../../common/textOperations";
import { useLoader } from "../../Customhook/LoaderContext";
import countryCodes from "../../common/countryCodes.json";
import DataGrid from "../../shared/DataGrid";

const config = require("../../services/config.json");
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const emptyForm = {
  roleId: "", firstName: "", lastName: "", employeeId: "", email: "", password: "",
  countryCode: "", contactNumber: "", designation: "", division: "", isActive: "true", address: "",
};

const UserCreation = () => {
  const personalInfo = useSelector((s) => s.personalInformationReducer);
  const { showLoader, hideLoader } = useLoader();

  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [emailDomains, setEmailDomains] = useState([]);
  const [deleteUser, setDeleteUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const refs = useRef({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const reg = (k) => (el) => { refs.current[k] = el; };

  const fail = (key, msg) => {
    toast.error(msg);
    refs.current[key]?.focus();
    refs.current[key]?.classList.add("is-invalid");
    return false;
  };

  const loadUsers = () => {
    showLoader();
    axios.get(`${config.DDA_API_API_URL}AuthMasterController/GetAllUsers?ClientId=${config.clientId}`, { headers: config.headers2 })
      .then((r) => {
        if (r.data.success === "success") setUsers(r.data.data || []);
        else toast.error(r.data.message);
      })
      .catch(() => toast.error("Oops, something went wrong. Please try again later."))
      .finally(hideLoader);
  };

  useEffect(() => {
    loadUsers();
    axios.get(`${config.DDA_API_API_URL}AuthMasterController/GetAllRoles?ClientId=${config.clientId}`, { headers: config.headers2 })
      .then((r) => r.data.success === "success" && setRoles([...(r.data.data || [])].sort((a, b) => a.roleName.localeCompare(b.roleName))))
      .catch(() => toast.error("Failed to load roles"));
    axios.get(`${config.DDA_API_API_URL}FieldMaster/GetAllDivisionMasters`, { headers: config.headers2 })
      .then((r) => r.data.success && setDivisions([...r.data.data].sort((a, b) => a.description.localeCompare(b.description))))
      .catch(() => {});
    axios.get(`${config.DDA_API_API_URL}FieldMaster/GetAllEmailDomains`, { headers: config.headers2 })
      .then((r) => setEmailDomains(r.data.data || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => { setForm(emptyForm); setEditId(""); setShowForm(false); setShowPwd(false); };

  const handleContact = (e) => {
    const v = e.target.value;
    if (!/^\d*$/.test(v)) return toast.error("Please enter digits only.");
    if (v.length > 11) return toast.error("Contact number must not exceed 11 digits.");
    setForm((f) => ({ ...f, contactNumber: v }));
  };

  const handleCountry = (e) => {
    const c = countryCodes.find((x) => x.name === e.target.value);
    setForm((f) => ({ ...f, countryCode: c ? c.code : "", contactNumber: "" }));
  };

  const handleEdit = (u) => {
    const [cc, num] = (u.contactNumber || "").split("-");
    setForm({
      roleId: u.roleID, firstName: u.firstName || "", lastName: u.lastName || "", employeeId: u.employeeId || "",
      email: u.email || "", password: u.password || "", countryCode: cc || "", contactNumber: num || "",
      designation: u.designation || "", division: String(u.division ?? ""), isActive: String(u.isActive), address: u.address || "",
    });
    setEditId(u.userID);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validate = () => {
    Object.values(refs.current).forEach((el) => el?.classList.remove("is-invalid"));
    if (!form.roleId) return fail("roleId", "Please select role.");
    if (!removeExtraSpaces(form.firstName)) return fail("firstName", "Please enter first name.");
    if (!removeExtraSpaces(form.lastName)) return fail("lastName", "Please enter last name.");
    if (!removeExtraSpaces(form.employeeId)) return fail("employeeId", "Please enter Employee Id.");
    if (!removeExtraSpaces(form.email)) return fail("email", "Please enter email.");
    const domain = form.email.split("@")[1];
    if (!emailDomains.some((d) => d.domain === domain)) return fail("email", "Email domain is not valid.");
    if (!form.password) return fail("password", "Please enter password.");
    if (!passwordRegex.test(form.password))
      return fail("password", "Password must be at least 8 characters with uppercase, lowercase, number and special character (@, $, !, %, *, ?, &).");
    if (!form.contactNumber) return fail("contactNumber", "Please enter contact number.");
    if (!removeExtraSpaces(form.designation)) return fail("designation", "Please enter designation.");
    if (!removeExtraSpaces(form.division)) return fail("division", "Please select division.");
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    showLoader();
    setBusy(true);
    const role = roles.find((r) => r.roleID === form.roleId);
    axios.post(`${config.DDA_API_API_URL}AuthMasterController/${editId ? "UpdateUser" : "CreateUser"}`, {
      createdBy: personalInfo.userID, modifiedBy: personalInfo.userID, clientId: config.clientId,
      userID: editId, roleID: form.roleId, employeeId: form.employeeId, email: form.email, password: form.password,
      contactNumber: `${form.countryCode}-${form.contactNumber}`, designation: form.designation, division: form.division,
      firstName: form.firstName, lastName: form.lastName, address: form.address,
      dateOfBirth: "", joiningDate: "", roleName: role?.roleName,
      isActive: editId ? form.isActive === "true" : true,
    }, { headers: config.headers3 })
      .then((r) => {
        if (r.data.success === "success") {
          toast.success(editId ? "User updated successfully." : "User created successfully.");
          resetForm();
          loadUsers();
        } else toast.error(r.data.message);
      })
      .catch((err) => toast.error(err.response?.data?.message || "Oops, something went wrong. Please try again later."))
      .finally(() => { hideLoader(); setBusy(false); });
  };

  const toggleStatus = async (u) => {
    showLoader();
    try {
      const r = await axios.post(`${config.DDA_API_API_URL}AuthMasterController/UpdateUser`, {
        userID: u.userID, roleID: u.roleID, EmployeeId: u.employeeId, email: u.email, password: u.password,
        contactNumber: u.contactNumber, designation: u.designation, division: u.division,
        firstName: u.firstName, lastName: u.lastName, address: u.address,
        dateOfBirth: u.dateOfBirth, joiningDate: u.joiningDate, roleName: u.roleName,
        isActive: !u.isActive, ClientId: config.clientId, modifiedBy: personalInfo.userID,
      }, { headers: config.headers3 });
      if (r.data.success === "success") { toast.success("User status updated successfully!"); loadUsers(); }
      else toast.error(r.data.message || "Failed to update user status");
    } catch { toast.error("An error occurred while updating user status"); }
    finally { hideLoader(); }
  };

  const confirmDelete = () => {
    showLoader();
    axios.post(`${config.DDA_API_API_URL}AuthMasterController/DeleteUser?ClientId=${config.clientId}&UserID=${deleteUser.userID}`, null, { headers: config.headers2 })
      .then((r) => {
        if (r.data.success === "success") { toast.success("User deleted successfully..."); setDeleteUser(null); loadUsers(); }
        else toast.error(r.data.message);
      })
      .catch((err) => toast.error(err.response?.data?.message || "Oops, something went wrong."))
      .finally(hideLoader);
  };

  const columns = useMemo(() => [
    { key: "sr", label: "#", sortable: false, noExport: true, width: 50, render: (_, i) => i + 1 },
    { key: "employeeId", label: "Employee ID" },
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "contactNumber", label: "Contact" },
    { key: "designation", label: "Designation" },
    { key: "divisionName", label: "Division", value: (u) => u.divisionName || u.division },
    { key: "roleName", label: "Role" },
    {
      key: "status", label: "Status", value: (u) => (u.isActive ? "Active" : "Inactive"),
      render: (u) => (
        <div className="d-flex align-items-center" style={{ gap: 8, opacity: u.roleName === "Administrator" ? 0.5 : 1, pointerEvents: u.roleName === "Administrator" ? "none" : "auto" }}>
          <span className={`dg-badge ${u.isActive ? "dg-badge--ok" : "dg-badge--off"}`}>{u.isActive ? "Active" : "Inactive"}</span>
          <Switch checked={u.isActive} width={30} height={15} onChange={() => toggleStatus(u)} />
        </div>
      ),
    },
    {
      key: "actions", label: "Actions", sortable: false, noExport: true,
      render: (u) => (
        <div className="dg-actions">
          <button type="button" className="btn bg-gradient-warning btn-xs" title="Edit" onClick={() => handleEdit(u)}><FiEdit2 size={13} /></button>
          <button type="button" className="btn bg-gradient-danger btn-xs" title="Delete" disabled={u.roleName === "Administrator"} onClick={() => setDeleteUser(u)}><FiTrash2 size={13} /></button>
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [users]);

  const Field = ({ id, label, children, className = "col-md-4" }) => (
    <div className={`form-group ${className}`}>
      <label htmlFor={id}>{label}<sup>*</sup></label>
      {children}
    </div>
  );

  return (
    <>
      <section className="content scroll-content">
        <div className="container-fluid">
          {showForm && (
            <form className="card card-primary card-outline" onSubmit={handleSubmit} noValidate>
              <div className="card-header"><h3 className="card-title text-sm">{editId ? "Edit User" : "Create New User"}</h3></div>
              <div className="card-body text-sm">
                <div className="row">
                  <Field id="roleId" label="Select Role">
                    <select id="roleId" ref={reg("roleId")} className="form-control form-control-sm" value={form.roleId} onChange={set("roleId")}>
                      <option value="">--Select--</option>
                      {roles.map((r) => <option key={r.roleID} value={r.roleID}>{r.roleName}</option>)}
                    </select>
                  </Field>
                  <Field id="firstName" label="First Name"><input id="firstName" ref={reg("firstName")} className="form-control form-control-sm" value={form.firstName} onChange={set("firstName")} placeholder="First Name" /></Field>
                  <Field id="lastName" label="Last Name"><input id="lastName" ref={reg("lastName")} className="form-control form-control-sm" value={form.lastName} onChange={set("lastName")} placeholder="Last Name" /></Field>
                  <Field id="employeeId" label="Employee ID"><input id="employeeId" ref={reg("employeeId")} className="form-control form-control-sm" value={form.employeeId} onChange={set("employeeId")} placeholder="Employee ID" /></Field>
                  <Field id="email" label="Email"><input id="email" ref={reg("email")} className="form-control form-control-sm" value={form.email} onChange={set("email")} placeholder="Email" /></Field>
                  <Field id="password" label="Password">
                    <div className="input-group">
                      <input id="password" ref={reg("password")} type={showPwd ? "text" : "password"} className="form-control form-control-sm" value={form.password} onChange={set("password")} placeholder="Password" />
                      <button type="button" className="btn btn-default btn-sm" onClick={() => setShowPwd((v) => !v)}>{showPwd ? "Hide" : "Show"}</button>
                    </div>
                  </Field>
                  <Field id="contactNumber" label="Contact Number" className="col-md-8">
                    <div className="input-group">
                      <select className="form-control form-control-sm" value={countryCodes.find((c) => c.code === form.countryCode)?.name || ""} onChange={handleCountry}>
                        <option value="" disabled hidden>Select Country</option>
                        {countryCodes.map((c, i) => <option key={`${c.code}-${i}`} value={c.name}>{c.name}</option>)}
                      </select>
                      <input className="form-control form-control-sm" style={{ maxWidth: 90 }} value={form.countryCode} placeholder="code" disabled />
                      <input id="contactNumber" ref={reg("contactNumber")} className="form-control form-control-sm" value={form.contactNumber} onChange={handleContact} placeholder="Enter Contact Number" disabled={!form.countryCode} />
                    </div>
                  </Field>
                  <Field id="designation" label="Designation"><input id="designation" ref={reg("designation")} className="form-control form-control-sm" value={form.designation} onChange={set("designation")} placeholder="Enter Designation" /></Field>
                  <Field id="division" label="Division">
                    <select id="division" ref={reg("division")} className="form-control form-control-sm" value={form.division} onChange={set("division")}>
                      <option value="" disabled hidden>Select Division</option>
                      {divisions.map((d) => <option key={d.divisionId} value={String(d.divisionId)}>{d.description}</option>)}
                    </select>
                  </Field>
                  {editId && (
                    <Field id="isActive" label="Status">
                      <select id="isActive" className="form-control form-control-sm" value={form.isActive} onChange={set("isActive")}>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </Field>
                  )}
                </div>
              </div>
              <div className="card-footer text-sm">
                <button type="submit" className="btn btn-primary float-right btn-xs ml-2" disabled={busy}>{editId ? "Update & Submit" : "Save & Submit"}</button>
                <button type="button" className="btn btn-default float-right btn-xs" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          )}

          <div className="card card-primary card-outline">
            <div className="card-header pg-head">
              <h3 className="card-title text-sm">Users</h3>
              {!showForm && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}><FiPlus size={14} /> Add user</button>
              )}
            </div>
            <div className="card-body text-sm">
              <DataGrid
                title="Users List"
                columns={columns}
                data={users}
                rowKey="userID"
                exportName="Users"
                filterColumns={["roleName", "divisionName", "status"]}
              />
            </div>
          </div>
        </div>
      </section>

      {deleteUser && (
        <div className="sp-dialog-backdrop" role="dialog" aria-modal="true">
          <div className="sp-dialog">
            <div className="sp-dialog-head"><h2>Are you sure?</h2></div>
            <div className="sp-dialog-body">
              Delete <b>{deleteUser.firstName} {deleteUser.lastName}</b>? Once deleted it cannot be recovered.
            </div>
            <div className="sp-dialog-foot">
              <button className="btn btn-default btn-sm" onClick={() => setDeleteUser(null)}>Cancel</button>
              <button className="btn btn-warning btn-sm" onClick={confirmDelete}>Yes, delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserCreation;