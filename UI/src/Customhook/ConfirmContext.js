import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import "../styles/confirm.css";

const ConfirmContext = createContext(null);

// Imperative handle for code outside React components/hooks (e.g. useAppVersionCheck).
let globalConfirm = null;
export const confirmDialog = (opts) => (globalConfirm ? globalConfirm(opts) : Promise.resolve(false));

/**
 * confirm({ title, message, confirmText, cancelText, variant: "danger" | "warning" | "primary", dismissable })
 * or confirm("message") -> Promise<boolean>
 */
export const ConfirmProvider = ({ children }) => {
  const [dlg, setDlg] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve;
    const o = typeof opts === "string" ? { message: opts } : opts || {};
    setDlg({
      title: o.title || "Are you sure?",
      message: o.message || "",
      confirmText: o.confirmText || "Yes",
      cancelText: o.cancelText || "Cancel",
      variant: o.variant || "warning",
      dismissable: o.dismissable !== false,
    });
  }), []);

  const close = useCallback((result) => {
    setDlg(null);
    if (resolver.current) { resolver.current(result); resolver.current = null; }
  }, []);

  useEffect(() => { globalConfirm = confirm; return () => { globalConfirm = null; }; }, [confirm]);

  useEffect(() => {
    if (!dlg) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && dlg.dismissable) close(false);
      if (e.key === "Enter") close(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dlg, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dlg && (
        <div className="cfm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && dlg.dismissable && close(false)}>
          <div className="cfm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cfm-title" aria-describedby="cfm-msg">
            <div className="cfm-head">
              <span className={`cfm-icon ${dlg.variant}`}><i className={`fas ${dlg.variant === "danger" ? "fa-trash" : dlg.variant === "primary" ? "fa-question" : "fa-exclamation"}`} /></span>
              <h2 id="cfm-title">{dlg.title}</h2>
            </div>
            <div className="cfm-body" id="cfm-msg">{dlg.message}</div>
            <div className="cfm-foot">
              <button type="button" className="btn btn-default btn-sm" onClick={() => close(false)}>{dlg.cancelText}</button>
              <button type="button" autoFocus className={`btn btn-sm ${dlg.variant === "danger" ? "btn-danger" : dlg.variant === "primary" ? "btn-primary" : "btn-warning"}`} onClick={() => close(true)}>
                {dlg.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
};