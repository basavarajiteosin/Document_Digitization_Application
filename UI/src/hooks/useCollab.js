import { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import reduxStore from "../reduxStorage/combinedReducers";
import { tokenStorage } from "../axiosInstance/setupAxiosInterceptors";

const config = require("../services/config.json");
// DDA_API_API_URL ends with "api/" - the hub lives at the site root.
const HUB_URL = config.DDA_API_API_URL.replace(/api\/?$/, "") + "hubs/collab";

// One shared connection per browser tab, reused by every dialog.
let connection = null;
let starting = null;
const rooms = new Map(); // numeric fileId -> number of open dialogs

const sameId = (a, b) => Number(a) === Number(b);

const getToken = () =>
  reduxStore.getState()?.personalInformationReducer?.token || tokenStorage.get() || "";

const getMyUserId = () =>
  (reduxStore.getState()?.personalInformationReducer?.userID || "").toLowerCase();

// "Me" = any of this tab's connections (robust to user-id format differences),
// or the same user id (the same person in another tab).
const toViewers = (users) => {
  const mine = connection?.connectionId;
  const me = getMyUserId();
  return (users || []).map((u) => ({
    ...u,
    isMe: (!!mine && (u.connections || []).includes(mine)) || (!!me && (u.userId || "").toLowerCase() === me),
  }));
};

const ensure = () => {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: getToken, withCredentials: false })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.None)
      .build();
    // after a network drop, rejoin every room we were in
    connection.onreconnected(() => {
      rooms.forEach((_, id) => connection.invoke("JoinFile", id).catch(() => {}));
    });
  }
  if (connection.state === signalR.HubConnectionState.Disconnected && !starting) {
    starting = connection
      .start()
      .catch(() => {})
      .finally(() => { starting = null; });
  }
  return starting || Promise.resolve();
};

/**
 * Live collaboration on one file.
 * handlers: { onFileChanged(payload), onCommentsChanged(payload) }
 * Returns { viewers: [{ userId, name, connections, isMe }] } - everyone currently viewing (including you).
 */
export const useCollab = (fileId, handlers = {}) => {
  const [viewers, setViewers] = useState([]);
  const cb = useRef(handlers);
  cb.current = handlers;

  useEffect(() => {
    const id = Number(fileId);
    if (!id) return undefined;
    let cancelled = false;
    let joined = false;

    const onPresence = (p) => { if (sameId(p.fileId, id)) setViewers(toViewers(p.users)); };
    const onFile = (p) => { if (sameId(p.fileId, id)) cb.current.onFileChanged?.(p); };
    const onComments = (p) => { if (sameId(p.fileId, id)) cb.current.onCommentsChanged?.(p); };

    const startPromise = ensure(); // creates the connection object synchronously
    connection.on("PresenceChanged", onPresence);
    connection.on("FileChanged", onFile);
    connection.on("CommentsChanged", onComments);

    startPromise.then(async () => {
      if (cancelled || connection.state !== signalR.HubConnectionState.Connected) return;
      try {
        const res = await connection.invoke("JoinFile", id);
        joined = true;
        rooms.set(id, (rooms.get(id) || 0) + 1);
        if (cancelled) { cleanupRoom(); return; }
        if (res && res.users) setViewers(toViewers(res.users));
      } catch { /* no access / offline: the dialog still works without live updates */ }
    });

    function cleanupRoom() {
      if (!joined) return;
      joined = false;
      const left = (rooms.get(id) || 1) - 1;
      if (left <= 0) {
        rooms.delete(id);
        if (connection.state === signalR.HubConnectionState.Connected)
          connection.invoke("LeaveFile", id).catch(() => {});
      } else rooms.set(id, left);
    }

    return () => {
      cancelled = true;
      connection.off("PresenceChanged", onPresence);
      connection.off("FileChanged", onFile);
      connection.off("CommentsChanged", onComments);
      cleanupRoom();
    };
  }, [fileId]);

  return { viewers };
};

// Shared SignalR connection (used by the co-authoring provider).
export const collabConnection = async () => {
  await ensure();
  return connection;
};