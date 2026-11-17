import React, { useEffect, useRef, useState } from "react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { FiCamera } from "react-icons/fi";
import { downloadBytes } from "../../services/documentOperationsService";

const fmtDur = (s) => {
  if (!isFinite(s)) return "-";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return `${h ? h + ":" : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(x).padStart(2, "0")}`;
};

/** Video viewer (mp4 / webm / m4v), view only. */
const VideoViewer = ({ file, buf, onReady, onError }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [url, setUrl] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const ext = file.name.split(".").pop().toLowerCase();
    const u = URL.createObjectURL(new Blob([buf], { type: ext === "webm" ? "video/webm" : "video/mp4" }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [buf, file.name]);

  useEffect(() => {
    if (!url || !videoRef.current) return undefined;
    const el = videoRef.current;
    const player = new Plyr(el, {
      controls: ["play-large", "rewind", "play", "fast-forward", "progress", "current-time", "duration", "mute", "volume", "settings", "pip", "airplay", "fullscreen"],
      settings: ["speed", "loop"],
      speed: { selected: 1, options: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
      keyboard: { focused: true, global: true },
      storage: { enabled: true, key: "ude.video" },
      seekTime: 10,
    });
    playerRef.current = player;
    const meta = () => setInfo({ w: el.videoWidth, h: el.videoHeight, d: el.duration });
    const fail = () => onError?.(new Error("This video cannot be played in the browser (unsupported codec, e.g. H.265/HEVC)."));
    el.addEventListener("loadedmetadata", meta);
    el.addEventListener("error", fail);
    onReady?.();
    return () => { el.removeEventListener("loadedmetadata", meta); el.removeEventListener("error", fail); player.destroy(); playerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const capture = () => {
    const el = videoRef.current;
    if (!el || !el.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = el.videoWidth;
    c.height = el.videoHeight;
    c.getContext("2d").drawImage(el, 0, 0);
    c.toBlob((b) => b && b.arrayBuffer().then((ab) => downloadBytes(ab, `${file.name.replace(/\.[^.]+$/, "")}_${Math.floor(el.currentTime)}s.png`)), "image/png");
  };

  return (
    <div className="ude-video">
      <div className="ude-tx-bar">
        <div className="ude-tx-grp">
          <button type="button" onClick={capture}><FiCamera size={14} /><span>Capture frame</span></button>
        </div>
        {info && <span className="ude-video-info">{info.w}×{info.h} · {fmtDur(info.d)}</span>}
      </div>
      <div className="ude-video-stage">
        {url && <video ref={videoRef} src={url} playsInline preload="metadata" />}
      </div>
    </div>
  );
};

export default VideoViewer;