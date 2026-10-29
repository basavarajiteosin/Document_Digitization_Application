import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import { tokenStorage } from '../../axiosInstance/setupAxiosInterceptors';
import PleaseWaitButton from "../../shared/PleaseWaitButton";
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

    // Resolve any pending redirect response before starting a new interaction.
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

  const { setIsChangePasswordRequired } = useUserContext();

  const currentPageOrigin = window.location.origin;

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
    // Save the application's backend JWT.
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
        isChangePasswordRequired: data.isChangePasswordRequired,
      })
    );

    const allowedRoutes =
      data.menuItemNames?.map((m) => m.appRoute) || [];

    let dest = location.state?.from?.pathname;

    // Only allow redirect to a permitted route.
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

        // If OTP is sent, show the OTP input.
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
              isChangePasswordRequired:
                responseData.isChangePasswordRequired,
            })
          );

          const firstRoute =
            responseData.menuItemNames?.[0]?.appRoute || "/dashboard";

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
      console.info("[Microsoft Auth] Initializing MSAL");

      const msal = await initializeMSAL();

      console.info("[Microsoft Auth] Starting Microsoft popup sign-in");

      const loginResponse = await msal.loginPopup({
        scopes: ["openid", "profile", "email"],
      });

      if (!loginResponse?.idToken) {
        throw new Error("Microsoft sign-in returned no ID token.");
      }

      console.info(
        "[Microsoft Auth] Microsoft sign-in succeeded; calling backend"
      );

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

      if (
        !body ||
        body.success === "error" ||
        body.success === false
      ) {
        throw new Error(
          body?.message || "The API rejected Microsoft authentication."
        );
      }

      const data = body.data ?? body;

      // The API must return the application's own backend JWT.
      if (!data?.token) {
        console.error(
          "[Microsoft Auth] API response did not include data.token",
          body
        );

        throw new Error(
          "Microsoft sign-in succeeded, but the API did not return the application's JWT token. Check the .NET microsoft-token endpoint."
        );
      }

      dispatchAndNavigate(data);

      toast.success(
        `Welcome${data.firstName ? `, ${data.firstName}` : ""}!`
      );
    } catch (error) {
      console.error("[Microsoft Auth] Authentication failed", {
        name: error?.name,
        message: error?.message,
        errorCode: error?.errorCode,
        subError: error?.subError,
        status: error?.response?.status,
        apiResponse: error?.response?.data,
        stack: error?.stack,
      });

      const code = error?.errorCode;

      let message =
        error?.response?.data?.message ||
        error?.errorMessage ||
        error?.message ||
        "Unknown authentication error.";

      if (
        code === "user_cancelled" ||
        code === "user_cancelled_error"
      ) {
        message = "Microsoft sign-in was cancelled.";
      } else if (code === "popup_window_error") {
        message =
          "The Microsoft sign-in popup was blocked. Allow popups and try again.";
      } else if (code === "interaction_in_progress") {
        message =
          "A Microsoft sign-in operation is already in progress. Please wait and try again.";
      }

      toast.error(`Microsoft authentication failed: ${message}`);
    } finally {
      setMsLoading(false);
    }
  }; const handleVerifyOTP = () => {
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
        if (
          response.status === 200 &&
          response.data.success === "success"
        ) {
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
              isChangePasswordRequired:
                responseData.isChangePasswordRequired,
            })
          );

          const firstRoute =
            responseData.menuItemNames?.[0]?.appRoute || "/dashboard";

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

  const onEnterKeyPress = (e, actionType) => {
    if (e.key === "Enter") {
      e.preventDefault();

      if (actionType === "signIn") {
        handleSignInAccount();
      } else if (actionType === "verifyOTP") {
        handleVerifyOTP();
      }
    }
  };

  const handleForgotPasswordSubmit = (e) => {
    if (removeExtraSpaces(userForgotEmail)) {
      if (removeExtraSpaces(userForgotConfirmEmail)) {
        if (
          removeExtraSpaces(userForgotConfirmEmail) ==
          removeExtraSpaces(userForgotEmail)
        ) {
          setIsLoaderActive(true);

          axios
            .post(
              config.DDA_API_API_URL +
              "AuthMasterController/SendResetLinkToMail",
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
              if (response.status == 200) {
                if (response.data.success == "success") {
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
              } else if (response.data.status.status == 500) {
                setIsLoaderActive(false);
                toast.error("Invalid username or password");
              }
            })
            .catch((error) => {
              const status = error.response?.status;

              if (status == 400) {
                toast.error("Bad request");
              } else if (status == 401) {
                toast.error("You are not authorized person");
              } else if (status == 403) {
                toast.error("Forbidden");
              } else if (status == 404) {
                toast.error("Not found");
              } else if (status == 500) {
                toast.error("Internal server error");
              } else if (status == 502) {
                toast.error("Bad gateway");
              } else if (status == 503) {
                toast.error("Service unavailable");
              } else if (status == 504) {
                toast.error("Gateway timeout");
              } else {
                console.error("Forgot password request failed:", error);
              }

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

      setFormData((prev) => ({
        ...prev,
        [name]: numericValue,
      }));
    } else if (name === "countryCode") {
      const selectedCountry = countryCodes.find(
        (country) => country.name === value
      );

      if (selectedCountry) {
        setFormData((prev) => ({
          ...prev,
          countryCode: selectedCountry.code,
          contactNumber: "",
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
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
    window.initDestroyDataTableFuncation();

    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}FieldMaster/GetAllEmailDomains`,
        { headers: config.headers2 }
      );

      setEmailDomains(response.data.data);

      setTimeout(() => {
        window.initDataTableFuncation();
      }, 1000);
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
      (domain) =>
        domain.domain.toLowerCase() === emailDomain.toLowerCase()
    );
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();

    const formattedContactNumber =
      `${formData.countryCode}-${formData.contactNumber}`;

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
      inputUserNameRef.current?.classList.add("is-invalid");
      return;
    }

    if (!firstName) {
      toast.error("Please enter your First Name.");
      inputFirstNameRef.current?.focus();
      inputFirstNameRef.current?.classList.add("is-invalid");
      return;
    }

    if (!lastName) {
      toast.error("Please enter your Last Name.");
      inputLastNameRef.current?.focus();
      inputLastNameRef.current?.classList.add("is-invalid");
      return;
    }

    if (!contactNumber) {
      toast.error("Please enter contact number.");
      inputContactNumberRef.current?.focus();
      inputContactNumberRef.current?.classList.add("is-invalid");
      return;
    }

    if (!removeExtraSpaces(email)) {
      toast.error("Please enter email.");
      inputEmailRef.current?.focus();
      inputEmailRef.current?.classList.add("is-invalid");
      return;
    }

    if (!isEmailDomainValid(email)) {
      toast.error("Please enter a valid email.");
      inputEmailRef.current?.focus();
      inputEmailRef.current?.classList.add("is-invalid");
      return;
    }

    if (!isValidPassword(password)) {
      toast.error(
        "Password must be at least 12 characters long, contain letters, numbers, and special characters."
      );
      inputPasswordRef.current?.focus();
      inputPasswordRef.current?.classList.add("is-invalid");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("The password and confirm password do not match.");
      inputConfirmPasswordRef.current?.focus();
      inputConfirmPasswordRef.current?.classList.add("is-invalid");
      return;
    }

    if (!division) {
      toast.error("Please enter your Division.");
      inputDivisionRef.current?.focus();
      inputDivisionRef.current?.classList.add("is-invalid");
      return;
    }

    if (!designation) {
      toast.error("Please enter your Designation.");
      inputDesignationRef.current?.focus();
      inputDesignationRef.current?.classList.add("is-invalid");
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
        if (
          response.status === 200 &&
          response.data.success === "success"
        ) {
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
        if (error.response) {
          const status = error.response.status;

          switch (status) {
            case 400:
              toast.error("Bad request");
              break;
            case 401:
              toast.error("You are not authorized");
              break;
            case 403:
              toast.error("Forbidden");
              break;
            case 404:
              toast.error("Not found");
              break;
            case 500:
              toast.error("Internal server error");
              break;
            case 502:
              toast.error("Bad gateway");
              break;
            case 503:
              toast.error("Service unavailable");
              break;
            case 504:
              toast.error("Gateway timeout");
              break;
            default:
              toast.error("An unknown error occurred");
          }
        } else {
          console.error("Registration failed:", error);
        }

        setIsLoaderActive(false);
      });
  }; const handleBackToLogin = () => {
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
      .get(
        config.DDA_API_API_URL + "FieldMaster/GetAllDivisionMasters",
        {
          headers: config.headers2,
        }
      )
      .then((response) => {
        if (response.data.success) {
          const sortedDivisions = response.data.data.sort((a, b) =>
            a.description.localeCompare(b.description)
          );

          setDivisions(sortedDivisions);
        }
      })
      .catch((error) => {
        console.error(
          "There was an error fetching the divisions!",
          error
        );
      });
  }, []);

  return (
    <>
      {!isRegistering ? (
        <div className="loginPage">
          <div
            className={
              forgotPasswordClick
                ? "container right-panel-active"
                : "container"
            }
            id="container"
          >
            <div className="form-container sign-up-container">
              <form action="#">
                <div className="mb-3">
                  <h3>Forgot Password</h3>
                  <h6 className="text-h6">
                    Enter your email for get the reset password link
                  </h6>
                </div>

                <div className="form-group form-floating">
                  <input
                    type="email"
                    value={userForgotEmail}
                    onChange={(e) =>
                      setUserForgotEmail(e.target.value)
                    }
                    placeholder=""
                    className="form-control form-control-md"
                  />
                  <label htmlFor="email">Enter Email</label>
                </div>

                <div className="form-group form-floating">
                  <input
                    type="email"
                    value={userForgotConfirmEmail}
                    onChange={(e) =>
                      setUserForgotConfirmEmail(e.target.value)
                    }
                    placeholder=""
                    className="form-control form-control-md"
                  />
                  <label htmlFor="userNConfirmYourEmail">
                    Confirm Your Email
                  </label>
                </div>

                {isLoaderActive ? (
                  <PleaseWaitButton className="btn-sm font-weight-medium auth-form-btn" />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => handleForgotPasswordSubmit(e)}
                  >
                    Submit
                  </button>
                )}
              </form>
            </div>

            <div className="form-container sign-in-container">
              <form action="#">
                {!isOTPSent ? (
                  <>
                    <div className="mb-3 mt-4">
                      <h3>Sign in</h3>
                      <h6 className="">
                        Please enter your email and password
                      </h6>
                    </div>

                    <div className="form-group form-floating">
                      <input
                        type="email"
                        ref={inputUserEmailReference}
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        onKeyDown={(e) =>
                          onEnterKeyPress(e, "signIn")
                        }
                        placeholder=""
                        className="form-control form-control-md"
                      />
                      <label htmlFor="email">
                        Enter Email/Employee Id
                      </label>
                    </div>

                    <div className="form-group form-floating">
                      <input
                        type="password"
                        ref={inputUserPasswordReference}
                        value={userPassword}
                        onChange={(e) =>
                          setUserPassword(e.target.value)
                        }
                        onKeyDown={(e) =>
                          onEnterKeyPress(e, "signIn")
                        }
                        placeholder=""
                        className="form-control form-control-md"
                      />
                      <label htmlFor="password">Enter Password</label>
                    </div>

                    {isLoaderActive ? (
                      <button
                        type="button"
                        className="please-wait"
                      >
                        Please Wait....
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSignInAccount}
                      >
                        Sign In
                      </button>
                    )}

                    <div className="lc-divider">
                      <span>or</span>
                    </div>

                    {/* Microsoft Sign In Button */}
                    {msLoading ? (
                      <PleaseWaitButton />
                    ) : (
                      <button
                        type="button"
                        className="lc-btn lc-btn-microsoft"
                        onClick={handleMicrosoftSignIn}
                        disabled={msLoading}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 23 23"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          style={{ marginRight: 8 }}
                        >
                          <path
                            d="M0 0H10.9091V10.9091H0V0Z"
                            fill="#F25022"
                          />
                          <path
                            d="M12.0909 0H23V10.9091H12.0909V0Z"
                            fill="#7FBA00"
                          />
                          <path
                            d="M0 12.0909H10.9091V23H0V12.0909Z"
                            fill="#00A4EF"
                          />
                          <path
                            d="M12.0909 12.0909H23V23H12.0909V12.0909Z"
                            fill="#FFB900"
                          />
                        </svg>

                        Continue with Microsoft
                      </button>
                    )}

                    <Link onClick={handleForgotPassword}>
                      Forgot Password
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="mb-3 mt-4">
                      <h3>Verify OTP</h3>
                      <h6 className="">
                        Enter the OTP sent to your email/ID
                      </h6>
                    </div>

                    <div className="form-group form-floating">
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        onKeyDown={(e) =>
                          onEnterKeyPress(e, "verifyOTP")
                        }
                        placeholder="Enter OTP"
                        className="form-control form-control-md"
                      />
                      <label htmlFor="otp">Enter OTP</label>
                    </div>

                    {isLoaderActive ? (
                      <PleaseWaitButton className="btn-sm font-weight-medium auth-form-btn" />
                    ) : (
                      <button
                        type="button"
                        onClick={handleVerifyOTP}
                      >
                        Verify OTP
                      </button>
                    )}

                    <div className="mt-2">
                      <Link onClick={handleBackToLogin}>
                        Back to Sign In
                      </Link>
                    </div>
                  </>
                )}
              </form>
            </div>

            <div className="overlay-container">
              <div className="overlay">
                <div className="overlay-panel overlay-left">
                  <img
                    src={bmswhiteLogoWipro}
                    alt="BMS"
                    className="logo"
                    style={{ height: "80px", width: "80px" }}
                  />

                  <h3>Sign In</h3>
                  <p>Already have an account? Sign in</p>

                  <button
                    className="ghost"
                    id="signIn"
                    onClick={handleSignIn}
                  >
                    Sign In
                  </button>
                </div>

                <div className="overlay-panel overlay-right">
                  <img
                    src={bmswhiteLogoWipro}
                    alt="BMS"
                    className="logo"
                    style={{ height: "80px", width: "80px" }}
                  />

                  <h3>Welcome to Login</h3>
                  <p>Don't have an account? Sign up</p>

                  <button
                    className="ghost"
                    id="signUp"
                    onClick={handleSignUp}
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        !showThankYou ? (
          <div className="registerPage">
            <div className="register-container">
              <div className="logo-container">
                <img
                  src={bmsLogoWipro}
                  style={{ width: "70px", height: "60px" }}
                  alt="BMS"
                  className="logo"
                />
              </div>

              <h3>Sign Up</h3>

              <form onSubmit={handleRegisterSubmit}>
                <div className="row">
                  <div className="form-group col-md-4 form-floating">
                    <input
                      type="text"
                      name="employeeId"
                      value={formData.employeeId}
                      onChange={handleRegisterChange}
                      id="employeeId"
                      placeholder=" "
                      className="form-control form-control-md"
                      ref={inputUserNameRef}
                    />
                    <label htmlFor="employeeId">
                      Enter Employee ID
                    </label>
                  </div>

                  <div className="form-group col-md-4 form-floating">
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleRegisterChange}
                      id="firstName"
                      placeholder=" "
                      className="form-control form-control-md"
                      ref={inputFirstNameRef}
                    />
                    <label htmlFor="firstName">Enter First Name</label>
                  </div>

                  <div className="form-group col-md-4 form-floating">
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleRegisterChange}
                      id="lastName"
                      placeholder=" "
                      className="form-control form-control-md"
                      ref={inputLastNameRef}
                    />
                    <label htmlFor="lastName">Enter Last Name</label>
                  </div>                  <div className="form-group col-md-6 form-floating">
                    <div className="input-group">
                      <select
                        name="countryCode"
                        onChange={handleRegisterChange}
                        className="form-control form-control-md text-xs contact-number-dropdown1"
                        value={
                          countryCodes.find(
                            (country) =>
                              country.code === formData.countryCode
                          )?.name || ""
                        }
                      >
                        <option value="" disabled hidden>
                          Country
                        </option>

                        {countryCodes.map((country) => (
                          <option
                            key={country.code}
                            value={country.name}
                          >
                            {country.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        className="form-control form-control-md contact-number1"
                        value={formData.countryCode}
                        disabled
                      />

                      <input
                        type="text"
                        name="contactNumber"
                        value={formData.contactNumber}
                        onChange={handleRegisterChange}
                        id="contactNumber"
                        placeholder="Enter Contact Number"
                        className="form-control form-control-md contact-number-input1"
                        ref={inputContactNumberRef}
                        disabled={!formData.countryCode}
                      />
                    </div>
                  </div>

                  <div className="form-group col-md-3 form-floating">
                    <input
                      type="text"
                      name="email"
                      value={formData.email}
                      onChange={handleRegisterChange}
                      id="email"
                      placeholder=" "
                      className="form-control form-control-md"
                      ref={inputEmailRef}
                    />
                    <label htmlFor="email">Enter Email</label>
                  </div>

                  <div className="form-group col-md-3 form-floating">
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleRegisterChange}
                      id="password"
                      placeholder=" "
                      className="form-control form-control-md"
                      ref={inputPasswordRef}
                    />
                    <label htmlFor="password">Enter Password</label>
                  </div>

                  <div className="form-group col-md-4 form-floating">
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleRegisterChange}
                      id="confirmPassword"
                      placeholder=" "
                      className="form-control form-control-md"
                      ref={inputConfirmPasswordRef}
                    />
                    <label htmlFor="confirmPassword">
                      Confirm Password
                    </label>
                  </div>

                  <div className="form-group col-md-4">
                    <select
                      name="division"
                      value={formData.division}
                      onChange={handleRegisterChange}
                      id="division"
                      className="form-control form-control-option form-control-md"
                      ref={inputDivisionRef}
                    >
                      <option value="" disabled hidden>
                        Select Division
                      </option>

                      {divisions.map((division) => (
                        <option
                          key={division.divisionId}
                          value={division.description}
                        >
                          {division.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group col-md-4 form-floating">
                    <input
                      type="text"
                      name="designation"
                      value={formData.designation}
                      onChange={handleRegisterChange}
                      id="designation"
                      placeholder=" "
                      className="form-control form-control-md"
                      ref={inputDesignationRef}
                    />
                    <label htmlFor="designation">
                      Designation
                    </label>
                  </div>
                </div>

                <div className="d-flex justify-content-center">
                  {isLoaderActive ? (
                    <PleaseWaitButton className="btn-sm font-weight-medium auth-form-btn" />
                  ) : (
                    <button
                      className="register-button"
                      type="submit"
                    >
                      Sign Up
                    </button>
                  )}
                </div>
              </form>

              <div className="login-link">
                <span>Already have an Account? </span>

                <a
                  className="text-primary"
                  style={{ cursor: "pointer" }}
                  onClick={() => setIsRegistering(false)}
                >
                  Login
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="registerPage">
            <div className="register-container">
              <div className="logo-container">
                <img
                  src={bmsLogoWipro}
                  style={{ width: "70px", height: "60px" }}
                  alt="BMS"
                  className="logo"
                />
              </div>

              <h3>Sign Up</h3>

              <div className="thank-you-page">
                <p>Thank you for signing up!</p>
                <p>You have successfully registered.</p>
                <p>
                  The Admin will reach out to you soon for sign in.
                </p>
              </div>

              <div className="login-link">
                <span>Please Contact Admin By </span>

                <a
                  href="mailto:dmsadminsupport@wipro.com"
                  style={{ color: "blue" }}
                >
                  dmsadminsupport@wipro.com
                </a>
              </div>
            </div>
          </div>
        )
      )}
    </>
  );
};

export default Login;