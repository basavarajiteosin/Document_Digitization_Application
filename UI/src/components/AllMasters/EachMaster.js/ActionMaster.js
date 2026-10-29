import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
const config = require("../../../services/config.json");

const ActionMaster = () => {
  const [actions, setActions] = useState([]);
  const [description, setDescription] = useState("");
  const [selectedActionId, setSelectedActionId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const inputDescriptionRef = useRef(null);

  useEffect(() => {
    fetchActions();
  }, []);

  const fetchActions = async () => {
    window.initDestroyDataTableFuncation();
    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}FieldMaster/GetAllActionMasters`,
        { headers: config.headers2 }
      );
      setActions(response.data.data);
      setTimeout(() => {
        window.initDataTableFuncation();
      }, 1000);
    } catch (error) {
      toast.error("Error fetching actions");
      console.error("Error fetching actions:", error);
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
      ? `${config.DDA_API_API_URL}FieldMaster/UpdateActionMaster`
      : `${config.DDA_API_API_URL}FieldMaster/CreateActionMaster`;

    const payload = {
      aId: selectedActionId || 0,
      actionDesc: description,
    };

    try {
      const response = await axios.post(apiUrl, payload, {
        headers: config.headers2,
      });

      if (response.data.success) {
        toast.success(response.data.message);
        fetchActions();
        resetForm();
      } else {
        toast.error(response.data.message || "Error creating/updating action");
        console.error("Error creating/updating action:", response.data.message);
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Error creating/updating action";
      toast.error(errorMessage);
      console.error("Error creating/updating action:", errorMessage);
    }
  };

  const handleEdit = (action) => {
    setSelectedActionId(action.aId);
    setDescription(action.actionDesc);
    setIsEditing(true);
  };

  const handleDelete = async (actionId) => {
    try {
      const response = await axios.post(
        `${config.DDA_API_API_URL}FieldMaster/DeleteActionMaster/${actionId}`,
        null,
        { headers: config.headers2 }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        fetchActions();
      } else {
        toast.error(response.data.message);
        console.error("Error deleting action:", response.data.message);
      }
    } catch (error) {
      toast.error("Error deleting action");
      console.error("Error deleting action:", error);
    }
  };

  const resetForm = () => {
    setSelectedActionId(null);
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
          <label htmlFor="description">Action <span className="text-danger">*</span></label>
          <input
            type="text"
            className="form-control form-control-sm mt-2" 
            id="description"
            ref={inputDescriptionRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter action description"
          />
        </div>
        <div className="d-flex align-items-center justify-content-end mb-3">
          <button type="submit" className="btn btn-sm btn-primary">
            {isEditing ? "Update" : "Create"}
          </button>
          {isEditing && (
            <button
              type="button"
              className="btn btn-xs btn-outline-primary ml-2"
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
          {actions.map((action, index) => (
            <tr key={action.aId}>
              <td style={{ fontWeight: "400", fontSize: "smaller" }}>
                {index + 1}
              </td>
              <td style={{ fontWeight: "400", fontSize: "smaller" }}>
                {action.actionDesc}
              </td>
              <td style={{ fontWeight: "400", fontSize: "smaller" }}>
                <button
                  type="button"
                  className="btn bg-gradient-warning btn-xs btn-xs-custom"
                  onClick={() => handleEdit(action)}
                 
                >
                  <i className="fas fa-pen" ></i>
                </button>
                <button
                  type="button"
                  className="btn bg-gradient-danger btn-xs  ml-2 btn-xs-custom"
                  onClick={() => handleDelete(action.aId)}
                 
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

export default ActionMaster;
