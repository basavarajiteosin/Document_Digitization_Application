import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import axios from "axios";
import { useNavigate } from "react-router-dom";
const config = require("../../services/config.json");

function StorageLimitForUser() {
  const personalInfo = useSelector((state) => state.personalInformationReducer);
  const loggedUserId = personalInfo.userID;
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [storageValue, setStorageValue] = useState("");
  const [storageUnit, setStorageUnit] = useState("MB");
  const [userError, setUserError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [userLimits, setUserLimits] = useState({});

  // Fetch users from API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(
          `${config.DDA_API_API_URL}AuthMasterController/GetAllUsers?ClientId=dmsApp`
        );
        if (response.data.success) {
      const filteredUsers = response.data.data.map((user) => ({
        value: user.userID,
        label: `${user.firstName} ${user.lastName}`,
        ...user,
      }));
      setUsers(filteredUsers);

        } else {
          toast.error("Failed to fetch users");
        }
      } catch (error) {
        console.error("Error fetching users:", error);
        toast.error("Error fetching users");
      }
    };

    const fetchUserLimits = async () => {
      try {
        const response = await axios.get(
          `${config.DDA_API_API_URL}GlobalAdmin/GetAllUsersDataLimit`
        );
        if (response.data.success) {
          const limits = {};
          response.data.data.forEach((limit) => {
            limits[limit.userId] = {
              maximumAllocatedStorage: bytesToRead(limit.maximumAllocatedStorage),
              usedStorage: bytesToRead(limit.usedStorage),
            };
          });
          setUserLimits(limits);
        } else {
          toast.error("Failed to fetch user storage limits");
        }
      } catch (error) {
        console.error("Error fetching user storage limits:", error);
        toast.error("Error fetching user storage limits");
      }
    };

    fetchUsers();
    fetchUserLimits();
  }, []);

  // Convert bytes to KB, MB, GB
  const bytesToRead = (bytes) => {
    if (!bytes || bytes === 0) return "0 KB";
    const units = ["Bytes", "KB", "MB", "GB"];
    let value = Number(bytes);
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    const roundedValue = Math.round(value * 100) / 100;
    return `${roundedValue.toString().replace(/\.0+$/, "")} ${units[unitIndex]}`;
  };

  // Parse storage limit for editing
  const parseStorageLimit = (limit) => {
    if (!limit || limit === "Not Set") return { value: "", unit: "MB" };
    const [value, unit] = limit.split(" ");
    return { value: value || "", unit: unit.toUpperCase() };
  };

  // Manual validation for storage limit
  const validateStorageLimit = (value, unit) => {
    // Check if value is empty
    if (!value.trim()) {
      return "Storage value cannot be empty";
    }
    // Check if value is a valid positive number (integer or decimal)
    const numberRegex = /^\d+(\.\d+)?$/;
    if (!numberRegex.test(value)) {
      return "Storage value must be a positive number";
    }
    const numValue = parseFloat(value);
    if (numValue <= 0) {
      return "Storage value must be greater than 0";
    }
    // Check if unit is valid
    if (!["KB", "MB", "GB"].includes(unit.toUpperCase())) {
      return "Invalid unit. Select KB, MB, or GB";
    }
    return "";
  };

  // Convert storage limit to bytes
  const convertToBytes = (value, unit) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 0;

    switch (unit.toUpperCase()) {
      case "KB":
        return Math.round(numValue * 1024);
      case "MB":
        return Math.round(numValue * 1024 * 1024);
      case "GB":
        return Math.round(numValue * 1024 * 1024 * 1024);
      default:
        return 0;
    }
  };

  // Handle form submission
