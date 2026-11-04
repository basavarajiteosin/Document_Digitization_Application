import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  FiFolderPlus, FiFolder, FiUsers, FiFile, FiChevronRight, FiEye, FiDownload,
  FiEdit2, FiRefreshCw, FiShare2, FiHardDrive, FiActivity,
} from "react-icons/fi";

const config = require("../services/config.json");

const ago = (d) => {
  if (!d) return "";
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} d ago`;
  return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const formatBytes = (b) => {
  b = Number(b) || 0;
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + " GB";
  if (b >= 1048576) return (b / 1048576).toFixed(2) + " MB";
  if (b >= 1024) return (b / 1024).toFixed(1) + " KB";
  return b + " B";
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const EXT_COLORS = {
  pdf: "#d13438", doc: "#2b579a", docx: "#2b579a", xls: "#217346", xlsx: "#217346", csv: "#217346",
  ppt: "#c43e1c", pptx: "#c43e1c", png: "#038387", jpg: "#038387", jpeg: "#038387", zip: "#8a6d00", txt: "#605e5c",
};
const extOf = (n = "") => (n.includes(".") ? n.split(".").pop().toLowerCase() : "file");

const ACT = {
  View: { icon: FiEye, verb: "Opened", cls: "view" },
  Download: { icon: FiDownload, verb: "Downloaded", cls: "download" },
  Edit: { icon: FiEdit2, verb: "Edited", cls: "edit" },
  Update: { icon: FiRefreshCw, verb: "Updated", cls: "update" },
  Share: { icon: FiShare2, verb: "Shared", cls: "share" },
};

const Glyph = ({ color }) => (
  <div className="sp-glyph" aria-hidden="true">
    <div className="sp-glyph-top" style={{ background: color }} />
    <div className="sp-glyph-bottom" style={{ background: color }} />
  </div>
);

const Skeleton = ({ rows = 4 }) => (
  <div className="sp-panel-b" aria-busy="true">
    {Array.from({ length: rows }).map((_, i) => (
      <span key={i} className="sp-skel" style={{ height: 14, margin: "12px 0", width: `${90 - i * 10}%` }} />
    ))}
  </div>
);

const Home = () => {
  const navigate = useNavigate();
  const personalInfo = useSelector((s) => s.personalInformationReducer);
  const uid = personalInfo.userID;
  const isGlobalAdmin = personalInfo.userRole === "Global Admin";

  const [loading, setLoading] = useState(true);
  const [ownFolders, setOwnFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [shared, setShared] = useState([]);
  const [activity, setActivity] = useState({ total: 0, items: [] });
  const [storage, setStorage] = useState(null);
  const [errors, setErrors] = useState({ own: false, shared: false, files: false, activity: false });

  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    const base = config.DDA_API_API_URL;

    (async () => {
      const [own, fl, sh, emp, lim, act] = await Promise.allSettled([
        axios.get(`${base}FolderData/GetAllFoldersByCreatedBy/${uid}`),
        axios.get(`${base}FolderData/GetAllFoldersAndFilesByCreatedBy/${uid}`),
        axios.get(`${base}FolderData/GetShareAccessDetailsByUser/${uid}`),
        axios.get(`${base}AuthMasterController/GetAllEmpInfo`),
        axios.get(`${base}GlobalAdmin/GetAllUsersDataLimit`),
        axios.get(`${base}Reports/GetEmployeeWiseFolderAccess`, { params: { userId: uid } }),
      ]);
      if (cancelled) return;

      const names = {};
      if (emp.status === "fulfilled" && emp.value.data?.success) {
        (emp.value.data.data || []).forEach((e) => {
          names[e.empId] = `${e.firstName || ""} ${e.lastName || ""}`.trim();
        });
      }
      const visible = (it) => isGlobalAdmin || it.isHide !== true;

      if (own.status === "fulfilled" && own.value.data?.success) {
        setOwnFolders(
          (own.value.data.data || [])
            .filter((it) => it && typeof it === "object" && it.folderId && visible(it))
            .sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn))
        );
      } else setErrors((e) => ({ ...e, own: true }));

      if (fl.status === "fulfilled" && fl.value.data?.success) {
        setFiles(
          (fl.value.data.data || [])
            .filter((it) => it && it.fileId && it.fileName && visible(it))
            .sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn))
        );
      } else setErrors((e) => ({ ...e, files: true }));

      if (sh.status === "fulfilled" && sh.value.data?.success) {
        setShared(
          (sh.value.data.data || [])
            .filter((it) => it && it.createdBy !== uid && it.accessType != null && (isGlobalAdmin || it.isActive !== false) && visible(it))
            .map((it) => ({ ...it, sharedBy: names[it.createdBy] || "Unknown user" }))
            .sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn))
        );
      } else setErrors((e) => ({ ...e, shared: true }));

      if (lim.status === "fulfilled" && lim.value.data?.success) {
        const mine = (lim.value.data.data || []).find((x) => x.userId === uid);
        if (mine) setStorage({ used: mine.usedStorage || 0, max: mine.maximumAllocatedStorage || 0 });
      }

      if (act.status === "fulfilled" && act.value.data?.success) {
        const raw = act.value.data.data;
        const d = Array.isArray(raw) ? raw[0] : raw;
        setActivity({
          total: d?.totalAccessCount || 0,
          items: (d?.accessDetails || [])
            .slice()
            .sort((a, b) => new Date(b.lastAccessedOn) - new Date(a.lastAccessedOn))
            .slice(0, 8),
        });
      } else setErrors((e) => ({ ...e, activity: true }));

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [uid, isGlobalAdmin]);

  const goDashboard = (tab, action) => {
    localStorage.setItem("activeTab", tab);
    localStorage.setItem("currentFolderId", "0");
    localStorage.removeItem("currentPath");
    localStorage.removeItem("accessType");
    navigate(action ? `/dashboard?action=${action}` : "/dashboard");
  };

  const openFolder = (id, name) =>
    navigate(`/dashboard?openFolderId=${id}&folderName=${encodeURIComponent(name || "Folder")}`);

  const openFile = (f) => (f.folderId ? openFolder(f.folderId, "Folder") : goDashboard("current"));

  const openShared = (it) => {
    if (it.docType === "Folder") {
      navigate(
        `/dashboard?openFolderId=${it.folderOrFileId}&tab=shared&accessType=${it.accessType}` +
          `&ownerId=${it.createdBy || ""}&folderName=${encodeURIComponent(it.foldeOrFileName || "Folder")}`
      );
    } else goDashboard("shared");
  };

  const openActivity = (a) =>
    a.docType === "Folder"
      ? openFolder(a.folderOrFileId, a.folderOrFileName)
      : navigate(`/dashboard?q=${encodeURIComponent(a.folderOrFileName || "")}`);

  const pct = storage && storage.max > 0 ? Math.min(100, Math.round((storage.used / storage.max) * 100)) : 0;
  const fullName = `${personalInfo.firstName || ""}`.trim();

  const stats = [
    { label: "My folders", value: ownFolders.length, icon: FiFolder, tone: "blue", onClick: () => goDashboard("current") },
    { label: "My files", value: files.length, icon: FiFile, tone: "teal", onClick: () => navigate("/search") },
    { label: "Shared with me", value: shared.length, icon: FiUsers, tone: "purple", onClick: () => goDashboard("shared") },
    { label: "My activity", value: activity.total, icon: FiActivity, tone: "orange", onClick: null },
  ];

  return (
    <section className="content">
      <div className="container-fluid">
        <div className="sp-home">
          {/* Hero */}
          <div className="sp-hero">
            <div>
              <h2>{greeting()}{fullName ? `, ${fullName}` : ""}</h2>
              <p>
                {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                {personalInfo.userRole ? ` · ${personalInfo.userRole}` : ""}
              </p>
            </div>
            <button type="button" className="sp-newbtn" onClick={() => goDashboard("current", "newFolder")}>
              <span className="sp-newbtn-ico"><FiFolderPlus size={18} /></span>
              <span className="sp-newbtn-txt"><b>New folder</b><small>Create in My Files</small></span>
            </button>
          </div>

          {/* Stats */}
          <div className="sp-stats">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <button key={s.label} type="button" className={`sp-stat ${s.tone}`} onClick={s.onClick || undefined} disabled={!s.onClick}>
                  <span className="sp-stat-ico"><Icon size={20} /></span>
                  <span className="sp-stat-body">
                    <b>{loading ? "…" : s.value}</b>
                    <small>{s.label}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="sp-grid-2">
            <div>
              {/* Recent folders */}
              <div className="sp-panel">
                <div className="sp-panel-h">
                  <span>Latest folders</span>
                  <button type="button" className="sp-link-btn" onClick={() => goDashboard("current")}>See all</button>
                </div>
                {loading ? <Skeleton /> : errors.own ? (
                  <div className="sp-msg">Couldn&apos;t load your folders.</div>
                ) : ownFolders.length === 0 ? (
                  <div className="sp-msg">No folders yet. Use New folder to get started.</div>
                ) : (
                  <div className="sp-panel-b">
                    <div className="sp-tiles">
                      {ownFolders.slice(0, 6).map((f) => (
                        <button type="button" key={f.folderId} className="sp-tile" onClick={() => openFolder(f.folderId, f.folderName)} title={f.folderName}>
                          <Glyph color={f.folderColor} />
                          <div className="sp-tile-name">{f.folderName}</div>
                          <div className="sp-tile-sub">{f.subFolderCount || 0} subfolder(s) · {f.parentFilesCount || 0} file(s)</div>
                          <div className="sp-tile-sub">{ago(f.createdOn)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recent uploads */}
              <div className="sp-panel">
                <div className="sp-panel-h">
                  <span>Latest uploaded files</span>
                  <button type="button" className="sp-link-btn" onClick={() => navigate("/search")}>Browse all</button>
                </div>
                {loading ? <Skeleton rows={4} /> : errors.files ? (
                  <div className="sp-msg">Couldn&apos;t load your files.</div>
                ) : files.length === 0 ? (
                  <div className="sp-msg">You haven&apos;t uploaded any files yet.</div>
                ) : (
                  files.slice(0, 6).map((f) => {
                    const ext = extOf(f.fileName);
                    return (
                      <button type="button" key={f.fileId} className="sp-row" onClick={() => openFile(f)}>
                        <span className="sp-ext" style={{ background: EXT_COLORS[ext] || "#8a8886" }}>{ext.slice(0, 4)}</span>
                        <span className="sp-row-main">
                          <div className="sp-row-name">{f.fileName}</div>
                          <div className="sp-row-sub">{formatBytes(f.size)} · uploaded {ago(f.createdOn)}</div>
                        </span>
                        <FiChevronRight size={16} color="#605e5c" />
                      </button>
                    );
                  })
                )}
              </div>

              {/* Shared with me */}
              <div className="sp-panel">
                <div className="sp-panel-h">
                  <span>Latest shared with me</span>
                  <button type="button" className="sp-link-btn" onClick={() => goDashboard("shared")}>See all</button>
                </div>
                {loading ? <Skeleton rows={3} /> : errors.shared ? (
                  <div className="sp-msg">Couldn&apos;t load shared items.</div>
                ) : shared.length === 0 ? (
                  <div className="sp-msg">Nothing has been shared with you yet.</div>
                ) : (
                  shared.slice(0, 5).map((it) => (
                    <button type="button" key={it.sdaId} className="sp-row" onClick={() => openShared(it)}>
                      {it.docType === "Folder" ? <FiFolder size={22} color="#c19c00" /> : <FiFile size={22} className="sp-fileglyph" />}
                      <span className="sp-row-main">
                        <div className="sp-row-name">{it.foldeOrFileName || "Untitled"}</div>
                        <div className="sp-row-sub">Shared by {it.sharedBy} · {ago(it.createdOn)}</div>
                      </span>
                      <span className="sp-pill">{{ 1: "Read-only", 2: "Read/Write", 3: "Read/Write/Download" }[it.accessType] || "Shared"}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              {/* Storage */}
              <div className="sp-panel">
                <div className="sp-panel-h"><span><FiHardDrive size={15} /> Storage</span></div>
                <div className="sp-panel-b">
                  {loading ? <Skeleton rows={2} /> : !storage ? (
                    <div className="sp-msg">No storage limit allocated.</div>
                  ) : (
                    <>
                      <div className="sp-storage-big">{formatBytes(storage.used)}</div>
                      <div className="sp-row-sub">used of {formatBytes(storage.max)}</div>
                      <div className={`sp-meter ${pct >= 100 ? "full" : pct >= 80 ? "warn" : ""}`}><span style={{ width: `${pct}%` }} /></div>
                      <div className="sp-row-sub">{pct}% used · {formatBytes(Math.max(0, storage.max - storage.used))} free</div>
                    </>
                  )}
                </div>
              </div>

              {/* My activity */}
              <div className="sp-panel">
                <div className="sp-panel-h"><span>My recent activity</span></div>
                {loading ? <Skeleton rows={5} /> : errors.activity ? (
                  <div className="sp-msg">Couldn&apos;t load your activity.</div>
                ) : activity.items.length === 0 ? (
                  <div className="sp-msg">No activity recorded yet.</div>
                ) : (
                  <ul className="sp-feed">
                    {activity.items.map((a, i) => {
                      const m = ACT[a.accessType] || ACT.View;
                      const Icon = m.icon;
                      return (
                        <li key={`${a.folderOrFileId}-${a.accessType}-${i}`}>
                          <button type="button" className="sp-feed-item" onClick={() => openActivity(a)}>
                            <span className={`sp-feed-ico ${m.cls}`}><Icon size={14} /></span>
                            <span className="sp-feed-body">
                              <span className="sp-feed-text">
                                {m.verb} {a.docType === "Folder" ? "folder" : "file"} <b>{a.folderOrFileName || "Untitled"}</b>
                              </span>
                              <small>
                                {ago(a.lastAccessedOn)}{a.accessCount > 1 ? ` · ${a.accessCount} times` : ""}
                              </small>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Home;