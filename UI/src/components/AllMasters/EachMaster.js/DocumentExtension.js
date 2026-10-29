import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
const config = require("../../../services/config.json");

const DocumentExtension = () => {
  const [documentExtensions, setDocumentExtensions] = useState([]);
  const [extensionType, setExtensionType] = useState("");
  const [selectedExtensionId, setSelectedExtensionId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const inputExtensionTypeRef = useRef(null);

  useEffect(() => {
    fetchDocumentExtensions();
  }, []);

  const fetchDocumentExtensions = async () => {
    window.initDestroyDataTableFuncation();
    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}FieldMaster/GetAllDocExts`,
        { headers: config.headers2 }
      );
      setDocumentExtensions(response.data.data);
      setTimeout(() => {
        window.initDataTableFuncation();
      }, 1000);
    } catch (error) {
      toast.error("Error fetching document extensions");
      console.error("Error fetching document extensions:", error);
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!extensionType) {
      toast.error("Please enter an extension type.");
      inputExtensionTypeRef.current?.focus();
      inputExtensionTypeRef.current?.classList.add("is-invalid");
      return;
    }

    const apiUrl = isEditing
      ? `${config.DDA_API_API_URL}FieldMaster/UpdateDocExts`
      : `${config.DDA_API_API_URL}FieldMaster/CreateDocExts`;

    const payload = {
      deId: selectedExtensionId || 0,
      extType: extensionType,
    };

    try {
      const response = await axios.post(apiUrl, payload, {
        headers: config.headers2,
      });

      if (response.data.success) {
        toast.success(response.data.message);
        fetchDocumentExtensions();
        resetForm();
      } else {
        toast.error(response.data.message || "Error creating/updating document extension");
        console.error("Error creating/updating document extension:", response.data.message);
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Error creating/updating document extension";
      toast.error(errorMessage);
      console.error("Error creating/updating document extension:", errorMessage);
    }
  };

  const handleEdit = (docExtension) => {
    setSelectedExtensionId(docExtension.deId);
    setExtensionType(docExtension.extType);
    setIsEditing(true);
  };

  const handleDelete = async (extensionId) => {
    try {
      const response = await axios.post(
        `${config.DDA_API_API_URL}FieldMaster/DeleteDocExt/${extensionId}`,
        null,
        { headers: config.headers2 }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        fetchDocumentExtensions();
      } else {
        toast.error(response.data.message);
        console.error("Error deleting document extension:", response.data.message);
      }
    } catch (error) {
      toast.error("Error deleting document extension");
      console.error("Error deleting document extension:", error);
    }
  };

  const resetForm = () => {
    setSelectedExtensionId(null);
    setExtensionType("");
    setIsEditing(false);
    inputExtensionTypeRef.current?.classList.remove("is-invalid");
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
          <label htmlFor="extensionType">Document Ext. Type <span className="text-danger">*</span></label>
          <input
            type="text"
            className="form-control form-control-sm mt-2"
            id="extensionType"
            ref={inputExtensionTypeRef}
            value={extensionType}
            onChange={(e) => setExtensionType(e.target.value)}
            placeholder="Enter document extension type"
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
              Extension Type
            </th>
            <th style={{ fontWeight: "500", fontSize: "smaller" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {documentExtensions.map((docExtension, index) => (
            <tr key={docExtension.deId}>
              <td style={{ fontWeight: "400", fontSize: "smaller" }}>
                {index + 1}
              </td>
              <td style={{ fontWeight: "400", fontSize: "smaller" }}>
                {docExtension.extType}
              </td>
              <td style={{ fontWeight: "400", fontSize: "smaller" }}>
                <button
                  type="button"
                  className="btn bg-gradient-warning btn-xs btn-xs-custom"
                  onClick={() => handleEdit(docExtension)}
                  
                >
                  <i className="fas fa-pen" ></i>
                </button>
                <button
                  type="button"
                  className="btn bg-gradient-danger btn-xs ml-2 btn-xs-custom"
                  onClick={() => handleDelete(docExtension.deId)}
                  
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

export default DocumentExtension;
