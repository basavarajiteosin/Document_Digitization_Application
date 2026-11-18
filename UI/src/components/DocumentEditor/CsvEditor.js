import React, { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import Spreadsheet from "x-data-spreadsheet";
import "x-data-spreadsheet/dist/xspreadsheet.css";
import { FiDownload } from "react-icons/fi";
import TextEditor, { detectEncoding, decode, encode } from "./TextEditor";
import { downloadBytes } from "../../services/documentOperationsService";

const KEY = "ude.csv.settings";
const DEFAULTS = { header: true, quoteAll: false };
const MAX_GRID_BYTES = 25 * 1024 * 1024;
const DELIMS = [["auto", "Auto-detect"], [",", "Comma ,"], [";", "Semicolon ;"], ["\t", "Tab"], ["|", "Pipe |"]];
const ENCODINGS = [["utf-8", "UTF-8"], ["utf-8-bom", "UTF-8 with BOM"], ["utf-16le", "UTF-16 LE"], ["latin1", "Windows-1252 / Latin-1"]];

const load = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULTS; } };
const toAb = (u) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);

const toSheet = (rows, header) => {
  const r = {};
  rows.forEach((row, i) => {
    const cells = {};
    row.forEach((v, c) => { cells[c] = { text: String(v ?? "") }; });
    r[i] = { cells };
  });
  r.len = Math.max(rows.length + 50, 100);
  return { name: "Data", rows: r, freeze: header ? "A2" : "A1" };
};

const fromSheet = (data) => {
  const s = data[0] || { rows: {} };
  const out = [];
  let maxC = 0;
  Object.entries(s.rows || {}).forEach(([r, row]) => {
    if (r === "len") return;
    Object.entries(row.cells || {}).forEach(([c, cell]) => {
      if (cell.text === undefined || cell.text === null || cell.text === "") return;
      maxC = Math.max(maxC, +c);
      (out[+r] = out[+r] || [])[+c] = String(cell.text);
    });
  });
  const rows = Array.from(out, (r) => r || []).map((r) => Array.from({ length: maxC + 1 }, (_, i) => r[i] ?? ""));
  while (rows.length && rows[rows.length - 1].every((v) => v === "")) rows.pop();
  return rows;
};

