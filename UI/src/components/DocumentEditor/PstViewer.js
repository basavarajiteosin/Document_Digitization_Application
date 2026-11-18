import React, { useState, useMemo, useRef } from "react";
import PostalMime from "postal-mime";
import { FiMail, FiPaperclip, FiDownload, FiPrinter, FiSearch, FiFileText } from "react-icons/fi";
import { downloadBytes } from "../../services/documentOperationsService";

const KEY = "ude.mail.settings";
const DEFAULTS = { size: 14, remote: false, plain: false };
const load = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULTS; } };
const esc = (s = "") => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : b >= 1024 ? (b / 1024).toFixed(1) + " KB" : (b || 0) + " B");

/** Browser-compatible Mail/Archive Viewer using postal-mime */
const PstViewer = ({ file, buf, onReady, onError }) => {
  const [messages, setMessages] = useState([]);
  const [selMsg, setSelMsg] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState(load);
  const frameRef = useRef(null);

  // Parse email file (.eml / raw source) on mount
  React.useEffect(() => {
    async function parseEmail() {
      try {
        setLoading(true);
        const parser = new PostalMime();
        const email = await parser.parse(buf);
        
        const formattedMsg = {
          subject: email.subject || "(no subject)",
          from: email.from ? `${email.from.name || ""} <${email.from.address}>` : "",
          to: email.to ? email.to.map(t => t.address).join(", ") : "",
          cc: email.cc ? email.cc.map(c => c.address).join(", ") : "",
          date: email.date || new Date().toISOString(),
          text: email.text || "",
          html: email.html || "",
          attachments: (email.attachments || []).map(att => ({
            name: att.filename || "attachment",
            size: att.fileSize || att.content?.byteLength || 0,
            bytes: () => new Uint8Array(att.content)
          }))
        };

        setMessages([formattedMsg]);
        setSelMsg(formattedMsg);
        onReady?.();
      } catch (e) {
        onError?.(new Error("Could not parse email file format. Please provide a valid .eml file."));
      } finally {
        setLoading(false);
      }
    }
    parseEmail();
  }, [buf, onReady, onError]);

  const set = (k, v) => setS((x) => { const n = { ...x, [k]: v }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch {} return n; });

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => `${m.subject} ${m.from} ${m.to}`.toLowerCase().includes(q));
  }, [messages, query]);

  const srcDoc = useMemo(() => {
    if (!selMsg) return "";
    const csp = `default-src 'none'; img-src data: blob:${s.remote ? " https: http:" : ""}; style-src 'unsafe-inline'; font-src data:`;
    const body = s.plain || !selMsg.html ? `<pre style="white-space:pre-wrap;font:inherit;margin:0">${esc(selMsg.text)}</pre>` : selMsg.html;
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>body{font:${s.size}px/1.55 "Segoe UI",Arial,sans-serif;margin:16px;color:#1e293b;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${body}</body></html>`;
  }, [selMsg, s]);

  const print = () => { try { frameRef.current?.contentWindow?.print(); } catch {} };

  if (loading) return <div className="ude-zip-empty">Loading and parsing email message…</div>;

  return (
    <div className="ude-pst">
      <div className="ude-tx-bar">
        <div className="ude-tx-grp">
          <button type="button" className={s.plain ? "on" : ""} disabled={!selMsg?.html} onClick={() => set("plain", !s.plain)}>Plain text</button>
          <button type="button" className={s.remote ? "on" : ""} onClick={() => set("remote", !s.remote)} title="Remote images">Remote images</button>
          <select aria-label="Font size" value={s.size} onChange={(e) => set("size", +e.target.value)}>
            {[12, 13, 14, 16, 18, 20].map((n) => <option key={n} value={n}>{n} px</option>)}
          </select>
          <button type="button" disabled={!selMsg} onClick={print}><FiPrinter size={14} /><span>Print</span></button>
        </div>
      </div>
      <div className="ude-pst-main">
        <aside className="ude-pst-tree">
          <div style={{ padding: "12px", fontWeight: "600", fontSize: "13px", borderBottom: "1px solid #e2e8f0" }}>
            <FiFileText size={14} style={{ marginRight: 6 }} /> {file?.name || "Archive"}
          </div>
        </aside>

        <section className="ude-pst-list">
          <div className="ude-pst-search"><FiSearch size={13} /><input type="search" placeholder="Search messages" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search messages" /></div>
          <div className="ude-pst-items">
            {filteredItems.map((i, idx) => (
              <button key={idx} type="button" className={`ude-pst-item${selMsg === i ? " sel" : ""}`} onClick={() => setSelMsg(i)}>
                <b>{i.subject}</b>
                <span>{i.from}{i.attachments?.length > 0 && <FiPaperclip size={12} />}</span>
                <small>{i.date ? new Date(i.date).toLocaleString() : ""}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="ude-pst-read">
          {!selMsg && <div className="ude-zip-empty">Select a message to read it.</div>}
          {selMsg && (
            <>
              <header className="ude-mail-head">
                <h3>{selMsg.subject}</h3>
                <dl>
                  <dt>From</dt><dd>{selMsg.from || "-"}</dd>
                  <dt>To</dt><dd>{selMsg.to || "-"}</dd>
                  {selMsg.cc && <><dt>Cc</dt><dd>{selMsg.cc}</dd></>}
                  <dt>Date</dt><dd>{selMsg.date ? new Date(selMsg.date).toLocaleString() : "-"}</dd>
                </dl>
                {selMsg.attachments?.length > 0 && (
                  <div className="ude-mail-att">
                    {selMsg.attachments.map((a, i) => (
                      <button key={i} type="button" title={`Download ${a.name}`} onClick={() => downloadBytes(a.bytes(), a.name)}>
                        <FiPaperclip size={13} /> {a.name} <small>{fmtSize(a.size)}</small> <FiDownload size={13} />
                      </button>
                    ))}
                  </div>
                )}
              </header>
              <iframe ref={frameRef} title="Message body" className="ude-mail-frame" sandbox="allow-same-origin allow-modals allow-popups" srcDoc={srcDoc} />
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default PstViewer;