import React, { useEffect, useMemo, useRef, useState } from "react";
import PostalMime from "postal-mime";
import MsgReader from "@kenjiuno/msgreader";
import { FiPaperclip, FiDownload, FiPrinter } from "react-icons/fi";
import TextEditor from "./TextEditor";
import { downloadBytes } from "../../services/documentOperationsService";

const KEY = "ude.mail.settings";
const DEFAULTS = { size: 14, remote: false, plain: false };
const load = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULTS; } };
const esc = (s = "") => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : b >= 1024 ? (b / 1024).toFixed(1) + " KB" : (b || 0) + " B");
const addr = (a) => (a ? (a.name && a.address ? `${a.name} <${a.address}>` : a.address || a.name || "") : "");

const parseEml = async (bytes) => {
  const m = await PostalMime.parse(bytes);
  return {
    subject: m.subject || "(no subject)",
    from: addr(m.from),
    to: (m.to || []).map(addr), cc: (m.cc || []).map(addr), bcc: (m.bcc || []).map(addr),
    date: m.date ? new Date(m.date) : null,
    html: m.html || "", text: m.text || "",
    headers: (m.headers || []).map((h) => `${h.key}: ${h.value}`).join("\n"),
    attachments: (m.attachments || []).map((a) => ({
      name: a.filename || "attachment", type: a.mimeType || "", size: a.content?.byteLength || 0,
      cid: (a.contentId || "").replace(/[<>]/g, ""), inline: a.disposition === "inline", bytes: () => a.content,
    })),
  };
};

const parseMsg = (buf) => {
  const r = new MsgReader(buf);
  const d = r.getFileData();
  if (d.error) throw new Error(d.error);
  const rec = (t) => (d.recipients || []).filter((x) => (x.recipType || "to") === t)
    .map((x) => (x.name && x.email ? `${x.name} <${x.email}>` : x.name || x.email || ""));
  const when = d.messageDeliveryTime || d.creationTime || d.clientSubmitTime;
  return {
    subject: d.subject || "(no subject)",
    from: d.senderName && d.senderEmail ? `${d.senderName} <${d.senderEmail}>` : d.senderName || d.senderEmail || "",
    to: rec("to"), cc: rec("cc"), bcc: rec("bcc"),
    date: when ? new Date(when) : null,
    html: d.bodyHtml || (d.html ? new TextDecoder().decode(d.html) : ""),
    text: d.body || "",
    headers: d.headers || "",
    attachments: (d.attachments || []).map((a, i) => ({
      name: a.fileName || a.name || "attachment", type: a.attachMimeTag || "", size: a.contentLength || 0,
      cid: a.pidContentId || "", inline: !!a.pidContentId, bytes: () => r.getAttachment(i).content,
    })),
  };
};

