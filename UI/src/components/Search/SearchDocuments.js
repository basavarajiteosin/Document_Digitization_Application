import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import { Menu, MenuItem, MenuButton, MenuDivider } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";
import {
  FiFolder, FiFile, FiSearch, FiX, FiFilter, FiMoreVertical, FiExternalLink, FiMapPin, FiDownload,
  FiInfo, FiShield, FiTag, FiClock, FiMessageSquare, FiLink, FiTrash2, FiBriefcase, FiArrowUp, FiArrowDown,
} from "react-icons/fi";
import FileVersionsModal from "../FileVersions/FileVersionsModal";
import ItemDetailsModal from "../ItemDetails/ItemDetailsModal";
import TagsModal from "../Tags/TagsModal";
import CommentsReviewModal from "../Comments/CommentsReviewModal";
import AssignProjectModal from "../Projects/AssignProjectModal";
import "./searchResults.css";

const config = require("../../services/config.json");
const API = `${config.DDA_API_API_URL}Search/`;

const emptyFilters = {
  docType: "All", extension: "", tag: "", owner: "All",
  fromDate: "", toDate: "", minSizeMB: "", maxSizeMB: "",
};

const formatSize = (b) => {
  if (b === null || b === undefined) return "—";
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + " GB";
  if (b >= 1048576) return (b / 1048576).toFixed(2) + " MB";
  if (b >= 1024) return (b / 1024).toFixed(1) + " KB";
  return b + " B";
};
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";

