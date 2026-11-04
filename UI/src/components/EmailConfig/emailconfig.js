import React, { useState, useRef, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FiMail, FiServer, FiEye, FiEyeOff, FiSave, FiX, FiFileText, FiLock, FiUser, FiShield, FiHash, FiMonitor } from "react-icons/fi";
import "./emailconfig.css";

const config = require("../../services/config.json");
const API = `${config.DDA_API_API_URL}EmailCofigureController/`;

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// placeholders understood by EmailService for each template id
const TOKENS = {
  1: ["@DearUser@", "@LoginLink@", "@UserName@", "@Password@"],
  2: ["@UserName@", "@ResetLink@"],
  3: ["@DearUser@", "@LoginLink@", "@UserName@"],
  4: ["@fromEmail@", "@toEmail@", "@docType@", "@docName@", "@siteURL@"],
  5: ["@fromEmail@", "@toEmail@", "@docType@", "@docName@", "@siteURL@"],
  6: ["@UserName@", "@otp@"],
  7: ["@OwnerName@", "@ActingUser@", "@Action@", "@ItemType@", "@ItemName@", "@FolderName@"],
};
const SAMPLE = {
  "@DearUser@": "Alex Morgan", "@LoginLink@": "#", "@UserName@": "alex.morgan@wipro.com", "@Password@": "••••••••",
  "@ResetLink@": "#", "@fromEmail@": "jordan.lee@wipro.com", "@toEmail@": "alex.morgan@wipro.com", "@docType@": "Folder",
  "@docName@": "Q3 Contracts", "@siteURL@": "#", "@otp@": "482915", "@OwnerName@": "Alex Morgan", "@ActingUser@": "Jordan Lee",
  "@Action@": "uploaded", "@ItemType@": "file", "@ItemName@": "Invoice.pdf", "@FolderName@": "Q3 Contracts",
};

