import React, { useEffect, useRef, useState } from "react";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from "@codemirror/search";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { xml } from "@codemirror/lang-xml";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { python } from "@codemirror/lang-python";
import { FiCornerUpLeft, FiCornerUpRight, FiSearch } from "react-icons/fi";

const SETTINGS_KEY = "ude.text.settings";
const DEFAULTS = { wrap: true, fontSize: 14, lineNumbers: true, tabSize: 2, dark: false };
const MAX_EDIT_BYTES = 10 * 1024 * 1024;
const FONT_SIZES = [11, 12, 13, 14, 16, 18, 20, 24];
const ENCODINGS = [["utf-8", "UTF-8"], ["utf-8-bom", "UTF-8 with BOM"], ["utf-16le", "UTF-16 LE"], ["latin1", "Windows-1252 / Latin-1"]];

const loadSettings = () => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") }; } catch { return DEFAULTS; }
};

export const detectEncoding = (buf) => {
  const u = new Uint8Array(buf);
  if (u[0] === 0xef && u[1] === 0xbb && u[2] === 0xbf) return "utf-8-bom";
  if (u[0] === 0xff && u[1] === 0xfe) return "utf-16le";
  try { new TextDecoder("utf-8", { fatal: true }).decode(u); return "utf-8"; } catch { return "latin1"; }
};

export const decode = (buf, enc) => {
  const label = enc === "utf-16le" ? "utf-16le" : enc === "latin1" ? "windows-1252" : "utf-8";
  return new TextDecoder(label).decode(new Uint8Array(buf)); // strips BOM
};

export const encode = (text, enc) => {
  if (enc === "utf-16le") {
    const out = new Uint8Array(2 + text.length * 2);
    out[0] = 0xff; out[1] = 0xfe;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      out[2 + i * 2] = c & 255;
      out[3 + i * 2] = c >> 8;
    }
    return out;
  }
  if (enc === "latin1") {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); out[i] = c < 256 ? c : 63; }
    return out;
  }
  const body = new TextEncoder().encode(text);
  if (enc !== "utf-8-bom") return body;
  const out = new Uint8Array(body.length + 3);
  out.set([0xef, 0xbb, 0xbf]);
  out.set(body, 3);
  return out;
};

const langFor = (name = "") => {
  const e = name.split(".").pop().toLowerCase();
  if (e === "json") return json();
  if (e === "md") return markdown();
  if (e === "xml") return xml();
  if (e === "html" || e === "htm") return html();
  if (e === "js" || e === "jsx") return javascript({ jsx: true });
  if (e === "ts") return javascript({ typescript: true });
  if (e === "css") return css();
  if (e === "sql") return sql();
  if (e === "yml" || e === "yaml") return yaml();
  if (e === "py") return python();
  return [];
};

