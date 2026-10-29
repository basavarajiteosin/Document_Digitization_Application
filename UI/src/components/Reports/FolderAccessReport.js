import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import Select from "react-select";
import { FiChevronDown, FiChevronUp, FiFolder, FiFile, FiSearch, FiUser } from "react-icons/fi";
import "./FolderAccessReport.css";
const config = require("../../services/config.json");

const ACCESS_TYPE_META = {
  View: { color: "#0078d4", bg: "#e8f2fc", label: "View" },
  Download: { color: "#2e7d32", bg: "#e9f6ec", label: "Download" },
  Edit: { color: "#f57c00", bg: "#fef2e3", label: "Edit" },
  Update: { color: "#6f42c1", bg: "#f0e9fa", label: "Update" },
  Share: { color: "#495057", bg: "#eceef0", label: "Share" },
};
const getAccessMeta = (type) => ACCESS_TYPE_META[type] || { color: "#495057", bg: "#eceef0", label: type };

const ITEMS_PER_PAGE = 5;

const multiSelectStyles = {
  control: (styles) => ({ ...styles, minHeight: 38, fontSize: 13 }),
  multiValue: (styles) => ({
    ...styles,
    background: "#0078d4",
    borderRadius: "10px",
  }),
  multiValueLabel: (styles) => ({ ...styles, color: "#fff", fontSize: 11.5, fontWeight: 600 }),
  multiValueRemove: (styles) => ({
    ...styles,
    color: "#fff",
    ":hover": { backgroundColor: "transparent", color: "#dc3545" },
  }),
  menu: (styles) => ({ ...styles, zIndex: 20 }),
};

/* =====================================================================
   Per-user expansion panel: header (avatar, name, quick stats) + a body
   that lazily fetches Reports/GetEmployeeWiseFolderAccess for that user
   the first time it's expanded, then renders the folder-wise, searchable,
   paginated report - entirely self-contained so each open panel has its
   own independent search/page/expanded-folder state.
   ===================================================================== */
