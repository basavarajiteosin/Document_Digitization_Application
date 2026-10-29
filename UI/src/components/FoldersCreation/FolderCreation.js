import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { ExcelRenderer } from "react-excel-renderer";
import { useParams } from "react-router-dom";
import { useLoader } from '../../Customhook/LoaderContext';
import { useUpload } from '../../Customhook/UploadContext';
import { useSearchParams } from "react-router-dom";
import { HiViewGrid, HiViewList } from "react-icons/hi";
import { FiArrowLeft } from 'react-icons/fi';
import { FiMaximize, FiMinimize, FiZoomIn, FiZoomOut } from "react-icons/fi";
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import {
  FaFileAlt,
  FaFilePdf,
  FaFileExcel,
  FaFileCsv,
  FaFileImage,
  FaFileWord,
  FaFileArchive,
  FaFileVideo,
  FaFilePowerpoint,
  FaFileCode,
} from "react-icons/fa";
import { FiFolderPlus, FiFilePlus, FiUploadCloud, FiEye, FiEyeOff } from "react-icons/fi";
import { BsThreeDots, BsThreeDotsVertical } from "react-icons/bs";
import { Menu, MenuItem, MenuButton } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";
import { useSelector } from "react-redux";
import CreatableSelect from "react-select/creatable";
import axios from "axios";

const config = require("../../services/config.json");

// Static, human-readable labels for the Access Type IDs used across the app
// (shared-access table, share modal dropdown, etc.). Kept as a fallback on top
// of whatever FieldMaster/GetAllAccessTypeMasters returns, so the Sharing
// Details table always shows a friendly label even if the API's own label
// text is missing or worded differently.
const ACCESS_TYPE_LABELS = {
  1: "Read-only",
  2: "Read/Write",
  3: "Read/Write/Download",
};

const isValidEmail = (email) => {
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailPattern.test(email);
};

