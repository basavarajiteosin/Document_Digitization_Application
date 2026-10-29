import React, { useState, useEffect, useRef } from "react";
import { useLocation } from 'react-router-dom';

import { toast } from "react-toastify";
import { ExcelRenderer } from "react-excel-renderer";
import { FaRegShareFromSquare } from "react-icons/fa6";
import { FaUserCircle } from 'react-icons/fa';
import { IoIosLogOut } from "react-icons/io";
import bmsLogoWipro from "../../assets/images/wiprologowhite.png";
import { HiViewGrid, HiViewList } from "react-icons/hi";
import { FiMaximize, FiMinimize, FiZoomIn, FiZoomOut } from "react-icons/fi";
import {
  FaEllipsisV,
  FaFileAlt,
  FaFilePdf,
  FaFileExcel,
  FaFileCsv,
  FaFileImage,
} from "react-icons/fa";
import { BsThreeDots } from "react-icons/bs";
import { BsThreeDotsVertical } from "react-icons/bs";
import { Menu, MenuItem, MenuButton } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";
import { useSelector } from "react-redux";

import CreatableSelect from "react-select/creatable";

import { TfiLayoutGrid4Alt } from "react-icons/tfi";
import { BsReverseListColumnsReverse } from "react-icons/bs";
import axios from "axios";
import { useUpload } from "../../Customhook/UploadContext";
const config = require("../../services/config.json");

