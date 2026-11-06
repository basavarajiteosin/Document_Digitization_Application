import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import { collabConnection } from "../hooks/useCollab";

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#e11d48", "#0891b2", "#4f46e5", "#be185d"];
const toB64 = (u) => {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

/** Yjs provider over the existing SignalR CollabHub. Returns null when the hub is unreachable. */
export const createCollabProvider = async (fileId, userName) => {
  try {
    const conn = await collabConnection();
    if (!conn || conn.state !== "Connected") return null;

    const ydoc = new Y.Doc();
    const awareness = new Awareness(ydoc);
    let hasContent = false, destroyed = false, canWrite = false;
    let waiters = [];
    const mark = () => { hasContent = true; waiters.splice(0).forEach((r) => r(true)); };

    const onDoc = (fid, b64) => { if (fid === fileId) { Y.applyUpdate(ydoc, fromB64(b64), "remote"); mark(); } };
    const onAw = (fid, b64) => { if (fid === fileId) applyAwarenessUpdate(awareness, fromB64(b64), "remote"); };
    conn.on("DocUpdate", onDoc);
    conn.on("DocAwareness", onAw);

    const res = await conn.invoke("JoinDoc", fileId);
    canWrite = !!res.canWrite;
    res.state.forEach((b) => Y.applyUpdate(ydoc, fromB64(b), "remote"));
    if (res.state.length) hasContent = true;

    ydoc.on("update", (u, origin) => {
      if (origin === "remote" || !canWrite || destroyed) return;
      conn.send("SendDocUpdate", fileId, toB64(u)).catch(() => {});
    });

    const own = () => toB64(encodeAwarenessUpdate(awareness, [ydoc.clientID]));
    awareness.on("update", ({ added, updated, removed }, origin) => {
      if (destroyed) return;
      if (origin === "local") conn.send("SendAwareness", fileId, own()).catch(() => {});
      else if (added.length) conn.send("SendAwareness", fileId, own()).catch(() => {}); // introduce ourselves to newcomers
    });
    awareness.setLocalStateField("user", {
      name: userName || "User",
      color: COLORS[Math.abs(ydoc.clientID) % COLORS.length],
    });
    awareness.setLocalStateField("canWrite", canWrite);

    conn.onreconnected(async () => {
      if (destroyed) return;
      try {
        const r = await conn.invoke("JoinDoc", fileId);
        canWrite = !!r.canWrite;
        r.state.forEach((b) => Y.applyUpdate(ydoc, fromB64(b), "remote"));
        if (canWrite) conn.send("SendDocUpdate", fileId, toB64(Y.encodeStateAsUpdate(ydoc))).catch(() => {});
      } catch { /* ignore */ }
    });

    return {
      ydoc,
      awareness,
      claim: !!res.claim,
      canWrite,
      waitForContent: (ms) =>
        hasContent ? Promise.resolve(true)
          : new Promise((resolve) => {
              waiters.push(resolve);
              setTimeout(() => resolve(hasContent), ms);
            }),
      // The lowest client id among writers performs the auto-save, so versions aren't duplicated.
      isLeader: () => {
        if (!canWrite) return false;
        let min = ydoc.clientID;
        awareness.getStates().forEach((s, id) => { if (s.canWrite && id < min) min = id; });
        return min === ydoc.clientID;
      },
      compact: () => conn.send("CompactDoc", fileId, toB64(Y.encodeStateAsUpdate(ydoc))).catch(() => {}),
      destroy: () => {
        destroyed = true;
        conn.off("DocUpdate", onDoc);
        conn.off("DocAwareness", onAw);
        try { removeAwarenessStates(awareness, [ydoc.clientID], "destroy"); awareness.destroy(); ydoc.destroy(); } catch { /* ignore */ }
      },
    };
  } catch {
    return null;
  }
};