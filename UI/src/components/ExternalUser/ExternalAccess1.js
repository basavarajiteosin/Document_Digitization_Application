import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { ExcelRenderer } from "react-excel-renderer";
import { Menu, MenuItem, MenuButton } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";
import { useSelector } from "react-redux";
import CreatableSelect from "react-select/creatable";
import axios from "axios";
import {
  FiGrid, FiList, FiSearch, FiLogOut, FiHome, FiArrowLeft, FiMoreVertical, FiX, FiMaximize,
  FiMinimize, FiZoomIn, FiZoomOut, FiFolderPlus, FiUploadCloud, FiMail, FiShield, FiArrowUp,
  FiArrowDown, FiFolder, FiLock,
} from "react-icons/fi";
import {
  FaFileAlt, FaFilePdf, FaFileExcel, FaFileCsv, FaFileImage, FaFileWord, FaFilePowerpoint,
} from "react-icons/fa";
import bmsLogoWipro from "../../assets/images/wiprologowhite.png";
import { useUpload } from "../../Customhook/UploadContext";
import UniversalDocumentEditor from "../DocumentEditor/UniversalDocumentEditor";
import { isEditorSupported } from "../../services/editorConfigService";
import "./externalAccess.css";

const config = require("../../services/config.json");
const API = config.DDA_API_API_URL;
const DEFAULT_COLOR = "linear-gradient(to bottom, #ffeb75, #ffce3c)";
const GRADIENTS = [
  "linear-gradient(to bottom, #ffeb75, #ffce3c)", "linear-gradient(to bottom, #b0b7ba, #9b9b9b)",
  "linear-gradient(to bottom, #e73e29, #b72d1b)", "linear-gradient(to bottom, #fedad5, #f4a64d)",
  "linear-gradient(to bottom, #ee7110, #c95d00)", "linear-gradient(to bottom, #3f9f4a, #2d6a36)",
  "linear-gradient(to bottom, #8ed290, #6fb773)", "linear-gradient(to bottom, #27938e, #1e7a72)",
  "linear-gradient(to bottom, #1e84d0, #126b9f)", "linear-gradient(to bottom, #86c8f7, #5faed9)",
  "linear-gradient(to bottom, #9a61c7, #7d4ba3)", "linear-gradient(to bottom, #cc53b4, #a73a8c)",
];
const ACCESS_LABEL = { 1: "Read-only", 2: "Read/Write", 3: "Read/Write/Download" };

const isValidEmail = (e) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e);

