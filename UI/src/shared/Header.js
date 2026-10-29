import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import { useUserContext } from "../components/UserContext/UserContext";
import "react-toastify/dist/ReactToastify.css";
import { RiMenuFoldFill, RiMenuUnfoldFill } from "react-icons/ri";
import { RiMenuFill } from "react-icons/ri";
import { GrSettingsOption } from "react-icons/gr";
import { GiExpander } from "react-icons/gi";
import { ImKey2 } from "react-icons/im";
import { HiKey } from "react-icons/hi2";
import { BiMenuAltLeft } from "react-icons/bi";
const config = require("../services/config.json");
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const Header = () => {
  const [showModal, setShowModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [highlightField, setHighlightField] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const personalInfo = useSelector((state) => state.personalInformationReducer);

  // const { isChangePasswordRequired } = useUserContext();
  // console.log(isChangePasswordRequired, "isChangePassword");
  const navigate = useNavigate();
  const location = useLocation();

  const routeToComponentMap = {
    "/dashboard": "Dashboard",
    "/create-user": "User Creation",
    "/manage-roles": "Manage Roles",
    "/reports": "Reports",
    "/folder-access-report": "Folder Access Report",
    "/email-config": "Email Configuration",
    "/create-entity": "Create Entity",
    "/form-builder": "Form Builder",
    "/directors-creation": "Directors Creation",
    "/all-masters": "All Masters",
    "/field-masters": "Field Master",
    "/entities-data": "Entities Data",
    "/attchment-masters": "Attachment Masters",
  };

  const isChangePasswordRequired = JSON.parse(localStorage.getItem('isChangePasswordRequired'));

  useEffect(() => {
    if (isChangePasswordRequired === "Yes") {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [isChangePasswordRequired]);

  const getComponentNameFromPath = (path) => {
    return routeToComponentMap[path] || "Unknown";
  };

  const componentName = getComponentNameFromPath(location.pathname);

  const currentPasswordRef = useRef(null);
  const newPasswordRef = useRef(null);
  const confirmNewPasswordRef = useRef(null);

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

    // Password validation
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
            localStorage.setItem('isChangePasswordRequired', JSON.stringify("No"));
          } else {
            localStorage.setItem('isChangePasswordRequired', JSON.stringify("Yes"));
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


  const handleLogout = () => {
    setIsLoggingOut(true);

    // Clear local storage
    localStorage.removeItem("persist:pmo_user");
    localStorage.removeItem("isUserAuthenticated");
    localStorage.removeItem("user_id");
    localStorage.clear();

    // Navigate to home page
    navigate("/");

    // Notify user
    toast.success("User logged out");

    setIsLoggingOut(false);
  };
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    // Toggle the pushmenu state
    setIsMenuOpen(!isMenuOpen);

    // Trigger the pushmenu widget if necessary
    if (window.$ && window.$.fn.pushmenu) {
      window.$('body').toggleClass('sidebar-collapse');
    }
  };

  useEffect(() => {
    // Listen for the menu collapse event if necessary (optional)
    const handleMenuToggle = () => setIsMenuOpen(!document.body.classList.contains('sidebar-collapse'));

    window.addEventListener('menu-toggle', handleMenuToggle);

    return () => {
      window.removeEventListener('menu-toggle', handleMenuToggle);
    };
  }, []);

  return (
    <>
      <nav className="main-header navbar navbar-expand">
        <ul className="navbar-nav">
          <li className="nav-item d-flex">
            <a
              className="nav-link "
              data-widget="pushmenu"
              href="#"
              role="button"
            >
              {/* <i className="fas fa-bars"></i> */}
              <BiMenuAltLeft style={{ width: "28px", height: "28px", fontWeight: "bold" }} />
            </a>
            {/* <h5 className="nav-link" style={{color:"#fff",paddingLeft:"0px"}}>
              {componentName}
            </h5> */}
          </li>
        </ul>

        <ul className="navbar-nav ml-auto">
          {/* <li className="nav-item">
            <a
              className="nav-link"
              data-widget="fullscreen"
              href="#"
              role="button"
            >
              <i className="fas fa-expand-arrows-alt"></i>
            </a>
          </li> */}
          <li className="nav-item">
            <a
              className="nav-link"
              href="#"
              role="button"
              onClick={() => setShowModal(true)}
            >

              <HiKey style={{ width: "22px", height: "22px", fontWeight: "bold" }} />
            </a>
          </li>
          {/* <li className="nav-item dropdown show">
            <a
              className="nav-link"
              data-toggle="dropdown"
              href="#"
              aria-expanded="true"
            >
             <GrSettingsOption style={{width:"22px",height:"22px",fontWeight:"bold"}} />
            </a>
            <div
              className="dropdown-menu dropdown-menu-sm dropdown-menu-right"
              style={{ left: "inherit", right: "0px" }}
            >
              <a
                href="#"
                style={{ cursor: "pointer" }}
                className="dropdown-item"
                onClick={handleLogout}
              >
                <i className="fas fa-sign-out-alt mr-2"></i> Logout
              </a>
            </div>
          </li> */}
          <li className="nav-item dropdown show">
            {/* <a
    className="nav-link"
    data-toggle="dropdown"
    href="#"
    aria-expanded="true"
  >
    <GrSettingsOption style={{ width: "22px", height: "22px", fontWeight: "bold" }} />
  </a> */}
            <div
              className="nav-link"
              data-toggle="dropdown"
              // href="#"
              aria-expanded="true"
            >
              {/* Display First Letter of First Name */}
              <div className="personal-info" >
                {personalInfo.firstName.charAt(0).toUpperCase()}
              </div>
            </div>
            <div
              className="dropdown-menu dropdown-menu-sm dropdown-menu-right"
              style={{ left: "inherit", right: "0px" }}
            >
              {/* User Information */}
              <div className="info p-2 text-center">
                <span className="">
                  {personalInfo.firstName} {personalInfo.lastName}
                </span>
                <span


                  className="personal-role"
                >
                  ({personalInfo.userRole})
                </span>
              </div>

              {/* Divider */}
              <div className="dropdown-divider"></div>

              {/* Logout Option */}
              <a
                href="#"
                style={{ cursor: "pointer" }}
                className="dropdown-item"
                onClick={handleLogout}
              >
                <i className="fas fa-sign-out-alt mr-2"></i> Logout
              </a>
            </div>
          </li>

        </ul>
      </nav>


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
                <label
                  htmlFor="currentPassword"
                  className="change-password-label text-primary"
                >
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
                <label
                  htmlFor="newPassword"
                  className="change-password-label text-primary"
                >
                  New Password<sup className="required-asterisk">*</sup>
                </label>
                <input
                  type="password"
                  className={`change-password-input form-control form-control-sm ${highlightField === "newPassword" &&
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
                <label
                  htmlFor="confirmNewPassword"
                  className="change-password-label text-primary"
                >
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
