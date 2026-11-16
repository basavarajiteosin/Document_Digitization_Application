import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import { collabConnection } from "../hooks/useCollab";

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#e11d48", "#0891b2", "#4f46e5", "#be185d"];
const REMOTE = "remote";
const BATCH_MS = 40;
const WAIT_SLICE_MS = 8000;

const toB64 = (u) => {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

const active = new Set();
let reconnectHooked = false;

const createEmitter = () => {
  const map = new Map();
  const api = {
    on(evt, fn) { if (!map.has(evt)) map.set(evt, new Set()); map.get(evt).add(fn); return api; },
    off(evt, fn) { map.get(evt)?.delete(fn); return api; },
    once(evt, fn) { const w = (...a) => { api.off(evt, w); fn(...a); }; return api.on(evt, w); },
    emit(evt, ...args) {
      [...(map.get(evt) || [])].forEach((fn) => { try { fn(...args); } catch { /* listener error */ } });
    },
  };
  return api;
};

/**
 * Yjs provider over the existing SignalR CollabHub. Returns null when the hub is unreachable.
 * role: "seed"       - this client loads the file into the empty shared document
 *       "join"       - content comes from peers
 *       "standalone" - no shared state available; open the file directly (not co-authored)
 */
export const createCollabProvider = async (rawFileId, userName, { onError } = {}) => {
  // The hub always sends numeric ids; normalise so string ids from the UI still match.
  const fileId = Number(rawFileId);
  if (!fileId) return null;
  let detach = () => {};
  try {
    const conn = await collabConnection();
    if (!conn || conn.state !== "Connected") return null;
    if (!reconnectHooked) {
      reconnectHooked = true;
      conn.onreconnected(() => active.forEach((p) => p.rejoin()));
    }

    const ydoc = new Y.Doc();
    const awareness = new Awareness(ydoc);
    const events = createEmitter();
    const waiters = new Set();
    let destroyed = false, canWrite = false, hasContent = false, seeding = false;
    let pending = [], flushTimer = null;

    const isMine = (fid) => Number(fid) === fileId;
    const fail = (e) => { if (!destroyed) onError?.(e); };
    const markContent = () => {
      if (hasContent) return;
      hasContent = true;
      waiters.forEach((w) => w());
      waiters.clear();
    };
    const apply = (b64) => Y.applyUpdate(ydoc, fromB64(b64), REMOTE);
    const sendQuiet = (method, ...args) => conn.send(method, fileId, ...args).catch(() => {});
    const send = (method, ...args) => conn.send(method, fileId, ...args).catch(fail);

    const onDoc = (fid, b64) => {
      if (!isMine(fid) || destroyed) return;
      try { apply(b64); markContent(); } catch (e) { fail(e); }
    };
    const onAw = (fid, b64) => {
      if (!isMine(fid) || destroyed) return;
      try { applyAwarenessUpdate(awareness, fromB64(b64), REMOTE); } catch { /* stale awareness */ }
    };
    const onCompactRequest = (fid) => { if (isMine(fid) && !destroyed) compact(); };
    conn.on("DocUpdate", onDoc);
    conn.on("DocAwareness", onAw);
    conn.on("DocCompactRequest", onCompactRequest);
    detach = () => {
      conn.off("DocUpdate", onDoc);
      conn.off("DocAwareness", onAw);
      conn.off("DocCompactRequest", onCompactRequest);
    };

    const join = async () => {
      const res = await conn.invoke("JoinDoc", fileId);
      canWrite = !!res.canWrite;
      seeding = !!res.seeding;
      const state = res.state || [];
      state.forEach(apply);
      if (state.length) markContent();
      return res;
    };
    const res = await join();
    let role = res.claim ? "seed" : hasContent ? "join" : seeding ? "wait" : "standalone";

    function flush() {
      clearTimeout(flushTimer);
      flushTimer = null;
      if (!pending.length) return;
      const merged = pending.length === 1 ? pending[0] : Y.mergeUpdates(pending);
      pending = [];
      send("SendDocUpdate", toB64(merged));
    }
    function compact() {
      if (!canWrite || destroyed || !hasContent) return;
      flush();
      sendQuiet("CompactDoc", toB64(Y.encodeStateAsUpdate(ydoc)));
    }

    // Local edits are batched (one merged update per BATCH_MS) to cut hub traffic.
    ydoc.on("update", (u, origin) => {
      if (origin === REMOTE || destroyed || !canWrite) return;
      markContent();
      pending.push(u);
      if (!flushTimer) flushTimer = setTimeout(flush, BATCH_MS);
    });

    const own = () => toB64(encodeAwarenessUpdate(awareness, [ydoc.clientID]));
    awareness.on("update", ({ added }, origin) => {
      if (destroyed) return;
      if (origin === "local" || added.length) sendQuiet("SendAwareness", own());
    });
    awareness.setLocalStateField("user", {
      name: userName || "User",
      color: COLORS[Math.abs(ydoc.clientID) % COLORS.length],
    });
    awareness.setLocalStateField("canWrite", canWrite);

    const waitForContent = (ms) =>
      hasContent ? Promise.resolve(true)
        : new Promise((resolve) => {
          const done = () => { clearTimeout(t); resolve(true); };
          const t = setTimeout(() => { waiters.delete(done); resolve(hasContent); }, ms);
          waiters.add(done);
        });

    // Waits for a peer to seed the document; takes over the seeding if that peer disappears.
    const resolveRole = async (maxMs = 30000) => {
      if (role !== "wait") return role;
      const deadline = Date.now() + maxMs;
      while (!destroyed && role === "wait" && Date.now() < deadline) {
        if (await waitForContent(Math.min(WAIT_SLICE_MS, Math.max(0, deadline - Date.now())))) { role = "join"; break; }
        if (canWrite) {
          try { if (await conn.invoke("ClaimDoc", fileId)) { role = "seed"; break; } } catch { /* retry */ }
        }
      }
      if (role === "wait") role = hasContent ? "join" : "standalone";
      return role;
    };

    // Minimal y-provider surface for editor bindings.
    const adapter = Object.assign(events, {
      awareness,
      doc: ydoc,
      document: ydoc,
      synced: false,
      isSynced: false,
      connect() {},
      disconnect() {},
      destroy() {},
    });
    const markSynced = () => {
      adapter.synced = true;
      adapter.isSynced = true;
      events.emit("status", { status: "connected" });
      events.emit("sync", true);
      events.emit("synced", true);
    };

    const handle = {
      ydoc,
      awareness,
      adapter,
      get role() { return role; },
      get canWrite() { return canWrite; },
      claim: role === "seed",
      resolveRole,
      markSynced,
      waitForContent,
      compact,
      rejoin: async () => {
        if (destroyed) return;
        try {
          await join();
          awareness.setLocalStateField("canWrite", canWrite);
          if (canWrite && hasContent) sendQuiet("SendDocUpdate", toB64(Y.encodeStateAsUpdate(ydoc)));
          sendQuiet("SendAwareness", own());
        } catch (e) { fail(e); }
      },
      // The lowest client id among writers performs the auto-save, so versions aren't duplicated.
      isLeader: () => {
        if (!canWrite) return false;
        let min = ydoc.clientID;
        awareness.getStates().forEach((s, id) => { if (s.canWrite && id < min) min = id; });
        return min === ydoc.clientID;
      },
      destroy: () => {
        if (destroyed) return;
        flush();
        destroyed = true;
        active.delete(handle);
        detach();
        try {
          removeAwarenessStates(awareness, [ydoc.clientID], "destroy");
          awareness.destroy();
          ydoc.destroy();
        } catch { /* ignore */ }
      },
    };
    active.add(handle);
    return handle;
  } catch {
    detach();
    return null;
  }
};