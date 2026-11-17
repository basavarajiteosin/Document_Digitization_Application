import React, { useEffect, useRef, useState } from "react";
import { RTFJS } from "rtf.js";
import { FiMinus, FiPlus } from "react-icons/fi";
import TextEditor from "./TextEditor";

const toAb = (u) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);

/** RTF: rendered preview (rtf.js) + raw source editing (CodeMirror) so formatting is never lost on save. */
const RtfEditor = ({ file, buf, canEdit, onReady, onDirty, onError, registerApi }) => {
  const [tab, setTab] = useState("view");
  const [zoom, setZoom] = useState(1);
  const [err, setErr] = useState("");
  const hostRef = useRef(null);
  const srcApi = useRef(null);

  useEffect(() => {
    registerApi?.({ getBytes: async () => (srcApi.current ? srcApi.current.getBytes() : new Uint8Array(buf)) });
    return () => registerApi?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab !== "view") return undefined;
    let alive = true;
    (async () => {
      try {
        setErr("");
        const bytes = srcApi.current ? await srcApi.current.getBytes() : new Uint8Array(buf);
        RTFJS.loggingEnabled(false);
        const els = await new RTFJS.Document(toAb(bytes)).render();
        if (!alive || !hostRef.current) return;
        hostRef.current.innerHTML = "";
        els.forEach((e) => hostRef.current.appendChild(e));
      } catch (e) {
        if (alive) setErr(`Could not render this RTF (${e?.message || "unsupported content"}). Use the Source tab to view or edit it.`);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="ude-rtf">
      <div className="ude-tx-bar">
        <div className="ude-tx-grp">
          <button type="button" className={tab === "view" ? "on" : ""} onClick={() => setTab("view")}>Preview</button>
          <button type="button" className={tab === "source" ? "on" : ""} onClick={() => setTab("source")}>Source{canEdit ? " (editable)" : ""}</button>
        </div>
        {tab === "view" && (
          <div className="ude-tx-grp">
            <button type="button" title="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}><FiMinus size={14} /></button>
            <span className="ude-tx-zoom">{Math.round(zoom * 100)}%</span>
            <button type="button" title="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))}><FiPlus size={14} /></button>
          </div>
        )}
      </div>
      <div className="ude-rtf-view" style={{ display: tab === "view" ? "block" : "none" }}>
        {err && <div className="ude-pdfv-note" style={{ margin: 16 }}>{err}</div>}
        <div className="ude-rtf-page" style={{ zoom }} ref={hostRef} />
      </div>
      <div className="ude-rtf-src" style={{ display: tab === "source" ? "block" : "none" }}>
        <TextEditor
          file={{ name: file.name.replace(/\.rtf$/i, ".txt") }}
          buf={buf}
          canEdit={canEdit}
          onReady={onReady}
          onDirty={onDirty}
          onError={onError}
          registerApi={(a) => { srcApi.current = a; }}
        />
      </div>
    </div>
  );
};

export default RtfEditor;