const FolderCreation = () => {
  const [folders, setFolders] = useState([]);
  const [newFolderName, setNewFolderName] = useState("");
  const navigate = useNavigate();

  const [folderColor, setFolderColor] = useState(
    "linear-gradient(to bottom, #ffeb75, #ffce3c)"
  );
  const [showModal, setShowModal] = useState(false);
  // Prevents double-submitting Create/Update Folder while a request is in flight.
  const [isFolderSubmitting, setIsFolderSubmitting] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(0);
  const [isGridView, setIsGridView] = useState(true);
  const personalInfo = useSelector((state) => state.personalInformationReducer);
  const roleName = personalInfo.userRole;
  const [actionMasters, setActionMasters] = useState([]);
  const [searchParams] = useSearchParams();
  const userFilesUserID = searchParams.get("userFilesUserID");
  const userName = searchParams.get("userName");

  // NEW STATE VARIABLES FOR ENHANCEMENTS
  const [showSharedAccessModal, setShowSharedAccessModal] = useState(false);
  const [sharedAccessList, setSharedAccessList] = useState([]);
  const [selectedItemForSharing, setSelectedItemForSharing] = useState(null);
  const [sharedAccessPaginationPage, setSharedAccessPaginationPage] = useState(1);
  const [sharedAccessPaginationPageSize, setSharedAccessPaginationPageSize] = useState(5);
  const [sharedAccessTotalRecords, setSharedAccessTotalRecords] = useState(0);
  const [usersMap, setUsersMap] = useState({});
  const [accessTypesMap, setAccessTypesMap] = useState({});
  const [sharedAccessLoading, setSharedAccessLoading] = useState(false);

  // NEW: Folder Version History modal state
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState(false);
  const [versionHistoryData, setVersionHistoryData] = useState([]);
  const [versionHistoryFolderName, setVersionHistoryFolderName] = useState("");
  const [versionHistoryLoading, setVersionHistoryLoading] = useState(false);

  // NEW: Ownership + Access History modal state
  const [showAccessHistoryModal, setShowAccessHistoryModal] = useState(false);
  const [accessHistoryData, setAccessHistoryData] = useState([]);
  const [accessHistoryFolderName, setAccessHistoryFolderName] = useState("");
  const [accessHistoryLoading, setAccessHistoryLoading] = useState(false);

  const gradients = [
    "linear-gradient(to bottom, #ffeb75, #ffce3c)",
    "linear-gradient(to bottom, #b0b7ba, #9b9b9b)",
    "linear-gradient(to bottom, #e73e29, #b72d1b)",
    "linear-gradient(to bottom, #fedad5, #f4a64d)",
    "linear-gradient(to bottom, #ee7110, #c95d00)",
    "linear-gradient(to bottom, #ffbf84, #ff9c52)",
    "linear-gradient(to bottom, #3f9f4a, #2d6a36)",
    "linear-gradient(to bottom, #8ed290, #6fb773)",
    "linear-gradient(to bottom, #27938e, #1e7a72)",
    "linear-gradient(to bottom, #7ad1cd, #5db4b1)",
    "linear-gradient(to bottom, #1e84d0, #126b9f)",
    "linear-gradient(to bottom, #86c8f7, #5faed9)",
    "linear-gradient(to bottom, #9a61c7, #7d4ba3)",
    "linear-gradient(to bottom, #d4aff6, #a68cd4)",
    "linear-gradient(to bottom, #cc53b4, #a73a8c)",
    "linear-gradient(to bottom, #f7aae7, #d68ac0)",
  ];

  const { showLoader, hideLoader } = useLoader();

  const getFileIcon = (fileName) => {
    if (!fileName) {
      return <FaFileAlt size={16} color="gray" />;
    }

    const extension = fileName.split(".").pop().toLowerCase();
    let IconComponent;
    let color;

    switch (extension) {
      case "pdf":
        IconComponent = FaFilePdf;
        color = "red";
        break;
      case "xlsx":
      case "xls":
        IconComponent = FaFileExcel;
        color = "green";
        break;
      case "csv":
        IconComponent = FaFileCsv;
        color = "blue";
        break;
      case "png":
      case "jpg":
      case "jpeg":
      case "svg":
        IconComponent = FaFileImage;
        color = "orange";
        break;
      default:
        IconComponent = FaFileAlt;
        color = "gray";
    }

    return <IconComponent size={16} color={color} />;
  };

  const getFileProgressIcon = (fileName) => {
    if (!fileName) {
      return <FaFileAlt size={16} color="gray" />;
    }

    const extension = fileName.split(".").pop().toLowerCase();
    let IconComponent;
    let color;

    switch (extension) {
      case "pdf":
        IconComponent = FaFilePdf;
        color = "#D32F2F";
        break;
      case "xlsx":
      case "xls":
        IconComponent = FaFileExcel;
        color = "#2E7D32";
        break;
      case "csv":
        IconComponent = FaFileCsv;
        color = "#0288D1";
        break;
      case "doc":
      case "docx":
        IconComponent = FaFileWord;
        color = "#1565C0";
        break;
      case "ppt":
      case "pptx":
        IconComponent = FaFilePowerpoint;
        color = "#E64A19";
        break;
      case "png":
      case "jpg":
      case "jpeg":
      case "svg":
      case "gif":
      case "webp":
        IconComponent = FaFileImage;
        color = "#F57C00";
        break;
      case "zip":
      case "rar":
      case "7z":
      case "tar":
        IconComponent = FaFileArchive;
        color = "#6D4C41";
        break;
      case "mp4":
      case "mov":
      case "avi":
      case "mkv":
      case "webm":
        IconComponent = FaFileVideo;
        color = "#8E24AA";
        break;
      case "js":
      case "jsx":
      case "html":
      case "css":
      case "json":
        IconComponent = FaFileCode;
        color = "#455A64";
        break;
      default:
        IconComponent = FaFileAlt;
        color = "gray";
    }

    return <IconComponent size={16} color={color} />;
  };

  const fetchActionMasters = async () => {
    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}FieldMaster/GetAllActionMasters`
      );
      if (response.data.success) {
        setActionMasters(response.data.data);
      } else {
        console.error("Failed to fetch action masters");
      }
    } catch (error) {
      console.error("Error fetching action masters:", error);
    }
  };

  // NEW FUNCTION: Build users and access types map for shared access modal
  const buildMapsForSharedAccess = async () => {
    try {
      // Fetch users - merged with GetAllEmpInfo (empId -> userId) as a
      // fallback, since some createdBy/actionBy/modifiedBy values only
      // resolve to a name via the employee directory, not GetAllUsers.
      const [usersResponse, empInfoResponse] = await Promise.all([
        axios.get(`${config.DDA_API_API_URL}AuthMasterController/GetAllUsers?ClientId=dmsApp`),
        axios
          .get(`${config.DDA_API_API_URL}AuthMasterController/GetAllEmpInfo`)
          .catch((err) => {
            console.error("Error fetching GetAllEmpInfo:", err);
            return { data: { success: false, data: [] } };
          }),
      ]);
      if (usersResponse.data.success && usersResponse.data.data) {
        const map = {};
        usersResponse.data.data.forEach(user => {
          map[user.userID] = `${user.firstName} ${user.lastName}`;
        });
        if (empInfoResponse.data.success) {
          (empInfoResponse.data.data || []).forEach(emp => {
            if (!map[emp.empId]) {
              map[emp.empId] = `${emp.firstName} ${emp.lastName}`;
            }
          });
        }
        setUsersMap(map);
      }

      // Fetch access types
      const accessTypesResponse = await axios.get(
        `${config.DDA_API_API_URL}FieldMaster/GetAllAccessTypeMasters`
      );
      if (accessTypesResponse.data.success && accessTypesResponse.data.data) {
        const map = {};
        accessTypesResponse.data.data.forEach(type => {
          map[type.atId] = type.accessType || type.atType;
        });
        setAccessTypesMap(map);
      }
    } catch (error) {
      console.error("Error building maps for shared access:", error);
    }
  };

  // NEW FUNCTION: Fetch shared access list
  // NOTE: This API returns { status: true, data: [...] } (not "success"), so we check response.data.status
  const fetchSharedAccessList = async (folderOrFileId, page = 1, pageSize = 5) => {
    setSharedAccessLoading(true);
    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}GlobalAdmin/GetSharedListById/${folderOrFileId}`
      );
      if (response.data.status && response.data.data) {
        const allRecords = response.data.data;
        setSharedAccessTotalRecords(allRecords.length);

        // Apply pagination
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        setSharedAccessList(allRecords.slice(startIndex, endIndex));
        setSharedAccessPaginationPage(page);
      } else {
        setSharedAccessList([]);
        setSharedAccessTotalRecords(0);
        // No toast here - an empty/false result can simply mean "no shares yet", not an error
      }
    } catch (error) {
      console.error("Error fetching shared access list:", error);
      toast.error("Error fetching shared access list");
      setSharedAccessList([]);
      setSharedAccessTotalRecords(0);
    } finally {
      setSharedAccessLoading(false);
    }
  };

  // NEW FUNCTION: Handle hide/unhide folder or file
  // Payload matches UpdateFolderHideStatusDto: FolderIdorFileId, IsHide, DocType ("Folder" or "Document"), HideByUserId
  // IMPORTANT: FolderIdorFileId must be resolved based on DocType:
  //   - DocType === "Document" -> send fileId
  //   - DocType === "Folder"   -> send folderId
  const handleHideUnhideFolder = async (item) => {
    if (roleName !== "Global Admin") {
      toast.error("Only Global Admin can hide/unhide items");
      return;
    }

    try {
      showLoader();

      // Resolve DocType FIRST - "Folder" or "Document"
      const docType =
        item.docType ||
        (item.folderId && !item.fileId ? "Folder" : item.fileId ? "Document" : "Folder");

      // Resolve the correct id based on DocType (not by field presence order)
      const idToUse =
        docType === "Document"
          ? (item.fileId || item.folderOrFileId)
          : (item.folderId || item.folderOrFileId);

      if (!idToUse) {
        toast.error("Unable to resolve item ID for hide/unhide");
        hideLoader();
        return;
      }

      const payload = {
        FolderIdorFileId: idToUse,
        IsHide: !item.isHide,
        DocType: docType,
        HideByUserId: personalInfo.userID,
      };

      const response = await axios.post(
        `${config.DDA_API_API_URL}GlobalAdmin/UpdateFolderHideStatus`,
        payload
      );

      if (response.data.status || response.data.success) {
        toast.success(response.data.message || (payload.IsHide ? "Item hidden successfully" : "Item unhidden successfully"));
        fetchFolders(currentFolderId);
      } else {
        toast.error(response.data.message || "Failed to update hide status");
      }
    } catch (error) {
      console.error("Error updating hide status:", error);
      toast.error(error.response?.data?.message || "Error updating hide status");
    } finally {
      hideLoader();
    }
  };

  // NEW FUNCTION: Handle view sharing
  const handleViewSharing = async (item) => {
    try {
      const folderOrFileId = item.folderOrFileId || item.fileId || item.folderId;
      if (!folderOrFileId) {
        toast.error("Invalid item for sharing");
        return;
      }

      // Build maps first if not already done
      if (Object.keys(usersMap).length === 0 || Object.keys(accessTypesMap).length === 0) {
        await buildMapsForSharedAccess();
      }

      setSelectedItemForSharing(item);
      setSharedAccessPaginationPage(1);
      await fetchSharedAccessList(folderOrFileId, 1, sharedAccessPaginationPageSize);
      setShowSharedAccessModal(true);
    } catch (error) {
      console.error("Error preparing shared access modal:", error);
      toast.error("Error opening shared access details");
    }
  };

  // NEW FUNCTION: Handle "Version History" option (folders only)
  const handleViewVersionHistory = async (item) => {
    const folderId = item.folderOrFileId || item.folderId;
    const folderName = item.folderName || item.foldeOrFileName || "Folder";

    if (!folderId) {
      toast.error("Invalid folder for version history");
      return;
    }

    setVersionHistoryFolderName(folderName);
    setShowVersionHistoryModal(true);
    setVersionHistoryLoading(true);
    setVersionHistoryData([]);

    try {
      // Users map is needed to resolve "Modified By" to a display name.
      if (Object.keys(usersMap).length === 0) {
        await buildMapsForSharedAccess();
      }

      const response = await axios.get(
        `${config.DDA_API_API_URL}Reports/GetFolderVersionHistory/${folderId}`
      );
      // API returned success
      if (response.data?.success) {
        setVersionHistoryData(response.data.data || []);
      } else {
        // API returned 200 but success=false
        setVersionHistoryData([]);

        toast.info(
          response.data?.message || "No version history found for this folder."
        );
      }

    } catch (error) {
      console.error("Error fetching folder version history:", error);

      // Handle API 404 response
      if (error.response?.status === 404) {
        const message =
          error.response?.data?.message ||
          "No version history found for this folder.";

        setVersionHistoryData([]);

        toast.info(message);
      } else {
        // Handle other actual errors
        toast.error(
          error.response?.data?.message ||
          "Error fetching version history"
        );
      }
    } finally {
      setVersionHistoryLoading(false);
    }
  };

  // NEW FUNCTION: Handle "Access History" option (folders only)
  const handleViewAccessHistory = async (item) => {
    const folderId = item.folderOrFileId || item.folderId;
    const folderName = item.folderName || item.foldeOrFileName || "Folder";

    if (!folderId) {
      toast.error("Invalid folder for access history");
      return;
    }

    setAccessHistoryFolderName(folderName);
    setShowAccessHistoryModal(true);
    setAccessHistoryLoading(true);
    setAccessHistoryData([]);

    try {
      // Users map is needed to resolve owner/actor IDs to display names.
      if (Object.keys(usersMap).length === 0) {
        await buildMapsForSharedAccess();
      }

      const response = await axios.get(
        `${config.DDA_API_API_URL}Reports/GetOwnershipAccessHistory`,
        { params: { folderOrFileId: folderId, docType: "Folder" } }
      );

      if (response.data.success) {
        setAccessHistoryData(response.data.data || []);
      } else {
        toast.error(response.data.message || "Failed to fetch access history");
      }
    } catch (error) {
      console.error("Error fetching ownership/access history:", error);
      toast.error("Error fetching access history");
    } finally {
      setAccessHistoryLoading(false);
    }
  };


  const handleToggleShareAccessStatus = async (sharedAccess) => {
    try {
      showLoader();
      const payload = {
        sdaId: sharedAccess.sdaId,
        isActive: !sharedAccess.isActive,
        modifiedByUserId: personalInfo.userID,
      };

      const response = await axios.post(
        `${config.DDA_API_API_URL}GlobalAdmin/ToggleShareAccessStatus`,
        payload
      );

      if (response.data.status || response.data.success) {
        toast.success(response.data.message || (payload.isActive ? "Share access activated" : "Share access deactivated"));

        // Refresh the shared access list
        if (selectedItemForSharing) {
          const folderOrFileId = selectedItemForSharing.folderOrFileId || selectedItemForSharing.fileId || selectedItemForSharing.folderId;
          await fetchSharedAccessList(folderOrFileId, sharedAccessPaginationPage, sharedAccessPaginationPageSize);
        }
      } else {
        toast.error(response.data.message || "Failed to toggle share access status");
      }
    } catch (error) {
      console.error("Error toggling share access status:", error);
      toast.error("Error toggling share access status");
    } finally {
      hideLoader();
    }
  };

  // NEW FUNCTION: Delete share access
  const handleDeleteShareAccess = async (sdaId) => {
    if (!window.confirm("Are you sure you want to delete this shared access?")) {
      return;
    }

    try {
      showLoader();
      const response = await axios.post(
        `${config.DDA_API_API_URL}GlobalAdmin/DeleteShareAccess/${sdaId}`
      );

      if (response.data.status || response.data.success) {
        toast.success(response.data.message || "Shared access deleted successfully");

        // Refresh the shared access list
        if (selectedItemForSharing) {
          const folderOrFileId = selectedItemForSharing.folderOrFileId || selectedItemForSharing.fileId || selectedItemForSharing.folderId;
          await fetchSharedAccessList(folderOrFileId, sharedAccessPaginationPage, sharedAccessPaginationPageSize);
        }
      } else {
        toast.error(response.data.message || "Failed to delete shared access");
      }
    } catch (error) {
      console.error("Error deleting share access:", error);
      toast.error("Error deleting shared access");
    } finally {
      hideLoader();
    }
  };

  // NEW FUNCTION: Handle pagination in shared access modal
  const handleSharedAccessPageChange = (newPage) => {
    if (selectedItemForSharing) {
      const folderOrFileId = selectedItemForSharing.folderOrFileId || selectedItemForSharing.fileId || selectedItemForSharing.folderId;
      fetchSharedAccessList(folderOrFileId, newPage, sharedAccessPaginationPageSize);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);
    const pad = (num) => String(num).padStart(2, "0");
    const day = pad(istDate.getDate());
    const month = pad(istDate.getMonth() + 1);
    const year = istDate.getFullYear();
    let hours = istDate.getHours();
    const minutes = pad(istDate.getMinutes());
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    hours = pad(hours);
    return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
  };

  const [folderNameError, setFolderNameError] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [userError, setUserError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setFolderNameError("Folder name cannot be empty");
      return;
    } else {
      setFolderNameError("");
    }

    const isFolderExists = folders.some(
      (folder) =>
        folder.folderName === newFolderName &&
        folder.parentFolderId === currentFolderId
    );

    if (isFolderExists) {
      setFolderNameError("Folder name already exists in this directory");
      return;
    }

    if (isFolderSubmitting) return; // guard against double-clicks

    try {
      setIsFolderSubmitting(true);
      let apiUrl;
      let newFolder;

      if (hasSharedWriteAccess) {
        // Creating a subfolder inside a Shared Files folder this user has
        // Read/Write or Read/Write/Download access to - the new subfolder must
        // still be attributed to the shared folder's original owner, so this
        // goes through the *Behalf API instead of the normal Create APIs.
        apiUrl = `${config.DDA_API_API_URL}FolderData/CreateSubFolderBehalf`;
        newFolder = {
          parentFolderId: currentFolderId,
          folderName: newFolderName,
          folderColor: folderColor,
          createdBy: personalInfo.userID, // logged-in user performing the action
          storegeUserId: currentSharedFolderOwnerId, // shared folder's actual owner
        };
      } else {
        newFolder = {
          folderName: newFolderName,
          folderColor: folderColor,
          createdBy: (roleName === "Administrator" || roleName === "Global Admin") && selectedUser ? selectedUser : personalInfo.userID,
          authorizedUserId: (roleName === "Administrator" || roleName === "Global Admin") && selectedUser ? personalInfo.userID : null,
          parentFolderId: currentFolderId,
        };

        apiUrl =
          currentFolderId === 0
            ? `${config.DDA_API_API_URL}FolderData/CreateFolder`
            : `${config.DDA_API_API_URL}FolderData/CreateSubFolder`;
      }

      const response = await axios.post(apiUrl, newFolder);

      if (response.data.success) {
        toast.success("Folder created successfully");
        fetchFolders(currentFolderId);
        setNewFolderName("");
        setFolderColor("linear-gradient(to bottom, #ffeb75, #ffce3c)");
        setSelectedUser("");
        setUserError("");
        setShowModal(false);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "An error occurred while creating the folder");
    } finally {
      setIsFolderSubmitting(false);
    }
  };

  const handleNavigateToFolder = (folder) => {
    console.log("handleNavigateToFolder called:", folder);
    // Every item in `folders` is normalized in fetchFolders() to always carry
    // `folderOrFileId` (its own id, regardless of which field the source API
    // used - folderId/fileId/folderOrFileId). Falling back to folder.folderId
    // alone here was the bug: for items where the raw `folderId` field wasn't
    // present, folderId ended up `undefined`, fetchFolders(undefined) then
    // silently defaulted to parentId 0 (Home) and showed the ROOT listing
    // instead of the clicked folder's (empty) contents.
    const folderId = folder.folderId ?? folder.folderOrFileId ?? folder.id;
    const folderName = activeTab === "shared" ? folder.foldeOrFileName || folder.folderName : folder.folderName;
    const accessType = activeTab === "shared" ? folder.accessType : null;
    // The folder's true owner (FolderData.CreatedBy is always set to the owner,
    // even for subfolders created "on behalf of" that owner) - this is what
    // gets sent as StoregeUserId to the *Behalf APIs while browsing this folder.
    const ownerId = activeTab === "shared" ? (folder.createdBy || null) : null;

    console.log("Folder clicked:", folderName, "Folder ID:", folderId, "Access Type:", accessType);

    // Refuse to navigate rather than silently falling back to Home - a missing
    // id here means something is wrong with this specific item's data, and
    // showing the root listing instead is more confusing than an error toast.
    if (folderId === undefined || folderId === null) {
      console.error("handleNavigateToFolder: could not resolve a folder id for item:", folder);
      toast.error("Unable to open this folder - its ID is missing. Please refresh and try again.");
      return;
    }

    setCurrentPath([...currentPath, { folderId, folderName, accessType, ownerId }]);
    setCurrentFolderId(folderId);
    localStorage.setItem("currentFolderId", folderId);
    localStorage.setItem("accessType", accessType || "");
    setFolders([]);
    fetchFolders(folderId);
  };

  const handleToggleView = (viewType) => {
    setIsGridView(viewType === "grid");
    localStorage.setItem("viewType", viewType);
  };

  const handleBreadcrumbClick = (folderId) => {
    const breadcrumbIndex = currentPath.findIndex(
      (p) => p.folderId === folderId
    );

    if (breadcrumbIndex !== -1) {
      const newPath = currentPath.slice(0, breadcrumbIndex + 1);
      setCurrentPath(newPath);
      setCurrentFolderId(folderId);
      localStorage.setItem("currentFolderId", folderId);
      setFolders([]);
      fetchFolders(folderId);
    } else {
      toast.error("Folder not found");
    }
  };

  const handleBack = () => {
    const newPath = currentPath.slice(0, -1);
    const newFolderId = newPath.length > 0 ? newPath[newPath.length - 1].folderId : 0;
    const newAccessType = newPath.length > 0 ? newPath[newPath.length - 1].accessType : null;
    console.log("Back button clicked - New Path:", newPath, "New Folder ID:", newFolderId, "New Access Type:", newAccessType);
    setCurrentPath(newPath);
    setCurrentFolderId(newFolderId);
    localStorage.setItem("currentFolderId", newFolderId);
    localStorage.setItem("accessType", newAccessType || "");
    setFolders([]);
    fetchFolders(newFolderId);
  };

  const truncateText = (text, maxLength) => {
    if (typeof text !== "string") {
      return "";
    }
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  const truncateProgressText = (text, maxLength = 10) => {
    if (!text) return '';
    const ext = text.split('.').pop();
    const base = text.substring(0, maxLength);
    return text.length > maxLength ? `${base}...${ext}` : text;
  };

  const handleHomeClick = () => {
    setCurrentPath([]);
    setCurrentFolderId(0);
    setFolders([]);
    fetchFolders(null);
  };

  const [editMode, setEditMode] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState(null);
  const [editfileMode, setEditFileMode] = useState(false);
  const [fileToEdit, setfileToEdit] = useState(null);
  const [fileName, setFileName] = useState("");
  // BACKGROUND UPLOAD QUEUE (OneDrive-style non-blocking uploads).
  // Sourced from the app-level UploadContext (see App.js) so the queue and its
  // floating status panel stay alive and visible even after navigating to a
  // different tab/menu/route, instead of resetting when this page unmounts.
  const {
    addUploadItems,
    updateUploadItem,
    setShowUploadPanel,
    setIsUploadPanelMinimized,
  } = useUpload();
  const currentFolderIdRef = useRef(currentFolderId);

  useEffect(() => {
    currentFolderIdRef.current = currentFolderId;
  }, [currentFolderId]);

  const handleUpdateFileName = async () => {
    const formData = new FormData();
    formData.append("fileId", fileToEdit.fileId);
    formData.append("folderId", fileToEdit.folderId);
    formData.append("fileName", `${fileName}${fileExtension}`);
    formData.append("filePath", fileToEdit.filePath);
    formData.append("CreatedBy", personalInfo.userID);

    try {
      const response = await axios.post(
        `${config.DDA_API_API_URL}FolderData/UpdateFileName`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      toast.success("File name updated successfully");
      setFileName("");
      fetchFolders(currentFolderId);
      handleCloseFileModal();
    } catch (error) {
      console.error("Error updating file name:", error);
    }
  };


  const handleUpdateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Folder name cannot be empty");
      return;
    }

    if (isFolderSubmitting) return; // guard against double-clicks

    try {
      setIsFolderSubmitting(true);
      let apiUrl;
      let updatedFolder;

      if (isEditingRootSharedFolder) {
        // Editing the main shared folder itself (top-level item in the Shared
        // Files tab) that this user has Read/Write or Read/Write/Download
        // access to - keep it attributed to its original owner.
        apiUrl = `${config.DDA_API_API_URL}FolderData/UpdateFolderBehalf`;
        updatedFolder = {
          folderId: folderToEdit.folderOrFileId,
          folderName: newFolderName,
          folderColor: folderColor,
          parentFolderId: folderToEdit.parentFolderId || 0,
          tags: folderToEdit.tags || "",
          createdBy: personalInfo.userID, // logged-in user performing the action
          storegeUserId: folderToEdit.createdBy, // shared folder's actual owner
        };
      } else if (hasSharedWriteAccess) {
        // Editing an item inside a Shared Files folder this user has Write
        // access to - keep it attributed to the shared folder's original owner.
        apiUrl = `${config.DDA_API_API_URL}FolderData/SubUpdateFolderBehalf`;
        updatedFolder = {
          parentFolderId: folderToEdit.parentFolderId || 0,
          folderId: folderToEdit.folderId,
          folderName: newFolderName,
          folderPath: folderToEdit.folderPath,
          folderColor: folderColor,
          tags: folderToEdit.tags || "",
          createdBy: personalInfo.userID, // logged-in user performing the action
          storegeUserId: currentSharedFolderOwnerId, // shared folder's actual owner
        };
      } else {
        updatedFolder = {
          folderId: folderToEdit.folderId,
          folderName: newFolderName,
          folderPath: folderToEdit.folderPath,
          folderColor: folderColor,
          parentFolderId: folderToEdit.parentFolderId || 0,
          tags: folderToEdit.tags || "",
          createdBy: personalInfo.userID,
        };

        if (folderToEdit.parentFolderId === 0) {
          updatedFolder.serverFolderPath = folderToEdit.serverFolderPath;
        }

        apiUrl = `${config.DDA_API_API_URL}FolderData/${folderToEdit.parentFolderId === 0 ? "UpdateFolder" : "SubUpdateFolder"
          }`;
      }

      const response = await axios.post(apiUrl, updatedFolder);

      if (response.data.success) {
        toast.success("Folder updated successfully");
        fetchFolders(currentFolderId);
        setShowModal(false);
        setEditMode(false);
        setFolderToEdit(null);
        setNewFolderName("");
      } else {
        toast.error("Failed to update folder");
      }
    } catch (error) {
      toast.error("Error updating folder");
    } finally {
      setIsFolderSubmitting(false);
    }
  };

  const [fileExtension, setFileExtension] = useState("");

  const handleOptionSelect = (option, item) => {
    if (option === "Download") {
      if (item.docType === "Document" && item.folderOrFileId) {
        console.log("Download Document:", { folderOrFileId: item.folderOrFileId });
        handleDownloadFile(item.folderOrFileId);
      } else if (item.docType === "Folder" && item.folderOrFileId) {
        console.log("Download Folder:", { folderOrFileId: item.folderOrFileId });
        handleDownloadFolder(item.folderOrFileId);
      } else {
        console.log("Fallback Download:", { fileId: item.fileId, folderId: item.folderId });
        if (item.fileId) {
          handleDownloadFile(item.fileId);
        } else if (item.folderId) {
          handleDownloadFolder(item.folderId);
        }
      }
    } else if (option === "Delete") {
      if (item.docType === "Document" && item.folderOrFileId) {
        console.log("Delete Document:", { fileId: item.fileId, folderOrFileId: item.folderOrFileId });
        deleteFile(item.folderOrFileId);
      } else if (item.docType === "Folder" && item.folderOrFileId) {
        console.log("Delete Folder:", { folderId: item.folderId, folderOrFileId: item.folderOrFileId });
        deleteFolder(item.folderOrFileId, item.folderName);
      } else {
        console.log("Fallback Delete:", { fileId: item.fileId, folderId: item.folderId });
        if (item.fileId) {
          deleteFile(item.fileId);
        } else if (item.folderId) {
          deleteFolder(item.folderId, item.folderName);
        }
      }
    } else if (option === "View") {
      if (item.docType === "Document" && item.folderOrFileId) {
        console.log("View Document:", { folderOrFileId: item.folderOrFileId });
        handleViewItem(item);
      } else if (item.docType === "Folder" && item.folderOrFileId) {
        console.log("View Folder:", { folderOrFileId: item.folderOrFileId });
        handleNavigateToFolder(item);
      } else {
        if (item.fileId) {
          console.log("View Fallback File:", { fileId: item.fileId });
          handleViewItem(item);
        } else if (item.folderId) {
          console.log("View Fallback Folder:", { folderId: item.folderId });
          handleNavigateToFolder(item);
        }
      }
    } else if (option === "Edit") {
      if (item.docType === "Document" && item.folderOrFileId) {
        setfileToEdit(item);
        const [name, extension] = item.fileName.split('.');
        setFileName(name);
        setFileExtension(`.${extension}`);
        setEditFileMode(true);
        setShowFileModal(true);
        console.log("Edit item", item);
      } else if (item.docType === "Folder" && item.folderOrFileId) {
        setFolderToEdit(item);
        setNewFolderName(item.folderName || item.foldeOrFileName);
        setFolderColor(
          item.folderColor || "linear-gradient(to bottom, #ffeb75, #ffce3c)"
        );
        setEditMode(true);
        setShowModal(true);
      } else {
        if (item.fileId) {
          setfileToEdit(item);
          const [name, extension] = item.fileName.split('.');
          setFileName(name);
          setFileExtension(`.${extension}`);
          setEditFileMode(true);
          setShowFileModal(true);
          console.log("Edit item", item);
        } else if (item.folderId) {
          setFolderToEdit(item);
          setNewFolderName(item.folderName);
          setFolderColor(
            item.folderColor || "linear-gradient(to bottom, #ffeb75, #ffce3c)"
          );
          setEditMode(true);
          setShowModal(true);
        }
      }
    } else if (option === "Share") {
      console.log("Item received:", item);
      setSelectedItem(item);
      console.log("selectred", selectedItem);
      setShowSubDropdown(false);
      setShowShareModal(true);
    }
    // NEW: Handle Hide/Unhide option
    else if (option === "Hide" || option === "Unhide") {
      handleHideUnhideFolder(item);
    }
    // NEW: Handle View Sharing option
    else if (option === "View Sharing") {
      handleViewSharing(item);
    }
    // NEW: Handle Version History option (folders only)
    else if (option === "Version History") {
      handleViewVersionHistory(item);
    }
    // NEW: Handle Access History option (folders only)
    else if (option === "Access History") {
      handleViewAccessHistory(item);
    }
  };

  const [modalContent, setModalContent] = useState("");
  const [excelData, setExcelData] = useState(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const iconBtnStyle = {
    background: "rgba(0,0,0,0.6)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "6px 10px",
    cursor: "pointer",
  };

  const handleOpenModal = (content) => {
    setModalContent(content);
    setShowDocumentModal(true);
    setExcelData(null);
    setIsFullScreen(false);
    setZoom(1);

    if (content.endsWith(".xlsx") || content.endsWith(".xls")) {
      fetch(content)
        .then((response) => response.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const data = e.target.result;
            ExcelRenderer(data, (err, resp) => {
              if (!err) setExcelData(resp.rows);
            });
          };
          reader.readAsArrayBuffer(blob);
        })
        .catch((err) => console.error("Error fetching Excel:", err));
    }
  };

  const toggleFullScreen = () => {
    const elem = containerRef.current;
    if (!isFullScreen && elem?.requestFullscreen) {
      elem.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullScreen(fs);
      if (!fs) setZoom(1);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 2.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.5));

  const handleViewItem = (item) => {
    let filePath;
    let idToUse;

    if (activeTab === "shared") {
      if (item.docType === "Document" && (item.folderOrFileId || item.fileId)) {
        idToUse = item.folderOrFileId || item.fileId;
        filePath = item.serverFolderOrFilePath || item.serverFilePath;
      } else if (item.docType === "Folder" && (item.folderOrFileId || item.folderId)) {
        idToUse = item.folderOrFileId || item.folderId;
        filePath = item.serverFolderOrFilePath || item.folderPath;
      }
    }

    if (!idToUse) {
      idToUse = item.fileId || item.folderId;
      filePath = item.serverFilePath || item.serverFolderOrFilePath || item.folderPath;
    }

    console.log("Viewing Item Details:", { idToUse, filePath, item });

    if (!filePath) {
      console.error("No valid file path to view", item);
      toast.error("Cannot open document: No valid file path");
      return;
    }

    if (filePath.endsWith(".txt")) {
      window.open(filePath, "_blank");
    } else if (
      filePath.endsWith(".xlsx") ||
      filePath.endsWith(".xls") ||
      filePath.endsWith(".csv")
    ) {
      const link = document.createElement('a');
      link.href = filePath;
      link.download = filePath.split('/').pop();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      handleOpenModal(filePath);
    }
  };

  const handleDownloadFile = async (fileId, folderOrFileId) => {
    const finalFileId = fileId || folderOrFileId;
    console.log("Downloading file with ID:", finalFileId);
    const url = `${config.DDA_API_API_URL}FolderData/DownloadFile?fileId=${finalFileId}`;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_self";
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleDownloadFolder = async (folderId, folderOrFileId) => {
    const finalFolderId = folderId || folderOrFileId;
    console.log("Downloading folder with ID:", finalFolderId);
    const url = `${config.DDA_API_API_URL}FolderData/DownloadFolder?folderId=${finalFolderId}`;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_self";
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const deleteFolder = async (folderId, folderName) => {
    try {
      const payload = {
        folderId,
        folderName,
        deletedBy: personalInfo.userID,
      };

      const response = await axios.post(
        `${config.DDA_API_API_URL}FolderData/DeleteFolder`,
        payload
      );

      if (response.data.success) {
        toast.success("Folder deleted successfully");
        fetchFolders(currentFolderId);
      } else {
        toast.error("Failed to delete folder");
      }
    } catch (error) {
      toast.error("Error deleting folder");
    }
  };

  const deleteFile = async (fileId) => {
    try {
      const response = await axios.post(
        `${config.DDA_API_API_URL}FolderData/DeleteFile/${fileId}`
      );

      if (response.data.success) {
        toast.success("File deleted successfully");
        fetchFolders(currentFolderId);
      } else {
        toast.error("Failed to delete file");
      }
    } catch (error) {
      toast.error("Error deleting file");
    }
  };

  const [showFileModal, setShowFileModal] = useState(false);
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const [storageInfo, setStorageInfo] = useState({
    totalStorage: 0,
    usedStorage: 0,
    availableStorage: 0,
  });
  // Tracks whether GetAllUsersDataLimit actually returned a record for the
  // user currently being viewed (self, or another user via userFilesUserID).
  // Some users have no storage-limit record yet, in which case we should not
  // render "0 Bytes free of 0 Bytes" (which reads as "no storage at all").
  const [hasStorageData, setHasStorageData] = useState(true);

  const formatStorage = (bytes) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    } else if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    } else if (bytes >= 1024) {
      return (bytes / 1024).toFixed(2) + ' KB';
    }
    return bytes + ' Bytes';
  };

  // When a Global Admin opens another user's dashboard (via ?userFilesUserID=...),
  // show that user's storage details instead of the logged-in admin's own storage.
  const fetchStorageData = async () => {
    try {
      const response = await axios.get(`${config.DDA_API_API_URL}GlobalAdmin/GetAllUsersDataLimit`);
      if (response.data.success && response.data.data.length > 0) {
        const targetUserId = userFilesUserID || personalInfo.userID;
        const userData = response.data.data.find(item => item.userId === targetUserId);
        if (userData) {
          setStorageInfo({
            totalStorage: userData.maximumAllocatedStorage,
            usedStorage: userData.usedStorage,
            availableStorage: userData.maximumAllocatedStorage - userData.usedStorage,
          });
          setHasStorageData(true);
        } else {
          console.error("Failed to find storage data for user:", targetUserId);
          setStorageInfo({ totalStorage: 0, usedStorage: 0, availableStorage: 0 });
          setHasStorageData(false);
        }
      } else {
        console.error("Failed to fetch storage data");
        setStorageInfo({ totalStorage: 0, usedStorage: 0, availableStorage: 0 });
        setHasStorageData(false);
      }
    } catch (error) {
      console.error("Error fetching storage data:", error);
      setStorageInfo({ totalStorage: 0, usedStorage: 0, availableStorage: 0 });
      setHasStorageData(false);
    }
  };

  useEffect(() => {
    fetchStorageData();
  }, [personalInfo.userID, userFilesUserID]);

  const [storageError, setStorageError] = useState("");

  const handleFileChange = (event) => {
    if (!allowedExtensions || allowedExtensions.length === 0) {
      setStorageError("File types are not ready yet. Please try again later.");
      return;
    }

    const selectedFiles = Array.from(event.target.files || []);
    const validFiles = [];
    const invalidFiles = [];
    let totalFileSize = 0;

    selectedFiles.forEach((file) => {
      const fileExtension = `.${file.name.split(".").pop().toLowerCase()}`;
      if (allowedExtensions.includes(fileExtension)) {
        validFiles.push(file);
        totalFileSize += file.size;
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (totalFileSize > storageInfo.availableStorage) {
      setStorageError(
        `Selected files (${formatStorage(totalFileSize)}) exceed available storage (${formatStorage(storageInfo.availableStorage)})`
      );
      setFiles([]);
      return;
    }

    if (invalidFiles.length > 0) {
      toast.error(`Invalid file(s) removed: ${invalidFiles.join(", ")}`);
      setStorageError("");
    } else {
      setStorageError("");
    }

    setFiles(validFiles);
    setUploadError("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!allowedExtensions || allowedExtensions.length === 0) {
      setStorageError("File types are not ready yet. Please try again later.");
      return;
    }

    const droppedFiles = Array.from(e.dataTransfer.files || []);
    const validFiles = [];
    const invalidFiles = [];
    let totalFileSize = 0;

    droppedFiles.forEach((file) => {
      const fileExtension = `.${file.name.split(".").pop().toLowerCase()}`;
      if (allowedExtensions.includes(fileExtension)) {
        validFiles.push(file);
        totalFileSize += file.size;
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (totalFileSize > storageInfo.availableStorage) {
      setStorageError(
        `Dropped files (${formatStorage(totalFileSize)}) exceed available storage (${formatStorage(storageInfo.availableStorage)})`
      );
      setFiles([]);
      return;
    }

    if (invalidFiles.length > 0) {
      toast.error(`Invalid file(s) removed: ${invalidFiles.join(", ")}`);
      setStorageError("");
    } else {
      setStorageError("");
    }

    setFiles(validFiles);
    setUploadError("");
  };

  const handleBoxClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const [allowedExtensions, setAllowedExtensions] = useState([]);

  useEffect(() => {
    const fetchAllowedExtensions = async () => {
      try {
        const response = await axios.get(
          `${config.DDA_API_API_URL}FieldMaster/GetAllDocExts`
        );
        if (response.data.success) {
          const extensions = response.data.data.map((ext) => ext.extType);
          setAllowedExtensions(extensions);
        } else {
          toast.error("Failed to retrieve document extensions");
        }
      } catch (error) {
        console.error("Error fetching document extensions");
      }
    };

    fetchAllowedExtensions();
  }, []);

  const [uploadError, setUploadError] = useState("");

  // Uploads a single file. The CreateFilesBeHalf API is used - instead of the
  // normal CreateFiles API - in two "on behalf of someone else" scenarios:
  //  1) A Global Admin is viewing another user's dashboard (?userFilesUserID=...)
  //     -> StoregeUserId = that viewed user.
  //  2) Any logged-in role is uploading into a Shared Files folder they have
  //     Read/Write or Read/Write/Download access to
  //     -> StoregeUserId = that shared folder's original owner.
  // In both cases CreatedBy is always the logged-in user actually performing
  // the upload, so the file/storage stays attributed to the right owner.
  const uploadSingleFileInBackground = async (queueItem, folderIdAtUploadTime) => {
    const isUploadingOnBehalfOfViewedUser = roleName === "Global Admin" && !!userFilesUserID;
    const isUploadingIntoSharedWriteFolder = hasSharedWriteAccess;

    const behalfStorageUserId = isUploadingOnBehalfOfViewedUser
      ? userFilesUserID
      : isUploadingIntoSharedWriteFolder
        ? currentSharedFolderOwnerId
        : null;

    const formData = new FormData();
    formData.append("Files", queueItem.file);
    formData.append("FolderId", folderIdAtUploadTime);
    formData.append("CreatedBy", personalInfo.userID);

    if (behalfStorageUserId) {
      formData.append("StoregeUserId", behalfStorageUserId);
    }

    const uploadUrl = behalfStorageUserId
      ? `${config.DDA_API_API_URL}FolderData/CreateFilesBeHalf`
      : `${config.DDA_API_API_URL}FolderData/CreateFiles`;

    try {
      const response = await axios.post(
        uploadUrl,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total || 1;
            const loaded = progressEvent.loaded;
            const percent = Math.min((loaded / total) * 100, 100);

            updateUploadItem(queueItem.id, { progress: percent });
          },
        }
      );

      if (response.data.success) {
        updateUploadItem(queueItem.id, { progress: 100, status: "completed" });
        return { success: true, folderId: folderIdAtUploadTime };
      } else {
        updateUploadItem(queueItem.id, { status: "failed" });
        return { success: false, folderId: folderIdAtUploadTime };
      }
    } catch (error) {
      updateUploadItem(queueItem.id, { status: "failed" });
      return { success: false, folderId: folderIdAtUploadTime };
    }
  };

  // Kicks off background, non-blocking uploads for the selected files. The user can keep
  // browsing, creating folders, opening files, etc. while these run - progress is shown
  // in a small floating panel instead of a page-blocking modal.
  const handleFileUpload = async () => {
    if (files.length === 0) {
      setUploadError("Please select at least one file to upload.");
      return;
    }
    setUploadError("");
    setShowFileModal(false);

    const folderIdAtUploadTime = currentFolderId;
    const filesToUpload = files;
    setFiles([]);

    const newQueueItems = filesToUpload.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading",
      folderId: folderIdAtUploadTime,
    }));

    addUploadItems(newQueueItems);

    const CONCURRENCY = 3;
    let cursor = 0;
    const results = [];

    const runNext = async () => {
      if (cursor >= newQueueItems.length) return;
      const item = newQueueItems[cursor++];
      const result = await uploadSingleFileInBackground(item, folderIdAtUploadTime);
      results.push(result);
      await runNext();
    };

    const workerCount = Math.min(CONCURRENCY, newQueueItems.length);
    await Promise.all(Array.from({ length: workerCount }, runNext));

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;

    if (successCount > 0) {
      toast.success(
        failedCount > 0
          ? `${successCount} file(s) uploaded successfully, ${failedCount} failed`
          : "Files uploaded successfully"
      );
    }
    if (failedCount > 0 && successCount === 0) {
      toast.error("Failed to upload files");
    }

    // Auto-refresh only if the user is still viewing the folder that was uploaded to
    if (currentFolderIdRef.current === folderIdAtUploadTime) {
      fetchFolders(folderIdAtUploadTime);
    }
    fetchStorageData();
  };



  const fileInputRef = useRef(null);

  const handleCloseFileModal = () => {
    setShowFileModal(false);
    setUploadError("");
    setEditFileMode(false);
    setStorageError(false);
    setFiles([]);
  };

  const [showSubDropdown, setShowSubDropdown] = useState(false);

  const hideActions = (actionDesc, accessType) => {
    const activeTab = localStorage.getItem('activeTab');

    if (roleName === "Global Admin" && userFilesUserID) {
      // For Global Admin viewing other user's files, show all options
      return false;
    }

    if (activeTab === "shared") {
      if (actionDesc === "Delete") {
        // Deleting items from a shared folder is out of scope for this
        // enhancement - only Create Subfolder / Upload / Edit are allowed.
        return true;
      }
      if (actionDesc === "Edit") {
        // Editing (renaming, re-coloring) a shared item is only allowed when
        // this user has Read/Write (2) or Read/Write/Download (3) access.
        return !(accessType === 2 || accessType === 3);
      }
    }

    if (accessType === 1) {
      return ["Edit", "Share", "Download", "Delete"].includes(actionDesc);
    } else if (accessType === 2) {
      return actionDesc === "Download";
    }

    return false;
  };

  const [selectedItem, setSelectedItem] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  // Guards the Share button against double-clicks while CreateShareAccess is in flight.
  const [isSharing, setIsSharing] = useState(false);
  const [accessTypes, setAccessTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedAccessType, setSelectedAccessType] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isExpiryDate, setIsExpiryDate] = useState(false);
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [isEncryptionKey, setIsEncryptionKey] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState("");

  useEffect(() => {
    axios
      .get(`${config.DDA_API_API_URL}FieldMaster/GetAllAccessTypeMasters`)
      .then((response) => {
        setAccessTypes(response.data.data);
      })
      .catch((error) => console.log(error));
  }, []);

  const [shareUsers, setShareUsers] = useState([]);
  // NEW: Cohort/Group options for the Share modal - lets users share with a
  // whole Cohort/Group at once instead of picking every member individually.
  const [cohortGroups, setCohortGroups] = useState([]);
  // NEW: Unfiltered empId -> name lookup (straight from GetAllEmpInfo, no
  // "exclude self"/isActive filtering like shareUsers has) - used purely to
  // resolve names for the Cohort/Group hover tooltip, so every member shows
  // a name even if they were filtered out of the Select Users dropdown itself.
  const [empInfoMap, setEmpInfoMap] = useState({});

  const fetchCohortGroups = async () => {
    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}FieldMaster/GetActiveGroupMasters`
      );
      if (response.data.success && response.data.data) {
        setCohortGroups(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching cohort/group list:", error);
    }
  };

  const fetchEmpInfoMap = async () => {
    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}AuthMasterController/GetAllEmpInfo`
      );
      if (response.data.success && response.data.data) {
        const map = {};
        response.data.data.forEach((emp) => {
          map[emp.empId] = `${emp.firstName} ${emp.lastName}`;
        });
        setEmpInfoMap(map);
      }
    } catch (error) {
      console.error("Error fetching GetAllEmpInfo:", error);
    }
  };

  useEffect(() => {
    fetchCohortGroups();
    fetchEmpInfoMap();
  }, []);

  const fetchShareUsers = async (forModal = false) => {
    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}AuthMasterController/GetAllUsers?ClientId=dmsApp`
      );
      console.log("Users API Response:", response.data);
      if (response.data.success && response.data.data) {
        const filteredUserOptions = response.data.data
          .filter(
            (user) =>
              user.isActive &&
              user.userID !== personalInfo.userID &&
              // When a Global Admin is viewing a particular user's dashboard
              // (?userFilesUserID=...), that same user shouldn't appear in
              // their own Share modal's "Select Users" list.
              user.userID !== userFilesUserID
          )
          .map((user) => ({
            value: user.userID,
            label: `${user.firstName} ${user.lastName} - ${user.email}`,
            roleName: user.roleName,
          }));

        setShareUsers(filteredUserOptions);
      } else {
        console.error("Failed to fetch users:", response.data.message);
        forModal ? setModalUsers([]) : setUsers([]);
        if (!forModal) setSelectedUserId(null);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      forModal ? setModalUsers([]) : setUsers([]);
      if (!forModal) setSelectedUserId(null);
      toast.error("Failed to load users for dropdown");
    }
  };

  useEffect(() => {
    fetchShareUsers();
  }, [personalInfo.userID, userFilesUserID]);

  // Hover tooltip helper for Cohort/Group options - resolves each member's
  // userId via the unfiltered empInfoMap (straight from GetAllEmpInfo, not
  // the isActive/exclude-self-filtered shareUsers list), so hovering a
  // cohort always shows every member's name, regardless of any filtering
  // applied elsewhere to the individual "Select Users" options.
  const getCohortMemberTooltip = (userIds) => {
    if (!userIds || userIds.length === 0) {
      return "No users in this group";
    }
    const names = userIds.map((id) => empInfoMap[id] || id);
    return `Users in this group:\n${names.join(", ")}`;
  };

  const CustomOption = (props) => (
    <div
      className="custom-option option-style "
      {...props.innerProps}
      title={props.data.isCohort ? getCohortMemberTooltip(props.data.userIds) : undefined}
    >
      <i
        className={`fas ${props.data.isCohort ? "fa-users" : "fa-user-plus"}`}
        style={{ marginRight: 10 }}
      ></i>
      {props.data.label}
    </div>
  );

  const CustomMultiValue = (props) => (
    <div
      className="custom-multi-value multi-value-style"
      title={props.data.isCohort ? getCohortMemberTooltip(props.data.userIds) : undefined}
    >
      <i className="fas fa-user-check " style={{ marginRight: 5 }}></i>
      {props.data.label}
      <button
        onClick={(e) => {
          e.stopPropagation();
          props.removeProps.onClick();
        }}
        className="remove-options"
      >
        &times;
      </button>
    </div>
  );

  const handleAccessTypeChange = (e) => {
    setSelectedAccessType(e.target.value);
    if (e.target.value) {
      setAccessTypeError(false);
    }
  };

  const handleCloseShareModal = () => {
    resetForm();
    setShowShareModal(false);
  };

  const [accessTypeError, setAccessTypeError] = useState(false);
  const [userSelectionError, setUserSelectionError] = useState(false);

  const handleShare = () => {
    console.log("parent");

    if (isSharing) return; // guard against double-clicks while a share request is in flight

    if (!selectedItem) {
      toast.error("No item selected");
      return;
    }

    if (!selectedAccessType) {
      setAccessTypeError(true);
      return;
    } else {
      setAccessTypeError(false);
    }

    if (selectedUsers.length === 0) {
      setUserSelectionError(true);
      return;
    } else {
      setUserSelectionError(false);
    }

    showLoader();
    setIsSharing(true);
    // NEW: expand any selected Cohort/Group option(s) into their member userIds,
    // merged with any individually-selected users, deduplicated - and always
    // excluding the logged-in user themself, since a cohort's membership can
    // include the person doing the sharing, but they shouldn't end up sharing
    // the item with themselves.
    const expandedUserIds = new Set();
    selectedUsers.forEach((user) => {
      if (user.isCohort && Array.isArray(user.userIds)) {
        user.userIds.forEach((id) => expandedUserIds.add(id));
      } else {
        expandedUserIds.add(user.value);
      }
    });
    expandedUserIds.delete(personalInfo.userID);
    const accessUserId = [...expandedUserIds];

    if (accessUserId.length === 0) {
      setUserSelectionError(true);
      hideLoader();
      setIsSharing(false);
      return;
    }

    const folderOrFileId = selectedItem.fileId
      ? selectedItem.fileId
      : selectedItem.folderId
        ? selectedItem.folderId
        : selectedItem.docType === "Document"
          ? selectedItem.folderOrFileId
          : selectedItem.docType === "Folder"
            ? selectedItem.folderOrFileId
            : null;

    const docType =
      activeTab === "shared"
        ? selectedItem.docType
          ? selectedItem.docType
          : selectedItem.fileId
            ? "Document"
            : selectedItem.folderId
              ? "Folder"
              : null
        : selectedItem.fileId
          ? "Document"
          : selectedItem.folderId
            ? "Folder"
            : null;

    const payload = {
      folderOrFileId,
      docType,
      fileExistFolId: currentFolderId || selectedItem.fileExistFolId,
      accessUserId: accessUserId,
      accessType: selectedAccessType,
      isExpiryDate: false,
      expiryDate: isExpiryDate ? expiryDate : "",
      isEncryptionKey: false,
      encryptionKey: isEncryptionKey ? encryptionKey : "",
      comment: "",
      createdBy: personalInfo.userID,
    };

    axios
      .post(`${config.DDA_API_API_URL}FolderData/CreateShareAccess`, payload)
      .then((response) => {
        const { data } = response;
        if (data && data.success) {
          toast.success(data.message || "Successfully shared");
          resetForm();
          handleCloseShareModal();
        } else {
          toast.error(data.message || "Failed to share");
        }
      })
      .catch((error) => {
        const errorMessage =
          error.response?.data?.message || "Error sharing the item";
        toast.error(errorMessage);
      })
      .finally(() => {
        hideLoader();
        setIsSharing(false);
      });
  };

  const [duplicateToastShown, setDuplicateToastShown] = useState(false);

  // NEW: Cohort/Group entries for the Select Users dropdown. Each carries its
  // full member userId list (isCohort + userIds), which handleShare() expands
  // into individual accessUserId entries at submit time.
  const cohortOptions = cohortGroups.map((group) => ({
    value: `cohort-${group.gmId}`,
    label: `👥 ${group.groupName} (Cohort - ${group.userIds?.length || 0} users)`,
    isCohort: true,
    userIds: group.userIds || [],
  }));
  const cohortOptionValues = cohortOptions.map((o) => o.value);

  const allOptions = [
    { value: "select-all", label: "Select All" },
    ...cohortOptions,
    ...shareUsers,
  ];

  const handleUserChange = (selectedOptions) => {
    const existingUserValues = shareUsers.map((user) => user.value);
    const validSelectedUsers = [];
    const addedUserValues = new Set();
    let invalidUserAdded = false;

    const isSelectAllSelected = selectedOptions.some(
      (option) => option.value === "select-all"
    );

    if (isSelectAllSelected) {
      // "Select All" selects every individual user; cohorts still have to be
      // picked separately since they represent a distinct, named group.
      setSelectedUsers(shareUsers);
      setUserSelectionError(false);
      return;
    }

    selectedOptions.forEach((option) => {
      const isCohortOption = cohortOptionValues.includes(option.value);
      const isExistingUser = existingUserValues.includes(option.value);
      const isValidNewUser =
        isValidEmail(option.value) &&
        !existingUserValues.includes(option.value);

      if (isCohortOption || isExistingUser) {
        validSelectedUsers.push(option);
      } else if (isValidNewUser) {
        if (addedUserValues.has(option.value)) {
          if (!duplicateToastShown) {
            toast.error("This email address has already been added.");
            setDuplicateToastShown(true);
          }
        } else {
          validSelectedUsers.push(option);
          addedUserValues.add(option.value);
        }
      } else {
        invalidUserAdded = true;
      }
    });

    setSelectedUsers(validSelectedUsers);

    if (invalidUserAdded) {
      toast.error("Invalid email address. Please enter a valid email.");
    } else {
      setUserSelectionError(false);
    }

    if (validSelectedUsers.length !== selectedUsers.length) {
      setDuplicateToastShown(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      const inputValue = event.target.value;

      const isDuplicate = selectedUsers.some(
        (user) => user.value === inputValue
      );
      if (isDuplicate) {
        if (!duplicateToastShown) {
          toast.error("This email address has already been added.");
          setDuplicateToastShown(true);
        }
        event.preventDefault();
      }
    }
  };

  const resetForm = () => {
    setSelectedUsers([]);
    setSelectedAccessType("");
    setIsExpiryDate(false);
    setExpiryDate("");
    setIsEncryptionKey(false);
    setEncryptionKey("");
    setShowShareModal(false);
  };

  const [activeTab, setActiveTab] = useState(
    localStorage.getItem("activeTab") || "current"
  );

  // ---- Shared Files write-access helpers ----
  // When browsing inside a folder from the "Shared Files" tab, currentPath's last
  // entry carries that folder's accessType (1 = Read-only, 2 = Read/Write,
  // 3 = Read/Write/Download) and ownerId (the folder's actual owner/CreatedBy -
  // the value the *ByBehalf APIs need as StoregeUserId). Any logged-in role
  // (User/Administrator/Global Admin) with accessType 2 or 3 on the folder they
  // are currently viewing is allowed to create subfolders / upload files into it,
  // via the *Behalf APIs so the new folder/file is still attributed to the owner.
  const currentSharedFolderAccessType =
    currentPath.length > 0 ? currentPath[currentPath.length - 1].accessType : null;
  const currentSharedFolderOwnerId =
    currentPath.length > 0 ? currentPath[currentPath.length - 1].ownerId : null;
  const hasSharedWriteAccess =
    activeTab === "shared" &&
    currentFolderId !== 0 &&
    (currentSharedFolderAccessType === 2 || currentSharedFolderAccessType === 3);

  // Editing a top-level item straight from the Shared Files tab listing (i.e. the
  // main shared folder itself, e.g. "Global1"/"Global2" - not a subfolder browsed
  // into it) uses different field names than "own" folders: folderOrFileId
  // instead of folderId, and no parentFolderId. Detect that shape here.
  const isEditingRootSharedFolder =
    activeTab === "shared" &&
    !!folderToEdit &&
    folderToEdit.folderOrFileId !== undefined &&
    (folderToEdit.accessType === 2 || folderToEdit.accessType === 3);

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [modalUsers, setModalUsers] = useState([]);

  useEffect(() => {
    if (activeTab === "assigned" && (roleName === "Administrator" || roleName === "Global Admin")) {
      console.log("Fetching users for Assigned Folders tab, role:", roleName);
      fetchUsers(false);
    } else {
      console.log("Clearing users and selectedUserId, activeTab:", activeTab, "role:", roleName);
      setUsers([]);
      setSelectedUserId(null);
    }
  }, [activeTab, roleName]);

  useEffect(() => {
    if (showModal && (roleName === "Administrator" || roleName === "Global Admin")) {
      console.log("Fetching users for create folder modal, role:", roleName);
      fetchUsers(true);
    }
  }, [showModal, roleName]);

  // When a Global Admin opens the Create/Edit Folder modal while viewing another
  // user's dashboard (?userFilesUserID=...), pre-select that user in the
  // "Select User (Optional)" dropdown so the folder is created on their behalf
  // by default, instead of defaulting to "Create as myself".
  useEffect(() => {
    if (showModal && !editMode && roleName === "Global Admin" && userFilesUserID) {
      setSelectedUser(userFilesUserID);
    }
  }, [showModal, editMode, roleName, userFilesUserID]);

  useEffect(() => {
    if (roleName === "Global Admin" && userFilesUserID && activeTab === "assigned") {
      console.log("Clearing selectedUserId due to userFilesUserID presence:", userFilesUserID);
      setSelectedUserId(null);
    }
  }, [userFilesUserID, activeTab, roleName]);

  useEffect(() => {
    if (userFilesUserID && userName) {
      console.log("Setting activeTab to 'current' due to userFilesUserID presence:", userFilesUserID);
      setActiveTab("current");
      localStorage.setItem("activeTab", "current");
      setCurrentPath([]);
      setCurrentFolderId(0);
      localStorage.setItem("currentFolderId", "0");
      localStorage.removeItem("currentPath");
    }
  }, [userFilesUserID, userName]);

  // Fetches folder contents on mount and whenever the *context* changes (tab,
  // logged-in user, viewed user, or the admin's "assigned" user filter) - NOT
  // on every currentFolderId change. Every navigation action (folder click,
  // breadcrumb click, Back, Home) already calls fetchFolders(newId) itself;
  // having currentFolderId in this effect's deps too meant EVERY navigation
  // fired fetchFolders twice concurrently, and the two racing requests could
  // resolve out of order and leave stale/duplicated items on screen.
  useEffect(() => {
    console.log("Fetching folders for activeTab:", activeTab, "currentFolderId:", currentFolderId);
    fetchFolders(currentFolderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, personalInfo.userID, userFilesUserID, selectedUserId]);

  const fetchUsers = async (forModal = false) => {
    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}AuthMasterController/GetAllUsers?ClientId=dmsApp`
      );
      console.log("Users API Response:", response.data);
      if (response.data.success && response.data.data) {
        const filteredUsers = response.data.data
          .filter(
            user => user.roleName !== "Global Admin" && user.roleName !== "Administrator"
          )
          .map(user => ({
            userID: user.userID,
            value: user.userID,
            label: `${user.firstName} ${user.lastName} - ${user.email}`,
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            email: user.email || ""
          }));
        console.log("Filtered Users:", filteredUsers);
        if (forModal) {
          setModalUsers(filteredUsers);
          console.log("Set modalUsers:", filteredUsers);
        } else {
          setUsers(filteredUsers);
          if (filteredUsers.length > 0 && !selectedUserId) {
            setSelectedUserId(filteredUsers[0].userID);
            console.log("Initial Selected User ID:", filteredUsers[0].userID);
          }
        }
        if (filteredUsers.length === 0) {
          console.log("No users available after filtering");
          forModal ? setModalUsers([]) : setUsers([]);
          if (!forModal) setSelectedUserId(null);
        }
      } else {
        console.error("Failed to fetch users:", response.data.message);
        forModal ? setModalUsers([]) : setUsers([]);
        if (!forModal) setSelectedUserId(null);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      forModal ? setModalUsers([]) : setUsers([]);
      if (!forModal) setSelectedUserId(null);
      toast.error("Failed to load users for dropdown");
    }
  };

  // Guards against a slow, now-irrelevant fetchFolders response overwriting
  // the currently displayed folder. handleNavigateToFolder calls fetchFolders
  // directly AND currentFolderId changing re-triggers it via the effect below,
  // so two requests can be in flight; whichever resolves last used to win even
  // if it was for a folder the user has already navigated away from (e.g. a
  // slow parent-folder request landing after a fast, correctly-empty child
  // folder request). Only the response matching the most recently started
  // request is now allowed to update state.
  const fetchFoldersRequestIdRef = useRef(0);

  const fetchFolders = async (parentId) => {
    const requestId = ++fetchFoldersRequestIdRef.current;
    const accessType = Number(localStorage.getItem("accessType")) || null;
    console.log("=== Inside fetchFolders ===");
    console.log("Parent ID:", parentId, "Active Tab:", activeTab, "Access Type:", accessType, "Selected User ID:", selectedUserId, "PersonalInfo User ID:", personalInfo.userID, "UserFilesUserID:", userFilesUserID);

    try {
      if (!isLoading) {
        setIsLoading(true);
      }
      let url;
      let userIdToUse;

      if (userFilesUserID) {
        userIdToUse = userFilesUserID;
      } else if (activeTab === "assigned" && (roleName === "Administrator" || roleName === "Global Admin")) {
        userIdToUse = selectedUserId || personalInfo.userID;
      } else {
        userIdToUse = personalInfo.userID;
      }

      if (parentId === undefined || parentId === null) {
        parentId = 0;
      }

      // API selection logic
      if (userFilesUserID && parentId === 0) {
        url = `${config.DDA_API_API_URL}FolderData/GetAllFoldersByCreatedBy/${userIdToUse}`;
      } else if (parentId !== 0) {
        url = `${config.DDA_API_API_URL}FolderData/GetAllFilesAndFoldersByParentId/${parentId}`;
      } else if (activeTab === "current") {
        url = `${config.DDA_API_API_URL}FolderData/GetAllFoldersByCreatedBy/${userIdToUse}`;
      } else if (activeTab === "shared") {
        url = `${config.DDA_API_API_URL}FolderData/GetShareAccessDetailsByUser/${userIdToUse}`;
      } else if (activeTab === "assigned" && (roleName === "Administrator" || roleName === "Global Admin")) {
        url = `${config.DDA_API_API_URL}FolderData/GetAllFoldersByCreatedBy/${userIdToUse}`;
      }

      console.log("Fetching from URL:", url);
      const response = await axios.get(url);
      console.log("Folders API Response:", response.data);

      // A newer fetchFolders call has already started (e.g. the user clicked
      // into another folder while this request was still in flight) - drop
      // this now-stale response instead of letting it overwrite the view.
      if (requestId !== fetchFoldersRequestIdRef.current) {
        return;
      }

      if (response.data.success) {
        // Resolve "Created By" names from both user directories - GetAllUsers
        // (the primary user list used throughout the app) and GetAllEmpInfo
        // (a separate employee directory keyed by empId, which is the same
        // GUID space as userId/createdBy). Some createdBy values only exist
        // in one of the two, so merge both into a single lookup map instead
        // of relying on GetAllUsers alone.
        const [usersResponse, empInfoResponse] = await Promise.all([
          axios.get(`${config.DDA_API_API_URL}AuthMasterController/GetAllUsers?ClientId=dmsApp`),
          axios
            .get(`${config.DDA_API_API_URL}AuthMasterController/GetAllEmpInfo`)
            .catch((err) => {
              console.error("Error fetching GetAllEmpInfo:", err);
              return { data: { success: false, data: [] } };
            }),
        ]);
        console.log("Users API Response in fetchFolders:", usersResponse.data);

        const userMap = {};
        (usersResponse.data.data || []).forEach(user => {
          userMap[user.userID] = `${user.firstName} ${user.lastName}`;
        });
        // Fill in anything GetAllUsers didn't have, from GetAllEmpInfo (empId -> userId).
        if (empInfoResponse.data.success) {
          (empInfoResponse.data.data || []).forEach(emp => {
            if (!userMap[emp.empId]) {
              userMap[emp.empId] = `${emp.firstName} ${emp.lastName}`;
            }
          });
        }

        let foldersWithAccessType = (response.data.data || []).map(item => {
          const username = userMap[item.createdBy] || "Unknown User";
          const inferredDocType = item.docType || (item.fileId ? "Document" : item.folderId ? "Folder" : "Unknown");
          const inferredFolderOrFileId = item.folderOrFileId || item.fileId || item.folderId;
          const inferredName = item.foldeOrFileName || item.fileName || item.folderName;
          const inferredPath = item.serverFolderOrFilePath || item.serverFilePath || item.folderPath;

          return {
            ...item,
            docType: inferredDocType,
            folderOrFileId: inferredFolderOrFileId,
            foldeOrFileName: inferredName,
            serverFolderOrFilePath: inferredPath,
            accessType: parentId !== 0 ? accessType : item.accessType !== undefined ? item.accessType : null,
            username: username,
            fileCount: item.parentFolderFilesCount || item.parentFilesCount || item.folderFilesCount || 0,
            size: item.parentFolderSize || item.foldersize || item.size || 0,
          };
        });

        if (parentId === 0) {
          if (userFilesUserID || activeTab === "current") {
            foldersWithAccessType = foldersWithAccessType.filter(
              item => (
                item.docType === "Folder" &&
                item.createdBy === userIdToUse
              )
            );
          } else if (activeTab === "shared") {
            foldersWithAccessType = foldersWithAccessType.filter(
              item => (
                (item.docType === "Folder" || item.docType === "Document") &&
                item.createdBy !== userIdToUse &&
                item.accessType !== null &&
                // Deactivated shares (isActive === false) are only visible to
                // Global Admin; User and Administrator should not see them
                // in the Shared Files tab.
                (roleName === "Global Admin" || item.isActive !== false)
              )
            );
          } else if (activeTab === "assigned" && (roleName === "Administrator" || roleName === "Global Admin")) {
            foldersWithAccessType = foldersWithAccessType.filter(
              item => (
                item.docType === "Folder" &&
                item.authorizedUserId === personalInfo.userID &&
                item.authorizedUserId !== null &&
                (selectedUserId === null || item.createdBy === selectedUserId)
              )
            );
          }
        }

        // NEW: Filter out hidden folders for non-Global Admin users
        if (roleName !== "Global Admin") {
          foldersWithAccessType = foldersWithAccessType.filter(item => {
            // Only hide folders that have IsHide = true
            return item.isHide !== true;
          });
        }

        console.log("Setting folders state with:", foldersWithAccessType);
        // Re-check staleness once more - the GetAllUsers call above was also
        // awaited, giving another window for a newer request to have started.
        if (requestId !== fetchFoldersRequestIdRef.current) {
          return;
        }
        setFolders(foldersWithAccessType || []);
      } else {
        setFolders([]);
        console.error("Failed to fetch folders or files:", response.data.message);
        toast.error("Failed to fetch folders or files");
      }
    } catch (error) {
      if (requestId !== fetchFoldersRequestIdRef.current) {
        return;
      }
      console.error("Error fetching folders or files:", error);
      setFolders([]);
      toast.error("Error fetching folders or files");
    } finally {
      if (requestId === fetchFoldersRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleTabChange = useCallback(debounce((tab) => {
    if (userFilesUserID && tab !== "current") {
      console.log("Preventing tab change due to userFilesUserID presence");
      return;
    }

    if (activeTab === tab) {
      console.log("Same tab clicked, no action taken:", tab);
      return;
    }
    console.log("Switching to tab:", tab);
    setIsLoading(true);
    setActiveTab(tab);
    setCurrentPath([]);
    setCurrentFolderId(0);
    setFolders([]);
    localStorage.removeItem("currentPath");
    localStorage.removeItem("accessType");
    localStorage.setItem("activeTab", tab);
    localStorage.setItem("currentFolderId", "0");
    console.log("State after tab change - activeTab:", tab, "currentFolderId:", 0, "currentPath:", []);
  }, 300), [activeTab, userFilesUserID]);

  useEffect(() => {
    console.log("useEffect triggered - activeTab:", activeTab, "currentFolderId:", currentFolderId);
    if (!isLoading) {
      fetchFolders(currentFolderId);
    }
  }, [activeTab, currentFolderId, personalInfo.userID, userFilesUserID, selectedUserId]);

  useEffect(() => {
    const savedTab = localStorage.getItem("activeTab");
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  useEffect(() => {
    fetchActionMasters();
    localStorage.setItem("currentPath", JSON.stringify(currentPath));
    localStorage.setItem("currentFolderId", currentFolderId);
  }, [currentPath, currentFolderId]);

  useEffect(() => {
    const savedPath = JSON.parse(localStorage.getItem("currentPath")) || [];
    const savedFolderId = localStorage.getItem("currentFolderId") || "0";
    const savedTab = localStorage.getItem("activeTab") || "current";
    const savedViewType = localStorage.getItem("viewType") || "grid";

    console.log("Initial load - savedPath:", savedPath, "savedFolderId:", savedFolderId, "savedTab:", savedTab);
    setActiveTab(savedTab);
    setCurrentPath(savedPath);
    setCurrentFolderId(Number(savedFolderId));
    setIsGridView(savedViewType === "grid");
  }, []);

  // CLOSE SHARED ACCESS MODAL
  const handleCloseSharedAccessModal = () => {
    setShowSharedAccessModal(false);
    setSelectedItemForSharing(null);
    setSharedAccessList([]);
    setSharedAccessPaginationPage(1);
  };

  // Calculate total pages for shared access pagination
  const totalPagesSharedAccess = Math.ceil(sharedAccessTotalRecords / sharedAccessPaginationPageSize);

  return (
    <>
      <section className="content ">
        <div className="container-fluid">
          {(userFilesUserID && userName) && (
            <button className="back-button" onClick={() => navigate('/all-files')}>
              <FiArrowLeft className="back-icon" />
              <span>Back</span>
            </button>
          )}

          <div className="card ">
            <div className="card-header-custom">
              <ul className="nav nav-tabs card-title">
                <li className="nav-item">
                  <button
                    className={`nav-link text-sm ${activeTab === "current" ? "activetablight" : "activetabdark"}`}
                    onClick={() => handleTabChange("current")}
                  >
                    {roleName === "Global Admin" && userName && userFilesUserID ? (
                      <span>{userName} Files</span>
                    ) : (
                      <span>My Files</span>
                    )}
                  </button>
                </li>
                {!(roleName === "Global Admin" && userFilesUserID && userName) && (
                  <li className="nav-item">
                    <button
                      className={`nav-link text-sm ${activeTab === "shared" ? "activetablight" : "activetabdark"}`}
                      onClick={() => handleTabChange("shared")}
                    >
                      Shared Files
                    </button>
                  </li>
                )}
                {!(roleName === "Global Admin" && userFilesUserID && userName) && (roleName === "Administrator" || roleName === "Global Admin") && (
                  <li className="nav-item">
                    <button
                      className={`nav-link text-sm ${activeTab === "assigned" ? "activetablight" : "activetabdark"}`}
                      onClick={() => handleTabChange("assigned")}
                    >
                      <span>Assigned Folders</span>
                    </button>
                  </li>
                )}
              </ul>

              <div className="Folder-buttons">
                {/* ENABLE FOLDER CREATION FOR USER FILE VIEW */}
                {/* Also shown while browsing inside a Shared Files folder that this
                    user has Read/Write (2) or Read/Write/Download (3) access to. */}
                {(activeTab !== "shared" || hasSharedWriteAccess) && (
                  <>
                    <button className="dms-folder-button" onClick={() => setShowModal(true)}>
                      <FiFolderPlus className="icon" />
                      <span>Folder</span>
                    </button>

                    {currentFolderId !== 0 && (
                      <button className="dms-file-button" onClick={() => setShowFileModal(true)}>
                        <FiFilePlus className="icon" />
                        <span>File</span>
                      </button>
                    )}
                  </>
                )}

                {activeTab !== "shared" && (
                  <div className="storage-info">
                    {hasStorageData ? (
                      <>
                        <div className="storage-progress-bar">
                          <div
                            className="storage-progress-fill"
                            style={{
                              width: `${((storageInfo.totalStorage - storageInfo.availableStorage) /
                                storageInfo.totalStorage) *
                                100
                                }%`,
                            }}
                          ></div>
                        </div>
                        <div className="storage-progress-text">
                          <span className="available-value">{formatStorage(storageInfo.availableStorage)}</span> free of
                          <span className="total-value"> {formatStorage(storageInfo.totalStorage)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="storage-progress-text storage-not-allocated">
                        Storage limit not allocated for this user
                      </div>
                    )}
                  </div>
                )}

                <div className="folder-view-toggle-buttons">
                  <span
                    className={`toggle-view-button ${isGridView ? "active" : ""}`}
                    onClick={() => handleToggleView("grid")}
                  >
                    <HiViewGrid size={16} />
                  </span>
                  <span
                    className={`toggle-view-button mr-3  ${!isGridView ? "active" : ""}`}
                    onClick={() => handleToggleView("list")}
                  >
                    <HiViewList size={16} />
                  </span>
                </div>
              </div>
            </div>

            <div className="card-body-custom text-sm scroll-content-sub">
              <div className="folder-mainpath d-flex justify-content-between align-items-center">
                <ol className="folder-listofpath d-flex align-items-center">
                  <li className="folder-item-back">
                    {currentPath.length > 0 && (
                      <i
                        className="fas fa-arrow-left"
                        onClick={handleBack}
                        style={{ cursor: "pointer" }}
                      ></i>
                    )}
                  </li>
                  <li className="folder-item" onClick={handleHomeClick}>
                    <i
                      className="fas fa-home"
                      style={{ marginRight: "5px" }}
                    ></i> Home
                  </li>
                  {currentPath.map((crumb, index) => (
                    <li
                      key={crumb.folderId}
                      className={`folder-item ${crumb.folderId === currentFolderId
                        ? "breadcrumb-item-current"
                        : ""
                        }`}
                      onClick={() => handleBreadcrumbClick(crumb.folderId)}
                    >
                      {crumb.folderName}
                    </li>
                  ))}
                </ol>
                {activeTab === "assigned" && (roleName === "Administrator" || roleName === "Global Admin") && (
                  <div className="ms-auto">
                    <select
                      className="custom-select custom-select-sm"
                      value={selectedUserId || ""}
                      onChange={(e) => {
                        const newValue = e.target.value || null;
                        console.log("Selected User ID:", newValue);
                        setSelectedUserId(newValue);
                      }}
                    >
                      <option value="">All Users</option>
                      {users.map(user => (
                        <option key={user.userID} value={user.userID}>
                          {user.firstName} {user.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="mb-3"></div>
              {isLoading ? (
                <div className="folder-3d-container">
                  <div className="folder-new">
                    <div className="folder-tab"></div>
                    <div className="spinner-circle"></div>
                  </div>
                  <div className="loader-text">Loading folders...</div>
                </div>
              ) : (
                <div className={`folder-container ${isGridView ? "grid-view" : "list-view"}`}>
                  {folders && folders.length > 0 ? (
                    folders.map((item) => (
                      <div
                        key={
                          activeTab === "shared"
                            ? // Top-level items in the Shared Files tab come from
                            // GetShareAccessDetailsByUser and have a unique sdaId.
                            // But items INSIDE a shared folder (once navigated in)
                            // come from GetAllFilesAndFoldersByParentId instead,
                            // which has no sdaId at all - fall back to a
                            // type-prefixed file/folder id there so every item
                            // still gets a real, unique key.
                            item.sdaId !== undefined && item.sdaId !== null
                              ? `shared-${item.sdaId}`
                              : item.fileId
                                ? `shared-file-${item.fileId}`
                                : `shared-folder-${item.folderId || item.folderOrFileId}`
                            // File and folder IDs are separate auto-increment
                            // sequences in the DB, so a file and a folder can
                            // legitimately share the same numeric id (e.g.
                            // fileId 14 and folderId 14 in the same listing).
                            // The old key (item.fileId || item.folderId) could
                            // collide in that case, causing React to reuse the
                            // wrong item's DOM node/click-handler across
                            // re-renders - which looked like "the wrong
                            // file/folder" appearing after navigating. Prefix
                            // with the type so the two id spaces never collide.
                            : item.fileId
                              ? `file-${item.fileId}`
                              : `folder-${item.folderId}`
                        }
                        className={`folder ${roleName === "Global Admin" && item.isHide ? "folder-hidden-blur" : ""}`}
                        onClick={() => {
                          console.log("Item clicked:", item);
                          if (activeTab === "shared") {
                            if (item.docType === "Document" && (item.folderOrFileId || item.fileId)) {
                              handleViewItem(item);
                            } else if (item.docType === "Folder" && (item.folderOrFileId || item.folderId)) {
                              handleNavigateToFolder(item);
                            } else {
                              if ((item.folderOrFileId || item.fileId) && (item.serverFolderOrFilePath?.includes('.') || item.serverFilePath?.includes('.'))) {
                                console.log("View Fallback File:", { fileId: item.fileId, folderOrFileId: item.folderOrFileId });
                                handleViewItem(item);
                              } else if (item.folderOrFileId || item.folderId) {
                                console.log("View Fallback Folder:", { folderId: item.folderId, folderOrFileId: item.folderOrFileId });
                                handleNavigateToFolder(item);
                              } else {
                                console.warn("No valid docType or identifiers found", item);
                                toast.error("Cannot open item: Invalid data");
                              }
                            }
                          } else {
                            if (item.fileId && item.folderId) {
                              handleViewItem(item);
                            } else if (item.folderId) {
                              handleNavigateToFolder(item);
                            } else {
                              console.warn("No fileId or folderId present", item);
                              toast.error("Cannot open item: Invalid data");
                            }
                          }
                        }}
                      >
                        {item.isView === false && (
                          <span className="new-label">New</span>
                        )}

                        {/* SHOW HIDE BADGE FOR GLOBAL ADMIN */}
                        {roleName === "Global Admin" && item.isHide && (
                          <span className="hidden-badge">
                            <FiEyeOff size={12} /> Hidden
                          </span>
                        )}

                        {item.docType === "Document" && item.folderOrFileId ? (
                          <div className="file-icon">
                            {getFileIcon(item.foldeOrFileName)}
                          </div>
                        ) : item.docType === "Folder" && item.folderOrFileId ? (
                          <div className="folder-icon">
                            <div className="top" style={{ background: item.folderColor }}></div>
                            <div className="bottom" style={{ background: item.folderColor }}></div>
                          </div>
                        ) : item.fileId ? (
                          <div className="file-icon">
                            {getFileIcon(item.fileName)}
                          </div>
                        ) : item.folderId ? (
                          <div className="folder-icon">
                            <div className="top" style={{ background: item.folderColor }}></div>
                            <div className="bottom" style={{ background: item.folderColor }}></div>
                          </div>
                        ) : (
                          <span>Not Found</span>
                        )}

                        <div
                          className="title"
                          title={[
                            item.fileId || item.docType === "Document"
                              ? item.fileName || item.foldeOrFileName
                              : item.foldeOrFileName || item.folderName,
                            item.createdBy
                              ? activeTab === "shared"
                                ? `Shared by: ${item.username}`
                                : `Created by: ${item.username}`
                              : null,
                            activeTab === "shared"
                              ? `Shared on: ${formatDate(item.createdOn)}`
                              : `Created on: ${formatDate(item.createdOn)}`,
                            item.docType === "Document" || item.fileId
                              ? `Size: ${formatStorage(item.size)}`
                              : [
                                item.subFolderCount > 0
                                  ? `${item.subFolderCount} Subfolder${item.subFolderCount !== 1 ? "s" : ""}`
                                  : null,
                                item.fileCount > 0
                                  ? `${item.fileCount} File${item.fileCount !== 1 ? "s" : ""}`
                                  : null,
                                `Size: ${formatStorage(item.size)}`,
                              ]
                                .filter(Boolean)
                                .join(", "),
                          ]
                            .filter(Boolean)
                            .join(" | ")}
                        >
                          {item.fileId || item.docType === "Document"
                            ? item.fileName || item.foldeOrFileName
                            : isGridView
                              ? truncateText(item.foldeOrFileName || item.folderName, 8)
                              : item.foldeOrFileName || item.folderName}

                          <div
                            className="item-details text-muted"
                            style={{
                              fontSize: "0.7rem",
                              display: "flex",
                              flexDirection: isGridView ? "column" : "row",
                              gap: isGridView ? "2px" : "8px",
                            }}
                          >
                            {item.docType === "Document" || item.fileId ? (
                              <span>Size: {formatStorage(item.size)}</span>
                            ) : (item.docType === "Folder" || item.folderId) ? (
                              <>
                                {item.subFolderCount > 0 && (
                                  <span>
                                    {`${item.subFolderCount} Subfolder${item.subFolderCount !== 1 ? "s" : ""}`}
                                  </span>
                                )}
                                {isGridView ? null : item.subFolderCount > 0 && item.fileCount > 0 && <span>|</span>}
                                {item.fileCount > 0 && (
                                  <span>
                                    {`${item.fileCount} File${item.fileCount !== 1 ? "s" : ""}`}
                                  </span>
                                )}
                                {isGridView ? null : (item.subFolderCount > 0 || item.fileCount > 0) && <span>|</span>}
                                <span>Size: {formatStorage(item.size)}</span>
                              </>
                            ) : (
                              <span>No details available</span>
                            )}
                          </div>
                        </div>

                        <div className={`folder-options ${!isGridView ? "mr-5" : ""}`}>
                          <Menu
                            portal
                            menuButton={
                              <MenuButton
                                className="btn btn-link text-secondary p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                {!isGridView ? <BsThreeDots /> : <BsThreeDotsVertical />}
                              </MenuButton>
                            }
                          >
                            {actionMasters.length > 0 ? (
                              actionMasters.map((action) => {
                                // NEW: Add Hide/Unhide option for folders (Global Admin only)
                                if (roleName === "Global Admin" && item.folderId && (action.actionDesc === "Download" || action.actionDesc === "View")) {
                                  // Don't show standard folder actions that don't apply to hide/unhide UI
                                  if (action.actionDesc === "Download" && !item.folderId) return null;
                                  if (action.actionDesc === "View" && !item.folderId) return null;
                                }

                                if (hideActions(action.actionDesc, item.accessType)) {
                                  return null;
                                }

                                return (
                                  <MenuItem key={action.aId}>
                                    <button
                                      className="dropdown-item"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOptionSelect(action.actionDesc, item);
                                        setTimeout(() => {
                                          document.activeElement.blur();
                                        }, 0);
                                      }}
                                    >
                                      {action.actionDesc === "Share" ? "Share" : action.actionDesc}
                                    </button>
                                  </MenuItem>
                                );
                              })
                            ) : (
                              <MenuItem disabled>No actions available</MenuItem>
                            )}

                            {/* NEW: Add Hide/Unhide option for folders AND files (Global Admin only) */}
                            {roleName === "Global Admin" && (item.folderId || item.fileId || item.folderOrFileId) && (
                              <MenuItem>
                                <button
                                  className="dropdown-item"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOptionSelect(item.isHide ? "Unhide" : "Hide", item);
                                    setTimeout(() => {
                                      document.activeElement.blur();
                                    }, 0);
                                  }}
                                >
                                  {item.isHide ? "Unhide" : "Hide"}
                                </button>
                              </MenuItem>
                            )}

                            {/* View Sharing option - visible to Global Admin only */}
                            {roleName === "Global Admin" && (
                              <MenuItem>
                                <button
                                  className="dropdown-item"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOptionSelect("View Sharing", item);
                                    setTimeout(() => {
                                      document.activeElement.blur();
                                    }, 0);
                                  }}
                                >
                                  View Sharing
                                </button>
                              </MenuItem>
                            )}

                            {/* NEW: Version History / Access History - "My Files" tab, folders only.
                                This also covers the Global Admin "view a particular user's files"
                                page (?userFilesUserID=...), which reuses the "current" tab. */}
                            {/* Folders only - files/documents also carry a folderId
                                (their parent folder's id), so docType is the only
                                reliable way to tell a folder item from a file item. */}
                            {activeTab === "current" && item.docType === "Folder" && (
                              <>
                                <MenuItem>
                                  <button
                                    className="dropdown-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOptionSelect("Version History", item);
                                      setTimeout(() => {
                                        document.activeElement.blur();
                                      }, 0);
                                    }}
                                  >
                                    Version History
                                  </button>
                                </MenuItem>
                                <MenuItem>
                                  <button
                                    className="dropdown-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOptionSelect("Access History", item);
                                      setTimeout(() => {
                                        document.activeElement.blur();
                                      }, 0);
                                    }}
                                  >
                                    Access History
                                  </button>
                                </MenuItem>
                              </>
                            )}
                          </Menu>
                        </div>

                        <div className="mr-5">
                          {!isGridView ? (
                            <span>
                              <span className="heading-shared">
                                {activeTab === "shared" ? "Shared By :" : "Created By :"}
                              </span>{" "}
                              <span className="list-heading-shared">{item.username}</span>
                            </span>
                          ) : null}
                        </div>

                        <div>
                          {!isGridView ? (
                            <span>
                              <span className="heading-shared">
                                {activeTab === "shared" ? "Shared on :" : "Created On :"}
                              </span>{" "}
                              <span className="list-heading-shared">{formatDate(item.createdOn)}</span>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div>
                      {activeTab === "shared"
                        ? "No shared files or folders yet."
                        : "No files or folders. Upload or create to get started."}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* EXISTING MODALS - DOCUMENT VIEW */}
      {showDocumentModal && (
        <div className="document-view-modal">
          <div className="document-view-modal-body">
            <div className="document-view-modal-header">
              <h5 className="modal-title">Document View</h5>
              <button
                className="document-view-modal-close-button"
                onClick={() => {
                  setShowDocumentModal(false);
                  setModalContent(null);
                  setExcelData(null);
                  setIsFullScreen(false);
                  setZoom(1);
                }}
              >
                &times;
              </button>
            </div>

            <div className="document-view-modal-content">
              {modalContent ? (
                modalContent.endsWith(".pdf") ? (
                  <iframe
                    src={modalContent}
                    title="file-viewer"
                    className="document-view-frame"
                  />
                ) : modalContent.endsWith(".xlsx") ||
                  modalContent.endsWith(".xls") ? (
                  excelData ? (
                    <table className="document-view-table">
                      <thead>
                        <tr>
                          {excelData[0].map((header, index) => (
                            <th key={index}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {excelData.slice(1).map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>Loading Excel file...</p>
                  )
                ) : modalContent.endsWith(".txt") ? (
                  <pre className="document-view-text">{modalContent}</pre>
                ) : (
                  <div
                    ref={containerRef}
                    className="image-container"
                    style={{
                      position: "relative",
                      textAlign: "center",
                      maxHeight: "500px",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      ref={imageRef}
                      src={modalContent}
                      alt="Document"
                      className="document-view-image"
                      style={{
                        transform: `scale(${zoom})`,
                        transition: "transform 0.3s ease",
                        margin: "0 auto",
                        maxWidth: "100%",
                        maxHeight: "450px",
                        objectFit: "contain",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        display: "flex",
                        gap: "8px",
                      }}
                    >
                      {isFullScreen && (
                        <>
                          <button
                            onClick={handleZoomIn}
                            title="Zoom In"
                            style={iconBtnStyle}
                          >
                            <FiZoomIn />
                          </button>
                          <button
                            onClick={handleZoomOut}
                            title="Zoom Out"
                            style={iconBtnStyle}
                          >
                            <FiZoomOut />
                          </button>
                        </>
                      )}
                      <button
                        onClick={toggleFullScreen}
                        title={isFullScreen ? "Exit Fullscreen" : "View Fullscreen"}
                        style={iconBtnStyle}
                      >
                        {isFullScreen ? <FiMinimize /> : <FiMaximize />}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <p>No content to display</p>
              )}
            </div>

            <div className="document-view-modal-footer">
              <button
                className="document-view-close-btn"
                onClick={() => {
                  setShowDocumentModal(false);
                  setModalContent(null);
                  setExcelData(null);
                  setIsFullScreen(false);
                  setZoom(1);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXISTING MODALS - CREATE FOLDER */}
      {showModal && (
        <div className="create-folder-modal-overlay">
          <div className="create-folder-modal-content">
            <div className="create-folder-modal-header">
              <h5 className="create-folder-modal-title">
                {editMode ? "Edit Folder" : "Create New Folder"}
              </h5>
              <button
                className="create-folder-modal-close"
                onClick={() => {
                  setShowModal(false);
                  setSelectedUser("");
                  setUserError("");
                  setNewFolderName("");
                  setFolderNameError("");
                  setFolderColor("linear-gradient(to bottom, #ffeb75, #ffce3c)");
                  setEditMode(false);
                  setFolderToEdit(null);
                }}
              >
                ×
              </button>
            </div>

            <div className="create-folder-modal-body">
              {(roleName === "Administrator" || roleName === "Global Admin") && !editMode && (
                <>
                  <div className="form-group">
                    <label htmlFor="userSelect" className="form-label">
                      Select User (Optional)
                    </label>
                    <select
                      id="userSelect"
                      className={`form-control form-control-sm ${userError ? "is-invalid" : ""}`}
                      value={selectedUser}
                      onChange={(e) => {
                        setSelectedUser(e.target.value);
                        setUserError("");
                      }}
                    >
                      <option value="">Create as myself</option>
                      {modalUsers.map((user) => (
                        <option key={user.value} value={user.value}>
                          {user.label}
                        </option>
                      ))}
                    </select>
                    {userError && (
                      <div className="invalid-feedback">{userError}</div>
                    )}
                    <small className="create-folder-hint">
                      As an {roleName}, you can create folders for your own account or on behalf of an employee.
                    </small>
                  </div>
                </>
              )}
              <div className="form-group">
                <label htmlFor="folderNameInput" className="form-label">
                  Folder Name
                </label>
                <input
                  type="text"
                  id="folderNameInput"
                  className={`form-control ${folderNameError ? "is-invalid" : ""}`}
                  value={newFolderName}
                  onChange={(e) => {
                    setNewFolderName(e.target.value);
                    setFolderNameError("");
                  }}
                />
                {folderNameError && (
                  <div className="invalid-feedback">{folderNameError}</div>
                )}
              </div>
              <div className="form-group create-folder-color-group">
                <label htmlFor="folderColorInput" className="form-label">
                  Folder Color
                </label>
                <div className="color-grid">
                  {gradients.map((gradient, index) => (
                    <div
                      key={index}
                      className={`color-circle ${folderColor === gradient ? "selected" : ""}`}
                      style={{ background: gradient }}
                      onClick={() => setFolderColor(gradient)}
                    ></div>
                  ))}
                </div>
              </div>
            </div>

            <div className="create-folder-modal-footer">
              <button
                className="create-folder-btn cancel"
                disabled={isFolderSubmitting}
                onClick={() => {
                  setShowModal(false);
                  setSelectedUser("");
                  setUserError("");
                  setNewFolderName("");
                  setFolderNameError("");
                  setFolderColor("linear-gradient(to bottom, #ffeb75, #ffce3c)");
                  setEditMode(false);
                  setFolderToEdit(null);
                }}
              >
                Cancel
              </button>
              <button
                className="create-folder-btn primary"
                disabled={isFolderSubmitting}
                onClick={editMode ? handleUpdateFolder : handleCreateFolder}
              >
                {isFolderSubmitting ? (
                  <span className="folder-btn-loading">
                    <span className="folder-btn-spinner" />
                    {editMode ? "Updating..." : "Creating..."}
                  </span>
                ) : editMode ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXISTING MODALS - FILE UPLOAD */}
      {showFileModal && (
        <div className="file-upload-modal">
          <div className="file-upload-modal-body">
            <span className="file-upload-close-button" onClick={handleCloseFileModal}>
              ×
            </span>

            {editfileMode ? (
              <div className="row text-sm">
                <div className="form-group col-md-12">
                  <label htmlFor="FileName">
                    File Name<sup style={{ color: "red" }}>*</sup>
                  </label>
                  <div className="input-group input-ext">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      id="filename"
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="File Name"
                    />
                    <span className="input-group-text form-control-sm text-sm span-ext">
                      {fileExtension}
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-primary mt-3 float-end file-upload-button"
                  onClick={handleUpdateFileName}
                >
                  Update
                </button>
              </div>
            ) : (
              <div className="file-upload-box-wrapper">
                <div
                  className={`file-upload-box ${isDragging ? 'dragging' : ''} ${uploadError ? 'error' : ''}`}
                  onClick={handleBoxClick}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="file-upload-icon-text">
                    <FiUploadCloud size={20} color="#007bff" />
                    <span>
                      {isDragging ? 'Release to upload files' : 'Click or drag files to upload'}
                    </span>
                  </div>
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                </div>

                {storageError && (
                  <div className="file-upload-error">
                    <span>{storageError}</span>
                    <span>Please contact your system administrator to request additional storage.</span>
                  </div>
                )}
                {files.length > 0 && (
                  <div className="file-upload-grid">
                    {files.map((file, index) => (
                      <div key={index} className="file-upload-chip">
                        <span className="file-name" title={file.name}>
                          {file.name.length > 20 ? file.name.slice(0, 17) + "..." : file.name}
                        </span>
                        <span
                          className="file-delete"
                          onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                        >
                          ×
                        </span>
                      </div>
                    ))}
                    <div
                      className="file-upload-chip file-upload-delete-all"
                      onClick={() => setFiles([])}
                    >
                      <span>Delete All</span>
                    </div>
                  </div>
                )}
                {uploadError && (
                  <div className="file-upload-error" style={{ color: 'red', marginBottom: '8px' }}>
                    <span>{uploadError}</span>
                  </div>
                )}
                <button
                  className="mt-3 file-upload-button"
                  onClick={handleFileUpload}
                  disabled={storageError}
                >
                  Upload
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EXISTING MODALS - SHARE ACCESS */}
      {showShareModal && (
        <div className="modal-overlay">
          <div className="modal-content-custom-1">
            <div className="modal-header">
              <h5 className="modal-title">Share Access</h5>
              <button className="close" onClick={handleCloseShareModal}>
                &times;
              </button>
            </div>

            <div className="modal-body text-sm">
              <div className="form-group">
                <label htmlFor="accessType" className="form-label">
                  Access Type
                </label>
                <div className="d-flex">
                  <div className="mr-3">
                    <label className="d-flex align-items-center">
                      <input
                        type="radio"
                        value="1"
                        className="mr-1"
                        checked={selectedAccessType === "1"}
                        onChange={handleAccessTypeChange}
                      />
                      Read-only
                    </label>
                  </div>

                  <div className="mr-3">
                    <label className="d-flex align-items-center">
                      <input
                        type="radio"
                        value="2"
                        className="mr-1"
                        checked={selectedAccessType === "2"}
                        onChange={handleAccessTypeChange}
                      />
                      Read/Write
                    </label>
                  </div>

                  <div className="">
                    <label className="d-flex align-items-center">
                      <input
                        type="radio"
                        value="3"
                        className="mr-1"
                        checked={selectedAccessType === "3"}
                        onChange={handleAccessTypeChange}
                      />
                      Read/Write/Download
                    </label>
                  </div>
                </div>

                {accessTypeError && (
                  <p className="text-danger">Please select one access type option.</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="selectUsers">
                  Select Users or Cohort/Group
                </label>
                <CreatableSelect
                  isMulti
                  options={allOptions}
                  onChange={handleUserChange}
                  value={selectedUsers}
                  placeholder="Search & select users, a Cohort/Group, or add an email..."
                  classNamePrefix="custom-select-hide-icons"
                  onKeyDown={handleKeyDown}
                  components={{
                    Option: CustomOption,
                    MultiValue: CustomMultiValue,
                  }}
                />

                {userSelectionError && (
                  <p className="text-danger">Please select at least one user or cohort/group.</p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={handleCloseShareModal}
                disabled={isSharing}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleShare}
                disabled={isSharing}
              >
                {isSharing ? "Sharing..." : "Share"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW MODAL - SHARED ACCESS MANAGEMENT */}
      {showSharedAccessModal && (
        <div className="modal-overlay">
          <div className="modal-content-shared-access">
            <div className="modal-header">
              <h5 className="modal-title">
                Sharing Details - {selectedItemForSharing?.fileName || selectedItemForSharing?.folderName}
              </h5>
              <button className="close" onClick={handleCloseSharedAccessModal}>
                &times;
              </button>
            </div>

            <div className="modal-body text-sm shared-access-body">
              {sharedAccessLoading ? (
                <div className="text-center">
                  <p>Loading shared access details...</p>
                </div>
              ) : sharedAccessList.length > 0 ? (
                <>
                  <div className="table-responsive">
                    <table className="shared-access-table">
                      <thead>
                        <tr>
                          <th>Document Type</th>
                          <th>Name</th>
                          <th>Shared User</th>
                          <th>Access Type</th>
                          <th>Status</th>
                          <th>Shared By</th>
                          <th>Shared On</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sharedAccessList.map((access) => (
                          <tr key={access.sdaId}>
                            <td>{access.docType}</td>
                            <td title={access.folderOrFileName}>{truncateText(access.folderOrFileName, 15)}</td>
                            <td>{usersMap[access.accessUserId] || "Unknown User"}</td>
                            <td>
                              {ACCESS_TYPE_LABELS[access.accessType] ||
                                accessTypesMap[access.accessType] ||
                                `Type ${access.accessType}`}
                            </td>
                            <td>
                              <label className="shared-access-toggle">
                                <input
                                  type="checkbox"
                                  checked={access.isActive}
                                  onChange={() => handleToggleShareAccessStatus(access)}
                                />
                                <span className={`toggle-slider ${access.isActive ? "active" : ""}`}></span>
                              </label>
                            </td>
                            <td>{usersMap[access.createdBy] || "Unknown"}</td>
                            <td>
                              {access.createdOn ? new Date(access.createdOn).toLocaleString() : "-"}
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-danger-outline"
                                onClick={() => handleDeleteShareAccess(access.sdaId)}
                                title="Delete this shared access"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination for Shared Access */}
                  {totalPagesSharedAccess > 1 && (
                    <div className="shared-access-pagination">
                      <button
                        className="pagination-btn"
                        onClick={() => handleSharedAccessPageChange(sharedAccessPaginationPage - 1)}
                        disabled={sharedAccessPaginationPage === 1}
                      >
                        Previous
                      </button>
                      <span className="pagination-info">
                        Page {sharedAccessPaginationPage} of {totalPagesSharedAccess} ({sharedAccessTotalRecords} records)
                      </span>
                      <button
                        className="pagination-btn"
                        onClick={() => handleSharedAccessPageChange(sharedAccessPaginationPage + 1)}
                        disabled={sharedAccessPaginationPage === totalPagesSharedAccess}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center">
                  <p>No shared access records found.</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={handleCloseSharedAccessModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Folder Version History modal */}
      {showVersionHistoryModal && (
        <div className="modal-overlay">
          <div className="modal-content-shared-access">
            <div className="modal-header">
              <h5 className="modal-title">
                Version History - {versionHistoryFolderName}
              </h5>
              <button
                className="close"
                onClick={() => {
                  setShowVersionHistoryModal(false);
                  setVersionHistoryData([]);
                  setVersionHistoryFolderName("");
                }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body text-sm shared-access-body">
              {versionHistoryLoading ? (
                <div className="text-center">
                  <p>Loading version history...</p>
                </div>
              ) : versionHistoryData.length > 0 ? (
                <div className="version-history-timeline">
                  {versionHistoryData.map((version) => {
                    const changeTypeStyles = {
                      Created: "vh-badge-created",
                      Updated: "vh-badge-updated",
                      Renamed: "vh-badge-updated",
                      Moved: "vh-badge-updated",
                      FileAdded: "vh-badge-added",
                      FileRemoved: "vh-badge-removed",
                    };
                    const badgeClass = changeTypeStyles[version.changeType] || "vh-badge-default";

                    return (
                      <div className="version-history-item" key={version.versionId}>
                        <div className="version-history-marker">
                          <span className={`vh-badge ${badgeClass}`}>v{version.versionNumber}</span>
                        </div>
                        <div className="version-history-content">
                          <div className="version-history-header">
                            <span className={`vh-change-type ${badgeClass}`}>{version.changeType}</span>
                            <span className="version-history-date">
                              {new Date(version.modifiedOn).toLocaleString()}
                            </span>
                          </div>
                          <div className="version-history-folder-name">{version.folderName}</div>
                          {version.affectedItemName && (
                            <div className="version-history-affected-item">
                              File: <strong>{version.affectedItemName}</strong>
                            </div>
                          )}
                          {version.remarks && (
                            <div className="version-history-remarks">{version.remarks}</div>
                          )}
                          <div className="version-history-meta">
                            Modified by{" "}
                            <strong>{usersMap[version.modifiedBy] || version.modifiedBy || "Unknown"}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center">
                  <p>No version history found for this folder.</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => {
                  setShowVersionHistoryModal(false);
                  setVersionHistoryData([]);
                  setVersionHistoryFolderName("");
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Ownership + Access History modal */}
      {showAccessHistoryModal && (
        <div className="modal-overlay">
          <div className="modal-content-shared-access">
            <div className="modal-header">
              <h5 className="modal-title">
                Access History - {accessHistoryFolderName}
              </h5>
              <button
                className="close"
                onClick={() => {
                  setShowAccessHistoryModal(false);
                  setAccessHistoryData([]);
                  setAccessHistoryFolderName("");
                }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body text-sm shared-access-body">
              {accessHistoryLoading ? (
                <div className="text-center">
                  <p>Loading access history...</p>
                </div>
              ) : accessHistoryData.length > 0 ? (
                <div className="table-responsive">
                  <table className="table shared-access-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Owner / User</th>
                        <th>Action By</th>
                        <th>Action On</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessHistoryData.map((history) => {
                        const actionTypeStyles = {
                          OwnershipAssigned: "ah-badge-owner",
                          OwnershipTransferred: "ah-badge-owner",
                          AccessGranted: "ah-badge-granted",
                          AccessUpdated: "ah-badge-updated",
                          AccessRevoked: "ah-badge-revoked",
                          Modified: "ah-badge-modified",
                        };
                        const badgeClass = actionTypeStyles[history.actionType] || "ah-badge-default";

                        // Owner/User column: prefer newOwner, then accessUserId - whichever
                        // this particular log row actually carries (Modified rows carry
                        // neither, and simply describe a change with no owner/access target).
                        const ownerOrUserId = history.newOwner || history.accessUserId;
                        const ownerOrUserLabel = ownerOrUserId
                          ? usersMap[ownerOrUserId] || ownerOrUserId
                          : "-";

                        return (
                          <tr key={history.historyId}>
                            <td>
                              <span className={`ah-badge ${badgeClass}`}>{history.actionType}</span>
                            </td>
                            <td>{ownerOrUserLabel}</td>
                            <td>{usersMap[history.actionBy] || history.actionBy || "Unknown"}</td>
                            <td>{new Date(history.actionOn).toLocaleString()}</td>
                            <td>{history.remarks || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center">
                  <p>No access history found for this folder.</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => {
                  setShowAccessHistoryModal(false);
                  setAccessHistoryData([]);
                  setAccessHistoryFolderName("");
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default FolderCreation;