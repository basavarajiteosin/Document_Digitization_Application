import axios from "axios";

const config = require("./config.json");

const TYPE_MAP = { docx: "word", xlsx: "cell", xls: "cell", pptx: "slide", pdf: "pdf" };

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
export const fetchDocumentBuffer = async (fileId) => {
  const res = await axios.get(`${config.DDA_API_API_URL}FolderData/DownloadFile`, {
    params: { fileId },
    responseType: "arraybuffer",
  });
  return res.data;
};