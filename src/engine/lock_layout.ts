import type { Ext } from '../extension.js';
import type { AutoTiler } from './auto_tiler.js';
import type { Entity } from '../core/ecs.js';
import type { ShellWindow } from '../window/window.js';
import type { LayoutNode, LayoutSnapshot, WorkspaceLayout } from './layout_snapshot.js';
import { pruneTree, sameArea, snapshotIds } from './layout_snapshot.js';
import { Node, NodeKind } from './node.js';
import type { NodeStack } from './node.js';
import { Stack } from './stack.js';
import { Orientation } from '../utils/lib.js';
import * as Tags from '../utils/tags.js';

export function captureLayout(ext: Ext): LayoutSnapshot {
    const tiler = ext.auto_tiler!;
    const windowId = (entity: Entity): number | null =>
        ext.windows.get(entity)?.meta.get_stable_sequence() ?? null;
    const capture = (branch: Node): LayoutNode | null => {
        const inner = branch.inner;
        if (inner.kind === NodeKind.WINDOW) {
            const id = windowId(inner.entity);
            return id === null ? null : { kind: 'window', id };
        }
        if (inner.kind === NodeKind.STACK) {
            const ids = inner.entities.map(windowId).filter((id): id is number => id !== null);
            if (!ids.length) return null;
            const active = tiler.forest.stacks.get(inner.idx)?.active;
            return { kind: 'stack', ids, active: active ? windowId(active) ?? ids[0] : ids[0] };
        }
        const fork = tiler.forest.forks.get(inner.entity);
        if (!fork) return null;
        const left = capture(fork.left);
        const right = fork.right ? capture(fork.right) : null;
        if (!left || !right) return left ?? right;
        return {
            kind: 'split', horizontal: fork.is_horizontal(),
            ratio: fork.length_left / fork.length(), left, right,
        };
    };
    const layouts: WorkspaceLayout[] = [];
    for (const [entity, [monitor, workspace]] of tiler.forest.toplevel.values()) {
        const tree = capture(Node.fork(entity));
        if (!tree) continue;
        const area = ext.monitor_work_area(monitor);
        layouts.push({ monitor, workspace, area: { x: area.x, y: area.y, width: area.width, height: area.height }, tree });
    }
    const floating: number[] = [];
    const forceTiled: number[] = [];
    for (const win of ext.windows.values()) {
        if (ext.contains_tag(win.entity, Tags.Floating)) floating.push(win.meta.get_stable_sequence());
        if (ext.contains_tag(win.entity, Tags.ForceTile)) forceTiled.push(win.meta.get_stable_sequence());
    }
    return { layouts, floating, forceTiled };
}

/** Restore only groups whose display/workspace still matches; other groups use normal reconstruction. */
export function restoreWorkspace(
    tiler: AutoTiler, ext: Ext, saved: WorkspaceLayout, windows: ShellWindow[],
): number[] {
    const area = ext.monitor_work_area(saved.monitor);
    if (!sameArea(saved.area, area)) return [];
    const byId = new Map(windows.map(win => [win.meta.get_stable_sequence(), win]));
    const tree = pruneTree(saved.tree, new Set(byId.keys()));
    if (!tree) return [];
    const rootArea = area.clone();
    if (!ext.settings.smart_gaps() || snapshotIds(tree).length > 1) {
        rootArea.x += ext.gap_outer;
        rootArea.y += ext.gap_top;
        rootArea.width -= ext.gap_outer * 2;
        rootArea.height -= ext.gap_outer + ext.gap_top;
    }
    const stacks: NodeStack[] = [];
    const build = (savedNode: LayoutNode, rect: typeof rootArea): Node => {
        if (savedNode.kind === 'window') return Node.window(byId.get(savedNode.id)!.entity);
        if (savedNode.kind === 'stack') {
            const active = byId.get(savedNode.active)!;
            const container = new Stack(ext, active.entity, saved.workspace, saved.monitor);
            container.active_id = savedNode.ids.indexOf(savedNode.active);
            const idx = tiler.forest.stacks.insert(container);
            const result = Node.stacked(active.entity, idx);
            const inner = result.inner as NodeStack;
            inner.entities = savedNode.ids.map(id => byId.get(id)!.entity);
            inner.rect = rect.clone();
            stacks.push(inner);
            return result;
        }
        const leftRect = rect.clone();
        const rightRect = rect.clone();
        const gap = ext.gap_inner_half;
        const split = (savedNode.horizontal ? rect.width : rect.height) * savedNode.ratio;
        if (savedNode.horizontal) {
            leftRect.width = split - gap;
            rightRect.x += split + gap;
            rightRect.width -= split + gap;
        } else {
            leftRect.height = split - gap;
            rightRect.y += split + gap;
            rightRect.height -= split + gap;
        }
        const left = build(savedNode.left, leftRect);
        const right = build(savedNode.right, rightRect);
        const [entity, fork] = tiler.forest.create_fork(left, right, rect, saved.workspace, saved.monitor);
        fork.orientation = savedNode.horizontal ? Orientation.HORIZONTAL : Orientation.VERTICAL;
        fork.set_ratio(split);
        fork.prev_ratio = savedNode.ratio;
        link(entity, left);
        link(entity, right);
        return Node.fork(entity);
    };
    const link = (parent: Entity, child: Node) => {
        if (child.inner.kind === NodeKind.FORK) tiler.forest.parents.insert(child.inner.entity, parent);
        else if (child.inner.kind === NodeKind.WINDOW) ext.on_tile_attach(parent, child.inner.entity);
        else for (const entity of child.inner.entities) ext.on_tile_attach(parent, entity);
    };
    let root = build(tree, rootArea);
    if (root.inner.kind !== NodeKind.FORK) {
        const [entity] = tiler.forest.create_fork(root, null, rootArea, saved.workspace, saved.monitor);
        link(entity, root);
        root = Node.fork(entity);
    }
    if (root.inner.kind !== NodeKind.FORK) return [];
    const entity = root.inner.entity;
    const fork = tiler.forest.forks.get(entity)!;
    fork.is_toplevel = true;
    tiler.forest.toplevel.set(`${entity}`, [entity, [saved.monitor, saved.workspace]]);
    for (const stack of stacks) tiler.update_stack(ext, stack);
    tiler.update_toplevel(ext, fork, saved.monitor, ext.settings.smart_gaps());
    return snapshotIds(tree);
}
