import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import * as pdfjsLib from "pdfjs-dist";
import { toast } from "react-toastify";
import {
    FiMousePointer, FiType, FiDroplet, FiSquare, FiPenTool, FiEyeOff, FiMinus, FiPlus, FiMaximize2,
    FiRotateCcw, FiRotateCw, FiTrash2, FiCornerUpLeft, FiCornerUpRight, FiChevronUp, FiChevronDown, FiLoader,
} from "react-icons/fi";
import { buildPdf, isEncryptedPdf } from "./pdfFlatten";
import { fetchDocumentBuffer } from "../../services/editorConfigService";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const LOCAL = "pdf-local";
const CLEANUP = "pdf-cleanup";
const FLATTEN = "pdf-flatten";
const DRAFT_ID = "__draft";
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const FONT_SIZES = [8, 10, 12, 14, 16, 18, 24, 32];
const TOOLS = [
    { id: "select", label: "Select", Icon: FiMousePointer },
    { id: "text", label: "Text", Icon: FiType },
    { id: "highlight", label: "Highlight", Icon: FiDroplet },
    { id: "rect", label: "Box", Icon: FiSquare },
    { id: "ink", label: "Draw", Icon: FiPenTool },
    { id: "whiteout", label: "Whiteout", Icon: FiEyeOff, title: "Cover content visually (not a secure redaction)" },
];
const EMPTY = [];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const toArrayBuffer = (b) => (b instanceof ArrayBuffer ? b : b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));

const bbox = (a) => {
    if (a.type !== "ink") return { x: a.x, y: a.y, w: a.w || 0, h: a.h || 0 };
    const xs = a.points.map((p) => p[0]);
    const ys = a.points.map((p) => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};
const shift = (a, dx, dy) =>
    a.type === "ink" ? { ...a, points: a.points.map(([x, y]) => [x + dx, y + dy]) } : { ...a, x: a.x + dx, y: a.y + dy };
const innerTransform = (rot, W, H) =>
    ({ 90: `translateX(${H}px) rotate(90deg)`, 180: `translate(${W}px, ${H}px) rotate(180deg)`, 270: `translateY(${W}px) rotate(270deg)` }[rot] || "none");

const AutoText = ({ value, style, onChange, onDone }) => {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }, [value, style.fontSize, style.width]);
    useEffect(() => { ref.current?.focus(); }, []);
    return (
        <textarea
            ref={ref}
            className="ude-pdfv-text editing"
            style={style}
            value={value}
            spellCheck
            onChange={(e) => onChange(e.target.value)}
            onBlur={onDone}
            onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.currentTarget.blur(); } }}
        />
    );
};

