import * as lib from '../utils/lib.js';
import * as log from '../utils/log.js';
import * as node from './node.js';
import * as stack from './stack.js';

import type { AutoTiler } from './auto_tiler.js';
import type { Entity } from '../core/ecs.js';
import type { Ext } from '../extension.js';
import { Rectangle } from '../utils/rectangle.js';
import type { ShellWindow } from '../window/window.js';

const { Stack } = stack;

function sort_by_stacking(windows: ShellWindow[]): ShellWindow[] {
    const order = new Map<any, number>();
    const actors = (global as any).get_window_actors();
    for (let i = 0; i < actors.length; i++) {
        const meta = actors[i].get_meta_window();
        if (meta) order.set(meta, i);
    }

    return [...windows].sort((a, b) => (order.get(a.meta) ?? -1) - (order.get(b.meta) ?? -1));
}

/** Reconstruct a tiling layout for all windows on a single [monitor, workspace] using BSP tree inspection. */
export function reconstruct_workspace(
    tiler: AutoTiler,
    ext: Ext,
    monitor: number,
    workspace: number,
    windows: ShellWindow[],
) {
    if (windows.length === 0) return;

    if (windows.length === 1) {
        tiler.attach_to_monitor(ext, windows[0], [monitor, workspace], ext.settings.smart_gaps());
        return;
    }

    const tolerance = 5 * ext.dpi;
    const first_rect = windows[0].rect();
    const all_stacked = windows.every(w => {
        const r = w.rect();
        return (
            Math.abs(r.x - first_rect.x) <= tolerance &&
            Math.abs(r.y - first_rect.y) <= tolerance &&
            Math.abs(r.width - first_rect.width) <= tolerance &&
            Math.abs(r.height - first_rect.height) <= tolerance
        );
    });

    const root_area = ext.monitor_work_area(monitor);
    if (!ext.settings.smart_gaps()) {
        root_area.x += ext.gap_outer;
        root_area.y += ext.gap_top;
        root_area.width -= ext.gap_outer * 2;
        root_area.height -= ext.gap_outer + ext.gap_top;
    }

    if (all_stacked) {
        const stacked_windows = sort_by_stacking(windows);
        const primary = stacked_windows[0];
        const active_window = stacked_windows[stacked_windows.length - 1];

        const stack_idx = tiler.forest.stacks.insert(new Stack(ext, active_window.entity, workspace, monitor));
        const stack_node = node.Node.stacked(primary.entity, stack_idx);
        const inner = stack_node.inner as node.NodeStack;
        for (let i = 1; i < stacked_windows.length; i++) {
            inner.entities.push(stacked_windows[i].entity);
        }

        const [fork_entity, fork] = tiler.forest.create_fork(stack_node, null, root_area.clone(), workspace, monitor);
        fork.is_toplevel = true;
        tiler.forest.toplevel.set(`${fork_entity}`, [fork_entity, [monitor, workspace]]);

        for (const ent of inner.entities) {
            ext.on_tile_attach(fork_entity, ent);
        }

        const container = tiler.forest.stacks.get(stack_idx);
        if (container) {
            const tab_height = stack.TAB_HEIGHT * ext.dpi;
            const content_rect = root_area.clone();
            content_rect.y += tab_height;
            content_rect.height -= tab_height;
            inner.rect = content_rect;

            for (const win of stacked_windows) {
                win.stack = stack_idx;
                container.add(win);
            }
            container.update_positions(content_rect);
            container.activate(active_window.entity);
        }
        return;
    }

    const root_node = subtree(ext, tiler, monitor, workspace, windows, root_area);
    if (root_node && root_node.inner.kind === 1) {
        const root_fork_entity = root_node.inner.entity;
        const root_fork = tiler.forest.forks.get(root_fork_entity);
        if (root_fork) {
            root_fork.is_toplevel = true;
            tiler.forest.toplevel.set(`${root_fork_entity}`, [root_fork_entity, [monitor, workspace]]);
        }
    }
}

