import {
    AlignHorizontalJustifyCenter,
    AlignHorizontalJustifyEnd,
    AlignHorizontalJustifyStart,
    AlignHorizontalSpaceAround,
    AlignHorizontalSpaceBetween,
    AlignVerticalJustifyCenter,
    AlignVerticalJustifyEnd,
    AlignVerticalJustifyStart,
    AlignVerticalSpaceAround,
    AlignVerticalSpaceBetween,
    Grid3X3,
    Group,
    Ungroup,
    Workflow,
} from "lucide-react";
import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import type { CanvasSelectionLayoutAction } from "@/lib/canvas/canvas-node-geometry";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasNodeData, ViewportTransform } from "@/types/canvas";
import { useCanvasSelectionScreenBounds } from "./canvas-selection-toolbar";

const ACTIONS: Array<{ action: CanvasSelectionLayoutAction; icon: typeof AlignHorizontalJustifyStart; label: string; disabled?: (nodes: CanvasNodeData[]) => boolean }> = [
    { action: "align-left", icon: AlignHorizontalJustifyStart, label: "left" },
    { action: "align-center-horizontal", icon: AlignHorizontalJustifyCenter, label: "centerHorizontal" },
    { action: "align-right", icon: AlignHorizontalJustifyEnd, label: "right" },
    { action: "align-top", icon: AlignVerticalJustifyStart, label: "top" },
    { action: "align-center-vertical", icon: AlignVerticalJustifyCenter, label: "centerVertical" },
    { action: "align-bottom", icon: AlignVerticalJustifyEnd, label: "bottom" },
    { action: "distribute-horizontal", icon: AlignHorizontalSpaceBetween, label: "distributeHorizontal", disabled: (nodes) => nodes.length < 3 },
    { action: "distribute-vertical", icon: AlignVerticalSpaceBetween, label: "distributeVertical", disabled: (nodes) => nodes.length < 3 },
    { action: "arrange-horizontal", icon: AlignHorizontalSpaceAround, label: "arrangeHorizontal" },
    { action: "arrange-vertical", icon: AlignVerticalSpaceAround, label: "arrangeVertical" },
    { action: "arrange-grid", icon: Grid3X3, label: "arrangeGrid" },
    { action: "organize-connections", icon: Workflow, label: "organizeConnections" },
];

export function CanvasSelectionLayoutToolbar({
    nodes,
    viewport,
    canGroup,
    canUngroup,
    onGroup,
    onUngroup,
    onLayout,
}: {
    nodes: CanvasNodeData[];
    viewport: ViewportTransform;
    canGroup: boolean;
    canUngroup: boolean;
    onGroup: () => void;
    onUngroup: () => void;
    onLayout: (action: CanvasSelectionLayoutAction) => void;
}) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const bounds = useCanvasSelectionScreenBounds(nodes, viewport);
    if (nodes.length < 2) return null;

    const left = (bounds.left + bounds.right) / 2;
    const top = bounds.top - 10;

    return (
        <div
            className="pointer-events-auto absolute z-[70] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-full overflow-x-auto rounded-[14px] border px-1.5 shadow-[0_8px_28px_rgba(15,23,42,.12)]"
            style={{ left, top, background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.toolbar.item }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div className="flex h-10 items-center gap-0.5">
                {ACTIONS.map(({ action, icon: Icon, label, disabled }) => {
                    const isDisabled = disabled?.(nodes) || false;
                    const title = t(`canvas.selectionLayout.${label}`);
                    return (
                        <Tooltip key={action} title={title} placement="top" mouseEnterDelay={0.15}>
                            <button
                                type="button"
                                aria-label={title}
                                disabled={isDisabled}
                                className="grid size-8 place-items-center rounded-lg transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-25 dark:hover:bg-white/10"
                                onClick={() => onLayout(action)}
                            >
                                <Icon className="size-4" />
                            </button>
                        </Tooltip>
                    );
                })}
                {canGroup || canUngroup ? <span className="mx-1 h-5 w-px" style={{ background: theme.toolbar.border }} /> : null}
                {canGroup ? <LayoutAction label={t("canvas.nodeToolbar.group")} title={t("canvas.nodeToolbar.groupTitle")} icon={<Group className="size-4" />} onClick={onGroup} /> : null}
                {canUngroup ? <LayoutAction label={t("canvas.nodeToolbar.ungroup")} title={t("canvas.nodeToolbar.ungroupTitle")} icon={<Ungroup className="size-4" />} onClick={onUngroup} /> : null}
            </div>
        </div>
    );
}

function LayoutAction({ label, title, icon, onClick }: { label: string; title: string; icon: React.ReactNode; onClick: () => void }) {
    return (
        <Tooltip title={title} placement="top" mouseEnterDelay={0.15}>
            <button type="button" aria-label={label} title={title} className="grid size-8 place-items-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10" onClick={onClick}>
                {icon}
            </button>
        </Tooltip>
    );
}
