import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import FileVersionsModal from "../FileVersions/FileVersionsModal";
import { useSelector } from "react-redux";
import { getRecents, addRecent, clearRecents } from "../../common/recentSearches";
import "./search.css";

const config = require("../../services/config.json");
const API = `${config.DDA_API_API_URL}Search/`;

const emptyFilters = {
  docType: "All", extension: "", tag: "", owner: "All",
  fromDate: "", toDate: "", minSizeMB: "", maxSizeMB: "",
};

const formatSize = (bytes) => {
  if (bytes === null || bytes === undefined) return "-";
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + " GB";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
  return bytes + " B";
};

const fmtDate = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

// SharePoint-like file type icons/colours
const TYPE_STYLE = {
  pdf: ["fa-file-pdf", "#d13438"], doc: ["fa-file-word", "#2b579a"], docx: ["fa-file-word", "#2b579a"],
  xls: ["fa-file-excel", "#217346"], xlsx: ["fa-file-excel", "#217346"], csv: ["fa-file-csv", "#217346"],
  ppt: ["fa-file-powerpoint", "#c43e1c"], pptx: ["fa-file-powerpoint", "#c43e1c"],
  png: ["fa-file-image", "#038387"], jpg: ["fa-file-image", "#038387"], jpeg: ["fa-file-image", "#038387"],
  gif: ["fa-file-image", "#038387"], zip: ["fa-file-archive", "#8a6d00"], rar: ["fa-file-archive", "#8a6d00"],
  txt: ["fa-file-alt", "#605e5c"],
};
const iconFor = (item) =>
  item.docType === "Folder"
    ? ["fa-folder", item.folderColor && /^#|rgb/i.test(item.folderColor) ? item.folderColor : "#e3a008"]
    : TYPE_STYLE[item.extension] || ["fa-file", "#8a8886"];

const initials = (n) =>
  (n || "?").split(" ").filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("") || "?";

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const Highlight = ({ text, terms }) => {
  if (!text || !terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map(escapeRe).join("|")})`, "ig");
  return (
    <>
      {String(text).split(re).map((part, i) =>
        i % 2 === 1 ? <mark key={i} className="sps-hl">{part}</mark> : <React.Fragment key={i}>{part}</React.Fragment>
      )}
    </>
  );
};

// Mirrors the API query syntax: words, "exact phrases", tag:x ext:x by:x (operators are not highlighted)
const parseTerms = (q) => {
  const out = [];
  const re = /\w+:(?:"[^"]+"|\S+)|"([^"]+)"|(\S+)/g;
  let m;
  while ((m = re.exec(q || "")) !== null) {
    if (m[1]) out.push(m[1]);
    else if (m[2] && !/^(tag|ext|type|by|owner):/i.test(m[2])) out.push(m[2]);
  }
  return out.slice(0, 6);
};


const TIPS = [
  ['"purchase order"', "Exact phrase"],
  ["tag:finance", "Has tag"],
  ["ext:pdf", "File type"],
  ["by:john", "Created by"],
];

const SORTS = { name: "Name", created: "Created", size: "Size", type: "Type" };

const SearchDocuments = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [versionItem, setVersionItem] = useState(null);
  const urlQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(urlQuery);
  const [draft, setDraft] = useState(emptyFilters);          // refiner pane values (applied with "Apply")
  const [applied, setApplied] = useState({ q: urlQuery, ...emptyFilters, sortBy: "created", sortDir: "desc", page: 1 });
  const [results, setResults] = useState({ items: [], totalCount: 0, totalPages: 0, folderCount: 0, fileCount: 0, extensions: [] });
  const [loading, setLoading] = useState(false);
  const [popularTags, setPopularTags] = useState([]);
  const [tagModal, setTagModal] = useState(null); // { item, tags: [], input: "" }
  const [savingTags, setSavingTags] = useState(false);
  const requestSeq = useRef(0);
  const [focused, setFocused] = useState(false);
  const barRef = useRef(null);
  const searchUserId = useSelector((s) => s.personalInformationReducer.userID);
  const [recents, setRecents] = useState(() => getRecents(searchUserId));
  const remember = (q) => {
    if (!q) return;
    setRecents(addRecent(searchUserId, q));
  };
  useEffect(() => {
    const close = (e) => barRef.current && !barRef.current.contains(e.target) && setFocused(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);



  useEffect(() => {
    if (urlQuery) setRecents(addRecent(searchUserId, urlQuery));
  }, [urlQuery, searchUserId]);

  useEffect(() => {
    setQuery(urlQuery);
    setApplied((p) => ({ ...p, q: urlQuery, page: 1 }));
  }, [urlQuery]);

  const loadTags = useCallback(async () => {
    try {
      const res = await axios.get(`${API}Tags`);
      if (res.data.success) setPopularTags(res.data.data || []);
    } catch (e) { /* suggestions are optional */ }
  }, []);
  useEffect(() => { loadTags(); }, [loadTags]);

  useEffect(() => {
    const run = async () => {
      const seq = ++requestSeq.current;
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
        if (seq !== requestSeq.current) return;
        if (res.data.success) setResults(res.data.data);
        else toast.error(res.data.message || "Search failed");
      } catch (e) {
        if (seq !== requestSeq.current) return;
        toast.error(e.response?.data?.message || "Error while searching");
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    };
    run();
  }, [applied]);

  const terms = useMemo(() => parseTerms(applied.q), [applied.q]);

  const apply = (patch = {}, nextDraft) => {
    const d = nextDraft || draft;
    setApplied((p) => ({ ...p, q: query.trim(), ...d, ...patch, page: 1 }));
  };

  const submit = (e) => { e.preventDefault(); setFocused(false); remember(query.trim()); apply(); };

  const runQuery = (q) => {
    setQuery(q);
    setFocused(false);
    remember(q);
    setApplied((p) => ({ ...p, q, page: 1 }));
  };

  const setDraftAndApply = (patch) => {
    const d = { ...draft, ...patch };
    setDraft(d);
    apply({}, d);
  };

  const validateAndApply = () => {
    if (draft.fromDate && draft.toDate && draft.toDate < draft.fromDate)
      return toast.error("'Created to' cannot be before 'Created from'.");
    if (draft.minSizeMB !== "" && draft.maxSizeMB !== "" && Number(draft.maxSizeMB) < Number(draft.minSizeMB))
      return toast.error("Maximum size cannot be less than minimum size.");
    if ((draft.minSizeMB !== "" && Number(draft.minSizeMB) < 0) || (draft.maxSizeMB !== "" && Number(draft.maxSizeMB) < 0))
      return toast.error("Size cannot be negative.");
    apply();
  };

  const resetAll = () => {
    setQuery("");
    setDraft(emptyFilters);
    setApplied({ q: "", ...emptyFilters, sortBy: "created", sortDir: "desc", page: 1 });
  };

  const toggleSort = (col) =>
    setApplied((p) => ({
      ...p, sortBy: col, page: 1,
      sortDir: p.sortBy === col ? (p.sortDir === "asc" ? "desc" : "asc") : col === "name" || col === "type" ? "asc" : "desc",
    }));

  const activeChips = [
    applied.docType !== "All" && ["docType", applied.docType === "Folder" ? "Folders" : "Files"],
    applied.extension && ["extension", `.${applied.extension.replace(/^\./, "")}`],
    applied.tag && ["tag", `Tag: ${applied.tag}`],
    applied.owner !== "All" && ["owner", applied.owner === "Me" ? "Created by me" : "Created by others"],
    applied.fromDate && ["fromDate", `From ${applied.fromDate}`],
    applied.toDate && ["toDate", `To ${applied.toDate}`],
    applied.minSizeMB !== "" && ["minSizeMB", `≥ ${applied.minSizeMB} MB`],
    applied.maxSizeMB !== "" && ["maxSizeMB", `≤ ${applied.maxSizeMB} MB`],
  ].filter(Boolean);

  const removeChip = (key) => {
    const d = { ...draft, [key]: emptyFilters[key] };
    setDraft(d);
    setApplied((p) => ({ ...p, [key]: emptyFilters[key], page: 1 }));
  };

  /* ---------- actions ---------- */
  const handleView = (item) => {
    if (!item.serverPath) return toast.error("No file path available");
    window.open(item.serverPath, "_blank", "noopener");
  };

  const handleDownload = (item) => {
    const url =
      item.docType === "Folder"
        ? `${config.DDA_API_API_URL}FolderData/DownloadFolder?folderId=${item.id}`
        : `${config.DDA_API_API_URL}FolderData/DownloadFile?fileId=${item.id}`;
    const a = document.createElement("a");
    a.href = url; a.target = "_self"; a.download = "";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // open a folder (or a file's location) in the main library view, with full breadcrumb
  const openLocation = (item, { parent = false } = {}) => {
    let path = item.path || [];
    if (parent) path = path.slice(0, -1);
    if (path.length === 0) {
      if (parent || item.docType === "Folder") {
        if (item.docType === "Folder" && !parent) return toast.error("You don't have a navigable path to this folder.");
        navigate("/dashboard");   // top level
        return;
      }
      return toast.error("This item was shared directly with you, so its folder isn't browsable.");
    }
    const last = path[path.length - 1];
    const p = new URLSearchParams({
      openFolderId: String(last.folderId),
      folderName: last.folderName,
      tab: item.navTab || "current",
      crumbs: JSON.stringify(path),
    });
    if (item.navAccessType) p.set("accessType", String(item.navAccessType));
    if (item.navOwnerId) p.set("ownerId", item.navOwnerId);
    navigate(`/dashboard?${p.toString()}`);
  };

  const copyLink = async (item) => {
    const base = `${window.location.origin}${window.location.pathname.replace(/\/search$|\/dashboard$/, "")}`;
    const url = item.docType === "Folder" || item.path?.length
      ? `${base}/dashboard?openFolderId=${item.containerFolderId}&folderName=${encodeURIComponent(item.path?.slice(-1)[0]?.folderName || "Folder")}`
      : window.location.href;
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    catch (e) { toast.info(url); }
  };

  const openItem = (item) => (item.docType === "Folder" ? openLocation(item) : handleView(item));

  const openTagModal = (item) => {
    const own = item.docType === "Document" ? item.ownTags : item.tags;
    setTagModal({ item, tags: own ? own.split(",").filter(Boolean) : [], input: "" });
  };

  const addTagsFromInput = (modal, raw) => {
    const incoming = raw.split(",").map((t) => t.trim().toLowerCase().slice(0, 30)).filter(Boolean);
    const merged = Array.from(new Set([...modal.tags, ...incoming]));
    if (merged.length > 10) toast.warn("Maximum 10 tags allowed.");
    return { ...modal, tags: merged.slice(0, 10), input: "" };
  };

  const saveTags = async () => {
    const m = addTagsFromInput(tagModal, tagModal.input);
    setSavingTags(true);
    try {
      const res = await axios.post(`${API}SetTags`, { docType: m.item.docType, id: m.item.id, tags: m.tags.join(",") });
      if (res.data.success) {
        toast.success("Tags updated");
        setTagModal(null);
        loadTags();
        setApplied((p) => ({ ...p }));   // refresh results (files also show inherited tags)
      } else toast.error(res.data.message || "Failed to update tags");
    } catch (e) {
      toast.error(e.response?.data?.message || "Error updating tags");
    } finally {
      setSavingTags(false);
    }
  };

  const tabs = [
    ["All", "All", results.folderCount + results.fileCount],
    ["Document", "Files", results.fileCount],
    ["Folder", "Folders", results.folderCount],
  ];

  const sortArrow = (col) =>
    applied.sortBy === col ? <i className={`fas fa-arrow-${applied.sortDir === "asc" ? "up" : "down"}`} style={{ fontSize: 10 }} /> : null;

  return (
    <section className="content scroll-content">
      <div className="sp-search-page">
        {/* search bar */}
        <form onSubmit={submit} role="search" className="d-flex" style={{ gap: 8 }}>
          <div className="sps-barwrap flex-grow-1" ref={barRef}>
            <div className="sps-bar">
              <i className="fas fa-search" />
              <input
                type="search"
                aria-label="Search keywords"
                placeholder='Search files, folders, tags or people  —  try tag:finance ext:pdf by:john'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onKeyDown={(e) => e.key === "Escape" && setFocused(false)}
                maxLength={200}
                autoFocus
              />
              {query && (
                <button type="button" className="sps-clear" onClick={() => setRecents(clearRecents(searchUserId))}>Clear</button>
              )}
            </div>
            {focused && (
              <div className="sps-suggest" role="listbox">
                {recents.length > 0 && (
                  <>
                    <div className="sps-sg-h">
                      Recent
                      <button type="button" className="sps-clear" onClick={() => { setRecents([]); }}>Clear</button>
                    </div>
                    {recents.map((r) => (
                      <button key={r} type="button" className="sps-sg-i" role="option" onClick={() => runQuery(r)}>
                        <i className="fas fa-history" /> {r}
                      </button>
                    ))}
                  </>
                )}
                <div className="sps-sg-h">Search tips</div>
                <div className="sps-sg-tips">
                  {TIPS.map(([t, d]) => (
                    <button key={t} type="button" className="sps-sg-tip"
                      onClick={() => setQuery((q) => (q.trim() ? q.trim() + " " : "") + t)}>
                      <code>{t}</code><span>{d}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button type="submit" className="sps-btn">Search</button>
        </form>

        {/* type tabs with live counts */}
        <div className="sps-tabs" role="tablist">
          {tabs.map(([key, label, n]) => (
            <button
              key={key} type="button" role="tab" aria-selected={applied.docType === key}
              className={`sps-tab ${applied.docType === key ? "active" : ""}`}
              onClick={() => setDraftAndApply({ docType: key, extension: key === "Folder" ? "" : draft.extension })}
            >
              {label}<span className="n">{n}</span>
            </button>
          ))}
        </div>

        <div className="sps-layout">
          {/* refiners */}
          <aside className="sps-refine" aria-label="Refine results">
            {results.extensions.length > 0 && (
              <>
                <h6>File type</h6>
                {results.extensions.map((x) => (
                  <button
                    key={x.key} type="button"
                    className={`sps-facet ${applied.extension === x.key ? "active" : ""}`}
                    onClick={() => setDraftAndApply({ extension: applied.extension === x.key ? "" : x.key, docType: applied.docType === "Folder" ? "All" : applied.docType })}
                  >
                    <span>.{x.key}</span><span className="c">{x.count}</span>
                  </button>
                ))}
              </>
            )}

            <h6>Created by</h6>
            {[["All", "Anyone"], ["Me", "Me"], ["Others", "Others"]].map(([v, l]) => (
              <label key={v} className="sps-radio">
                <input type="radio" name="owner" checked={draft.owner === v} onChange={() => setDraftAndApply({ owner: v })} />
                {l}
              </label>
            ))}

            <h6>Created date</h6>
            <label htmlFor="sps-from">From</label>
            <input id="sps-from" type="date" className="sps-input" value={draft.fromDate}
              onChange={(e) => setDraft({ ...draft, fromDate: e.target.value })} />
            <label htmlFor="sps-to">To</label>
            <input id="sps-to" type="date" className="sps-input" min={draft.fromDate} value={draft.toDate}
              onChange={(e) => setDraft({ ...draft, toDate: e.target.value })} />

            <h6>File size (MB)</h6>
            <div className="sps-row">
              <input type="number" min="0" step="any" className="sps-input" placeholder="Min" value={draft.minSizeMB}
                onChange={(e) => setDraft({ ...draft, minSizeMB: e.target.value })} aria-label="Minimum size in MB" />
              <input type="number" min="0" step="any" className="sps-input" placeholder="Max" value={draft.maxSizeMB}
                onChange={(e) => setDraft({ ...draft, maxSizeMB: e.target.value })} aria-label="Maximum size in MB" />
            </div>

            <h6>Tag</h6>
            <input type="text" className="sps-input mb-2" placeholder="Type a tag" maxLength={30} value={draft.tag}
              onChange={(e) => setDraft({ ...draft, tag: e.target.value })} aria-label="Tag" />
            {popularTags.length > 0 && (
              <div className="sps-tagcloud">
                {popularTags.slice(0, 12).map((t) => (
                  <button
                    key={t.tag} type="button"
                    className={`sps-pill ${applied.tag === t.tag ? "active" : ""}`}
                    onClick={() => setDraftAndApply({ tag: applied.tag === t.tag ? "" : t.tag })}
                  >
                    {t.tag} <small>{t.count}</small>
                  </button>
                ))}
              </div>
            )}

            <div className="d-flex mt-3" style={{ gap: 8 }}>
              <button type="button" className="sps-btn flex-grow-1" onClick={validateAndApply}>Apply</button>
              <button type="button" className="sps-btn ghost" onClick={resetAll}>Reset</button>
            </div>
          </aside>

          {/* results */}
          <div className="sps-main">
            <div className="sps-summary">
              <span aria-live="polite">
                {loading ? "Searching…" : (
                  <>
                    <strong>{results.totalCount}</strong> result{results.totalCount === 1 ? "" : "s"}
                    {applied.q && <> for “{applied.q}”</>}
                  </>
                )}
              </span>
              <span>
                Sort by{" "}
                <select
                  className="sps-input d-inline-block" style={{ width: 120 }} aria-label="Sort by"
                  value={applied.sortBy} onChange={(e) => toggleSort(e.target.value) || undefined}
                >
                  {Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <button type="button" className="sps-act" title="Toggle sort direction"
                  onClick={() => setApplied((p) => ({ ...p, sortDir: p.sortDir === "asc" ? "desc" : "asc", page: 1 }))}>
                  <i className={`fas fa-sort-amount-${applied.sortDir === "asc" ? "up" : "down"}`} />
                </button>
              </span>
            </div>

            {activeChips.length > 0 && (
              <div className="sps-chips">
                {activeChips.map(([key, label]) => (
                  <span key={key} className="sps-chip">
                    {label}
                    <button type="button" aria-label={`Remove ${label}`} onClick={() => removeChip(key)}>×</button>
                  </span>
                ))}
                <button type="button" className="sps-clear" onClick={resetAll} style={{ fontSize: 12 }}>Clear all</button>
              </div>
            )}

            <div className="sps-list">
              <div className="sps-head" role="row">
                <button type="button" className="sps-sort" onClick={() => toggleSort("name")}>Name {sortArrow("name")}</button>
                <span>Location</span>
                <button type="button" className="sps-sort" onClick={() => toggleSort("size")}>Size {sortArrow("size")}</button>
                <span>Created by</span>
                <button type="button" className="sps-sort" onClick={() => toggleSort("created")}>Created {sortArrow("created")}</button>
                <span />
              </div>

              {loading && results.items.length === 0 &&
                [0, 1, 2, 3, 4].map((i) => <div key={i} className="sps-skel" />)}

              {!loading && results.items.length === 0 && (
                <div className="sps-empty">
                  <div className="big"><i className="fas fa-search" /></div>
                  <h5>No results found</h5>
                  <div>Check the spelling, try fewer keywords, or clear some filters.</div>
                  {(activeChips.length > 0 || applied.q) && (
                    <button type="button" className="sps-btn ghost mt-3" onClick={resetAll}>Clear search and filters</button>
                  )}
                </div>
              )}

              <div style={{ opacity: loading && results.items.length ? 0.55 : 1, transition: "opacity .15s" }}>
                {results.items.map((item) => {
                  const [ico, color] = iconFor(item);
                  const tags = item.tags ? item.tags.split(",").filter(Boolean) : [];
                  return (
                    <div key={`${item.docType}-${item.id}`} className="sps-item" role="row">
                      <div className="sps-name">
                        <span className="sps-ico" style={{ background: color }}><i className={`fas ${ico}`} /></span>
                        <div style={{ minWidth: 0 }}>
                          <div className="sps-title" title={item.name}>
                            <button type="button" onClick={() => openItem(item)}
                              title={item.docType === "Folder" ? "Open folder" : "Open file"}>
                              <Highlight text={item.name} terms={terms} />
                            </button>
                            {item.isHide && <span className="sps-hide">Hidden</span>}
                          </div>
                          <div className="sps-sub">
                            {item.docType === "Folder" ? "Folder" : (item.extension || "file").toUpperCase()} · {item.source}
                            {tags.map((t) => (
                              <span key={t} className="sps-pill static ml-1" style={{ fontSize: 11, padding: "0 7px" }}>
                                <Highlight text={t} terms={terms} />
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="sps-loc" title={item.location}>
                        {item.path?.length > 0 || item.docType === "Folder" ? (
                          <button type="button" className="sps-link" onClick={() => openLocation(item, { parent: item.docType === "Folder" })}>
                            {item.location}
                          </button>
                        ) : item.location}
                      </div>
                      <div className="sps-meta-hide">{item.docType === "Folder" ? "—" : formatSize(item.size)}</div>
                      <div className="sps-by sps-meta-hide" title={item.createdByName}>
                        <span className="sps-av">{initials(item.createdByName)}</span>
                        <span className="sps-loc">{item.createdByName}</span>
                      </div>
                      <div className="sps-meta-hide">{fmtDate(item.createdOn)}</div>
                      <div className="sps-actions">
                        <button type="button" className="sps-act" title={item.docType === "Folder" ? "Open folder" : "Open file"}
                          aria-label={`Open ${item.name}`} onClick={() => openItem(item)}>
                          <i className={`fas ${item.docType === "Folder" ? "fa-folder-open" : "fa-external-link-alt"}`} />
                        </button>
                        {item.docType === "Document" && item.path?.length > 0 && (
                          <button type="button" className="sps-act" title="Open file location" aria-label={`Open location of ${item.name}`}
                            onClick={() => openLocation(item)}>
                            <i className="fas fa-folder-tree" />
                          </button>
                        )}
                        <button type="button" className="sps-act" title="Download" aria-label={`Download ${item.name}`} onClick={() => handleDownload(item)}>
                          <i className="fas fa-download" />
                        </button>
                        {item.canEditTags && (
                          <button type="button" className="sps-act" title="Add / edit tags" aria-label={`Edit tags of ${item.name}`} onClick={() => openTagModal(item)}>
                            <i className="fas fa-tag" />
                          </button>
                        )}
                        {item.docType === "Document" && (
                          <button type="button" className="sps-act" title="Version history & co-authoring" aria-label={`Versions of ${item.name}`}
                            onClick={() => setVersionItem({ id: item.id, name: item.name })}>
                            <i className="fas fa-history" />
                          </button>
                        )}
                        {item.path?.length > 0 && (
                          <button type="button" className="sps-act" title="Copy link" aria-label={`Copy link to ${item.name}`} onClick={() => copyLink(item)}>
                            <i className="fas fa-link" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {results.totalPages > 1 && (
              <div className="sps-pager">
                <button type="button" className="sps-btn ghost" disabled={applied.page <= 1}
                  onClick={() => setApplied((p) => ({ ...p, page: p.page - 1 }))}>Previous</button>
                <span>Page {applied.page} of {results.totalPages}</span>
                <button type="button" className="sps-btn ghost" disabled={applied.page >= results.totalPages}
                  onClick={() => setApplied((p) => ({ ...p, page: p.page + 1 }))}>Next</button>
              </div>
            )}
          </div>
        </div>

        {versionItem && (
          <FileVersionsModal
            file={versionItem}
            onClose={() => setVersionItem(null)}
            onChanged={() => setApplied((p) => ({ ...p }))}
          />
        )}

        {/* tag editor */}
        {tagModal && (
          <div className="sps-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && setTagModal(null)}>
            <div className="sps-modal" role="dialog" aria-modal="true" aria-label="Edit tags">
              <header>Edit tags</header>
              <div className="body">
                <div className="sps-sub mb-2">{tagModal.item.name} — {tagModal.item.docType === "Folder" ? "files inside this folder become searchable by these tags." : "this file becomes searchable by these tags."}</div>
                <div className="sps-tagbox">
                  {tagModal.tags.map((t) => (
                    <span key={t} className="sps-pill active">
                      {t}
                      <button type="button" aria-label={`Remove ${t}`}
                        style={{ border: 0, background: "transparent", color: "inherit", padding: 0, cursor: "pointer" }}
                        onClick={() => setTagModal({ ...tagModal, tags: tagModal.tags.filter((x) => x !== t) })}>×</button>
                    </span>
                  ))}
                  <input
                    autoFocus maxLength={30} placeholder={tagModal.tags.length ? "" : "Type a tag and press Enter"}
                    value={tagModal.input}
                    onChange={(e) => setTagModal({ ...tagModal, input: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); setTagModal(addTagsFromInput(tagModal, tagModal.input)); }
                      else if (e.key === "Backspace" && !tagModal.input && tagModal.tags.length)
                        setTagModal({ ...tagModal, tags: tagModal.tags.slice(0, -1) });
                    }}
                  />
                </div>
                <small className="text-muted">Up to 10 tags, 30 characters each.</small>
                {popularTags.length > 0 && (
                  <div className="sps-tagcloud mt-2">
                    {popularTags.filter((t) => !tagModal.tags.includes(t.tag)).slice(0, 8).map((t) => (
                      <button key={t.tag} type="button" className="sps-pill"
                        onClick={() => setTagModal(addTagsFromInput(tagModal, t.tag))}>+ {t.tag}</button>
                    ))}
                  </div>
                )}
              </div>
              <footer>
                <button type="button" className="sps-btn ghost" onClick={() => setTagModal(null)}>Cancel</button>
                <button type="button" className="sps-btn" disabled={savingTags} onClick={saveTags}>
                  {savingTags ? "Saving…" : "Save"}
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default SearchDocuments;