/** .eml (view + raw source editing) and .msg (view only): sandboxed body, attachments, headers, print. */
const EmailViewer = ({ file, buf, canEdit, onReady, onDirty, onError, registerApi }) => {
  const isEml = /\.eml$/i.test(file.name);
  const [tab, setTab] = useState("message");
  const [model, setModel] = useState(null);
  const [err, setErr] = useState("");
  const [s, setS] = useState(load);
  const frameRef = useRef(null);
  const srcApi = useRef(null);

  useEffect(() => {
    if (isEml) {
      registerApi?.({ getBytes: async () => (srcApi.current ? srcApi.current.getBytes() : new Uint8Array(buf)) });
      return () => registerApi?.(null);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "source") return undefined;
    let alive = true;
    (async () => {
      try {
        setErr("");
        let m;
        if (isEml) m = await parseEml(srcApi.current ? await srcApi.current.getBytes() : new Uint8Array(buf));
        else m = parseMsg(buf);
        if (!alive) return;
        setModel(m);
        if (!isEml) onReady?.();
      } catch (e) {
        if (!alive) return;
        if (isEml) setErr(`Could not parse this message (${e?.message || "invalid format"}). Use the Source tab.`);
        else onError?.(e);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const set = (k, v) => setS((x) => { const n = { ...x, [k]: v }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* optional */ } return n; });

  const built = useMemo(() => {
    if (!model) return { srcDoc: "", urls: [] };
    const urls = [];
    let html = model.html;
    model.attachments.filter((a) => a.cid).forEach((a) => {
      const u = URL.createObjectURL(new Blob([a.bytes()], { type: a.type || "application/octet-stream" }));
      urls.push(u);
      html = html.split(`cid:${a.cid}`).join(u);
    });
    const csp = `default-src 'none'; img-src data: blob:${s.remote ? " https: http:" : ""}; style-src 'unsafe-inline'; font-src data:`;
    const body = s.plain || !html ? `<pre style="white-space:pre-wrap;font:inherit;margin:0">${esc(model.text)}</pre>` : html;
    return {
      urls,
      srcDoc: `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>body{font:${s.size}px/1.55 "Segoe UI",Arial,sans-serif;margin:16px;color:#1e293b;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${body}</body></html>`,
    };
  }, [model, s.plain, s.remote, s.size]);

  useEffect(() => () => built.urls.forEach((u) => URL.revokeObjectURL(u)), [built]);

  const print = () => { try { frameRef.current?.contentWindow?.print(); } catch { /* blocked */ } };
  const files = (model?.attachments || []).filter((a) => !a.inline || !a.cid);

  return (
    <div className="ude-mail">
      <div className="ude-tx-bar">
        <div className="ude-tx-grp">
          <button type="button" className={tab === "message" ? "on" : ""} onClick={() => setTab("message")}>Message</button>
          <button type="button" className={tab === "headers" ? "on" : ""} onClick={() => setTab("headers")}>Headers</button>
          {isEml && <button type="button" className={tab === "source" ? "on" : ""} onClick={() => setTab("source")}>Source{canEdit ? " (editable)" : ""}</button>}
        </div>
        {tab === "message" && (
          <div className="ude-tx-grp">
            <button type="button" className={s.plain ? "on" : ""} disabled={!model?.html} onClick={() => set("plain", !s.plain)}>Plain text</button>
            <button type="button" className={s.remote ? "on" : ""} onClick={() => set("remote", !s.remote)} title="Remote images can reveal that you opened the message">Remote images</button>
            <select aria-label="Font size" value={s.size} onChange={(e) => set("size", +e.target.value)}>
              {[12, 13, 14, 16, 18, 20].map((n) => <option key={n} value={n}>{n} px</option>)}
            </select>
            <button type="button" onClick={print}><FiPrinter size={14} /><span>Print</span></button>
          </div>
        )}
      </div>

      {tab !== "source" && (
        <div className="ude-mail-body">
          {err && <div className="ude-pdfv-note" style={{ margin: 16 }}>{err}</div>}
          {!model && !err && <div className="ude-zip-empty">Parsing message…</div>}
          {model && tab === "message" && (
            <>
              <header className="ude-mail-head">
                <h3>{model.subject}</h3>
                <dl>
                  <dt>From</dt><dd>{model.from || "-"}</dd>
                  <dt>To</dt><dd>{model.to.join(", ") || "-"}</dd>
                  {model.cc.length > 0 && <><dt>Cc</dt><dd>{model.cc.join(", ")}</dd></>}
                  {model.bcc.length > 0 && <><dt>Bcc</dt><dd>{model.bcc.join(", ")}</dd></>}
                  <dt>Date</dt><dd>{model.date ? model.date.toLocaleString() : "-"}</dd>
                </dl>
                {files.length > 0 && (
                  <div className="ude-mail-att">
                    {files.map((a, i) => (
                      <button key={i} type="button" title={`Download ${a.name}`} onClick={() => downloadBytes(a.bytes(), a.name)}>
                        <FiPaperclip size={13} /> {a.name} <small>{fmtSize(a.size)}</small> <FiDownload size={13} />
                      </button>
                    ))}
                  </div>
                )}
              </header>
              <iframe ref={frameRef} title="Message body" className="ude-mail-frame" sandbox="allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox" srcDoc={built.srcDoc} />
            </>
          )}
          {model && tab === "headers" && <pre className="ude-mail-headers">{model.headers || "No headers available."}</pre>}
        </div>
      )}

      {isEml && (
        <div className="ude-rtf-src" style={{ display: tab === "source" ? "block" : "none" }}>
          <TextEditor
            file={{ name: "message.txt" }}
            buf={buf}
            canEdit={canEdit}
            onReady={onReady}
            onDirty={onDirty}
            onError={onError}
            registerApi={(a) => { srcApi.current = a; }}
          />
        </div>
      )}
    </div>
  );
};

export default EmailViewer;