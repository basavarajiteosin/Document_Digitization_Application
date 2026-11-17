import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import * as Y from "yjs";
import Spreadsheet from "x-data-spreadsheet";
import "x-data-spreadsheet/dist/xspreadsheet.css";
import { init as initPptx } from "pptx-preview";
import JSZip from "jszip";
import { FiX, FiSave, FiLock, FiCheckCircle, FiLoader, FiAlertCircle, FiDownload, FiRefreshCw, FiWifi } from "react-icons/fi";
import { fetchEditorAccess, fetchDocumentBuffer, getEditorKind, getExtension } from "../../services/editorConfigService";
import { saveDocument, downloadDocument, downloadBytes, isVersionConflict } from "../../services/documentOperationsService";
import { createCollabProvider } from "../../services/collabProvider";
import { useCollab } from "../../hooks/useCollab";
import { SpFacepile } from "../../shared/SpAvatar";
import { useConfirm } from "../../Customhook/ConfirmContext";
import WordEditor from "./WordEditor";
import PdfEditor from "./PdfEditor";
import "./UniversalDocumentEditor.css";
import TextEditor from "./TextEditor";
import ZipEditor from "./ZipEditor";

const KIND_LABEL = { word: "Document", cell: "Spreadsheet", slide: "Presentation", pdf: "PDF", text: "Text", zip: "Archive" };
const AUTOSAVE_MS = 45000;
const WORD_MODES = [["editing", "Editing"], ["suggesting", "Suggesting"], ["viewing", "Viewing"]];
const errMsg = (e, fallback) => e?.response?.data?.message || e?.message || fallback;

const sheetsFromWorkbook = (wb) =>
  wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const rows = {};
    if (ws["!ref"]) {
      const r = XLSX.utils.decode_range(ws["!ref"]);
      for (let R = r.s.r; R <= r.e.r; R++) {
        const cells = {};
        for (let C = r.s.c; C <= r.e.c; C++) {
          const c = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          if (c) cells[C] = { text: c.f ? `=${c.f}` : c.w ?? String(c.v ?? "") };
        }
        rows[R] = { cells };
      }
    }
    return { name, rows };
  });

const workbookFromSheets = (sheets) => {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    const ws = {};
    let maxR = 0, maxC = 0;
    Object.entries(s.rows || {}).forEach(([r, row]) => {
      if (r === "len") return;
      Object.entries(row.cells || {}).forEach(([c, cell]) => {
        const t = cell.text;
        if (t === undefined || t === null || t === "") return;
        const str = String(t);
        ws[XLSX.utils.encode_cell({ r: +r, c: +c })] = str.startsWith("=")
          ? { t: "n", f: str.slice(1) }
          : !isNaN(Number(str)) ? { t: "n", v: Number(str) } : { t: "s", v: str };
        maxR = Math.max(maxR, +r);
        maxC = Math.max(maxC, +c);
      });
    });
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    XLSX.utils.book_append_sheet(wb, ws, s.name || "Sheet1");
  });
  return wb;
};

