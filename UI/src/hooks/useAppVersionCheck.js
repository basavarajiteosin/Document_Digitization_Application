import { useEffect, useRef, useCallback } from "react";

/**
 * Namespaces the localStorage key by the app's own base path, so multiple
 * apps sharing the same domain (e.g. apps.iteos.in/pmo, apps.iteos.in/support)
 * never overwrite each other's version tracking.
 *
 * PUBLIC_URL for CRA is something like "/pmo" — falls back to the current
 * pathname's first segment if PUBLIC_URL isn't set, and finally to "default"
 * if neither is available (shouldn't happen in practice).
 */
function getAppNamespace() {
  const publicUrl = process.env.PUBLIC_URL;
  if (publicUrl) {
    return publicUrl.replace(/^\/|\/$/g, "") || "root"; // "/pmo" -> "pmo"
  }
  const firstSegment = window.location.pathname.split("/").filter(Boolean)[0];
  return firstSegment || "default";
}

const APP_NAMESPACE = getAppNamespace();
const VERSION_KEY = `app_version:${APP_NAMESPACE}`; // e.g. "app_version:pmo"

export function useAppVersionCheck({ intervalMs = 10 * 60 * 1000 } = {}) {
  const promptShown = useRef(false);

  const hardReload = () => {
    const base = `${window.location.origin}${window.location.pathname}`;
    const bustedUrl = `${base}?_=${Date.now()}${window.location.hash || ""}`;
    window.location.href = bustedUrl;
    setTimeout(() => window.location.reload(), 50);
  };

  const checkVersion = useCallback(async () => {
    if (promptShown.current) return;
    try {
      const res = await fetch(`${process.env.PUBLIC_URL}/version.json?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) return;

      const { version: serverVersion } = await res.json();
      const currentVersion = localStorage.getItem(VERSION_KEY);

      if (!currentVersion) {
        localStorage.setItem(VERSION_KEY, serverVersion);
        return;
      }

      if (currentVersion !== serverVersion) {
        promptShown.current = true;

        const proceed = window.confirm(
          `A new version of this app is available (v${serverVersion}).\n\n` +
            `Click OK to update now and get the latest changes.\nClick Cancel to update later.`
        );

        if (!proceed) {
          promptShown.current = false;
          return;
        }

        localStorage.setItem(VERSION_KEY, serverVersion);
        hardReload();
      }
    } catch {
      /* offline — ignore, try again next interval */
    }
  }, []);

  useEffect(() => {
    checkVersion();
    const id = setInterval(checkVersion, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") checkVersion();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [checkVersion, intervalMs]);
}