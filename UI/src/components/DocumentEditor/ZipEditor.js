import React, { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { toast } from "react-toastify";
import {
  FiFolder, FiFile, FiFileText, FiImage, FiDownload, FiTrash2, FiEdit2, FiFolderPlus, FiFilePlus,
  FiUpload, FiSearch, FiHome, FiArrowUp, FiArrowDown, FiArrowLeft, FiCheck, FiX,
} from "react-icons/fi";
import TextEditor from "./TextEditor";
import { downloadBytes } from "../../services/documentOperationsService";

const MAX_TOTAL = 1024 * 1024 * 1024;       // refuse archives that expand beyond 1 GB (zip-bomb guard)
const MAX_PREVIEW = 5 * 1024 * 1024;
const TEXT_EXT = ["txt", "log", "md", "json", "xml", "csv", "html", "htm", "css", "js", "jsx", "ts", "yml", "yaml", "ini", "cfg", "conf", "sql", "sh", "bat", "py", "java", "cs", "properties"];
const IMG_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];
const LEVELS = [["STORE", 0, "Store (no compression)"], ["DEFLATE", 1, "Fast"], ["DEFLATE", 6, "Normal"], ["DEFLATE", 9, "Maximum"]];

const extOf = (n = "") => (n.includes(".") ? n.split(".").pop().toLowerCase() : "");
const fmtSize = (b) => {
  b = Number(b) || 0;
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + " GB";
  if (b >= 1048576) return (b / 1048576).toFixed(2) + " MB";
  if (b >= 1024) return (b / 1024).toFixed(1) + " KB";
  return b + " B";
};
const badName = (n) => !n || /(^|[\\/])\.\.($|[\\/])/.test(n) || /^[\\/]/.test(n) || /[\\:*?"<>|]/.test(n);
const baseName = (p) => p.replace(/\/$/, "").split("/").pop();

/** ZIP viewer/editor: browse, preview, edit text entries, add/rename/delete, extract, compression level. */
const ZipEditor = ({ file, buf, canEdit, onReady, onDirty, onError, registerApi }) => {
  const zipRef = useRef(null);
  const sizesRef = useRef(new Map());
  const levelRef = useRef(2);
  const entryApi = useRef(null);
  const fileInput = useRef(null);
  const cb = useRef({});
  cb.current = { onReady, onDirty, onError };

  const [tick, setTick] = useState(0);
  const [cwd, setCwd] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [sel, setSel] = useState(() => new Set());
  const [level, setLevel] = useState(2);
  const [open, setOpen] = useState(null);       // { path, kind: "text"|"image", buf?, url? }
  const [entryDirty, setEntryDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const changed = () => { setTick((t) => t + 1); cb.current.onDirty?.(); };
  const sizeOf = (p, f) => sizesRef.current.get(p) ?? f?._data?.uncompressedSize ?? 0;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const z = await JSZip.loadAsync(buf, { createFolders: true });
        let total = 0;
        z.forEach((p, f) => { total += f._data?.uncompressedSize || 0; });
        if (total > MAX_TOTAL) throw new Error("This archive expands to more than 1 GB and cannot be opened in the browser.");
        if (!alive) return;
        zipRef.current = z;
        registerApi?.({
          getBytes: () => {
            const [compression, lvl] = LEVELS[levelRef.current];
            return zipRef.current.generateAsync({ type: "uint8array", compression, compressionOptions: { level: lvl || 1 } });
          },
        });
        setTick(1);
        cb.current.onReady?.();
      } catch (e) {
        if (alive) cb.current.onError?.(new Error(/encrypt/i.test(e?.message) ? "Password-protected ZIP files are not supported." : e?.message || "Invalid ZIP file."));
      }
    })();
    return () => { alive = false; registerApi?.(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { if (open?.url) URL.revokeObjectURL(open.url); }, [open]);

  const rows = useMemo(() => {
    const z = zipRef.current;
    if (!z) return [];
    const q = query.trim().toLowerCase();
    const out = [];
    z.forEach((p, f) => {
      if (q) { if (!p.toLowerCase().includes(q)) return; }
      else {
        if (!p.startsWith(cwd)) return;
        const rest = p.slice(cwd.length).replace(/\/$/, "");
        if (!rest || rest.includes("/")) return;
      }
      out.push({ path: p, name: q ? p.replace(/\/$/, "") : baseName(p), dir: f.dir, size: f.dir ? 0 : sizeOf(p, f), date: f.date });
    });
    const d = sort.dir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      if (a.dir !== b.dir) return a.dir ? -1 : 1;
      if (sort.key === "size") return (a.size - b.size) * d;
      if (sort.key === "date") return (new Date(a.date) - new Date(b.date)) * d;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) * d;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, cwd, query, sort]);

  const stats = useMemo(() => {
    const z = zipRef.current;
    let files = 0, dirs = 0, size = 0;
    if (z) z.forEach((p, f) => { if (f.dir) dirs++; else { files++; size += sizeOf(p, f); } });
    return { files, dirs, size };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const arrow = (k) => sort.key === k && (sort.dir === "asc" ? <FiArrowUp size={11} /> : <FiArrowDown size={11} />);
  const toggleSel = (p) => setSel((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const allSelected = rows.length > 0 && rows.every((r) => sel.has(r.path));

  const crumbs = cwd.split("/").filter(Boolean).map((n, i, a) => ({ n, p: a.slice(0, i + 1).join("/") + "/" }));
  const goto = (p) => { setCwd(p); setQuery(""); setSel(new Set()); };

  const openEntry = async (r) => {
    if (r.dir) return goto(r.path);
    const e = extOf(r.path);
    const isText = TEXT_EXT.includes(e) || !e;
    const isImg = IMG_EXT.includes(e);
    if (!isText && !isImg) return toast.info("No preview for this file type. Use Download.");
    if (r.size > MAX_PREVIEW) return toast.info("This file is too large to preview. Use Download.");
    try {
      if (isImg) {
        const blob = await zipRef.current.file(r.path).async("blob");
        setOpen({ path: r.path, kind: "image", url: URL.createObjectURL(blob) });
      } else {
        const bytes = await zipRef.current.file(r.path).async("arraybuffer");
        setEntryDirty(false);
        setOpen({ path: r.path, kind: "text", buf: bytes });
      }
    } catch (err) { toast.error(err?.message || "Could not open this file."); }
  };

  const closeEntry = () => {
    if (entryDirty && !window.confirm("Discard unsaved changes to this file?")) return;
    setOpen(null);
    setEntryDirty(false);
  };

  const applyEntry = async () => {
    try {
      const bytes = await entryApi.current.getBytes();
      zipRef.current.file(open.path, bytes, { date: new Date() });
      sizesRef.current.set(open.path, bytes.length);
      setOpen(null);
      setEntryDirty(false);
      changed();
      toast.success("File updated in the archive. Save to keep it.");
    } catch (err) { toast.error(err?.message || "Could not apply changes."); }
  };

  const addFiles = async (list) => {
    const z = zipRef.current;
    setBusy(true);
    try {
      for (const f of Array.from(list || [])) {
        if (badName(f.name)) { toast.error(`Invalid file name: ${f.name}`); continue; }
        const path = cwd + f.name;
        if (z.file(path) && !window.confirm(`"${f.name}" already exists. Replace it?`)) continue;
        z.file(path, await f.arrayBuffer(), { date: new Date(f.lastModified || Date.now()) });
        sizesRef.current.set(path, f.size);
      }
      changed();
    } finally { setBusy(false); }
  };

  const newFolder = () => {
    const n = (window.prompt("Folder name") || "").trim();
    if (!n) return;
    if (badName(n)) return toast.error("Invalid folder name.");
    zipRef.current.folder(cwd + n);
    changed();
  };

  const newTextFile = () => {
    const n = (window.prompt("File name", "new-file.txt") || "").trim();
    if (!n) return;
    if (badName(n)) return toast.error("Invalid file name.");
    if (zipRef.current.file(cwd + n)) return toast.error("A file with that name already exists.");
    zipRef.current.file(cwd + n, "");
    sizesRef.current.set(cwd + n, 0);
    changed();
  };

  const rename = async (r) => {
    const n = (window.prompt("New name", baseName(r.path)) || "").trim();
    if (!n || n === baseName(r.path)) return;
    if (badName(n)) return toast.error("Invalid name.");
    const z = zipRef.current;
    const parent = r.path.replace(/\/$/, "").split("/").slice(0, -1).join("/");
    const target = (parent ? parent + "/" : "") + n + (r.dir ? "/" : "");
    if (z.files[target]) return toast.error("An item with that name already exists.");
    setBusy(true);
    try {
      const olds = Object.keys(z.files).filter((p) => p === r.path || (r.dir && p.startsWith(r.path)));
      for (const old of olds) {
        const f = z.files[old];
        const np = target + old.slice(r.path.length);
        if (f.dir) z.file(np, null, { dir: true, date: f.date });
        else {
          z.file(np, await f.async("uint8array"), { date: f.date });
          if (sizesRef.current.has(old)) { sizesRef.current.set(np, sizesRef.current.get(old)); sizesRef.current.delete(old); }
        }
      }
      z.remove(r.path);
      setSel(new Set());
      changed();
    } finally { setBusy(false); }
  };

  const remove = (paths) => {
    if (!paths.length || !window.confirm(`Delete ${paths.length} item(s) from the archive?`)) return;
    paths.forEach((p) => { zipRef.current.remove(p); sizesRef.current.delete(p); });
    setSel(new Set());
    changed();
  };

  const download = async (paths) => {
    const z = zipRef.current;
    setBusy(true);
    try {
      const items = rows.filter((r) => paths.includes(r.path));
      if (items.length === 1 && !items[0].dir) {
        downloadBytes(await z.file(items[0].path).async("uint8array"), baseName(items[0].path));
        return;
      }
      const out = new JSZip();
      for (const r of items) {
        for (const p of Object.keys(z.files).filter((x) => x === r.path || (r.dir && x.startsWith(r.path)))) {
          const f = z.files[p];
          const rel = p.slice(cwd.length);
          if (!rel) continue;
          if (f.dir) out.folder(rel); else out.file(rel, await f.async("uint8array"), { date: f.date });
        }
      }
      downloadBytes(await out.generateAsync({ type: "uint8array", compression: "DEFLATE" }), `${file.name.replace(/\.zip$/i, "")}_selection.zip`);
    } catch (err) { toast.error(err?.message || "Download failed."); }
    finally { setBusy(false); }
  };

  if (open) {
    return (
      <div className="ude-zip">
        <div className="ude-zip-bar">
          <button type="button" onClick={closeEntry}><FiArrowLeft size={14} /> Back to archive</button>
          <strong title={open.path}>{open.path}</strong>
          <span className="sp" />
          {open.kind === "text" && canEdit && (
            <button type="button" className="primary" disabled={!entryDirty} onClick={applyEntry}><FiCheck size={14} /> Apply to archive</button>
          )}
        </div>
        <div className="ude-zip-view">
          {open.kind === "image"
            ? <div className="ude-zip-img"><img src={open.url} alt={open.path} /></div>
            : (
              <TextEditor
                file={{ name: open.path }}
                buf={open.buf}
                canEdit={canEdit}
                onReady={() => {}}
                onDirty={() => setEntryDirty(true)}
                onError={(e) => toast.error(e?.message || "Editor error")}
                registerApi={(a) => { entryApi.current = a; }}
              />
            )}
        </div>
      </div>
    );
  }

  const selected = [...sel];
  return (
    <div
      className={`ude-zip${dragging ? " drag" : ""}`}
      onDragOver={(e) => { if (canEdit) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (canEdit) addFiles(e.dataTransfer.files); }}
    >
      <div className="ude-zip-bar">
        {canEdit && (
          <>
            <button type="button" onClick={() => fileInput.current?.click()}><FiUpload size={14} /> Add files</button>
            <button type="button" onClick={newFolder}><FiFolderPlus size={14} /> New folder</button>
            <button type="button" onClick={newTextFile}><FiFilePlus size={14} /> New text file</button>
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </>
        )}
        <button type="button" disabled={!selected.length || busy} onClick={() => download(selected)}><FiDownload size={14} /> Download{selected.length ? ` (${selected.length})` : ""}</button>
        {canEdit && <button type="button" className="danger" disabled={!selected.length} onClick={() => remove(selected)}><FiTrash2 size={14} /> Delete</button>}
        <span className="sp" />
        <div className="ude-zip-search"><FiSearch size={13} /><input type="search" placeholder="Search in archive" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search in archive" /></div>
        {canEdit && (
          <select aria-label="Compression" title="Compression used when saving" value={level} onChange={(e) => { setLevel(+e.target.value); levelRef.current = +e.target.value; onDirty?.(); }}>
            {LEVELS.map(([, , l], i) => <option key={l} value={i}>{l}</option>)}
          </select>
        )}
      </div>

      <nav className="ude-zip-crumbs" aria-label="Archive path">
        <button type="button" onClick={() => goto("")}><FiHome size={13} /> {file.name}</button>
        {crumbs.map((c) => <React.Fragment key={c.p}><span>/</span><button type="button" onClick={() => goto(c.p)}>{c.n}</button></React.Fragment>)}
      </nav>

      <div className="ude-zip-list">
        <div className="ude-zip-row head">
          <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(rows.map((r) => r.path)))} />
          <button type="button" onClick={() => toggleSort("name")}>Name {arrow("name")}</button>
          <button type="button" onClick={() => toggleSort("size")}>Size {arrow("size")}</button>
          <button type="button" onClick={() => toggleSort("date")}>Modified {arrow("date")}</button>
          <span />
        </div>
        {rows.length === 0 && <div className="ude-zip-empty">{query ? "No matching entries." : canEdit ? "This folder is empty. Drop files here or use Add files." : "This folder is empty."}</div>}
        {rows.map((r) => {
          const e = extOf(r.path);
          const Icon = r.dir ? FiFolder : IMG_EXT.includes(e) ? FiImage : TEXT_EXT.includes(e) ? FiFileText : FiFile;
          return (
            <div key={r.path} className={`ude-zip-row${sel.has(r.path) ? " sel" : ""}`} onDoubleClick={() => openEntry(r)}>
              <input type="checkbox" aria-label={`Select ${r.name}`} checked={sel.has(r.path)} onChange={() => toggleSel(r.path)} />
              <button type="button" className="name" title={r.path} onClick={() => openEntry(r)}><Icon size={16} className={r.dir ? "dir" : ""} /> <span>{r.name}</span></button>
              <span>{r.dir ? "-" : fmtSize(r.size)}</span>
              <span>{r.date ? new Date(r.date).toLocaleString() : "-"}</span>
              <span className="acts">
                <button type="button" title="Download" onClick={() => download([r.path])}><FiDownload size={14} /></button>
                {canEdit && <button type="button" title="Rename" onClick={() => rename(r)}><FiEdit2 size={14} /></button>}
                {canEdit && <button type="button" title="Delete" className="danger" onClick={() => remove([r.path])}><FiX size={14} /></button>}
              </span>
            </div>
          );
        })}
      </div>

      <div className="ude-zip-status">
        <span>{stats.files.toLocaleString()} files</span>
        <span>{stats.dirs.toLocaleString()} folders</span>
        <span>{fmtSize(stats.size)} uncompressed</span>
        {busy && <span>Working…</span>}
        {!canEdit && <span className="ro">Read-only</span>}
      </div>
    </div>
  );
};

export default ZipEditor;