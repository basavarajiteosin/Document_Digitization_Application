import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiZoomIn, FiZoomOut, FiRotateCw, FiRotateCcw, FiMaximize2, FiMinimize2, FiDownload, FiRepeat,
  FiPrinter, FiCopy, FiPlay, FiPause, FiMove, FiGrid, FiInfo, FiChevronLeft, FiChevronRight, FiMaximize,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { downloadBytes } from "../../services/documentOperationsService";

const KEY = "ude.image.settings";
const DEFAULTS = { bg: "black", smooth: true, grid: false, info: true };
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp" };
const BGS = [["checker", "Checker"], ["white", "White"], ["black", "Black"], ["dark", "Dark"]];
const MIN = 0.05;
const MAX = 16;

const load = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULTS; } };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(2) + " MB" : b >= 1024 ? (b / 1024).toFixed(1) + " KB" : (b || 0) + " B");
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** Image viewer: zoom (wheel/pinch/double-click), pan, fit/fill/actual, rotate, flip, fullscreen,
 *  slideshow-ready, copy, print, download, background/smoothing/grid, info panel, keyboard shortcuts. View only. */
const ImageViewer = ({ file, buf, onReady, onError }) => {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const drag = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const cb = useRef({});
  cb.current = { onReady, onError };

  const ext = file.name.split(".").pop().toLowerCase();
  const [url, setUrl] = useState(null);
  const [dim, setDim] = useState(null);
  const [mode, setMode] = useState("fit");           // fit | fill | actual | custom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rot, setRot] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [s, setS] = useState(load);
  const [full, setFull] = useState(false);
  const [panning, setPanning] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [frames, setFrames] = useState(null);          // animated GIF/WebP are shown natively; kept for future use

  useEffect(() => {
    const u = URL.createObjectURL(new Blob([buf], { type: MIME[ext] || "image/*" }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [buf, ext]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setStageSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setStageSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const set = (k, v) => setS((x) => { const n = { ...x, [k]: v }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* optional */ } return n; });

  // Natural size as displayed after rotation.
  const quarter = rot === 90 || rot === 270;
  const dispW = dim ? (quarter ? dim.h : dim.w) : 0;
  const dispH = dim ? (quarter ? dim.w : dim.h) : 0;

  const fitScale = useMemo(() => {
    if (!dim || !stageSize.w) return 1;
    const pad = 24;
    return Math.min((stageSize.w - pad) / dispW, (stageSize.h - pad) / dispH, 1e6);
  }, [dim, stageSize, dispW, dispH]);
  const fillScale = useMemo(() => {
    if (!dim || !stageSize.w) return 1;
    return Math.max(stageSize.w / dispW, stageSize.h / dispH);
  }, [dim, stageSize, dispW, dispH]);

  const scale = mode === "fit" ? Math.min(fitScale, 1) : mode === "fill" ? fillScale : mode === "actual" ? 1 : zoom;

  const resetView = useCallback((m = "fit") => { setMode(m); setPan({ x: 0, y: 0 }); }, []);
  const zoomTo = useCallback((z, origin) => {
    const next = clamp(+z.toFixed(4), MIN, MAX);
    setPan((p) => {
      if (!origin) return p;
      const k = next / scale;
      return { x: origin.x - (origin.x - p.x) * k, y: origin.y - (origin.y - p.y) * k };
    });
    setZoom(next);
    setMode("custom");
  }, [scale]);
  const step = (f) => zoomTo(scale * f);

  const stageOrigin = (e) => {
    const r = stageRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };

  // wheel: zoom around the cursor
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      zoomTo(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), stageOrigin(e));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scale, zoomTo]);

  // drag to pan, pinch to zoom
  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    stageRef.current.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: scale };
      drag.current = null;
    } else {
      drag.current = { x: e.clientX, y: e.clientY, p: pan };
      setPanning(true);
    }
  };
  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      zoomTo(pinch.current.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d));
    } else if (drag.current) {
      setMode((m) => (m === "fit" ? "custom" : m));
      if (mode === "fit") setZoom(scale);
      setPan({ x: drag.current.p.x + e.clientX - drag.current.x, y: drag.current.p.y + e.clientY - drag.current.y });
    }
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!pointers.current.size) { drag.current = null; setPanning(false); }
  };

  const onDouble = (e) => {
    if (mode === "fit" || scale < 1) { zoomTo(1, stageOrigin(e)); }
    else resetView("fit");
  };

  // fullscreen
  const toggleFull = () => {
    const el = rootRef.current;
    if (!document.fullscreenElement) el?.requestFullscreen?.().catch(() => toast.info("Fullscreen is not available."));
    else document.exitFullscreen?.();
  };
  useEffect(() => {
    const h = () => setFull(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const rotate = (d) => { setRot((r) => (r + d + 360) % 360); setPan({ x: 0, y: 0 }); };
  const reset = () => { setRot(0); setFlipH(false); setFlipV(false); resetView("fit"); };

  // render the current view (rotation/flip) to a canvas for copy / print / export
  const toCanvas = () => new Promise((resolve, reject) => {
    const img = imgRef.current;
    if (!img || !dim) return reject(new Error("Image not ready."));
    const c = document.createElement("canvas");
    c.width = dispW; c.height = dispH;
    const g = c.getContext("2d");
    g.translate(dispW / 2, dispH / 2);
    g.rotate((rot * Math.PI) / 180);
    g.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    g.drawImage(img, -dim.w / 2, -dim.h / 2, dim.w, dim.h);
    resolve(c);
  });
  const blobOf = async (type = "image/png") => {
    const c = await toCanvas();
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not export the image."))), type, 0.95));
  };

  const copy = async () => {
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error("Copying images is not supported in this browser.");
      await navigator.clipboard.write([new window.ClipboardItem({ "image/png": await blobOf() })]);
      toast.success("Image copied to clipboard.");
    } catch (e) { toast.error(e?.message || "Could not copy the image."); }
  };
  const print = async () => {
    try {
      const u = URL.createObjectURL(await blobOf());
      const w = window.open("", "_blank");
      if (!w) { URL.revokeObjectURL(u); return toast.error("Allow pop-ups to print."); }
      w.document.write(`<!doctype html><title>${file.name}</title><style>html,body{margin:0;height:100%}img{max-width:100%;max-height:100vh;display:block;margin:auto}</style><img src="${u}" onload="setTimeout(function(){print()},150)">`);
      w.document.close();
      setTimeout(() => URL.revokeObjectURL(u), 60000);
    } catch (e) { toast.error(e?.message || "Could not print the image."); }
  };
  const saveAs = async (type, extn) => {
    try {
      const b = await blobOf(type);
      downloadBytes(await b.arrayBuffer(), file.name.replace(/\.[^.]+$/, "") + extn);
    } catch (e) { toast.error(e?.message || "Could not export the image."); }
  };
  const edited = rot !== 0 || flipH || flipV;

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const k = e.key;
      if (k === "+" || k === "=") { e.preventDefault(); step(1.25); }
      else if (k === "-" || k === "_") { e.preventDefault(); step(1 / 1.25); }
      else if (k === "0") resetView("fit");
      else if (k === "1") { resetView("actual"); setZoom(1); }
      else if (k === "f" || k === "F") toggleFull();
      else if (k === "r") rotate(90);
      else if (k === "R") rotate(-90);
      else if (k === "h") setFlipH((v) => !v);
      else if (k === "v") setFlipV((v) => !v);
      else if (k === "i") set("info", !s.info);
      else if (k === "g") set("grid", !s.grid);
      else if (k.startsWith("Arrow")) {
        const d = 60;
        setMode((m) => (m === "fit" ? "custom" : m));
        setPan((p) => ({ x: p.x + (k === "ArrowLeft" ? d : k === "ArrowRight" ? -d : 0), y: p.y + (k === "ArrowUp" ? d : k === "ArrowDown" ? -d : 0) }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, s.info, s.grid]);

  const ratio = dim ? (() => { const g = gcd(dim.w, dim.h); return `${dim.w / g}:${dim.h / g}`; })() : "";
  const megapixels = dim ? ((dim.w * dim.h) / 1e6).toFixed(2) : "";
  const transform = `translate(${pan.x}px, ${pan.y}px) rotate(${rot}deg) scale(${scale * (flipH ? -1 : 1)}, ${scale * (flipV ? -1 : 1)})`;

  return (
    <div className={`ude-img${full ? " is-full" : ""}`} ref={rootRef}>
      <div className="ude-tx-bar" role="toolbar" aria-label="Image tools">
        <div className="ude-tx-grp">
          <button type="button" title="Zoom out (-)" onClick={() => step(1 / 1.25)}><FiZoomOut size={14} /></button>
          <span className="ude-tx-zoom">{Math.round(scale * 100)}%</span>
          <button type="button" title="Zoom in (+)" onClick={() => step(1.25)}><FiZoomIn size={14} /></button>
          <button type="button" className={mode === "fit" ? "on" : ""} title="Fit to window (0)" onClick={() => resetView("fit")}><FiMinimize2 size={14} /><span>Fit</span></button>
          <button type="button" className={mode === "fill" ? "on" : ""} title="Fill window" onClick={() => resetView("fill")}><FiMaximize size={14} /><span>Fill</span></button>
          <button type="button" className={mode === "actual" ? "on" : ""} title="Actual size (1)" onClick={() => { resetView("actual"); setZoom(1); }}>1:1</button>
        </div>
        <div className="ude-tx-grp">
          <button type="button" title="Rotate left (Shift+R)" onClick={() => rotate(-90)}><FiRotateCcw size={14} /></button>
          <button type="button" title="Rotate right (R)" onClick={() => rotate(90)}><FiRotateCw size={14} /></button>
          <button type="button" className={flipH ? "on" : ""} title="Flip horizontally (H)" onClick={() => setFlipH((v) => !v)}><FiRepeat size={14} /></button>
          <button type="button" className={flipV ? "on" : ""} title="Flip vertically (V)" onClick={() => setFlipV((v) => !v)}><FiRepeat size={14} style={{ transform: "rotate(90deg)" }} /></button>
          <button type="button" disabled={!edited && mode === "fit"} title="Reset view" onClick={reset}>Reset</button>
        </div>
        <div className="ude-tx-grp">
          <select aria-label="Background" value={s.bg} onChange={(e) => set("bg", e.target.value)}>
            {BGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button type="button" className={s.smooth ? "on" : ""} aria-pressed={s.smooth} title="Smooth scaling (off = crisp pixels)" onClick={() => set("smooth", !s.smooth)}>Smooth</button>
          <button type="button" className={s.grid ? "on" : ""} aria-pressed={s.grid} title="Pixel grid at high zoom (G)" onClick={() => set("grid", !s.grid)}><FiGrid size={14} /></button>
          <button type="button" className={s.info ? "on" : ""} aria-pressed={s.info} title="Image info (I)" onClick={() => set("info", !s.info)}><FiInfo size={14} /></button>
        </div>
        <div className="ude-tx-grp">
          <button type="button" title="Copy to clipboard" onClick={copy}><FiCopy size={14} /><span>Copy</span></button>
          <button type="button" title="Print" onClick={print}><FiPrinter size={14} /><span>Print</span></button>
          <select aria-label="Download" value="" onChange={(e) => {
            const v = e.target.value;
            if (v === "orig") downloadBytes(buf, file.name);
            else if (v === "png") saveAs("image/png", ".png");
            else if (v === "jpg") saveAs("image/jpeg", ".jpg");
            else if (v === "webp") saveAs("image/webp", ".webp");
          }}>
            <option value="" disabled>Download…</option>
            <option value="orig">Original ({ext.toUpperCase()})</option>
            <option value="png">As PNG{edited ? " (with edits)" : ""}</option>
            <option value="jpg">As JPEG{edited ? " (with edits)" : ""}</option>
            <option value="webp">As WebP{edited ? " (with edits)" : ""}</option>
          </select>
          <button type="button" className={full ? "on" : ""} title="Fullscreen (F)" onClick={toggleFull}>{full ? <FiMinimize2 size={14} /> : <FiMaximize2 size={14} />}<span>{full ? "Exit" : "Fullscreen"}</span></button>
        </div>
      </div>

      <div className="ude-img-main">
        <div
          ref={stageRef}
          className={`ude-img-stage bg-${s.bg}${panning ? " panning" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDouble}
        >
          {url && (
            <img
              ref={imgRef}
              src={url}
              alt={file.name}
              draggable={false}
              onLoad={(e) => { setDim({ w: e.target.naturalWidth, h: e.target.naturalHeight }); cb.current.onReady?.(); }}
              onError={() => cb.current.onError?.(new Error("This image could not be displayed."))}
              style={{
                width: dim ? dim.w : "auto",
                height: dim ? dim.h : "auto",
                transform,
                imageRendering: s.smooth ? "auto" : "pixelated",
                visibility: dim ? "visible" : "hidden",
              }}
            />
          )}
          {s.grid && scale >= 8 && <div className="ude-img-pixgrid" style={{ backgroundSize: `${scale}px ${scale}px` }} />}
          <div className="ude-img-hint"><FiMove size={12} /> Scroll to zoom · drag to pan · double-click to toggle</div>
        </div>

        {s.info && dim && (
          <aside className="ude-img-info" aria-label="Image information">
            <h6>Image info</h6>
            <dl>
              <dt>Name</dt><dd title={file.name}>{file.name}</dd>
              <dt>Format</dt><dd>{ext.toUpperCase()}</dd>
              <dt>File size</dt><dd>{fmtSize(buf.byteLength)}</dd>
              <dt>Dimensions</dt><dd>{dim.w} × {dim.h} px</dd>
              <dt>Aspect ratio</dt><dd>{ratio}</dd>
              <dt>Megapixels</dt><dd>{megapixels} MP</dd>
              <dt>Zoom</dt><dd>{Math.round(scale * 100)}%</dd>
              <dt>Rotation</dt><dd>{rot}°{flipH ? " · flipped H" : ""}{flipV ? " · flipped V" : ""}</dd>
            </dl>
            <h6>Shortcuts</h6>
            <ul>
              <li><kbd>+</kbd> <kbd>-</kbd> zoom</li>
              <li><kbd>0</kbd> fit · <kbd>1</kbd> actual size</li>
              <li><kbd>R</kbd> / <kbd>Shift+R</kbd> rotate</li>
              <li><kbd>H</kbd> <kbd>V</kbd> flip</li>
              <li><kbd>F</kbd> fullscreen</li>
              <li><kbd>←↑↓→</kbd> pan</li>
              <li><kbd>G</kbd> grid · <kbd>I</kbd> info</li>
            </ul>
          </aside>
        )}
      </div>

      <div className="ude-tx-status">
        <span>{dim ? `${dim.w}×${dim.h}` : "Loading…"}</span>
        <span>{fmtSize(buf.byteLength)}</span>
        <span>{Math.round(scale * 100)}%</span>
        <span className="ro">View only</span>
      </div>
    </div>
  );
};

export default ImageViewer;