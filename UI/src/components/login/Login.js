// Login.js
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import { tokenStorage } from '../../axiosInstance/setupAxiosInterceptors';
import { removeExtraSpaces } from "../../common/textOperations";
import { useDispatch } from "react-redux";
import { PublicClientApplication } from "@azure/msal-browser";
import { setUserPersonalInformation } from "../../reduxStorage/personalInformation";
import { useUserContext } from "../UserContext/UserContext";
import "./login.css";
import {
  isValidEmail,
  isValidContact,
  isValidPassword,
} from "../../common/validations";
import countryCodes from '../../common/countryCodes.json';
import bmsLogoWipro from "../../assets/images/bmslogowipro.svg";
import bmswhiteLogoWipro from "../../assets/images/wiprologowhite.png";
import { useUpload } from "../../Customhook/UploadContext";

const config = require("../../services/config.json");

// Microsoft Authentication (MSAL Browser)
let msalInstance = null;
let msalInitializationPromise = null;

const initializeMSAL = async () => {
  if (msalInstance) return msalInstance;
  if (msalInitializationPromise) return msalInitializationPromise;

  msalInitializationPromise = (async () => {
    const clientId = process.env.REACT_APP_MICROSOFT_CLIENT_ID;
    const tenantId = process.env.REACT_APP_MICROSOFT_TENANT_ID;

    if (!clientId || !tenantId) {
      throw new Error(
        "Microsoft authentication is not configured. Check REACT_APP_MICROSOFT_CLIENT_ID and REACT_APP_MICROSOFT_TENANT_ID."
      );
    }

    const instance = new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: "sessionStorage",
      },
    });

    await instance.initialize();
    await instance.handleRedirectPromise();

    msalInstance = instance;
    return instance;
  })();

  try {
    return await msalInitializationPromise;
  } catch (error) {
    msalInstance = null;
    msalInitializationPromise = null;
    throw error;
  }
};

