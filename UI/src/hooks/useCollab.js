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
const rooms = new Map(); // fileId -> number of open dialogs

const getToken = () =>
  reduxStore.getState()?.personalInformationReducer?.token || tokenStorage.get() || "";

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
 * Returns { viewers: [{ userId, name }] } - everyone currently viewing (including you).
 */
export const useCollab = (fileId, handlers = {}) => {
  const [viewers, setViewers] = useState([]);
  const cb = useRef(handlers);
  cb.current = handlers;

  useEffect(() => {
    if (!fileId) return undefined;
    let cancelled = false;
    let joined = false;

    const onPresence = (p) => { if (p.fileId === fileId) setViewers(p.users || []); };
    const onFile = (p) => { if (p.fileId === fileId) cb.current.onFileChanged?.(p); };
    const onComments = (p) => { if (p.fileId === fileId) cb.current.onCommentsChanged?.(p); };

    const startPromise = ensure(); // creates the connection object synchronously
    connection.on("PresenceChanged", onPresence);
    connection.on("FileChanged", onFile);
    connection.on("CommentsChanged", onComments);

    startPromise.then(async () => {
      if (cancelled || connection.state !== signalR.HubConnectionState.Connected) return;
      try {
        await connection.invoke("JoinFile", fileId);
        joined = true;
        rooms.set(fileId, (rooms.get(fileId) || 0) + 1);
        if (cancelled) cleanupRoom();
      } catch { /* no access / offline: the dialog still works without live updates */ }
    });

    function cleanupRoom() {
      if (!joined) return;
      joined = false;
      const left = (rooms.get(fileId) || 1) - 1;
      if (left <= 0) {
        rooms.delete(fileId);
        if (connection.state === signalR.HubConnectionState.Connected)
          connection.invoke("LeaveFile", fileId).catch(() => {});
      } else rooms.set(fileId, left);
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