const TYPE_COLOR = {
  pdf: "#d13438", doc: "#2b579a", docx: "#2b579a", xls: "#217346", xlsx: "#217346", csv: "#217346",
  ppt: "#c43e1c", pptx: "#c43e1c", png: "#038387", jpg: "#038387", jpeg: "#038387", gif: "#038387",
  zip: "#8a6d00", rar: "#8a6d00", txt: "#605e5c",
};
const colorFor = (i) =>
  i.docType === "Folder"
    ? (i.folderColor && /^#|rgb/i.test(i.folderColor) ? i.folderColor : "#e3a008")
    : TYPE_COLOR[i.extension] || "#8a8886";

const initials = (n) => (n || "?").split(" ").filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("") || "?";
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const Highlight = ({ text, terms }) => {
  if (!text || !terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map(escapeRe).join("|")})`, "ig");
  return <>{String(text).split(re).map((p, i) => (i % 2 === 1 ? <mark key={i} className="ssr-hl">{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>))}</>;
};
const parseTerms = (q) => {
  const out = []; const re = /\w+:(?:"[^"]+"|\S+)|"([^"]+)"|(\S+)/g; let m;
  while ((m = re.exec(q || "")) !== null) {
    if (m[1]) out.push(m[1]);
    else if (m[2] && !/^(tag|ext|type|by|owner):/i.test(m[2])) out.push(m[2]);
  }
  return out.slice(0, 6);
};

const SORTS = { name: "Name", created: "Created", size: "Size", type: "Type" };

const SearchDocuments = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlQuery = searchParams.get("q") || "";
  const me = useSelector((s) => s.personalInformationReducer);
  const myId = (me.userID || "").toLowerCase();
  const isAdmin = me.userRole === "Administrator" || me.userRole === "Global Admin";

  const [draft, setDraft] = useState(emptyFilters);
  const [applied, setApplied] = useState({ q: urlQuery, ...emptyFilters, sortBy: "name", sortDir: "asc", page: 1 });
  const [results, setResults] = useState({ items: [], totalCount: 0, totalPages: 0, folderCount: 0, fileCount: 0, extensions: [] });
  const [loading, setLoading] = useState(false);
  const [popularTags, setPopularTags] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const seq = useRef(0);

  const [versionItem, setVersionItem] = useState(null);
  const [tagModal, setTagModal] = useState(null);
  const [detailsItem, setDetailsItem] = useState(null);
  const [collabItem, setCollabItem] = useState(null);
  const [assignItem, setAssignItem] = useState(null);

  useEffect(() => { setApplied((p) => ({ ...p, q: urlQuery, page: 1 })); }, [urlQuery]);

  const loadTags = useCallback(async () => {
    try {
      const r = await axios.get(`${API}Tags`);
      if (r.data.success) setPopularTags(r.data.data || []);
    } catch (e) { /* optional */ }
  }, []);
  useEffect(() => { loadTags(); }, [loadTags]);

  useEffect(() => {
    (async () => {
      const id = ++seq.current;
      setLoading(true);
      try {
        const params = {
          query: applied.q, docType: applied.docType, extension: applied.extension, tag: applied.tag,
          owner: applied.owner, fromDate: applied.fromDate, toDate: applied.toDate,
          minSizeMB: applied.minSizeMB, maxSizeMB: applied.maxSizeMB,
          sortBy: applied.sortBy, sortDir: applied.sortDir, page: applied.page, pageSize: 10,
        };
        Object.keys(params).forEach((k) => (params[k] === "" || params[k] === undefined) && delete params[k]);
        const res = await axios.get(`${API}Documents`, { params });
        if (id !== seq.current) return;
        if (res.data.success) setResults(res.data.data);
        else toast.error(res.data.message || "Search failed");
      } catch (e) {
        if (id === seq.current) toast.error(e.response?.data?.message || "Error while searching");
      } finally {
        if (id === seq.current) setLoading(false);
      }
    })();
  }, [applied]);

  const terms = useMemo(() => parseTerms(applied.q), [applied.q]);
  const refresh = () => setApplied((p) => ({ ...p }));

  const applyDraft = (patch = {}, d = draft) => setApplied((p) => ({ ...p, ...d, ...patch, page: 1 }));
  const setDraftAndApply = (patch) => { const d = { ...draft, ...patch }; setDraft(d); applyDraft({}, d); };

  const validateAndApply = () => {
    if (draft.fromDate && draft.toDate && draft.toDate < draft.fromDate) return toast.error("'To' date cannot be before 'From' date.");
    if (draft.minSizeMB !== "" && draft.maxSizeMB !== "" && Number(draft.maxSizeMB) < Number(draft.minSizeMB))
      return toast.error("Maximum size cannot be less than minimum size.");
    if ((draft.minSizeMB !== "" && Number(draft.minSizeMB) < 0) || (draft.maxSizeMB !== "" && Number(draft.maxSizeMB) < 0))
      return toast.error("Size cannot be negative.");
    applyDraft(); setShowFilters(false);
  };

  const resetFilters = () => { setDraft(emptyFilters); setApplied((p) => ({ ...p, ...emptyFilters, page: 1 })); };
  const clearSearch = () => { resetFilters(); navigate("/dashboard"); };

  const toggleSort = (col) =>
    setApplied((p) => ({
      ...p, sortBy: col, page: 1,
      sortDir: p.sortBy === col ? (p.sortDir === "asc" ? "desc" : "asc") : col === "name" || col === "type" ? "asc" : "desc",
    }));

  const chips = [
    applied.docType !== "All" && ["docType", applied.docType === "Folder" ? "Folders" : "Files"],
    applied.extension && ["extension", `.${applied.extension}`],
    applied.tag && ["tag", `Tag: ${applied.tag}`],
    applied.owner !== "All" && ["owner", applied.owner === "Me" ? "Created by me" : "Created by others"],
    applied.fromDate && ["fromDate", `From ${applied.fromDate}`],
    applied.toDate && ["toDate", `To ${applied.toDate}`],
    applied.minSizeMB !== "" && ["minSizeMB", `≥ ${applied.minSizeMB} MB`],
    applied.maxSizeMB !== "" && ["maxSizeMB", `≤ ${applied.maxSizeMB} MB`],
  ].filter(Boolean);

  const removeChip = (k) => { setDraft((d) => ({ ...d, [k]: emptyFilters[k] })); setApplied((p) => ({ ...p, [k]: emptyFilters[k], page: 1 })); };

  /* ---------- actions ---------- */
  const handleView = (i) => (i.serverPath ? window.open(i.serverPath, "_blank", "noopener") : toast.error("No file path available"));

  const handleDownload = (i) => {
    const url = i.docType === "Folder"
      ? `${config.DDA_API_API_URL}FolderData/DownloadFolder?folderId=${i.id}`
      : `${config.DDA_API_API_URL}FolderData/DownloadFile?fileId=${i.id}`;
    const a = document.createElement("a"); a.href = url; a.target = "_self"; a.download = "";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const openLocation = (i, { parent = false } = {}) => {
    let path = i.path || [];
    if (parent) path = path.slice(0, -1);
    if (path.length === 0) {
      if (parent || i.docType === "Document") {
        if (i.docType === "Document" && !parent) return toast.error("This item was shared directly with you, so its folder isn't browsable.");
        return navigate("/dashboard");
      }
      return toast.error("You don't have a navigable path to this folder.");
    }
    const last = path[path.length - 1];
    const p = new URLSearchParams({
      openFolderId: String(last.folderId), folderName: last.folderName,
      tab: i.navTab || "current", crumbs: JSON.stringify(path),
    });
    if (i.navAccessType) p.set("accessType", String(i.navAccessType));
    if (i.navOwnerId) p.set("ownerId", i.navOwnerId);
    navigate(`/dashboard?${p.toString()}`);
  };

  const copyLink = async (i) => {
    const base = `${window.location.origin}${window.location.pathname.replace(/\/search$|\/dashboard$/, "")}`;
    const url = `${base}/dashboard?openFolderId=${i.containerFolderId}&folderName=${encodeURIComponent(i.path?.slice(-1)[0]?.folderName || "Folder")}`;
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); } catch (e) { toast.info(url); }
  };

  const deleteItem = async (i) => {
    if (!window.confirm(`Delete ${i.docType === "Folder" ? "folder" : "file"} "${i.name}"? This cannot be undone.`)) return;
    try {
      const res = i.docType === "Folder"
        ? await axios.post(`${config.DDA_API_API_URL}FolderData/DeleteFolder`, { folderId: i.id, folderName: i.name, deletedBy: me.userID })
        : await axios.post(`${config.DDA_API_API_URL}FolderData/DeleteFile/${i.id}`);
      if (res.data.success) { toast.success("Deleted successfully"); refresh(); }
      else toast.error(res.data.message || "Delete failed");
    } catch (e) { toast.error(e.response?.data?.message || "Delete failed"); }
  };

  const openItem = (i) => (i.docType === "Folder" ? openLocation(i) : handleView(i));
  const asRef = (i) => ({ docType: i.docType, id: i.id, name: i.name });
  const isOwner = (i) => (i.createdById || "").toLowerCase() === myId;
  const hasPath = (i) => (i.path?.length || 0) > 0;

  const RowMenu = ({ item }) => (
    <Menu
      portal
      align="end"
      menuClassName="ssr-menu"
      menuButton={<MenuButton className="ssr-dots" aria-label={`Actions for ${item.name}`}><FiMoreVertical size={18} /></MenuButton>}
    >
      <MenuItem onClick={() => openItem(item)}><FiExternalLink /> {item.docType === "Folder" ? "Open folder" : "Open file"}</MenuItem>
      {(item.docType === "Document" ? hasPath(item) : true) && (
        <MenuItem onClick={() => openLocation(item, { parent: item.docType === "Folder" })}><FiMapPin /> Open file location</MenuItem>
      )}
      <MenuItem onClick={() => handleDownload(item)}><FiDownload /> Download</MenuItem>
      <MenuDivider />
      <MenuItem onClick={() => setDetailsItem({ ...asRef(item), tab: "details" })}><FiInfo /> Details</MenuItem>
      <MenuItem onClick={() => setDetailsItem({ ...asRef(item), tab: "access" })}><FiShield /> Details and access</MenuItem>
      <MenuItem onClick={() => setTagModal(asRef(item))}><FiTag /> {item.canEditTags ? "Add / edit tags" : "View tags"}</MenuItem>
      <MenuItem onClick={() => setCollabItem(asRef(item))}><FiMessageSquare /> Comments &amp; Review</MenuItem>
      {item.docType === "Document" && (
        <MenuItem onClick={() => setVersionItem({ id: item.id, name: item.name })}><FiClock /> Version history</MenuItem>
      )}
      {isAdmin && (
        <MenuItem onClick={() => setAssignItem(asRef(item))}><FiBriefcase /> Assign to Project</MenuItem>
      )}
      {hasPath(item) && <MenuItem onClick={() => copyLink(item)}><FiLink /> Copy link</MenuItem>}
      {(isOwner(item) || me.userRole === "Global Admin") && (
        <>
          <MenuDivider />
          <MenuItem className="ssr-danger" onClick={() => deleteItem(item)}><FiTrash2 /> Delete</MenuItem>
        </>
      )}
    </Menu>
  );

  const tabs = [
    ["All", "All", results.folderCount + results.fileCount],
    ["Document", "Files", results.fileCount],
    ["Folder", "Folders", results.folderCount],
  ];
  const arrow = (c) => applied.sortBy === c && (applied.sortDir === "asc" ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />);

  return (
    <section className="content scroll-content">
      <div className="ssr-page">
        {/* summary header */}
        <div className="ssr-hero">
          <div>
            <h2>{applied.q ? <>Results for “{applied.q}”</> : "All documents"}</h2>
            <p aria-live="polite">
              {loading ? "Searching…" : `${results.totalCount} item${results.totalCount === 1 ? "" : "s"} found`}
              {applied.q && (
                <button type="button" className="ssr-linkbtn" onClick={clearSearch}>
                  <FiX size={13} /> Clear search
                </button>
              )}
            </p>
          </div>
          <div className="ssr-stats">
            <div className="ssr-stat"><FiFolder /><b>{results.folderCount}</b><span>Folders</span></div>
            <div className="ssr-stat"><FiFile /><b>{results.fileCount}</b><span>Files</span></div>
          </div>
        </div>

        {/* toolbar */}
        <div className="ssr-toolbar">
          <div className="ssr-tabs" role="tablist">
            {tabs.map(([k, l, n]) => (
              <button key={k} type="button" role="tab" aria-selected={applied.docType === k}
                className={applied.docType === k ? "active" : ""}
                onClick={() => setDraftAndApply({ docType: k, extension: k === "Folder" ? "" : draft.extension })}>
                {l}<span>{n}</span>
              </button>
            ))}
          </div>
          <div className="ssr-tools">
            <label className="ssr-sort">
              <span>Sort</span>
              <select value={applied.sortBy} onChange={(e) => toggleSort(e.target.value)} aria-label="Sort by">
                {Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <button type="button" className="ssr-iconbtn" title="Toggle direction"
                onClick={() => setApplied((p) => ({ ...p, sortDir: p.sortDir === "asc" ? "desc" : "asc", page: 1 }))}>
                {applied.sortDir === "asc" ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />}
              </button>
            </label>
            <button type="button" className={`ssr-btn ghost ssr-filter-toggle ${showFilters ? "on" : ""}`} onClick={() => setShowFilters((v) => !v)}>
              <FiFilter size={14} /> Filters{chips.length > 0 && <span className="ssr-count">{chips.length}</span>}
            </button>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="ssr-chips">
            {chips.map(([k, l]) => (
              <span key={k} className="ssr-chip">{l}<button type="button" aria-label={`Remove ${l}`} onClick={() => removeChip(k)}><FiX size={12} /></button></span>
            ))}
            <button type="button" className="ssr-linkbtn" onClick={resetFilters}>Clear all</button>
          </div>
        )}

        <div className="ssr-layout">
          {/* refine panel */}
          <aside className={`ssr-refine ${showFilters ? "open" : ""}`} aria-label="Refine results">
            <div className="ssr-refine-head">
              <b>Refine results</b>
              <button type="button" className="ssr-iconbtn ssr-refine-close" onClick={() => setShowFilters(false)} aria-label="Close filters"><FiX size={16} /></button>
            </div>

            {results.extensions.length > 0 && (
              <>
                <h6>File type</h6>
                {results.extensions.map((x) => (
                  <button key={x.key} type="button" className={`ssr-facet ${applied.extension === x.key ? "active" : ""}`}
                    onClick={() => setDraftAndApply({ extension: applied.extension === x.key ? "" : x.key, docType: applied.docType === "Folder" ? "All" : applied.docType })}>
                    <span>.{x.key}</span><em>{x.count}</em>
                  </button>
                ))}
              </>
            )}

            <h6>Created by</h6>
            {[["All", "Anyone"], ["Me", "Me"], ["Others", "Others"]].map(([v, l]) => (
              <label key={v} className="ssr-radio">
                <input type="radio" name="ssr-owner" checked={draft.owner === v} onChange={() => setDraftAndApply({ owner: v })} /> {l}
              </label>
            ))}

            <h6>Created date</h6>
            <div className="ssr-row">
              <input type="date" className="ssr-input" aria-label="From date" value={draft.fromDate} onChange={(e) => setDraft({ ...draft, fromDate: e.target.value })} />
              <input type="date" className="ssr-input" aria-label="To date" min={draft.fromDate} value={draft.toDate} onChange={(e) => setDraft({ ...draft, toDate: e.target.value })} />
            </div>

            <h6>File size (MB)</h6>
            <div className="ssr-row">
              <input type="number" min="0" step="any" className="ssr-input" placeholder="Min" value={draft.minSizeMB} onChange={(e) => setDraft({ ...draft, minSizeMB: e.target.value })} />
              <input type="number" min="0" step="any" className="ssr-input" placeholder="Max" value={draft.maxSizeMB} onChange={(e) => setDraft({ ...draft, maxSizeMB: e.target.value })} />
            </div>

            <h6>Tag</h6>
            <input type="text" className="ssr-input" placeholder="Type a tag" maxLength={30} value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} />
            {popularTags.length > 0 && (
              <div className="ssr-tagcloud">
                {popularTags.slice(0, 12).map((t) => (
                  <button key={t.tag} type="button" className={`ssr-pill ${applied.tag === t.tag ? "active" : ""}`}
                    onClick={() => setDraftAndApply({ tag: applied.tag === t.tag ? "" : t.tag })}>
                    {t.tag} <small>{t.count}</small>
                  </button>
                ))}
              </div>
            )}

            <div className="ssr-refine-actions">
              <button type="button" className="ssr-btn" onClick={validateAndApply}>Apply</button>
              <button type="button" className="ssr-btn ghost" onClick={resetFilters}>Reset</button>
            </div>
          </aside>
          {showFilters && <div className="ssr-backdrop" onClick={() => setShowFilters(false)} />}

          {/* results table */}
          <div className="ssr-main">
            <div className="ssr-tablewrap">
              <table className="ssr-table">
                <thead>
                  <tr>
                    <th><button type="button" onClick={() => toggleSort("name")}>Name {arrow("name")}</button></th>
                    <th>Location</th>
                    <th><button type="button" onClick={() => toggleSort("size")}>Size {arrow("size")}</button></th>
                    <th>Created by</th>
                    <th><button type="button" onClick={() => toggleSort("created")}>Created {arrow("created")}</button></th>
                    <th className="ssr-th-act" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody style={{ opacity: loading && results.items.length ? 0.55 : 1 }}>
                  {loading && results.items.length === 0 &&
                    [0, 1, 2, 3, 4].map((i) => (
                      <tr key={i} className="ssr-skelrow"><td colSpan={6}><span className="ssr-skel" /></td></tr>
                    ))}

                  {!loading && results.items.length === 0 && (
                    <tr><td colSpan={6}>
                      <div className="ssr-empty">
                        <FiSearch size={40} />
                        <h5>No results found</h5>
                        <p>Check the spelling, try fewer keywords, or clear some filters.</p>
                        {(chips.length > 0 || applied.q) && <button type="button" className="ssr-btn ghost" onClick={clearSearch}>Clear search and filters</button>}
                      </div>
                    </td></tr>
                  )}

                  {results.items.map((item) => {
                    const tags = item.tags ? item.tags.split(",").filter(Boolean) : [];
                    const Icon = item.docType === "Folder" ? FiFolder : FiFile;
                    return (
                      <tr key={`${item.docType}-${item.id}`}>
                        <td data-label="Name">
                          <div className="ssr-name">
                            <span className="ssr-ico" style={{ background: colorFor(item) }}><Icon size={16} /></span>
                            <div className="ssr-namebox">
                              <button type="button" className="ssr-title" title={item.name} onClick={() => openItem(item)}>
                                <Highlight text={item.name} terms={terms} />
                              </button>
                              {item.isHide && <span className="ssr-hide">Hidden</span>}
                              <div className="ssr-sub">
                                {item.docType === "Folder" ? "Folder" : (item.extension || "file").toUpperCase()} · {item.source}
                                {tags.slice(0, 3).map((t) => <span key={t} className="ssr-pill static"><Highlight text={t} terms={terms} /></span>)}
                                {tags.length > 3 && <span className="ssr-pill static">+{tags.length - 3}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Location" className="ssr-loc" title={item.location}>
                          {hasPath(item) || item.docType === "Folder" ? (
                            <button type="button" className="ssr-link" onClick={() => openLocation(item, { parent: item.docType === "Folder" })}>{item.location}</button>
                          ) : item.location}
                        </td>
                        <td data-label="Size">{item.docType === "Folder" ? "—" : formatSize(item.size)}</td>
                        <td data-label="Created by">
                          <span className="ssr-by"><span className="ssr-av">{initials(item.createdByName)}</span><span>{item.createdByName}</span></span>
                        </td>
                        <td data-label="Created">{fmtDate(item.createdOn)}</td>
                        <td className="ssr-td-act"><RowMenu item={item} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {results.totalPages > 1 && (
              <div className="ssr-pager">
                <button type="button" className="ssr-btn ghost" disabled={applied.page <= 1} onClick={() => setApplied((p) => ({ ...p, page: p.page - 1 }))}>Previous</button>
                <span>Page {applied.page} of {results.totalPages}</span>
                <button type="button" className="ssr-btn ghost" disabled={applied.page >= results.totalPages} onClick={() => setApplied((p) => ({ ...p, page: p.page + 1 }))}>Next</button>
              </div>
            )}
          </div>
        </div>

        {versionItem && <FileVersionsModal file={versionItem} onClose={() => setVersionItem(null)} onChanged={refresh} />}
        {tagModal && <TagsModal item={tagModal} onClose={() => setTagModal(null)} onSaved={() => { loadTags(); refresh(); }} />}
        {detailsItem && <ItemDetailsModal item={detailsItem} initialTab={detailsItem.tab} onClose={() => setDetailsItem(null)} onChanged={refresh} />}
        {collabItem && <CommentsReviewModal item={collabItem} onClose={() => setCollabItem(null)} />}
        {assignItem && <AssignProjectModal item={assignItem} onClose={() => setAssignItem(null)} />}
      </div>
    </section>
  );
};

export default SearchDocuments;