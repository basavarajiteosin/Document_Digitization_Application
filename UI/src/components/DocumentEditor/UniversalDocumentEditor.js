import React, { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import Spreadsheet from "x-data-spreadsheet";
import "x-data-spreadsheet/dist/xspreadsheet.css";
import mammoth from "mammoth/mammoth.browser";
import { asBlob } from "html-docx-js-typescript";
import { renderAsync } from "docx-preview";
import { init as initPptx } from "pptx-preview";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { FiX, FiSave, FiLock, FiCheckCircle, FiLoader, FiAlertCircle } from "react-icons/fi";
import { fetchEditorAccess, fetchDocumentBuffer, getEditorKind, getExtension } from "../../services/editorConfigService";
import { saveDocument, downloadDocument } from "../../services/documentOperationsService";
import "./UniversalDocumentEditor.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.js", import.meta.url).toString();

const KIND_LABEL = { word: "Document", cell: "Spreadsheet", slide: "Presentation", pdf: "PDF" };
const AUTOSAVE_MS = 45000;
const PDF_SCALE = 1.4;
const PDF_FONT = 12;
const WORD_TOOLS = [
  ["B", "bold"], ["I", "italic"], ["U", "underline"],
  ["• List", "insertUnorderedList"], ["1. List", "insertOrderedList"],
  ["Left", "justifyLeft"], ["Center", "justifyCenter"], ["Right", "justifyRight"],
  ["H1", "formatBlock", "h1"], ["H2", "formatBlock", "h2"], ["Text", "formatBlock", "p"],
  ["Undo", "undo"], ["Redo", "redo"],
];

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
  const getBytesRef = useRef(null);   // () => Promise<bytes> for the current editor kind
  const afterSaveRef = useRef(null);  // optional (bytes) => Promise<void>
  const zipRef = useRef(null);
  const slideDocsRef = useRef([]);
  const pdfBytesRef = useRef(null);
  const annRef = useRef([]);
  const saveRef = useRef(null);
  const versionRef = useRef(0);
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);
  const savingRef = useRef(false);
  const [state, setState] = useState("loading"); // loading | ready | unsaved | saving | saved | error
  const [meta, setMeta] = useState({ canEdit: false, reason: null, canDownload: false });
  const [slides, setSlides] = useState([]);
  const [errorText, setErrorText] = useState("");
  const kind = getEditorKind(file.name);
  const ext = getExtension(file.name);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setState("unsaved");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveRef.current && saveRef.current(true), AUTOSAVE_MS);
  }, []);

  const cleanup = useCallback(() => {
    clearTimeout(timerRef.current);
    sheetRef.current = null;
    if (holderRef.current) holderRef.current.innerHTML = "";
  }, []);

  const handleSave = useCallback(async (silent = false) => {
    if (!getBytesRef.current || savingRef.current) return false;
    savingRef.current = true;
    clearTimeout(timerRef.current);
    setState("saving");
    try {
      const bytes = await getBytesRef.current();
      versionRef.current = await saveDocument(file.id, file.name, bytes, versionRef.current,
        silent ? "Auto-saved from editor" : "Edited in document editor");
      dirtyRef.current = false;
      if (afterSaveRef.current) await afterSaveRef.current(bytes);
      setState("saved");
      return true;
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || "Save failed");
      setState("unsaved");
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [file.id, file.name]);
  saveRef.current = handleSave;

  const renderPptx = async (el, buf) => {
    el.innerHTML = "";
    const w = Math.min(el.clientWidth - 48, 1100);
    await initPptx(el, { width: w, height: Math.round((w * 9) / 16) }).preview(buf);
  };

  const renderPdf = async (el, bytes, canEdit) => {
    el.innerHTML = "";
    annRef.current = [];
    pdfBytesRef.current = bytes;
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: PDF_SCALE });
      const wrap = document.createElement("div");
      wrap.className = "ude-page";
      wrap.style.width = `${vp.width}px`;
      wrap.style.height = `${vp.height}px`;
      const cv = document.createElement("canvas");
      cv.width = vp.width;
      cv.height = vp.height;
      wrap.appendChild(cv);
      await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      if (canEdit) {
        wrap.onclick = (e) => {
          if (e.target !== cv) return;
          const r = cv.getBoundingClientRect();
          const x = e.clientX - r.left, y = e.clientY - r.top;
          const input = document.createElement("input");
          input.className = "ude-ann";
          input.style.left = `${x}px`;
          input.style.top = `${y}px`;
          input.style.fontSize = `${PDF_FONT * PDF_SCALE}px`;
          input.oninput = markDirty;
          const ann = { page: i - 1, x, y, input };
          input.onblur = () => {
            if (input.value.trim()) return;
            input.remove();
            annRef.current = annRef.current.filter((a) => a !== ann);
          };
          annRef.current.push(ann);
          wrap.appendChild(input);
          input.focus();
        };
      }
      el.appendChild(wrap);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const access = await fetchEditorAccess(file.id);
        if (!alive) return;
        versionRef.current = access.currentVersion;
        const canEdit = !!access.canUpload;
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
          if (canEdit) sheet.change(markDirty);
          sheetRef.current = sheet;
          getBytesRef.current = async () =>
            XLSX.write(workbookFromSheets(sheetRef.current.getData()), { bookType: ext === "xls" ? "biff8" : "xlsx", type: "array" });
        } else if (kind === "word") {
          el.classList.add("ude-scroll");
          if (canEdit) {
            const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
            el.classList.add("ude-page-edit");
            el.contentEditable = "true";
            el.innerHTML = value || "<p><br></p>";
            el.oninput = markDirty;
            getBytesRef.current = async () => {
              const blob = await asBlob(`<!DOCTYPE html><html><body>${el.innerHTML}</body></html>`);
              return blob.arrayBuffer ? blob.arrayBuffer() : blob;
            };
          } else {
            await renderAsync(buf, el, null, { inWrapper: true, ignoreWidth: false });
          }
        } else if (kind === "slide") {
          el.classList.add("ude-scroll");
          await renderPptx(el, buf);
          if (canEdit) {
            const zip = await JSZip.loadAsync(buf);
            const num = (n) => +n.match(/slide(\d+)\.xml$/)[1];
            const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b));
            const docs = [];
            for (const name of names) {
              const doc = new DOMParser().parseFromString(await zip.file(name).async("string"), "application/xml");
              docs.push({ name, doc, nodes: Array.from(doc.getElementsByTagName("a:t")) });
            }
            zipRef.current = zip;
            slideDocsRef.current = docs;
            setSlides(docs.map((d) => d.nodes.map((n) => n.textContent)));
            getBytesRef.current = async () => {
              slideDocsRef.current.forEach((d) => zipRef.current.file(d.name, new XMLSerializer().serializeToString(d.doc)));
              return zipRef.current.generateAsync({ type: "uint8array", compression: "DEFLATE" });
            };
            afterSaveRef.current = (bytes) => renderPptx(holderRef.current, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
          }
        } else if (kind === "pdf") {
          el.classList.add("ude-scroll");
          await renderPdf(el, new Uint8Array(buf), canEdit);
          if (canEdit) {
            getBytesRef.current = async () => {
              const doc = await PDFDocument.load(pdfBytesRef.current);
              const font = await doc.embedFont(StandardFonts.Helvetica);
              annRef.current.forEach((a) => {
                const t = a.input.value.trim();
                if (!t) return;
                const p = doc.getPage(a.page);
                p.drawText(t, { x: a.x / PDF_SCALE, y: p.getHeight() - a.y / PDF_SCALE - 0.85 * PDF_FONT, size: PDF_FONT, font, color: rgb(0, 0, 0) });
              });
              return doc.save();
            };
            afterSaveRef.current = (bytes) => renderPdf(holderRef.current, bytes, true);
          }
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

  const editSlideText = (si, ti, val) => {
    slideDocsRef.current[si].nodes[ti].textContent = val;
    setSlides((prev) => prev.map((s, i) => (i === si ? s.map((t, j) => (j === ti ? val : t)) : s)));
    markDirty();
  };

  const statusMap = {
    loading: ["Opening...", <FiLoader className="ude-spin" size={14} />],
    ready: [meta.canEdit ? "Ready" : "Read-only", meta.canEdit ? <FiCheckCircle size={14} /> : <FiLock size={14} />],
    unsaved: ["Unsaved changes", <FiAlertCircle size={14} />],
    saving: ["Saving...", <FiLoader className="ude-spin" size={14} />],
    saved: ["All changes saved", <FiCheckCircle size={14} />],
    error: ["Error", <FiAlertCircle size={14} />],
  };
  const [label, icon] = statusMap[state];
  const showTools = meta.canEdit && state !== "loading" && state !== "error" && (kind === "word" || kind === "pdf");
  const showPanel = meta.canEdit && kind === "slide" && slides.length > 0 && state !== "error";

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
        {showTools && (
          <div className="ude-toolbar">
            {kind === "word" ? WORD_TOOLS.map(([t, cmd, arg]) => (
              <button key={t} type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd, false, arg || null); markDirty(); }}>{t}</button>
            )) : <span>Click anywhere on a page to add text. Type, then click away. Press Save to embed it in the PDF.</span>}
          </div>
        )}
        {state === "error" && (
          <div className="ude-error">
            <FiAlertCircle size={36} />
            <h5>Unable to open document</h5>
            <p>{errorText}</p>
            <button type="button" className="ude-btn primary" onClick={handleClose}>Close</button>
          </div>
        )}
        {state === "loading" && <div className="ude-loading"><FiLoader className="ude-spin" size={28} /> Preparing editor...</div>}
        <div ref={holderRef} className={`ude-holder ${showTools ? "ude-has-tools" : ""} ${showPanel ? "ude-has-panel" : ""}`}
          style={{ display: state === "error" ? "none" : "block" }} />
        {showPanel && (
          <aside className="ude-panel">
            <h6>Edit slide text</h6>
            {slides.map((items, si) => items.length > 0 && (
              <div key={si} className="ude-slide-group">
                <div className="ude-slide-label">Slide {si + 1}</div>
                {items.map((t, ti) => (
                  <textarea key={ti} rows={Math.min(4, Math.max(1, Math.ceil(t.length / 34)))} value={t}
                    onChange={(e) => editSlideText(si, ti, e.target.value)} />
                ))}
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
};

export default UniversalDocumentEditor;