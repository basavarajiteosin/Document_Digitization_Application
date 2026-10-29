import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import { useLoader } from '../../Customhook/LoaderContext';
import $ from "jquery";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

const config = require("../../services/config.json");

const AllUsersFilesAndFolders = () => {
  const [allUsersList, setAllUsersList] = useState([]);
  const { showLoader, hideLoader } = useLoader();
  const navigate = useNavigate();

  const personalInfo = useSelector((state) => state.personalInformationReducer);
  const roleName = personalInfo.userRole;

  const getUsersList = () => {
    window.initDestroyDataTableFuncation();
    showLoader();
    axios
      .get(
        config.DDA_API_API_URL +
        "AuthMasterController/GetAllUsers?ClientId=" +
        config.clientId,
        {
          headers: config.headers2,
        }
      )
      .then((response) => {
        if (response.status === 200) {
          if (response.data.success === "success") {
            if (response.data.data.length > 0) {
              // Filter out users with roleName "Administrator" or "Global Admin"
              const filteredUsers = response.data.data.filter(
                (user) => user.userID !== personalInfo.userID
              );
              setAllUsersList(filteredUsers);
              setTimeout(() => {
                window.initDataTableFuncation();
                hideLoader();
              }, 1000);
            } else {
              setTimeout(() => {
                window.initDataTableFuncation();
                hideLoader();
              }, 1000);
            }
          } else {
            toast.error(response.data.message);
            setTimeout(() => {
              window.initDataTableFuncation();
              hideLoader();
            }, 1000);
          }
        } else if (response.data.status.status === 500) {
          toast.error("Invalid username or password");
          hideLoader();
        }
      })
      .catch((error) => {
        toast.error("Oops, something went wrong. Please try again later.");
        hideLoader();
      });
  };

  useEffect(() => {
    getUsersList();
  }, []);

  const handleViewUser = (userObj) => {
    console.log("view user details", userObj);
    const userName = `${userObj.firstName} ${userObj.lastName}`;
    navigate(`/dashboard?userFilesUserID=${userObj.userID}&userName=${encodeURIComponent(userName)}`);
  };

  return (
    <>
      <section className="content scroll-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-12">
              <div className="card card-primary card-outline">
                <div className="card-header">
                  <h3 className="card-title text-sm">
                    Users List ( {allUsersList.length} )
                  </h3>
                </div>
                <div className="card-body text-sm" style={{ overflowX: "auto" }}>
                  <table id="example1" className="table table-bordered table-sm">
                    <thead>
                      <tr>
                        <th
                          style={{ fontWeight: "500", fontSize: "smaller" }}
                          className="text-center"
                        >
                          Sr. No.
                        </th>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>
                          Employee ID
                        </th>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>
                          First Name
                        </th>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>
                          Last Name
                        </th>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>
                          Email
                        </th>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>Role</th>
                        <th
                          style={{
                            fontWeight: "500",
                            fontSize: "smaller",
                            width: "7%",
                          }}
                        >
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUsersList.length > 0
                        ? allUsersList.map((userObj, index) => (
                          <tr key={userObj.userID}>
                            <td
                              style={{
                                fontWeight: "400",
                                fontSize: "smaller",
                              }}
                              className="text-center text-sm"
                            >
                              {index + 1}
                            </td>
                            <td
                              style={{
                                fontWeight: "400",
                                fontSize: "smaller",
                              }}
                            >
                              {userObj.employeeId}
                            </td>
                            <td
                              style={{
                                fontWeight: "400",
                                fontSize: "smaller",
                              }}
                            >
                              {userObj.firstName}
                            </td>
                            <td
                              style={{
                                fontWeight: "400",
                                fontSize: "smaller",
                              }}
                            >
                              {userObj.lastName}
                            </td>
                            <td
                              style={{
                                fontWeight: "400",
                                fontSize: "smaller",
                              }}
                            >
                              {userObj.email}
                            </td>
                            <td style={{ fontWeight: "400", fontSize: "smaller" }}>{userObj.roleName}</td>
                            <td
                              style={{
                                fontWeight: "400",
                                fontSize: "smaller",
                              }}
                              className="text-center text-sm"
                            >
                              <button
                                type="button"
                                className="btn bg-gradient-warning btn-xs btn-xs-custom"
                                onClick={() => handleViewUser(userObj)}
                              >
                                <i className="fas fa-eye"></i>
                              </button>
                            </td>
                          </tr>
                        ))
                        : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default AllUsersFilesAndFolders;