import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PDFDocument, PDFFont } from "pdf-lib";

let fontBytes: Promise<Buffer[]> | undefined;
/** PDF font streams require TrueType/OpenType, never raw browser WOFF files. */
export async function embedVietnamesePdfFonts(document: PDFDocument) {
  document.registerFontkit(fontkit);
  fontBytes ??= Promise.all(["IBMPlexSans-Regular.ttf", "IBMPlexSans-SemiBold.ttf"].map(name =>
    readFile(path.join(process.cwd(), "assets", "fonts", "pdf", name))));
  const [regularBytes, boldBytes] = await fontBytes;
  const [regular, bold] = await Promise.all([
    document.embedFont(Uint8Array.from(regularBytes), { subset: true }),
    document.embedFont(Uint8Array.from(boldBytes), { subset: true })
  ]);
  return { regular, bold };
}

export function wrapPdfText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.normalize("NFC").split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const character of word) {
        if (line && font.widthOfTextAtSize(line + character, size) > width) { lines.push(line); line = ""; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}