const handleSubmit = async () => {
  let isValid = true;

  // Validate user
  if (!selectedUser) {
    setUserError("Please select a user");
    isValid = false;
  } else {
    setUserError("");
  }

  // Validate storage input
  const storageValidationError = validateStorageLimit(storageValue, storageUnit);
  if (storageValidationError) {
    setStorageError(storageValidationError);
    isValid = false;
  } else {
    setStorageError("");
  }

  // Validate storage limit against used storage
  const newStorageLimitBytes = convertToBytes(storageValue, storageUnit);
  const usedStorage = userLimits[selectedUser?.value]?.usedStorage || "0 KB";
  const usedStorageBytes = convertToBytes(
    parseFloat(usedStorage.split(" ")[0]),
    usedStorage.split(" ")[1]
  );

  if (newStorageLimitBytes < usedStorageBytes) {
    setStorageError(
      `Storage limit (${storageValue} ${storageUnit}) cannot be less than used storage (${usedStorage})`
    );
    isValid = false;
  }

  if (!isValid) return;

  const payload = {
    userId: selectedUser.value,
    maximumAllocatedStorage: newStorageLimitBytes,
    loggedUserId,
  };

  try {
    const response = await axios.post(
      `${config.DDA_API_API_URL}GlobalAdmin/SetOrUpdateUserLimit`,
      payload
    );
    if (response.data.success) {
      toast.success("Storage limit updated");
      setUserLimits((prev) => ({
        ...prev,
        [selectedUser.value]: {
          maximumAllocatedStorage: `${storageValue} ${storageUnit}`,
          usedStorage: prev[selectedUser.value]?.usedStorage || "0 KB",
        },
      }));
      setSelectedUser(null);
      setStorageValue("");
      setStorageUnit("MB");
      setEditMode(false);
      // Refresh user limits
      const responseLimits = await axios.get(
        `${config.DDA_API_API_URL}GlobalAdmin/GetAllUsersDataLimit`
      );
      if (responseLimits.data.success) {
        const limits = {};
        responseLimits.data.data.forEach((limit) => {
          limits[limit.userId] = {
            maximumAllocatedStorage: bytesToRead(limit.maximumAllocatedStorage),
            usedStorage: bytesToRead(limit.usedStorage),
          };
        });
        setUserLimits(limits);
      }
    } else {
      toast.error("Failed to update storage limit");
    }
  } catch (error) {
    console.error("Error updating storage limit:", error);
    toast.error("Error updating storage limit");
  }
};

  // Handle edit
  const handleEditUser = (user) => {
    setSelectedUser({
      value: user.userID,
      label: `${user.firstName} ${user.lastName} - ${user.email}`,
    });
    const { value, unit } = parseStorageLimit(userLimits[user.userID]?.maximumAllocatedStorage);
    setStorageValue(value);
    setStorageUnit(unit);
    setEditMode(true);
  };

  // Handle view
  const handleViewUser = (user) => {
    navigate(`/folder?user=${user.userID}`);
  };

  return (
    <>
      
      <section className="content scroll-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-12">
              <div className="card card-primary card-outline">
                <div className="card-header">
                  <h3 className="card-title text-sm">Set Storage Limits</h3>
                </div>
                <div className="card-body text-sm">
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <div className="form-group">
                        <label htmlFor="userSelect">
                          Select User <sup style={{ color: "red" }}>*</sup>
                        </label>
                        <select
                          id="userSelect"
                          className={`form-control form-control-sm ${userError ? "is-invalid" : ""}`}
                          value={selectedUser?.value || ""}
                          onChange={(e) => {
                            const user = users.find((u) => u.value === e.target.value);
                            setSelectedUser(user || null);
                            setUserError("");
                          }}
                        >
                          <option value="">Select a user</option>
                          {users.map((user) => (
                            <option key={user.value} value={user.value}>
                              {user.label}
                            </option>
                          ))}
                        </select>
                        {userError && <div className="invalid-feedback">{userError}</div>}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-group">
                        <label htmlFor="storageLimit">
                          Storage Limit <sup style={{ color: "red" }}>*</sup>
                        </label>
                        <div className={`storage-limit-input ${storageError ? "is-invalid" : ""}`}>
                          <input
                            type="text"
                            id="storageLimit"
                            className={`form-control form-control-sm ${storageError ? "is-invalid" : ""}`}
                            value={storageValue}
                            onChange={(e) => {
                              setStorageValue(e.target.value);
                              setStorageError("");
                            }}
                            placeholder="e.g., 100"
                          />
                          <select
                            className={`form-control form-control-sm ${storageError ? "is-invalid" : ""}`}
                            value={storageUnit}
                            onChange={(e) => {
                              setStorageUnit(e.target.value);
                              setStorageError("");
                            }}
                          >
                            <option value="KB">KB</option>
                            <option value="MB">MB</option>
                            <option value="GB">GB</option>
                          </select>
                        </div>
                        {storageError && <div className="invalid-feedback">{storageError}</div>}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSubmit}
                    disabled={!selectedUser || !storageValue}
                  >
                    {editMode ? "Update" : "Set"} Storage Limit
                  </button>
                </div>
                <div className="card-footer text-sm"></div>
              </div>
            </div>
            <div className="col-md-12">
              <div className="card card-primary card-outline">
                <div className="card-header">
                  <h3 className="card-title text-sm">Users List ( {users.length} )</h3>
                </div>
                <div className="card-body text-sm" style={{ overflowX: "auto" }}>
                  <table id="example1" className="table table-bordered table-sm">
                    <thead>
                      <tr>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }} className="text-center">
                          Sr. No.
                        </th>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>First Name</th>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>Last Name</th>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>Email</th>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>Role</th>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>Storage Limit</th>
                        <th style={{ fontWeight: "500", fontSize: "smaller" }}>Used Storage</th>
                        <th style={{ fontWeight: "500", fontSize: "smaller", width: "7%" }}>
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length > 0 ? (
                        users.map((user, index) => (
                          <tr key={user.userID}>
                            <td style={{ fontWeight: "400", fontSize: "smaller" }} className="text-center text-sm">
                              {index + 1}
                            </td>
                            <td style={{ fontWeight: "400", fontSize: "smaller" }}>{user.firstName}</td>
                            <td style={{ fontWeight: "400", fontSize: "smaller" }}>{user.lastName}</td>
                            <td style={{ fontWeight: "400", fontSize: "smaller" }}>{user.email}</td>
                            <td style={{ fontWeight: "400", fontSize: "smaller" }}>{user.roleName}</td>
                            <td style={{ fontWeight: "400", fontSize: "smaller" }}>
                              {userLimits[user.userID]?.maximumAllocatedStorage || "Not Set"}
                            </td>
                            <td style={{ fontWeight: "400", fontSize: "smaller" }}>
                              {userLimits[user.userID]?.usedStorage || "0 KB"}
                            </td>
                            <td style={{ fontWeight: "400", fontSize: "smaller" }} className="text-center text-sm">
                              <button
                                type="button"
                                className="btn bg-gradient-warning btn-xs btn-xs-custom mr-2"
                                onClick={() => handleEditUser(user)}
                              >
                                <i className="fas fa-pen"></i>
                              </button>
                             
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="text-center">
                            No users found
                          </td>
                        </tr>
                      )}
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
}

export default StorageLimitForUser;