const EmailConfiguration = () => {
  /* ---------------- SMTP ---------------- */
  const [mailID, setMailID] = useState("");
  const [mailPassword, setMailPassword] = useState("");
  const [smtpServer, setSmtpServer] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [userName, setUserName] = useState("");
  const [isSSL, setSsl] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const refs = useRef({});
  const reg = (k) => (el) => { refs.current[k] = el; };

  const fetchData = () => {
    axios.get(`${API}GetMailConfiguration`)
      .then((r) => {
        if (r.data.success === "success") {
          const d = r.data.data || {};
          setMailID(d.mailID || ""); setMailPassword(d.mailPassword || "");
          setSmtpServer(d.smtpServer || ""); setSmtpPort(d.smtpPort || "");
          setUserName(d.userName || ""); setSsl(String(d.isSSL) === "true" ? "true" : "false");
        } else toast.error(r.data.message);
      })
      .catch((e) => toast.error(e.response?.data?.message || "Oops, something went wrong. Please try again later."));
  };

  const validate = () => {
    const e = {};
    if (!mailID.trim()) e.mailID = "Please enter mail ID.";
    else if (!isValidEmail(mailID)) e.mailID = "Please enter a valid mail ID.";
    if (!mailPassword.trim()) e.mailPassword = "Please enter password.";
    if (!smtpServer.trim()) e.smtpServer = "Please enter SMTP server.";
    if (!String(smtpPort).trim()) e.smtpPort = "Please enter SMTP port.";
    if (!userName.trim()) e.userName = "Please enter username.";
    if (!isSSL.trim()) e.isSSL = "Please select SSL option.";
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) { toast.error(e[first]); refs.current[first]?.focus(); }
    return !first;
  };

  const handleSave = () => {
    if (!validate()) return;
    setSaving(true);
    axios.post(`${API}UpdateMailConfiguration`, { id: 1, mailID, mailPassword, userName, smtpServer, smtpPort, isSSL }, { headers: config.headers2 })
      .then((r) => {
        if (r.data.success === "success") { toast.success("Configuration saved successfully."); fetchData(); }
        else toast.error(r.data.message);
      })
      .catch((e) => toast.error(e.response?.data?.message || "Oops, something went wrong. Please try again later."))
      .finally(() => setSaving(false));
  };

  const handleCancel = () => { setErrors({}); fetchData(); };

  /* ---------------- Templates ---------------- */
  const [templates, setTemplates] = useState([]);       // [{ id, mailType }]
  const [selected, setSelected] = useState(null);       // { id, mailType }
  const [subject, setSubject] = useState("");
  const [subjectErr, setSubjectErr] = useState(false);
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  const [preview, setPreview] = useState(null);         // html string
  const [previewMode, setPreviewMode] = useState("desktop");
  const subjectRef = useRef(null);

  useEffect(() => {
    fetchData();
    window.initSummernoteFuncation();
    axios.get(`${API}GetAllMailBodyConfigurations`, { headers: config.headers2 })
      .then((r) => {
        if (r.status === 200 && r.data.success) setTemplates((r.data.data || []).map((c) => ({ id: c.id, mailType: c.mailType })));
        else toast.error("Failed to load email configurations.");
      })
      .catch(() => toast.error("Oops, something went wrong while fetching email configurations."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTemplate = (t) => {
    setLoadingTpl(true);
    axios.get(`${API}GetMailBodyConfigurationByEmailType?emailType=${encodeURIComponent(t.mailType)}`, { headers: config.headers2 })
      .then((r) => {
        if (r.status === 200 && r.data.success && r.data.data) {
          const d = r.data.data;
          setSelected({ id: d.id, mailType: t.mailType });
          setSubject(d.mailSubject || ""); setSubjectErr(false);
          window.setSummerNoteValueFuncation(d.mailBody);
        } else toast.error(r.data.message || "Template not found.");
      })
      .catch(() => toast.error("Oops, something went wrong. Please try again later."))
      .finally(() => setLoadingTpl(false));
  };

  const insertToken = (tk) => {
    if (!selected || !window.$) return;
    const $s = window.$("#summernote");
    $s.summernote("focus");
    $s.summernote("editor.insertText", tk);
  };

  const handleEmailSubmit = () => {
    if (!selected) return toast.error("Select an email template first.");
    const body = window.getSummerNoteValueFuncation();
    if (!subject.trim()) { setSubjectErr(true); toast.error("Please enter email subject."); subjectRef.current?.focus(); return; }
    if (!body || body === "<p><br></p>") return toast.error("Please enter email body.");
    setSavingTpl(true);
    axios.post(`${API}UpdateMailBodyConfiguration`, { id: selected.id, mailType: selected.mailType, mailBody: body, mailSubject: subject },
      { headers: { ...config.headers3, "Content-Type": "application/json-patch+json" } })
      .then((r) => r.data.success ? toast.success("Email configuration saved successfully.") : toast.error(r.data.message))
      .catch((e) => toast.error(e.response?.data?.message || "Oops, something went wrong. Please try again later."))
      .finally(() => setSavingTpl(false));
  };

  const openPreview = () => {
    let html = window.getSummerNoteValueFuncation() || "";
    (TOKENS[selected?.id] || []).forEach((t) => { html = html.split(t).join(SAMPLE[t] || t); });
    setPreview(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f1f5f9">${html}</body></html>`);
  };

  const tokens = useMemo(() => (selected ? TOKENS[selected.id] || [] : []), [selected]);

  const err = (k) => errors[k] && <small className="ec-err">{errors[k]}</small>;
  const cls = (k) => `ec-input ${errors[k] ? "invalid" : ""}`;

  return (
    <section className="content scroll-content">
      <div className="container-fluid ec">
        <header className="ec-hero">
          <span className="ec-hero-ico"><FiMail size={22} /></span>
          <div><h2>Email configuration</h2><p>Manage the outgoing mail server and the content of every system email.</p></div>
        </header>

        {/* ---------- SMTP ---------- */}
        <div className="ec-card">
          <div className="ec-card-h"><span className="ec-badge"><FiServer size={15} /></span><div><h3>Mail server (SMTP)</h3><small>Credentials used to send all notifications</small></div></div>
          <div className="ec-grid">
            <div className="ec-f"><label htmlFor="mailID">Email<sup>*</sup></label>
              <div className="ec-wrap"><FiMail size={14} /><input id="mailID" ref={reg("mailID")} className={cls("mailID")} value={mailID} onChange={(e) => setMailID(e.target.value)} placeholder="Enter your mail ID" /></div>{err("mailID")}</div>
            <div className="ec-f"><label htmlFor="mailPassword">Password<sup>*</sup></label>
              <div className="ec-wrap"><FiLock size={14} /><input id="mailPassword" ref={reg("mailPassword")} type={showPwd ? "text" : "password"} className={cls("mailPassword")} value={mailPassword} onChange={(e) => setMailPassword(e.target.value)} placeholder="Enter mail password" autoComplete="new-password" />
                <button type="button" className="ec-eye" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? "Hide password" : "Show password"}>{showPwd ? <FiEyeOff size={15} /> : <FiEye size={15} />}</button></div>{err("mailPassword")}</div>
            <div className="ec-f"><label htmlFor="smtpServer">SMTP server<sup>*</sup></label>
              <div className="ec-wrap"><FiServer size={14} /><input id="smtpServer" ref={reg("smtpServer")} className={cls("smtpServer")} value={smtpServer} onChange={(e) => setSmtpServer(e.target.value)} placeholder="smtp.example.com" /></div>{err("smtpServer")}</div>
            <div className="ec-f"><label htmlFor="smtpPort">SMTP port<sup>*</sup></label>
              <div className="ec-wrap"><FiHash size={14} /><input id="smtpPort" ref={reg("smtpPort")} className={cls("smtpPort")} value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" inputMode="numeric" /></div>{err("smtpPort")}</div>
            <div className="ec-f"><label htmlFor="userName">Username<sup>*</sup></label>
              <div className="ec-wrap"><FiUser size={14} /><input id="userName" ref={reg("userName")} className={cls("userName")} value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Enter username" /></div>{err("userName")}</div>
            <div className="ec-f"><label htmlFor="isSSL">SSL<sup>*</sup></label>
              <div className="ec-wrap"><FiShield size={14} /><select id="isSSL" ref={reg("isSSL")} className={cls("isSSL")} value={isSSL} onChange={(e) => setSsl(e.target.value)}>
                <option value="">Select SSL option</option><option value="true">Yes</option><option value="false">No</option></select></div>{err("isSSL")}</div>
          </div>
          <div className="ec-actions">
            <button type="button" className="ec-btn" onClick={handleCancel} disabled={saving}><FiX size={14} /> Cancel</button>
            <button type="button" className="ec-btn primary" onClick={handleSave} disabled={saving}><FiSave size={14} /> {saving ? "Saving..." : "Save & submit"}</button>
          </div>
        </div>

        {/* ---------- Templates ---------- */}
        <div className="ec-card">
          <div className="ec-card-h"><span className="ec-badge"><FiFileText size={15} /></span><div><h3>Mail content</h3><small>Select a template, edit the subject and body, then save</small></div></div>
          <div className="ec-pills" role="tablist">
            {templates.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={selected?.id === t.id} className={`ec-pill ${selected?.id === t.id ? "active" : ""}`} onClick={() => openTemplate(t)}>{t.mailType}</button>
            ))}
          </div>

          <div className={`ec-editor ${selected ? "" : "is-idle"}`}>
            {!selected && <div className="ec-hint"><FiMail size={30} /><p>Choose a template above to start editing.</p></div>}
            <div className="ec-f"><label htmlFor="mailIDSubject">Mail subject<sup>*</sup></label>
              <input id="mailIDSubject" ref={subjectRef} className={`ec-input ${subjectErr ? "invalid" : ""}`} value={subject} disabled={!selected || loadingTpl}
                onChange={(e) => { setSubject(e.target.value); setSubjectErr(false); }} placeholder="Enter mail subject" /></div>
            {tokens.length > 0 && (
              <div className="ec-tokens"><span>Placeholders</span>
                {tokens.map((t) => <button key={t} type="button" className="ec-token" onClick={() => insertToken(t)} title="Insert at cursor">{t}</button>)}
              </div>
            )}
            <div className="ec-f"><label>Email body message<sup>*</sup></label><textarea id="summernote" /></div>
            <div className="ec-actions">
              <button type="button" className="ec-btn" disabled={!selected} onClick={openPreview}><FiEye size={14} /> Preview</button>
              <button type="button" className="ec-btn primary" disabled={!selected || savingTpl} onClick={handleEmailSubmit}><FiSave size={14} /> {savingTpl ? "Saving..." : "Save email configuration"}</button>
            </div>
          </div>
        </div>
      </div>

      {preview && (
        <div className="ec-overlay" onMouseDown={(e) => e.target === e.currentTarget && setPreview(null)}>
          <div className="ec-modal" role="dialog" aria-modal="true" aria-label="Email preview">
            <div className="ec-modal-h">
              <h4>Preview - {selected?.mailType}</h4>
              <div className="ec-seg">
                <button type="button" className={previewMode === "desktop" ? "active" : ""} onClick={() => setPreviewMode("desktop")}><FiMonitor size={14} /> Desktop</button>
                <button type="button" className={previewMode === "mobile" ? "active" : ""} onClick={() => setPreviewMode("mobile")}>Mobile</button>
              </div>
              <button type="button" className="ec-x" onClick={() => setPreview(null)} aria-label="Close"><FiX size={18} /></button>
            </div>
            <div className="ec-modal-b"><iframe title="Email preview" srcDoc={preview} className={previewMode === "mobile" ? "is-mobile" : ""} /></div>
          </div>
        </div>
      )}
    </section>
  );
};

export default EmailConfiguration;