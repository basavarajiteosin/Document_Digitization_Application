import React, { useState } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import PleaseWaitButton from "../../shared/PleaseWaitButton";
import { removeExtraSpaces } from "../../common/textOperations";
import { useLocation, useNavigate } from "react-router-dom";
// import "./ResetPassword.css"; // Import CSS for centering
import bmsLogoWipro from "../../assets/images/bmslogowipro.svg";

const config = require("../../services/config.json");

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isLoaderActive, setIsLoaderActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const location = useLocation();
  const token = new URLSearchParams(location.search).get("token");
  const userID = new URLSearchParams(location.search).get("Id");
  const navigate = useNavigate();

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  const handleResetPasswordSubmit = () => {
    setErrorMessage("");

    const password = removeExtraSpaces(newPassword);
    const confirmPassword = removeExtraSpaces(confirmNewPassword);

    // Check new password
    if (!password) {
      setErrorMessage("Please enter your new password.");
      return;
    }

    // Check password format
    if (!passwordRegex.test(password)) {
      setErrorMessage(
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@, $, !, %, *, ?, &)."
      );
      return;
    }

    // Check confirm password
    if (!confirmPassword) {
      setErrorMessage("Please confirm your new password.");
      return;
    }

    // Check passwords match
    if (password !== confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    setIsLoaderActive(true);

    axios
      .post(
        config.DDA_API_API_URL + "AuthMasterController/ForgotPassword",
        {
          userID: userID,
          emailAddress: "",
          newPassword: password,
          token: token,
        },
        {
          headers: config.headers2,
        }
      )
      .then((response) => {
        if (response.status === 200) {
          if (response.data.success === "success") {
            toast.success(response.data.message);

            setTimeout(() => {
              setIsLoaderActive(false);
              setNewPassword("");
              setConfirmNewPassword("");
              navigate("/login");
            }, 1500);
          } else {
            setIsLoaderActive(false);
            toast.error(response.data.message);
          }
        } else {
          setIsLoaderActive(false);
          toast.error("Invalid request");
        }
      })
      .catch((error) => {
        handleError(error);
      });
  };

  const handleError = (error) => {
    if (error.response) {
      // Show actual API validation message when available
      if (
        error.response.status === 400 &&
        error.response.data?.errors?.NewPassword
      ) {
        toast.error(error.response.data.errors.NewPassword.join(" "));
      } else if (error.response.data?.message) {
        toast.error(error.response.data.message);
      } else {
        switch (error.response.status) {
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
          default:
            toast.error("An unknown error occurred");
        }
      }
    } else {
      toast.error("Network error");
    }

    setIsLoaderActive(false);
  };

  const handleCancel = () => {
    setNewPassword("");
    setConfirmNewPassword("");
    setErrorMessage("");
  };



  return (
    <>
      <section className="content" style={{ backgroundColor: "#fff", height: "100vh" }}>
        <div className="container-fluid d-flex justify-content-center align-items-center">


          <div style={{ marginTop: "75px" }}>
            <div className="brand-link text-center">
              <img src={bmsLogoWipro} alt="Iteos Logo" className="" style={{ width: "100px", height: "80px" }} />
            </div>
            <div className="card " style={{ backgroundColor: "#3498B3" }}>
              <div className="card-header">
                <h3 className="card-title text-white">Reset Password</h3>
              </div>
              <div className="card-body text-sm">
                <div className="row">
                  <div className="form-group col-md-12">
                    <label>
                      New Password<sup style={{ color: "red" }}>*</sup>
                    </label>
                    <input
                      type="password"
                      className="form-control form-control-sm"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New Password"
                    />
                    {errorMessage && (
                      <span className="text-danger">{errorMessage}</span>
                    )}
                  </div>
                  <div className="form-group col-md-12">
                    <label>
                      Confirm New Password<sup style={{ color: "red" }}>*</sup>
                    </label>
                    <input
                      type="password"
                      className="form-control form-control-sm"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm New Password"
                    />
                    {errorMessage && (
                      <span className="text-danger">{errorMessage}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="card-footer text-sm" style={{ backgroundColor: "#3498B3" }}>
                {isLoaderActive ? (
                  <PleaseWaitButton className="float-right btn-xs ml-2 font-weight-medium auth-form-btn" />
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary float-right btn-xs ml-2"
                    onClick={handleResetPasswordSubmit}
                  >
                    Reset Password
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline-primary float-right btn-xs"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ResetPassword;