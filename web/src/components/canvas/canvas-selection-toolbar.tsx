import { useLayoutEffect, useState } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { nodeBounds } from "@/lib/canvas/canvas-node-geometry";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasNodeData, ViewportTransform } from "@/types/canvas";

const SELECTION_PAD = 14;

type SelectionScreenBounds = { left: number; top: number; right: number; bottom: number };

export function useCanvasSelectionScreenBounds(nodes: CanvasNodeData[], viewport: ViewportTransform): SelectionScreenBounds {
    const fallback = nodeBounds(nodes);
    const fallbackBounds = {
        left: viewport.x + fallback.left * viewport.k,
        top: viewport.y + fallback.top * viewport.k,
        right: viewport.x + fallback.right * viewport.k,
        bottom: viewport.y + fallback.bottom * viewport.k,
    };
    const [bounds, setBounds] = useState<SelectionScreenBounds>(fallbackBounds);

    useLayoutEffect(() => {
        const elements = new Map(Array.from(document.querySelectorAll<HTMLElement>("[data-node-id]")).map((element) => [element.dataset.nodeId, element]));
        const selectedElements = nodes.map((node) => elements.get(node.id)).filter((element): element is HTMLElement => Boolean(element));
        if (selectedElements.length !== nodes.length || !selectedElements.length) {
            setBounds((current) => (sameBounds(current, fallbackBounds) ? current : fallbackBounds));
            return;
        }

        const section = selectedElements[0].closest("section")?.getBoundingClientRect();
        const offsetLeft = section?.left || 0;
        const offsetTop = section?.top || 0;
        const next = selectedElements.reduce(
            (acc, element) => {
                const rect = element.getBoundingClientRect();
                return {
                    left: Math.min(acc.left, rect.left - offsetLeft),
                    top: Math.min(acc.top, rect.top - offsetTop),
                    right: Math.max(acc.right, rect.right - offsetLeft),
                    bottom: Math.max(acc.bottom, rect.bottom - offsetTop),
                };
            },
            { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
        );
        setBounds((current) => (sameBounds(current, next) ? current : next));
    }, [fallbackBounds.bottom, fallbackBounds.left, fallbackBounds.right, fallbackBounds.top, nodes, viewport.k, viewport.x, viewport.y]);

    return bounds;
}

function sameBounds(a: SelectionScreenBounds, b: SelectionScreenBounds) {
    return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
}

export function CanvasSelectionToolbar({ nodes, viewport }: { nodes: CanvasNodeData[]; viewport: ViewportTransform }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const bounds = useCanvasSelectionScreenBounds(nodes, viewport);
    if (nodes.length < 2) return null;

    const left = bounds.left - SELECTION_PAD;
    const top = bounds.top - SELECTION_PAD;
    const width = bounds.right - bounds.left + SELECTION_PAD * 2;
    const height = bounds.bottom - bounds.top + SELECTION_PAD * 2;
    return (
        <>
            <svg className="pointer-events-none absolute z-[65] overflow-visible" style={{ left, top, width, height }}>
                <rect
                    x={1}
                    y={1}
                    width={Math.max(width - 2, 0)}
                    height={Math.max(height - 2, 0)}
                    rx={16}
                    ry={16}
                    fill={theme.canvas.selectionFill}
                    stroke={theme.canvas.selectionStroke}
                    strokeOpacity={0.55}
                    strokeWidth={1.5}
                    strokeDasharray="7 5"
                    strokeLinecap="round"
                />
            </svg>
        </>
    );
}
