import React, { useState, useMemo } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { removeExtraSpaces } from "../../common/textOperations";
import bmsLogoWipro from "../../assets/images/bmslogowipro.svg";
import "./resetpassword.css";

const config = require("../../services/config.json");
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const RULES = [
  ["8+ characters", (p) => p.length >= 8],
  ["Uppercase letter", (p) => /[A-Z]/.test(p)],
  ["Lowercase letter", (p) => /[a-z]/.test(p)],
  ["A number", (p) => /\d/.test(p)],
  ["One of @ $ ! % * ? &", (p) => /[@$!%*?&]/.test(p)],
];

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  const userID = params.get("Id");

  const passed = useMemo(() => RULES.filter(([, t]) => t(newPassword)).length, [newPassword]);
  const strength = newPassword ? (passed <= 2 ? "weak" : passed < 5 ? "fair" : "strong") : "";

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage("");
    const password = removeExtraSpaces(newPassword);
    const confirm = removeExtraSpaces(confirmNewPassword);

    if (!password) return setErrorMessage("Please enter your new password.");
    if (!passwordRegex.test(password)) return setErrorMessage("Your password does not meet all the requirements below.");
    if (!confirm) return setErrorMessage("Please confirm your new password.");
    if (password !== confirm) return setErrorMessage("The passwords do not match.");

    setBusy(true);
    axios
      .post(config.DDA_API_API_URL + "AuthMasterController/ForgotPassword",
        { userID, emailAddress: "", newPassword: password, token },
        { headers: config.headers2 })
      .then((response) => {
        if (response.status === 200 && response.data.success === "success") {
          toast.success(response.data.message);
          setTimeout(() => navigate("/login"), 1200);
        } else {
          setBusy(false);
          toast.error(response.data.message || "Invalid request");
        }
      })
      .catch((error) => {
        const data = error.response?.data;
        toast.error(data?.errors?.NewPassword?.join(" ") || data?.message || (error.response ? "Request failed" : "Network error"));
        setBusy(false);
      });
  };

  return (
    <div className="rp-page">
      <span className="rp-orb rp-orb--a" aria-hidden="true" />
      <span className="rp-orb rp-orb--b" aria-hidden="true" />
      <main className="rp-card" role="main">
        <div className="rp-badge" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>
        <img className="rp-logo" src={bmsLogoWipro} alt="Wipro" />
        <h1 className="rp-title">Create a new password</h1>
        <p className="rp-sub">Choose a strong password you haven't used before.</p>

        <form noValidate onSubmit={handleSubmit}>
          <div className="rp-field">
            <label htmlFor="rp-new">New password</label>
            <div className="rp-input">
              <input id="rp-new" type={show ? "text" : "password"} autoComplete="new-password"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <button type="button" className="rp-eye" onClick={() => setShow((v) => !v)}>{show ? "Hide" : "Show"}</button>
            </div>
            <div className={`rp-meter ${strength}`} aria-hidden="true"><span /><span /><span /></div>
            {strength && <small className={`rp-strength ${strength}`}>Strength: {strength}</small>}
          </div>

          <div className="rp-field">
            <label htmlFor="rp-confirm">Confirm password</label>
            <div className="rp-input">
              <input id="rp-confirm" type={show ? "text" : "password"} autoComplete="new-password"
                value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
            </div>
          </div>

          <ul className="rp-rules">
            {RULES.map(([label, test]) => (
              <li key={label} className={test(newPassword) ? "ok" : ""}>{label}</li>
            ))}
          </ul>

          {errorMessage && <div className="rp-error" role="alert">{errorMessage}</div>}

          <button type="submit" className="rp-btn" disabled={busy}>{busy ? "Please wait…" : "Reset password"}</button>
        </form>

        <button type="button" className="rp-back" onClick={() => navigate("/login")}>← Back to sign in</button>
      </main>
    </div>
  );
};

export default ResetPassword;