/** file = { id: fileId, name: string } */
const UniversalDocumentEditor = ({ file, onClose }) => {
  const holderRef = useRef(null);
  const sheetRef = useRef(null);
  const getBytesRef = useRef(null);
  const afterSaveRef = useRef(null);
  const providerRef = useRef(null);
  const saveRef = useRef(null);
  const readyRef = useRef(false);
  const versionRef = useRef(0);
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);
  const savingRef = useRef(false);
  const viewersRef = useRef([]);
  const collabRef = useRef(false);
  const canEditRef = useRef(false);
  const editSeqRef = useRef(0);
  const peerSaveRef = useRef(null);
  const savedAnyRef = useRef(false);
  const lastSyncErrRef = useRef(0);
  const [wordKey, setWordKey] = useState(0);
  const [state, setState] = useState("loading"); // loading | ready | unsaved | saving | saved | error
  const [meta, setMeta] = useState({ canEdit: false, reason: null, canDownload: false });
  const [wordCtx, setWordCtx] = useState(null);
  const [pdfCtx, setPdfCtx] = useState(null);
  const [plainCtx, setPlainCtx] = useState(null);
  const [errorText, setErrorText] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [stale, setStale] = useState(false);
  const [live, setLive] = useState(false);
  const [wordMode, setWordMode] = useState("editing");
  const kind = getEditorKind(file.name);
  const ext = getExtension(file.name);
  const confirm = useConfirm();
  const me = useSelector((s) => s.personalInformationReducer);
  const myId = (me.userID || "").toLowerCase();
  const myName = `${me.firstName || ""} ${me.lastName || ""}`.trim() || "User";

  const notifySyncError = useCallback((e) => {
    const now = Date.now();
    if (now - lastSyncErrRef.current < 10000) return;
    lastSyncErrRef.current = now;
    toast.warning(`Live sync issue: ${errMsg(e, "connection problem")}`);
  }, []);

  const markDirty = useCallback(() => {
    if (!readyRef.current || !canEditRef.current) return;
    editSeqRef.current += 1;
    dirtyRef.current = true;
    setState((s) => (s === "saving" ? s : "unsaved"));
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveRef.current && saveRef.current(true), AUTOSAVE_MS);
  }, []);

  const cleanup = useCallback(() => {
    clearTimeout(timerRef.current);
    sheetRef.current = null;
    providerRef.current?.destroy();
    providerRef.current = null;
    collabRef.current = false;
    getBytesRef.current = null;
    afterSaveRef.current = null;
    readyRef.current = false;
    if (holderRef.current) {
      holderRef.current.innerHTML = "";
      holderRef.current.classList.remove("ude-scroll");
    }
  }, []);

  const reload = useCallback(() => {
    cleanup();
    dirtyRef.current = false;
    setWordCtx(null);
    setPdfCtx(null);
    setPlainCtx(null);
    setStale(false);
    setLive(false);
    setErrorText("");
    setState("loading");
    setReloadKey((k) => k + 1);
  }, [cleanup]);

  const { viewers } = useCollab(file.id, {
    onFileChanged: (p) => {
      if (p.byUserId === myId) return;
      if (p.action === "uploaded" || p.action === "restored") {
        versionRef.current = p.version;
        if (p.source === "editor") peerSaveRef.current = p.version;
      }
      // Content replaced outside this live session (upload, restore, or a save from a non-co-authored copy).
      const replaced = p.action === "restored" || (p.action === "uploaded" && (p.source !== "editor" || !collabRef.current));
      if (replaced) {
        if (collabRef.current || !dirtyRef.current) {
          toast.info(`${p.byName} ${p.message}. Loading the latest version…`);
          reload();
        } else {
          setStale(true);
          toast.warning(`${p.byName} ${p.message}. Your copy is out of date.`);
        }
        return;
      }
      if (p.action === "uploaded") {
        dirtyRef.current = false;
        clearTimeout(timerRef.current);
        setState((s) => (s === "loading" || s === "error" ? s : "saved"));
      }
      toast.info(`${p.byName} ${p.message}`);
    },
  });
  viewersRef.current = viewers;
  const others = viewers.filter((v) => !v.isMe);

  const handleSave = useCallback(async (silent = false) => {
    if (!getBytesRef.current || savingRef.current || !canEditRef.current) return false;
    if (silent && collabRef.current && providerRef.current && !providerRef.current.isLeader()) return false;
    savingRef.current = true;
    clearTimeout(timerRef.current);
    setState("saving");
    const seq = editSeqRef.current;
    const note = silent ? "Auto-saved from editor" : "Edited in document editor";
    try {
      const bytes = await getBytesRef.current();
      let version;
      try {
        version = await saveDocument(file.id, file.name, bytes, versionRef.current, note);
      } catch (e) {
        // In a live session the shared state already contains the peer's save, so retrying is safe.
        if (!collabRef.current || !isVersionConflict(e)) throw e;
        const access = await fetchEditorAccess(file.id);
        if (access.currentVersion !== peerSaveRef.current) throw e;
        versionRef.current = access.currentVersion;
        version = await saveDocument(file.id, file.name, bytes, versionRef.current, note);
      }
      versionRef.current = version;
      savedAnyRef.current = true;
      if (afterSaveRef.current) await afterSaveRef.current(bytes, version);
      if (providerRef.current && viewersRef.current.length <= 1) providerRef.current.compact();
      setStale(false);
      if (editSeqRef.current !== seq) {
        dirtyRef.current = true;
        setState("unsaved");
        timerRef.current = setTimeout(() => saveRef.current && saveRef.current(true), AUTOSAVE_MS);
      } else {
        dirtyRef.current = false;
        setState("saved");
      }
      return true;
    } catch (e) {
      toast.error(errMsg(e, "Save failed"));
      if (isVersionConflict(e)) setStale(true);
      dirtyRef.current = true;
      setState("unsaved");
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [file.id, file.name]);
  saveRef.current = handleSave;

  const registerApi = useCallback((api) => {
    getBytesRef.current = api ? api.getBytes : null;
    afterSaveRef.current = api && api.afterSave ? api.afterSave : null;
  }, []);

  const onEditorError = useCallback((e) => {
    const msg = errMsg(e, "The editor reported an error");
    if (!readyRef.current) { setErrorText(msg); setState("error"); }
    else toast.error(msg);
  }, []);

  const onWordReady = useCallback(({ collab, editable }) => {
    if (!collab && providerRef.current) { providerRef.current.destroy(); providerRef.current = null; }
    collabRef.current = collab;
    setLive(collab);
    canEditRef.current = editable;
    if (!editable) setMeta((m) => (m.canEdit ? { ...m, canEdit: false, reason: m.reason || "Opened read-only." } : m));
    if (collab && editable && providerRef.current) providerRef.current.ydoc.on("update", () => markDirty());
    dirtyRef.current = false;
    readyRef.current = true;
    setState("ready");
  }, [markDirty]);

  const onPdfReady = useCallback(() => {
    if (readyRef.current) return;
    dirtyRef.current = false;
    readyRef.current = true;
    setState("ready");
  }, []);

  const renderPptx = async (el, buf) => {
    el.innerHTML = "";
    const w = Math.min(el.clientWidth - 48, 1100);
    await initPptx(el, { width: w, height: Math.round((w * 9) / 16) }).preview(buf);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const access = await fetchEditorAccess(file.id);
        if (!alive) return;
        versionRef.current = access.currentVersion;
        const canEdit = !!access.canUpload;
        canEditRef.current = canEdit;
        const reason = canEdit ? null
          : access.isLocked && !access.lockedByMe ? `Checked out by ${access.lockedByName}. Opened read-only.`
            : "You have read-only access to this file.";
        setMeta({ canEdit, reason, canDownload: !!access.canUpload });

        const buf = await fetchDocumentBuffer(file.id);
        if (!alive) return;
        const el = holderRef.current;

        if (kind === "cell") {
          const wb = XLSX.read(buf, { type: "array" });
          const sheet = new Spreadsheet(el, {
            mode: canEdit ? "edit" : "read",
            showToolbar: canEdit,
            showContextmenu: canEdit,
            view: { height: () => el.clientHeight, width: () => el.clientWidth },
          }).loadData(sheetsFromWorkbook(wb));
          sheetRef.current = sheet;
          readyRef.current = true;
          if (canEdit) sheet.change(markDirty);
          getBytesRef.current = async () =>
            XLSX.write(workbookFromSheets(sheetRef.current.getData()), { bookType: ext === "xls" ? "biff8" : "xlsx", type: "array" });
        } else if (kind === "word") {
          const provider = await createCollabProvider(file.id, myName, { onError: notifySyncError });
          if (!alive) { provider?.destroy(); return; }
          providerRef.current = provider;
          setWordCtx({ provider, buf, canEdit: canEdit && (!provider || provider.canWrite) });
          return; // ready is signalled by WordEditor.onReady
        } else if (kind === "pdf") {
          const provider = await createCollabProvider(file.id, myName, { onError: notifySyncError });
          if (!alive) { provider?.destroy(); return; }
          providerRef.current = provider;
          collabRef.current = !!provider;
          setLive(!!provider);
          const editable = canEdit && (!provider || provider.canWrite);
          canEditRef.current = editable;
          setPdfCtx({ bytes: buf, ydoc: provider ? provider.ydoc : new Y.Doc(), version: access.currentVersion, canEdit: editable });
          return; // ready is signalled by PdfEditor.onReady
        } else if (kind === "text" || kind === "zip") {
          setPlainCtx({ buf, canEdit });
          return; // ready is signalled by TextEditor / ZipEditor onReady
        }
        else if (kind === "slide") {
          el.classList.add("ude-scroll");
          const zip = await JSZip.loadAsync(buf);
          const num = (n) => +n.match(/slide(\d+)\.xml$/)[1];
          const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b));
          const docs = [];
          for (const name of names) {
            const doc = new DOMParser().parseFromString(await zip.file(name).async("string"), "application/xml");
            docs.push({ name, doc, nodes: Array.from(doc.getElementsByTagName("a:t")) });
          }
          const provider = canEdit ? await createCollabProvider(file.id, myName, { onError: notifySyncError }) : null;
          if (!alive) { provider?.destroy(); return; }
          providerRef.current = provider;
          collabRef.current = !!provider;
          setLive(!!provider);
          const map = provider ? provider.ydoc.getMap("slideText") : null;
          const leaves = new Map();

          docs.forEach((d, si) => d.nodes.forEach((n, ti) => {
            const v = map && map.get(`${si}:${ti}`);
            if (v !== undefined && v !== null) n.textContent = v;
          }));

          const zipNow = async () => {
            docs.forEach((d) => zip.file(d.name, new XMLSerializer().serializeToString(d.doc)));
            return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
          };
          getBytesRef.current = zipNow;

          const bytes = await zipNow();
          await renderPptx(el, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
          el.querySelectorAll(".pptx-preview-slide-wrapper").forEach((w, si) => {
            const nodes = docs[si]?.nodes || [];
            let j = 0;
            w.querySelectorAll("*").forEach((leaf) => {
              if (leaf.children.length) return;
              const t = leaf.textContent;
              if (!t.trim()) return;
              while (j < nodes.length && !nodes[j].textContent.trim()) j++;
              if (j >= nodes.length || t.trim() !== nodes[j].textContent.trim()) return;
              const ti = j++;
              const key = `${si}:${ti}`;
              leaves.set(key, leaf);
              if (!canEdit) return;
              leaf.contentEditable = "true";
              leaf.spellcheck = true;
              leaf.classList.add("ude-edt");
              leaf.onkeydown = (e) => { if (e.key === "Enter") e.preventDefault(); };
              leaf.onpaste = (e) => {
                e.preventDefault();
                document.execCommand("insertText", false, e.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, " "));
              };
              leaf.oninput = () => {
                const v = leaf.textContent;
                nodes[ti].textContent = v;
                if (map) map.set(key, v); else markDirty();
              };
            });
          });

          if (map) {
            map.observe((ev) => {
              ev.changes.keys.forEach((_, key) => {
                const v = map.get(key);
                const [si, ti] = key.split(":").map(Number);
                const n = docs[si]?.nodes[ti];
                if (n && v !== undefined && n.textContent !== v) n.textContent = v;
                const leaf = leaves.get(key);
                if (leaf && document.activeElement !== leaf && leaf.textContent !== v) leaf.textContent = v;
              });
              markDirty();
            });
          }
          readyRef.current = true;
        }

        if (alive) setState("ready");
      } catch (e) {
        if (!alive) return;
        setErrorText(errMsg(e, "Unable to open this document"));
        setState("error");
      }
    })();
    return () => { alive = false; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, reloadKey]);

  const handleClose = async () => {
    const dirty = dirtyRef.current;
    if (dirty && meta.canEdit) {
      const save = await confirm({
        title: "Unsaved changes",
        message: "Save your changes before closing?",
        confirmText: "Save & close",
        cancelText: "Discard",
        variant: "primary",
        dismissable: false,
      });
      if (save && !(await handleSave())) return;
    }
    cleanup();
    onClose && onClose(dirty);
  };

  const handleDownload = async () => {
    if (getBytesRef.current && readyRef.current && dirtyRef.current) {
      try {
        downloadBytes(await getBytesRef.current(), file.name);
      } catch (e) {
        toast.error(errMsg(e, "Could not export the current document"));
      }
      return;
    }
    downloadDocument(file.id);
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S") && canEditRef.current) {
        e.preventDefault();
        handleSave();
      }
    };
    const onUnload = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onUnload); };
  }, [handleSave]);

  const statusMap = {
    loading: ["Opening...", <FiLoader className="ude-spin" size={14} />],
    ready: [meta.canEdit ? "Ready" : "Read-only", meta.canEdit ? <FiCheckCircle size={14} /> : <FiLock size={14} />],
    unsaved: ["Unsaved changes", <FiAlertCircle size={14} />],
    saving: ["Saving...", <FiLoader className="ude-spin" size={14} />],
    saved: ["All changes saved", <FiCheckCircle size={14} />],
    error: ["Error", <FiAlertCircle size={14} />],
  };
  const [label, icon] = statusMap[state];
  const opened = state !== "loading" && state !== "error";

  return (
    <div className="ude-overlay" role="dialog" aria-modal="true" aria-label={`Editing ${file.name}`}>
      <header className="ude-header">
        <div className="ude-title">
          <span className={`ude-badge ude-badge-${kind || "word"}`}>{KIND_LABEL[kind] || "File"}</span>
          <span className="ude-name" title={file.name}>{file.name}</span>
          <span className={`ude-status ude-s-${state}`}>{icon}{label}</span>
          {opened && live && <span className="ude-live" title="Changes sync live with other editors"><FiWifi size={13} /> Live</span>}
          {!meta.canEdit && meta.reason && opened && (
            <span className="ude-note" title={meta.reason}><FiLock size={13} /> {meta.reason}</span>
          )}
        </div>
        <div className="ude-actions">
          {others.length > 0 && (
            <span className="ude-presence" title={others.map((v) => v.name).join(", ")}>
              <span>Also here</span><SpFacepile names={others.map((v) => v.name)} max={4} />
            </span>
          )}
          {stale && (
            <button type="button" className="ude-btn warn" onClick={reload} title="Discard local changes and load the latest version">
              <FiRefreshCw size={14} /> Reload latest
            </button>
          )}
          {kind === "word" && meta.canEdit && opened && (
            <select className="ude-mode" aria-label="Editing mode" value={wordMode} onChange={(e) => setWordMode(e.target.value)}>
              {WORD_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          )}
          {meta.canDownload && (
            <button type="button" className="ude-btn ghost" onClick={handleDownload} disabled={state === "loading"}>
              <FiDownload size={14} /> Download
            </button>
          )}
          {meta.canEdit && (
            <button type="button" className="ude-btn primary" onClick={() => handleSave()}
              disabled={state === "loading" || state === "saving" || state === "error"}>
              <FiSave size={15} /> Save
            </button>
          )}
          <button type="button" className="ude-btn close" onClick={handleClose} aria-label="Close editor">
            <FiX size={18} /> Close
          </button>
        </div>
      </header>

      <div className="ude-body">
        {state === "error" && (
          <div className="ude-error">
            <FiAlertCircle size={36} />
            <h5>Unable to open document</h5>
            <p>{errorText}</p>
            <div className="ude-error-actions">
              <button type="button" className="ude-btn ghost-dark" onClick={reload}><FiRefreshCw size={14} /> Retry</button>
              <button type="button" className="ude-btn primary" onClick={handleClose}>Close</button>
            </div>
          </div>
        )}
        {state === "loading" && <div className="ude-loading"><FiLoader className="ude-spin" size={28} /> Preparing editor...</div>}
        {kind === "word" && wordCtx && state !== "error" && (
          <WordEditor
            key={`w-${reloadKey}-${wordKey}`}
            file={file}
            buf={wordCtx.buf}
            provider={wordCtx.provider}
            canEdit={wordCtx.canEdit}
            mode={wordMode}
            user={{ name: myName, email: me.emailAddress || "" }}
            onDirty={markDirty}
            onReady={onWordReady}
            onError={onEditorError}
            onFallback={(role) => {
              if (role === "empty") {
                providerRef.current?.destroy();
                providerRef.current = null;
                collabRef.current = false;
                readyRef.current = false;
                setLive(false);
                setWordCtx((c) => (c ? { ...c, provider: null } : c));
                setWordKey((k) => k + 1);
                toast.info("Live session state was empty; opened the document directly.");
                return;
              }
              if (role === "standalone" && wordCtx.canEdit) toast.info("Live co-authoring is unavailable right now; you are editing your own copy.");
            }}
            registerApi={registerApi}
          />
        )}
        {kind === "pdf" && pdfCtx && state !== "error" && (
          <PdfEditor
            key={`p-${reloadKey}`}
            fileId={file.id}
            initialBytes={pdfCtx.bytes}
            baseVersion={pdfCtx.version}
            ydoc={pdfCtx.ydoc}
            canEdit={pdfCtx.canEdit}
            userName={myName}
            onReady={onPdfReady}
            onDirty={markDirty}
            onError={onEditorError}
            registerApi={registerApi}
          />
        )}
        {kind === "text" && plainCtx && state !== "error" && (
          <TextEditor
            key={`t-${reloadKey}`}
            file={file}
            buf={plainCtx.buf}
            canEdit={plainCtx.canEdit}
            onReady={onPdfReady}
            onDirty={markDirty}
            onError={onEditorError}
            registerApi={registerApi}
          />
        )}
        {kind === "zip" && plainCtx && state !== "error" && (
          <ZipEditor
            key={`z-${reloadKey}`}
            file={file}
            buf={plainCtx.buf}
            canEdit={plainCtx.canEdit}
            onReady={onPdfReady}
            onDirty={markDirty}
            onError={onEditorError}
            registerApi={registerApi}
          />
        )}
        <div ref={holderRef} className="ude-holder"
          style={{ display: state === "error" || ["word", "pdf", "text", "zip"].includes(kind) ? "none" : "block" }} />
      </div>
    </div>
  );
};

export default UniversalDocumentEditor;