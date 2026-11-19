import axios from "axios";

const config = require("./config.json");

const TYPE_MAP = {
  docx: "word", xlsx: "cell", xls: "cell", xlsb: "cell", ods: "cell", pptx: "slide", pdf: "pdf",
  txt: "text", log: "text", md: "text", json: "text", xml: "text", yml: "text", yaml: "text",
  ini: "text", cfg: "text", conf: "text", properties: "text", sql: "text", sh: "text", bat: "text",
  py: "text", js: "text", jsx: "text", ts: "text", css: "text", html: "text", htm: "text", java: "text", cs: "text",
  csv: "csv", tsv: "csv",
  zip: "zip", rar: "rar", rtf: "rtf", eml: "email", msg: "email", pst: "pst",
  mp4: "video", webm: "video", m4v: "video",
  mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio", aac: "audio",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image", bmp: "image",
};

export const getExtension = (name = "") =>
  name.includes(".") ? name.split(".").pop().toLowerCase() : "";

export const getEditorKind = (name) => TYPE_MAP[getExtension(name)] || null;

export const isEditorSupported = (name) => !!getEditorKind(name);

// Reuses FileVersion/List: view-authorization (403 if no access), canUpload, lock state, current version.
export const fetchEditorAccess = async (fileId) => {
  const res = await axios.get(`${config.DDA_API_API_URL}FileVersion/List`, { params: { fileId } });
  if (!res.data.success) throw new Error(res.data.message || "Unable to open the document");
  return res.data.data;
};

// Reuses the existing download endpoint (same repository file, same bearer token).
// CHANGED: editor/viewer content comes from its own endpoint, logged as "View" (not "Download")
export const fetchDocumentBuffer = async (fileId, track = true) => {
  const res = await axios.get(`${config.DDA_API_API_URL}FileVersion/Content`, {
    params: { fileId, track },
    responseType: "arraybuffer",
  });
  return res.data;
};