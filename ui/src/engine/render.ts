/**
 * PlantUML rendering engine.
 *
 * Uses plantuml-encoder to encode PlantUML text, then fetches the SVG
 * from the PlantUML online server.
 */

import plantumlEncoder from "plantuml-encoder";

const PLANTUML_SERVER = "https://www.plantuml.com/plantuml";

/** Render PlantUML code to SVG string via the PlantUML online server. */
export async function renderPlantUml(code: string): Promise<string> {
  if (!code.trim()) {
    throw new Error("Empty PlantUML code");
  }

  const encoded = plantumlEncoder.encode(code);
  const url = `${PLANTUML_SERVER}/svg/${encoded}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`PlantUML server error: ${response.status} ${response.statusText}`);
  }

  const svg = await response.text();

  // PlantUML server returns error info as part of SVG (red text, error icon).
  // We pass it through — the user sees the server's error display in the SVG,
  // and we return a flag indicating whether the SVG contains an error.
  return svg;
}

/** Check if a rendered SVG contains a PlantUML error or deprecation warning. */
export function isSvgError(svg: string): boolean {
  return svg.includes("Syntax Error") || svg.includes("ErrorURLDecoder") || svg.includes("[From string (line") || svg.includes("syntax is deprecated");
}

/** Get a PNG URL for the given PlantUML code (for export). */
export function getPngUrl(code: string): string {
  const encoded = plantumlEncoder.encode(code);
  return `${PLANTUML_SERVER}/png/${encoded}`;
}

/** Get an SVG URL for the given PlantUML code (for export). */
export function getSvgUrl(code: string): string {
  const encoded = plantumlEncoder.encode(code);
  return `${PLANTUML_SERVER}/svg/${encoded}`;
}
