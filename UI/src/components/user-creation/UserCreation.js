import React, { useRef, useEffect, useState, useLayoutEffect } from "react";
import { useSelector } from "react-redux";
import { removeExtraSpaces } from "../../common/textOperations";
import { isValidContact } from "../../common/validations";
import { toast } from "react-toastify";
import PleaseWaitButton from "../../shared/PleaseWaitButton";
import axios from "axios";
import Switch from "react-switch";
import { useLoader } from '../../Customhook/LoaderContext';
import countryCodes from '../../common/countryCodes.json';
import $ from "jquery";

const config = require("../../services/config.json");

const UserCreation = () => {
  const inputFirstNameReference = useRef(null);
  const inputLastNameReference = useRef(null);
  const inputDesignationReference = useRef(null);
  const inputDivisionReference = useRef(null);

  const inputEmployeeIdReference = useRef(null);
  const inputEmailReference = useRef(null);
  const inputRoleReference = useRef(null);
  const inputPasswordReference = useRef(null);
  const inputContactNumberReference = useRef(null);
  const personalInfo = useSelector((state) => state.personalInformationReducer);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [employeeId, setemployeeId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [password, setPassword] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [designation, setdesignation] = useState("");
  const [isLoaderActive, setIsLoaderActive] = useState(false);
  const [allRolesList, setAllRolesList] = useState([]);
  const [allUsersList, setAllUsersList] = useState([]);
  const [updateOrDeleteId, setUpdateOrDeleteId] = useState("");
  const [division, setDivision] = useState("");
  const inputIsActiveReference = useRef(null);
  const [isActive, setIsActive] = useState("");

  const [countryCode, setCountryCode] = useState('');
  // const [contactNumber, setContactNumber] = useState('');
  // const inputContactNumberReference = useRef(null);
  const { showLoader, hideLoader } = useLoader();
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  const [emailDomains, setEmailDomains] = useState([]);
  const handleChange = (e) => {
    const selectedCountry = countryCodes.find(country => country.name === e.target.value);
    setCountryCode(selectedCountry ? selectedCountry.code : '');
    setContactNumber(''); // Clear contact number when country changes
  };

  const [hasShownToast, setHasShownToast] = useState(false);
  const handleContactNumberChange = (e) => {
    const value = e.target.value;

    if (/^\d*$/.test(value)) {
      if (value.length <= 11) {
        setContactNumber(value);
        setHasShownToast(false);
      } else if (value.length > 11 && !hasShownToast) {
        toast.error("Contact number must not exceed 11 digits.");
        setHasShownToast(true);
      }
    } else if (!hasShownToast) {
      toast.error("Please enter a valid contact number (digits only).");
      setHasShownToast(true);
    }
  };



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
      toast.error("Error fetching email domains");
      console.error("Error fetching email domains:", error);
    }
  };


  useEffect(() => {
    getAllRolesList();
    getUsersList();
    fetchEmailDomains();
  }, []);

  const isEmailDomainValid = (email) => {
    const emailDomain = email.split('@')[1];
    return emailDomains.some(domain => domain.domain === emailDomain);
  };


  const firstUpdate = useRef(true);
  useLayoutEffect(() => {
    if (firstUpdate.current) {
      window.initDatePickerFuncation();
      return;
    }


  });

  const handleCancelClick = () => {
    clearAllFields();
    addProjectCardHeaderButtonClick();
  };

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
        if (response.status == 200) {

          if (response.data.success == "success") {
            if (response.data.data.length > 0) {
              setAllUsersList(response.data.data);
              setTimeout(() => {
                window.initDataTableFuncation();
                hideLoader();
              }, 1000);

            }
          } else {
            toast.error(response.data.message);
            setTimeout(() => {
              window.initDataTableFuncation();
            }, 1000);
          }
        } else if (response.data.status.status == 500) {
          toast.error("Invalid username or password");
          hideLoader()
        }
      })
      .catch((error) => {
        toast.error("oops something went wrong. please try again later.");
        hideLoader()
      });
  };


  const getAllRolesList = () => {
    axios
      .get(
        config.DDA_API_API_URL +
        "AuthMasterController/GetAllRoles?ClientId=" +
        config.clientId,
        {
          headers: config.headers2,
        }
      )
      .then((response) => {
        if (response.status === 200) {

          if (response.data.success === "success") {
            if (response.data.data.length > 0) {
              // Sort the roles alphabetically by role name
              const sortedRoles = response.data.data.sort((a, b) => {
                return a.roleName.localeCompare(b.roleName); // assuming the role name field is 'roleName'
              });
              setAllRolesList(sortedRoles);
            }
          } else {
            toast.error(response.data.message);
          }
        } else if (response.data.status.status === 500) {
          toast.error("Invalid username or password");
        }
      })
      .catch((error) => {
        toast.error("Oops, something went wrong. Please try again later.");
      });
  };

  const addProjectCardHeaderButtonClick = () => {
    $("#listOfProjectsHeaderExpandButtion").click();
  };

  const listOfProjectsHeaderExpandButtionClick = () => {
    $("#AddNewHeaderButton").click();
  };

  // const handleEditTaskDetails = (userObj) => {


  //   setemployeeId(userObj.employeeId);
  //   setUserEmail(userObj.email);
  //   setRoleId(userObj.roleID);
  //   setPassword(userObj.password);
  //   setContactNumber(userObj.contactNumber);
  //   setdesignation(userObj.designation);
  //   setDivision(userObj.division);
  //   setUpdateOrDeleteId(userObj.userID);

  //   setFirstName(userObj.firstName);
  //   setLastName(userObj.lastName);
  //   setAddress(userObj.address);
  //   setIsActive(userObj.isActive);

  //   listOfProjectsHeaderExpandButtionClick();
  //   window.scrollTo({ top: 0, behavior: "smooth" });
  // };
  const handleEditTaskDetails = (userObj) => {
    const [countryCode, contactNumber] = userObj.contactNumber.split('-');

    setemployeeId(userObj.employeeId);
    setUserEmail(userObj.email);
    setRoleId(userObj.roleID);
    setPassword(userObj.password);
    setContactNumber(contactNumber); // Set the extracted contact number
    setCountryCode(countryCode); // Set the country code
    setdesignation(userObj.designation);
    setDivision(userObj.division);
    setUpdateOrDeleteId(userObj.userID);
    setFirstName(userObj.firstName);
    setLastName(userObj.lastName);
    setAddress(userObj.address);
    setIsActive(userObj.isActive);

    listOfProjectsHeaderExpandButtionClick();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRemoveUser = (userObj) => {
    setUpdateOrDeleteId(userObj.userID);
    window.confirmModalShow();
  };

  const yesConfirmSubmitRequest = () => {
    // setIsLoaderActive(true);
    let APIMethodName =
      "AuthMasterController/DeleteUser?ClientId=" +
      config.clientId +
      "&UserID=" +
      updateOrDeleteId;
    axios
      .post(config.DDA_API_API_URL + APIMethodName, {
        headers: config.headers2,
      })
      .then((response) => {

        if (response.data.success == "success") {
          toast.success("User deleted successfully...");
          window.confirmModalHide();
          clearAllFields();
          getUsersList();
          setIsLoaderActive(false);
        } else {
          setIsLoaderActive(false);
          toast.error(response.data.message);
        }
      })
      .catch((error) => {
        if (!error.response.data.success) {
          toast.error(error.response.data.message);
        } else {
          toast.error("oops something went wrong. please try again later.");
        }
        setIsLoaderActive(false);
      });
  };

  const clearAllFields = () => {
    setemployeeId("");
    setUserEmail("");
    setRoleId("");
    setPassword("");
    setContactNumber("");
    setCountryCode("")
    setdesignation("");
    setDivision("");
    setUpdateOrDeleteId("");

    setFirstName("");
    setLastName("");
    setAddress("");
    setIsActive("")

    $("#inputDateOfBirthV").val("");
    $("#joiningDateV").val("");
  };

  const handleUserSubmit = (e) => {
    const formattedContactNumber = `${countryCode}-${contactNumber}`;
    e.preventDefault();

    if (!roleId) {
      toast.error("Please select role.");
      inputRoleReference.current?.focus();
      inputRoleReference.current?.classList.add("is-invalid");
      return;
    }

    if (!removeExtraSpaces(firstName)) {
      toast.error("Please enter first name.");
      inputFirstNameReference.current?.focus();
      inputFirstNameReference.current?.classList.add("is-invalid");
      return;
    }
    if (!removeExtraSpaces(lastName)) {
      toast.error("Please enter last name.");
      inputLastNameReference.current?.focus();
      inputLastNameReference.current?.classList.add("is-invalid");
      return;
    }
    if (!removeExtraSpaces(employeeId)) {
      toast.error("Please enter Employee Id.");
      inputEmployeeIdReference.current?.focus();
      inputEmployeeIdReference.current?.classList.add("is-invalid");
      return;
    }
    if (!removeExtraSpaces(userEmail)) {
      toast.error("Please enter email.");
      inputEmailReference.current?.focus();
      inputEmailReference.current?.classList.add("is-invalid");
      return;
    }
    if (!isEmailDomainValid(userEmail)) {
      toast.error("Email domain is not valid.");
      inputEmailReference.current?.focus();
      inputEmailReference.current?.classList.add("is-invalid");
      return;
    }

    if (!password) { toast.error("Please enter password."); inputPasswordReference.current?.focus(); inputPasswordReference.current?.classList.add("is-invalid"); return; }

    if (!passwordRegex.test(password)) { toast.error("Password must be at least 8 characters and contain uppercase, lowercase, number, and special character (@, $, !, %, *, ?, &)."); inputPasswordReference.current?.focus(); inputPasswordReference.current?.classList.add("is-invalid"); return; }

    if (!contactNumber) {
      toast.error("Please enter contact number.");
      inputContactNumberReference.current?.focus();
      inputContactNumberReference.current?.classList.add("is-invalid");
      return;
    }
    // if (!isValidContact(contactNumber)) {
    //   toast.error("Please enter a valid contact number.");
    //   toast.error('Please enter a valid contact number. It should start with 7, 8, or 9 and be between 10 to 20 digits long. Optionally, it can start with a "+" sign.');
    //   inputContactNumberReference.current?.focus();
    //   inputContactNumberReference.current?.classList.add("is-invalid");
    //   return;
    // }
    if (!removeExtraSpaces(designation)) {
      toast.error("Please enter designation.");
      inputDesignationReference.current?.focus();
      inputDesignationReference.current?.classList.add("is-invalid");
      return;
    }
    if (!removeExtraSpaces(division)) {
      toast.error("Please enter division.");
      inputDivisionReference.current?.focus();
      inputDivisionReference.current?.classList.add("is-invalid");
      return;
    }


    // setIsLoaderActive(true);
    showLoader();
    const APIMethodName = updateOrDeleteId
      ? "AuthMasterController/UpdateUser"
      : "AuthMasterController/CreateUser";
    const getRoleName = allRolesList.find((x) => x.roleID === roleId);

    axios
      .post(
        `${config.DDA_API_API_URL}${APIMethodName}`,
        {
          createdBy: personalInfo.userID,
          clientId: config.clientId,
          modifiedBy: personalInfo.userID,
          userID: updateOrDeleteId,
          roleID: roleId,
          employeeId: employeeId,
          email: userEmail,
          password: password,
          contactNumber: formattedContactNumber,
          designation: designation,
          division: division,
          firstName: firstName,
          lastName: lastName,

          address: address,
          dateOfBirth: $("#inputDateOfBirthV").val(),
          joiningDate: $("#joiningDateV").val(),
          roleName: getRoleName?.roleName,
          isActive: updateOrDeleteId ? isActive : true,
        },
        {
          headers: config.headers3,
        }
      )
      .then((response) => {
        if (response.data.success === "success") {
          const successMessage = updateOrDeleteId
            ? "User updated successfully."
            : "User created successfully.";
          toast.success(successMessage);
          clearAllFields();
          addProjectCardHeaderButtonClick();
          getUsersList();
        } else {
          toast.error(response.data.message);
        }
        hideLoader();
      })
      .catch((error) => {
        const errorMessage =
          error.response?.data?.message ||
          "Oops, something went wrong. Please try again later.";
        toast.error(errorMessage);
        // setIsLoaderActive(false);
        hideLoader();
      });
  };


  const handleToggleUserStatus = async (userObj) => {
    setIsLoaderActive(true);
    try {
      // Construct the URL without query parameters
      const url = `${config.DDA_API_API_URL}AuthMasterController/UpdateUser`;

      // Prepare the data object
      const data = {
        userID: userObj.userID,
        roleID: userObj.roleID,
        EmployeeId: userObj.employeeId,
        email: userObj.email,
        password: userObj.password,
        contactNumber: userObj.contactNumber,
        designation: userObj.designation,
        division: userObj.division,
        firstName: userObj.firstName,
        lastName: userObj.lastName,
        address: userObj.address,
        dateOfBirth: userObj.dateOfBirth,
        joiningDate: userObj.joiningDate,
        roleName: userObj.roleName,
        isActive: !userObj.isActive,
        ClientId: config.clientId,
      };

      // Send the POST request
      const response = await axios.post(url, data, {
        headers: config.headers3,
      });

      if (response.data.success) {
        toast.success("User status updated successfully!");
        getUsersList();
      } else {
        toast.error("Failed to update user status");
      }
    } catch (error) {
      toast.error("An error occurred while updating user status");
    } finally {
      setIsLoaderActive(false);
    }
  };

  // division dropdown

  const [divisions, setDivisions] = useState([]);
  useEffect(() => {
    // Fetch the division data from the API
    axios
      .get(config.DDA_API_API_URL + "FieldMaster/GetAllDivisionMasters", {
        headers: config.headers2,
      })
      .then((response) => {
        if (response.data.success) {
          // Sort divisions alphabetically by description before setting state
          const sortedDivisions = response.data.data.sort((a, b) =>
            a.description.localeCompare(b.description)
          );
          setDivisions(sortedDivisions);
        }
      })
      .catch((error) => {
        console.error("There was an error fetching the divisions!", error);
      });
  }, []);
  return (
    <>
      <section className="content scroll-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-12">
              <div className="card card-primary card-outline ">
                <div className="card-header">
                  <h3 className="card-title text-sm">Create New User</h3>
                </div>
                <div className="card-body text-sm">
                  <div className="row">
                    <div className="form-group col-md-4">
                      <label>
                        Select Role<sup style={{ color: "red" }}>*</sup>
                      </label>
                      <select
                        className="form-control form-control-sm"
                        ref={inputRoleReference}
                        value={roleId}
                        onChange={(e) => setRoleId(e.target.value)}
                      >
                        <option value="">--Select--</option>
                        {allRolesList.map((role) => {
                          return (
                            <option
                              key={"Mana_" + role.roleID}
                              value={role.roleID}
                            >
                              {role.roleName}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="form-group col-md-4">
                      <label for="firstNameInput">
                        First Name<sup style={{ color: "red" }}>*</sup>
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        id="firstNameInput"
                        ref={inputFirstNameReference}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder=" First Name"
                      />
                    </div>
                    <div className="form-group col-md-4">
                      <label for="lastNameInput">
                        Last Name<sup style={{ color: "red" }}>*</sup>
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        id="lastNameInput"
                        ref={inputLastNameReference}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder=" Last Name"
                      />
                    </div>
                    <div className="form-group col-md-4">
                      <label for="employeeIdInput">
                        Employee ID<sup style={{ color: "red" }}>*</sup>
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        id="employeeIdInput"
                        ref={inputEmployeeIdReference}
                        value={employeeId}
                        onChange={(e) => setemployeeId(e.target.value)}
                        placeholder="Employee ID"
                      />
                    </div>
                    <div className="form-group  col-md-4">
                      <label for="userEmailInput">
                        Email<sup style={{ color: "red" }}>*</sup>
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        id="userEmailInput"
                        ref={inputEmailReference}
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder=" Email"
                      />
                    </div>
                    <div className="form-group col-md-4">
                      <label for="passwordInput">
                        Password<sup style={{ color: "red" }}>*</sup>
                      </label>
                      <input
                        type="password"
                        className="form-control form-control-sm"
                        id="passwordInput"
                        ref={inputPasswordReference}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                      />
                      <span
                        toggle="#passwordInput"
                        class="fa fa-fw fa-eye field-icon-password toggle-password"
                      ></span>
                    </div>
                    <div className="form-group col-md-8">
                      <label htmlFor="contactNumberInput">
                        Contact Number<sup style={{ color: "red" }}>*</sup>
                      </label>
                      <div className="input-group  ">
                        {/* Country Code dropdown */}
                        <select
                          name="countryCode"
                          // value={countryCode} // Bind the value to the countryCode state
                          value={countryCodes.find(country => country.code === countryCode)?.name || ''}
                          onChange={handleChange}
                          className="form-control form-control-sm contact-number-dropdown"
                          placeholder="Select country"
                        >
                          <option value="" disabled hidden>
                            Select Country
                          </option>
                          {countryCodes.map((country, index) => (
                            <option key={`${country.code}-${index}`} value={country.name}>
                              {country.name}
                            </option>
                          ))}
                        </select>

                        {/* Disabled input showing the selected country code */}
                        <input
                          type="text"
                          className="form-control form-control-sm contact-number"
                          value={countryCode}
                          placeholder="code"
                          disabled
                        />

                        {/* Contact number input field */}
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          id="contactNumberInput"
                          ref={inputContactNumberReference}
                          value={contactNumber}
                          onChange={handleContactNumberChange}
                          placeholder="Enter Contact Number"
                          disabled={!countryCode}
                        />
                      </div>
                    </div>
                    {/* <div className="form-group col-md-4">
                      <label htmlFor="contactNumberInput">
                        Contact Number<sup style={{ color: "red" }}>*</sup>
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        id="contactNumberInput"
                        // ref={inputContactNumberReference}
                        value={contactNumber}
                        onChange={(e) => {
                          // Get the numeric value and keep the first character as '+'
                          const inputValue = e.target.value;
                          const numericValue = inputValue.replace(
                            /[^+\d]/g,
                            ""
                          );

                          // Limit the length to 20 characters
                          const limitedValue = numericValue.slice(0, 20);

                          // Update state with the limited value
                          setContactNumber(limitedValue);
                        }}
                        placeholder="Contact Number"
                        pattern="\d*"
                        inputMode="numeric"
                        maxLength={20} // This limits the number of characters the user can enter
                      />
                    </div> */}

                    <div className="form-group  col-md-4">
                      <label for="designationInput">
                        Designation
                        <sup style={{ color: "red" }}>*</sup>
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        id="designationInput"
                        ref={inputDesignationReference}
                        value={designation}
                        onChange={(e) => setdesignation(e.target.value)}
                        placeholder="Enter Designation"
                      />
                    </div>
                    <div className="form-group col-md-4">
                      <label htmlFor="divisionInput">
                        Division<sup style={{ color: "red" }}>*</sup>
                      </label>
                      <select
                        className="form-control form-control-sm"
                        id="divisionInput"
                        ref={inputDivisionReference}
                        value={division}
                        onChange={(e) => setDivision(e.target.value)}
                        placeholder="Select Division"
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
                    <div className="form-group col-md-4">
                      <label htmlFor="isActiveInput">
                        isActive<sup style={{ color: "red" }}>*</sup>
                      </label>
                      <select
                        className="form-control form-control-sm"
                        id="isActiveInput"
                        ref={inputIsActiveReference}
                        value={isActive}
                        onChange={(e) => setIsActive(e.target.value)}
                        placeholder="Select Status"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>

                  </div>
                </div>
                <div className="card-footer text-sm">
                  {/* {isLoaderActive ? (
                    <PleaseWaitButton className="float-right btn-xs ml-2 font-weight-medium auth-form-btn" />
                  ) : ( */}
                  <button
                    type="submit"
                    className="btn btn-primary float-right btn-xs ml-2"
                    onClick={(e) => {
                      handleUserSubmit(e);
                    }}
                  >
                    {updateOrDeleteId ? 'Update & Submit' : 'Save & Submit'}
                  </button>

                  {/* )} */}
                  <button
                    type="submit"
                    className="btn btn-default float-right btn-xs"
                    onClick={(e) => {
                      handleCancelClick(e);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-md-12">
              <div className="card card-primary card-outline ">
                <div className="card-header">
                  <h3 className="card-title text-sm">
                    Users List ( {allUsersList.length} )
                  </h3>
                </div>
                <div className="card-body text-sm" style={{ overflowX: "auto" }}>
                  <table id="example1" className="table table-bordered table-sm ">
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
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>
                          Contact Number
                        </th>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>
                          Designation
                        </th>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>
                          Division
                        </th>

                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>
                          Role
                        </th>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>
                          Status
                        </th>

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
                        ? allUsersList.map((userObj, index) => {
                          return (
                            <tr>
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
                              <td
                                style={{
                                  fontWeight: "400",
                                  fontSize: "smaller",
                                }}
                              >
                                {userObj.contactNumber}
                              </td>
                              <td
                                style={{
                                  fontWeight: "400",
                                  fontSize: "smaller",
                                }}
                              >
                                {userObj.designation}
                              </td>
                              <td
                                style={{
                                  fontWeight: "400",
                                  fontSize: "smaller",
                                }}
                              >
                                {userObj.division}
                              </td>

                              <td
                                style={{
                                  fontWeight: "400",
                                  fontSize: "smaller",
                                }}
                              >
                                {userObj.roleName}
                              </td>
                              <td
                                style={{
                                  fontWeight: "400",
                                  fontSize: "smaller",
                                }}
                              >

                                <div
                                  className={`d-flex align-items-center ${userObj.roleName === "Administrator"
                                    ? "disabled"
                                    : ""
                                    }`}
                                  style={{
                                    opacity:
                                      userObj.roleName === "Administrator"
                                        ? 0.5
                                        : 1,
                                    pointerEvents:
                                      userObj.roleName === "Administrator"
                                        ? "none"
                                        : "auto",
                                  }}
                                >
                                  <label
                                    style={{
                                      fontWeight: "400",
                                      fontSize: "smaller",
                                      color: userObj.isActive
                                        ? "white"
                                        : "white",
                                      backgroundColor: userObj.isActive
                                        ? "green"
                                        : "red",
                                      padding: "2px 6px",
                                      borderRadius: "5px",
                                    }}
                                    className="mr-3"
                                  >
                                    {userObj.isActive ? "Active" : "Inactive"}
                                  </label>
                                  <Switch
                                    checked={userObj.isActive}
                                    width={30}
                                    height={15}
                                    className=""
                                    onChange={() =>
                                      handleToggleUserStatus(
                                        userObj,
                                        "isActive"
                                      )
                                    }
                                  />
                                </div>
                              </td>

                              <td
                                style={{
                                  fontWeight: "400",
                                  fontSize: "smaller",
                                }}
                                className="text-center text-sm d-flex"
                              >
                                <button
                                  type="button"
                                  className="btn bg-gradient-warning btn-xs"
                                  onClick={(e) => {
                                    handleEditTaskDetails(userObj);
                                  }}
                                  style={{
                                    padding: "5px",
                                    fontSize: ".75rem",
                                    lineHeight: "0",
                                    borderRadius: ".15rem",
                                  }}
                                >
                                  <i
                                    className="fas fa-pen"
                                    style={{ fontSize: "smaller" }}
                                  ></i>
                                </button>
                                {userObj.roleName !== "Administrator" ? (
                                  <>

                                    <button
                                      type="button"
                                      className="btn bg-gradient-danger btn-xs ml-2"
                                      onClick={() =>
                                        handleRemoveUser(userObj)
                                      }
                                      style={{
                                        padding: "5px",
                                        fontSize: ".75rem",
                                        lineHeight: "0",
                                        borderRadius: ".15rem",
                                      }}
                                    >
                                      <i
                                        className="fas fa-trash"
                                        style={{ fontSize: "smaller" }}
                                      ></i>
                                    </button>
                                  </>
                                ) : (
                                  <>

                                    <button
                                      type="button"
                                      className="btn bg-gradient-danger btn-xs ml-2"
                                      style={{
                                        padding: "5px",
                                        fontSize: ".75rem",
                                        lineHeight: "0",
                                        borderRadius: ".15rem",
                                      }}
                                      disabled
                                    >
                                      <i
                                        className="fas fa-trash"
                                        style={{ fontSize: "smaller" }}
                                      ></i>
                                    </button>
                                  </>
                                )}


                              </td>
                            </tr>
                          );
                        })
                        : ""}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        id="confirmCommonModal"
        class="modal fade confirmCommonModal"
        data-backdrop="static"
        tabindex="-1"
        role="dialog"
        aria-labelledby="staticBackdropLabel"
        aria-hidden="true"
      >
        <div class="modal-dialog modal-confirm">
          <div class="modal-content">
            <div class="modal-header">
              <div class="icon-box">
                <i class="fas fa-info"></i>
              </div>
              <h5 class="modal-title w-100">Are you sure ?</h5>
            </div>
            <div class="modal-body">
              <p class="text-center">
                By clicking on Yes delete all the user details. Once you deleted
                it can not be recovered.
              </p>
            </div>
            <div class="modal-footer col-md-12">
              <button class="btn btn-default btn-sm" data-dismiss="modal">
                Cancel
              </button>
              {isLoaderActive ? (
                <PleaseWaitButton className="btn-sm pl-3 pr-3 ml-2 font-weight-medium auth-form-btn" />
              ) : (
                <button
                  class="btn btn-warning btn-sm pl-3 pr-3 ml-2"
                  onClick={(e) => {
                    yesConfirmSubmitRequest(e);
                  }}
                >
                  Yes
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserCreation;
