import React, { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import Spreadsheet from "x-data-spreadsheet";
import "x-data-spreadsheet/dist/xspreadsheet.css";
import { renderAsync } from "docx-preview";
import { init as initPptx } from "pptx-preview";
import { FiX, FiSave, FiLock, FiCheckCircle, FiLoader, FiAlertCircle } from "react-icons/fi";
import { fetchEditorAccess, fetchDocumentBuffer, getEditorKind, getExtension } from "../../services/editorConfigService";
import { saveDocument, downloadDocument } from "../../services/documentOperationsService";
import "./UniversalDocumentEditor.css";

const KIND_LABEL = { word: "Document", cell: "Spreadsheet", slide: "Presentation", pdf: "PDF" };
const AUTOSAVE_MS = 45000;

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
  const urlRef = useRef(null);
  const versionRef = useRef(0);
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);
  const savingRef = useRef(false);
  const [state, setState] = useState("loading"); // loading | ready | unsaved | saving | saved | error
  const [meta, setMeta] = useState({ canEdit: false, reason: null, canDownload: false });
  const [errorText, setErrorText] = useState("");
  const kind = getEditorKind(file.name);
  const ext = getExtension(file.name);

  const cleanup = useCallback(() => {
    clearTimeout(timerRef.current);
    sheetRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    if (holderRef.current) holderRef.current.innerHTML = "";
  }, []);

  const handleSave = useCallback(async (silent = false) => {
    if (!sheetRef.current || savingRef.current) return false;
    savingRef.current = true;
    clearTimeout(timerRef.current);
    setState("saving");
    try {
      const wb = workbookFromSheets(sheetRef.current.getData());
      const bytes = XLSX.write(wb, { bookType: ext === "xls" ? "biff8" : "xlsx", type: "array" });
      versionRef.current = await saveDocument(file.id, file.name, bytes, versionRef.current,
        silent ? "Auto-saved from editor" : "Edited in document editor");
      dirtyRef.current = false;
      setState("saved");
      return true;
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || "Save failed");
      setState("unsaved");
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [file.id, file.name, ext]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const access = await fetchEditorAccess(file.id);
        if (!alive) return;
        versionRef.current = access.currentVersion;
        const canEdit = kind === "cell" && !!access.canUpload;
        const reason = canEdit ? null
          : kind !== "cell" ? "Preview mode. Edit in desktop app and upload a new version via Version History."
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
          if (canEdit) {
            sheet.change(() => {
              dirtyRef.current = true;
              setState("unsaved");
              clearTimeout(timerRef.current);
              timerRef.current = setTimeout(() => handleSave(true), AUTOSAVE_MS);
            });
          }
          sheetRef.current = sheet;
        } else if (kind === "word") {
          el.classList.add("ude-scroll");
          await renderAsync(buf, el, null, { inWrapper: true, ignoreWidth: false });
        } else if (kind === "slide") {
          el.classList.add("ude-scroll");
          const w = Math.min(el.clientWidth - 48, 1100);
          await initPptx(el, { width: w, height: Math.round((w * 9) / 16) }).preview(buf);
        } else if (kind === "pdf") {
          urlRef.current = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
          const f = document.createElement("iframe");
          f.src = urlRef.current;
          f.title = file.name;
          el.appendChild(f);
        }
        if (alive) setState("ready");
      } catch (e) {
        if (!alive) return;
        setErrorText(e.response?.data?.message || e.message || "Unable to open this document");
        setState("error");
      }
    })();
    return () => { alive = false; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);

  const handleClose = async () => {
    const dirty = dirtyRef.current;
    if (dirty && meta.canEdit) {
      if (window.confirm("Save your changes before closing?\n\nOK = save and close, Cancel = discard.")) {
        if (!(await handleSave())) return;
      }
    }
    cleanup();
    onClose && onClose(dirty);
  };

  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "s" && meta.canEdit) { e.preventDefault(); handleSave(); } };
    const onUnload = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onUnload); };
  }, [meta.canEdit, handleSave]);

  const statusMap = {
    loading: ["Opening...", <FiLoader className="ude-spin" size={14} />],
    ready: [meta.canEdit ? "Ready" : "Read-only", meta.canEdit ? <FiCheckCircle size={14} /> : <FiLock size={14} />],
    unsaved: ["Unsaved changes", <FiAlertCircle size={14} />],
    saving: ["Saving...", <FiLoader className="ude-spin" size={14} />],
    saved: ["All changes saved", <FiCheckCircle size={14} />],
    error: ["Error", <FiAlertCircle size={14} />],
  };
  const [label, icon] = statusMap[state];

  return (
    <div className="ude-overlay" role="dialog" aria-modal="true" aria-label={`Editing ${file.name}`}>
      <header className="ude-header">
        <div className="ude-title">
          <span className={`ude-badge ude-${kind || "word"}`}>{KIND_LABEL[kind] || "File"}</span>
          <span className="ude-name" title={file.name}>{file.name}</span>
          <span className={`ude-status ude-s-${state}`}>{icon}{label}</span>
          {!meta.canEdit && meta.reason && state !== "loading" && state !== "error" && (
            <span className="ude-note" title={meta.reason}><FiLock size={13} /> {meta.reason}</span>
          )}
        </div>
        <div className="ude-actions">
          {meta.canDownload && (
            <button type="button" className="ude-btn ghost" onClick={() => downloadDocument(file.id)}>Download</button>
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
            <button type="button" className="ude-btn primary" onClick={handleClose}>Close</button>
          </div>
        )}
        {state === "loading" && <div className="ude-loading"><FiLoader className="ude-spin" size={28} /> Preparing editor...</div>}
        <div ref={holderRef} className="ude-holder" style={{ display: state === "error" ? "none" : "block" }} />
      </div>
    </div>
  );
};

export default UniversalDocumentEditor;