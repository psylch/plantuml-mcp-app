import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

const DIST_DIR = path.join(import.meta.dirname, "..", "..", "dist");

function createServer(): McpServer {
  const server = new McpServer({
    name: "plantuml-app",
    version: "0.1.0",
  });

  const resourceUri = "ui://plantuml-app/index.html";

  registerAppTool(
    server,
    "plantuml_diagram",
    {
      title: "PlantUML Diagram",
      description: `Render and edit PlantUML diagrams interactively. Generates a visual diagram from PlantUML syntax code.

Syntax notes (PlantUML server uses latest syntax):
- Activity diagram colors: use \`:text; <<#HexColor>>\` (NOT \`#HexColor:text;\` which is deprecated)
  Example: \`:Success; <<#90EE90>>\` instead of \`#90EE90:Success;\`
- Wrap code in @startuml / @enduml
- skinparam goes after @startuml, before diagram content
- Use "as" aliases for long names: \`participant "Long Name" as LN\`
- Arrow styles: -> (solid), --> (dashed), ->> (async), ..> (dotted)
- Notes: \`note left of X : text\` or \`note over X,Y : text\``,
      inputSchema: {
        plantUmlCode: z.string().describe("PlantUML diagram code to render"),
        diagramType: z
          .string()
          .optional()
          .describe(
            "Diagram type hint: class, sequence, activity, usecase, component, deployment, state, object, timing, gantt, mindmap, etc.",
          ),
      },
      _meta: {
        ui: { resourceUri },
      },
    },
    async ({ plantUmlCode, diagramType }) => {
      return {
        content: [
          {
            type: "text" as const,
            text: `Rendered ${diagramType ?? "unknown"} diagram (${plantUmlCode.length} chars)`,
          },
        ],
      };
    },
  );

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await fs.readFile(
        path.join(DIST_DIR, "index.html"),
        "utf-8",
      );
      return {
        contents: [
          {
            uri: resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                csp: {
                  connectDomains: ["https://www.plantuml.com"],
                  resourceDomains: ["https://www.plantuml.com"],
                },
              },
            },
          },
        ],
      };
    },
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
