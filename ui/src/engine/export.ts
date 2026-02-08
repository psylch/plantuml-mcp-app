/**
 * Export utilities for PlantUML diagrams.
 */

import { getPngUrl } from "./render";

/** Download a string as a file. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export the current SVG string as a .svg file. */
export function exportSvg(svgContent: string, filename = "diagram.svg") {
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  downloadBlob(blob, filename);
}

/** Export the diagram as PNG by opening the PlantUML server PNG URL. */
export function exportPng(plantUmlCode: string, filename = "diagram.png") {
  const url = getPngUrl(plantUmlCode);
  // Fetch the PNG and download it
  fetch(url)
    .then((res) => res.blob())
    .then((blob) => downloadBlob(blob, filename))
    .catch(() => {
      // Fallback: open in new tab
      window.open(url, "_blank");
    });
}
