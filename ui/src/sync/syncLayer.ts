/**
 * Sync Layer: manages LLM communication via the MCP Apps protocol.
 *
 * Two channels:
 * 1. silentSync (updateModelContext) -- fires on semantic changes (debounced),
 *    keeps AI context up-to-date without triggering a response.
 * 2. sendToAgent (sendMessage) -- fires on user button click, sends delta
 *    changes + full state, triggers AI response.
 */

import type { App as McpApp } from "@modelcontextprotocol/ext-apps/react";
import type { ChangeLog } from "./changeLog";
import type { SelectedItem } from "../components/DiagramView";

/** Format selected items as readable text for AI context. */
function formatSelection(items: SelectedItem[]): string {
  if (items.length === 0) return "none";
  return items.map((s) => s.label).join(", ");
}

/**
 * Silent sync: push current diagram state to AI context.
 * Does NOT trigger an AI response. Uses updateModelContext which the host
 * SHOULD surface to the AI on the next user message.
 */
export async function silentSync(
  app: McpApp | null,
  plantUmlCode: string,
  selectedItems: SelectedItem[],
  diagramType: string,
): Promise<void> {
  if (!app) return;

  const parts = [
    `[PlantUML App — Live State]`,
    `Diagram type: ${diagramType}`,
    `Selected elements: ${formatSelection(selectedItems)}`,
    "",
    "Current PlantUML code:",
    plantUmlCode,
  ];

  try {
    await app.updateModelContext({
      content: [{ type: "text", text: parts.join("\n") }],
    });
  } catch {
    // updateModelContext may not be available in all hosts / standalone mode
  }
}

/**
 * Send to Agent: send delta changes + full state to AI.
 * DOES trigger an AI response via sendMessage.
 */
export function sendToAgent(
  app: McpApp | null,
  changeLog: ChangeLog,
  plantUmlCode: string,
  selectedItems: SelectedItem[],
  diagramType: string,
): void {
  if (!app) return;

  const delta = changeLog.serialize();

  const parts: string[] = [];

  if (delta) {
    parts.push("User edited the diagram:");
    parts.push(delta);
  }

  if (selectedItems.length > 0) {
    parts.push(`User selected these elements in the diagram: ${formatSelection(selectedItems)}`);
    parts.push("When the user refers to \"these\", \"selected\", or \"this\" without naming specific elements, they mean the above selected elements.");
  }

  parts.push("");
  parts.push(`Full PlantUML code (${diagramType}):`);
  parts.push(plantUmlCode);

  const text = parts.join("\n");

  try {
    app.sendMessage({
      role: "user",
      content: [{ type: "text", text }],
    });
  } catch {
    // sendMessage may not be available in standalone mode
  }

  changeLog.clear();
}
