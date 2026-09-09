import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type ConnectionHandle } from "@/types/canvas";

export type CanvasSelectionLayoutAction =
    | "align-left"
    | "align-center-horizontal"
    | "align-right"
    | "align-top"
    | "align-center-vertical"
    | "align-bottom"
    | "distribute-horizontal"
    | "distribute-vertical"
    | "arrange-horizontal"
    | "arrange-vertical"
    | "arrange-grid"
    | "organize-connections";

export function nodeBounds(nodes: CanvasNodeData[]) {
    return nodes.reduce(
        (acc, node) => ({
            left: Math.min(acc.left, node.position.x),
            top: Math.min(acc.top, node.position.y),
            right: Math.max(acc.right, node.position.x + node.width),
            bottom: Math.max(acc.bottom, node.position.y + node.height),
        }),
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
}

export function layoutSelectedNodes(action: CanvasSelectionLayoutAction, selectedIds: Set<string>, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const selected = nodes.filter((node) => selectedIds.has(node.id));
    if (selected.length < 2) return nodes;

    const bounds = nodeBounds(selected);
    const update = new Map<string, PositionPatch>();
    const patch = (node: CanvasNodeData, position: PositionPatch) => update.set(node.id, position);

    if (action === "align-left") selected.forEach((node) => patch(node, { x: bounds.left }));
    if (action === "align-center-horizontal") selected.forEach((node) => patch(node, { x: (bounds.left + bounds.right - node.width) / 2 }));
    if (action === "align-right") selected.forEach((node) => patch(node, { x: bounds.right - node.width }));
    if (action === "align-top") selected.forEach((node) => patch(node, { y: bounds.top }));
    if (action === "align-center-vertical") selected.forEach((node) => patch(node, { y: (bounds.top + bounds.bottom - node.height) / 2 }));
    if (action === "align-bottom") selected.forEach((node) => patch(node, { y: bounds.bottom - node.height }));

    if (action === "distribute-horizontal" && selected.length >= 3) {
        const ordered = [...selected].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
        const totalWidth = ordered.reduce((sum, node) => sum + node.width, 0);
        const gap = (bounds.right - bounds.left - totalWidth) / (ordered.length - 1);
        let cursor = bounds.left;
        ordered.forEach((node) => {
            patch(node, { x: cursor });
            cursor += node.width + gap;
        });
    }

    if (action === "distribute-vertical" && selected.length >= 3) {
        const ordered = [...selected].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
        const totalHeight = ordered.reduce((sum, node) => sum + node.height, 0);
        const gap = (bounds.bottom - bounds.top - totalHeight) / (ordered.length - 1);
        let cursor = bounds.top;
        ordered.forEach((node) => {
            patch(node, { y: cursor });
            cursor += node.height + gap;
        });
    }

    if (action === "arrange-horizontal") {
        const ordered = [...selected].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
        const gap = 40;
        let cursor = bounds.left;
        const center = (bounds.top + bounds.bottom) / 2;
        ordered.forEach((node) => {
            patch(node, { x: cursor, y: center - node.height / 2 });
            cursor += node.width + gap;
        });
    }

    if (action === "arrange-vertical") {
        const ordered = [...selected].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
        const gap = 40;
        let cursor = bounds.top;
        const center = (bounds.left + bounds.right) / 2;
        ordered.forEach((node) => {
            patch(node, { x: center - node.width / 2, y: cursor });
            cursor += node.height + gap;
        });
    }

    if (action === "arrange-grid") {
        const ordered = [...selected].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
        const columns = Math.ceil(Math.sqrt(ordered.length));
        const cellWidth = Math.max(...ordered.map((node) => node.width));
        const cellHeight = Math.max(...ordered.map((node) => node.height));
        const gap = 40;
        ordered.forEach((node, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            patch(node, { x: bounds.left + column * (cellWidth + gap) + (cellWidth - node.width) / 2, y: bounds.top + row * (cellHeight + gap) + (cellHeight - node.height) / 2 });
        });
    }

    if (action === "organize-connections") {
        const selectedById = new Map(selected.map((node) => [node.id, node]));
        const incoming = new Map(selected.map((node) => [node.id, 0]));
        const outgoing = new Map<string, string[]>();
        connections.forEach((connection) => {
            if (!selectedById.has(connection.fromNodeId) || !selectedById.has(connection.toNodeId)) return;
            incoming.set(connection.toNodeId, (incoming.get(connection.toNodeId) || 0) + 1);
            outgoing.set(connection.fromNodeId, [...(outgoing.get(connection.fromNodeId) || []), connection.toNodeId]);
        });
        const layers = new Map<string, number>();
        const queue = selected.filter((node) => (incoming.get(node.id) || 0) === 0).map((node) => node.id);
        queue.forEach((id) => layers.set(id, 0));
        for (let index = 0; index < queue.length; index += 1) {
            const fromId = queue[index];
            (outgoing.get(fromId) || []).forEach((toId) => {
                const nextLayer = Math.max(layers.get(toId) || 0, (layers.get(fromId) || 0) + 1);
                layers.set(toId, nextLayer);
                if (!queue.includes(toId)) queue.push(toId);
            });
        }
        selected.forEach((node) => {
            if (!layers.has(node.id)) layers.set(node.id, 0);
        });
        const columns = new Map<number, CanvasNodeData[]>();
        selected.forEach((node) => columns.set(layers.get(node.id) || 0, [...(columns.get(layers.get(node.id) || 0) || []), node]));
        const columnGap = 180;
        const rowGap = 40;
        [...columns.entries()].forEach(([column, columnNodes]) => {
            let cursor = bounds.top;
            columnNodes.sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x).forEach((node) => {
                patch(node, { x: bounds.left + column * (Math.max(...selected.map((item) => item.width)) + columnGap), y: cursor });
                cursor += node.height + rowGap;
            });
        });
    }

    if (!update.size) return nodes;
    return nodes.map((node) => {
        const next = update.get(node.id);
        return next ? { ...node, position: { ...node.position, ...next } } : node;
    });
}

