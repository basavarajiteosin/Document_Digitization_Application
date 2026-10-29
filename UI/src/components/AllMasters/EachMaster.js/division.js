import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
const config = require("../../../services/config.json");

const Division = () => {
  const [divisions, setDivisions] = useState([]);
  const [description, setDescription] = useState("");
  const [selectedDivisionId, setSelectedDivisionId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const inputDescriptionRef = useRef(null);

  useEffect(() => {
    fetchDivisions();
  }, []);

  const fetchDivisions = async () => {
    window.initDestroyDataTableFuncation();
    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}FieldMaster/GetAllDivisionMasters`,
        { headers: config.headers2 }
      );
      setDivisions(response.data.data);
      setTimeout(() => {
        window.initDataTableFuncation();
      }, 1000);
    } catch (error) {
      toast.error("Error fetching divisions");
      console.error("Error fetching divisions:", error);
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
      ? `${config.DDA_API_API_URL}FieldMaster/UpdateDivisionMaster`
      : `${config.DDA_API_API_URL}FieldMaster/CreateDivisionMaster`;

    const payload = {
      divisionId: selectedDivisionId || 0,
      description: description,
    };

    try {
      const response = await axios.post(apiUrl, payload, {
        headers: config.headers2,
      });

      if (response.data.success) {
        toast.success(response.data.message);
        fetchDivisions();
        resetForm();
      } else {
        // Display backend message on failure
        toast.error(response.data.message || "Error creating/updating division");
        console.error("Error creating/updating division:", response.data.message);
      }
    } catch (error) {
      // Show backend error message if available, otherwise show a generic message
      const errorMessage =
        error.response?.data?.message || "Error creating/updating division";
      toast.error(errorMessage);
      console.error("Error creating/updating division:", errorMessage);
    }
  };

  const handleEdit = (division) => {
    setSelectedDivisionId(division.divisionId);
    setDescription(division.description);
    setIsEditing(true);
  };

  const handleDelete = async (divisionId) => {
    try {
      const response = await axios.post(
        `${config.DDA_API_API_URL}FieldMaster/DeleteDivisionMaster/${divisionId}`,
        null,
        { headers: config.headers2 }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        fetchDivisions();
      } else {
        toast.error(response.data.message);
        console.error("Error deleting division:", response.data.message);
      }
    } catch (error) {
      toast.error("Error deleting division");
      console.error("Error deleting division:", error);
    }
  };

  const resetForm = () => {
    setSelectedDivisionId(null);
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
        <div className="form-group ">
          <label htmlFor="description" className="form-label">Division <span className="text-danger">*</span></label>
          <input
            type="text"
            className="form-control form-control-sm mt-2"
            id="description"
            ref={inputDescriptionRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter division "
          />
        </div>
        <div className="d-flex align-items-center justify-content-end mb-3">
          <button type="submit" className=" btn btn-sm  btn-primary">
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
          {divisions.map((division, index) => (
            <tr key={division.divisionId}>
              <td
                style={{
                  fontWeight: "400",
                  fontSize: "smaller",
                }}
              >
                {index + 1}
              </td>
              <td
                style={{
                  fontWeight: "400",
                  fontSize: "smaller",
                }}
              >
                {division.description}
              </td>
              <td
                style={{
                  fontWeight: "400",
                  fontSize: "smaller",
                }}
              >
              <button
  type="button"
  className="btn bg-gradient-warning btn-xs btn-xs-custom"
  onClick={() => handleEdit(division)}
>
  <i className="fas fa-pen"></i>
</button>
<button
  type="button"
  className="btn bg-gradient-danger btn-xs btn-xs-custom ml-2"
  onClick={() => handleDelete(division.divisionId)}
>
  <i className="fas fa-trash"></i>
</button>

              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Division;
