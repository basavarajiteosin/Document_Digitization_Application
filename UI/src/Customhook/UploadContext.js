import React, { createContext, useContext, useState, useCallback } from "react";

// Global, app-level context that tracks background file uploads and the
// floating status panel's visibility/minimized state. Because this lives
// above the routed pages (see App.js), the upload queue and the panel
// stay mounted and visible even when the user navigates to a different
// tab/menu/route while uploads are still in progress.
const UploadContext = createContext(null);

export const UploadProvider = ({ children }) => {
  const [uploadQueue, setUploadQueue] = useState([]); // { id, name, size, progress, status, folderId }
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [isUploadPanelMinimized, setIsUploadPanelMinimized] = useState(false);

  const addUploadItems = useCallback((items) => {
    setUploadQueue((prev) => [...prev, ...items]);
    setShowUploadPanel(true);
    setIsUploadPanelMinimized(false);
  }, []);

  const updateUploadItem = useCallback((id, updates) => {
    setUploadQueue((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  }, []);

  const removeUploadItem = useCallback((id) => {
    setUploadQueue((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearCompletedUploads = useCallback(() => {
    setUploadQueue((prev) => prev.filter((f) => f.status === "uploading"));
  }, []);

  const value = {
    uploadQueue,
    setUploadQueue,
    showUploadPanel,
    setShowUploadPanel,
    isUploadPanelMinimized,
    setIsUploadPanelMinimized,
    addUploadItems,
    updateUploadItem,
    removeUploadItem,
    clearCompletedUploads,
  };

  return (
    <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
  );
};

export const useUpload = () => {
  const ctx = useContext(UploadContext);
  if (!ctx) {
    throw new Error("useUpload must be used within an UploadProvider");
  }
  return ctx;
};

export default UploadContext;