type PositionPatch = Partial<CanvasNodeData["position"]>;

export function findGroupDropTarget(movedIds: Set<string>, nodes: CanvasNodeData[]) {
    if (nodes.some((node) => movedIds.has(node.id) && node.type === CanvasNodeType.Group)) return null;
    const movingNodes = nodes.filter((node) => movedIds.has(node.id) && node.type !== CanvasNodeType.Group);
    if (!movingNodes.length) return null;
    return (
        [...nodes].reverse().find((group) => {
            if (group.type !== CanvasNodeType.Group || movedIds.has(group.id)) return false;
            return movingNodes.some((node) => {
                const centerX = node.position.x + node.width / 2;
                const centerY = node.position.y + node.height / 2;
                return centerX >= group.position.x && centerX <= group.position.x + group.width && centerY >= group.position.y && centerY <= group.position.y + group.height;
            });
        }) || null
    );
}

export function snapNodesIntoGroup(movedIds: Set<string>, nodes: CanvasNodeData[], group: CanvasNodeData) {
    const movingNodes = nodes.filter((node) => movedIds.has(node.id) && node.type !== CanvasNodeType.Group);
    if (!movingNodes.length) return nodes;
    const pad = 24;
    const bounds = nodeBounds(movingNodes);
    const left = group.position.x + pad;
    const top = group.position.y + pad;
    const right = group.position.x + group.width - pad;
    const bottom = group.position.y + group.height - pad;
    const dx = bounds.right - bounds.left > right - left ? left - bounds.left : bounds.left < left ? left - bounds.left : bounds.right > right ? right - bounds.right : 0;
    const dy = bounds.bottom - bounds.top > bottom - top ? top - bounds.top : bounds.top < top ? top - bounds.top : bounds.bottom > bottom ? bottom - bounds.bottom : 0;
    return nodes.map((node) => {
        if (!movedIds.has(node.id) || node.type === CanvasNodeType.Group) return node;
        return { ...node, position: { x: node.position.x + dx, y: node.position.y + dy }, metadata: { ...node.metadata, groupId: group.id } };
    });
}

export const GROUP_WRAP_PADDING = 24;
export const GROUP_WRAP_TOP_PADDING = 52;

function selectedGroupIds(selectedIds: Set<string>, nodes: CanvasNodeData[]) {
    return new Set(nodes.filter((node) => selectedIds.has(node.id) && node.type === CanvasNodeType.Group).map((node) => node.id));
}

export function collectGroupMemberNodes(selectedIds: Set<string>, nodes: CanvasNodeData[]) {
    const groups = selectedGroupIds(selectedIds, nodes);
    return nodes.filter((node) => node.type !== CanvasNodeType.Group && (selectedIds.has(node.id) || (node.metadata?.groupId != null && groups.has(node.metadata.groupId))));
}

export function getGroupWrapRect(members: CanvasNodeData[]) {
    const bounds = nodeBounds(members);
    return {
        x: bounds.left - GROUP_WRAP_PADDING,
        y: bounds.top - GROUP_WRAP_TOP_PADDING,
        width: bounds.right - bounds.left + GROUP_WRAP_PADDING * 2,
        height: bounds.bottom - bounds.top + GROUP_WRAP_TOP_PADDING + GROUP_WRAP_PADDING,
    };
}

export function canGroupSelectedNodes(selectedIds: Set<string>, nodes: CanvasNodeData[]) {
    const members = collectGroupMemberNodes(selectedIds, nodes);
    if (members.length < 2) return false;
    const groupId = members[0].metadata?.groupId;
    return !groupId || members.some((node) => node.metadata?.groupId !== groupId);
}

