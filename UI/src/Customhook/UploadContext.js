import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from "react";

const MAX_CONCURRENCY = 3;
const PROGRESS_INTERVAL_MS = 200;
const ACTIVE = ["queued", "uploading"];

/* Scheduler lives outside React so progress ticks never re-create callbacks. */
function createEngine(setQueue) {
  const items = new Map();    // id -> latest item
  const runtime = new Map();  // id -> { uploader, opts, batchId, controller, speed, lastTick, lastLoaded, lastTime }
  const batches = new Map();  // batchId -> { remaining, results, opts }
  const pending = [];
  let active = 0;
  let batchSeq = 0;

  const patch = (id, updates) => {
    const cur = items.get(id);
    if (!cur) return;
    const next = { ...cur, ...updates };
    items.set(id, next);
    setQueue((prev) => prev.map((i) => (i.id === id ? next : i)));
  };

  const settle = (id, result) => {
    const rt = runtime.get(id);
    const batch = rt && batches.get(rt.batchId);
    if (!batch) return;
    batch.results.push(result);
    try { batch.opts.onItemDone?.(items.get(id), result); } catch (e) { /* ignore */ }
    batch.remaining -= 1;
    if (batch.remaining <= 0) {
      batches.delete(rt.batchId);
      try { batch.opts.onAllDone?.(batch.results); } catch (e) { /* ignore */ }
    }
  };

  const run = async (id) => {
    const item = items.get(id);
    const rt = runtime.get(id);
    if (!item || !rt) return;
    const controller = new AbortController();
    rt.controller = controller;
    rt.speed = 0;
    rt.lastTick = 0;
    rt.lastLoaded = 0;
    rt.lastTime = Date.now();
    active += 1;
    patch(id, { status: "uploading", progress: 0, loaded: 0, speed: 0, eta: null, error: null, processing: false });

    const onProgress = (loaded, total) => {
      const now = Date.now();
      const size = total || item.size || 1;
      const uploadedAll = loaded >= size;
      if (!uploadedAll && now - rt.lastTick < PROGRESS_INTERVAL_MS) return;
      const dt = (now - rt.lastTime) / 1000;
      if (dt > 0) {
        const inst = (loaded - rt.lastLoaded) / dt;
        rt.speed = rt.speed ? rt.speed * 0.7 + inst * 0.3 : inst;
      }
      rt.lastTime = now;
      rt.lastTick = now;
      rt.lastLoaded = loaded;
      patch(id, {
        loaded,
        progress: Math.min(99, (loaded / size) * 100),
        speed: rt.speed,
        eta: rt.speed > 0 ? (size - loaded) / rt.speed : null,
        processing: uploadedAll,
      });
    };

    let result;
    try {
      result = await rt.uploader(items.get(id), { signal: controller.signal, onProgress });
    } catch (e) {
      result = { success: false, message: e?.message || "Upload failed" };
    }
    active -= 1;

    if (controller.signal.aborted || result?.cancelled) {
      result = { success: false, cancelled: true };
      patch(id, { status: "cancelled", speed: 0, eta: null, processing: false });
    } else if (result?.success) {
      patch(id, { status: "completed", progress: 100, loaded: item.size, speed: 0, eta: null, processing: false });
    } else {
      patch(id, { status: "failed", error: result?.message || "Upload failed", speed: 0, eta: null, processing: false });
    }
    settle(id, result);
    pump();
  };

  function pump() {
    while (active < MAX_CONCURRENCY && pending.length) {
      const id = pending.shift();
      const item = items.get(id);
      if (item && item.status === "queued") run(id);
    }
  }

  return {
    enqueue(newItems, uploader, opts = {}) {
      if (!newItems.length) return;
      const batchId = ++batchSeq;
      batches.set(batchId, { remaining: newItems.length, results: [], opts });
      const prepared = newItems.map((it) => ({
        status: "queued", progress: 0, loaded: 0, speed: 0, eta: null, error: null, processing: false, ...it,
      }));
      prepared.forEach((it) => {
        items.set(it.id, it);
        runtime.set(it.id, { uploader, opts, batchId });
        pending.push(it.id);
      });
      setQueue((prev) => [...prev, ...prepared]);
      pump();
    },
    cancel(id) {
      const item = items.get(id);
      const rt = runtime.get(id);
      if (!item || !rt) return;
      if (item.status === "queued") {
        const idx = pending.indexOf(id);
        if (idx >= 0) pending.splice(idx, 1);
        patch(id, { status: "cancelled" });
        settle(id, { success: false, cancelled: true });
      } else if (item.status === "uploading") {
        rt.controller?.abort();
      }
    },
    cancelAll() {
      [...items.values()].filter((i) => ACTIVE.includes(i.status)).forEach((i) => this.cancel(i.id));
    },
    retry(id) {
      const item = items.get(id);
      const rt = runtime.get(id);
      if (!item || !rt || !["failed", "cancelled"].includes(item.status)) return;
      rt.batchId = ++batchSeq;
      batches.set(rt.batchId, { remaining: 1, results: [], opts: rt.opts });
      patch(id, { status: "queued", progress: 0, loaded: 0, speed: 0, eta: null, error: null, processing: false });
      pending.push(id);
      pump();
    },
    retryFailed() {
      [...items.values()].filter((i) => i.status === "failed").forEach((i) => this.retry(i.id));
    },
    remove(id) {
      const item = items.get(id);
      if (!item || ACTIVE.includes(item.status)) return;
      items.delete(id);
      runtime.delete(id);
      setQueue((prev) => prev.filter((i) => i.id !== id));
    },
    clearFinished() {
      const gone = new Set();
      items.forEach((i, id) => {
        if (i.status === "completed" || i.status === "cancelled") gone.add(id);
      });
      gone.forEach((id) => { items.delete(id); runtime.delete(id); });
      setQueue((prev) => prev.filter((i) => !gone.has(i.id)));
    },
    reset() {
      this.cancelAll();
      items.clear();
      runtime.clear();
      batches.clear();
      pending.length = 0;
      setQueue([]);
    },
  };
}