const UserAccessPanel = ({ user, isOpen, onToggle }) => {
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedFolderKey, setExpandedFolderKey] = useState(null);

  useEffect(() => {
    if (isOpen && !hasFetched) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchReport = async () => {
    setIsLoadingReport(true);
    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}Reports/GetEmployeeWiseFolderAccess`,
        { params: { userId: user.userID } }
      );
      if (response.data.success) {
        const data = Array.isArray(response.data.data) ? response.data.data[0] : response.data.data;
        setReportData(data || null);
      } else {
        toast.error(response.data.message || `Failed to fetch report for ${user.firstName}`);
      }
    } catch (error) {
      console.error("Error fetching employee folder access report:", error);
      toast.error(`Error fetching report for ${user.firstName}`);
    } finally {
      setIsLoadingReport(false);
      setHasFetched(true);
    }
  };

  const folderWiseData = useMemo(() => {
    if (!reportData?.accessDetails?.length) return [];
    const groups = new Map();

    reportData.accessDetails.forEach((detail) => {
      const key = `${detail.folderOrFileId}-${detail.docType}-${detail.folderOrFileName}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          docType: detail.docType,
          name: detail.folderOrFileName,
          totalCount: 0,
          lastAccessedOn: detail.lastAccessedOn,
          logs: [],
        });
      }
      const group = groups.get(key);
      group.totalCount += detail.accessCount ?? 1;
      if (new Date(detail.lastAccessedOn) > new Date(group.lastAccessedOn)) {
        group.lastAccessedOn = detail.lastAccessedOn;
      }
      group.logs.push(detail);
    });

    groups.forEach((group) => {
      group.logs.sort((a, b) => new Date(b.lastAccessedOn) - new Date(a.lastAccessedOn));
    });

    return [...groups.values()].sort((a, b) => new Date(b.lastAccessedOn) - new Date(a.lastAccessedOn));
  }, [reportData]);

  const filteredFolders = useMemo(() => {
    if (!searchTerm.trim()) return folderWiseData;
    const term = searchTerm.trim().toLowerCase();
    return folderWiseData.filter((f) => f.name?.toLowerCase().includes(term));
  }, [folderWiseData, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredFolders.length / ITEMS_PER_PAGE));
  const paginatedFolders = filteredFolders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const goToPage = (page) => setCurrentPage(Math.min(Math.max(page, 1), totalPages));

  return (
    <div className="far-user-panel">
      <button className="far-user-panel-header" onClick={onToggle}>
        <div className="far-user-panel-avatar">
          {(user.firstName || "?").charAt(0).toUpperCase()}
        </div>

        <div className="far-user-panel-info">
          <div className="far-user-panel-name">
            {user.firstName} {user.lastName}
          </div>
          <div className="far-user-panel-email">{user.email}</div>
        </div>

        {hasFetched && reportData && (
          <div className="far-user-panel-quickstats">
            <span className="far-quickstat-pill">
              {reportData.totalAccessCount} total
            </span>
            {reportData.lastAccessedOn && (
              <span className="far-user-panel-lastactive">
                Last: {new Date(reportData.lastAccessedOn).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        {isOpen ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
      </button>

      {isOpen && (
        <div className="far-user-panel-body">
          {isLoadingReport ? (
            <div className="far-empty-state small">
              <p>Loading report...</p>
            </div>
          ) : !reportData ? (
            <div className="far-empty-state small">
              <p>No access history found for this user.</p>
            </div>
          ) : (
            <>
              {/* Summary stat pills */}
              <div className="far-summary-stats far-summary-stats--compact">
                <div className="far-stat-pill" style={{ borderColor: "#dcdcdc" }}>
                  <span className="far-stat-value">{reportData.totalAccessCount}</span>
                  <span className="far-stat-label">Total</span>
                </div>
                {["View", "Download", "Edit", "Update", "Share"].map((type) => {
                  const meta = getAccessMeta(type);
                  const countKey = `${type.toLowerCase()}Count`;
                  return (
                    <div
                      className="far-stat-pill"
                      key={type}
                      style={{ borderColor: meta.color, background: meta.bg }}
                    >
                      <span className="far-stat-value" style={{ color: meta.color }}>
                        {reportData[countKey] ?? 0}
                      </span>
                      <span className="far-stat-label">{type}s</span>
                    </div>
                  );
                })}
              </div>

              {/* Folder-wise section header + search */}
              <div className="far-section-toolbar">
                <h6 className="far-section-title">
                  Folder / File-wise Activity{" "}
                  <span className="far-section-count">({filteredFolders.length})</span>
                </h6>
                <div className="far-search-box">
                  <FiSearch size={14} />
                  <input
                    type="text"
                    placeholder="Search by folder or file name..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>

              {/* Folder-wise expandable cards */}
              {paginatedFolders.length === 0 ? (
                <div className="far-empty-state small">
                  <p>No folders/files match your search.</p>
                </div>
              ) : (
                <div className="far-folder-list">
                  {paginatedFolders.map((folder) => {
                    const isFolderExpanded = expandedFolderKey === folder.key;
                    return (
                      <div className="far-folder-card" key={folder.key}>
                        <button
                          className="far-folder-card-header"
                          onClick={() =>
                            setExpandedFolderKey(isFolderExpanded ? null : folder.key)
                          }
                        >
                          <div className="far-folder-icon">
                            {folder.docType === "Folder" ? <FiFolder size={20} /> : <FiFile size={20} />}
                          </div>

                          <div className="far-folder-info">
                            <div className="far-folder-name">{folder.name || "Untitled"}</div>
                            <div className="far-folder-meta">
                              {folder.docType} &middot; Last accessed{" "}
                              {new Date(folder.lastAccessedOn).toLocaleString()}
                            </div>
                          </div>

                          <div className="far-folder-badges">
                            {[...new Set(folder.logs.map((l) => l.accessType))].map((type) => {
                              const meta = getAccessMeta(type);
                              return (
                                <span
                                  key={type}
                                  className="far-mini-badge"
                                  style={{ color: meta.color, background: meta.bg }}
                                >
                                  {type}
                                </span>
                              );
                            })}
                          </div>

                          <div className="far-folder-total">
                            <span className="far-folder-total-count">{folder.totalCount}</span>
                            <span className="far-folder-total-label">events</span>
                          </div>

                          {isFolderExpanded ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                        </button>

                        {isFolderExpanded && (
                          <div className="far-folder-card-body">
                            <table className="far-log-table">
                              <thead>
                                <tr>
                                  <th>Access Type</th>
                                  <th>Times</th>
                                  <th>First Accessed</th>
                                  <th>Last Accessed</th>
                                </tr>
                              </thead>
                              <tbody>
                                {folder.logs.map((log, idx) => {
                                  const meta = getAccessMeta(log.accessType);
                                  return (
                                    <tr key={`${folder.key}-${idx}`}>
                                      <td>
                                        <span
                                          className="far-mini-badge"
                                          style={{ color: meta.color, background: meta.bg }}
                                        >
                                          {log.accessType}
                                        </span>
                                      </td>
                                      <td className="text-center">{log.accessCount ?? 1}</td>
                                      <td>
                                        {log.firstAccessedOn
                                          ? new Date(log.firstAccessedOn).toLocaleString()
                                          : "-"}
                                      </td>
                                      <td>
                                        {log.lastAccessedOn
                                          ? new Date(log.lastAccessedOn).toLocaleString()
                                          : "-"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {filteredFolders.length > ITEMS_PER_PAGE && (
                <div className="far-pagination">
                  <button
                    className="far-page-btn"
                    disabled={currentPage === 1}
                    onClick={() => goToPage(currentPage - 1)}
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      className={`far-page-btn ${page === currentPage ? "active" : ""}`}
                      onClick={() => goToPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    className="far-page-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => goToPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

/* =====================================================================
   Main component: multi-domain + multi-user pickers, then one expansion
   panel per selected user (via UserAccessPanel above).
   ===================================================================== */
const FolderAccessReport = () => {
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [emailDomains, setEmailDomains] = useState([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(false);

  // NEW: both pickers are now multi-select.
  const [selectedDomains, setSelectedDomains] = useState([]); // array of { value, label }
  const [selectedUserOptions, setSelectedUserOptions] = useState([]); // array of { value, label, user }

  // Which user panels are currently expanded (userID -> bool). The first
  // newly-selected user auto-expands; others stay collapsed until clicked.
  const [openPanels, setOpenPanels] = useState({});

  // ---------- Fetch all email domains for the domain filter ----------
  const fetchEmailDomains = async () => {
    setIsLoadingDomains(true);
    try {
      const response = await axios.get(`${config.DDA_API_API_URL}FieldMaster/GetAllEmailDomains`);
      if (response.data.success && response.data.data) {
        const sortedDomains = [...response.data.data].sort((a, b) => a.domain.localeCompare(b.domain));
        setEmailDomains(sortedDomains);
      }
    } catch (error) {
      console.error("Error fetching email domains:", error);
    } finally {
      setIsLoadingDomains(false);
    }
  };

  useEffect(() => {
    fetchEmailDomains();
  }, []);

  // ---------- Fetch all users ----------
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}AuthMasterController/GetAllUsers?ClientId=dmsApp`
      );
      if (response.data.success && response.data.data) {
        const sortedUsers = [...response.data.data].sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        );
        setUsers(sortedUsers);
      } else {
        toast.error("Failed to fetch users");
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Error fetching users");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const domainOptions = emailDomains.map((d) => ({ value: d.domain, label: d.domain }));

  // ---------- Users narrowed down to the selected email domain(s) ----------
  // No domains selected -> show every user. One or more selected -> a user
  // qualifies if their email matches ANY of the selected domains.
  const usersForSelectedDomains = useMemo(() => {
    if (selectedDomains.length === 0) return users;
    const domainSuffixes = selectedDomains.map((d) => `@${d.value}`.toLowerCase());
    return users.filter((user) =>
      domainSuffixes.some((suffix) => (user.email || "").toLowerCase().endsWith(suffix))
    );
  }, [users, selectedDomains]);

  const userOptions = usersForSelectedDomains.map((user) => ({
    value: user.userID,
    label: `${user.firstName} ${user.lastName} (${user.email})`,
    user,
  }));

  const handleDomainChange = (selected) => {
    const newDomains = selected || [];
    setSelectedDomains(newDomains);

    // Drop any already-selected users who no longer match the (narrower) domain set.
    if (newDomains.length > 0) {
      const domainSuffixes = newDomains.map((d) => `@${d.value}`.toLowerCase());
      setSelectedUserOptions((prev) =>
        prev.filter((opt) =>
          domainSuffixes.some((suffix) => (opt.user.email || "").toLowerCase().endsWith(suffix))
        )
      );
    }
  };

  const handleUserChange = (selected) => {
    const newSelection = selected || [];
    setSelectedUserOptions(newSelection);

    // Auto-expand any newly-added user's panel; leave existing open/closed
    // states untouched, and drop panel state for users that were removed.
    setOpenPanels((prev) => {
      const next = {};
      newSelection.forEach((opt) => {
        next[opt.value] = opt.value in prev ? prev[opt.value] : true;
      });
      return next;
    });
  };

  const togglePanel = (userId) => {
    setOpenPanels((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  return (
    <div className="far-container">
      <div className="far-header">
        <h4 className="far-title">Employee-wise Folder Access Report</h4>
        <p className="far-subtitle">
          Pick one or more users (optionally narrowed by email domain) to see exactly which
          folders and files they've viewed, downloaded, edited, updated, or shared.
        </p>
      </div>

      {/* ---------- Email Domain (multi) + User (multi) selectors ---------- */}
      <div className="far-user-select-row far-user-select-row--multi">
        <div className="far-select-col">
          <label className="far-select-label">Email Domain(s)</label>
          <Select
            isMulti
            options={domainOptions}
            value={selectedDomains}
            onChange={handleDomainChange}
            isLoading={isLoadingDomains}
            placeholder="All domains"
            styles={multiSelectStyles}
            classNamePrefix="far-select"
          />
        </div>

        <div className="far-select-col far-select-col--wide">
          <label className="far-select-label">Select User(s)</label>
          <Select
            isMulti
            options={userOptions}
            value={selectedUserOptions}
            onChange={handleUserChange}
            isLoading={isLoadingUsers}
            placeholder={
              userOptions.length === 0 ? "No users found for this domain" : "Search and select users..."
            }
            styles={multiSelectStyles}
            classNamePrefix="far-select"
          />
        </div>
      </div>

      {/* ---------- Per-user expansion panels ---------- */}
      {selectedUserOptions.length === 0 ? (
        <div className="far-empty-state">
          <FiUser size={40} />
          <p>Select one or more users above to view their folder access report.</p>
        </div>
      ) : (
        <div className="far-user-panel-list">
          {selectedUserOptions.map((opt) => (
            <UserAccessPanel
              key={opt.value}
              user={opt.user}
              isOpen={!!openPanels[opt.value]}
              onToggle={() => togglePanel(opt.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FolderAccessReport;