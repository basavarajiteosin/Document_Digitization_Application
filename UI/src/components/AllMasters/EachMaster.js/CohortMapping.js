import React, { useRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import axios from 'axios';
import Select from 'react-select';
import PleaseWaitButton from '../../../shared/PleaseWaitButton';
import { useLoader } from '../../../Customhook/LoaderContext';

const config = require('../../../services/config.json');

const customSelectStyles = {
  multiValue: (styles) => ({
    ...styles,
    background: '#007bff',
    color: '#fff',
    fontSize: '11px',
    borderRadius: '12px',
    padding: '2px 6px',
    marginBottom: '4px',
  }),
  multiValueLabel: (styles) => ({
    ...styles,
    color: '#fff',
    fontWeight: '600',
  }),
  multiValueRemove: (styles) => ({
    ...styles,
    color: '#ffffff',
    ':hover': {
      color: '#dc3545',
      backgroundColor: 'transparent',
    },
  }),
};

const CohortMapping = () => {
  const inputCohortNameRef = useRef(null);
  const inputTagNameRef = useRef(null);
  const selectUsersRef = useRef(null);

  const personalInfo = useSelector((state) => state.personalInformationReducer);
  const { showLoader, hideLoader } = useLoader();

  const [cohortName, setCohortName] = useState('');
  const [tagName, setTagName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userList, setUserList] = useState([]);
  const [cohortList, setCohortList] = useState([]);
  const [updateOrDeleteId, setUpdateOrDeleteId] = useState('');
  const [isActiveStatus, setIsActiveStatus] = useState(true);
  const [isLoaderActive, setIsLoaderActive] = useState(false);

  // Validation errors
  const [cohortNameError, setCohortNameError] = useState(false);
  const [userSelectError, setUserSelectError] = useState(false);

  useEffect(() => {
    getAllUsers();
  }, []);

  const getAllUsers = () => {
    showLoader();
    axios
      .get(`${config.DDA_API_API_URL}AuthMasterController/GetAllUsers?ClientId=dmsApp`)
      .then((response) => {
        if (response.status === 200 && response.data.success) {
          const activeUsers = (response.data.data || []).filter((user) => user.isActive);
          setUserList(activeUsers);
          getAllCohortMappings();
        } else {
          toast.error(response.data.message || 'Failed to fetch user list');
          hideLoader();
        }
      })
      .catch(() => {
        toast.error('Oops, something went wrong fetching users.');
        hideLoader();
      });
  };

  const getAllCohortMappings = () => {
    window.initDestroyDataTableFuncation?.();
    axios
      .get(`${config.DDA_API_API_URL}FieldMaster/GetAllGroupMasters`)
      .then((response) => {
        if (response.status === 200 && response.data.success) {
          setCohortList(response.data.data || []);
          setTimeout(() => {
            window.initDataTableFuncation?.();
            hideLoader();
          }, 500);
        } else {
          toast.error(response.data.message || 'Failed to fetch cohort mappings.');
          setTimeout(() => {
            window.initDataTableFuncation?.();
            hideLoader();
          }, 500);
        }
      })
      .catch(() => {
        toast.error('Error loading cohort records.');
        hideLoader();
      });
  };

  const userOptions = userList.map((user) => ({
    value: user.userID,
    label: `${user.firstName} ${user.lastName} (${user.email})`,
  }));

  const handleCohortSubmit = (e) => {
    e.preventDefault();
    setCohortNameError(false);
    setUserSelectError(false);

    if (!cohortName.trim()) {
      toast.error('Please enter Cohort / Group Name.');
      setCohortNameError(true);
      inputCohortNameRef.current?.focus();
      return;
    }

    if (selectedUsers.length === 0) {
      toast.error('Please select at least one user.');
      setUserSelectError(true);
      selectUsersRef.current?.focus();
      return;
    }

    showLoader();

    const isUpdate = Boolean(updateOrDeleteId);
    const apiEndpoint = isUpdate
      ? 'FieldMaster/UpdateGroupMaster'
      : 'FieldMaster/CreateGroupMaster';

    const payload = isUpdate
      ? {
          gmId: updateOrDeleteId,
          groupName: cohortName.trim(),
          tagName: tagName.trim() || null,
          userIds: selectedUsers.map((u) => u.value),
          isActive: isActiveStatus,
          modifiedBy: personalInfo.userID,
        }
      : {
          groupName: cohortName.trim(),
          tagName: tagName.trim() || null,
          userIds: selectedUsers.map((u) => u.value),
          createdBy: personalInfo.userID,
        };

    axios
      .post(`${config.DDA_API_API_URL}${apiEndpoint}`, payload)
      .then((response) => {
        if (response.data.success) {
          toast.success(
            response.data.message ||
              (isUpdate ? 'Cohort updated successfully.' : 'Cohort created successfully.')
          );
          clearAllFields();
          getAllCohortMappings();
        } else {
          hideLoader();
          toast.error(response.data.message || 'Operation failed.');
        }
      })
      .catch((error) => {
        hideLoader();
        toast.error(error.response?.data?.message || 'Oops, something went wrong.');
      });
  };

  const handleEditCohort = (cohortObj) => {
    setUpdateOrDeleteId(cohortObj.gmId);
    setCohortName(cohortObj.groupName || '');
    setTagName(cohortObj.tagName || '');
    setIsActiveStatus(cohortObj.isActive ?? true);

    const mappedOptions = (cohortObj.userIds || []).map((id) => {
      const userObj = userList.find((u) => u.userID === id);
      return {
        value: id,
        label: userObj ? `${userObj.firstName} ${userObj.lastName} (${userObj.email})` : id,
      };
    });

    setSelectedUsers(mappedOptions);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemoveCohort = (cohortObj) => {
    setUpdateOrDeleteId(cohortObj.gmId);
    window.confirmModalShow?.();
  };

  const confirmDeleteRequest = () => {
    setIsLoaderActive(true);
    axios
      .post(
        `${config.DDA_API_API_URL}FieldMaster/DeleteGroupMaster/${updateOrDeleteId}`,
        {},
        { params: { deletedBy: personalInfo.userID } }
      )
      .then((response) => {
        setIsLoaderActive(false);
        if (response.data.success) {
          toast.success(response.data.message || 'Cohort mapping deleted successfully.');
          window.confirmModalHide?.();
          clearAllFields();
          getAllCohortMappings();
        } else {
          toast.error(response.data.message || 'Delete operation failed.');
        }
      })
      .catch((error) => {
        setIsLoaderActive(false);
        toast.error(error.response?.data?.message || 'Error occurred while deleting.');
      });
  };

  const clearAllFields = () => {
    setCohortName('');
    setTagName('');
    setSelectedUsers([]);
    setUpdateOrDeleteId('');
    setIsActiveStatus(true);
    setCohortNameError(false);
    setUserSelectError(false);
  };

  const renderMappedUserBadges = (userIds) => {
    if (!userIds || userIds.length === 0) {
      return <span className="text-muted">No users mapped</span>;
    }

    return userIds.map((id, index) => {
      const user = userList.find((u) => u.userID === id);
      const name = user ? `${user.firstName} ${user.lastName}` : id;
      return (
        <span key={index} className="badge badge-info mr-1 mb-1 p-1 font-weight-normal">
          {name}
        </span>
      );
    });
  };

  return (
    <>
      <div className="card card-primary card-outline">
        <div className="card-body">
          <form className="row" onSubmit={handleCohortSubmit}>
            <div className="form-group col-md-4">
              <label htmlFor="cohortNameInput">
                Cohort / Group Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className={`form-control form-control-sm mt-2 ${cohortNameError ? 'is-invalid' : ''}`}
                id="cohortNameInput"
                ref={inputCohortNameRef}
                value={cohortName}
                onChange={(e) => setCohortName(e.target.value)}
                placeholder="Enter Cohort / Group Name"
              />
            </div>

            <div className="form-group col-md-3">
              <label htmlFor="tagNameInput">Tag Name (Optional)</label>
              <input
                type="text"
                className="form-control form-control-sm mt-2"
                id="tagNameInput"
                ref={inputTagNameRef}
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Enter Tag Name"
              />
            </div>

            <div className="form-group col-md-5">
              <label>
                Select Users <span className="text-danger">*</span>
              </label>
              <div className="mt-2">
                <Select
                  isMulti
                  options={userOptions}
                  className={`cohort-user-select ${userSelectError ? 'is-invalid' : ''}`}
                  value={selectedUsers}
                  onChange={(selected) => setSelectedUsers(selected || [])}
                  ref={selectUsersRef}
                  placeholder="Search and select users..."
                  styles={customSelectStyles}
                />
              </div>
            </div>

            <div className="col-md-12 d-flex align-items-center justify-content-between mb-3 mt-2">
              <div>
                {updateOrDeleteId && (
                  <div className="custom-control custom-switch">
                    <input
                      type="checkbox"
                      className="custom-control-input"
                      id="cohortStatusSwitch"
                      checked={isActiveStatus}
                      onChange={(e) => setIsActiveStatus(e.target.checked)}
                    />
                    <label className="custom-control-label cursor-pointer" htmlFor="cohortStatusSwitch">
                      Status:{' '}
                      <span className={isActiveStatus ? 'text-success font-weight-bold' : 'text-danger font-weight-bold'}>
                        {isActiveStatus ? 'Active' : 'Inactive'}
                      </span>
                    </label>
                  </div>
                )}
              </div>

              <div>
                <button type="submit" className="btn btn-sm btn-primary">
                  {updateOrDeleteId ? 'Update' : 'Create'}
                </button>
                {updateOrDeleteId && (
                  <button
                    type="button"
                    className="btn btn-xs btn-outline-primary ml-2"
                    onClick={clearAllFields}
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
                <th style={{ fontWeight: '500', fontSize: 'smaller' }}>SLNo.</th>
                <th style={{ fontWeight: '500', fontSize: 'smaller' }}>Cohort / Group Name</th>
                <th style={{ fontWeight: '500', fontSize: 'smaller' }}>Tag</th>
                <th style={{ fontWeight: '500', fontSize: 'smaller' }}>Mapped Users</th>
                <th style={{ fontWeight: '500', fontSize: 'smaller' }}>Status</th>
                <th style={{ fontWeight: '500', fontSize: 'smaller' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cohortList.map((cohort, index) => (
                <tr key={cohort.gmId || index}>
                  <td style={{ fontWeight: '400', fontSize: 'smaller' }}>{index + 1}</td>
                  <td style={{ fontWeight: '400', fontSize: 'smaller' }}>{cohort.groupName}</td>
                  <td style={{ fontWeight: '400', fontSize: 'smaller' }}>
                    {cohort.tagName || '-'}
                  </td>
                  <td style={{ fontWeight: '400', fontSize: 'smaller' }}>
                    {renderMappedUserBadges(cohort.userIds)}
                  </td>
                  <td style={{ fontWeight: '400', fontSize: 'smaller' }}>
                    {cohort.isActive ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-secondary">Inactive</span>
                    )}
                  </td>
                  <td style={{ fontWeight: '400', fontSize: 'smaller' }}>
                    <button
                      type="button"
                      className="btn bg-gradient-warning btn-xs btn-xs-custom"
                      onClick={() => handleEditCohort(cohort)}
                    >
                      <i className="fas fa-pen"></i>
                    </button>
                    <button
                      type="button"
                      className="btn bg-gradient-danger btn-xs ml-2 btn-xs-custom"
                      disabled={!cohort.isActive}
                      title={!cohort.isActive ? 'Already inactive' : 'Deactivate'}
                      onClick={() => handleRemoveCohort(cohort)}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deactivation Modal */}
      <div
        id="confirmCommonModal"
        className="modal fade confirmCommonModal"
        data-backdrop="static"
        tabIndex={-1}
        role="dialog"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-confirm">
          <div className="modal-content">
            <div className="modal-header">
              <div className="icon-box">
                <i className="fas fa-info"></i>
              </div>
              <h5 className="modal-title w-100">Are you sure?</h5>
            </div>
            <div className="modal-body">
              <p className="text-center">
                Do you really want to deactivate this Cohort Mapping? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer col-md-12">
              <button className="btn btn-default btn-sm" data-dismiss="modal">
                Cancel
              </button>
              {isLoaderActive ? (
                <PleaseWaitButton className="btn-sm pl-3 pr-3 ml-2 font-weight-medium auth-form-btn" />
              ) : (
                <button
                  className="btn btn-warning btn-sm pl-3 pr-3 ml-2"
                  onClick={confirmDeleteRequest}
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

export default CohortMapping;