import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
const config = require("../../../services/config.json");

const EmailDomain = () => {
  const [emailDomains, setEmailDomains] = useState([]);
  const [domain, setDomain] = useState("");
  const [selectedEmailDomainId, setSelectedEmailDomainId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const inputDomainRef = useRef(null);

  useEffect(() => {
    fetchEmailDomains();
  }, []);

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

  const handleCreateOrUpdate = async () => {
    if (!domain) {
      toast.error("Please enter a domain.");
      inputDomainRef.current?.focus();
      inputDomainRef.current?.classList.add("is-invalid");
      return;
    }

    const apiUrl = isEditing
      ? `${config.DDA_API_API_URL}FieldMaster/UpdateEmailDomain`
      : `${config.DDA_API_API_URL}FieldMaster/CreateEmailDomain`;

    const payload = {
      emailDomainId: selectedEmailDomainId || 0,
      domain: domain,
    };

    try {
      const response = await axios.post(apiUrl, payload, {
        headers: config.headers2,
      });

      if (response.data.success) {
        toast.success(response.data.message);
        fetchEmailDomains();
        resetForm();
      } else {
        toast.error(response.data.message || "Error creating/updating email domain");
        console.error("Error creating/updating email domain:", response.data.message);
      }
    } catch (error) {
      const errorMessage =
      error.response?.data?.message || "Error creating/updating email domain";
    toast.error(errorMessage);
    console.error("Error creating/updating email domain:", errorMessage);
    }
  };

  const handleEdit = (emailDomain) => {
    setSelectedEmailDomainId(emailDomain.emailDomainId);
    setDomain(emailDomain.domain);
    setIsEditing(true);
  };

  const handleDelete = async (emailDomainId) => {
    try {
      const response = await axios.post(
        `${config.DDA_API_API_URL}FieldMaster/DeleteEmailDomain/${emailDomainId}`,
        null,
        { headers: config.headers2 }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        fetchEmailDomains();
      } else {
        toast.error(response.data.message);
        console.error("Error deleting email domain:", response.data.message);
      }
    } catch (error) {
      toast.error("Error deleting email domain");
      console.error("Error deleting email domain:", error);
    }
  };

  const resetForm = () => {
    setSelectedEmailDomainId(null);
    setDomain("");
    setIsEditing(false);
    inputDomainRef.current?.classList.remove("is-invalid");
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
          <label htmlFor="domain">Email Domain <span className="text-danger">*</span></label>
          <input
            type="text"
            className="form-control form-control-sm mt-2"
            id="domain"
            ref={inputDomainRef}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Enter email domain"
          />
        </div>
        <div className="d-flex align-items-center justify-content-end mb-3">
          <button type="submit" className="btn btn-sm  btn-primary">
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
            <th style={{ fontWeight: "500", fontSize: "smaller" }}>Domain</th>
            <th style={{ fontWeight: "500", fontSize: "smaller" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {emailDomains.map((emailDomain, index) => (
            <tr key={emailDomain.emailDomainId}>
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
                {emailDomain.domain}
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
                  onClick={() => handleEdit(emailDomain)}
                 
                >
                  <i className="fas fa-pen" ></i>
                </button>
                <button
                  type="button"
                  className="btn bg-gradient-danger btn-xs ml-2 btn-xs-custom"
                  onClick={() => handleDelete(emailDomain.emailDomainId)}
                 
                >
                  <i
                    className="fas fa-trash"
                   
                  ></i>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EmailDomain;