const formatStorage = (bytes) => {
  bytes = Number(bytes) || 0;
  if (bytes === 0) return "0 KB";
  const k = 1024, s = ["Bytes", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), 3);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${s[i]}`;
};

const formatDate = (d) => {
  if (!d) return "-";
  const ist = new Date(new Date(d).getTime() + 5.5 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  let h = ist.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = p(h % 12 || 12);
  return `${p(ist.getDate())}-${p(ist.getMonth() + 1)}-${ist.getFullYear()} ${h}:${p(ist.getMinutes())} ${ap}`;
};

const fileIcon = (name, size = 28) => {
  const ext = (name || "").split(".").pop().toLowerCase();
  const map = {
    pdf: [FaFilePdf, "#d13438"], xlsx: [FaFileExcel, "#217346"], xls: [FaFileExcel, "#217346"],
    csv: [FaFileCsv, "#0288d1"], doc: [FaFileWord, "#2b579a"], docx: [FaFileWord, "#2b579a"],
    ppt: [FaFilePowerpoint, "#c43e1c"], pptx: [FaFilePowerpoint, "#c43e1c"],
    png: [FaFileImage, "#f57c00"], jpg: [FaFileImage, "#f57c00"], jpeg: [FaFileImage, "#f57c00"], svg: [FaFileImage, "#f57c00"],
  };
  const [Icon, color] = map[ext] || [FaFileAlt, "#64748b"];
  return <Icon size={size} color={color} />;
};

// normalise the different row shapes returned by the shared / parent-id APIs
const norm = (it) => {
  const isDoc = it.docType ? it.docType === "Document" : !!it.fileId;
  return {
    ...it,
    _isDoc: isDoc,
    _id: it.folderOrFileId ?? (isDoc ? it.fileId : it.folderId),
    _name: it.foldeOrFileName || it.fileName || it.folderName || "Unknown",
    _path: it.serverFolderOrFilePath || it.serverFilePath || it.folderPath,
  };
};

const ExternalUserAccess = () => {
  const location = useLocation();
  const personalInfo = useSelector((s) => s.personalInformationReducer);
  const { enqueueUploads } = useUpload();
  const isExternal = !personalInfo.userID; // external users have no application login

  /* ---------------- verification (OTP) ---------------- */
  const [esaid, setEsaid] = useState(() => sessionStorage.getItem("esaid") || null);
  const [token, setToken] = useState(() => sessionStorage.getItem("token") || null);
  const [emailId, setEmailId] = useState(() => localStorage.getItem("emailId") || "");
  const [otp, setOtp] = useState("");
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [error, setError] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const e = sp.get("ESAID"), t = sp.get("token"), m = sp.get("EmailId");
    if (e && t && m && !sessionStorage.getItem("otpVerified")) {
      setEsaid(e); setToken(t); setEmailId(m);
      sessionStorage.setItem("esaid", e);
      sessionStorage.setItem("token", t);
      localStorage.setItem("emailId", m);
      setShowOTPModal(true);
    }
  }, [location.search]);

  const checkTokenValidity = () => {
    setOtpBusy(true);
    axios.post(`${API}FolderData/CheckValidityofToken`, { esaid, token, accessEmail: emailId })
      .then((r) => {
        if (r.status === 200 && r.data.success) {
          toast.success(r.data.message || "Token verified successfully.");
          setShowOtpInput(true);
          setError("");
        }
      })
      .catch((err) => {
        const msg = err.response?.data?.message || "Token is invalid. Please check your email and try again.";
        setError(msg); toast.error(msg);
      })
      .finally(() => setOtpBusy(false));
  };

  const handleEmailSubmit = (e) => {
    e && e.preventDefault();
    if (!emailId) { setError("Please enter your email address."); toast.error("Please enter your email address."); return; }
    checkTokenValidity();
  };

  const handleVerifyOtp = (e) => {
    e && e.preventDefault();
    if (!otp.trim()) { setError("Please enter the OTP."); return; }
    setOtpBusy(true);
    axios.post(`${API}FolderData/VerifytheDocAccessOtp`, { esaid, email: emailId, otp })
      .then((r) => {
        if (r.status === 200 && r.data.success) {
          toast.success("OTP verified successfully. Access granted.");
          sessionStorage.setItem("otpVerified", "true");
          setError(""); setOtp(""); setShowOtpInput(false);
          setShowOTPModal(false);
        }
      })
      .catch((err) => {
        const msg = err.response?.data?.message || "Invalid OTP. Please try again.";
        setError(msg); toast.error(msg);
      })
      .finally(() => setOtpBusy(false));
  };

  const handleLogout = () => {
    sessionStorage.removeItem("otpVerified");
    setFolders([]); setCurrentPath([]); setCurrentFolderId(0);
    setShowOtpInput(false); setOtp(""); setError("");
    setShowOTPModal(true);
  };

  useEffect(() => {
    const h = () => { };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  /* ---------------- library state ---------------- */
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState(() => { try { return JSON.parse(localStorage.getItem("currentPath")) || []; } catch { return []; } });
  const [currentFolderId, setCurrentFolderId] = useState(() => Number(localStorage.getItem("currentFolderId")) || 0);
  const [isGridView, setIsGridView] = useState(() => localStorage.getItem("viewType") !== "list");
  const [actionMasters, setActionMasters] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const reqRef = useRef(0);

  const last = currentPath[currentPath.length - 1];
  const ctxAccess = last ? Number(last.accessType) || null : null;
  const ctxOwner = last ? last.ownerId : null;
  const canWriteHere = !isExternal && currentFolderId !== 0 && (ctxAccess === 2 || ctxAccess === 3);

  const fetchFolders = useCallback(async (parentId) => {
    const pid = parentId ?? 0;
    const rid = ++reqRef.current;
    const accessType = Number(localStorage.getItem("accessType")) || null;
    const tk = sessionStorage.getItem("token");
    let url = null;
    if (pid) url = `${API}FolderData/GetAllFilesAndFoldersByParentId/${pid}`;
    else if (tk) url = `${API}FolderData/GetShareAccessByEmailId/${encodeURIComponent(emailId)}`;
    if (!url) { setFolders([]); return; }
    setLoading(true);
    try {
      const res = await axios.get(url);
      if (rid !== reqRef.current) return;
      if (!res.data.success) { toast.error("Failed to fetch folders or files"); return; }
      const userMap = {};
      try {
        const u = await axios.get(`${API}AuthMasterController/GetAllUsers?ClientId=DmsApp`);
        (u.data.data || []).forEach((x) => { userMap[x.userID] = `${x.firstName} ${x.lastName}`; });
      } catch { /* names optional */ }
      if (rid !== reqRef.current) return;
      const list = (res.data.data || [])
        .filter((it) => (pid === 0 ? it.token === tk : true))
        .map((it) => {
          const n = norm(it);
          return {
            ...n,
            accessType: pid !== 0 ? accessType : it.accessType ?? null,
            username: userMap[it.createdBy] || "Unknown User",
            subFolderCount: it.subFoldersCount || it.subFolderCount || 0,
            fileCount: it.folderFilesCount || it.fileCount || 0,
            size: it.folderSize || it.foldersize || it.size || 0,
          };
        });
      setFolders(list);
    } catch (e) {
      if (rid === reqRef.current) console.error("Error fetching folders or files:", e);
    } finally {
      if (rid === reqRef.current) setLoading(false);
    }
  }, [emailId]);

  useEffect(() => { if (!showOTPModal) fetchFolders(currentFolderId); }, [currentFolderId, showOTPModal, fetchFolders]);

  useEffect(() => {
    axios.get(`${API}FieldMaster/GetAllActionMasters`)
      .then((r) => r.data.success ? setActionMasters(r.data.data) : toast.error("Failed to fetch action masters"))
      .catch(() => toast.error("Error fetching action masters"));
  }, []);

  useEffect(() => {
    localStorage.setItem("currentPath", JSON.stringify(currentPath));
    localStorage.setItem("currentFolderId", currentFolderId);
  }, [currentPath, currentFolderId]);

  /* ---------------- navigation ---------------- */
  const handleNavigateToFolder = (f) => {
    const folderId = f._id;
    const accessType = f.accessType || ctxAccess || null;
    const ownerId = f.createdBy || ctxOwner || null;
    setCurrentPath((p) => [...p, { folderId, folderName: f._name, accessType, ownerId }]);
    setCurrentFolderId(folderId);
    localStorage.setItem("accessType", accessType || "");
    setSearch("");
  };
  const goTo = (path, id) => {
    setCurrentPath(path); setCurrentFolderId(id); setSearch("");
    const a = path.length ? path[path.length - 1].accessType : null;
    localStorage.setItem("accessType", a || "");
  };
  const handleBreadcrumbClick = (id) => {
    const i = currentPath.findIndex((p) => p.folderId === id);
    if (i === -1) return toast.error("Folder not found");
    goTo(currentPath.slice(0, i + 1), id);
  };
  const handleBack = () => {
    const np = currentPath.slice(0, -1);
    goTo(np, np.length ? np[np.length - 1].folderId : 0);
  };
  const handleHomeClick = () => goTo([], 0);
  const toggleView = (v) => { setIsGridView(v === "grid"); localStorage.setItem("viewType", v); };

  /* ---------------- document viewer ---------------- */
  const [viewer, setViewer] = useState(null); // { path }
  const [excelData, setExcelData] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [isFull, setIsFull] = useState(false);
  const [editorFile, setEditorFile] = useState(null);
  const imgBox = useRef(null);

  const openViewer = (path) => {
    setViewer({ path }); setExcelData(null); setZoom(1);
    if (/\.(xlsx|xls)$/i.test(path)) {
      fetch(path).then((r) => r.blob()).then((b) => {
        const rd = new FileReader();
        rd.onload = (e) => ExcelRenderer(e.target.result, (err, resp) => { if (!err) setExcelData(resp.rows); });
        rd.readAsArrayBuffer(b);
      }).catch((e) => console.error("Error fetching Excel:", e));
    }
  };
  const closeViewer = () => { setViewer(null); setExcelData(null); setZoom(1); setIsFull(false); };
  const toggleFull = () => {
    if (!isFull && imgBox.current?.requestFullscreen) imgBox.current.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
  };
  useEffect(() => {
    const h = () => { const f = !!document.fullscreenElement; setIsFull(f); if (!f) setZoom(1); };
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const triggerDownload = (url) => {
    const a = document.createElement("a");
    a.href = url; a.target = "_self"; a.download = "";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
  const handleDownloadFile = (id) => triggerDownload(`${API}FolderData/DownloadFile?fileId=${id}`);
  const handleDownloadFolder = (id) => triggerDownload(`${API}FolderData/DownloadFolder?folderId=${id}`);

  const handleViewItem = (item) => {
    if (!isExternal && item._isDoc && isEditorSupported(item._name)) {
      setEditorFile({ id: item._id, name: item._name });
      return;
    }
    const p = item._path;
    if (!p) return toast.error("No valid file path to view");
    if (/\.txt$/i.test(p)) window.open(p, "_blank");
    else if (/\.(xlsx|xls|csv)$/i.test(p)) triggerDownload(p);
    else openViewer(p);
  };

  const openItem = (item) => (item._isDoc ? handleViewItem(item) : handleNavigateToFolder(item));

  /* ---------------- edit / create / upload (signed-in members with write access) ---------------- */
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState(null);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState(DEFAULT_COLOR);
  const [folderErr, setFolderErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [fileToEdit, setFileToEdit] = useState(null);
  const [fileName, setFileName] = useState("");
  const [fileExt, setFileExt] = useState("");

  const [showUpload, setShowUpload] = useState(false);
  const [files, setFiles] = useState([]);
  const [allowedExt, setAllowedExt] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}FieldMaster/GetAllDocExts`)
      .then((r) => r.data.success && setAllowedExt(r.data.data.map((x) => x.extType)))
      .catch(() => { });
  }, []);

  const closeFolderModal = () => { setShowFolderModal(false); setFolderToEdit(null); setFolderName(""); setFolderErr(""); setFolderColor(DEFAULT_COLOR); };

  const saveFolder = async () => {
    if (!folderName.trim()) return setFolderErr("Folder name cannot be empty");
    if (!folderToEdit && folders.some((f) => !f._isDoc && f._name === folderName.trim())) return setFolderErr("Folder name already exists in this directory");
    setBusy(true);
    try {
      let url, payload;
      if (!folderToEdit) {
        url = `${API}FolderData/CreateSubFolderBehalf`;
        payload = { parentFolderId: currentFolderId, folderName: folderName.trim(), folderColor, createdBy: personalInfo.userID, storegeUserId: ctxOwner };
      } else if (currentFolderId === 0) {
        url = `${API}FolderData/UpdateFolderBehalf`;
        payload = { folderId: folderToEdit._id, folderName: folderName.trim(), folderColor, parentFolderId: 0, tags: folderToEdit.tags || "", createdBy: personalInfo.userID, storegeUserId: folderToEdit.createdBy };
      } else {
        url = `${API}FolderData/SubUpdateFolderBehalf`;
        payload = { parentFolderId: currentFolderId, folderId: folderToEdit._id, folderName: folderName.trim(), folderPath: folderToEdit.folderPath, folderColor, tags: folderToEdit.tags || "", createdBy: personalInfo.userID, storegeUserId: ctxOwner };
      }
      const res = await axios.post(url, payload);
      if (res.data.success) { toast.success(folderToEdit ? "Folder updated successfully" : "Folder created successfully"); closeFolderModal(); fetchFolders(currentFolderId); }
      else toast.error(res.data.message || "Operation failed");
    } catch (e) { toast.error(e.response?.data?.message || "Error saving folder"); }
    finally { setBusy(false); }
  };

  const saveFileName = async () => {
    if (!fileName.trim()) return toast.error("File name cannot be empty");
    const fd = new FormData();
    fd.append("fileId", fileToEdit._id);
    fd.append("folderId", fileToEdit.folderId ?? fileToEdit.fileExistFolId ?? currentFolderId);
    fd.append("fileName", `${fileName}${fileExt}`);
    fd.append("filePath", fileToEdit.filePath || "");
    fd.append("CreatedBy", personalInfo.userID);
    setBusy(true);
    try {
      await axios.post(`${API}FolderData/UpdateFileName`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("File name updated successfully");
      setFileToEdit(null); fetchFolders(currentFolderId);
    } catch (e) { toast.error(e.response?.data?.message || "Error updating file name"); }
    finally { setBusy(false); }
  };

  const pickFiles = (list) => {
    if (!allowedExt.length) return toast.error("File types are not ready yet. Please try again later.");
    const ok = [], bad = [];
    Array.from(list || []).forEach((f) => (allowedExt.includes(`.${f.name.split(".").pop().toLowerCase()}`) ? ok : bad).push(f.name || f));
    if (bad.length) toast.error(`Invalid file(s) selected: ${bad.join(", ")}`);
    setFiles(ok.length ? Array.from(list).filter((f) => ok.includes(f.name)) : []);
  };

  const handleFileUpload = () => {
    if (!files.length) return;
    setShowUpload(false);
    const folderIdAtStart = currentFolderId;
    const destination = last ? last.folderName : "Shared with me";
    const owner = ctxOwner;
    const toUpload = files; setFiles([]);
    const uploader = async (item, { signal, onProgress }) => {
      const fd = new FormData();
      fd.append("Files", item.file);
      fd.append("FolderId", folderIdAtStart);
      fd.append("CreatedBy", personalInfo.userID);
      if (owner) fd.append("StoregeUserId", owner);
      try {
        const r = await axios.post(`${API}FolderData/${owner ? "CreateFilesBeHalf" : "CreateFiles"}`, fd, {
          signal, headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => onProgress(e.loaded, e.total || item.size),
        });
        return r.data.success ? { success: true } : { success: false, message: r.data.message };
      } catch (e) {
        if (axios.isCancel(e)) return { success: false, cancelled: true };
        return { success: false, message: e.response?.data?.message || "Upload failed" };
      }
    };
    enqueueUploads(
      toUpload.map((file) => ({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, file, name: file.name, size: file.size, folderId: folderIdAtStart, destination })),
      uploader,
      {
        onAllDone: (results) => {
          const ok = results.filter((r) => r.success).length;
          const failed = results.filter((r) => !r.success && !r.cancelled).length;
          if (ok > 0) toast.success(failed > 0 ? `${ok} file(s) uploaded, ${failed} failed` : "Files uploaded successfully");
          else if (failed > 0) toast.error("Failed to upload files");
          fetchFolders(folderIdAtStart);
        },
      }
    );
  };

  /* ---------------- actions menu ---------------- */
  /* ---------------- actions menu (same rules as the original component) ---------------- */
  const hideActions = (desc, accessType) => {
    const hasToken = !!sessionStorage.getItem("token");
    // external (token) users can never Delete / Share / Edit
    if (hasToken && ["Delete", "Share", "Edit"].includes(desc)) return true;
    // shared tab: never Delete
    if (desc === "Delete") return true;
    if (accessType === 1) return ["Edit", "Share", "Download", "Delete"].includes(desc);
    if (accessType === 2) return desc === "Download";
    return false; // accessType 3 -> everything
  };

  const [shareItem, setShareItem] = useState(null);
  const [shareUsers, setShareUsers] = useState([]);
  const [shareAccess, setShareAccess] = useState("");
  const [shareSel, setShareSel] = useState([]);

  useEffect(() => {
    if (isExternal) return;
    axios.get(`${API}AuthMasterController/GetAllUsers?ClientId=DmsApp`)
      .then((r) => setShareUsers((r.data.data || []).filter((u) => u.userID !== personalInfo.userID).map((u) => ({ value: u.userID, label: `${u.firstName} ${u.lastName} - ${u.email}` }))))
      .catch(() => { });
  }, [isExternal, personalInfo.userID]);

  const handleShare = () => {
    if (!shareAccess) return toast.error("Please select an access type");
    if (!shareSel.length) return toast.error("Please select at least one user");
    axios.post(`${API}FolderData/CreateShareAccess`, {
      folderOrFileId: shareItem._id, docType: shareItem._isDoc ? "Document" : "Folder",
      fileExistFolId: currentFolderId || shareItem.fileExistFolId,
      accessUserId: shareSel.map((u) => u.value), accessType: shareAccess,
      isExpiryDate: false, expiryDate: "", isEncryptionKey: false, encryptionKey: "", comment: "",
      createdBy: personalInfo.userID,
    })
      .then((r) => { if (r.data?.success) { toast.success(r.data.message || "Successfully shared"); setShareItem(null); setShareSel([]); setShareAccess(""); } else toast.error(r.data?.message || "Failed to share"); })
      .catch((e) => toast.error(e.response?.data?.message || "Error sharing the item"));
  };
  const onShareChange = (opts) => {
    const known = shareUsers.map((u) => u.value);
    const next = (opts || []).filter((o) => known.includes(o.value) || isValidEmail(o.value));
    if (next.length !== (opts || []).length) toast.error("Invalid email address. Please enter a valid email.");
    setShareSel(next.filter((o, i, a) => a.findIndex((x) => x.value === o.value) === i));
  };

  const handleOption = (opt, item) => {
    if (opt === "Download") return item._isDoc ? handleDownloadFile(item._id) : handleDownloadFolder(item._id);
    if (opt === "View") return openItem(item);
    if (opt === "Share") return setShareItem(item);
    if (opt === "Edit") {
      if (item._isDoc) {
        const i = item._name.lastIndexOf(".");
        setFileToEdit(item);
        setFileName(i > 0 ? item._name.slice(0, i) : item._name);
        setFileExt(i > 0 ? item._name.slice(i) : "");
      } else {
        setFolderToEdit(item);
        setFolderName(item._name);
        setFolderColor(item.folderColor || DEFAULT_COLOR);
        setShowFolderModal(true);
      }
    }
  };

  /* ---------------- derived ---------------- */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const dir = sortDir === "asc" ? 1 : -1;
    const list = folders.filter((i) => !q || i._name.toLowerCase().includes(q) || (i.username || "").toLowerCase().includes(q));
    return list.sort((a, b) => {
      if (a._isDoc !== b._isDoc) return a._isDoc ? 1 : -1;
      if (sortKey === "size") return ((a.size || 0) - (b.size || 0)) * dir;
      if (sortKey === "date") return (new Date(a.createdOn) - new Date(b.createdOn)) * dir;
      return a._name.localeCompare(b._name, undefined, { numeric: true, sensitivity: "base" }) * dir;
    });
  }, [folders, search, sortKey, sortDir]);

  const stats = useMemo(() => ({
    folders: folders.filter((i) => !i._isDoc).length,
    files: folders.filter((i) => i._isDoc).length,
    size: folders.reduce((s, i) => s + (Number(i.size) || 0), 0),
  }), [folders]);

  const initial = (emailId || "?").charAt(0).toUpperCase();
  const toggleSort = (k) => { if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortKey(k); setSortDir("asc"); } };

   const renderTitle = (i) => (i._isDoc || !isGridView ? i._name : i._name.length > 18 ? `${i._name.slice(0, 18)}...` : i._name);

  /* ---------------- render ---------------- */
  return (
    <div className="xa-page">
      <header className="xa-top">
        <div className="xa-brand">
          <img src={bmsLogoWipro} alt="Wipro" />
          <div><b>Shared Workspace</b><small>Secure document access</small></div>
        </div>
        <div className="xa-user">
          <span className="xa-chip-user" title={emailId}><span className="xa-avatar">{initial}</span><span className="xa-email">{emailId || "Guest"}</span></span>
          <button type="button" className="xa-icon-btn" onClick={handleLogout} title="Sign out" aria-label="Sign out"><FiLogOut size={17} /></button>
        </div>
      </header>

      <main className="xa-main">
        <section className="xa-hero">
          <div>
            <h2>Files shared with you</h2>
            <p><FiShield size={14} /> Access is verified by one-time password{ctxAccess ? ` - ${ACCESS_LABEL[ctxAccess]} on this folder` : ""}.</p>
          </div>
          <div className="xa-stats">
            <div className="xa-stat"><b>{stats.folders}</b><span>Folders</span></div>
            <div className="xa-stat"><b>{stats.files}</b><span>Files</span></div>
            <div className="xa-stat"><b>{formatStorage(stats.size)}</b><span>Size</span></div>
          </div>
        </section>

        <section className="xa-card">
          <div className="xa-toolbar">
            <nav className="xa-crumbs" aria-label="Breadcrumb">
              {currentPath.length > 0 && <button type="button" className="xa-icon-btn" onClick={handleBack} aria-label="Back"><FiArrowLeft size={16} /></button>}
              <button type="button" className={`xa-crumb ${currentPath.length === 0 ? "current" : ""}`} onClick={handleHomeClick}><FiHome size={14} /> Home</button>
              {currentPath.map((c) => (
                <React.Fragment key={c.folderId}>
                  <span className="xa-sep">/</span>
                  <button type="button" className={`xa-crumb ${c.folderId === currentFolderId ? "current" : ""}`} onClick={() => handleBreadcrumbClick(c.folderId)}>{c.folderName}</button>
                </React.Fragment>
              ))}
            </nav>
            <div className="xa-tools">
              {canWriteHere && (
                <>
                  <button type="button" className="xa-btn" onClick={() => setShowFolderModal(true)}><FiFolderPlus size={15} /> New folder</button>
                  <button type="button" className="xa-btn" onClick={() => setShowUpload(true)}><FiUploadCloud size={15} /> Upload</button>
                </>
              )}
              <div className="xa-search"><FiSearch size={14} /><input type="search" placeholder="Search in this folder" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" /></div>
              <select className="xa-select" value={sortKey} onChange={(e) => setSortKey(e.target.value)} aria-label="Sort by">
                <option value="name">Name</option><option value="date">Shared on</option><option value="size">Size</option>
              </select>
              <button type="button" className="xa-icon-btn" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} aria-label="Toggle sort direction">
                {sortDir === "asc" ? <FiArrowUp size={15} /> : <FiArrowDown size={15} />}
              </button>
              <div className="xa-seg">
                <button type="button" className={isGridView ? "active" : ""} onClick={() => toggleView("grid")} title="Grid view" aria-label="Grid view"><FiGrid size={15} /></button>
                <button type="button" className={!isGridView ? "active" : ""} onClick={() => toggleView("list")} title="List view" aria-label="List view"><FiList size={15} /></button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className={`xa-grid ${isGridView ? "" : "xa-list"}`} aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="xa-skel" />)}
            </div>
          ) : visible.length === 0 ? (
            <div className="xa-empty"><FiFolder size={44} /><h5>{search ? "No matching items" : "Nothing here yet"}</h5><p>{search ? `No items match "${search}".` : "No files or folders have been shared in this location."}</p></div>
          ) : (
            <div className={`xa-grid ${isGridView ? "" : "xa-list"}`}>
              {visible.map((item) => {
                const key = `${item._isDoc ? "f" : "d"}-${item._id}-${item.esaid || item.sdaId || ""}`;
                const tip = [item._name, `Shared by: ${item.username}`, `Shared on: ${formatDate(item.createdOn)}`, `Size: ${formatStorage(item.size)}`].join(" | ");
                const menuActions = actionMasters.filter((a) => !hideActions(a.actionDesc, item.accessType));
                const showNew = item.isView === false && item.fileExistFolId === 0;
                return (
                  <div key={key} className="xa-item" onClick={() => openItem(item)} title={tip} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openItem(item)}>
                    {showNew && isGridView && <span className="xa-new">New</span>}
                    <div className="xa-ico">
                      {item._isDoc ? fileIcon(item._name, isGridView ? 34 : 24) : (
                        <div className="xa-folder"><i style={{ background: item.folderColor || DEFAULT_COLOR }} /><i style={{ background: item.folderColor || DEFAULT_COLOR }} /></div>
                      )}
                    </div>
                    <div className="xa-info">
                      <div className="xa-name">
                        {renderTitle(item)}
                        {showNew && !isGridView && <span className="xa-new xa-new--inline">New</span>}
                      </div>
                      <div className="xa-meta">
                        {item._isDoc ? <span>{formatStorage(item.size)}</span> : (
                          <>
                            {item.subFolderCount > 0 && <span>{item.subFolderCount} subfolder{item.subFolderCount !== 1 ? "s" : ""}</span>}
                            {item.fileCount > 0 && <span>{item.fileCount} file{item.fileCount !== 1 ? "s" : ""}</span>}
                            <span>{formatStorage(item.size)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {!isGridView && <div className="xa-by">{item.username}</div>}
                    {!isGridView && <div className="xa-on">{formatDate(item.createdOn)}</div>}
                    {item.accessType && <span className={`xa-acc a${item.accessType}`}>{ACCESS_LABEL[item.accessType]}</span>}
                    <div className="xa-menu" onClick={(e) => e.stopPropagation()}>
                      <Menu
                        portal
                        align="end"
                        direction="bottom"
                        viewScroll="close"
                        menuClassName="xa-szh"
                        menuButton={<MenuButton className="xa-icon-btn" aria-label="Actions" onClick={(e) => e.stopPropagation()}><FiMoreVertical size={16} /></MenuButton>}
                      >
                        {menuActions.length > 0 ? menuActions.map((a) => (
                          <MenuItem key={a.aId} onClick={() => handleOption(a.actionDesc, item)}>{a.actionDesc}</MenuItem>
                        )) : <MenuItem disabled>No actions available</MenuItem>}
                      </Menu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="xa-foot">
            <span>{visible.length} item{visible.length !== 1 ? "s" : ""}</span>
            <button type="button" className="xa-link" onClick={() => toggleSort("name")}>Sort by name</button>
          </div>
        </section>
      </main>

      {/* ---------- document viewer ---------- */}
      {viewer && (
        <div className="xa-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeViewer()}>
          <div className="xa-modal xa-modal--xl" role="dialog" aria-modal="true">
            <div className="xa-modal-h"><h5>Document view</h5><button type="button" className="xa-icon-btn" onClick={closeViewer} aria-label="Close"><FiX size={18} /></button></div>
            <div className="xa-modal-b xa-viewer">
              {/\.pdf$/i.test(viewer.path) ? <iframe src={viewer.path} title="file-viewer" />
                : /\.(xlsx|xls)$/i.test(viewer.path) ? (
                  excelData ? (
                    <div className="xa-table-wrap"><table className="xa-table"><thead><tr>{excelData[0].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                      <tbody>{excelData.slice(1).map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{c}</td>)}</tr>)}</tbody></table></div>
                  ) : <p className="xa-muted">Loading Excel file...</p>
                ) : (
                  <div ref={imgBox} className="xa-img-box">
                    <img src={viewer.path} alt="Document" style={{ transform: `scale(${zoom})` }} />
                    <div className="xa-img-tools">
                      {isFull && <>
                        <button type="button" onClick={() => setZoom((z) => Math.min(z + 0.2, 2.5))} title="Zoom in"><FiZoomIn /></button>
                        <button type="button" onClick={() => setZoom((z) => Math.max(z - 0.2, 0.5))} title="Zoom out"><FiZoomOut /></button>
                      </>}
                      <button type="button" onClick={toggleFull} title={isFull ? "Exit fullscreen" : "Fullscreen"}>{isFull ? <FiMinimize /> : <FiMaximize />}</button>
                    </div>
                  </div>
                )}
            </div>
            <div className="xa-modal-f"><button type="button" className="xa-btn" onClick={closeViewer}>Close</button></div>
          </div>
        </div>
      )}

      {editorFile && (
        <UniversalDocumentEditor file={editorFile} onClose={(m) => { setEditorFile(null); fetchFolders(currentFolderId); if (m) setTimeout(() => fetchFolders(currentFolderId), 12000); }} />
      )}

      {/* ---------- create / edit folder ---------- */}
      {showFolderModal && (
        <div className="xa-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeFolderModal()}>
          <div className="xa-modal" role="dialog" aria-modal="true">
            <div className="xa-modal-h"><h5>{folderToEdit ? "Edit folder" : "Create new folder"}</h5><button type="button" className="xa-icon-btn" onClick={closeFolderModal} aria-label="Close"><FiX size={18} /></button></div>
            <div className="xa-modal-b">
              <label className="xa-label" htmlFor="xa-fn">Folder name</label>
              <input id="xa-fn" className={`xa-input ${folderErr ? "invalid" : ""}`} value={folderName} onChange={(e) => { setFolderName(e.target.value); setFolderErr(""); }} autoFocus />
              {folderErr && <small className="xa-err">{folderErr}</small>}
              <label className="xa-label">Folder colour</label>
              <div className="xa-colors">{GRADIENTS.map((g) => <button type="button" key={g} aria-label="Colour" className={folderColor === g ? "sel" : ""} style={{ background: g }} onClick={() => setFolderColor(g)} />)}</div>
            </div>
            <div className="xa-modal-f">
              <button type="button" className="xa-btn" onClick={closeFolderModal} disabled={busy}>Cancel</button>
              <button type="button" className="xa-btn primary" onClick={saveFolder} disabled={busy}>{busy ? "Please wait..." : folderToEdit ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- rename file ---------- */}
      {fileToEdit && (
        <div className="xa-overlay" onMouseDown={(e) => e.target === e.currentTarget && setFileToEdit(null)}>
          <div className="xa-modal" role="dialog" aria-modal="true">
            <div className="xa-modal-h"><h5>Rename file</h5><button type="button" className="xa-icon-btn" onClick={() => setFileToEdit(null)} aria-label="Close"><FiX size={18} /></button></div>
            <div className="xa-modal-b">
              <label className="xa-label" htmlFor="xa-fl">File name</label>
              <div className="xa-inline"><input id="xa-fl" className="xa-input" value={fileName} onChange={(e) => setFileName(e.target.value)} /><span className="xa-ext">{fileExt}</span></div>
            </div>
            <div className="xa-modal-f">
              <button type="button" className="xa-btn" onClick={() => setFileToEdit(null)}>Cancel</button>
              <button type="button" className="xa-btn primary" onClick={saveFileName} disabled={busy}>Update</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- upload ---------- */}
      {showUpload && (
        <div className="xa-overlay" onMouseDown={(e) => e.target === e.currentTarget && (setShowUpload(false), setFiles([]))}>
          <div className="xa-modal" role="dialog" aria-modal="true">
            <div className="xa-modal-h"><h5>Upload files</h5><button type="button" className="xa-icon-btn" onClick={() => { setShowUpload(false); setFiles([]); }} aria-label="Close"><FiX size={18} /></button></div>
            <div className="xa-modal-b">
              <div className="xa-drop" onClick={() => fileInputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFiles(e.dataTransfer.files); }}>
                <FiUploadCloud size={26} /><span>Click or drag files here</span>
                <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => pickFiles(e.target.files)} />
              </div>
              <div className="xa-muted">{files.length ? `${files.length} file(s) selected` : "No files selected"}</div>
            </div>
            <div className="xa-modal-f">
              <button type="button" className="xa-btn" onClick={() => { setShowUpload(false); setFiles([]); }}>Cancel</button>
              <button type="button" className="xa-btn primary" disabled={!files.length} onClick={handleFileUpload}>Upload</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- share ---------- */}
      {shareItem && (
        <div className="xa-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShareItem(null)}>
          <div className="xa-modal" role="dialog" aria-modal="true">
            <div className="xa-modal-h"><h5>Share access</h5><button type="button" className="xa-icon-btn" onClick={() => setShareItem(null)} aria-label="Close"><FiX size={18} /></button></div>
            <div className="xa-modal-b">
              <label className="xa-label">Access type</label>
              <div className="xa-radios">
                {[["1", "Read-only"], ["2", "Read/Write"], ["3", "Read/Write/Download"]].map(([v, l]) => (
                  <label key={v} className={shareAccess === v ? "sel" : ""}><input type="radio" value={v} checked={shareAccess === v} onChange={(e) => setShareAccess(e.target.value)} />{l}</label>
                ))}
              </div>
              <label className="xa-label">Select users</label>
              <CreatableSelect isMulti options={shareUsers} value={shareSel} onChange={onShareChange} placeholder="Search, select or add an email..." />
            </div>
            <div className="xa-modal-f">
              <button type="button" className="xa-btn" onClick={() => setShareItem(null)}>Cancel</button>
              <button type="button" className="xa-btn primary" onClick={handleShare}>Share</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- OTP verification ---------- */}
      {showOTPModal && (
        <div className="xa-overlay xa-overlay--solid">
          <form className="xa-otp" onSubmit={showOtpInput ? handleVerifyOtp : handleEmailSubmit}>
            <span className="xa-otp-badge"><FiLock size={22} /></span>
            <h4>{showOtpInput ? "Enter your one-time password" : "Verify your email"}</h4>
            <p>{showOtpInput ? "We emailed a 6-digit code. It expires in 5 minutes." : "Confirm your address to receive a secure verification code."}</p>
            <label className="xa-label" htmlFor="xa-em">Email address</label>
            <div className="xa-field"><FiMail size={15} /><input id="xa-em" type="email" className="xa-input" value={emailId} readOnly /></div>
            {showOtpInput && (
              <>
                <label className="xa-label" htmlFor="xa-otp">OTP</label>
                <input id="xa-otp" className="xa-input xa-otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="000000" autoFocus />
              </>
            )}
            {error && <div className="xa-alert" role="alert">{error}</div>}
            <button type="submit" className="xa-btn primary xa-block" disabled={otpBusy}>{otpBusy ? "Please wait..." : showOtpInput ? "Verify OTP" : "Send code"}</button>
            {showOtpInput && <button type="button" className="xa-link" onClick={() => { setShowOtpInput(false); setOtp(""); setError(""); }}>Use a different code</button>}
          </form>
        </div>
      )}
    </div>
  );
};

export default ExternalUserAccess;