const darkTheme = EditorView.theme({
  "&": { backgroundColor: "#0f172a", color: "#e2e8f0" },
  ".cm-gutters": { backgroundColor: "#0b1220", color: "#64748b", border: "0" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "rgba(148,163,184,.12)" },
  ".cm-cursor": { borderLeftColor: "#fff" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(59,130,246,.35)" },
}, { dark: true });

const themeExt = (s) => [
  EditorView.theme({
    "&": { height: "100%", fontSize: `${s.fontSize}px` },
    ".cm-scroller": { fontFamily: "ui-monospace, Menlo, Consolas, 'Courier New', monospace", overflow: "auto" },
  }),
  s.dark ? darkTheme : [],
];

/** Plain-text editor (CodeMirror 6): find/replace, undo/redo, wrap, encodings, line endings, themes. */
const TextEditor = ({ file, buf, canEdit, onReady, onDirty, onError, registerApi }) => {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const cb = useRef({});
  cb.current = { onReady, onDirty, onError };
  const comp = useRef({ wrap: new Compartment(), theme: new Compartment(), nums: new Compartment(), tab: new Compartment() });
  const dirtyRef = useRef(false);
  const silentRef = useRef(false);
  const initial = useRef({ enc: detectEncoding(buf), crlf: new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(buf.byteLength, 65536))).includes("\r\n") });
  const encRef = useRef(initial.current.enc);
  const eolRef = useRef(initial.current.crlf ? "crlf" : "lf");

  const [settings, setSettings] = useState(loadSettings);
  const [enc, setEnc] = useState(initial.current.enc);
  const [eol, setEol] = useState(eolRef.current);
  const [status, setStatus] = useState({ ln: 1, col: 1, len: 0, lines: 1 });
  const editable = canEdit && buf.byteLength <= MAX_EDIT_BYTES;

  useEffect(() => {
    try {
      if (buf.byteLength > MAX_EDIT_BYTES && canEdit) cb.current.onError?.(new Error("Files larger than 10 MB open in the download-only viewer."));
      const s = loadSettings();
      const c = comp.current;
      const state = EditorState.create({
        doc: decode(buf, initial.current.enc),
        extensions: [
          c.nums.of(s.lineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []),
          c.wrap.of(s.wrap ? EditorView.lineWrapping : []),
          c.theme.of(themeExt(s)),
          c.tab.of(EditorState.tabSize.of(s.tabSize)),
          history(), drawSelection(), highlightActiveLine(), bracketMatching(), highlightSelectionMatches(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([...searchKeymap, ...historyKeymap, ...defaultKeymap, indentWithTab]),
          langFor(file.name),
          EditorView.editable.of(editable),
          EditorState.readOnly.of(!editable),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !silentRef.current) { dirtyRef.current = true; cb.current.onDirty?.(); }
            if (u.docChanged || u.selectionSet) {
              const head = u.state.selection.main.head;
              const line = u.state.doc.lineAt(head);
              setStatus({ ln: line.number, col: head - line.from + 1, len: u.state.doc.length, lines: u.state.doc.lines });
            }
          }),
        ],
      });
      viewRef.current = new EditorView({ state, parent: hostRef.current });
      registerApi?.({
        getBytes: async () => {
          const t = viewRef.current.state.doc.toString();
          return encode(eolRef.current === "crlf" ? t.replace(/\n/g, "\r\n") : t, encRef.current);
        },
      });
      setStatus({ ln: 1, col: 1, len: state.doc.length, lines: state.doc.lines });
      cb.current.onReady?.();
    } catch (e) {
      cb.current.onError?.(e);
    }
    return () => { registerApi?.(null); viewRef.current?.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const c = comp.current;
    v.dispatch({
      effects: [
        c.nums.reconfigure(settings.lineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []),
        c.wrap.reconfigure(settings.wrap ? EditorView.lineWrapping : []),
        c.theme.reconfigure(themeExt(settings)),
        c.tab.reconfigure(EditorState.tabSize.of(settings.tabSize)),
      ],
    });
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* optional */ }
  }, [settings]);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const changeEncoding = (v) => {
    setEnc(v);
    encRef.current = v;
    const view = viewRef.current;
    if (!dirtyRef.current && view) {            // untouched: re-read the file with the chosen encoding
      silentRef.current = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: decode(buf, v) } });
      silentRef.current = false;
    }
    if (editable) cb.current.onDirty?.();
  };
  const changeEol = (v) => { setEol(v); eolRef.current = v; if (editable) cb.current.onDirty?.(); };
  const run = (fn) => { const v = viewRef.current; if (v) { fn(v); v.focus(); } };

  return (
    <div className={`ude-text${settings.dark ? " dark" : ""}`}>
      <div className="ude-tx-bar" role="toolbar" aria-label="Text tools">
        <div className="ude-tx-grp">
          <button type="button" title="Undo (Ctrl+Z)" disabled={!editable} onClick={() => run(undo)}><FiCornerUpLeft size={14} /></button>
          <button type="button" title="Redo (Ctrl+Y)" disabled={!editable} onClick={() => run(redo)}><FiCornerUpRight size={14} /></button>
          <button type="button" title="Find / replace (Ctrl+F)" onClick={() => run(openSearchPanel)}><FiSearch size={14} /><span>Find</span></button>
        </div>
        <div className="ude-tx-grp">
          <button type="button" className={settings.wrap ? "on" : ""} aria-pressed={settings.wrap} onClick={() => set("wrap", !settings.wrap)}>Wrap</button>
          <button type="button" className={settings.lineNumbers ? "on" : ""} aria-pressed={settings.lineNumbers} onClick={() => set("lineNumbers", !settings.lineNumbers)}>Lines</button>
          <button type="button" className={settings.dark ? "on" : ""} aria-pressed={settings.dark} onClick={() => set("dark", !settings.dark)}>Dark</button>
          <select aria-label="Font size" value={settings.fontSize} onChange={(e) => set("fontSize", +e.target.value)}>
            {FONT_SIZES.map((n) => <option key={n} value={n}>{n} px</option>)}
          </select>
          <select aria-label="Tab size" value={settings.tabSize} onChange={(e) => set("tabSize", +e.target.value)}>
            {[2, 4, 8].map((n) => <option key={n} value={n}>Tab {n}</option>)}
          </select>
        </div>
        <div className="ude-tx-grp">
          <select aria-label="Encoding" value={enc} onChange={(e) => changeEncoding(e.target.value)}>
            {ENCODINGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select aria-label="Line endings" value={eol} disabled={!editable} onChange={(e) => changeEol(e.target.value)}>
            <option value="lf">LF (Unix)</option>
            <option value="crlf">CRLF (Windows)</option>
          </select>
        </div>
      </div>
      <div className="ude-tx-host" ref={hostRef} />
      <div className="ude-tx-status">
        <span>Ln {status.ln}, Col {status.col}</span>
        <span>{status.lines.toLocaleString()} lines</span>
        <span>{status.len.toLocaleString()} chars</span>
        <span>{ENCODINGS.find(([v]) => v === enc)?.[1]}</span>
        {!editable && <span className="ro">Read-only</span>}
      </div>
    </div>
  );
};

export default TextEditor;