const isValidEmail = (email) => {
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailPattern.test(email);
};
const ExternalUserAccess = () => {

  const location = useLocation();
  const [esaid, setEsaid] = useState(() => sessionStorage.getItem('esaid') || null);
  const [token, setToken] = useState(() => sessionStorage.getItem('token') || null);
  const [emailId, setEmailId] = useState(() => localStorage.getItem('emailId') || '');
  const [otp, setOtp] = useState('');
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [error, setError] = useState('');

  const formatStorage = (bytes) => {
    if (bytes === 0) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const esaidFromUrl = searchParams.get('ESAID');
    const tokenFromUrl = searchParams.get('token');
    const emailFromUrl = searchParams.get('EmailId');
    const isOtpVerified = sessionStorage.getItem('otpVerified');

    // Only set these if OTP has not been verified for this tab
    if (esaidFromUrl && tokenFromUrl && emailFromUrl && !isOtpVerified) {
      setEsaid(esaidFromUrl);
      setToken(tokenFromUrl);
      setEmailId(emailFromUrl);

      // Store in session storage for this tab
      sessionStorage.setItem('esaid', esaidFromUrl);
      sessionStorage.setItem('token', tokenFromUrl);
      localStorage.setItem('emailId', emailFromUrl); // Permanent data can still go in localStorage

      setShowOTPModal(true);  // Trigger OTP modal only for this tab
    }
  }, [location.search]);

  const checkTokenValidity = () => {
    axios.post(`${config.DDA_API_API_URL}FolderData/CheckValidityofToken`, {
      esaid,
      token,
      accessEmail: emailId,
    })
      .then(response => {
        if (response.status === 200 && response.data.success) {
          toast.success(response.data.message || "Token verified successfully.");
          setShowOtpInput(true);
        }
      })
      .catch(error => {
        const errorMsg = error.response?.data?.message || "Token is invalid. Please check your email and try again.";
        setError(errorMsg);
        toast.error(errorMsg);
      });
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (!emailId) {
      setError("Please enter your email address.");
      toast.error("Please enter your email address.");
      return;
    }
    checkTokenValidity();
  };

  const handleVerifyOtp = () => {
    axios.post(`${config.DDA_API_API_URL}FolderData/VerifytheDocAccessOtp`, {
      esaid,
      email: emailId,
      otp
    })
      .then(response => {
        if (response.status === 200 && response.data.success) {
          toast.success("OTP verified successfully. Access granted.");
          sessionStorage.setItem('otpVerified', 'true');
          setShowOTPModal(false);
        }
      })
      .catch(error => {
        const errorMsg = error.response?.data?.message || "Invalid OTP. Please try again.";
        setError(errorMsg);
        toast.error(errorMsg);
      });
  };

  const handleCloseOTPModal = () => {
    setShowOTPModal(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('otpVerified');
    setShowOTPModal(true);
  };

  useEffect(() => {
    const handleBeforeUnload = () => { };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  const [folders, setFolders] = useState([]);
  const [newFolderName, setNewFolderName] = useState("");

  const [folderColor, setFolderColor] = useState(
    "linear-gradient(to bottom, #ffeb75, #ffce3c)"
  );
  const [showModal, setShowModal] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(0);
  const [isGridView, setIsGridView] = useState(true);
  const personalInfo = useSelector((state) => state.personalInformationReducer);
  const [actionMasters, setActionMasters] = useState([]);
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
  const getFileIcon = (fileName) => {

    if (!fileName) {
      // If fileName is undefined, null, or empty, return a default icon (or handle it accordingly)
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

  //get method fro the Action master     
  const fetchActionMasters = async () => {
    try {
      const response = await axios.get(
        `${config.DDA_API_API_URL}FieldMaster/GetAllActionMasters`
      );
      if (response.data.success) {
        setActionMasters(response.data.data);
      } else {
        toast.error("Failed to fetch action masters");
      }
    } catch (error) {
      console.error("Error fetching action masters:", error);
      toast.error("Error fetching action masters");
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
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Folder name cannot be empty");
      return;
    }

    const isFolderExists = folders.some(
      (folder) =>
        folder.folderName === newFolderName &&
        folder.parentFolderId === currentFolderId
    );

    if (isFolderExists) {
      toast.error("Folder name already exists in this directory");
      return;
    }

    try {
      const newFolder = {
        folderName: newFolderName,
        folderColor: folderColor,
        createdBy: personalInfo.userID,
        parentFolderId: currentFolderId,
      };

      const apiUrl =
        currentFolderId === 0
          ? `${config.DDA_API_API_URL}FolderData/CreateFolder`
          : `${config.DDA_API_API_URL}FolderData/CreateSubFolder`;

      const response = await axios.post(apiUrl, newFolder);

      if (response.data.success) {
        toast.success("Folder created successfully");

        fetchFolders(currentFolderId);

        setNewFolderName("");
        setFolderColor("linear-gradient(to bottom, #ffeb75, #ffce3c)");
        setShowModal(false);
      } else {
        toast.error("Failed to create folder");
      }
    } catch (error) {
      toast.error("Error creating folder");
    }
  };


  const handleNavigateToFolder = (folder) => {
    const folderId = folder.folderOrFileId || folder.folderId;

    const folderName = folder.foldeOrFileName || folder.folderName;


    const accessType = folder.accessType || null;

    console.log("Folder clicked:", folderName);
    console.log("Folder ID:", folderId);
    console.log("Access Type:", accessType);


    setCurrentPath([...currentPath, { folderId, folderName, accessType }]);
    setCurrentFolderId(folderId);
    localStorage.setItem("currentFolderId", folderId);
    localStorage.setItem("accessType", accessType);

    // Log before fetching
    console.log("About to call fetchFolders with:", folderId, accessType);
    fetchFolders(folderId);
  };


  const handleToggleView = (viewType) => {
    setIsGridView(viewType === "grid");
    localStorage.setItem("viewType", viewType);
  };

  //logic for breadcrumb click
  const handleBreadcrumbClick = (folderId) => {
    const breadcrumbIndex = currentPath.findIndex(
      (p) => p.folderId === folderId
    );

    if (breadcrumbIndex !== -1) {
      const newPath = currentPath.slice(0, breadcrumbIndex + 1);
      setCurrentPath(newPath);

      setCurrentFolderId(folderId);
      localStorage.setItem("currentFolderId", folderId);
      fetchFolders(folderId);
    } else {
      toast.error("Folder not found");
    }
  };

  // handle back fucntionality
  const handleBack = () => {
    const newPath = currentPath.slice(0, -1);
    const newFolderId =
      newPath.length > 0 ? newPath[newPath.length - 1].folderId : 0;

    setCurrentPath(newPath);
    setCurrentFolderId(newFolderId);
    localStorage.setItem("currentFolderId", newFolderId);
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

  //when we click on home it wil be back to home parent folders
  const handleHomeClick = () => {
    setCurrentPath([]);
    setCurrentFolderId(0);
    // setFiles(null);
    // fetchFolders(null);
  };

  const [editMode, setEditMode] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState(null);
  const [editfileMode, setEditFileMode] = useState(false);
  const [fileToEdit, setfileToEdit] = useState(null);
  const [fileName, setFileName] = useState("");

  console.log("editfileMode:", editfileMode);

  const handleUpdateFileName = async () => {
    const formData = new FormData();
    formData.append("fileId", fileToEdit.fileId);
    formData.append("folderId", fileToEdit.folderId);
    formData.append("fileName", `${fileName}${fileExtension}`);
    // formData.append("fileName", `${fileName}`);
    // formData.append("fileName", fileName);
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

    try {
      const updatedFolder = {
        folderId: folderToEdit.folderId,
        folderName: newFolderName,
        folderPath: editfolderPath,
        folderColor: folderColor,
        parentFolderId: folderToEdit.parentFolderId,
        tags: folderToEdit.tags || "",
        createdBy: personalInfo.userID,
      };

      if (folderToEdit.parentFolderId === 0) {
        updatedFolder.serverFolderPath = folderToEdit.serverFolderPath;
      }

      const apiUrl = `${config.DDA_API_API_URL}FolderData/${folderToEdit.parentFolderId === 0 ? "UpdateFolder" : "SubUpdateFolder"
        }`;

      const response = await axios.post(apiUrl, updatedFolder);

      if (response.data.success) {
        toast.success("Folder updated successfully");

        fetchFolders(currentFolderId);
        setShowModal(false);
        setEditMode(false);
        setFolderToEdit(null);
      } else {
        toast.error("Failed to update folder");
      }
    } catch (error) {
      toast.error("Error updating folder");
    }
  };

  const [fileExtension, setFileExtension] = useState("");
  const [editfolderPath, SetEditfolderPath] = useState("");

  const handleOptionSelect = (option, item) => {
    if (option === "Download") {
      if (item.docType === "Document" && item.folderOrFileId) {
        console.log("Download Document:", {
          folderOrFileId: item.folderOrFileId,
        });
        handleDownloadFile(item.folderOrFileId);
      } else if (item.docType === "Folder" && item.folderOrFileId) {
        console.log("Download Folder:", {
          folderOrFileId: item.folderOrFileId,
        });
        handleDownloadFolder(item.folderOrFileId);
      } else {
        console.log("Fallback Download:", {
          fileId: item.fileId,
          folderId: item.folderId,
        });
        if (item.fileId) {
          handleDownloadFile(item.fileId);
        } else if (item.folderId) {
          handleDownloadFolder(item.folderId);
        }
      }
    } else if (option === "Delete") {
      if (item.docType === "Document" && item.folderOrFileId) {
        console.log("Delete Document:", {
          fileId: item.fileId,
          folderOrFileId: item.folderOrFileId,
        });
        deleteFile(item.folderOrFileId);
      } else if (item.docType === "Folder" && item.folderOrFileId) {
        console.log("Delete Folder:", {
          folderId: item.folderId,
          folderOrFileId: item.folderOrFileId,
        });
        deleteFolder(item.folderOrFileId, item.folderName);
      } else {
        console.log("Fallback Delete:", {
          fileId: item.fileId,
          folderId: item.folderId,
        });
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
    }
    else if (option === "Edit") {
      if (item.docType === "Document" && item.folderOrFileId) {
        setfileToEdit(item);
        const [name, extension] = item.fileName.split('.'); // Split name and extension
        setFileName(name); // Set base name
        setFileExtension(`.${extension}`); // Set extension
        setEditFileMode(true);
        // setFileName(item.fileName);
        setShowFileModal(true);
        console.log("Edit item", item);
      } else if (item.docType === "Folder" && item.folderOrFileId) {
        setFolderToEdit(item);
        setNewFolderName(item.foldeOrFileName);
        setFolderColor(
          item.folderColor || "linear-gradient(to bottom, #ffeb75, #ffce3c)"
        );
        SetEditfolderPath(item.folderOrFilePath)
        setEditMode(true);
        setShowModal(true);
      } else {
        if (item.fileId) {
          setfileToEdit(item);
          const [name, extension] = item.fileName.split('.'); // Split name and extension
          setFileName(name); // Set base name
          setFileExtension(`.${extension}`); // Set extension
          setEditFileMode(true);
          // setFileName(item.fileName);
          setShowFileModal(true);
          console.log("Edit item", item);
        } else if (item.folderId) {
          setFolderToEdit(item);
          setNewFolderName(item.folderName);
          SetEditfolderPath(item.folderPath)
          setFolderColor(
            item.folderColor || "linear-gradient(to bottom, #ffeb75, #ffce3c)"
          );
          setEditMode(true);
          setShowModal(true);
        }
      }
    }


    else if (option === "Share") {
      console.log("Item received:", item);
      setSelectedItem(item);
      console.log("selectred", selectedItem);

      setShowSubDropdown(false);

      setShowShareModal(true);
    }
  };



  // const [modalContent, setModalContent] = useState(""); // To hold the file or folder path
  // const [excelData, setExcelData] = useState(null); // State for Excel data

  // const handleOpenModal = (content) => {
  //     setModalContent(content); // Set the file or folder path to show
  //     const modal = new window.bootstrap.Modal(
  //         document.getElementById("fileViewModal")
  //     );
  //     modal.show(); // Show the modal

  //     if (content.endsWith(".xlsx") || content.endsWith(".xls")) {
  //         // Fetch the Excel file and parse it using ExcelRenderer
  //         fetch(content)
  //             .then((response) => response.blob())
  //             .then((blob) => {
  //                 const reader = new FileReader();
  //                 reader.onload = (e) => {
  //                     const data = e.target.result;
  //                     ExcelRenderer(data, (err, resp) => {
  //                         if (err) {
  //                             console.error("Error rendering excel file:", err);
  //                         } else {
  //                             setExcelData(resp.rows);
  //                         }
  //                     });
  //                 };
  //                 reader.readAsArrayBuffer(blob);
  //             })
  //             .catch((error) =>
  //                 console.error("Error fetching the Excel file:", error)
  //             );
  //     }
  // };


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
      if (!fs) setZoom(1); // Reset zoom on exit
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

    // Check if active tab is 'shared'
    if (activeTab === "shared") {
      if (item.docType === "Document" && item.folderOrFileId) {
        idToUse = item.folderOrFileId;
        filePath = item.serverFolderOrFilePath;
      } else if (item.docType === "Folder" && item.folderOrFileId) {
        idToUse = item.folderOrFileId;
        filePath = item.serverFolderOrFilePath;
      }
    }

    // Fallback: Use fileId or folderId
    if (!idToUse) {
      idToUse = item.fileId || item.folderId;
      filePath = item.serverFilePath;
    }

    console.log("Viewing Item Details:", { idToUse, filePath });

    // Check if it's a .txt file
    if (filePath && filePath.endsWith(".txt")) {
      window.open(filePath, "_blank"); // Open the text file in a new tab
    }
    // Check if it's an Excel file (.xlsx, .xls, or .csv)
    else if (
      filePath &&
      (filePath.endsWith(".xlsx") || filePath.endsWith(".xls") || filePath.endsWith(".csv"))
    ) {
      const link = document.createElement('a');
      link.href = filePath;
      link.download = filePath.split('/').pop(); // Get the file name from the path
      document.body.appendChild(link);
      link.click(); // Trigger the download
      document.body.removeChild(link); // Clean up the link element
    }
    // If it's not an Excel or .txt file, open the modal to display it
    else if (filePath) {
      handleOpenModal(filePath); // Pass filePath to open in modal for non-excel files
    } else {
      console.error("No valid file or folder path to view");
    }
  };

  const handleDownloadFile = async (fileId, folderOrFileId) => {
    const finalFileId = fileId || folderOrFileId; // Use folderOrFileId as fallback if fileId is undefined
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
  const [allowedExtensions, setAllowedExtensions] = useState([]);
  const { addUploadItems, updateUploadItem } = useUpload();

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
        toast.error("Error fetching document extensions");
      }
    };

    fetchAllowedExtensions();
  }, []);


  const handleFileChange = (event) => {
    if (!allowedExtensions || allowedExtensions.length === 0) {
      toast.error("File types are not ready yet. Please try again later.");
      return;
    }

    const selectedFiles = Array.from(event.target.files || []);
    const validFiles = [];
    const invalidFiles = [];

    selectedFiles.forEach((file) => {
      const fileExtension = `.${file.name.split(".").pop().toLowerCase()}`;
      if (allowedExtensions.includes(fileExtension)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      toast.error(`Invalid file(s) selected: ${invalidFiles.join(", ")}`);
    }

    setFiles(validFiles); // Ensure validFiles is always an array
  };

  // Uploads a single file to the existing CreateFiles API (unchanged endpoint/
  // payload) - each file gets its own progress entry in the shared, app-level
  // upload panel instead of one combined progress bar.
  const uploadSingleFileInBackground = async (queueItem, folderIdAtUploadTime) => {
    const formData = new FormData();
    formData.append("Files", queueItem.file);
    formData.append("FolderId", folderIdAtUploadTime);
    formData.append("CreatedBy", personalInfo.userID);

    try {
      const response = await axios.post(
        `${config.DDA_API_API_URL}FolderData/CreateFiles`,
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
        return { success: true };
      } else {
        updateUploadItem(queueItem.id, { status: "failed" });
        return { success: false };
      }
    } catch (error) {
      updateUploadItem(queueItem.id, { status: "failed" });
      return { success: false };
    }
  };

  // Kicks off background, non-blocking uploads - the external user can keep
  // browsing shared folders/files while these run. Progress shows in the same
  // small floating panel used across the app (see App.js / UploadStatusPanel).
  const handleFileUpload = async () => {
    if (files.length === 0) {
      return;
    }

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

    if (folderIdAtUploadTime === currentFolderId) {
      fetchFolders(currentFolderId);
    }
  };

  const fileInputRef = useRef(null);

  const handleBoxClick = () => {
    fileInputRef.current.click();
  };

  const handleCloseFileModal = () => {
    setShowFileModal(false);
    setFiles([]);
  };

  const [showSubDropdown, setShowSubDropdown] = useState(false);

  const hideActions = (actionDesc, accessType) => {
    // Get activeTab value from localStorage
    const activeTab = localStorage.getItem('activeTab');

    // Check for the existence of a token in localStorage
    const tokenExists = localStorage.getItem('token');

    // If a token exists, hide the "Delete" option
    if (tokenExists && (actionDesc === "Delete" || actionDesc === "Share" || actionDesc === "Edit")) {
      return true;
    }

    // If the active tab is "shared", hide the "Delete" option
    if (activeTab === "shared" && actionDesc === "Delete") {
      return true;
    }

    // Continue with the existing logic based on accessType
    if (accessType === 1) {
      return ["Edit", "Share", "Download", "Delete"].includes(actionDesc);
    } else if (accessType === 2) {
      return actionDesc === "Download";
    }

    // Show all actions if accessType === 3
    return false;
  };



  const [selectedItem, setSelectedItem] = useState(null);

  const [showShareModal, setShowShareModal] = useState(false);
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

  useEffect(() => {
    axios
      .get(
        `${config.DDA_API_API_URL}AuthMasterController/GetAllUsers?ClientId=DmsApp`
      )
      .then((response) => {
        const filteredUserOptions = response.data.data
          .filter((user) => user.userID !== personalInfo.userID)
          .map((user) => ({
            value: user.userID,
            label: `${user.firstName} ${user.lastName} - ${user.email}`,
          }));

        setUsers(filteredUserOptions);
      })
      .catch((error) => console.log(error));
  }, [personalInfo.userID]);

  const CustomOption = (props) => (
    <div className="custom-option option-style " {...props.innerProps}>
      <i className="fas fa-user-plus" style={{ marginRight: 10 }}></i>
      {props.data.label}
    </div>
  );

  const CustomMultiValue = (props) => (
    <div className="custom-multi-value multi-value-style">
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

  console.log(currentFolderId, "currentFolderId");

  const handleAccessTypeChange = (e) => {
    setSelectedAccessType(e.target.value);
  };

  const handleCloseShareModal = () => {
    resetForm(); // Reset the form fields
    setShowShareModal(false); // Close the modal
  };

  const handleShare = () => {
    console.log("parent");
    if (!selectedItem) {
      toast.error("No item selected");
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
      accessUserId: selectedUsers.map((user) => user.value),
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
        } else {
          toast.error(data.message || "Failed to share");
        }
      })
      .catch((error) => {
        const errorMessage =
          error.response?.data?.message || "Error sharing the item";
        toast.error(errorMessage);
      });
  };

  const [duplicateToastShown, setDuplicateToastShown] = useState(false);

  const allOptions = [{ value: "select-all", label: "Select All" }, ...users];

  // Function to handle the select change
  const handleUserChange = (selectedOptions) => {
    const existingUserValues = users.map((user) => user.value);
    const validSelectedUsers = [];
    const addedUserValues = new Set();
    let invalidUserAdded = false;

    // Check if "Select All" is selected
    const isSelectAllSelected = selectedOptions.some(
      (option) => option.value === "select-all"
    );

    // If "Select All" is selected, add all users
    if (isSelectAllSelected) {
      setSelectedUsers(users); // Select all users
      return;
    }

    // Process each selected option
    selectedOptions.forEach((option) => {
      const isExistingUser = existingUserValues.includes(option.value);
      const isValidNewUser =
        isValidEmail(option.value) &&
        !existingUserValues.includes(option.value);

      if (isExistingUser) {
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
    localStorage.getItem("activeTab") || "shared"
  );


  // const fetchFolders = async (parentId) => {
  //     // Retrieve accessType and token from localStorage
  //     const accessType = Number(localStorage.getItem("accessType"));
  //     const tokenExists = sessionStorage.getItem('token');
  //     const storedToken = tokenExists || null; // Get the token value for filtering
  //     let url;

  //     console.log("=== Inside fetchFolders ===");
  //     console.log("Parent ID:", parentId);
  //     console.log("Access Type (inside fetchFolders):", accessType);

  //     try {
  //         // Determine the URL based on the existence of parentId
  //         if (tokenExists) {
  //             url = `${config.DDA_API_API_URL}FolderData/GetShareAccessByEmailId/${emailId}`; // Call the external user API
  //         }

  //         // If a parentId is provided, fetch files and folders by parentId
  //         if (parentId !== null && parentId !== undefined && parentId !== 0) {
  //             url = `${config.DDA_API_API_URL}FolderData/GetAllFilesAndFoldersByParentId/${parentId}`;
  //         }

  //         console.log("Fetching from URL:", url); // Log the URL to check correctness

  //         // Make the API call
  //         const response = await axios.get(url);

  //         console.log("API Response:", response.data); // Log the response for validation

  //         // Check if the response is successful
  //         if (response.data.success) {
  //             const usersResponse = await axios.get(
  //                 `${config.DDA_API_API_URL}AuthMasterController/GetAllUsers?ClientId=DmsApp`
  //             );

  //             // Create a map of userID to full name
  //             const userMap = {};
  //             usersResponse.data.data.forEach(user => {
  //                 userMap[user.userID] = `${user.firstName} ${user.lastName}`;
  //             });

  //             // Map through the fetched data to include accessType and username
  //             const foldersWithAccessType = response.data.data
  //                 .filter(item => {
  //                     // Apply token match filtering only when parentId is zero
  //                     if (parentId === 0) {
  //                         return item.token === storedToken; // Filter based on token match
  //                     }
  //                     return true; // Include all items when parentId is valid
  //                 })
  //                 .map(item => {
  //                     // Determine the username based on createdBy
  //                     const username = userMap[item.createdBy] || "Unknown User"; // Default to "Unknown User" if not found

  //                     return {
  //                         ...item,
  //                         accessType: (parentId !== null && parentId !== undefined && parentId !== 0)
  //                             ? accessType // Set accessType from localStorage
  //                             : item.accessType !== undefined ? item.accessType : null, // Default to fetched accessType
  //                         username: username // Add username to the folder data
  //                     };
  //                 });

  //             setFolders(foldersWithAccessType);
  //             console.log(foldersWithAccessType, "data of folders with access type and username");
  //         } else {
  //             toast.error("Failed to fetch folders or files");
  //         }
  //     } catch (error) {
  //         console.error("Error fetching folders or files:", error);
  //         toast.error("Error fetching folders or files");
  //     } finally {
  //         // hideLoader(); // Hide loader after the API call is done
  //     }
  // };

  const fetchFolders = async (parentId) => {
    const accessType = Number(localStorage.getItem("accessType"));
    const tokenExists = sessionStorage.getItem("token");
    const storedToken = tokenExists || null;
    let url;

    console.log("=== Inside fetchFolders ===");
    console.log("Parent ID:", parentId);
    console.log("Access Type (inside fetchFolders):", accessType);

    try {
      if (tokenExists) {
        url = `${config.DDA_API_API_URL}FolderData/GetShareAccessByEmailId/${emailId}`;
      }

      if (parentId !== null && parentId !== undefined && parentId !== 0) {
        url = `${config.DDA_API_API_URL}FolderData/GetAllFilesAndFoldersByParentId/${parentId}`;
      }

      console.log("Fetching from URL:", url);

      const response = await axios.get(url);

      console.log("API Response:", response.data);

      if (response.data.success) {
        const usersResponse = await axios.get(
          `${config.DDA_API_API_URL}AuthMasterController/GetAllUsers?ClientId=DmsApp`
        );

        const userMap = {};
        usersResponse.data.data.forEach((user) => {
          userMap[user.userID] = `${user.firstName} ${user.lastName}`;
        });

        const foldersWithAccessType = response.data.data
          .filter((item) => {
            if (parentId === 0) {
              return item.token === storedToken;
            }
            return true;
          })
          .map((item) => {
            const username = userMap[item.createdBy] || "Unknown User";
            return {
              ...item,
              accessType:
                parentId !== null && parentId !== undefined && parentId !== 0
                  ? accessType
                  : item.accessType !== undefined
                    ? item.accessType
                    : null,
              username: username,
              subFolderCount: item.subFoldersCount || item.subFolderCount || 0, // Normalize subfolder count
              fileCount: item.folderFilesCount || 0, // Normalize file count
              size: item.folderSize || item.foldersize || item.size || 0, // Normalize size
            };
          });

        setFolders(foldersWithAccessType);
        console.log(foldersWithAccessType, "data of folders with access type and username");
      } else {
        toast.error("Failed to fetch folders or files");
      }
    } catch (error) {
      console.error("Error fetching folders or files:", error);
      // toast.error("Error fetching folders or files");
    } finally {
      // hideLoader();
    }
  };

  useEffect(() => {
    fetchFolders(currentFolderId);
  }, [currentFolderId]);



  useEffect(() => {
    const savedPath = JSON.parse(localStorage.getItem("currentPath")) || [];
    const savedFolderId = localStorage.getItem("currentFolderId") || 0;

    setCurrentPath(savedPath);
    setCurrentFolderId(Number(savedFolderId));

    fetchFolders(Number(savedFolderId));

    const savedViewType = localStorage.getItem("viewType");
    if (savedViewType) {
      setIsGridView(savedViewType === "grid");
    }
  }, []);

  useEffect(() => {
    fetchActionMasters();
    localStorage.setItem("currentPath", JSON.stringify(currentPath));
    localStorage.setItem("currentFolderId", currentFolderId);
  }, [currentPath, currentFolderId]);




  // Get the first letter from the emailId and capitalize it
  const firstLetter = emailId.charAt(0).toUpperCase();



  return (
    <>
      <section className="content ">
        <div className="container-fluid">
          <div className="">


            <div className="card-body-custom text-sm scroll-content-sub">
              <div className="folder-mainpath d-flex justify-content-between align-items-center external-page rounded-sm">
                <div className="ml-2">
                  <a
                    href="#"
                    className="brand-link d-flex flex-coloumn "
                  // onClick={headerLogoClickHandler}
                  >
                    <img src={bmsLogoWipro} alt="Iteos Logo" className="img-fluid" style={{ width: "50px", height: "40px" }} />
                    {/* <span className="mt-1">WEL MASTER REPOSITORY</span> */}
                  </a>

                </div>

                <div className="folder-customise-buttons d-flex p-2">




                  <div className="d-flex mr-2">

                    <div className="email-container mr-3">
                      <button className="btn custom-green text-white btn-sm rounded-circle text-sm mr-2" style={{ width: "30px" }}>
                        {/* {firstLetter} */}T
                      </button>
                      {/* <span className="email-id-text text-sm text-bold">{emailId}</span> */}
                      <span className="email-id-text text-sm ">{emailId}</span>
                    </div>


                    <button
                      className="btn text-white btn-sm border-white rounded-circle"
                      style={{ width: "32px" }}
                      onClick={handleLogout}
                      title="Logout" // This will show the tooltip on hover
                    >
                      <IoIosLogOut className="me-1 " /> {/* Add icon with margin on the right */}
                    </button>

                  </div>


                </div>



              </div>
              <div className="d-flex align-items-center justify-content-between mt-2">
                <ol className="folder-listofpath d-flex align-items-center ">
                  <li className="folder-item-back">
                    {currentPath.length > 0 && (
                      <i
                        className="fas fa-arrow-left ml-2"
                        onClick={handleBack}
                        style={{ cursor: "pointer" }}
                      ></i>
                    )}
                  </li>

                  <li className="folder-item" onClick={handleHomeClick}>
                    <i
                      className="fas fa-home"
                      style={{ marginRight: "5px" }}
                    ></i>{" "}
                    Home
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
                <div className="view-toggle-buttons">
                  <button
                    className={`btn btn-sm ${isGridView ? "btn-primary" : "btn-outline-primary"} mr-1`}
                    onClick={() => handleToggleView("grid")}
                    title="Grid View"
                  >
                    <HiViewGrid size={20} />
                  </button>
                  <button
                    className={`btn btn-sm ${!isGridView ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => handleToggleView("list")}
                    title="List View"
                  >
                    <HiViewList size={20} />
                  </button>
                </div>
              </div>

              <div className="d-flex justify-content-between mb-3"></div>
              <div className={`folder-container card-body-custom ${isGridView ? "grid-view" : "list-view"}`}>
                {folders.length > 0 ? (
                  folders.map((item) => (
                    <div
                      key={item.folderOrFileId || item.fileId || item.folderId}
                      className="folder"
                      onClick={() => {
                        if (item.docType === "Document" ? item.folderOrFileId : item.fileId) {
                          handleViewItem(item);
                        } else if (item.docType === "Folder" ? item.folderOrFileId : item.folderId) {
                          handleNavigateToFolder(item);
                        } else {
                          console.warn("No valid docType found", item.docType);
                        }
                      }}
                    >
                      {item.isView === false && (
                        // Only show "New" tag for top-level items
                        (
                          (item.docType === "Folder" && item.fileExistFolId === 0) ||
                          (item.docType === "Document" && item.fileExistFolId === 0)
                        ) ? (
                          <span className="new-label">New</span>
                        ) : null
                      )}

                      {item.docType === "Document" && item.folderOrFileId ? (
                        <div className="file-icon">{getFileIcon(item.foldeOrFileName)}</div>
                      ) : item.docType === "Folder" && item.folderOrFileId ? (
                        <div className="folder-icon">
                          <div className="top" style={{ background: item.folderColor }}></div>
                          <div className="bottom" style={{ background: item.folderColor }}></div>
                        </div>
                      ) : item.fileId ? (
                        <div className="file-icon">{getFileIcon(item.fileName)}</div>
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
                            ? item.foldeOrFileName || item.fileName
                            : item.foldeOrFileName || item.folderName || "Unknown",
                          `Shared by: ${item.username || "Unknown"}`,
                          `Shared on: ${formatDate(item.createdOn) || "Unknown"}`,
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
                          ? item.foldeOrFileName || item.fileName
                          : isGridView
                            ? truncateText(item.foldeOrFileName || item.folderName || "Unknown", 8)
                            : item.foldeOrFileName || item.folderName || "Unknown"}

                        <div
                          className="item-details text-muted"
                          style={{
                            fontSize: "0.8rem",
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
                        </Menu>
                      </div>

                      <div className="mr-5">
                        {!isGridView ? (
                          <span>
                            <span className="heading-shared">Shared By :</span>
                            <span className="list-heading-shared">{" "}{item.username}</span>
                          </span>
                        ) : null}
                      </div>

                      <div>
                        {!isGridView ? (
                          <span>
                            <span className="heading-shared">Shared on :</span>
                            <span className="list-heading-shared">{" "}{formatDate(item.createdOn)}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div>No files or folders.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

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

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content-2">
            <div className="modal-header">
              <h5 className="modal-title">
                {editMode ? "Edit Folder" : "Create New Folder"}
              </h5>
              <button className="close" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="folderNameInput" className="form-label">
                  Folder Name
                </label>
                <input
                  type="text"
                  id="folderNameInput"
                  className="form-control"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                />
              </div>
              <div className="form-group mb-3">
                <label htmlFor="folderColorInput" className="form-label">
                  Folder Color
                </label>
                <div className="color-grid">
                  {gradients.map((gradient, index) => (
                    <div
                      key={index}
                      className={`color-circle ${folderColor === gradient ? "selected" : ""
                        }`}
                      style={{ background: gradient }}
                      onClick={() => setFolderColor(gradient)}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={editMode ? handleUpdateFolder : handleCreateFolder}
              >
                {editMode ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFileModal && (
        <div className="modal-overlay">
          <div className="modal-content-2">
            <span
              className="close"
              onClick={handleCloseFileModal}
              style={{ cursor: "pointer" }}
            >
              &times;
            </span>
            {editfileMode ? (

              <div className="row text-sm">
                <div className="form-group file-Edit col-md-12">
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
                    <span className="input-group-text form-control-sm text-sm span-ext">{fileExtension}</span> {/* Display extension */}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-primary mt-3 float-end"
                  onClick={handleUpdateFileName}
                >
                  Update
                </button>
              </div>
            ) : (
              <div className="file-uploader">
                <div className="file-box" onClick={handleBoxClick}>
                  <span>Choose files</span>
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                </div>
                <div className="file-count">
                  {files.length > 0
                    ? `${files.length} file(s) selected`
                    : "No files selected"}
                </div>
                <button
                  className="btn btn-sm btn-primary mt-3"
                  onClick={handleFileUpload}
                  disabled={files.length === 0}
                >
                  Upload
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
              {/* Access Type - Replaced Select dropdown with checkboxes */}
              <div className="form-group">
                <label htmlFor="accessType" className="form-label">
                  Access Type
                </label>
                <div className="d-flex">
                  <div className="mr-3">
                    <label className="d-flex align-items-center">
                      <input
                        type="radio"
                        value="1" // Send 1 for "Read-only"
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
                        value="2" // Send 2 for "Read/Write"
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
                        value="3" // Send 3 for "Read/Write/Download"
                        className="mr-1"
                        checked={selectedAccessType === "3"}
                        onChange={handleAccessTypeChange}
                      />
                      Read/Write/Download
                    </label>
                  </div>
                </div>
              </div>


              <div className="form-group">
                <label htmlFor="selectUsers">Select Users</label>
                <CreatableSelect
                  isMulti
                  // options={users} // You can fetch the list of users from your backend
                  options={allOptions} // Use the allOptions including "Select All"
                  onChange={handleUserChange}
                  value={selectedUsers}
                  placeholder="Search & Select or add an email..."
                  classNamePrefix="custom-select-hide-icons"
                  onKeyDown={handleKeyDown}
                  components={{
                    Option: CustomOption,
                    MultiValue: CustomMultiValue,
                  }}
                />
              </div>

              <div className="row">

              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={handleCloseShareModal}
              >
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleShare}>
                Share
              </button>
            </div>
          </div>
        </div>
      )}
      <>
        {/* Bootstrap Modal */}
        {showOTPModal && (
          <div className={`modal show`} style={{ display: 'block' }} tabIndex="-1" role="dialog">
            <div className="modal-dialog" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{showOtpInput ? "Enter OTP" : "Verify Your Email"}</h5>
                  <button type="button" className="btn-close" onClick={handleCloseOTPModal} aria-label="Close"></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={showOtpInput ? handleVerifyOtp : handleEmailSubmit}>
                    <div className="mb-3">
                      <label htmlFor="email" className="form-label">Email address</label>
                      <input type="email" className="form-control form-control-sm" id="email" value={emailId} readOnly />
                    </div>
                    {showOtpInput && (
                      <div className="mb-3">
                        <label htmlFor="otp" className="form-label">OTP</label>
                        <input type="text" className="form-control form-control-sm" id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter OTP" />
                      </div>
                    )}
                    {error && <p className="text-danger">{error}</p>}
                  </form>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-sm btn-primary" onClick={showOtpInput ? handleVerifyOtp : handleEmailSubmit}>
                    {showOtpInput ? "Verify OTP" : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Backdrop for modal */}
        {showOTPModal && <div className="modal-backdrop fade show"></div>}
      </>
    </>
  );
};

export default ExternalUserAccess;