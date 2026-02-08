/**
 * Detect PlantUML diagram type from code.
 */

/**
 * Detect diagram type from PlantUML code by parsing the first directive.
 * Returns the type keyword (e.g. "class", "sequence", "activity").
 */
export function detectDiagramType(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return "unknown";

  const lines = trimmed.split("\n");

  for (const line of lines) {
    const l = line.trim();
    // Skip comments and empty lines
    if (!l || l.startsWith("'") || l.startsWith("/'")) continue;
    // Skip skinparam, title, header, etc. that come before @startuml
    if (l.startsWith("@startuml")) continue;

    // Match diagram-specific keywords
    if (/^class\s/i.test(l) || /^interface\s/i.test(l) || /^abstract\s/i.test(l) || /^enum\s/i.test(l)) return "class";
    if (/^participant\s/i.test(l) || /^actor\s/i.test(l) || /^(->\s|<-\s|-->)/i.test(l)) return "sequence";
    if (/^:.*[;|<>/\]}]$/i.test(l) || /^start$/i.test(l) || /^stop$/i.test(l)) return "activity";
    if (/^usecase\s/i.test(l) || /^\(.*\)\s+as\s/i.test(l)) return "usecase";
    if (/^component\s/i.test(l) || /^\[.*\]\s/i.test(l)) return "component";
    if (/^node\s/i.test(l) || /^cloud\s/i.test(l) || /^database\s/i.test(l)) return "deployment";
    if (/^state\s/i.test(l) || /^\[\*\]\s*-->/i.test(l)) return "state";
    if (/^object\s/i.test(l)) return "object";
    if (/^robust\s|^concise\s|^clock\s|^binary\s/i.test(l)) return "timing";
    if (/^@startgantt/i.test(l)) return "gantt";
    if (/^@startmindmap/i.test(l)) return "mindmap";
    if (/^@startwbs/i.test(l)) return "wbs";
    if (/^@startjson/i.test(l)) return "json";
    if (/^@startyaml/i.test(l)) return "yaml";
    if (/^@startsalt/i.test(l)) return "salt";
    if (/^@startditaa/i.test(l)) return "ditaa";
    if (/^@startdot/i.test(l)) return "dot";
    if (/^entity\s/i.test(l)) return "er";
    if (/^map\s/i.test(l)) return "map";

    // If we hit a non-comment, non-directive line without matching, break
    break;
  }

  return "unknown";
}
