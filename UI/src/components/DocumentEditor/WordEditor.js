import React, { useEffect, useRef } from "react";
import { SuperDoc } from "superdoc";
import "superdoc/style.css";

const config = require("../../services/config.json");

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const COAUTHORING = config.wordCoauthoring !== false;
const DESTROY_GRACE_MS = 15000;

const asArrayBuffer = async (out) => {
  const v = Array.isArray(out) ? out[0] : out;
  if (!v) return null;
  if (v instanceof Blob) return v.arrayBuffer();
  if (v instanceof ArrayBuffer) return v;
  if (ArrayBuffer.isView(v)) return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
  return null;
};

const isZip = (ab) => {
  const u = new Uint8Array(ab, 0, Math.min(4, ab.byteLength));
  return u.length === 4 && u[0] === 0x50 && u[1] === 0x4b && u[2] === 0x03 && u[3] === 0x04;
};

// Never let a failed or empty export overwrite the stored file.
export const exportDocx = async (sd) => {
  let ab = null;
  if (typeof sd?.export === "function") {
    try {
      ab = await asArrayBuffer(await sd.export({ exportType: ["docx"], triggerDownload: false, isFinalDoc: false }));
    } catch { /* fall back to the editor-level exporter */ }
  }
  const editor = sd?.activeEditor;
  if (!ab && editor && typeof editor.exportDocx === "function") {
    ab = await asArrayBuffer(await editor.exportDocx({ isFinalDoc: false }));
  }
  if (!ab || ab.byteLength < 100 || !isZip(ab)) {
    throw new Error("The editor could not produce a valid .docx file. Your changes were not saved.");
  }
  return ab;
};

/** DOCX editor: SuperDoc, with optional Yjs co-authoring over CollabHub. */
const WordEditor = ({ file, buf, provider, canEdit, mode, user, onReady, onDirty, onError, onFallback, registerApi }) => {
  const tbHostRef = useRef(null);
  const bodyHostRef = useRef(null);
  const sdRef = useRef(null);
  const readyRef = useRef(false);
  const editableRef = useRef(false);
  const modeRef = useRef(mode);
  const cb = useRef({});
  cb.current = { onReady, onDirty, onError, onFallback };

  useEffect(() => {
    let alive = true;
    let sd = null;
    let ready = false;
    let pendingDestroy = false;
    let tbEl = null;
    let bodyEl = null;

    const teardown = () => {
      try { sd?.destroy(); } catch { /* already gone */ }
      sd = null;
      tbEl?.remove();
      bodyEl?.remove();
    };

    (async () => {
      try {
        // StrictMode (dev) mounts, unmounts and remounts effects synchronously:
        // yield once so the throwaway mount never constructs an editor.
        await Promise.resolve();
        if (!alive) return;

        const useProvider = COAUTHORING && provider && typeof provider.resolveRole === "function";
        const role = useProvider ? await provider.resolveRole(30000) : "solo";
        if (!alive || !bodyHostRef.current) return;
        const collab = useProvider && (role === "seed" || role === "join");
        if (useProvider && !collab) cb.current.onFallback?.(role);
        const editable = !!canEdit && (!collab || provider.canWrite);
        editableRef.current = editable;

        // Fresh containers per instance: two instances can never share DOM.
        const uid = `${file.id}-${Math.random().toString(36).slice(2, 9)}`;
        bodyEl = document.createElement("div");
        bodyEl.id = `sd-body-${uid}`;
        bodyEl.className = "ude-sd";
        bodyHostRef.current.appendChild(bodyEl);
        if (editable && tbHostRef.current) {
          tbEl = document.createElement("div");
          tbEl.id = `sd-tb-${uid}`;
          tbHostRef.current.appendChild(tbEl);
        }

        const options = {
          selector: `#${bodyEl.id}`,
          document: new File([buf], file.name, { type: DOCX_MIME }),
          documentMode: editable ? modeRef.current || "editing" : "viewing",
          user: { name: user.name, email: user.email || "" },
          pagination: true,
          rulers: editable,
          onReady: () => {
            ready = true;
            readyRef.current = true;
            if (pendingDestroy) { teardown(); return; }
            if (alive) cb.current.onReady?.({ collab, editable });
          },
          onEditorUpdate: () => { if (alive && ready && !collab) cb.current.onDirty?.(); },
          onContentError: (ev) => alive && cb.current.onError?.(ev?.error || new Error("This document could not be parsed.")),
          onException: (ev) => alive && cb.current.onError?.(ev?.error || ev),
        };
        if (tbEl) options.toolbar = `#${tbEl.id}`;
        if (collab) {
          provider.markSynced?.();
          options.modules = { collaboration: { ydoc: provider.ydoc, provider: provider.adapter } };
        }

        sd = new SuperDoc(options);
        sdRef.current = sd;
        registerApi?.({ getBytes: () => exportDocx(sd) });
      } catch (e) {
        if (alive) cb.current.onError?.(e);
      }
    })();

    return () => {
      alive = false;
      registerApi?.(null);
      sdRef.current = null;
      readyRef.current = false;
      if (!sd) { tbEl?.remove(); bodyEl?.remove(); return; }
      // Destroying SuperDoc mid-initialisation leaves its async work running on a dead editor.
      if (ready) teardown();
      else { pendingDestroy = true; setTimeout(teardown, DESTROY_GRACE_MS); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    modeRef.current = mode;
    const sd = sdRef.current;
    if (!sd || !readyRef.current || !editableRef.current || typeof sd.setDocumentMode !== "function") return;
    try { sd.setDocumentMode(mode); } catch (e) { cb.current.onError?.(e); }
  }, [mode]);

  return (
    <div className="ude-wordpane">
      {canEdit && <div ref={tbHostRef} className="ude-sdtoolbar" />}
      <div className="ude-sdwrap"><div ref={bodyHostRef} className="ude-sd-host" /></div>
    </div>
  );
};

export default WordEditor;