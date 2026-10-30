import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";

const config = require("../../services/config.json");

const emptyFilters = { docType: "All", extension: "", tag: "", fromDate: "", toDate: "" };

const formatSize = (bytes) => {
  if (bytes === null || bytes === undefined) return "-";
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + " KB";
  return bytes + " Bytes";
};

const SearchDocuments = () => {
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(urlQuery);
  const [filters, setFilters] = useState(emptyFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [applied, setApplied] = useState({ q: urlQuery, ...emptyFilters, page: 1 });
  const [results, setResults] = useState({ items: [], totalCount: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const requestSeq = useRef(0);

  // Header search box changes ?q= -> re-run the search
  useEffect(() => {
    setQuery(urlQuery);
    setApplied((prev) => ({ ...prev, q: urlQuery, page: 1 }));
  }, [urlQuery]);

  useEffect(() => {
    const run = async () => {
      const seq = ++requestSeq.current;
      setLoading(true);
      try {
        const params = {
          query: applied.q,
          docType: applied.docType,
          extension: applied.extension,
          tag: applied.tag,
          fromDate: applied.fromDate,
          toDate: applied.toDate,
          page: applied.page,
          pageSize: 10,
        };
        Object.keys(params).forEach((k) => params[k] === "" && delete params[k]);

        const response = await axios.get(`${config.DDA_API_API_URL}Search/Documents`, { params });
        if (seq !== requestSeq.current) return; // stale response
        if (response.data.success) setResults(response.data.data);
        else toast.error(response.data.message || "Search failed");
      } catch (error) {
        if (seq !== requestSeq.current) return;
        toast.error(error.response?.data?.message || "Error while searching");
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    };
    run();
  }, [applied]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setApplied({ q: query.trim(), ...filters, page: 1 });
  };

  const handleReset = () => {
    setQuery("");
    setFilters(emptyFilters);
    setApplied({ q: "", ...emptyFilters, page: 1 });
  };

  const goToPage = (p) => setApplied((prev) => ({ ...prev, page: p }));

  const handleView = (item) => {
    if (!item.serverPath) return toast.error("No file path available");
    window.open(item.serverPath, "_blank");
  };

  const handleDownload = (item) => {
    const url =
      item.docType === "Folder"
        ? `${config.DDA_API_API_URL}FolderData/DownloadFolder?folderId=${item.id}`
        : `${config.DDA_API_API_URL}FolderData/DownloadFile?fileId=${item.id}`;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_self";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleEditTags = async (item) => {
    const input = window.prompt("Tags (comma separated, max 10):", item.tags || "");
    if (input === null) return;
    try {
      const response = await axios.post(`${config.DDA_API_API_URL}Search/SetFolderTags`, {
        folderId: item.id,
        tags: input,
      });
      if (response.data.success) {
        toast.success("Tags updated");
        setResults((prev) => ({
          ...prev,
          items: prev.items.map((i) =>
            i.docType === "Folder" && i.id === item.id ? { ...i, tags: response.data.data || null } : i
          ),
        }));
      } else {
        toast.error(response.data.message || "Failed to update tags");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error updating tags");
    }
  };

  return (
    <section className="content scroll-content">
      <div className="container-fluid">
        <div className="card card-primary card-outline">
          <div className="card-header">
            <h3 className="card-title text-sm">Search Files and Folders</h3>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="card-body text-sm">
              <div className="form-row">
                <div className="form-group col-md-8">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Keywords in file name, folder name or tags"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="form-group col-md-4">
                  <button type="submit" className="btn btn-primary btn-sm mr-2">Search</button>
                  <button type="button" className="btn btn-outline-primary btn-sm mr-2" onClick={handleReset}>
                    Reset
                  </button>
                  <button
                    type="button"
                    className="btn btn-default btn-sm"
                    onClick={() => setShowAdvanced((v) => !v)}
                  >
                    {showAdvanced ? "Hide filters" : "More filters"}
                  </button>
                </div>
              </div>

              {showAdvanced && (
                <div className="form-row">
                  <div className="form-group col-md-2">
                    <label>Type</label>
                    <select
                      className="form-control form-control-sm"
                      value={filters.docType}
                      onChange={(e) => setFilters({ ...filters, docType: e.target.value })}
                    >
                      <option value="All">All</option>
                      <option value="Folder">Folders</option>
                      <option value="Document">Files</option>
                    </select>
                  </div>
                  <div className="form-group col-md-2">
                    <label>File extension</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. pdf"
                      value={filters.extension}
                      onChange={(e) => setFilters({ ...filters, extension: e.target.value })}
                    />
                  </div>
                  <div className="form-group col-md-3">
                    <label>Tag</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. finance"
                      value={filters.tag}
                      onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
                    />
                  </div>
                  <div className="form-group col-md-2">
                    <label>Created from</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={filters.fromDate}
                      onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                    />
                  </div>
                  <div className="form-group col-md-2">
                    <label>Created to</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      min={filters.fromDate}
                      value={filters.toDate}
                      onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          </form>

          <div className="card-body text-sm pt-0" style={{ overflowX: "auto" }}>
            <p className="text-muted mb-2">
              {loading ? "Searching..." : `${results.totalCount} result(s)`}
            </p>
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Tags</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Owner</th>
                  <th>Created</th>
                  <th style={{ width: "14%" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.items.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center">
                      {loading ? "Loading..." : "No matching files or folders found."}
                    </td>
                  </tr>
                ) : (
                  results.items.map((item) => (
                    <tr key={`${item.docType}-${item.id}`}>
                      <td>
                        <i className={`fas ${item.docType === "Folder" ? "fa-folder" : "fa-file"} mr-2`}></i>
                        {item.name}
                        {item.isHide && <span className="badge badge-secondary ml-2">Hidden</span>}
                      </td>
                      <td>{item.location}</td>
                      <td>
                        {item.tags
                          ? item.tags.split(",").map((t) => (
                              <span key={t} className="badge badge-info mr-1">{t}</span>
                            ))
                          : "-"}
                      </td>
                      <td>{item.docType === "Folder" ? "Folder" : (item.extension || "File").toUpperCase()}</td>
                      <td>{item.docType === "Folder" ? "-" : formatSize(item.size)}</td>
                      <td title={item.source}>{item.createdByName}</td>
                      <td>{new Date(item.createdOn).toLocaleString()}</td>
                      <td>
                        {item.docType === "Document" && (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline-primary mr-1"
                            title="View"
                            onClick={() => handleView(item)}
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-primary mr-1"
                          title="Download"
                          onClick={() => handleDownload(item)}
                        >
                          <i className="fas fa-download"></i>
                        </button>
                        {item.docType === "Folder" && item.canEditTags && (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline-primary"
                            title="Edit tags"
                            onClick={() => handleEditTags(item)}
                          >
                            <i className="fas fa-tag"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {results.totalPages > 1 && (
              <div className="d-flex justify-content-center align-items-center">
                <button
                  className="btn btn-sm btn-default mr-2"
                  disabled={applied.page <= 1}
                  onClick={() => goToPage(applied.page - 1)}
                >
                  Previous
                </button>
                <span>Page {applied.page} of {results.totalPages}</span>
                <button
                  className="btn btn-sm btn-default ml-2"
                  disabled={applied.page >= results.totalPages}
                  onClick={() => goToPage(applied.page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SearchDocuments;