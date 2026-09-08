import type { MouseEvent as ReactMouseEvent } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { nodeBounds } from "@/lib/canvas/canvas-node-geometry";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasNodeData, ConnectionHandle } from "@/types/canvas";

type SelectionConnectionRailProps = {
    nodes: CanvasNodeData[];
    handleType: ConnectionHandle["handleType"];
    onConnectStart: (event: ReactMouseEvent, handleType: ConnectionHandle["handleType"], nodeIds: string[]) => void;
};

export function CanvasSelectionConnectionRail({ nodes, handleType, onConnectStart }: SelectionConnectionRailProps) {
    const { t } = useTranslation();
    const theme = useThemeStore((state) => state.theme);
    if (nodes.length < 2) return null;

    const bounds = nodeBounds(nodes);
    const railHeight = Math.min(Math.max(bounds.bottom - bounds.top, 48), 80);
    const nodeIds = nodes.map((node) => node.id);
    const label = t(handleType === "source" ? "canvas.connection.selectedOutput" : "canvas.connection.selectedInput");
    const side = handleType === "source" ? "right" : "left";

    return (
        <button
            type="button"
            data-canvas-no-zoom
            aria-label={label}
            className={`canvas-connection-rail canvas-connection-rail-${side} group pointer-events-auto absolute z-[75] flex -translate-y-1/2 items-center justify-center touch-none cursor-crosshair rounded-full outline-none transition-opacity duration-150`}
            style={{ left: handleType === "source" ? bounds.right : bounds.left - 80, top: bounds.top + (bounds.bottom - bounds.top) / 2, height: railHeight, width: 80, opacity: 1 }}
            onMouseDown={(event) => {
                event.stopPropagation();
                onConnectStart(event, handleType, nodeIds);
            }}
        >
            <span className={`canvas-connection-rail-plus canvas-connection-rail-plus-${side} absolute left-1/2 top-1/2 block`}>
                <span className="grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-white text-[#111827] shadow-sm" style={{ borderColor: theme === "dark" ? "#64748b" : "#111827" }}>
                    <Plus aria-hidden="true" className="size-3.5" strokeWidth={2.25} />
                </span>
            </span>
        </button>
    );
}
