/**
 * Theme utilities for the PlantUML MCP App.
 *
 * Uses the host CSS variables applied by useHostStyles() and
 * useDocumentTheme() for reactive dark/light detection.
 *
 * Color system: Tailwind Slate palette for developer tool aesthetic.
 */

export type Theme = "light" | "dark";

/**
 * Dark-mode specific overrides that can't use CSS variables
 * (e.g. for inline SVG rendering, CodeMirror themes, etc.)
 */
export function themeColors(theme: Theme) {
  if (theme === "dark") {
    return {
      // Zinc neutral dark — no blue tint
      canvasBg: "#09090b",
      editorBg: "#0a0a0b",
      editorGutter: "#52525b",
      editorActiveLine: "rgba(161,161,170,0.06)",
      errorLineBg: "rgba(239, 68, 68, 0.15)",
      errorLineBorder: "#ef4444",
      sendBtnBg: "#22c55e",
      sendBtnShadow: "0 2px 16px rgba(34,197,94,0.4), 0 1px 4px rgba(0,0,0,0.5)",
      switchBg: "#18181b",
      switchBorder: "#27272a",
      switchActiveBg: "#27272a",
      switchActiveText: "#fafafa",
      switchInactiveText: "#71717a",
      toolbarBg: "linear-gradient(180deg, #18181b 0%, #111113 100%)",
      toolbarBgFlat: "#18181b",
      toolbarBorder: "#27272a",
      toolbarLabel: "#71717a",
      toolbarLabelAccent: "#4ade80",
      zoomBg: "#18181b",
      zoomBorder: "#27272a",
      zoomText: "#a1a1aa",
      exportBg: "transparent",
      exportBorder: "#27272a",
      exportText: "#a1a1aa",
      exportHover: "rgba(161,161,170,0.08)",
      switchHoverBg: "rgba(161,161,170,0.06)",
      accent: "#4ade80",
      accentMuted: "rgba(74,222,128,0.1)",
      separator: "#27272a",
    };
  }
  return {
    // Zinc neutral light — clean and warm
    canvasBg: "#fafafa",
    editorBg: "#ffffff",
    editorGutter: "#a1a1aa",
    editorActiveLine: "rgba(113,113,122,0.06)",
    errorLineBg: "rgba(239, 68, 68, 0.08)",
    errorLineBorder: "#ef4444",
    sendBtnBg: "#16a34a",
    sendBtnShadow: "0 2px 12px rgba(22,163,74,0.25), 0 1px 3px rgba(0,0,0,0.06)",
    switchBg: "#f4f4f5",
    switchBorder: "#e4e4e7",
    switchActiveBg: "#ffffff",
    switchActiveText: "#09090b",
    switchInactiveText: "#71717a",
    toolbarBg: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
    toolbarBgFlat: "#fafafa",
    toolbarBorder: "#e4e4e7",
    toolbarLabel: "#a1a1aa",
    toolbarLabelAccent: "#16a34a",
    zoomBg: "#ffffff",
    zoomBorder: "#e4e4e7",
    zoomText: "#71717a",
    exportBg: "transparent",
    exportBorder: "#d4d4d8",
    exportText: "#71717a",
    exportHover: "rgba(9,9,11,0.04)",
    switchHoverBg: "rgba(9,9,11,0.04)",
    accent: "#16a34a",
    accentMuted: "rgba(22,163,74,0.08)",
    separator: "#e4e4e7",
  };
}
