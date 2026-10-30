import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { BiMenuAltLeft } from "react-icons/bi";
import { HiKey } from "react-icons/hi2";
import {
  FiSearch,
  FiBell,
  FiX,
  FiLogOut,
  FiCheckCircle,
  FiAlertCircle,
  FiUploadCloud,
} from "react-icons/fi";
import { useUpload } from "../Customhook/UploadContext";
import wiproLogoWhite from "../assets/images/wiprologowhite.png";

const config = require("../services/config.json");
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/* Wraps a trigger button + its panel; closes on outside click or Escape. */
const DropdownWrap = ({ open, setOpen, button, children }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <div className="sp-dd" ref={ref}>
      {button}
      {open && (
        <div className="sp-dd-panel" role="menu">
          {children}
        </div>
      )}
    </div>
  );
};

const Header = () => {
  const [showModal, setShowModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [highlightField, setHighlightField] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const personalInfo = useSelector((state) => state.personalInformationReducer);
  const navigate = useNavigate();
  const {
    uploadQueue,
    setShowUploadPanel,
    setIsUploadPanelMinimized,
    clearCompletedUploads,
  } = useUpload();

  const isChangePasswordRequired = safeParse(
    localStorage.getItem("isChangePasswordRequired")
  );

  useEffect(() => {
    if (isChangePasswordRequired === "Yes") {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [isChangePasswordRequired]);

  const currentPasswordRef = useRef(null);
  const newPasswordRef = useRef(null);
  const confirmNewPasswordRef = useRef(null);

  /* ---------------- change password (unchanged logic) ---------------- */
  const handleChangePassword = () => {
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      currentPasswordRef.current?.classList.add("is-invalid");
      currentPasswordRef.current?.focus();
      return;
    } else {
      currentPasswordRef.current?.classList.remove("is-invalid");
    }

    if (!newPassword) {
      toast.error("Please enter a new password.");
      newPasswordRef.current?.classList.add("is-invalid");
      newPasswordRef.current?.focus();
      return;
    } else {
      newPasswordRef.current?.classList.remove("is-invalid");
    }

    if (!confirmNewPassword) {
      toast.error("Please confirm your new password.");
      confirmNewPasswordRef.current?.classList.add("is-invalid");
      confirmNewPasswordRef.current?.focus();
      return;
    } else {
      confirmNewPasswordRef.current?.classList.remove("is-invalid");
    }

    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match.");
      confirmNewPasswordRef.current?.classList.add("is-invalid");
      confirmNewPasswordRef.current?.focus();
      return;
    } else {
      confirmNewPasswordRef.current?.classList.remove("is-invalid");
    }

    if (!passwordRegex.test(newPassword)) {
      const passwordValidationMessage =
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@, $, !, %, *, ?, &).";

      toast.error(passwordValidationMessage);
      setPasswordError(passwordValidationMessage);
      newPasswordRef.current?.classList.add("is-invalid");
      newPasswordRef.current?.focus();
      return;
    } else {
      newPasswordRef.current?.classList.remove("is-invalid");
      setPasswordError("");
    }

    axios
      .post(
        `${config.DDA_API_API_URL}AuthMasterController/ChangePassword`,
        {
          UserID: personalInfo.userID,
          EmployeeId: personalInfo.employeeId,
          CurrentPassword: currentPassword,
          NewPassword: newPassword,
        },
        { headers: config.headers3 }
      )
      .then((response) => {
        if (response.data.success === "error") {
          setPasswordError(response.data.message);
          setHighlightField("currentPassword");
          toast.error(response.data.message);
        } else {
          toast.success("Password changed successfully!");
          const lastChangedPassword = response.data.data.lastChangedPassword;
          if (lastChangedPassword > 0) {
            localStorage.setItem("isChangePasswordRequired", JSON.stringify("No"));
          } else {
            localStorage.setItem("isChangePasswordRequired", JSON.stringify("Yes"));
          }
          setShowModal(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmNewPassword("");
          setPasswordError("");
          setHighlightField(null);
        }
      })
      .catch((error) => {
        if (error.response && error.response.status === 400) {
          const errors = error.response.data.errors;

          if (errors) {
            if (errors.NewPassword) {
              errors.NewPassword.forEach((msg) => toast.error(msg));
              newPasswordRef.current?.focus();
              newPasswordRef.current?.classList.add("is-invalid");
            }

            if (errors.UserID) {
              errors.UserID.forEach((msg) => toast.error(msg));
              currentPasswordRef.current?.focus();
              currentPasswordRef.current?.classList.add("is-invalid");
            }
          } else {
            toast.error("Please correct the highlighted fields.");
          }
        } else {
          const errorMessage =
            error.response?.data?.message || "An error occurred";
          toast.error(errorMessage);
        }
      });
  };

  /* ---------------- logout (unchanged behaviour) ---------------- */
  const handleLogout = () => {
    localStorage.removeItem("persist:pmo_user");
    localStorage.removeItem("isUserAuthenticated");
    localStorage.removeItem("user_id");
    localStorage.clear();

    navigate("/");
    toast.success("User logged out");
  };

  /* ---------------- search ---------------- */
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const term = searchText.trim();
    navigate(term ? `/dashboard?q=${encodeURIComponent(term)}` : "/dashboard");
    setMobileSearchOpen(false);
  };

  const clearSearch = () => {
    setSearchText("");
    navigate("/dashboard");
  };

  /* ---------------- notifications = real upload-queue status ---------------- */
  const uploadingCount = uploadQueue.filter((f) => f.status === "uploading").length;
  const failedCount = uploadQueue.filter((f) => f.status === "failed").length;
  const badgeCount = uploadingCount + failedCount;
  const recentUploads = uploadQueue.slice(-8).reverse();

  const openUploadPanel = () => {
    setShowUploadPanel(true);
    setIsUploadPanelMinimized(false);
    setNotifOpen(false);
  };

  const fullName = `${personalInfo.firstName || ""} ${personalInfo.lastName || ""}`.trim();
  const initial = (personalInfo.firstName || "?").charAt(0).toUpperCase();

  return (
    <>
      <nav className="main-header navbar navbar-expand sp-suitebar" aria-label="Top navigation">
        <div className="sp-suite-left">
          <a
            className="sp-iconbtn"
            data-widget="pushmenu"
            href="#"
            role="button"
            aria-label="Toggle navigation"
          >
            <BiMenuAltLeft size={24} />
          </a>
          <button
            type="button"
            className="sp-brand"
            onClick={() => navigate("/dashboard")}
            aria-label="Go to documents"
          >
            <img src={wiproLogoWhite} alt="Wipro" />
            <span className="sp-brand-text">Document Digitization</span>
          </button>
        </div>

        <form
          className={`sp-search ${mobileSearchOpen ? "is-open" : ""} ${searchText ? "has-text" : ""}`}
          onSubmit={handleSearchSubmit}
          role="search"
        >
          <span className="sp-search-icon">
            <FiSearch size={16} />
          </span>
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search files and folders"
            aria-label="Search files and folders"
          />
          {searchText && (
            <button
              type="button"
              className="sp-search-clear"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <FiX size={16} />
            </button>
          )}
        </form>

        <div className="sp-suite-right">
          <button
            type="button"
            className="sp-iconbtn sp-search-toggle"
            onClick={() => setMobileSearchOpen((v) => !v)}
            aria-label="Search"
          >
            {mobileSearchOpen ? <FiX size={20} /> : <FiSearch size={20} />}
          </button>

          {/* Notifications */}
          <DropdownWrap
            open={notifOpen}
            setOpen={setNotifOpen}
            button={
              <button
                type="button"
                className="sp-iconbtn"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setProfileOpen(false);
                }}
              >
                <FiBell size={20} />
                {badgeCount > 0 && <span className="sp-badge">{badgeCount}</span>}
              </button>
            }
          >
            <div className="sp-dd-head">Notifications</div>
            {recentUploads.length === 0 ? (
              <div className="sp-dd-empty">You&apos;re all caught up.</div>
            ) : (
              <div className="sp-dd-list">
                {recentUploads.map((file) => (
                  <div className="sp-notif-item" key={file.id}>
                    <span
                      className={
                        file.status === "completed"
                          ? "sp-ok"
                          : file.status === "failed"
                            ? "sp-err"
                            : ""
                      }
                    >
                      {file.status === "completed" ? (
                        <FiCheckCircle size={18} />
                      ) : file.status === "failed" ? (
                        <FiAlertCircle size={18} />
                      ) : (
                        <FiUploadCloud size={18} />
                      )}
                    </span>
                    <div className="sp-notif-body">
                      <div className="sp-notif-name" title={file.name}>
                        {file.name}
                      </div>
                      <div className="sp-notif-sub">
                        {file.status === "completed"
                          ? "Upload complete"
                          : file.status === "failed"
                            ? "Upload failed"
                            : `Uploading… ${Math.round(file.progress)}%`}
                      </div>
                      {file.status === "uploading" && (
                        <div className="sp-progress">
                          <span style={{ width: `${file.progress}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {uploadQueue.length > 0 && (
              <div className="sp-dd-foot">
                <button type="button" className="sp-link-btn" onClick={openUploadPanel}>
                  View upload panel
                </button>
                <button
                  type="button"
                  className="sp-link-btn"
                  onClick={clearCompletedUploads}
                  disabled={uploadingCount > 0 && uploadQueue.length === uploadingCount}
                >
                  Clear completed
                </button>
              </div>
            )}
          </DropdownWrap>

          {/* Profile */}
          <DropdownWrap
            open={profileOpen}
            setOpen={setProfileOpen}
            button={
              <button
                type="button"
                className="sp-iconbtn"
                aria-label="Account"
                aria-expanded={profileOpen}
                title={fullName}
                onClick={() => {
                  setProfileOpen((v) => !v);
                  setNotifOpen(false);
                }}
              >
                <span className="sp-avatar">{initial}</span>
              </button>
            }
          >
            <div className="sp-profile-card">
              <span className="sp-avatar sp-avatar--lg">{initial}</span>
              <div>
                <div className="sp-profile-name">{fullName || "User"}</div>
                <div className="sp-profile-sub">{personalInfo.userRole}</div>
                <div className="sp-profile-sub">{personalInfo.emailAddress}</div>
              </div>
            </div>
            <button
              type="button"
              className="sp-menu-item"
              onClick={() => {
                setProfileOpen(false);
                setShowModal(true);
              }}
            >
              <HiKey size={18} /> Change password
            </button>
            <button type="button" className="sp-menu-item" onClick={handleLogout}>
              <FiLogOut size={18} /> Sign out
            </button>
          </DropdownWrap>
        </div>
      </nav>

      {/* Change password modal: markup unchanged so existing custom.css still applies */}
      <div
        className={`change-password-modal modal ${showModal ? "modal-open" : ""}`}
        style={{ display: showModal ? "block" : "none" }}
      >
        <div className="change-password-modal-dialog modal-dialog">
          <div className="change-password-modal-content modal-content">
            <div className="change-password-modal-header modal-header">
              <h4 className="change-password-modal-title text-primary">Change Password</h4>
              <button
                type="button"
                className="change-password-close close"
                onClick={() => setShowModal(false)}
                disabled={isChangePasswordRequired === "Yes"}
              >
                <span>&times;</span>
              </button>
            </div>
            <div className="change-password-modal-body modal-body">
              <div className="form-group">
                <label htmlFor="current-password" className="change-password-label text-primary">
                  Current Password<sup className="required-asterisk">*</sup>
                </label>
                <input
                  type="password"
                  className="change-password-input form-control form-control-sm"
                  ref={currentPasswordRef}
                  id="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current Password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword" className="change-password-label text-primary">
                  New Password<sup className="required-asterisk">*</sup>
                </label>
                <input
                  type="password"
                  className={`change-password-input form-control form-control-sm ${
                    highlightField === "newPassword" &&
                    ((passwordError && newPassword === "") ||
                      (passwordError && passwordError.includes("Passwords do not match")))
                      ? "is-invalid"
                      : ""
                  }`}
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password"
                  ref={newPasswordRef}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmNewPassword" className="change-password-label text-primary">
                  Confirm New Password<sup className="required-asterisk">*</sup>
                </label>
                <input
                  type="password"
                  className="change-password-input form-control form-control-sm"
                  ref={confirmNewPasswordRef}
                  id="confirmNewPassword"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm New Password"
                />
              </div>
              {passwordError && (
                <div className="change-password-alert alert alert-danger text-sm">
                  {passwordError}
                </div>
              )}
            </div>
            <div className="change-password-modal-footer modal-footer">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm change-password-close-button"
                onClick={() => setShowModal(false)}
                disabled={isChangePasswordRequired === "Yes"}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm change-password-save-button"
                onClick={handleChangePassword}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;