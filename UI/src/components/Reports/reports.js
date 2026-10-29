
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { FaTimes } from 'react-icons/fa';
// import './Reports.css';

const config = require("../../services/config.json");

const Reports = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [logs, setLogs] = useState([]);
  const [sharedLogs, setSharedLogs] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('userActivity');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageSizes = [10, 20, 50];
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isLoadingSharedLogs, setIsLoadingSharedLogs] = useState(false);
  const [isLoadingAdminLogs, setIsLoadingAdminLogs] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const response = await axios.get(
          `${config.DDA_API_API_URL}AuthMasterController/GetAllUsers?ClientId=dmsApp`
        );
        const filteredUsers = response.data.data.filter(
          user => user.roleName !== 'Administrator' && user.roleName !== 'Global Admin'
        );
        setUsers(filteredUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    const fetchLogs = async () => {
      setIsLoadingLogs(true);
      try {
        const response = await axios.get(
          `${config.DDA_API_API_URL}FolderData/GetAccessedFolderLog`
        );
        if (response.data.success) {
          setLogs(response.data.logs);
        }
      } catch (error) {
        console.error('Error fetching user activity logs:', error);
      } finally {
        setIsLoadingLogs(false);
      }
    };

    const fetchSharedLogs = async () => {
      setIsLoadingSharedLogs(true);
      try {
        const response = await axios.get(
          `${config.DDA_API_API_URL}FolderData/GetSharedDataLog`
        );
        if (response.data.success) {
          setSharedLogs(response.data.logs);
        }
      } catch (error) {
        console.error('Error fetching shared logs:', error);
      } finally {
        setIsLoadingSharedLogs(false);
      }
    };

    const fetchAdminLogs = async () => {
      setIsLoadingAdminLogs(true);
      try {
        const response = await axios.get(
          `${config.DDA_API_API_URL}FolderData/GetAdminCreatedFolderLog`
        );
        if (response.data.success) {
          setAdminLogs(response.data.logs);
        }
      } catch (error) {
        console.error('Error fetching admin created folder logs:', error);
      } finally {
        setIsLoadingAdminLogs(false);
      }
    };

    fetchUsers();
    fetchLogs();
    fetchSharedLogs();
    fetchAdminLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const logDate = new Date(log.date);
    const matchesUser = selectedUser ? log.userId.trim() === selectedUser : true;
    const matchesDateRange =
      (!fromDate || new Date(fromDate) <= logDate) &&
      (!toDate || logDate <= new Date(toDate).setHours(23, 59, 59, 999));
    return matchesUser && matchesDateRange;
  });

  const filteredSharedLogs = sharedLogs.filter(log => {
    const logDate = new Date(log.date);
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      log.senderUserName.toLowerCase().includes(searchLower) ||
      log.receiverUserName.toLowerCase().includes(searchLower) ||
      log.folderOrFileName.toLowerCase().includes(searchLower);
    const matchesDateRange =
      (!fromDate || new Date(fromDate) <= logDate) &&
      (!toDate || logDate <= new Date(toDate).setHours(23, 59, 59, 999));
    return matchesSearch && matchesDateRange;
  });

  const filteredAdminLogs = adminLogs.filter(log => {
    const logDate = new Date(log.date);
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      log.adminName.toLowerCase().includes(searchLower) ||
      log.folderName.toLowerCase().includes(searchLower) ||
      log.authorizedUserName.toLowerCase().includes(searchLower);
    const matchesDateRange =
      (!fromDate || new Date(fromDate) <= logDate) &&
      (!toDate || logDate <= new Date(toDate).setHours(23, 59, 59, 999));
    return matchesSearch && matchesDateRange;
  });

  const handleCancelFilters = () => {
    setSelectedUser('');
    setFromDate('');
    setToDate('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleFromDateChange = (e) => {
    const newFromDate = e.target.value;
    setFromDate(newFromDate);
    if (newFromDate && toDate && new Date(toDate) < new Date(newFromDate)) {
      setToDate('');
    }
  };

  const exportToExcel = (data, fileName) => {
    const formattedData = data.map(log => {
      if (activeTab === 'userActivity') {
        return {
          'Date & Time': new Date(log.date).toLocaleString(),
          'User Name': log.userName,
          'Folder Name': log.folderName,
        };
      } else if (activeTab === 'sharedLogs') {
        return {
          'Date & Time': new Date(log.date).toLocaleString(),
          'Sender Name': log.senderUserName,
          'Receiver Name': log.receiverUserName,
          'Folder/File Name': log.folderOrFileName,
        };
      } else {
        return {
          'Date & Time': new Date(log.date).toLocaleString(),
          'Admin Name': log.adminName,
          'Folder Name': log.folderName,
          'Assigned User Name': log.authorizedUserName,
        };
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeTab === 'userActivity' ? 'UserActivity' : activeTab === 'sharedLogs' ? 'SharedLogs' : 'UserFoldersByAdmin');
    XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getPaginatedData = (data) => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  };

  const totalPages = (data) => Math.ceil(data.length / pageSize);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  const renderPagination = (data) => {
    const total = totalPages(data);
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(total, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="reports-pagination">
        <div className="reports-pagination-controls">
          <button
            className="reports-pagination-btn"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            First
          </button>
          <button
            className="reports-pagination-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Prev
          </button>
          {startPage > 1 && <span className="reports-pagination-ellipsis">...</span>}
          {pages.map(page => (
            <button
              key={page}
              className={`reports-pagination-btn ${currentPage === page ? 'active' : ''}`}
              onClick={() => handlePageChange(page)}
            >
              {page}
            </button>
          ))}
          {endPage < total && <span className="reports-pagination-ellipsis">...</span>}
          <button
            className="reports-pagination-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === total}
          >
            Next
          </button>
          <button
            className="reports-pagination-btn"
            onClick={() => handlePageChange(total)}
            disabled={currentPage === total}
          >
            Last
          </button>
        </div>
        {/* <div className="reports-pagination-size">
          <label>Rows per page: </label>
          <select value={pageSize} onChange={handlePageSizeChange}>
            {pageSizes.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div> */}
      </div>
    );
  };

  return (
    <section className="content scroll-content">
      <div className="container-fluid">
        <div className="row">
          <div className="col-md-12">
            <div className="card card-outline card-primary">
              <div className="report-tabs-container">
                <div
                  className={`report-tab ${activeTab === 'userActivity' ? 'active' : ''}`}
                  onClick={() => setActiveTab('userActivity')}
                >
                  User Activity Logs
                </div>
                <div
                  className={`report-tab ${activeTab === 'sharedLogs' ? 'active' : ''}`}
                  onClick={() => setActiveTab('sharedLogs')}
                >
                  Shared Logs
                </div>
                <div
                  className={`report-tab ${activeTab === 'userFoldersByAdmin' ? 'active' : ''}`}
                  onClick={() => setActiveTab('userFoldersByAdmin')}
                >
                  User Folders logs (By Admin)
                </div>
              </div>
              <div className="card-body text-sm" style={{ overflowX: 'auto' }}>
                {activeTab === 'userActivity' && (
                  <>
                    <div className="d-flex mb-3 align-items-center">
                      <select
                        className="custom-select custom-select-sm mr-3"
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        disabled={isLoadingUsers}
                      >
                        <option value="">All Users</option>
                        {users.map(user => (
                          <option key={user.userID} value={user.userID}>
                            {user.firstName} {user.lastName}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        className="form-control form-control-sm mr-3"
                        value={fromDate}
                        onChange={handleFromDateChange}
                        placeholder="From Date"
                      />
                      <input
                        type="date"
                        className="form-control form-control-sm mr-3"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        placeholder="To Date"
                        min={fromDate}
                      />
                      <button
                        className="reports-cancel-btn"
                        onClick={handleCancelFilters}
                        title="Clear Filters"
                      >
                        <FaTimes />
                      </button>
                    </div>
                    <div className="d-flex justify-content-between">
                       <div className="reports-pagination-size">
          <label>Rows per page: </label>
          <select value={pageSize} onChange={handlePageSizeChange}>
            {pageSizes.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
                      <button
                        className="reports-export-btn mb-1"
                        onClick={() => exportToExcel(filteredLogs, 'UserActivityLogs')}
                        disabled={filteredLogs.length === 0 || isLoadingLogs}
                      >
                        <i className="fa fa-file-excel mr-2" aria-hidden="true"></i>
                        Export to Excel
                      </button>
                    </div>
                    <table className="table table-bordered table-sm reports-table">
                      <thead>
                        <tr>
                          <th className="">Date & Time</th>
                          <th className="">User Name</th>
                          <th className="">Folder Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoadingLogs ? (
                          <tr>
                            <td colSpan="3" className="text-center">
                              <div className="loader-container">
                                <div className="spinner-border spinner-border-sm text-primary" role="status">
                                  <span className="sr-only">Loading...</span>
                                </div>
                                <span className="ml-2">Loading...</span>
                              </div>
                            </td>
                          </tr>
                        ) : filteredLogs.length === 0 ? (
                          <tr>
                            <td colSpan="3" className="text-center">No logs found</td>
                          </tr>
                        ) : (
                          getPaginatedData(filteredLogs).map((log, index) => (
                            <tr key={index}>
                              <td>{new Date(log.date).toLocaleString()}</td>
                              <td>{log.userName}</td>
                              <td>{log.folderName}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    {!isLoadingLogs && filteredLogs.length > 0 && renderPagination(filteredLogs)}
                  </>
                )}
                {activeTab === 'sharedLogs' && (
                  <>
                    <div className="d-flex mb-3 align-items-center">
                      <input
                        type="text"
                        className="form-control form-control-sm mr-3"
                        placeholder="Search by user name or folder/file name"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <input
                        type="date"
                        className="form-control form-control-sm mr-3"
                        value={fromDate}
                        onChange={handleFromDateChange}
                        placeholder="From Date"
                      />
                      <input
                        type="date"
                        className="form-control form-control-sm mr-3"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        placeholder="To Date"
                        min={fromDate}
                      />
                      <button
                        className="reports-cancel-btn"
                        onClick={handleCancelFilters}
                        title="Clear Filters"
                      >
                        <FaTimes />
                      </button>
                    </div>
                    <div className="d-flex justify-content-between">
                       <div className="reports-pagination-size">
          <label>Rows per page: </label>
          <select value={pageSize} onChange={handlePageSizeChange}>
            {pageSizes.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
                      <button
                        className="reports-export-btn mb-1"
                        onClick={() => exportToExcel(filteredSharedLogs, 'SharedLogs')}
                        disabled={filteredSharedLogs.length === 0 || isLoadingSharedLogs}
                      >
                        <i className="fa fa-file-excel mr-2" aria-hidden="true"></i>
                        Export to Excel
                      </button>
                    </div>
                    <table className="table table-bordered table-sm reports-table">
                      <thead>
                        <tr>
                          <th className="">Date & Time</th>
                          <th className="">Sender Name</th>
                          <th className="">Receiver Name</th>
                          <th className="">Folder/File Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoadingSharedLogs ? (
                          <tr>
                            <td colSpan="4" className="text-center">
                              <div className="loader-container">
                                <div className="spinner-border spinner-border-sm text-primary" role="status">
                                  <span className="sr-only">Loading...</span>
                                </div>
                                <span className="ml-2">Loading...</span>
                              </div>
                            </td>
                          </tr>
                        ) : filteredSharedLogs.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="text-center">No shared logs found</td>
                          </tr>
                        ) : (
                          getPaginatedData(filteredSharedLogs).map((log, index) => (
                            <tr key={index}>
                              <td>{new Date(log.date).toLocaleString()}</td>
                              <td>{log.senderUserName}</td>
                              <td>{log.receiverUserName}</td>
                              <td>{log.folderOrFileName}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    {!isLoadingSharedLogs && filteredSharedLogs.length > 0 && renderPagination(filteredSharedLogs)}
                  </>
                )}
                {activeTab === 'userFoldersByAdmin' && (
                  <>
                    <div className="d-flex mb-3 align-items-center">
                      <input
                        type="text"
                        className="form-control form-control-sm mr-3"
                        placeholder="Search by admin, folder, or user name"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <input
                        type="date"
                        className="form-control form-control-sm mr-3"
                        value={fromDate}
                        onChange={handleFromDateChange}
                        placeholder="From Date"
                      />
                      <input
                        type="date"
                        className="form-control form-control-sm mr-3"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        placeholder="To Date"
                        min={fromDate}
                      />
                      <button
                        className="reports-cancel-btn"
                        onClick={handleCancelFilters}
                        title="Clear Filters"
                      >
                        <FaTimes />
                      </button>
                    </div>
                    <div className="d-flex justify-content-between">
                       <div className="reports-pagination-size">
          <label>Rows per page: </label>
          <select value={pageSize} onChange={handlePageSizeChange}>
            {pageSizes.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
                      <button
                        className="reports-export-btn mb-1"
                        onClick={() => exportToExcel(filteredAdminLogs, 'UserFoldersByAdmin')}
                        disabled={filteredAdminLogs.length === 0 || isLoadingAdminLogs}
                      >
                        <i className="fa fa-file-excel mr-2" aria-hidden="true"></i>
                        Export to Excel
                      </button>
                    </div>
                    <table className="table table-bordered table-sm reports-table">
                      <thead>
                        <tr>
                          <th className="">Date & Time</th>
                          <th className="">Admin Name</th>
                          <th className="">Folder Name</th>
                          <th className="">Assigned User Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoadingAdminLogs ? (
                          <tr>
                            <td colSpan="4" className="text-center">
                              <div className="loader-container">
                                <div className="spinner-border spinner-border-sm text-primary" role="status">
                                  <span className="sr-only">Loading...</span>
                                </div>
                                <span className="ml-2">Loading...</span>
                              </div>
                            </td>
                          </tr>
                        ) : filteredAdminLogs.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="text-center">No admin folder logs found</td>
                          </tr>
                        ) : (
                          getPaginatedData(filteredAdminLogs).map((log, index) => (
                            <tr key={index}>
                              <td>{new Date(log.date).toLocaleString()}</td>
                              <td>{log.adminName}</td>
                              <td>{log.folderName}</td>
                              <td>{log.authorizedUserName}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    {!isLoadingAdminLogs && filteredAdminLogs.length > 0 && renderPagination(filteredAdminLogs)}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Reports;