function subtree(
    ext: Ext,
    tiler: AutoTiler,
    monitor: number,
    workspace: number,
    windows: ShellWindow[],
    area: Rectangle,
): node.Node | null {
    if (windows.length === 0) return null;

    if (windows.length === 1) {
        return node.Node.window(windows[0].entity);
    }

    const tolerance = 5 * ext.dpi;
    const first_rect = windows[0].rect();
    const is_stacked = windows.every(w => {
        const r = w.rect();
        return (
            Math.abs(r.x - first_rect.x) <= tolerance &&
            Math.abs(r.y - first_rect.y) <= tolerance &&
            Math.abs(r.width - first_rect.width) <= tolerance &&
            Math.abs(r.height - first_rect.height) <= tolerance
        );
    });

    if (is_stacked) {
        const stacked_windows = sort_by_stacking(windows);
        const primary = stacked_windows[0];
        const active_window = stacked_windows[stacked_windows.length - 1];

        const stack_idx = tiler.forest.stacks.insert(new Stack(ext, active_window.entity, workspace, monitor));
        const stack_node = node.Node.stacked(primary.entity, stack_idx);
        const inner = stack_node.inner as node.NodeStack;
        for (let i = 1; i < stacked_windows.length; i++) {
            inner.entities.push(stacked_windows[i].entity);
        }

        const container = tiler.forest.stacks.get(stack_idx);
        if (container) {
            const tab_height = stack.TAB_HEIGHT * ext.dpi;
            const content_rect = area.clone();
            content_rect.y += tab_height;
            content_rect.height -= tab_height;
            inner.rect = content_rect;

            for (const win of stacked_windows) {
                win.stack = stack_idx;
                container.add(win);
            }
            container.update_positions(content_rect);
            container.activate(active_window.entity);
        }
        return stack_node;
    }

    // Try a horizontal split (left/right groups)
    const sorted_x = [...windows].sort((a, b) => {
        const ra = a.meta.get_frame_rect();
        const rb = b.meta.get_frame_rect();
        return ra.x + ra.width / 2 - (rb.x + rb.width / 2);
    });

    for (let i = 0; i < sorted_x.length - 1; i++) {
        const left_group = sorted_x.slice(0, i + 1);
        const right_group = sorted_x.slice(i + 1);

        const max_right = Math.max(...left_group.map(w => {
            const r = w.meta.get_frame_rect();
            return r.x + r.width;
        }));
        const min_left = Math.min(...right_group.map(w => w.meta.get_frame_rect().x));

        if (max_right <= min_left + tolerance) {
            const split = (max_right + min_left) / 2;

            const area_left = area.clone();
            area_left.width = split - area.x;

            const area_right = area.clone();
            area_right.x = split;
            area_right.width = area.x + area.width - split;

            const left_node = subtree(ext, tiler, monitor, workspace, left_group, area_left);
            const right_node = subtree(ext, tiler, monitor, workspace, right_group, area_right);

            if (left_node && right_node) {
                const [fork_entity, fork] = tiler.forest.create_fork(left_node, right_node, area, workspace, monitor);
                fork.orientation = lib.Orientation.HORIZONTAL;
                fork.set_ratio(area_left.width);
                fork.prev_ratio = fork.length_left / fork.length();
                link_children(ext, tiler, fork_entity, left_node, right_node);
                return node.Node.fork(fork_entity);
            }
        }
    }

    // Try a vertical split (top/bottom groups)
    const sorted_y = [...windows].sort((a, b) => {
        const ra = a.meta.get_frame_rect();
        const rb = b.meta.get_frame_rect();
        return ra.y + ra.height / 2 - (rb.y + rb.height / 2);
    });

    for (let i = 0; i < sorted_y.length - 1; i++) {
        const top_group = sorted_y.slice(0, i + 1);
        const bottom_group = sorted_y.slice(i + 1);

        const max_bottom = Math.max(...top_group.map(w => {
            const r = w.meta.get_frame_rect();
            return r.y + r.height;
        }));
        const min_top = Math.min(...bottom_group.map(w => w.meta.get_frame_rect().y));

        if (max_bottom <= min_top + tolerance) {
            const split = (max_bottom + min_top) / 2;

            const area_top = area.clone();
            area_top.height = split - area.y;

            const area_bottom = area.clone();
            area_bottom.y = split;
            area_bottom.height = area.y + area.height - split;

            const top_node = subtree(ext, tiler, monitor, workspace, top_group, area_top);
            const bottom_node = subtree(ext, tiler, monitor, workspace, bottom_group, area_bottom);

            if (top_node && bottom_node) {
                const [fork_entity, fork] = tiler.forest.create_fork(top_node, bottom_node, area, workspace, monitor);
                fork.orientation = lib.Orientation.VERTICAL;
                fork.set_ratio(area_top.height);
                fork.prev_ratio = fork.length_left / fork.length();
                link_children(ext, tiler, fork_entity, top_node, bottom_node);
                return node.Node.fork(fork_entity);
            }
        }
    }

    log.warn(`BSP reconstruction: no clean split found for ${windows.length} windows, falling back to sequential tiling`);
    for (const win of windows) {
        tiler.auto_tile(ext, win, true);
    }
    return null;
}

function link_children(
    ext: Ext,
    tiler: AutoTiler,
    fork_entity: Entity,
    ...children: node.Node[]
) {
    for (const child of children) {
        switch (child.inner.kind) {
            case 1:
                tiler.forest.parents.insert(child.inner.entity, fork_entity);
                break;
            case 2:
                ext.on_tile_attach(fork_entity, child.inner.entity);
                break;
            case 3:
                for (const ent of child.inner.entities) {
                    ext.on_tile_attach(fork_entity, ent);
                }
                break;
        }
    }
}