export function canUngroupSelectedNodes(selectedIds: Set<string>, nodes: CanvasNodeData[]) {
    return nodes.some((node) => selectedIds.has(node.id) && (node.type === CanvasNodeType.Group || Boolean(node.metadata?.groupId)));
}

function emptyGroupIds(nodes: CanvasNodeData[], keepId?: string) {
    const used = new Set(nodes.flatMap((node) => (node.type !== CanvasNodeType.Group && node.metadata?.groupId ? [node.metadata.groupId] : [])));
    return new Set(nodes.filter((node) => node.type === CanvasNodeType.Group && node.id !== keepId && !used.has(node.id)).map((node) => node.id));
}

function withoutRemoved(nodes: CanvasNodeData[], connections: CanvasConnection[], removedIds: Set<string>) {
    return {
        nodes: nodes.filter((node) => !removedIds.has(node.id)),
        connections: connections.filter((connection) => !removedIds.has(connection.fromNodeId) && !removedIds.has(connection.toNodeId)),
    };
}

export function applyGroupSelection(selectedIds: Set<string>, nodes: CanvasNodeData[], connections: CanvasConnection[], group: CanvasNodeData) {
    const members = collectGroupMemberNodes(selectedIds, nodes);
    if (members.length < 2) return null;
    const memberIds = new Set(members.map((node) => node.id));
    const flattenedGroupIds = selectedGroupIds(selectedIds, nodes);
    const updated = nodes.filter((node) => !flattenedGroupIds.has(node.id)).map((node) => (memberIds.has(node.id) ? { ...node, metadata: { ...node.metadata, groupId: group.id } } : node));
    const insertAt = updated.findIndex((node) => memberIds.has(node.id));
    const withGroup = insertAt < 0 ? [...updated, group] : [...updated.slice(0, insertAt), group, ...updated.slice(insertAt)];
    const next = withoutRemoved(withGroup, connections, new Set([...flattenedGroupIds, ...emptyGroupIds(withGroup, group.id)]));
    return { ...next, selectedIds: [group.id] };
}

export function applyUngroupSelection(selectedIds: Set<string>, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const flattenedGroupIds = selectedGroupIds(selectedIds, nodes);
    if (!flattenedGroupIds.size && !nodes.some((node) => selectedIds.has(node.id) && node.metadata?.groupId)) return null;
    const releasedIds = new Set<string>();
    const updated = nodes
        .filter((node) => !flattenedGroupIds.has(node.id))
        .map((node) => {
            const groupId = node.metadata?.groupId;
            if (!groupId) return node;
            if (!flattenedGroupIds.has(groupId) && !selectedIds.has(node.id)) return node;
            releasedIds.add(node.id);
            return { ...node, metadata: { ...node.metadata, groupId: undefined } };
        });
    const next = withoutRemoved(updated, connections, new Set([...flattenedGroupIds, ...emptyGroupIds(updated)]));
    return { ...next, selectedIds: next.nodes.filter((node) => selectedIds.has(node.id) || releasedIds.has(node.id)).map((node) => node.id) };
}

export function findContainingGroupId(node: CanvasNodeData, nodes: CanvasNodeData[]) {
    const centerX = node.position.x + node.width / 2;
    const centerY = node.position.y + node.height / 2;
    return (
        [...nodes]
            .reverse()
            .find((group) => group.type === CanvasNodeType.Group && group.id !== node.id && centerX >= group.position.x && centerX <= group.position.x + group.width && centerY >= group.position.y && centerY <= group.position.y + group.height)?.id ||
        undefined
    );
}

export function getConnectionTargetAnchor(node: CanvasNodeData, current: ConnectionHandle) {
    return {
        x: current.handleType === "source" ? node.position.x : node.position.x + node.width,
        y: node.position.y + node.height / 2,
    };
}

export function normalizeConnection(firstNodeId: string, secondNodeId: string, nodes: CanvasNodeData[], firstHandleType: "source" | "target") {
    const first = nodes.find((node) => node.id === firstNodeId);
    const second = nodes.find((node) => node.id === secondNodeId);
    if (!first || !second || first.id === second.id) return null;
    if (second.type === CanvasNodeType.Group) return null;
    if (first.type === CanvasNodeType.Config && second.type === CanvasNodeType.Config) return null;
    if (second.type === CanvasNodeType.Config) return { fromNodeId: first.id, toNodeId: second.id };
    if (first.type === CanvasNodeType.Config && firstHandleType === "target") return { fromNodeId: second.id, toNodeId: first.id };
    if (first.type === CanvasNodeType.Config) return { fromNodeId: first.id, toNodeId: second.id };
    return { fromNodeId: first.id, toNodeId: second.id };
}
