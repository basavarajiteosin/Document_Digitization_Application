import React, { memo, useMemo, useState } from "react";
import {
  FiX, FiRotateCw, FiCheckCircle, FiAlertCircle, FiChevronDown, FiChevronUp, FiFolder,
} from "react-icons/fi";
import {
  FaFileAlt, FaFilePdf, FaFileExcel, FaFileCsv, FaFileWord, FaFileArchive,
  FaFileVideo, FaFilePowerpoint, FaFileCode, FaFileImage,
} from "react-icons/fa";
import { useUpload } from "../../Customhook/UploadContext";
import "../../styles/sp-upload.css";

const ICONS = {};
const reg = (exts, Icon, color) => exts.forEach((e) => { ICONS[e] = [Icon, color]; });
reg(["pdf"], FaFilePdf, "#D32F2F");
reg(["xls", "xlsx"], FaFileExcel, "#217346");
reg(["csv"], FaFileCsv, "#0288D1");
reg(["doc", "docx"], FaFileWord, "#2B579A");
reg(["ppt", "pptx"], FaFilePowerpoint, "#C43E1C");
reg(["png", "jpg", "jpeg", "svg", "gif", "webp"], FaFileImage, "#F57C00");
reg(["zip", "rar", "7z", "tar"], FaFileArchive, "#6D4C41");
reg(["mp4", "mov", "avi", "mkv", "webm"], FaFileVideo, "#8E24AA");
reg(["js", "jsx", "html", "css", "json"], FaFileCode, "#455A64");
const iconFor = (name = "") => ICONS[name.split(".").pop().toLowerCase()] || [FaFileAlt, "#605e5c"];

const fmtBytes = (b) => {
  b = Number(b) || 0;
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + " GB";
  if (b >= 1048576) return (b / 1048576).toFixed(1) + " MB";
  if (b >= 1024) return (b / 1024).toFixed(0) + " KB";
  return b + " B";
};
const fmtEta = (s) => {
  if (s == null || !isFinite(s)) return "";
  if (s < 60) return `${Math.max(1, Math.round(s))}s left`;
  if (s < 3600) return `${Math.round(s / 60)}m left`;
  return `${(s / 3600).toFixed(1)}h left`;
};

const MAX_VISIBLE = 50;

const UploadRow = memo(({ item, onCancel, onRetry, onRemove }) => {
  const [Icon, color] = iconFor(item.name);
  const { status } = item;
  const active = status === "queued" || status === "uploading";

  let sub;
  if (status === "queued") sub = "Waiting…";
  else if (status === "uploading" && item.processing) sub = "Finishing on server…";
  else if (status === "uploading")
    sub = [`${fmtBytes(item.loaded)} of ${fmtBytes(item.size)}`, item.speed > 0 && `${fmtBytes(item.speed)}/s`, fmtEta(item.eta)]
      .filter(Boolean).join(" · ");
  else if (status === "completed") sub = `Uploaded · ${fmtBytes(item.size)}`;
  else if (status === "cancelled") sub = "Cancelled";
  else sub = item.error || "Upload failed";

  return (
    <li className={`sp-up-row is-${status}`}>
      <span className="sp-up-ficon" style={{ color }}><Icon size={22} /></span>
      <div className="sp-up-main">
        <div className="sp-up-name" title={item.name}>{item.name}</div>
        <div className={`sp-up-sub ${status === "failed" ? "is-error" : ""}`} title={sub}>{sub}</div>
        {item.destination && (
          <div className="sp-up-dest"><FiFolder size={11} /> {item.destination}</div>
        )}
        {status === "uploading" && (
          <div className="sp-up-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round(item.progress)} aria-label={`Uploading ${item.name}`}>
            <span className={item.processing ? "is-indeterminate" : ""} style={{ width: `${item.progress}%` }} />
          </div>
        )}
      </div>
      <div className="sp-up-actions">
        {status === "completed" && <FiCheckCircle size={18} className="sp-up-ok" aria-label="Completed" />}
        {status === "failed" && <FiAlertCircle size={18} className="sp-up-err" aria-label="Failed" />}
        {status === "uploading" && <span className="sp-up-pct">{Math.round(item.progress)}%</span>}
        {(status === "failed" || status === "cancelled") && (
          <button type="button" className="sp-up-ibtn" title="Retry" aria-label={`Retry ${item.name}`} onClick={() => onRetry(item.id)}>
            <FiRotateCw size={15} />
          </button>
        )}
        {active ? (
          <button type="button" className="sp-up-ibtn" title="Cancel" aria-label={`Cancel ${item.name}`} onClick={() => onCancel(item.id)}>
            <FiX size={16} />
          </button>
        ) : (
          <button type="button" className="sp-up-ibtn" title="Remove" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}>
            <FiX size={16} />
          </button>
        )}
      </div>
    </li>
  );
});

