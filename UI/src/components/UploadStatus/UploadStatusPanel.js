import React from "react";
import {
  FaFileAlt,
  FaFilePdf,
  FaFileExcel,
  FaFileCsv,
  FaFileWord,
  FaFileArchive,
  FaFileVideo,
  FaFilePowerpoint,
  FaFileCode,
  FaFileImage,
} from "react-icons/fa";
import { useUpload } from "../../Customhook/UploadContext";

// Rendered once at the App root so it stays visible across every route/tab,
// not just while the FolderCreation page is mounted.
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

const truncateProgressText = (text, maxLength = 10) => {
  if (!text) return "";
  const ext = text.split(".").pop();
  const base = text.substring(0, maxLength);
  return text.length > maxLength ? `${base}...${ext}` : text;
};

const UploadStatusPanel = () => {
  const {
    uploadQueue,
    showUploadPanel,
    setShowUploadPanel,
    isUploadPanelMinimized,
    setIsUploadPanelMinimized,
    removeUploadItem,
    clearCompletedUploads,
  } = useUpload();

  if (!showUploadPanel || uploadQueue.length === 0) {
    return null;
  }

  const isAnyUploadInProgress = uploadQueue.some((f) => f.status === "uploading");

  return (
    <div className={`upload-status-panel ${isUploadPanelMinimized ? "minimized" : ""}`}>
      <div
        className="upload-status-panel-header"
        onClick={() => setIsUploadPanelMinimized((prev) => !prev)}
      >
        <span className="upload-status-panel-title">
          {isAnyUploadInProgress
            ? `Uploading ${uploadQueue.filter((f) => f.status === "uploading").length} item(s)`
            : uploadQueue.some((f) => f.status === "failed")
              ? "Uploads completed with errors"
              : "Uploads completed"}
        </span>
        <div className="upload-status-panel-header-actions">
          <button
            className="upload-status-panel-minimize"
            onClick={(e) => {
              e.stopPropagation();
              setIsUploadPanelMinimized((prev) => !prev);
            }}
            title={isUploadPanelMinimized ? "Expand" : "Minimize"}
          >
            {isUploadPanelMinimized ? "▲" : "▼"}
          </button>
          <button
            className="upload-status-panel-close"
            onClick={(e) => {
              e.stopPropagation();
              setShowUploadPanel(false);
            }}
            title="Close panel (uploads continue in background)"
          >
            ×
          </button>
        </div>
      </div>

      {!isUploadPanelMinimized && (
        <>
          <div className="upload-status-panel-body">
            {uploadQueue.map((file) => (
              <div key={file.id} className="upload-status-item">
                <div className="file-icon-container">{getFileProgressIcon(file.name)}</div>

                <div className="upload-status-item-details">
                  <span className="upload-status-item-filename" title={file.name}>
                    {truncateProgressText(file.name, 22)}
                  </span>
                  <div className="upload-status-item-bar-container">
                    <div
                      className={`upload-status-item-bar ${file.status === "completed"
                        ? "completed"
                        : file.status === "failed"
                          ? "failed"
                          : ""
                        }`}
                      style={{ width: `${file.progress}%` }}
                    ></div>
                  </div>
                </div>

                <span
                  className={`upload-status-item-status ${file.status === "completed"
                    ? "status-completed"
                    : file.status === "failed"
                      ? "status-failed"
                      : "status-uploading"
                    }`}
                >
                  {file.status === "completed"
                    ? "Done"
                    : file.status === "failed"
                      ? "Failed"
                      : `${Math.round(file.progress)}%`}
                </span>

                {file.status !== "uploading" && (
                  <button
                    className="upload-status-item-dismiss"
                    onClick={() => removeUploadItem(file.id)}
                    title="Dismiss"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {!isAnyUploadInProgress && (
            <div className="upload-status-panel-footer">
              <button
                className="upload-status-panel-clear-btn"
                onClick={clearCompletedUploads}
              >
                Clear completed
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UploadStatusPanel;