import React, { useEffect, useRef, useState } from "react";
import { FiZoomIn, FiZoomOut, FiRotateCw, FiRotateCcw, FiMaximize2, FiDownload, FiRepeat } from "react-icons/fi";
import { downloadBytes } from "../../services/documentOperationsService";

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp" };
const BGS = [["checker", "Checker"], ["white", "White"], ["dark", "Dark"]];

/** Image viewer: zoom, fit, rotate, flip, backgrounds, download. View only. */
const ImageViewer = ({ file, buf, onReady, onError }) => {
    const [url, setUrl] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [fit, setFit] = useState(true);
    const [rot, setRot] = useState(0);
    const [flip, setFlip] = useState(false);
    const [bg, setBg] = useState("dark");
    const [dim, setDim] = useState(null);
    const stage = useRef(null);

    useEffect(() => {
        const ext = file.name.split(".").pop().toLowerCase();
        const u = URL.createObjectURL(new Blob([buf], { type: MIME[ext] || "image/*" }));
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [buf, file.name]);

    useEffect(() => {
        const el = stage.current;
        if (!el) return undefined;
        const onWheel = (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            setFit(false);
            setZoom((z) => Math.min(8, Math.max(0.1, +(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)).toFixed(3))));
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, []);

    const step = (f) => { setFit(false); setZoom((z) => Math.min(8, Math.max(0.1, +(z * f).toFixed(3)))); };

    return (
        <div className="ude-img">
            <div className="ude-tx-bar">
                <div className="ude-tx-grp">
                    <button type="button" title="Zoom out" onClick={() => step(1 / 1.25)}><FiZoomOut size={14} /></button>
                    <span className="ude-tx-zoom">{fit ? "Fit" : `${Math.round(zoom * 100)}%`}</span>
                    <button type="button" title="Zoom in" onClick={() => step(1.25)}><FiZoomIn size={14} /></button>
                    <button type="button" className={fit ? "on" : ""} title="Fit to window" onClick={() => setFit(true)}><FiMaximize2 size={14} /></button>
                    <button type="button" title="Actual size" onClick={() => { setFit(false); setZoom(1); }}>1:1</button>
                </div>
                <div className="ude-tx-grp">
                    <button type="button" title="Rotate left" onClick={() => setRot((r) => (r + 270) % 360)}><FiRotateCcw size={14} /></button>
                    <button type="button" title="Rotate right" onClick={() => setRot((r) => (r + 90) % 360)}><FiRotateCw size={14} /></button>
                    <button type="button" className={flip ? "on" : ""} title="Flip horizontally" onClick={() => setFlip((f) => !f)}><FiRepeat size={14} /></button>
                </div>
                <div className="ude-tx-grp">
                    <select aria-label="Background" value={bg} onChange={(e) => setBg(e.target.value)}>
                        {BGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button type="button" onClick={() => downloadBytes(buf, file.name)}><FiDownload size={14} /><span>Download</span></button>
                </div>
                {dim && <span className="ude-video-info">{dim.w}×{dim.h}</span>}
            </div>
            <div ref={stage} className={`ude-img-stage bg-${bg}`}>
                {url && (
                    <img
                        src={url}
                        alt={file.name}
                        draggable={false}
                        onLoad={(e) => { setDim({ w: e.target.naturalWidth, h: e.target.naturalHeight }); onReady?.(); }}
                        onError={() => onError?.(new Error("This image could not be displayed."))}
                        style={{
                            transform: `rotate(${rot}deg) scaleX(${flip ? -1 : 1})`,
                            ...(fit ? { maxWidth: "100%", maxHeight: "100%" } : { width: dim ? dim.w * zoom : "auto", maxWidth: "none" }),
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default ImageViewer;