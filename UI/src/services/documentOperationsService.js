import axios from "axios";

const config = require("./config.json");

// Reuses FileVersion/Upload: archives previous version, bumps version, audit, lock + concurrency checks.
export const saveDocument = async (fileId, name, bytes, expectedVersion, note = "Edited in document editor") => {
  const fd = new FormData();
  fd.append("FileId", fileId);
  fd.append("File", new File([bytes], name));
  fd.append("Note", note);
  fd.append("ExpectedVersion", expectedVersion);
  fd.append("Source", "editor");
  const res = await axios.post(`${config.DDA_API_API_URL}FileVersion/Upload`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  if (!res.data.success) throw new Error(res.data.message || "Save failed");
  return res.data.data; // new version number
};

export const isVersionConflict = (e) =>
  /newer version/i.test(e?.response?.data?.message || e?.message || "");

// CHANGED: send the acting user so the Download log is attributed correctly
export const downloadDocument = (fileId, userId) => {
  const a = document.createElement("a");
  a.href = `${config.DDA_API_API_URL}FolderData/DownloadFile?fileId=${fileId}${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`;
  a.target = "_self";
  a.download = "";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// Downloads the editor's current content (including unsaved changes).
export const downloadBytes = (bytes, name) => {
  const url = URL.createObjectURL(new Blob([bytes]));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
};