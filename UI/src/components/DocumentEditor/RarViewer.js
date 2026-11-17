import React, { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { createExtractorFromData } from "node-unrar-js";
import wasmUrl from "node-unrar-js/esm/js/unrar.wasm";
import { FiDownload } from "react-icons/fi";
import ZipEditor from "./ZipEditor";
import { downloadBytes } from "../../services/documentOperationsService";

const MAX_TOTAL = 500 * 1024 * 1024;

/** RAR archives cannot be re-created in a browser, so this is a read-only browser (preview, extract, convert to ZIP). */
const RarViewer = ({ file, buf, onReady, onError }) => {
  const [zipBuf, setZipBuf] = useState(null);
  const bytesRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const wasmBinary = await (await fetch(wasmUrl)).arrayBuffer();
        const extractor = await createExtractorFromData({ data: new Uint8Array(buf), wasmBinary });
        const list = extractor.getFileList();
        const headers = [...list.fileHeaders];
        if (list.arcHeader?.flags?.headerEncrypted || headers.some((h) => h.flags?.encrypted)) {
          throw new Error("Password-protected RAR files are not supported.");
        }
        if (headers.reduce((n, h) => n + (h.unpSize || 0), 0) > MAX_TOTAL) {
          throw new Error("This archive expands to more than 500 MB and cannot be opened in the browser.");
        }
        const zip = new JSZip();
        const { files } = extractor.extract();
        for (const f of files) {
          const name = f.fileHeader.name.replace(/\\/g, "/");
          if (f.fileHeader.flags.directory) zip.folder(name);
          else zip.file(name, f.extraction.data, { date: f.fileHeader.time ? new Date(f.fileHeader.time) : new Date() });
        }
        const out = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
        if (!alive) return;
        bytesRef.current = out;
        setZipBuf(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength));
      } catch (e) {
        if (alive) onError?.(new Error(e?.message || "Invalid or unsupported RAR file."));
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!zipBuf) return null;
  return (
    <div className="ude-rar">
      <div className="ude-tx-bar">
        <span className="ude-pdfv-note">RAR archives are view-only. Extract files or convert to ZIP to edit.</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => downloadBytes(bytesRef.current, file.name.replace(/\.rar$/i, "") + ".zip")}>
          <FiDownload size={14} /><span>Download as ZIP</span>
        </button>
      </div>
      <div className="ude-rar-body">
        <ZipEditor file={file} buf={zipBuf} canEdit={false} onReady={onReady} onError={onError} />
      </div>
    </div>
  );
};

export default RarViewer;