const UploadStatusPanel = () => {
  const {
    uploadQueue, showUploadPanel, setShowUploadPanel, isUploadPanelMinimized, setIsUploadPanelMinimized,
    cancelUpload, cancelAllUploads, retryUpload, retryFailedUploads, removeUploadItem, clearCompletedUploads,
  } = useUpload();
  const [showAll, setShowAll] = useState(false);

  const s = useMemo(() => {
    const r = { queued: 0, uploading: 0, completed: 0, failed: 0, cancelled: 0, total: 0, loaded: 0 };
    uploadQueue.forEach((i) => {
      r[i.status] += 1;
      r.total += i.size || 0;
      r.loaded += i.status === "completed" ? i.size || 0 : i.loaded || 0;
    });
    r.active = r.queued + r.uploading;
    r.percent = r.total ? Math.min(100, Math.round((r.loaded / r.total) * 100)) : 0;
    return r;
  }, [uploadQueue]);

  if (!showUploadPanel || uploadQueue.length === 0) return null;

  let title;
  if (s.active > 0) title = `Uploading ${s.active} item${s.active !== 1 ? "s" : ""} · ${s.percent}%`;
  else if (s.failed > 0) title = `${s.completed} uploaded, ${s.failed} failed`;
  else if (s.completed === 0 && s.cancelled > 0) title = "Uploads cancelled";
  else title = `${s.completed} upload${s.completed !== 1 ? "s" : ""} complete`;

  const rows = showAll ? uploadQueue : uploadQueue.slice(0, MAX_VISIBLE);
  const hidden = uploadQueue.length - rows.length;
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <section className={`sp-up ${isUploadPanelMinimized ? "is-min" : ""}`} role="region" aria-label="Upload status">
      <header className="sp-up-head" onClick={() => setIsUploadPanelMinimized((v) => !v)}>
        <span className="sp-up-title" aria-live="polite">{title}</span>
        <span className="sp-up-hbtns">
          <button type="button" className="sp-up-hbtn" aria-label={isUploadPanelMinimized ? "Expand" : "Minimize"}
            onClick={stop(() => setIsUploadPanelMinimized((v) => !v))}>
            {isUploadPanelMinimized ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
          <button type="button" className="sp-up-hbtn" aria-label="Close panel (uploads continue)" title="Close (uploads continue in background)"
            onClick={stop(() => setShowUploadPanel(false))}>
            <FiX size={18} />
          </button>
        </span>
      </header>

      {s.active > 0 && (
        <div className="sp-up-total" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.percent} aria-label="Overall progress">
          <span style={{ width: `${s.percent}%` }} />
        </div>
      )}

      {!isUploadPanelMinimized && (
        <>
          <ul className="sp-up-list">
            {rows.map((item) => (
              <UploadRow key={item.id} item={item} onCancel={cancelUpload} onRetry={retryUpload} onRemove={removeUploadItem} />
            ))}
            {hidden > 0 && (
              <li className="sp-up-more">
                <button type="button" className="sp-up-link" onClick={() => setShowAll(true)}>Show {hidden} more</button>
              </li>
            )}
          </ul>
          <footer className="sp-up-foot">
            {s.active > 0 && <button type="button" className="sp-up-link" onClick={cancelAllUploads}>Cancel all</button>}
            {s.failed > 0 && <button type="button" className="sp-up-link" onClick={retryFailedUploads}>Retry failed</button>}
            {(s.completed > 0 || s.cancelled > 0) && (
              <button type="button" className="sp-up-link sp-up-right" onClick={clearCompletedUploads}>Clear completed</button>
            )}
          </footer>
        </>
      )}
    </section>
  );
};

export default UploadStatusPanel;