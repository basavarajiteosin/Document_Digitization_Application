import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import Spreadsheet from "x-data-spreadsheet";
import "x-data-spreadsheet/dist/xspreadsheet.css";
import { init as initPptx } from "pptx-preview";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { SuperDoc } from "@harbour-enterprises/superdoc";
import "@harbour-enterprises/superdoc/style.css";
import { FiX, FiSave, FiLock, FiCheckCircle, FiLoader, FiAlertCircle } from "react-icons/fi";
import { fetchEditorAccess, fetchDocumentBuffer, getEditorKind, getExtension } from "../../services/editorConfigService";
import { saveDocument, downloadDocument } from "../../services/documentOperationsService";
import { createCollabProvider } from "../../services/collabProvider";
import { useCollab } from "../../hooks/useCollab";
import { SpFacepile } from "../../shared/SpAvatar";
import "./UniversalDocumentEditor.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const KIND_LABEL = { word: "Document", cell: "Spreadsheet", slide: "Presentation", pdf: "PDF" };
const AUTOSAVE_MS = 45000;
const PDF_SCALE = 1.4;
const PDF_FONT = 12;

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

/** Word pane: SuperDoc (native DOCX editor) with Yjs real-time co-authoring. */
const WordPane = ({ file, buf, provider, canEdit, user, onLocalUpdate, onReady, registerBytes }) => {
  const tbId = useRef(`sd-tb-${file.id}`).current;
  const bodyId = useRef(`sd-body-${file.id}`).current;

  useEffect(() => {
    let sd = null, alive = true;
    (async () => {
      if (provider && !provider.claim) await provider.waitForContent(8000); // wait for the seeding writer
      if (!alive) return;
      const docFile = new File([buf], file.name, {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      sd = new SuperDoc({
        selector: `#${bodyId}`,
        document: docFile,
        documentMode: canEdit ? "editing" : "viewing",
        user: {
          name: user.name,
          email: user.email,
          color: user.color,
        },
        pagination: true,
        rulers: false,
        modules: {
          toolbar: canEdit
            ? {
              selector: `#${tbId}`,
              toolbarGroups: ["left", "center", "right"],
            }
            : undefined,
          collaboration: provider
            ? {
              ydoc: provider.ydoc,
              provider: {
                awareness: provider.awareness,
                synced: true,
                on: () => { },
                off: () => { },
                connect: () => { },
                disconnect: () => { },
                destroy: () => { },
              },
            }
            : undefined,
        },
        onReady: () => alive && onReady(),
        onEditorUpdate: () => {
          if (!provider) onLocalUpdate();
        },
      });
      registerBytes(async () => {
        const out = await sd.export({ exportType: ["docx"], triggerDownload: false });
        const blob = Array.isArray(out) ? out[0] : out;
        return blob.arrayBuffer();
      });
    })();
    return () => { alive = false; try { sd && sd.destroy(); } catch (e) { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ude-word">
      {canEdit && <div id={tbId} className="ude-sdtoolbar" />}
      <div className="ude-sdwrap"><div id={bodyId} className="ude-sd" /></div>
    </div>
  );
};

/** file = { id: fileId, name: string } */
const UniversalDocumentEditor = ({ file, onClose }) => {
  const holderRef = useRef(null);
  const sheetRef = useRef(null);
  const getBytesRef = useRef(null);
  const afterSaveRef = useRef(null);
  const zipRef = useRef(null);
  const slideDocsRef = useRef([]);
  const pdfBytesRef = useRef(null);
  const annRef = useRef([]);
  const ioRef = useRef(null);
  const providerRef = useRef(null);
  const saveRef = useRef(null);
  const readyRef = useRef(false);
  const versionRef = useRef(0);
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);
  const savingRef = useRef(false);
  const viewersRef = useRef([]);
  const [state, setState] = useState("loading"); // loading | ready | unsaved | saving | saved | error
  const [meta, setMeta] = useState({ canEdit: false, reason: null, canDownload: false });
  const [wordCtx, setWordCtx] = useState(null);
  const [errorText, setErrorText] = useState("");
  const kind = getEditorKind(file.name);
  const ext = getExtension(file.name);

  const me = useSelector((s) => s.personalInformationReducer);
  const myId = (me.userID || "").toLowerCase();
  const myName = `${me.firstName || ""} ${me.lastName || ""}`.trim() || "User";

  const markDirty = useCallback(() => {
    if (!readyRef.current) return;
    dirtyRef.current = true;
    setState("unsaved");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveRef.current && saveRef.current(true), AUTOSAVE_MS);
  }, []);

  const { viewers } = useCollab(file.id, {
    onFileChanged: (p) => {
      if (p.byUserId === myId) return;
      versionRef.current = p.version;
      if (p.action === "uploaded" || p.action === "restored") {
        dirtyRef.current = false;
        clearTimeout(timerRef.current);
        setState((s) => (s === "loading" || s === "error" ? s : "saved"));
      }
      toast.info(`${p.byName} ${p.message}`);
    },
  });
  viewersRef.current = viewers;
  const others = viewers.filter((v) => v.userId !== myId);

  const cleanup = useCallback(() => {
    clearTimeout(timerRef.current);
    ioRef.current?.disconnect();
    sheetRef.current = null;
    providerRef.current?.destroy();
    providerRef.current = null;
    if (holderRef.current) holderRef.current.innerHTML = "";
  }, []);

  const handleSave = useCallback(async (silent = false) => {
    if (!getBytesRef.current || savingRef.current) return false;
    if (silent && providerRef.current && !providerRef.current.isLeader()) return false;
    savingRef.current = true;
    clearTimeout(timerRef.current);
    setState("saving");
    try {
      const bytes = await getBytesRef.current();
      versionRef.current = await saveDocument(file.id, file.name, bytes, versionRef.current,
        silent ? "Auto-saved from editor" : "Edited in document editor");
      dirtyRef.current = false;
      if (afterSaveRef.current) await afterSaveRef.current(bytes);
      if (providerRef.current && viewersRef.current.length <= 1) providerRef.current.compact();
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

  // Lazy, virtualised PDF rendering: every page gets a placeholder, the visible ones are drawn on demand.
  const renderPdf = async (el, bytes, canEdit) => {
    ioRef.current?.disconnect();
    el.innerHTML = "";
    annRef.current = [];
    pdfBytesRef.current = bytes;
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const list = document.createElement("div");
    list.className = "ude-pdf";
    el.appendChild(list);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const draw = async (wrap) => {
      try {
        const cv = wrap.querySelector("canvas");
        const vp = wrap._page.getViewport({ scale: PDF_SCALE * dpr });
        cv.width = vp.width;
        cv.height = vp.height;
        await wrap._page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      } catch (e) { wrap.dataset.done = ""; }
    };
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting || en.target.dataset.done) return;
      en.target.dataset.done = "1";
      draw(en.target);
    }), { root: el, rootMargin: "1200px 0px" });
    ioRef.current = io;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: PDF_SCALE });
      const wrap = document.createElement("div");
      wrap.className = "ude-page";
      wrap.style.width = `${vp.width}px`;
      wrap.style.height = `${vp.height}px`;
      wrap._page = page;
      const cv = document.createElement("canvas");
      cv.style.width = `${vp.width}px`;
      cv.style.height = `${vp.height}px`;
      wrap.appendChild(cv);
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
      list.appendChild(wrap);
      io.observe(wrap);
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
          sheetRef.current = sheet;
          readyRef.current = true;
          if (canEdit) sheet.change(markDirty);
          getBytesRef.current = async () =>
            XLSX.write(workbookFromSheets(sheetRef.current.getData()), { bookType: ext === "xls" ? "biff8" : "xlsx", type: "array" });
        } else if (kind === "word") {
          const provider = canEdit ? await createCollabProvider(file.id, myName) : null;
          if (!alive) { provider?.destroy(); return; }
          providerRef.current = provider;
          if (provider) provider.ydoc.on("update", () => { if (canEdit) markDirty(); });
          setWordCtx({ provider, buf, canEdit: canEdit && (!provider || provider.canWrite) });
          return; // ready is signalled by WordPane.onReady
        } else if (kind === "slide") {
          el.classList.add("ude-scroll");
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
          const provider = canEdit ? await createCollabProvider(file.id, myName) : null;
          if (!alive) { provider?.destroy(); return; }
          providerRef.current = provider;
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

          // Draw the slides, then make each matched text element editable in place.
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
        } else if (kind === "pdf") {
          el.classList.add("ude-scroll");
          readyRef.current = true;
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


  const statusMap = {
    loading: ["Opening...", <FiLoader className="ude-spin" size={14} />],
    ready: [meta.canEdit ? "Ready" : "Read-only", meta.canEdit ? <FiCheckCircle size={14} /> : <FiLock size={14} />],
    unsaved: ["Unsaved changes", <FiAlertCircle size={14} />],
    saving: ["Saving...", <FiLoader className="ude-spin" size={14} />],
    saved: ["All changes saved", <FiCheckCircle size={14} />],
    error: ["Error", <FiAlertCircle size={14} />],
  };
  const [label, icon] = statusMap[state];
  const wordEditable = wordCtx ? wordCtx.canEdit : meta.canEdit;

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
          {others.length > 0 && (
            <span className="ude-presence" title={others.map((v) => v.name).join(", ")}>
              <span>Also editing</span><SpFacepile names={others.map((v) => v.name)} max={4} />
            </span>
          )}
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
        {kind === "word" && wordCtx && state !== "error" && (
          <WordPane
            file={file}
            buf={wordCtx.buf}
            provider={wordCtx.provider}
            canEdit={wordEditable}
            user={{ name: myName, email: me.emailAddress || "", color: "#2563eb" }}
            onLocalUpdate={markDirty}
            registerBytes={(fn) => { getBytesRef.current = fn; }}
            onReady={() => { readyRef.current = true; dirtyRef.current = false; setState("ready"); }}
          />
        )}
        <div ref={holderRef} className={`ude-holder`}
          style={{ display: state === "error" || kind === "word" ? "none" : "block" }} />
      </div>
    </div>
  );
};

export default UniversalDocumentEditor;