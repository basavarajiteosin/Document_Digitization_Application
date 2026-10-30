import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { FiFolderPlus, FiFolder, FiUsers, FiFile, FiGrid, FiChevronRight } from "react-icons/fi";

const config = require("../services/config.json");

// Same display format as FolderCreation.js so dates match across pages.
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const istDate = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  let h = istDate.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = pad(h % 12 || 12);
  return `${pad(istDate.getDate())}-${pad(istDate.getMonth() + 1)}-${istDate.getFullYear()} ${h}:${pad(istDate.getMinutes())} ${ampm}`;
};

const formatBytes = (b) => {
  b = Number(b) || 0;
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + " GB";
  if (b >= 1048576) return (b / 1048576).toFixed(2) + " MB";
  if (b >= 1024) return (b / 1024).toFixed(2) + " KB";
  return b + " Bytes";
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
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
  const [shared, setShared] = useState([]);
  const [storage, setStorage] = useState(null);
  const [errors, setErrors] = useState({ own: false, shared: false });

  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    const base = config.DDA_API_API_URL;

    (async () => {
      const [own, sh, emp, lim] = await Promise.allSettled([
        axios.get(`${base}FolderData/GetAllFoldersByCreatedBy/${uid}`),
        // NOTE: this endpoint writes an "Accessed Folder" log row per shared folder; called once per load only.
        axios.get(`${base}FolderData/GetShareAccessDetailsByUser/${uid}`),
        axios.get(`${base}AuthMasterController/GetAllEmpInfo`),
        axios.get(`${base}GlobalAdmin/GetAllUsersDataLimit`),
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
        const list = (own.value.data.data || [])
          .filter((it) => it && typeof it === "object" && it.folderId && visible(it))
          .sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        setOwnFolders(list);
      } else {
        setErrors((e) => ({ ...e, own: true }));
      }

      if (sh.status === "fulfilled" && sh.value.data?.success) {
        const list = (sh.value.data.data || [])
          .filter(
            (it) =>
              it && it.createdBy !== uid && it.accessType != null &&
              (isGlobalAdmin || it.isActive !== false) && visible(it)
          )
          .map((it) => ({ ...it, sharedBy: names[it.createdBy] || "Unknown user" }))
          .sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        setShared(list);
      } else {
        setErrors((e) => ({ ...e, shared: true }));
      }

      if (lim.status === "fulfilled" && lim.value.data?.success) {
        const mine = (lim.value.data.data || []).find((x) => x.userId === uid);
        if (mine) setStorage({ used: mine.usedStorage || 0, max: mine.maximumAllocatedStorage || 0 });
      }
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

  const openOwn = (f) =>
    navigate(`/dashboard?openFolderId=${f.folderId}&folderName=${encodeURIComponent(f.folderName || "Folder")}`);

  const openShared = (it) => {
    if (it.docType === "Folder") {
      navigate(
        `/dashboard?openFolderId=${it.folderOrFileId}&tab=shared&accessType=${it.accessType}` +
          `&ownerId=${it.createdBy || ""}&folderName=${encodeURIComponent(it.foldeOrFileName || "Folder")}`
      );
    } else {
      goDashboard("shared");
    }
  };

  const extraLinks = (personalInfo.menuItemNames || [])
    .filter((m) => m.appRoute && m.appRoute !== "/dashboard" && m.appRoute !== "/home")
    .slice(0, 4);

  const pct = storage && storage.max > 0 ? Math.min(100, Math.round((storage.used / storage.max) * 100)) : 0;
  const fullName = `${personalInfo.firstName || ""}`.trim();

  return (
    <section className="content">
      <div className="container-fluid">
        <div className="sp-home">
          <div className="sp-hero">
            <div>
              <h2>{greeting()}{fullName ? `, ${fullName}` : ""}</h2>
              <p>{new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          </div>

          <div className="sp-quick">
            <button type="button" className="sp-qa" onClick={() => goDashboard("current", "newFolder")}>
              <span className="sp-qa-ico"><FiFolderPlus size={20} /></span>New folder
            </button>
            <button type="button" className="sp-qa" onClick={() => goDashboard("current")}>
              <span className="sp-qa-ico"><FiFolder size={20} /></span>My files
            </button>
            <button type="button" className="sp-qa" onClick={() => goDashboard("shared")}>
              <span className="sp-qa-ico"><FiUsers size={20} /></span>Shared with me
            </button>
            {extraLinks.map((m) => (
              <button key={m.appRoute} type="button" className="sp-qa" onClick={() => navigate(m.appRoute)}>
                <span className="sp-qa-ico"><FiGrid size={20} /></span>{m.appName}
              </button>
            ))}
          </div>

          <div className="sp-grid-2">
            <div>
              <div className="sp-panel">
                <div className="sp-panel-h">
                  <span>Recent folders</span>
                  <button type="button" className="sp-link-btn" onClick={() => goDashboard("current")}>See all</button>
                </div>
                {loading ? <Skeleton /> : errors.own ? (
                  <div className="sp-msg">Couldn&apos;t load your folders.</div>
                ) : ownFolders.length === 0 ? (
                  <div className="sp-msg">No folders yet. Use New folder to get started.</div>
                ) : (
                  <div className="sp-panel-b">
                    <div className="sp-tiles">
                      {ownFolders.slice(0, 8).map((f) => (
                        <button type="button" key={f.folderId} className="sp-tile" onClick={() => openOwn(f)} title={f.folderName}>
                          <Glyph color={f.folderColor} />
                          <div className="sp-tile-name">{f.folderName}</div>
                          <div className="sp-tile-sub">
                            {(f.subFolderCount || 0)} subfolder(s) · {(f.parentFilesCount || 0)} file(s)
                          </div>
                          <div className="sp-tile-sub">{formatDate(f.createdOn)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="sp-panel">
                <div className="sp-panel-h">
                  <span>Shared with me</span>
                  <button type="button" className="sp-link-btn" onClick={() => goDashboard("shared")}>See all</button>
                </div>
                {loading ? <Skeleton rows={3} /> : errors.shared ? (
                  <div className="sp-msg">Couldn&apos;t load shared items.</div>
                ) : shared.length === 0 ? (
                  <div className="sp-msg">Nothing has been shared with you yet.</div>
                ) : (
                  shared.slice(0, 6).map((it) => (
                    <button type="button" key={it.sdaId} className="sp-row" onClick={() => openShared(it)}>
                      {it.docType === "Folder" ? <FiFolder size={22} color="#c19c00" /> : <FiFile size={22} className="sp-fileglyph" />}
                      <span className="sp-row-main">
                        <div className="sp-row-name">{it.foldeOrFileName || "Untitled"}</div>
                        <div className="sp-row-sub">Shared by {it.sharedBy} · {formatDate(it.createdOn)}</div>
                      </span>
                      <span className="sp-pill">{{ 1: "Read-only", 2: "Read/Write", 3: "Read/Write/Download" }[it.accessType] || "Shared"}</span>
                      <FiChevronRight size={16} color="#605e5c" />
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="sp-panel">
                <div className="sp-panel-h">Storage</div>
                <div className="sp-panel-b">
                  {loading ? <Skeleton rows={2} /> : !storage ? (
                    <div className="sp-msg">No storage limit allocated.</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 22, fontWeight: 600 }}>{formatBytes(storage.used)}</div>
                      <div className="sp-row-sub">used of {formatBytes(storage.max)}</div>
                      <div className={`sp-meter ${pct >= 100 ? "full" : pct >= 80 ? "warn" : ""}`}>
                        <span style={{ width: `${pct}%` }} />
                      </div>
                      <div className="sp-row-sub">{pct}% used</div>
                    </>
                  )}
                </div>
              </div>
              <div className="sp-panel">
                <div className="sp-panel-h">At a glance</div>
                <div className="sp-panel-b">
                  <div className="sp-row-sub">Folders: <strong>{loading ? "…" : ownFolders.length}</strong></div>
                  <div className="sp-row-sub">Shared items: <strong>{loading ? "…" : shared.length}</strong></div>
                  <div className="sp-row-sub">Role: <strong>{personalInfo.userRole}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Home;