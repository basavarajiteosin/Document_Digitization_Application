import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
const config = require("../../../services/config.json");

const AccessType = () => {
  const [accessTypes, setAccessTypes] = useState([]);
  const [description, setDescription] = useState("");
  const [selectedAccessId, setSelectedAccessId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const inputDescriptionRef = useRef(null);

  useEffect(() => {
    fetchAccessTypes();
  }, []);

  const fetchAccessTypes = async () => {
    window.initDestroyDataTableFuncation();
    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}FieldMaster/GetAllAccessTypeMasters`,
        { headers: config.headers2 }
      );
      setAccessTypes(response.data.data);
      setTimeout(() => {
        window.initDataTableFuncation();
      }, 1000);
    } catch (error) {
      toast.error("Error fetching access types");
      console.error("Error fetching access types:", error);
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!description) {
      toast.error("Please enter a description.");
      inputDescriptionRef.current?.focus();
      inputDescriptionRef.current?.classList.add("is-invalid");
      return;
    }

    const apiUrl = isEditing
      ? `${config.DDA_API_API_URL}FieldMaster/UpdateAccessTypeMaster`
      : `${config.DDA_API_API_URL}FieldMaster/CreateAccessTypeMaster`;

    const payload = {
      accessId: selectedAccessId || 0,
      accessDec: description,
    };

    try {
      const response = await axios.post(apiUrl, payload, {
        headers: config.headers2,
      });

      if (response.data.success) {
        toast.success(response.data.message);
        fetchAccessTypes();
        resetForm();
      } else {
        toast.error(response.data.message || "Error creating/updating access type");
        console.error("Error creating/updating access type:", response.data.message);
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Error creating/updating access type";
      toast.error(errorMessage);
      console.error("Error creating/updating access type:", errorMessage);
    }
  };

  const handleEdit = (accessType) => {
    setSelectedAccessId(accessType.accessId);
    setDescription(accessType.accessDec);
    setIsEditing(true);
  };

  const handleDelete = async (accessId) => {
    try {
      const response = await axios.post(
        `${config.DDA_API_API_URL}FieldMaster/DeleteAccessTypeMaster/${accessId}`,
        null,
        { headers: config.headers2 }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        fetchAccessTypes();
      } else {
        toast.error(response.data.message);
        console.error("Error deleting access type:", response.data.message);
      }
    } catch (error) {
      toast.error("Error deleting access type");
      console.error("Error deleting access type:", error);
    }
  };

  const resetForm = () => {
    setSelectedAccessId(null);
    setDescription("");
    setIsEditing(false);
    inputDescriptionRef.current?.classList.remove("is-invalid");
  };

  return (
    <div>
    
      <form
      className="row"
        onSubmit={(e) => {
          e.preventDefault();
          handleCreateOrUpdate();
        }}
      >
        <div className="col-md-12">
        <div className="form-group">
          <label htmlFor="description">Access Type <span className="text-danger">*</span></label>
          <input
            type="text"
            className="form-control form-control-sm mt-2"
            id="description"
            ref={inputDescriptionRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter access type description"
          />
        </div>
        <div className="d-flex align-items-center justify-content-end mb-3">
          <button type="submit" className="btn btn-sm btn-primary">
            {isEditing ? "Update" : "Create"}
          </button>
          {isEditing && (
            <button
              type="button"
              className="btn btn-sm btn-default ml-2"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </div>
        </div>
      </form>

      <table id="example1" className="table table-bordered table-sm mt-3">
        <thead>
          <tr>
            <th style={{ fontWeight: "500", fontSize: "smaller" }}>SLNo.</th>
            <th style={{ fontWeight: "500", fontSize: "smaller" }}>
              Description
            </th>
            <th style={{ fontWeight: "500", fontSize: "smaller" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {accessTypes.map((accessType, index) => (
            <tr key={accessType.accessId}>
              <td style={{ fontWeight: "400", fontSize: "smaller" }}>
                {index + 1}
              </td>
              <td style={{ fontWeight: "400", fontSize: "smaller" }}>
                {accessType.accessDec}
              </td>
              <td style={{ fontWeight: "400", fontSize: "smaller" }}>
                <button
                  type="button"
                  className="btn bg-gradient-warning btn-xs btn-xs-custom"
                  onClick={() => handleEdit(accessType)}
                 
                >
                  <i className="fas fa-pen" ></i>
                </button>
                <button
                  type="button"
                  className="btn bg-gradient-danger btn-xs ml-2 btn-xs-custom"
                  onClick={() => handleDelete(accessType.accessId)}
                 
                >
                  <i className="fas fa-trash" ></i>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AccessType;
