import React from "react";

const COLORS = ["#0078d4", "#8764b8", "#038387", "#ca5010", "#986f0b", "#498205", "#c239b3", "#486991"];

const colorFor = (s = "") => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
};

export const initials = (name = "") => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
};

export const SpAvatar = ({ name, large }) => (
  <span
    className={`sp-avatar-sm ${large ? "sp-avatar-sm--lg" : ""}`}
    style={{ background: colorFor(name) }}
    title={name}
  >
    {initials(name)}
  </span>
);

/** names: string[] - shows up to `max` avatars, then "+N". */
export const SpFacepile = ({ names = [], max = 4 }) => {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className="sp-facepile">
      {shown.map((n, i) => <SpAvatar key={`${n}-${i}`} name={n} />)}
      {extra > 0 && (
        <span className="sp-avatar-sm sp-facepile-more" title={names.slice(max).join(", ")}>+{extra}</span>
      )}
    </span>
  );
};