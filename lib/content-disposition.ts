function toAsciiFilename(filename: string) {
  const normalized = filename.normalize("NFKD");
  const ascii = normalized
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_")
    .trim();

  return ascii || "file";
}

function encodeRFC5987(value: string) {
  return encodeURIComponent(value)
    .replace(/['()]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, "%2A");
}

export function buildContentDisposition(type: "inline" | "attachment", filename: string) {
  const asciiFallback = toAsciiFilename(filename);
  const encoded = encodeRFC5987(filename);
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