const PdfPage = React.memo(function PdfPage({
    pdf, index, info, zoom, rot, deleted, items, selected, editing, tool, canEdit, root,
    onPointer, onTextChange, onTextDone, onRotate, onToggleDelete, setEl,
}) {
    const outerRef = useRef(null);
    const canvasRef = useRef(null);
    const [visible, setVisible] = useState(false);
    const W = info.w * zoom;
    const H = info.h * zoom;
    const quarter = rot === 90 || rot === 270;
    const editable = canEdit && !deleted;

    useEffect(() => {
        const el = outerRef.current;
        if (!el || !root) return undefined;
        const io = new IntersectionObserver(([en]) => setVisible(en.isIntersecting), { root, rootMargin: "1200px 0px" });
        io.observe(el);
        return () => io.disconnect();
    }, [root]);

    // Render off-screen, then copy: no blank flash while re-rendering on zoom.
    useEffect(() => {
        const cv = canvasRef.current;
        if (!cv) return undefined;
        if (!visible || !pdf) { cv.width = 0; cv.height = 0; return undefined; }
        let task = null;
        let cancelled = false;
        (async () => {
            try {
                const page = await pdf.getPage(index + 1);
                if (cancelled) return;
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                const vp = page.getViewport({ scale: zoom * dpr });
                const off = document.createElement("canvas");
                off.width = Math.floor(vp.width);
                off.height = Math.floor(vp.height);
                task = page.render({ canvas: off, canvasContext: off.getContext("2d"), viewport: vp });
                await task.promise;
                if (cancelled) return;
                cv.width = off.width;
                cv.height = off.height;
                cv.getContext("2d").drawImage(off, 0, 0);
            } catch { /* cancelled or document replaced */ }
        })();
        return () => { cancelled = true; try { task?.cancel(); } catch { /* ignore */ } };
    }, [visible, pdf, zoom, index]);

    const toBase = (e) => {
        const r = outerRef.current.getBoundingClientRect();
        const ox = e.clientX - r.left;
        const oy = e.clientY - r.top;
        let x = ox, y = oy;
        if (rot === 90) { x = oy; y = H - ox; }
        else if (rot === 180) { x = W - ox; y = H - oy; }
        else if (rot === 270) { x = W - oy; y = ox; }
        return { x: clamp(x / zoom, 0, info.w), y: clamp(y / zoom, 0, info.h) };
    };

    const pointer = (type) => (e) => {
        if (!editable) return;
        if (type === "down") {
            if (e.button !== 0 || e.target.closest("textarea")) return;
            e.preventDefault();
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            const t = e.target.closest("[data-id]");
            onPointer("down", index, toBase(e), t ? t.dataset.id : null, e.target.dataset ? e.target.dataset.handle || null : null);
        } else {
            onPointer(type, index, toBase(e));
        }
    };

    const shapes = items.filter((a) => a.type !== "text");
    const texts = items.filter((a) => a.type === "text");
    const sel = selected ? items.find((a) => a.id === selected) : null;
    const sb = sel && editable && sel.type !== "text" ? bbox(sel) : null;
    const hs = 8 / zoom;

    return (
        <div className={`ude-pdfv-page${deleted ? " deleted" : ""}`} ref={setEl}>
            <div className="ude-pdfv-pagebar">
                <span>Page {index + 1}</span>
                {canEdit && (
                    <>
                        <button type="button" title="Rotate left" onClick={() => onRotate(index, -90)}><FiRotateCcw size={13} /></button>
                        <button type="button" title="Rotate right" onClick={() => onRotate(index, 90)}><FiRotateCw size={13} /></button>
                        <button type="button" title={deleted ? "Restore page" : "Delete page"} onClick={() => onToggleDelete(index)}>
                            {deleted ? "Restore" : <FiTrash2 size={13} />}
                        </button>
                    </>
                )}
            </div>
            <div ref={outerRef} className="ude-pdfv-outer" style={{ width: quarter ? H : W, height: quarter ? W : H }}>
                <div className="ude-pdfv-inner" style={{ width: W, height: H, transform: innerTransform(rot, W, H) }}>
                    <canvas ref={canvasRef} style={{ width: W, height: H }} />
                    <div
                        className={`ude-pdfv-layer tool-${editable ? tool : "view"}`}
                        onPointerDown={pointer("down")}
                        onPointerMove={pointer("move")}
                        onPointerUp={pointer("up")}
                        onPointerCancel={pointer("up")}
                    >
                        <svg width={W} height={H} viewBox={`0 0 ${info.w} ${info.h}`}>
                            {shapes.map((a) =>
                                a.type === "ink" ? (
                                    <g key={a.id} data-id={a.id}>
                                        <polyline points={a.points.map((p) => p.join(",")).join(" ")} fill="none" stroke={a.color}
                                            strokeWidth={a.stroke || 2} strokeLinecap="round" strokeLinejoin="round" />
                                        <polyline className="hit" points={a.points.map((p) => p.join(",")).join(" ")} fill="none"
                                            stroke="transparent" strokeWidth={10} />
                                    </g>
                                ) : (
                                    <rect key={a.id} data-id={a.id} className={`ann-${a.type}`} x={a.x} y={a.y} width={a.w} height={a.h}
                                        fill={a.type === "highlight" ? a.color : a.type === "whiteout" ? "#ffffff" : "transparent"}
                                        fillOpacity={a.type === "highlight" ? 0.4 : 1}
                                        stroke={a.type === "rect" ? a.color : "none"} strokeWidth={a.stroke || 2} />
                                )
                            )}
                            {sb && <rect className="ude-pdfv-selbox" x={sb.x - 2} y={sb.y - 2} width={sb.w + 4} height={sb.h + 4} />}
                            {sb && sel.type !== "ink" && (
                                <rect className="ude-pdfv-handle" data-id={sel.id} data-handle="se"
                                    x={sb.x + sb.w - hs / 2} y={sb.y + sb.h - hs / 2} width={hs} height={hs} />
                            )}
                        </svg>
                        {texts.map((a) => {
                            const style = { left: a.x * zoom, top: a.y * zoom, width: a.w * zoom, fontSize: (a.size || 12) * zoom, color: a.color };
                            return editing === a.id && editable ? (
                                <AutoText key={a.id} value={a.text} style={style}
                                    onChange={(v) => onTextChange(a.id, v)} onDone={() => onTextDone(a.id)} />
                            ) : (
                                <div key={a.id} data-id={a.id} className={`ude-pdfv-text${selected === a.id ? " sel" : ""}`} style={style}>
                                    {a.text || "\u00a0"}
                                    {selected === a.id && editable && <span className="ude-pdfv-handle" data-id={a.id} data-handle="se" />}
                                </div>
                            );
                        })}
                    </div>
                    {deleted && <div className="ude-pdfv-deleted">Page will be removed on save</div>}
                </div>
            </div>
        </div>
    );
});

