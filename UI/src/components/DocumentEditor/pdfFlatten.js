import { PDFDocument, StandardFonts, rgb, degrees, BlendMode, LineCapStyle } from "pdf-lib";

export const TEXT_BASELINE = 0.95;    // first baseline, in em, from the box top (matches the CSS overlay)
export const TEXT_LINE_HEIGHT = 1.2;

const HEX = /^#?([0-9a-f]{6})$/i;
const toRgb = (hex, fallback = "#000000") => {
  const m = HEX.exec(hex || "") || HEX.exec(fallback);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

// Standard fonts are WinAnsi only - replace anything they cannot encode instead of failing the save.
const encodable = (font, text) =>
  Array.from(text.replace(/\r/g, "").replace(/\t/g, "    "))
    .map((ch) => {
      if (ch === "\n") return ch;
      try { font.encodeText(ch); return ch; } catch { return "?"; }
    })
    .join("");

const wrapLines = (font, text, size, maxWidth) => {
  const out = [];
  text.split("\n").forEach((para) => {
    const words = para.split(/(\s+)/).filter((w) => w.length);
    let line = "";
    words.forEach((w) => {
      const next = line + w;
      if (line.trim() && font.widthOfTextAtSize(next.trimEnd(), size) > maxWidth) {
        out.push(line.trimEnd());
        line = /^\s+$/.test(w) ? "" : w;
      } else line = next;
    });
    out.push(line.trimEnd());
  });
  return out;
};

export const isEncryptedPdf = (bytes) => {
  try {
    const u = new Uint8Array(bytes);
    const span = 65536;
    const read = (a, b) => { let s = ""; for (let i = a; i < b; i++) s += String.fromCharCode(u[i]); return s; };
    const txt = read(0, Math.min(u.length, span)) + read(Math.max(0, u.length - span), u.length);
    return /\/Encrypt\s*\d+\s+\d+\s+R/.test(txt);
  } catch {
    return false;
  }
};

/**
 * Burns annotations into the PDF and applies page rotations/deletions.
 * Annotation coordinates are pdf.js viewport units at scale 1 (the page as displayed).
 */
export const buildPdf = async ({ baseBytes, pdfjsDoc, annots = {}, pages = {} }) => {
  const doc = await PDFDocument.load(baseBytes, { ignoreEncryption: true, updateMetadata: false });
  if (doc.isEncrypted) throw new Error("This PDF is encrypted and cannot be modified in the browser.");
  const list = doc.getPages();
  const deletedCount = Object.values(pages).filter((p) => p && p.del).length;
  if (list.length - deletedCount < 1) throw new Error("A PDF must keep at least one page.");

  let font = null;
  const getFont = async () => font || (font = await doc.embedFont(StandardFonts.Helvetica));
  const viewports = new Map();
  const viewportOf = async (i) => {
    if (!viewports.has(i)) viewports.set(i, (await pdfjsDoc.getPage(i + 1)).getViewport({ scale: 1 }));
    return viewports.get(i);
  };

  for (const a of Object.values(annots)) {
    const page = list[a.page];
    if (!page || (pages[a.page] && pages[a.page].del)) continue;
    const vp = await viewportOf(a.page);
    const at = (x, y) => { const [px, py] = vp.convertToPdfPoint(x, y); return { x: px, y: py }; };
    const rotate = degrees(((vp.rotation % 360) + 360) % 360);

    if (a.type === "text") {
      const f = await getFont();
      const size = a.size || 12;
      const text = encodable(f, a.text || "");
      if (!text.trim()) continue;
      wrapLines(f, text, size, Math.max(20, a.w || 200)).forEach((ln, k) => {
        if (!ln) return;
        const o = at(a.x, a.y + size * TEXT_BASELINE + k * size * TEXT_LINE_HEIGHT);
        page.drawText(ln, { x: o.x, y: o.y, size, font: f, color: toRgb(a.color), rotate });
      });
    } else if (a.type === "ink" && Array.isArray(a.points) && a.points.length > 1) {
      const color = toRgb(a.color, "#e11d48");
      for (let k = 1; k < a.points.length; k++) {
        page.drawLine({
          start: at(a.points[k - 1][0], a.points[k - 1][1]),
          end: at(a.points[k][0], a.points[k][1]),
          thickness: a.stroke || 2,
          color,
          lineCap: LineCapStyle.Round,
        });
      }
    } else if (["highlight", "rect", "whiteout"].includes(a.type) && a.w > 0 && a.h > 0) {
      const o = at(a.x, a.y + a.h); // bottom-left as displayed
      const base = { x: o.x, y: o.y, width: a.w, height: a.h, rotate };
      if (a.type === "highlight") {
        page.drawRectangle({ ...base, color: toRgb(a.color, "#fde047"), opacity: 0.4, blendMode: BlendMode.Multiply });
      } else if (a.type === "whiteout") {
        page.drawRectangle({ ...base, color: rgb(1, 1, 1) });
      } else {
        page.drawRectangle({ ...base, borderColor: toRgb(a.color), borderWidth: a.stroke || 2 });
      }
    }
  }

  Object.entries(pages).forEach(([k, v]) => {
    const p = list[+k];
    if (p && v && v.rot) p.setRotation(degrees((p.getRotation().angle + v.rot) % 360));
  });
  Object.entries(pages)
    .filter(([, v]) => v && v.del)
    .map(([k]) => +k)
    .sort((x, y) => y - x)
    .forEach((i) => { if (i < doc.getPageCount()) doc.removePage(i); });

  return doc.save({ useObjectStreams: true });
};