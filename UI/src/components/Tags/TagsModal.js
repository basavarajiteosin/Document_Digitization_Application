import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FiX, FiFolder, FiFile, FiLock, FiTag } from "react-icons/fi";
import "./tags.css";

const config = require("../../services/config.json");
const API = `${config.DDA_API_API_URL}Search/`;

const normalize = (raw, existing) => {
  const incoming = raw.split(",").map((t) => t.trim().toLowerCase().slice(0, 30)).filter(Boolean);
  return Array.from(new Set([...existing, ...incoming])).slice(0, 10);
};

/** item = { docType: "Folder" | "Document", id, name } */
const TagsModal = ({ item, onClose, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [access, setAccess] = useState({ canEdit: false, reason: "", tags: "" });
  const [tags, setTags] = useState([]);
  const [input, setInput] = useState("");
  const [popular, setPopular] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, p] = await Promise.all([
          axios.get(`${API}TagAccess`, { params: { docType: item.docType, id: item.id } }),
          axios.get(`${API}Tags`).catch(() => ({ data: { data: [] } })),
        ]);
        if (!alive) return;
        const d = a.data.data;
        setAccess(d);
        setTags(d.tags ? d.tags.split(",").filter(Boolean) : []);
        setPopular(p.data.data || []);
      } catch (e) {
        toast.error(e.response?.data?.message || "Unable to load tags");
        onClose();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.docType, item.id]);

  const add = (raw) => { setTags((t) => normalize(raw, t)); setInput(""); };

  const save = async () => {
    const final = normalize(input, tags);
    setSaving(true);
    try {
      const res = await axios.post(`${API}SetTags`, { docType: item.docType, id: item.id, tags: final.join(",") });
      if (res.data.success) {
        toast.success("Tags updated");
        onSaved && onSaved(res.data.data);
        onClose();
      } else toast.error(res.data.message || "Failed to update tags");
    } catch (e) {
      toast.error(e.response?.data?.message || "Error updating tags");
    } finally {
      setSaving(false);
    }
  };

  const ro = !access.canEdit;

  return (
    <div className="sft-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sft-modal" role="dialog" aria-modal="true" aria-label="Manage tags">
        <header className="sft-head">
          <div className="sft-title"><FiTag size={18} /> Manage tags</div>
          <button type="button" className="sft-x" onClick={onClose} aria-label="Close"><FiX size={18} /></button>
        </header>

        <div className="sft-body">
          <div className="sft-item">
            {item.docType === "Folder" ? <FiFolder size={16} /> : <FiFile size={16} />}
            <span title={item.name}>{item.name}</span>
          </div>
          <p className="sft-hint">
            {item.docType === "Folder"
              ? "Files inside this folder become searchable by these tags."
              : "This file becomes searchable by these tags."}
          </p>

          {loading ? (
            <div className="sft-skel" />
          ) : (
            <>
              {ro && (
                <div className="sft-lock"><FiLock size={14} /> {access.reason || "You cannot edit tags on this item."}</div>
              )}
              <div className={`sft-box ${ro ? "is-ro" : ""}`}>
                {tags.length === 0 && ro && <span className="sft-none">No tags</span>}
                {tags.map((t) => (
                  <span key={t} className="sft-tag">
                    {t}
                    {!ro && (
                      <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>
                        <FiX size={12} />
                      </button>
                    )}
                  </span>
                ))}
                {!ro && (
                  <input
                    autoFocus
                    maxLength={30}
                    value={input}
                    placeholder={tags.length ? "" : "Type a tag and press Enter"}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); }
                      else if (e.key === "Backspace" && !input && tags.length) setTags(tags.slice(0, -1));
                    }}
                  />
                )}
              </div>
              {!ro && <small className="sft-hint">Up to 10 tags, 30 characters each.</small>}
              {!ro && popular.length > 0 && (
                <div className="sft-suggest">
                  {popular.filter((p) => !tags.includes(p.tag)).slice(0, 8).map((p) => (
                    <button key={p.tag} type="button" className="sft-sug" onClick={() => add(p.tag)}>+ {p.tag}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="sft-foot">
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={onClose}>{ro ? "Close" : "Cancel"}</button>
          {!ro && (
            <button type="button" className="btn btn-primary btn-sm" disabled={saving || loading} onClick={save}>
              {saving ? "Saving..." : "Save"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default TagsModal;