/**
 * PDF editor: pdf.js rendering, vector annotations in a Yjs doc (live co-authoring, undo/redo),
 * flattened into the PDF with pdf-lib on save.
 */
const PdfEditor = ({ fileId, initialBytes, baseVersion, ydoc, canEdit: canEditProp, userName, onReady, onDirty, onError, registerApi }) => {
    const [scroller, setScroller] = useState(null);
    const [base, setBase] = useState(() => ({ bytes: toArrayBuffer(initialBytes), version: baseVersion }));
    const [pdf, setPdf] = useState(null);
    const [infos, setInfos] = useState([]);
    const [busy, setBusy] = useState(true);
    const [zoom, setZoomState] = useState(1);
    const [tool, setTool] = useState("select");
    const [color, setColor] = useState("#e11d48");
    const [hlColor, setHlColor] = useState("#fde047");
    const [fontSize, setFontSize] = useState(14);
    const [selected, setSelected] = useState(null);
    const [editing, setEditing] = useState(null);
    const [annots, setAnnots] = useState({});
    const [pages, setPages] = useState({});
    const [draft, setDraftState] = useState(null);
    const [curPage, setCurPage] = useState(1);
    const [, bump] = useState(0);

    const encrypted = useMemo(() => isEncryptedPdf(base.bytes), [base.bytes]);
    const canEdit = !!canEditProp && !encrypted;

    const annMap = useMemo(() => ydoc.getMap("pdfAnnots"), [ydoc]);
    const pageMap = useMemo(() => ydoc.getMap("pdfPages"), [ydoc]);
    const meta = useMemo(() => ydoc.getMap("pdfMeta"), [ydoc]);
    const undo = useMemo(
        () => new Y.UndoManager([annMap, pageMap], { trackedOrigins: new Set([LOCAL]), captureTimeout: 500 }),
        [annMap, pageMap]
    );
    useEffect(() => () => undo.destroy(), [undo]);

    const cb = useRef({});
    cb.current = { onReady, onDirty, onError };
    const baseRef = useRef(base);
    baseRef.current = base;
    const pdfRef = useRef(null);
    pdfRef.current = pdf;
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;
    const live = useRef({});
    live.current = { selected, editing, canEdit };
    const draftRef = useRef(null);
    const dragRef = useRef(null);
    const lastDownRef = useRef({ id: null, t: 0 });
    const pageEls = useRef([]);
    const readyRef = useRef(false);
    const snapRef = useRef(null);
    const anchorRef = useRef(null);
    const fittedRef = useRef(false);
    const rafRef = useRef(0);
    const prevEditing = useRef(null);

    const setDraft = useCallback((d) => { draftRef.current = d; setDraftState(d); }, []);
    const commit = useCallback((fn) => ydoc.transact(fn, LOCAL), [ydoc]);
    const putAnn = useCallback((a) => commit(() => annMap.set(a.id, a)), [commit, annMap]);
    const delAnn = useCallback((id) => commit(() => annMap.delete(id)), [commit, annMap]);

    // Yjs -> React
    useEffect(() => {
        const sync = () => { setAnnots(annMap.toJSON()); setPages(pageMap.toJSON()); };
        sync();
        const onChange = (_ev, tr) => {
            sync();
            if (tr.origin === FLATTEN || tr.origin === CLEANUP || tr.changed.has(meta)) return;
            cb.current.onDirty?.();
        };
        const onUndo = () => bump((n) => n + 1);
        annMap.observe(onChange);
        pageMap.observe(onChange);
        undo.on("stack-item-added", onUndo);
        undo.on("stack-item-popped", onUndo);
        undo.on("stack-cleared", onUndo);
        return () => {
            annMap.unobserve(onChange);
            pageMap.unobserve(onChange);
            undo.off("stack-item-added", onUndo);
            undo.off("stack-item-popped", onUndo);
            undo.off("stack-cleared", onUndo);
        };
    }, [annMap, pageMap, meta, undo]);

    // Load / reload the base PDF
    useEffect(() => {
        let alive = true;
        setBusy(true);
        const task = pdfjsLib.getDocument({ data: new Uint8Array(base.bytes.slice(0)), isEvalSupported: false });
        task.promise
            .then(async (doc) => {
                const list = [];
                for (let i = 1; i <= doc.numPages; i++) {
                    const vp = (await doc.getPage(i)).getViewport({ scale: 1 });
                    list.push({ w: vp.width, h: vp.height });
                }
                if (!alive) return;
                setPdf(doc);
                setInfos(list);
                setBusy(false);
                if (!readyRef.current) { readyRef.current = true; cb.current.onReady?.(); }
            })
            .catch((e) => { if (alive) { setBusy(false); cb.current.onError?.(e); } });
        return () => { alive = false; task.destroy(); };
    }, [base.bytes]);

    // A peer saved (flattened) the shared document: load the new base file.
    useEffect(() => {
        const check = async () => {
            const v = meta.get("base");
            if (!v || v <= baseRef.current.version) return;
            try {
                setBusy(true);
                const bytes = await fetchDocumentBuffer(fileId);
                undo.clear();
                setSelected(null);
                setEditing(null);
                setBase({ bytes: toArrayBuffer(bytes), version: v });
            } catch (e) {
                setBusy(false);
                cb.current.onError?.(e);
            }
        };
        const onMeta = (_ev, tr) => { if (!tr.local) check(); };
        check();
        meta.observe(onMeta);
        return () => meta.unobserve(onMeta);
    }, [meta, fileId, undo]);

    // Remove text boxes left empty when editing ends.
    useEffect(() => {
        const prev = prevEditing.current;
        prevEditing.current = editing;
        if (!prev || prev === editing) return;
        const a = annMap.get(prev);
        if (a && a.type === "text" && !(a.text || "").trim()) ydoc.transact(() => annMap.delete(prev), CLEANUP);
    }, [editing, annMap, ydoc]);

    useEffect(() => {
        registerApi?.({
            getBytes: async () => {
                const doc = pdfRef.current;
                if (!doc) throw new Error("The PDF is still loading.");
                const snap = { annots: annMap.toJSON(), pages: pageMap.toJSON() };
                snapRef.current = snap;
                return buildPdf({ baseBytes: baseRef.current.bytes, pdfjsDoc: doc, annots: snap.annots, pages: snap.pages });
            },
            // Clears only what was flattened; edits made while saving survive.
            afterSave: (bytes, version) => {
                const snap = snapRef.current || { annots: {}, pages: {} };
                const removed = Object.entries(snap.pages).filter(([, v]) => v && v.del).map(([k]) => +k);
                const rotated = new Set(Object.entries(snap.pages).filter(([, v]) => v && v.rot).map(([k]) => +k));
                ydoc.transact(() => {
                    Object.entries(snap.annots).forEach(([id, v]) => {
                        const cur = annMap.get(id);
                        if (cur && JSON.stringify(cur) === JSON.stringify(v)) annMap.delete(id);
                    });
                    const rest = [];
                    annMap.forEach((v, id) => rest.push([id, v]));
                    rest.forEach(([id, v]) => {
                        if (removed.includes(v.page) || rotated.has(v.page)) { annMap.delete(id); return; }
                        const np = v.page - removed.filter((r) => r < v.page).length;
                        if (np !== v.page) annMap.set(id, { ...v, page: np });
                    });
                    pageMap.clear();
                    meta.set("base", version);
                }, FLATTEN);
                undo.clear();
                setSelected(null);
                setEditing(null);
                setBase({ bytes: toArrayBuffer(bytes), version });
            },
            hasChanges: () => annMap.size > 0 || pageMap.size > 0,
        });
        return () => registerApi?.(null);
    }, [registerApi, ydoc, annMap, pageMap, meta, undo]);

    // ---------- zoom ----------
    const setZoom = useCallback((z) => {
        if (scroller) anchorRef.current = scroller.scrollTop / Math.max(1, scroller.scrollHeight);
        setZoomState(clamp(Math.round(z * 100) / 100, MIN_ZOOM, MAX_ZOOM));
    }, [scroller]);
    useLayoutEffect(() => {
        if (anchorRef.current === null || !scroller) return;
        scroller.scrollTop = anchorRef.current * scroller.scrollHeight;
        anchorRef.current = null;
    }, [zoom, scroller]);
    const fitWidth = useCallback(() => {
        if (!scroller || !infos.length) return;
        setZoom((scroller.clientWidth - 64) / Math.max(...infos.map((i) => i.w)));
    }, [scroller, infos, setZoom]);
    useEffect(() => {
        if (fittedRef.current || !scroller || !infos.length) return;
        fittedRef.current = true;
        const z = (scroller.clientWidth - 64) / Math.max(...infos.map((i) => i.w));
        setZoomState(clamp(Math.round(z * 100) / 100, 0.5, 1.5));
    }, [scroller, infos]);
    useEffect(() => {
        if (!scroller) return undefined;
        const onWheel = (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            setZoom(zoomRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
        };
        scroller.addEventListener("wheel", onWheel, { passive: false });
        return () => scroller.removeEventListener("wheel", onWheel);
    }, [scroller, setZoom]);

    const onScroll = () => {
        if (rafRef.current || !scroller) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = 0;
            const top = scroller.scrollTop + scroller.clientHeight * 0.3;
            let n = 1;
            pageEls.current.forEach((el, i) => { if (el && el.offsetTop <= top) n = i + 1; });
            setCurPage(n);
        });
    };
    const goTo = (n) => pageEls.current[clamp(n, 1, infos.length) - 1]?.scrollIntoView({ block: "start", behavior: "smooth" });

    // ---------- page operations ----------
    const rotatePage = useCallback((i, delta) => commit(() => {
        const k = String(i);
        const cur = pageMap.get(k) || {};
        pageMap.set(k, { ...cur, rot: ((((cur.rot || 0) + delta) % 360) + 360) % 360 });
    }), [commit, pageMap]);
    const toggleDelete = useCallback((i) => {
        const k = String(i);
        const cur = pageMap.get(k) || {};
        if (!cur.del) {
            const deleted = Object.values(pageMap.toJSON()).filter((p) => p && p.del).length;
            if (deleted + 1 >= infos.length) { toast.warning("A PDF must keep at least one page."); return; }
        }
        commit(() => pageMap.set(k, { ...cur, del: !cur.del }));
    }, [commit, pageMap, infos.length]);

    // ---------- annotation interaction ----------
    const onPointer = useCallback((type, page, pt, targetId, handle) => {
        if (type === "down") {
            const now = Date.now();
            const last = lastDownRef.current;
            const isDouble = !!targetId && last.id === targetId && now - last.t < 350;
            lastDownRef.current = { id: targetId, t: now };
            const hit = targetId ? annMap.get(targetId) : null;

            if (tool === "select" || (tool === "text" && hit && hit.type === "text")) {
                if (!hit) { setSelected(null); setEditing(null); return; }
                setSelected(hit.id);
                if (hit.type === "text" && (isDouble || tool === "text") && !handle) { setEditing(hit.id); return; }
                setEditing(null);
                dragRef.current = { mode: handle ? "resize" : "move", start: pt, orig: hit, moved: false };
                return;
            }
            setSelected(null);
            setEditing(null);
            if (tool === "text") {
                const pageW = infos[page] ? infos[page].w : 600;
                const a = {
                    id: newId(), type: "text", page, x: pt.x, y: pt.y,
                    w: clamp(pageW - pt.x - 8, 60, 260), text: "", size: fontSize, color, by: userName,
                };
                putAnn(a);
                setSelected(a.id);
                setEditing(a.id);
                return;
            }
            if (tool === "ink") {
                dragRef.current = { mode: "ink" };
                setDraft({ id: DRAFT_ID, type: "ink", page, points: [[pt.x, pt.y]], color, stroke: 2 });
                return;
            }
            dragRef.current = { mode: "rect", start: pt };
            setDraft({ id: DRAFT_ID, type: tool, page, x: pt.x, y: pt.y, w: 0, h: 0, color: tool === "highlight" ? hlColor : color, stroke: 2 });
            return;
        }

        const d = dragRef.current;
        if (!d) return;
        if (type === "move") {
            if (d.mode === "move") {
                const dx = pt.x - d.start.x, dy = pt.y - d.start.y;
                if (!d.moved && Math.hypot(dx, dy) < 2) return;
                d.moved = true;
                setDraft(shift(d.orig, dx, dy));
            } else if (d.mode === "resize") {
                d.moved = true;
                const dx = pt.x - d.start.x, dy = pt.y - d.start.y;
                setDraft(d.orig.type === "text"
                    ? { ...d.orig, w: Math.max(40, d.orig.w + dx) }
                    : { ...d.orig, w: Math.max(4, d.orig.w + dx), h: Math.max(4, d.orig.h + dy) });
            } else if (d.mode === "ink") {
                const dr = draftRef.current;
                if (!dr) return;
                const lp = dr.points[dr.points.length - 1];
                if (Math.hypot(pt.x - lp[0], pt.y - lp[1]) < 1.5) return;
                setDraft({ ...dr, points: [...dr.points, [pt.x, pt.y]] });
            } else {
                const s = d.start;
                setDraft({ ...draftRef.current, x: Math.min(s.x, pt.x), y: Math.min(s.y, pt.y), w: Math.abs(pt.x - s.x), h: Math.abs(pt.y - s.y) });
            }
            return;
        }

        dragRef.current = null;
        const dr = draftRef.current;
        setDraft(null);
        if (!dr) return;
        if (d.mode === "move" || d.mode === "resize") { if (d.moved) putAnn(dr); return; }
        if (d.mode === "ink" && dr.points.length < 2) return;
        if (d.mode === "rect" && (dr.w < 3 || dr.h < 3)) return;
        const a = { ...dr, id: newId(), by: userName };
        putAnn(a);
        setSelected(a.id);
    }, [tool, color, hlColor, fontSize, annMap, putAnn, setDraft, infos, userName]);

    const onTextChange = useCallback((id, text) => {
        const a = annMap.get(id);
        if (a) putAnn({ ...a, text });
    }, [annMap, putAnn]);
    const onTextDone = useCallback((id) => setEditing((cur) => (cur === id ? null : cur)), []);

    const deleteSelected = useCallback(() => {
        const id = live.current.selected;
        if (!id) return;
        delAnn(id);
        setSelected(null);
        setEditing(null);
    }, [delAnn]);

    useEffect(() => {
        const onKey = (e) => {
            const tag = e.target && e.target.tagName;
            if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
            const mod = e.ctrlKey || e.metaKey;
            const k = (e.key || "").toLowerCase();
            if (live.current.canEdit && mod && k === "z") { e.preventDefault(); if (e.shiftKey) undo.redo(); else undo.undo(); return; }
            if (live.current.canEdit && mod && k === "y") { e.preventDefault(); undo.redo(); return; }
            if (live.current.canEdit && live.current.selected && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); deleteSelected(); return; }
            if (e.key === "Escape") { setSelected(null); setEditing(null); return; }
            if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); setZoom(zoomRef.current * 1.2); }
            if (mod && e.key === "-") { e.preventDefault(); setZoom(zoomRef.current / 1.2); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [undo, deleteSelected, setZoom]);

    const selAnn = selected ? annots[selected] : null;
    const pickerColor = selAnn && selAnn.type !== "whiteout" ? selAnn.color : tool === "highlight" ? hlColor : color;
    const applyColor = (c) => {
        if (selAnn && selAnn.type !== "whiteout") {
            putAnn({ ...selAnn, color: c });
            if (selAnn.type === "highlight") setHlColor(c); else setColor(c);
            return;
        }
        if (tool === "highlight") setHlColor(c); else setColor(c);
    };
    const applySize = (s) => {
        setFontSize(s);
        if (selAnn && selAnn.type === "text") putAnn({ ...selAnn, size: s });
    };

    const pageItems = useMemo(() => {
        const m = {};
        Object.values(annots).forEach((a) => {
            if (draft && draft.id === a.id) return;
            (m[a.page] = m[a.page] || []).push(a);
        });
        if (draft) (m[draft.page] = m[draft.page] || []).push(draft);
        return m;
    }, [annots, draft]);

    return (
        <div className="ude-pdfv">
            <div className="ude-pdfv-toolbar" role="toolbar" aria-label="PDF tools">
                {canEdit && (
                    <div className="ude-pdfv-grp">
                        {TOOLS.map(({ id, label, Icon, title }) => (
                            <button key={id} type="button" className={tool === id ? "on" : ""} title={title || label} aria-pressed={tool === id}
                                onClick={() => { setTool(id); setEditing(null); if (id !== "select") setSelected(null); }}>
                                <Icon size={14} /><span>{label}</span>
                            </button>
                        ))}
                    </div>
                )}
                {canEdit && (
                    <div className="ude-pdfv-grp">
                        <input type="color" value={pickerColor} title="Colour" aria-label="Colour" onChange={(e) => applyColor(e.target.value)} />
                        {(tool === "text" || (selAnn && selAnn.type === "text")) && (
                            <select title="Font size" aria-label="Font size" value={selAnn && selAnn.type === "text" ? selAnn.size : fontSize}
                                onChange={(e) => applySize(Number(e.target.value))}>
                                {FONT_SIZES.map((s) => <option key={s} value={s}>{s} pt</option>)}
                            </select>
                        )}
                        <button type="button" title="Undo (Ctrl+Z)" disabled={!undo.undoStack.length} onClick={() => undo.undo()}><FiCornerUpLeft size={14} /></button>
                        <button type="button" title="Redo (Ctrl+Y)" disabled={!undo.redoStack.length} onClick={() => undo.redo()}><FiCornerUpRight size={14} /></button>
                        <button type="button" title="Delete selected (Del)" disabled={!selected} onClick={deleteSelected}><FiTrash2 size={14} /></button>
                    </div>
                )}
                <div className="ude-pdfv-grp">
                    <button type="button" title="Zoom out (Ctrl -)" onClick={() => setZoom(zoom / 1.2)}><FiMinus size={14} /></button>
                    <select aria-label="Zoom" value={ZOOMS.includes(zoom) ? zoom : "custom"}
                        onChange={(e) => e.target.value !== "custom" && setZoom(Number(e.target.value))}>
                        {!ZOOMS.includes(zoom) && <option value="custom">{Math.round(zoom * 100)}%</option>}
                        {ZOOMS.map((z) => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
                    </select>
                    <button type="button" title="Zoom in (Ctrl +)" onClick={() => setZoom(zoom * 1.2)}><FiPlus size={14} /></button>
                    <button type="button" title="Fit width" onClick={fitWidth}><FiMaximize2 size={14} /></button>
                </div>
                <div className="ude-pdfv-grp">
                    <button type="button" title="Previous page" disabled={curPage <= 1} onClick={() => goTo(curPage - 1)}><FiChevronUp size={14} /></button>
                    <span className="ude-pdfv-pageno">{curPage} / {infos.length || "–"}</span>
                    <button type="button" title="Next page" disabled={curPage >= infos.length} onClick={() => goTo(curPage + 1)}><FiChevronDown size={14} /></button>
                </div>
                {encrypted && <span className="ude-pdfv-note">Encrypted PDF: view only</span>}
            </div>
            <div className="ude-pdfv-scroll" ref={setScroller} onScroll={onScroll}>
                {busy && <div className="ude-pdfv-busy"><FiLoader className="ude-spin" size={14} /> Loading…</div>}
                <div className="ude-pdfv-list">
                    {infos.map((info, i) => {
                        const ps = pages[String(i)] || {};
                        return (
                            <PdfPage
                                key={i}
                                pdf={pdf}
                                index={i}
                                info={info}
                                zoom={zoom}
                                rot={ps.rot || 0}
                                deleted={!!ps.del}
                                items={pageItems[i] || EMPTY}
                                selected={selected}
                                editing={editing}
                                tool={tool}
                                canEdit={canEdit}
                                root={scroller}
                                onPointer={onPointer}
                                onTextChange={onTextChange}
                                onTextDone={onTextDone}
                                onRotate={rotatePage}
                                onToggleDelete={toggleDelete}
                                setEl={(el) => { pageEls.current[i] = el; }}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PdfEditor;