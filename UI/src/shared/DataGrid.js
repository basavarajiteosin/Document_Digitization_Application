import React, { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { FiSearch, FiDownload, FiChevronUp, FiChevronDown, FiX } from "react-icons/fi";
import "./datagrid.css";

const PAGE_SIZES = [10, 25, 50, 100];
const text = (v) => (v === null || v === undefined ? "" : String(v));

/**
 * columns: [{ key, label, value?(row), render?(row,index), sortable?=true, noExport?, width?, className? }]
 * filterColumns: keys that get a dropdown filter (unique values)
 */
const DataGrid = ({
  columns, data, rowKey, title, exportName = "export",
  filterColumns = [], emptyText = "No records found", toolbarExtra, loading = false,
}) => {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const getValue = (col, row) => (col.value ? col.value(row) : row[col.key]);

  const filterOptions = useMemo(() => {
    const out = {};
    filterColumns.forEach((k) => {
      const col = columns.find((c) => c.key === k);
      if (!col) return;
      out[k] = [...new Set(data.map((r) => text(getValue(col, r))).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, columns, filterColumns.join("|")]);

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = data.filter((row) => {
      if (q && !columns.some((c) => !c.noExport && text(getValue(c, row)).toLowerCase().includes(q))) return false;
      return Object.entries(filters).every(([k, v]) => {
        if (!v) return true;
        const col = columns.find((c) => c.key === k);
        return col && text(getValue(col, row)) === v;
      });
    });
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) =>
        text(getValue(col, a)).localeCompare(text(getValue(col, b)), undefined, { numeric: true, sensitivity: "base" }) * dir
      );
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, columns, search, filters, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [search, filters, pageSize]);

  const start = (page - 1) * pageSize;
  const pageRows = processed.slice(start, start + pageSize);
  const hasFilters = !!search || Object.values(filters).some(Boolean);

  const toggleSort = (col) => {
    if (col.sortable === false) return;
    if (sortKey === col.key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(col.key); setSortDir("asc"); }
  };

  const exportRows = () => {
    const cols = columns.filter((c) => !c.noExport);
    return processed.map((r) => Object.fromEntries(cols.map((c) => [c.label, text(getValue(c, r))])));
  };
  const stamp = () => new Date().toISOString().slice(0, 10);
  const doExport = (type) => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${exportName}_${stamp()}.${type}`, { bookType: type });
  };

  const pages = (() => {
    const max = 5;
    let s = Math.max(1, page - 2);
    const e = Math.min(totalPages, s + max - 1);
    s = Math.max(1, e - max + 1);
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  })();

  return (
    <div className="dg">
      <div className="dg-toolbar">
        {title && <h3 className="dg-title">{title} <span className="dg-count">({processed.length})</span></h3>}
        <div className="dg-tools">
          <div className="dg-search">
            <FiSearch size={14} />
            <input type="search" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search table" />
          </div>
          {filterColumns.map((k) => {
            const col = columns.find((c) => c.key === k);
            if (!col) return null;
            return (
              <select key={k} className="dg-select" value={filters[k] || ""} aria-label={`Filter by ${col.label}`}
                onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.value }))}>
                <option value="">{col.label}: All</option>
                {(filterOptions[k] || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            );
          })}
          {hasFilters && (
            <button type="button" className="dg-btn dg-btn--ghost" onClick={() => { setSearch(""); setFilters({}); }}>
              <FiX size={14} /> Clear
            </button>
          )}
          <div className="dg-export">
            <button type="button" className="dg-btn" disabled={!processed.length} onClick={() => doExport("xlsx")}><FiDownload size={14} /> Excel</button>
            <button type="button" className="dg-btn" disabled={!processed.length} onClick={() => doExport("csv")}><FiDownload size={14} /> CSV</button>
          </div>
          {toolbarExtra}
        </div>
      </div>

      <div className="dg-wrap">
        <table className="dg-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width }}
                  className={`${c.sortable === false ? "" : "is-sortable"} ${c.className || ""}`}
                  onClick={() => toggleSort(c)}
                  aria-sort={sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <span>{c.label}</span>
                  {sortKey === c.key && (sortDir === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} className="dg-empty">Loading...</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={columns.length} className="dg-empty">{emptyText}</td></tr>
            ) : pageRows.map((row, i) => (
              <tr key={rowKey ? row[rowKey] : i}>
                {columns.map((c) => (
                  <td key={c.key} className={c.className || ""}>
                    {c.render ? c.render(row, start + i) : text(getValue(c, row))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dg-foot">
        <div className="dg-info">
          {processed.length === 0 ? "0 records" : `Showing ${start + 1}–${Math.min(start + pageSize, processed.length)} of ${processed.length}`}
        </div>
        <div className="dg-pager">
          <label className="dg-rows">Rows
            <select className="dg-select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <button className="dg-pg" disabled={page === 1} onClick={() => setPage(1)}>«</button>
          <button className="dg-pg" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
          {pages.map((p) => (
            <button key={p} className={`dg-pg ${p === page ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className="dg-pg" disabled={page === totalPages} onClick={() => setPage(page + 1)}>›</button>
          <button className="dg-pg" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
        </div>
      </div>
    </div>
  );
};

export default DataGrid;