const Login = () => {
  const inputUserEmailReference = useRef(null);
  const inputUserPasswordReference = useRef(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { setUploadQueue, setShowUploadPanel } = useUpload();

  const [forgotPasswordClick, setForgotPassworClick] = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userForgotEmail, setUserForgotEmail] = useState("");
  const [userForgotConfirmEmail, setUserForgotConfirmEmail] = useState("");
  const [isLoaderActive, setIsLoaderActive] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { setIsChangePasswordRequired } = useUserContext();

  const handleForgotPassword = () => {
    setUserEmail("");
    setUserPassword("");
    setForgotPassworClick(true);
  };

  const handleSignIn = () => {
    setUserForgotEmail("");
    setUserForgotConfirmEmail("");
    setForgotPassworClick(false);
  };

  const [isOTPSent, setIsOTPSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const dispatchAndNavigate = (data) => {
    tokenStorage.save(data.token);

    localStorage.setItem(
      "isChangePasswordRequired",
      JSON.stringify(data.isChangePasswordRequired)
    );
    localStorage.setItem("user_id", data.userID);
    localStorage.setItem("user_role_id", data.roleID);
    localStorage.setItem("isUserAuthenticated", "true");

    dispatch(
      setUserPersonalInformation({
        userID: data.userID,
        employeeId: data.employeeId,
        userRole: data.userRole,
        roleID: data.roleID,
        displayName: data.displayName,
        emailAddress: data.emailAddress,
        menuItemNames: data.menuItemNames,
        token: data.token,
        profilePic: data.profilePic,
        firstName: data.firstName,
        lastName: data.lastName,
        clientId: "",
        designation: data.designation,
        division: data.division,
        divisionName: data.divisionName,
        isChangePasswordRequired: data.isChangePasswordRequired,
      })
    );

    const allowedRoutes = data.menuItemNames?.map((m) => m.appRoute) || [];
    let dest = location.state?.from?.pathname;

    if (!dest || !allowedRoutes.includes(dest)) {
      dest = data.menuItemNames?.[0]?.appRoute || "/dashboard";
    }

    setTimeout(() => {
      setLoading(false);
      setMsLoading(false);
      navigate(dest, { replace: true });
    }, 800);
  };

  const handleSignInAccount = () => {
    if (!isValidEmail(userEmail) && !userEmail) {
      toast.error("Please enter a valid email or employee ID.");
      inputUserEmailReference.current?.classList.add("is-invalid");
      inputUserEmailReference.current?.focus();
      return;
    } else {
      inputUserEmailReference.current?.classList.remove("is-invalid");
    }

    if (!isValidPassword(userPassword)) {
      toast.error("Please enter a valid password.");
      inputUserPasswordReference.current?.classList.add("is-invalid");
      inputUserPasswordReference.current?.focus();
      return;
    } else {
      inputUserPasswordReference.current?.classList.remove("is-invalid");
    }

    setIsLoaderActive(true);

    axios
      .post(
        config.DDA_API_API_URL + "AuthController/token",
        {
          employeeId: userEmail,
          password: userPassword,
          clientId: "dmsApp",
        },
        {
          headers: config.headers2,
        }
      )
      .then((response) => {
        if (response.data.success === "error") {
          toast.error(response.data.message);
          setIsLoaderActive(false);
          return;
        }

        const responseData = response.data.data;

        if (responseData.message === "OTP Sent") {
          setIsOTPSent(true);
          toast.info("OTP has been sent. Please enter the OTP to proceed.");

          localStorage.setItem("email", responseData.emailAddress);
          localStorage.setItem("userId", responseData.userID);

          setIsLoaderActive(false);
        } else {
          localStorage.setItem(
            "isChangePasswordRequired",
            JSON.stringify(responseData.isChangePasswordRequired)
          );

          localStorage.setItem("user_id", responseData.userID);
          localStorage.setItem("isUserAuthenticated", "true");

          setUploadQueue([]);
          setShowUploadPanel(false);

          dispatch(
            setUserPersonalInformation({
              userID: responseData.userID,
              employeeId: responseData.employeeId,
              userRole: responseData.userRole,
              displayName: responseData.displayName,
              emailAddress: responseData.emailAddress,
              menuItemNames: responseData.menuItemNames,
              token: responseData.token,
              profilePic: responseData.profilePic,
              firstName: responseData.firstName,
              lastName: responseData.lastName,
              clientId: "",
              designation: responseData.designation,
              division: responseData.division,
              divisionName: responseData.divisionName,
              isChangePasswordRequired: responseData.isChangePasswordRequired,
            })
          );

          const firstRoute = responseData.menuItemNames?.[0]?.appRoute || "/dashboard";

          setTimeout(() => {
            setIsLoaderActive(false);
            navigate(firstRoute);
          }, 1000);
        }
      })
      .catch((error) => {
        console.error("Standard sign-in failed:", error);
        toast.error("An unexpected error occurred. Please try again later.");
        setIsLoaderActive(false);
      });
  };

  const handleMicrosoftSignIn = async () => {
    if (msLoading) return;

    setMsLoading(true);

    try {
      const msal = await initializeMSAL();
      const loginResponse = await msal.loginPopup({
        scopes: ["openid", "profile", "email"],
      });

      if (!loginResponse?.idToken) {
        throw new Error("Microsoft sign-in returned no ID token.");
      }

      const response = await axios.post(
        `${config.DDA_API_API_URL}AuthController/microsoft-token`,
        { idToken: loginResponse.idToken },
        {
          headers: {
            ...config.headers2,
            "Content-Type": "application/json",
          },
        }
      );

      const body = response?.data;

      if (!body || body.success === "error" || body.success === false) {
        throw new Error(body?.message || "The API rejected Microsoft authentication.");
      }

      const data = body.data ?? body;

      if (!data?.token) {
        throw new Error(
          "Microsoft sign-in succeeded, but the API did not return the application's JWT token."
        );
      }

      dispatchAndNavigate(data);
      toast.success(`Welcome${data.firstName ? `, ${data.firstName}` : ""}!`);
    } catch (error) {
      const code = error?.errorCode;
      let message =
        error?.response?.data?.message ||
        error?.errorMessage ||
        error?.message ||
        "Unknown authentication error.";

      if (code === "user_cancelled" || code === "user_cancelled_error") {
        message = "Microsoft sign-in was cancelled.";
      } else if (code === "popup_window_error") {
        message = "The Microsoft sign-in popup was blocked. Allow popups and try again.";
      } else if (code === "interaction_in_progress") {
        message = "A Microsoft sign-in operation is already in progress. Please wait.";
      }

      toast.error(`Microsoft authentication failed: ${message}`);
    } finally {
      setMsLoading(false);
    }
  };

  const handleVerifyOTP = () => {
    const email = localStorage.getItem("email");
    const userId = localStorage.getItem("userId");

    if (!email || !userId || !otpCode) {
      toast.error("Missing email, userId, or OTP.");
      return;
    }

    setIsLoaderActive(true);

    axios
      .post(config.DDA_API_API_URL + "AuthController/VerifytheMfaOtp", {
        email,
        otp: otpCode,
        userId,
      })
      .then((response) => {
        if (response.status === 200 && response.data.success === "success") {
          const responseData = response.data.data;
          toast.success("OTP verified successfully!");

          localStorage.setItem(
            "isChangePasswordRequired",
            JSON.stringify(responseData.isChangePasswordRequired)
          );
          localStorage.setItem("user_id", responseData.userID);
          localStorage.setItem("isUserAuthenticated", "true");

          setUploadQueue([]);
          setShowUploadPanel(false);

          dispatch(
            setUserPersonalInformation({
              userID: responseData.userID,
              employeeId: responseData.employeeId,
              userRole: responseData.userRole,
              displayName: responseData.displayName,
              emailAddress: responseData.emailAddress,
              menuItemNames: responseData.menuItemNames,
              token: responseData.token,
              profilePic: responseData.profilePic,
              firstName: responseData.firstName,
              lastName: responseData.lastName,
              clientId: "",
              designation: responseData.designation,
              division: responseData.division,
              divisionName: responseData.divisionName,
              isChangePasswordRequired: responseData.isChangePasswordRequired,
            })
          );

          const firstRoute = responseData.menuItemNames?.[0]?.appRoute || "/dashboard";

          setTimeout(() => {
            setIsLoaderActive(false);
            navigate(firstRoute);
          }, 1000);
        } else {
          setIsLoaderActive(false);
          toast.error(response.data.message || "Invalid OTP");
        }
      })
      .catch((error) => {
        console.error("OTP verification failed:", error);
        toast.error("Oops, something went wrong. Please try again later.");
        setIsLoaderActive(false);
      });
  };

  const handleForgotPasswordSubmit = (e) => {
    if (removeExtraSpaces(userForgotEmail)) {
      if (removeExtraSpaces(userForgotConfirmEmail)) {
        if (removeExtraSpaces(userForgotConfirmEmail) === removeExtraSpaces(userForgotEmail)) {
          setIsLoaderActive(true);

          axios
            .post(
              config.DDA_API_API_URL + "AuthMasterController/SendResetLinkToMail",
              {
                emailAddress: userForgotEmail,
                employeeId: "",
                siteURL: "/reset-password",
              },
              {
                headers: config.headers2,
              }
            )
            .then((response) => {
              if (response.status === 200) {
                if (response.data.success === "success") {
                  toast.success(response.data.message);
                  setUserForgotEmail("");
                  setUserForgotConfirmEmail("");

                  setTimeout(() => {
                    setIsLoaderActive(false);
                  }, 1500);
                } else {
                  setIsLoaderActive(false);
                  toast.error(response.data.message);
                }
              } else {
                setIsLoaderActive(false);
                toast.error("Invalid username or password");
              }
            })
            .catch((error) => {
              setIsLoaderActive(false);
            });
        } else {
          toast.error("The email and confirm email are not same.");
        }
      } else {
        toast.error("Please confirm your email.");
      }
    } else {
      toast.error("Please enter your email address.");
    }
  };

  const [isRegistering, setIsRegistering] = useState(false);

  const handleSignUp = () => {
    setIsRegistering(true);
  };

  const [formData, setFormData] = useState({
    employeeId: "",
    firstName: "",
    lastName: "",
    contactNumber: "",
    email: "",
    password: "",
    confirmPassword: "",
    division: "",
    designation: "",
    countryCode: "",
  });

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;

    if (name === "contactNumber") {
      const numericValue = value.replace(/\D/g, "");
      if (numericValue.length > 11) {
        toast.error("Phone number cannot exceed 11 digits.");
        return;
      }
      setFormData((prev) => ({ ...prev, [name]: numericValue }));
    } else if (name === "countryCode") {
      const selectedCountry = countryCodes.find((country) => country.name === value);
      if (selectedCountry) {
        setFormData((prev) => ({
          ...prev,
          countryCode: selectedCountry.code,
          contactNumber: "",
        }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const inputUserNameRef = useRef(null);
  const inputFirstNameRef = useRef(null);
  const inputLastNameRef = useRef(null);
  const inputContactNumberRef = useRef(null);
  const inputEmailRef = useRef(null);
  const inputPasswordRef = useRef(null);
  const inputConfirmPasswordRef = useRef(null);
  const inputDivisionRef = useRef(null);
  const inputDesignationRef = useRef(null);

  const [emailDomains, setEmailDomains] = useState([]);

  const fetchEmailDomains = async () => {
    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}FieldMaster/GetAllEmailDomains`,
        { headers: config.headers2 }
      );
      setEmailDomains(response.data.data);
    } catch (error) {
      console.error("Error fetching email domains:", error);
    }
  };

  useEffect(() => {
    fetchEmailDomains();
  }, []);

  const isEmailDomainValid = (email) => {
    if (!email || !email.includes("@")) return false;
    const emailDomain = email.split("@")[1];
    return emailDomains.some(
      (domain) => domain.domain.toLowerCase() === emailDomain.toLowerCase()
    );
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();

    const formattedContactNumber = `${formData.countryCode}-${formData.contactNumber}`;
    const {
      employeeId,
      firstName,
      lastName,
      contactNumber,
      email,
      password,
      confirmPassword,
      division,
      designation,
    } = formData;

    if (!employeeId) {
      toast.error("Please enter your Employee ID.");
      inputUserNameRef.current?.focus();
      return;
    }
    if (!firstName) {
      toast.error("Please enter your First Name.");
      inputFirstNameRef.current?.focus();
      return;
    }
    if (!lastName) {
      toast.error("Please enter your Last Name.");
      inputLastNameRef.current?.focus();
      return;
    }
    if (!contactNumber) {
      toast.error("Please enter contact number.");
      inputContactNumberRef.current?.focus();
      return;
    }
    if (!removeExtraSpaces(email)) {
      toast.error("Please enter email.");
      inputEmailRef.current?.focus();
      return;
    }
    if (!isEmailDomainValid(email)) {
      toast.error("Please enter a valid email.");
      inputEmailRef.current?.focus();
      return;
    }
    if (!isValidPassword(password)) {
      toast.error("Password must be at least 12 characters long, contain letters, numbers, and special characters.");
      inputPasswordRef.current?.focus();
      return;
    }
    if (password !== confirmPassword) {
      toast.error("The password and confirm password do not match.");
      inputConfirmPasswordRef.current?.focus();
      return;
    }
    if (!division) {
  toast.error("Please select your Division.");
      inputDivisionRef.current?.focus();
      return;
    }
    if (!designation) {
      toast.error("Please enter your Designation.");
      inputDesignationRef.current?.focus();
      return;
    }

    

    setIsLoaderActive(true);

    axios
      .post(
        `${config.DDA_API_API_URL}AuthMasterController/CreateRegisterUser`,
        {
          roleID: "bb07b69d-17bc-4f4b-8c7e-67b867b3df71",
          employeeId,
          email,
          password,
          contactNumber: formattedContactNumber,
          designation,
          division,
          roleName: "User",
          clientId: config.clientId,
          firstName,
          lastName,
          address: "",
          dateOfBirth: "",
          joiningDate: "",
          isActive: true,
          createdOn: new Date().toISOString(),
          createdBy: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          modifiedOn: new Date().toISOString(),
          modifiedBy: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          profilePic: "",
        },
        {
          headers: config.headers3,
        }
      )
      .then((response) => {
        if (response.status === 200 && response.data.success === "success") {
          toast.success(response.data.message);
          handleClear();
          setShowThankYou(true);

          setTimeout(() => {
            setShowThankYou(false);
            setIsRegistering(false);
          }, 8000);
        } else {
          toast.error(response.data.message);
        }
        setIsLoaderActive(false);
      })
      .catch((error) => {
        toast.error("Registration failed");
        setIsLoaderActive(false);
      });
  };

  const handleBackToLogin = () => {
    setIsOTPSent(false);
    setOtpCode("");
    localStorage.removeItem("email");
    localStorage.removeItem("userId");
  };

  const handleClear = () => {
    setFormData({
      employeeId: "",
      firstName: "",
      lastName: "",
      contactNumber: "",
      email: "",
      password: "",
      confirmPassword: "",
      division: "",
      designation: "",
      countryCode: "",
    });
  };

  const [divisions, setDivisions] = useState([]);

  useEffect(() => {
    axios
      .get(config.DDA_API_API_URL + "FieldMaster/GetAllDivisionMasters", {
        headers: config.headers2,
      })
      .then((response) => {
        if (response.data.success) {
          const sortedDivisions = response.data.data.sort((a, b) =>
            a.description.localeCompare(b.description)
          );
          setDivisions(sortedDivisions);
        }
      })
      .catch((error) => {
        console.error("Error fetching divisions!", error);
      });
  }, []);

  const view = isRegistering
    ? showThankYou
      ? "thanks"
      : "register"
    : forgotPasswordClick
      ? "forgot"
      : isOTPSent
        ? "otp"
        : "signin";

  const field = (id, label, control, hint) => (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      {control}
      {hint && <div className="auth-hint">{hint}</div>}
    </div>
  );

  const regText = (name, label, type, ref) =>
    field(
      name,
      label,
      <input
        id={name}
        name={name}
        type={type}
        className="form-control"
        ref={ref}
        value={formData[name]}
        onChange={handleRegisterChange}
        autoComplete="off"
      />
    );

  return (
    <div className="auth-split-layout">
      {/* Left Hero / Branding Panel */}
      <div className="auth-hero-pane">
        <div className="auth-hero-top">
          <img className="auth-hero-logo" src={bmswhiteLogoWipro} alt="Wipro" />
          <span className="auth-brand-badge">Document Digitization Application</span>
        </div>

        <div className="auth-hero-content">
          <h1 className="auth-hero-title">
            Every document,<br />
            <span>digitized, secured &amp; in control.</span>
          </h1>
          <p className="auth-hero-desc">
            One governed workspace to store, search, share and review documents with your whole organization.
          </p>

          <ul className="auth-hero-feats">
            <li><b>Secure access</b><small>Role-based permissions &amp; Microsoft SSO</small></li>
            <li><b>Find instantly</b><small>Tags, filters and advanced search</small></li>
            <li><b>Work together</b><small>Comments, reviews &amp; version history</small></li>
            <li><b>Stay audited</b><small>Access reports &amp; ownership trail</small></li>
          </ul>
        </div>

        <div className="auth-hero-footer">
          <span>Internal &amp; Restricted</span>
          <span>© Wipro</span>
        </div>
      </div>

      {/* Right Form Container Panel */}
      <div className="auth-form-pane">
        <main className={`auth-card ${view === "register" ? "auth-card--wide" : ""}`}>
          <div className="auth-card-top-tag">SECURE WORKSPACE</div>

          {view === "signin" && (
            <>
              <h2 className="auth-title">Welcome back</h2>
              <p className="auth-sub">Enter your credentials to continue to Document Digitization.</p>

              <form noValidate onSubmit={(e) => { e.preventDefault(); handleSignInAccount(); }}>
                {field(
                  "signin-email",
                  "Email address or Employee ID",
                  <div className="auth-input-wrapper">
                    <span className="auth-input-icon">✉</span>
                    <input
                      id="signin-email"
                      type="text"
                      className="form-control auth-input-padded"
                      autoComplete="username"
                      ref={inputUserEmailReference}
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="Enter email or ID"
                    />
                  </div>
                )}

                {field(
                  "signin-password",
                  "Password",
                  <div className="auth-input-wrapper">
                    <span className="auth-input-icon">🔒</span>
                    <input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      className="form-control auth-input-padded auth-input-padded-right"
                      autoComplete="current-password"
                      ref={inputUserPasswordReference}
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      className="auth-pwd-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                )}

                <div className="auth-row">
                  <button type="button" className="auth-link" onClick={handleForgotPassword}>
                    Forgot password?
                  </button>
                </div>

                <div className="auth-security-notice">
                  🛡️ Session protected with independent SSO and role-based token validation.
                </div>

                <button type="submit" className="auth-btn auth-btn--primary" disabled={isLoaderActive}>
                  {isLoaderActive ? "Please wait…" : "Sign in to workspace"} →
                </button>
              </form>

              <div className="auth-divider"><span>or</span></div>

              <button type="button" className="auth-btn auth-btn--ms" onClick={handleMicrosoftSignIn} disabled={msLoading}>
                <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
                  <path d="M0 0H10.9091V10.9091H0V0Z" fill="#F25022" />
                  <path d="M12.0909 0H23V10.9091H12.0909V0Z" fill="#7FBA00" />
                  <path d="M0 12.0909H10.9091V23H0V12.0909Z" fill="#00A4EF" />
                  <path d="M12.0909 12.0909H23V23H12.0909V12.0909Z" fill="#FFB900" />
                </svg>
                {msLoading ? "Signing in…" : "Continue with Microsoft"}
              </button>

              <p className="auth-foot">
                New here? <button type="button" className="auth-link" onClick={handleSignUp}>Create an account</button>
              </p>
            </>
          )}

          {view === "otp" && (
            <>
              <h2 className="auth-title">Verify your identity</h2>
              <p className="auth-sub">Enter the code sent to your email.</p>
              <form noValidate onSubmit={(e) => { e.preventDefault(); handleVerifyOTP(); }}>
                {field(
                  "otp",
                  "Verification code",
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="form-control"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                  />
                )}
                <button type="submit" className="auth-btn auth-btn--primary" disabled={isLoaderActive}>
                  {isLoaderActive ? "Please wait…" : "Verify code"}
                </button>
              </form>
              <p className="auth-foot">
                <button type="button" className="auth-link" onClick={handleBackToLogin}>Back to sign in</button>
              </p>
            </>
          )}

          {view === "forgot" && (
            <>
              <h2 className="auth-title">Reset your password</h2>
              <p className="auth-sub">We will email you a secure reset link.</p>
              <form noValidate onSubmit={(e) => { e.preventDefault(); handleForgotPasswordSubmit(e); }}>
                {field(
                  "fp-email",
                  "Email address",
                  <input
                    id="fp-email"
                    type="email"
                    className="form-control"
                    value={userForgotEmail}
                    onChange={(e) => setUserForgotEmail(e.target.value)}
                  />
                )}
                {field(
                  "fp-confirm",
                  "Confirm email",
                  <input
                    id="fp-confirm"
                    type="email"
                    className="form-control"
                    value={userForgotConfirmEmail}
                    onChange={(e) => setUserForgotConfirmEmail(e.target.value)}
                  />
                )}
                <button type="submit" className="auth-btn auth-btn--primary" disabled={isLoaderActive}>
                  {isLoaderActive ? "Please wait…" : "Send reset link"}
                </button>
              </form>
              <p className="auth-foot">
                <button type="button" className="auth-link" onClick={handleSignIn}>Back to sign in</button>
              </p>
            </>
          )}

          {view === "register" && (
            <>
              <h2 className="auth-title">Create your account</h2>
              <p className="auth-sub">An administrator will review and activate your access.</p>
              <form noValidate onSubmit={handleRegisterSubmit}>
                <div className="auth-grid">
                  {regText("employeeId", "Employee ID", "text", inputUserNameRef)}
                  {regText("designation", "Designation", "text", inputDesignationRef)}
                  {regText("firstName", "First name", "text", inputFirstNameRef)}
                  {regText("lastName", "Last name", "text", inputLastNameRef)}
                  <div className="auth-span-2">{regText("email", "Work Email", "email", inputEmailRef)}</div>
                  <div className="auth-span-2">
                    {field(
                      "contactNumber",
                      "Contact number",
                      <div className="auth-phone">
                        <select
                          name="countryCode"
                          className="form-control"
                          onChange={handleRegisterChange}
                          value={countryCodes.find((c) => c.code === formData.countryCode)?.name || ""}
                        >
                          <option value="" disabled hidden>Country</option>
                          {countryCodes.map((c, i) => (
                            <option key={`${c.code}-${i}`} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                        <input type="text" className="form-control" value={formData.countryCode} disabled aria-label="Country code" />
                        <input
                          id="contactNumber"
                          name="contactNumber"
                          type="text"
                          className="form-control"
                          ref={inputContactNumberRef}
                          value={formData.contactNumber}
                          onChange={handleRegisterChange}
                          disabled={!formData.countryCode}
                        />
                      </div>
                    )}
                  </div>
                  <div className="auth-span-2">
                    {field(
                      "division",
                      "Division",
                      <select
                        id="division"
                        name="division"
                        className="form-control"
                        ref={inputDivisionRef}
                        value={formData.division}
                        onChange={handleRegisterChange}
                      >
                        <option value="" disabled hidden>Select division</option>
                        {divisions.map((d) => (<option key={d.divisionId} value={String(d.divisionId)}>{d.description}</option>))}
                      </select>
                    )}
                  </div>
                  {regText("password", "Password", "password", inputPasswordRef)}
                  {regText("confirmPassword", "Confirm password", "password", inputConfirmPasswordRef)}
                </div>
                <div className="auth-hint">Password: 12+ chars with letters, numbers, and special chars.</div>
                <button type="submit" className="auth-btn auth-btn--primary" disabled={isLoaderActive}>
                  {isLoaderActive ? "Please wait…" : "Submit registration"}
                </button>
              </form>
              <p className="auth-foot">
                Already have an account? <button type="button" className="auth-link" onClick={() => setIsRegistering(false)}>Sign in</button>
              </p>
            </>
          )}

          {view === "thanks" && (
            <>
              <h2 className="auth-title">Registration submitted</h2>
              <div className="auth-thanks">
                <p>Your registration is complete. An admin will review and contact you soon.</p>
                <p>Support: <a href="mailto:dmsadminsupport@wipro.com">dmsadminsupport@wipro.com</a></p>
              </div>
              <button
                type="button"
                className="auth-btn auth-btn--primary"
                onClick={() => { setShowThankYou(false); setIsRegistering(false); }}
              >
                Back to sign in
              </button>
            </>
          )}

          <div className="auth-card-footer-info">
            Document Digitization Application · Secure Enterprise Workspace
          </div>
        </main>
      </div>
    </div>
  );
};

export default Login;