/** CSV/TSV editor: spreadsheet grid (sort/filter/format) + raw source, with delimiter/encoding/line-ending settings. */
const CsvEditor = ({ file, buf, canEdit, onReady, onDirty, onError, registerApi }) => {
  const ext = file.name.split(".").pop().toLowerCase();
  const hostRef = useRef(null);
  const sheetRef = useRef(null);
  const srcApi = useRef(null);
  const readyOnce = useRef(false);
  const cb = useRef({});
  cb.current = { onReady, onDirty, onError };
  const init = useRef(null);
  if (!init.current) {
    const e = detectEncoding(buf);
    init.current = { enc: e, eol: decode(buf, e).includes("\r\n") ? "\r\n" : "\n" };
  }

  const [tab, setTab] = useState(buf.byteLength > MAX_GRID_BYTES ? "source" : "grid");
  const [src, setSrc] = useState(buf);
  const [rows, setRows] = useState(null);
  const [delim, setDelim] = useState(ext === "tsv" ? "\t" : "auto");
  const [used, setUsed] = useState(ext === "tsv" ? "\t" : ",");
  const [enc, setEnc] = useState(init.current.enc);
  const [eol, setEol] = useState(init.current.eol);
  const [s, setS] = useState(load);
  const live = useRef({});
  live.current = { tab, used, enc, eol, s };

  const parse = (bytes, d, e) => {
    const r = Papa.parse(decode(bytes, e), { delimiter: d === "auto" ? "" : d, skipEmptyLines: false });
    const data = r.data;
    if (data.length && data[data.length - 1].length === 1 && data[data.length - 1][0] === "") data.pop();
    setUsed(r.meta.delimiter || ",");
    return data;
  };
  const gridRows = () => fromSheet(sheetRef.current.getData());
  const serialize = (r) => {
    const { used: u, enc: e, eol: l, s: st } = live.current;
    return encode(Papa.unparse(r, { delimiter: u, quotes: st.quoteAll, newline: l }), e);
  };

  useEffect(() => {
    registerApi?.({
      getBytes: async () => (live.current.tab === "grid" ? serialize(gridRows()) : srcApi.current.getBytes()),
    });
    if (tab === "grid") {
      try { setRows(parse(buf, delim, init.current.enc)); } catch (e) { cb.current.onError?.(e); }
    }
    return () => registerApi?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab !== "grid" || !rows || !hostRef.current) return undefined;
    const el = hostRef.current;
    el.innerHTML = "";
    const sheet = new Spreadsheet(el, {
      mode: canEdit ? "edit" : "read",
      showToolbar: canEdit,
      showContextmenu: canEdit,
      view: { height: () => el.clientHeight, width: () => el.clientWidth },
    }).loadData(toSheet(rows, s.header));
    sheetRef.current = sheet;
    if (canEdit) sheet.change(() => cb.current.onDirty?.());
    if (!readyOnce.current) { readyOnce.current = true; cb.current.onReady?.(); }
    return () => { sheetRef.current = null; el.innerHTML = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, rows]);

  const setSetting = (k, v) => setS((x) => {
    const n = { ...x, [k]: v };
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* optional */ }
    return n;
  });

  const switchTab = async (t) => {
    if (t === tab) return;
    try {
      if (t === "source") setSrc(toAb(serialize(gridRows())));
      else {
        const bytes = await srcApi.current.getBytes();
        const e = detectEncoding(toAb(bytes));
        setEnc(e);
        setRows(parse(toAb(bytes), delim, e));
      }
      setTab(t);
    } catch (e) { cb.current.onError?.(e); }
  };

  const changeDelim = (d) => {
    try {
      const bytes = toAb(serialize(gridRows()));
      setDelim(d);
      setRows(parse(bytes, d, live.current.enc));
    } catch (e) { cb.current.onError?.(e); }
  };

  const toggleHeader = () => {
    const next = !s.header;
    setSetting("header", next);
    if (sheetRef.current) setRows(gridRows());
  };

  const exportXlsx = () => {
    const r = tab === "grid" ? gridRows() : parse(src, delim, enc);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r), "Data");
    downloadBytes(XLSX.write(wb, { bookType: "xlsx", type: "array" }), file.name.replace(/\.[^.]+$/, "") + ".xlsx");
  };

  const dims = rows ? `${rows.length.toLocaleString()} rows × ${(rows[0] || []).length.toLocaleString()} columns` : "";
  const out = (fn) => (v) => { fn(v); if (canEdit) cb.current.onDirty?.(); };

  return (
    <div className="ude-csv">
      <div className="ude-tx-bar" role="toolbar" aria-label="CSV tools">
        <div className="ude-tx-grp">
          <button type="button" className={tab === "grid" ? "on" : ""} onClick={() => switchTab("grid")}>Grid</button>
          <button type="button" className={tab === "source" ? "on" : ""} onClick={() => switchTab("source")}>Source</button>
        </div>
        {tab === "grid" && (
          <>
            <div className="ude-tx-grp">
              <select aria-label="Delimiter" value={delim} onChange={(e) => changeDelim(e.target.value)}>
                {DELIMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button type="button" className={s.header ? "on" : ""} aria-pressed={s.header} onClick={toggleHeader} title="Freeze the first row as a header">Header row</button>
              <button type="button" className={s.quoteAll ? "on" : ""} aria-pressed={s.quoteAll} disabled={!canEdit}
                onClick={() => { setSetting("quoteAll", !s.quoteAll); if (canEdit) onDirty?.(); }} title="Wrap every field in quotes when saving">Quote all</button>
            </div>
            <div className="ude-tx-grp">
              <select aria-label="Encoding" value={enc} disabled={!canEdit} onChange={(e) => out(setEnc)(e.target.value)}>
                {ENCODINGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select aria-label="Line endings" value={eol} disabled={!canEdit} onChange={(e) => out(setEol)(e.target.value)}>
                <option value={"\n"}>LF (Unix)</option>
                <option value={"\r\n"}>CRLF (Windows)</option>
              </select>
            </div>
          </>
        )}
        <div className="ude-tx-grp">
          <button type="button" onClick={exportXlsx}><FiDownload size={14} /><span>Export XLSX</span></button>
        </div>
      </div>
      <div className="ude-csv-body">
        {tab === "grid" && <div ref={hostRef} className="ude-csv-grid" />}
        {tab === "source" && (
          <TextEditor
            file={{ name: "data.txt" }}
            buf={src}
            canEdit={canEdit}
            onReady={() => { if (!readyOnce.current) { readyOnce.current = true; cb.current.onReady?.(); } }}
            onDirty={onDirty}
            onError={onError}
            registerApi={(a) => { srcApi.current = a; }}
          />
        )}
      </div>
      {tab === "grid" && <div className="ude-tx-status"><span>{dims}</span><span>Delimiter: {used === "\t" ? "Tab" : used}</span>{!canEdit && <span className="ro">Read-only</span>}</div>}
    </div>
  );
};

export default CsvEditor;