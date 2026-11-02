import React, { useState } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import { removeExtraSpaces } from "../../common/textOperations";
import { useLocation, useNavigate } from "react-router-dom";
import bmsLogoWipro from "../../assets/images/bmslogowipro.svg";
import "../login/login.css";

const config = require("../../services/config.json");
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  const userID = params.get("Id");

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage("");
    const password = removeExtraSpaces(newPassword);
    const confirmPassword = removeExtraSpaces(confirmNewPassword);

    if (!password) return setErrorMessage("Please enter your new password.");
    if (!passwordRegex.test(password))
      return setErrorMessage("Password must be at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character (@, $, !, %, *, ?, &).");
    if (!confirmPassword) return setErrorMessage("Please confirm your new password.");
    if (password !== confirmPassword) return setErrorMessage("The passwords do not match.");

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
    <div className="auth-page">
      <main className="auth-card">
        <img className="auth-logo" src={bmsLogoWipro} alt="Wipro" />
        <h1 className="auth-title">Reset password</h1>
        <p className="auth-sub">Choose a new password for your account.</p>
        <form noValidate onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="rp-new">New password</label>
            <input id="rp-new" type="password" className="form-control" autoComplete="new-password"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="rp-confirm">Confirm new password</label>
            <input id="rp-confirm" type="password" className="form-control" autoComplete="new-password"
              value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
          </div>
          <ul className="auth-rules">
            <li>8+ characters, upper and lower case</li>
            <li>At least one number and one of @ $ ! % * ? &amp;</li>
          </ul>
          {errorMessage && <div className="alert alert-danger text-sm" role="alert">{errorMessage}</div>}
          <button type="submit" className="auth-btn auth-btn--primary" disabled={busy}>
            {busy ? "Please wait…" : "Reset password"}
          </button>
        </form>
        <p className="auth-foot"><button type="button" className="auth-link" onClick={() => navigate("/login")}>Back to sign in</button></p>
      </main>
    </div>
  );
};

export default ResetPassword;