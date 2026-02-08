import { useState, useRef, useEffect } from "react";
import { type Theme, themeColors } from "../theme";
import { exportSvg, exportPng } from "../engine/export";

interface ExportButtonProps {
  svgContent: string | null;
  plantUmlCode: string;
  theme?: Theme;
}

export default function ExportButton({ svgContent, plantUmlCode, theme = "light" }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const colors = themeColors(theme);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleExportSvg = () => {
    if (svgContent) {
      exportSvg(svgContent);
      setOpen(false);
    }
  };

  const handleExportPng = () => {
    if (plantUmlCode.trim()) {
      exportPng(plantUmlCode);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          padding: "4px 10px",
          fontSize: 13,
          fontWeight: 500,
          lineHeight: "22px",
          cursor: "pointer",
          border: `1px solid ${colors.exportBorder}`,
          borderRadius: 6,
          backgroundColor: colors.exportBg,
          color: colors.exportText,
          transition: "background-color 0.15s",
        }}
        title="Export diagram"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 4 }}>
          <path d="M7 1v8M3 6l4 4 4-4M2 12h10" />
        </svg>
        Export
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            minWidth: 120,
            backgroundColor: colors.exportBg,
            border: `1px solid ${colors.exportBorder}`,
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={handleExportSvg}
            disabled={!svgContent}
            style={{
              ...dropdownItemStyle,
              color: colors.exportText,
              opacity: svgContent ? 1 : 0.4,
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = colors.exportHover; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            Export SVG
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            disabled={!plantUmlCode.trim()}
            style={{
              ...dropdownItemStyle,
              color: colors.exportText,
              opacity: plantUmlCode.trim() ? 1 : 0.4,
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = colors.exportHover; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            Export PNG
          </button>
        </div>
      )}
    </div>
  );
}

const dropdownItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "8px 16px",
  fontSize: 13,
  textAlign: "left",
  border: "none",
  backgroundColor: "transparent",
  cursor: "pointer",
  transition: "background-color 0.1s",
};
