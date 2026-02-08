import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { App as McpApp, PostMessageTransport, useHostStyles, useDocumentTheme } from "@modelcontextprotocol/ext-apps/react";
import DiagramView from "./components/DiagramView";
import CodeEditor from "./components/CodeEditor";
import ViewSwitch, { type ViewMode } from "./components/ViewSwitch";
import SendButton from "./components/SendButton";
import ExportButton from "./components/ExportButton";
import CopyButton from "./components/CopyButton";
import { detectDiagramType } from "./engine/detect";
import { renderPlantUml, isSvgError } from "./engine/render";
import { ChangeLog } from "./sync/changeLog";
import { silentSync, sendToAgent } from "./sync/syncLayer";
import { themeColors } from "./theme";

interface DiagramInput {
  plantUmlCode: string;
  diagramType?: string;
}

const DEFAULT_HEIGHT = 500;

const SAMPLE_PLANTUML = `@startuml
actor User
participant "Web App" as App
participant "API Server" as API
database "Database" as DB

User -> App : Open page
activate App

App -> API : GET /data
activate API

API -> DB : SELECT query
activate DB
DB --> API : Result set
deactivate DB

API --> App : JSON response
deactivate API

App --> User : Render page
deactivate App
@enduml`;

function App() {
  const [, setDiagramInput] = useState<DiagramInput | null>(null);
  const [, setPartial] = useState<string | null>(null);
  const [plantUmlCode, setPlantUmlCode] = useState<string>(SAMPLE_PLANTUML);
  const [streaming, setStreaming] = useState(false);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);

  // Rendered SVG content
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [renderLoading, setRenderLoading] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Render request tracking
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderVersion = useRef(0);

  // Silent error for AI auto-fix
  const errorAlreadySent = useRef<string | null>(null);
  const errorFixTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isToolInputError = useRef(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);

  // Container dimensions from host
  const [hostHeight, setHostHeight] = useState<string>(`${DEFAULT_HEIGHT}px`);

  // View switching state
  const [viewMode, setViewMode] = useState<ViewMode>("canvas");

  // Change log for delta tracking
  const changeLog = useMemo(() => new ChangeLog(), []);
  const [changeCount, setChangeCount] = useState(0);

  // Timers
  const silentSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detected diagram type
  const detectedType = detectDiagramType(plantUmlCode);

  // Theme from host
  const theme = useDocumentTheme();
  const colors = themeColors(theme);

  // Compute root height
  const rootHeight = isFullscreen ? "100vh" : hostHeight;

  /** Actually perform the render (shared by debounce and interval).
   *  When isStreaming=true: auto-close missing @enduml, swallow errors silently,
   *  keep last good SVG on failure, skip error auto-fix. */
  const doRender = useCallback(async (code: string, isStreaming = false) => {
    const version = ++renderVersion.current;
    if (!isStreaming) {
      setRenderLoading(true);
      setRenderError(null);
    }

    // During streaming, auto-close incomplete PlantUML so the server can render it
    let renderCode = code;
    if (isStreaming) {
      const trimmed = code.trimEnd();
      if (!trimmed.match(/@end(uml|ditaa|salt|gantt|mindmap|wbs|json|yaml|nwdiag|regex)\s*$/i)) {
        // Detect the @start type and add matching @end
        const startMatch = trimmed.match(/@start(\w+)/i);
        const endTag = startMatch ? `@end${startMatch[1]}` : "@enduml";
        renderCode = trimmed + "\n" + endTag;
      }
    }

    try {
      const svg = await renderPlantUml(renderCode);
      if (version !== renderVersion.current) return; // stale

      if (isStreaming) {
        // During streaming: only update SVG if it's not an error
        if (!isSvgError(svg)) {
          setSvgContent(svg);
          setRenderError(null);
        }
        // If it IS an error SVG during streaming, silently ignore — keep last good SVG
      } else {
        setSvgContent(svg);
        if (isSvgError(svg)) {
          setRenderError("PlantUML syntax error");
          scheduleErrorAutoFix("PlantUML syntax error — the diagram SVG shows an error", code);
        } else {
          setRenderError(null);
          errorAlreadySent.current = null;
        }
      }
    } catch (err) {
      if (version !== renderVersion.current) return;
      // During streaming: silently ignore fetch errors (server 400/500 on incomplete code)
      if (!isStreaming) {
        const msg = err instanceof Error ? err.message : String(err);
        setRenderError(msg);
      }
    } finally {
      if (version === renderVersion.current && !isStreaming) {
        setRenderLoading(false);
      }
    }
  }, []);

  /** Render PlantUML code to SVG with debounce. */
  const scheduleRender = useCallback((code: string) => {
    if (renderTimer.current) clearTimeout(renderTimer.current);
    renderTimer.current = setTimeout(() => doRender(code, false), 800);
  }, [doRender]);

  // Streaming interval render: during streaming, render every 2s so user sees progress
  const streamingRenderTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestCode = useRef(plantUmlCode);
  latestCode.current = plantUmlCode;

  useEffect(() => {
    if (streaming) {
      // Render once immediately with streaming mode
      doRender(latestCode.current, true);
      // Then render at intervals
      streamingRenderTimer.current = setInterval(() => {
        doRender(latestCode.current, true);
      }, 2000);
    } else {
      // Stop interval when streaming ends
      if (streamingRenderTimer.current) {
        clearInterval(streamingRenderTimer.current);
        streamingRenderTimer.current = null;
      }
    }
    return () => {
      if (streamingRenderTimer.current) {
        clearInterval(streamingRenderTimer.current);
        streamingRenderTimer.current = null;
      }
    };
  }, [streaming, doRender]);

  /** Schedule error auto-fix: debounce 3s, send to AI. */
  const scheduleErrorAutoFix = useCallback(
    (errorMsg: string, code: string) => {
      if (errorFixTimer.current) clearTimeout(errorFixTimer.current);

      errorFixTimer.current = setTimeout(() => {
        if (!appRef.current) return;
        if (!isToolInputError.current) return;

        const errorKey = `${errorMsg}::${code.slice(0, 200)}`;
        if (errorAlreadySent.current === errorKey) return;

        errorAlreadySent.current = errorKey;
        appRef.current.sendMessage({
          role: "user",
          content: [{
            type: "text",
            text: `The PlantUML diagram has errors. Please fix and regenerate.\n\nError: ${errorMsg}\n\nCurrent code:\n\`\`\`plantuml\n${code}\n\`\`\``,
          }],
        });
      }, 3000);
    },
    [],
  );

  // Trigger render when code changes
  useEffect(() => {
    if (plantUmlCode.trim()) {
      scheduleRender(plantUmlCode);
    }
    return () => {
      if (renderTimer.current) clearTimeout(renderTimer.current);
    };
  }, [plantUmlCode, scheduleRender]);

  /** Process host context. */
  const processHostContext = useCallback((ctx: Record<string, unknown> | null | undefined) => {
    if (!ctx) return;

    const availModes = ctx.availableDisplayModes as string[] | undefined;
    if (availModes) {
      setFullscreenAvailable(availModes.includes("fullscreen"));
    }

    const displayMode = ctx.displayMode as string | undefined;
    if (displayMode) {
      setIsFullscreen(displayMode === "fullscreen");
    }

    const dims = ctx.containerDimensions as Record<string, number> | undefined;
    if (dims) {
      if ("height" in dims && typeof dims.height === "number") {
        setHostHeight(`${dims.height}px`);
      } else if ("maxHeight" in dims && typeof dims.maxHeight === "number") {
        const h = Math.min(DEFAULT_HEIGHT, dims.maxHeight);
        setHostHeight(`${h}px`);
      }
    }
  }, []);

  const appRef = useRef<McpApp | null>(null);
  const [app, setApp] = useState<McpApp | null>(null);

  // Manual App creation with autoResize: false (useApp forces autoResize: true)
  useEffect(() => {
    const mcpApp = new McpApp(
      { name: "plantuml-app", version: "0.1.0" },
      {}, // capabilities
      { autoResize: false },
    );

    appRef.current = mcpApp;

    mcpApp.ontoolinput = (params) => {
      const args = params.arguments as Record<string, unknown>;
      const code = (args.plantUmlCode as string) ?? "";
      isToolInputError.current = true;
      setDiagramInput({
        plantUmlCode: code,
        diagramType: (args.diagramType as string) ?? undefined,
      });
      setPlantUmlCode(code);
      setPartial(null);
      setStreaming(false);
      changeLog.clear();
      setChangeCount(0);
    };

    mcpApp.ontoolinputpartial = (params) => {
      const args = params.arguments as Record<string, unknown> | undefined;
      if (args?.plantUmlCode) {
        const partialCode = args.plantUmlCode as string;
        setPartial(partialCode);
        setStreaming(true);
        setPlantUmlCode(partialCode);
      }
    };

    mcpApp.onhostcontextchanged = (params) => {
      processHostContext(params as Record<string, unknown>);
    };

    const transport = new PostMessageTransport(window.parent, window.parent);
    mcpApp.connect(transport)
      .then(() => {
        // Report initial size to host (autoResize is off, so we must do it manually)
        mcpApp.sendSizeChanged({ width: document.documentElement.scrollWidth, height: DEFAULT_HEIGHT });
        setApp(mcpApp);
      })
      .catch((err) => console.error("App connect failed:", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useHostStyles(app, app?.getHostContext());

  // Process initial host context
  useEffect(() => {
    if (!app) return;
    const ctx = app.getHostContext();
    processHostContext(ctx as Record<string, unknown> | null);
  }, [app, processHostContext]);

  // Reset hostHeight when exiting fullscreen
  const prevFullscreen = useRef(false);
  useEffect(() => {
    if (prevFullscreen.current && !isFullscreen) {
      setHostHeight(`${DEFAULT_HEIGHT}px`);
    }
    prevFullscreen.current = isFullscreen;
  }, [isFullscreen]);

  // Escape key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        const currentApp = appRef.current;
        if (currentApp) {
          currentApp.requestDisplayMode({ mode: "inline" }).then((result) => {
            setIsFullscreen(result.mode === "fullscreen");
          }).catch(() => {
            setIsFullscreen(false);
          });
        } else {
          setIsFullscreen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Handle code changes from editor
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setPlantUmlCode(newCode);
      isToolInputError.current = false;

      changeLog.add({ type: "edit", summary: "manual code edit" });
      setChangeCount(changeLog.count);
    },
    [changeLog],
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (silentSyncTimer.current) clearTimeout(silentSyncTimer.current);
      if (errorFixTimer.current) clearTimeout(errorFixTimer.current);
      if (renderTimer.current) clearTimeout(renderTimer.current);
    };
  }, []);

  // Silent sync: debounced updateModelContext
  useEffect(() => {
    if (silentSyncTimer.current) clearTimeout(silentSyncTimer.current);
    silentSyncTimer.current = setTimeout(() => {
      silentSync(app ?? null, plantUmlCode, selectedElements, detectedType);
    }, 1500);
    return () => {
      if (silentSyncTimer.current) clearTimeout(silentSyncTimer.current);
    };
  }, [app, plantUmlCode, selectedElements, detectedType]);

  // Handle "Send to Agent"
  const handleSendToAgent = useCallback(() => {
    sendToAgent(app ?? null, changeLog, plantUmlCode, selectedElements, detectedType);
    setChangeCount(0);
  }, [app, changeLog, plantUmlCode, selectedElements, detectedType]);

  // Fullscreen toggle
  const handleToggleFullscreen = useCallback(async () => {
    const currentApp = appRef.current;
    if (!currentApp) return;

    const target = isFullscreen ? "inline" : "fullscreen";
    try {
      const result = await currentApp.requestDisplayMode({ mode: target as "inline" | "fullscreen" });
      setIsFullscreen(result.mode === "fullscreen");
    } catch {
      setIsFullscreen(!isFullscreen);
    }
  }, [isFullscreen]);

  const renderDiagram = () => (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <DiagramView
        svgContent={svgContent}
        loading={renderLoading}
        error={renderError}
        theme={theme}
        streaming={streaming}
        selectedElements={selectedElements}
        onSelectionChange={setSelectedElements}
      />
      <SendButton changeCount={changeCount} onClick={handleSendToAgent} theme={theme} />
    </div>
  );

  const renderCodeEditor = () => (
    <CodeEditor
      value={plantUmlCode}
      onChange={handleCodeChange}
      theme={theme}
    />
  );

  return (
    <div
      className="plantuml-app-root"
      style={{
        width: "100%",
        height: rootHeight,
        display: "flex",
        flexDirection: "column",
        backgroundColor: colors.canvasBg,
        color: theme === "dark" ? "#e4e4e7" : "#09090b",
        transition: "background-color 0.2s, color 0.2s",
        borderRadius: isFullscreen ? 0 : undefined,
      }}
    >
      {/* Global styles */}
      <style>{`
        .plantuml-app-root:hover .fullscreen-btn { opacity: 0.7 !important; }
        .fullscreen-btn:hover { opacity: 1 !important; }
        .fullscreen-btn:focus-visible { opacity: 1 !important; outline: 2px solid ${colors.accent}; outline-offset: 1px; }
        @keyframes streaming-pulse {
          0%,100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .streaming-indicator { animation: none !important; opacity: 0.7 !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: `1px solid ${colors.toolbarBorder}`,
          background: colors.toolbarBg,
          flexShrink: 0,
          transition: "all 0.2s ease",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 80,
        }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: colors.accent,
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11,
            color: colors.toolbarLabel,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
          }}>
            PlantUML
          </span>
        </div>
        <ViewSwitch mode={viewMode} onChange={setViewMode} theme={theme} />
        <div style={{ display: "flex", gap: 4, alignItems: "center", minWidth: 80, justifyContent: "flex-end" }}>
          <CopyButton code={plantUmlCode} theme={theme} />
          <ExportButton svgContent={svgContent} plantUmlCode={plantUmlCode} theme={theme} />
        </div>
      </div>

      {/* Streaming indicator */}
      {streaming && (
        <div
          className="streaming-indicator"
          style={{
            padding: "3px 12px",
            textAlign: "center",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.02em",
            flexShrink: 0,
            color: colors.accent,
            borderBottom: `1px solid ${colors.toolbarBorder}`,
            background: colors.accentMuted,
            animation: "streaming-pulse 2s ease-in-out infinite",
          }}
        >
          Receiving diagram
        </div>
      )}

      {/* Main content area */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden", position: "relative" }}>
        {viewMode === "code" && (
          <div style={{ width: "100%", height: "100%" }}>
            {renderCodeEditor()}
          </div>
        )}

        {viewMode === "canvas" && (
          <div style={{ width: "100%", height: "100%" }}>
            {renderDiagram()}
          </div>
        )}

        {viewMode === "split" && (
          <>
            <div
              style={{
                width: "50%",
                height: "100%",
                borderRight: `1px solid ${colors.toolbarBorder}`,
                overflow: "hidden",
              }}
            >
              {renderCodeEditor()}
            </div>
            <div style={{ width: "50%", height: "100%", overflow: "hidden" }}>
              {renderDiagram()}
            </div>
          </>
        )}

        {/* Fullscreen toggle button */}
        {fullscreenAvailable && (
          <button
            className="fullscreen-btn"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              opacity: 0,
              zIndex: 20,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${colors.zoomBorder}`,
              borderRadius: 6,
              background: colors.zoomBg,
              color: colors.zoomText,
              cursor: "pointer",
              fontSize: 14,
              boxShadow: theme === "dark" ? "0 2px 8px rgba(0,0,0,0.4)" : "0 1px 4px rgba(0,0,0,0.08)",
              transition: "opacity 0.2s",
            }}
          >
            {isFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4,1 4,4 1,4" />
                <polyline points="10,1 10,4 13,4" />
                <polyline points="4,13 4,10 1,10" />
                <polyline points="10,13 10,10 13,10" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1,5 1,1 5,1" />
                <polyline points="9,1 13,1 13,5" />
                <polyline points="13,9 13,13 9,13" />
                <polyline points="5,13 1,13 1,9" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
