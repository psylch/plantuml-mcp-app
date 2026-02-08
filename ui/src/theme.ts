/**
 * Theme utilities for the PlantUML MCP App.
 *
 * Uses the host CSS variables applied by useHostStyles() and
 * useDocumentTheme() for reactive dark/light detection.
 */

export type Theme = "light" | "dark";

/**
 * Dark-mode specific overrides that can't use CSS variables
 * (e.g. for inline SVG rendering, CodeMirror themes, etc.)
 */
export function themeColors(theme: Theme) {
  if (theme === "dark") {
    return {
      canvasBg: "#1a1b26",
      editorBg: "#1a1b26",
      editorGutter: "#4a5568",
      editorActiveLine: "rgba(255,255,255,0.05)",
      errorLineBg: "rgba(220, 38, 38, 0.15)",
      errorLineBorder: "#ef4444",
      sendBtnBg: "#3b82f6",
      sendBtnShadow: "0 2px 8px rgba(59,130,246,0.4), 0 1px 3px rgba(0,0,0,0.3)",
      switchBg: "#2d3748",
      switchBorder: "#4a5568",
      switchActiveBg: "#4a5568",
      switchActiveText: "#f7fafc",
      switchInactiveText: "#a0aec0",
      toolbarBg: "#1e2030",
      toolbarBorder: "#2d3748",
      toolbarLabel: "#a0aec0",
      zoomBg: "#2d3748",
      zoomBorder: "#4a5568",
      zoomText: "#e2e8f0",
      exportBg: "#2d3748",
      exportBorder: "#4a5568",
      exportText: "#e2e8f0",
      exportHover: "#4a5568",
    };
  }
  return {
    canvasBg: "#ffffff",
    editorBg: "#ffffff",
    editorGutter: "#94a3b8",
    editorActiveLine: "rgba(100,116,139,0.08)",
    errorLineBg: "rgba(220, 38, 38, 0.10)",
    errorLineBorder: "#dc2626",
    sendBtnBg: "#2563eb",
    sendBtnShadow: "0 2px 8px rgba(37,99,235,0.35), 0 1px 3px rgba(0,0,0,0.1)",
    switchBg: "#f3f4f6",
    switchBorder: "#d1d5db",
    switchActiveBg: "#ffffff",
    switchActiveText: "#111827",
    switchInactiveText: "#6b7280",
    toolbarBg: "#fafafa",
    toolbarBorder: "#e5e7eb",
    toolbarLabel: "#6b7280",
    zoomBg: "#ffffff",
    zoomBorder: "#dddddd",
    zoomText: "#333333",
    exportBg: "#ffffff",
    exportBorder: "#d1d5db",
    exportText: "#374151",
    exportHover: "#f3f4f6",
  };
}