const UploadContext = createContext(null);

export const UploadProvider = ({ children }) => {
  const [uploadQueue, setQueue] = useState([]);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [isUploadPanelMinimized, setIsUploadPanelMinimized] = useState(false);

  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = createEngine(setQueue);
  const engine = engineRef.current;

  const enqueueUploads = useCallback((items, uploader, opts) => {
    engine.enqueue(items, uploader, opts);
    setShowUploadPanel(true);
    setIsUploadPanelMinimized(false);
  }, [engine]);

  const cancelUpload = useCallback((id) => engine.cancel(id), [engine]);
  const cancelAllUploads = useCallback(() => engine.cancelAll(), [engine]);
  const retryUpload = useCallback((id) => engine.retry(id), [engine]);
  const retryFailedUploads = useCallback(() => engine.retryFailed(), [engine]);
  const removeUploadItem = useCallback((id) => engine.remove(id), [engine]);
  const clearCompletedUploads = useCallback(() => engine.clearFinished(), [engine]);
  // kept for Login.js, which calls setUploadQueue([]) on sign-in
  const setUploadQueue = useCallback((v) => { if (Array.isArray(v) && v.length === 0) engine.reset(); }, [engine]);

  const hasActive = uploadQueue.some((i) => ACTIVE.includes(i.status));
  useEffect(() => {
    if (!hasActive) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasActive]);

  const value = useMemo(() => ({
    uploadQueue, setUploadQueue,
    showUploadPanel, setShowUploadPanel,
    isUploadPanelMinimized, setIsUploadPanelMinimized,
    enqueueUploads, cancelUpload, cancelAllUploads,
    retryUpload, retryFailedUploads, removeUploadItem, clearCompletedUploads,
  }), [uploadQueue, setUploadQueue, showUploadPanel, isUploadPanelMinimized, enqueueUploads,
    cancelUpload, cancelAllUploads, retryUpload, retryFailedUploads, removeUploadItem, clearCompletedUploads]);

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
};

export const useUpload = () => {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within an UploadProvider");
  return ctx;
};

export default UploadContext;