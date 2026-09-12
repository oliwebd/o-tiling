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

/** Reconstruct a tiling layout for all windows on a single [monitor, workspace] using BSP tree inspection. */
export function reconstruct_workspace(
    tiler: AutoTiler,
    ext: Ext,
    monitor: number,
    workspace: number,
    windows: ShellWindow[],
    maximized: ShellWindow[] = [],
) {
    if (windows.length === 0) return;

    const full_area = ext.monitor_work_area(monitor);
    if (!ext.settings.smart_gaps()) {
        full_area.x += ext.gap_outer;
        full_area.y += ext.gap_top;
        full_area.width -= ext.gap_outer * 2;
        full_area.height -= ext.gap_outer + ext.gap_top;
    }

    if (maximized.length > 0) {
        const visible_bounds = bounding_rect(windows);
        const complement = complement_rect(full_area, visible_bounds);

        // A clean complement rect means the visible window(s) occupy a region that spans the
        // full height or width of the monitor, leaving a well-defined rectangular gap — exactly
        // what a maximized sibling's slot looks like. Reserve that slot for it (as a real leaf in
        // the tree, at the *toplevel*'s full-monitor area) rather than dropping it: this way,
        // when it unmaximizes, on_maximize() finds its fork already in place and restores it
        // directly, instead of falling back to auto_tile()'s focus/largest-window heuristics.
        //
        // We deliberately don't reposition the maximized window itself here — it stays visually
        // maximized (Mutter won't move a maximized window regardless of what geometry its fork
        // records), exactly as it would if it had never lost its slot during a live session.
        if (complement) {
            const visible_node = subtree(ext, tiler, monitor, workspace, windows, visible_bounds);

            if (visible_node) {
                const maximized_node = node.Node.window(maximized[0].entity);

                const [first_node, first_area, second_node] = complement.visible_first
                    ? [visible_node, visible_bounds, maximized_node]
                    : [maximized_node, complement.rect, visible_node];

                const [fork_entity, fork] = tiler.forest.create_fork(first_node, second_node, full_area, workspace, monitor);
                fork.orientation = complement.orientation;
                fork.set_ratio(complement.orientation === lib.Orientation.HORIZONTAL ? first_area.width : first_area.height);
                fork.prev_ratio = fork.length_left / fork.length();
                fork.is_toplevel = true;
                tiler.forest.toplevel.set(`${fork_entity}`, [fork_entity, [monitor, workspace]]);

                link_children(ext, tiler, fork_entity, first_node, second_node);
                return;
            }
        }

        // No clean complement (e.g. more than one maximized sibling, or an irregular layout we
        // can't safely reserve a slot for). Fall back to sizing the visible windows to their own
        // current bounding area — not perfect, but safer than stretching them across space that
        // isn't really theirs.
        reconstruct_visible(tiler, ext, monitor, workspace, windows, visible_bounds);
        return;
    }

    reconstruct_visible(tiler, ext, monitor, workspace, windows, full_area);
}

/** Builds the tree for `windows` alone within `area`, with no maximized sibling to account for. */
function reconstruct_visible(
    tiler: AutoTiler,
    ext: Ext,
    monitor: number,
    workspace: number,
    windows: ShellWindow[],
    area: Rectangle,
) {
    if (windows.length === 1) {
        tiler.attach_to_area(ext, windows[0], [monitor, workspace], area, ext.settings.smart_gaps());
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

    if (all_stacked) {
        const primary = windows[0];
        const stack_idx = tiler.forest.stacks.insert(new Stack(ext, primary.entity, workspace, monitor));
        const stack_node = node.Node.stacked(primary.entity, stack_idx);
        const inner = stack_node.inner as node.NodeStack;
        for (let i = 1; i < windows.length; i++) {
            inner.entities.push(windows[i].entity);
        }

        const [fork_entity, fork] = tiler.forest.create_fork(stack_node, null, area.clone(), workspace, monitor);
        fork.is_toplevel = true;
        tiler.forest.toplevel.set(`${fork_entity}`, [fork_entity, [monitor, workspace]]);

        for (const ent of inner.entities) {
            ext.on_tile_attach(fork_entity, ent);
        }

        populate_stack_tabs(tiler, ext, inner, primary);
        return;
    }

    const root_node = subtree(ext, tiler, monitor, workspace, windows, area);
    if (root_node && root_node.inner.kind === 1) {
        const root_fork_entity = root_node.inner.entity;
        const root_fork = tiler.forest.forks.get(root_fork_entity);
        if (root_fork) {
            root_fork.is_toplevel = true;
            tiler.forest.toplevel.set(`${root_fork_entity}`, [root_fork_entity, [monitor, workspace]]);
        }
    }
}

interface Complement {
    rect: Rectangle;
    orientation: lib.Orientation;
    /** True if the visible windows' bounding box is the left/top side of the split. */
    visible_first: boolean;
}

/**
 * If `inner` spans the full height or width of `outer`, returns the rectangle representing
 * whatever's left of `outer` after removing `inner` — this is the slot a maximized sibling
 * would occupy if it unmaximized right now without anything else moving. Returns null if the
 * leftover space isn't a clean rectangle (e.g. `inner` doesn't touch a full edge of `outer`).
 */
function complement_rect(outer: Rectangle, inner: Rectangle): Complement | null {
    const tolerance = 2;

    const spans_full_height =
        Math.abs(inner.y - outer.y) <= tolerance &&
        Math.abs(inner.y + inner.height - (outer.y + outer.height)) <= tolerance;

    const spans_full_width =
        Math.abs(inner.x - outer.x) <= tolerance &&
        Math.abs(inner.x + inner.width - (outer.x + outer.width)) <= tolerance;

    if (spans_full_height && inner.width < outer.width - tolerance) {
        const inner_on_left = Math.abs(inner.x - outer.x) <= tolerance;
        const rect = inner_on_left
            ? new Rectangle([inner.x + inner.width, outer.y, outer.width - inner.width, outer.height])
            : new Rectangle([outer.x, outer.y, outer.width - inner.width, outer.height]);

        return { rect, orientation: lib.Orientation.HORIZONTAL, visible_first: inner_on_left };
    }

    if (spans_full_width && inner.height < outer.height - tolerance) {
        const inner_on_top = Math.abs(inner.y - outer.y) <= tolerance;
        const rect = inner_on_top
            ? new Rectangle([outer.x, inner.y + inner.height, outer.width, outer.height - inner.height])
            : new Rectangle([outer.x, outer.y, outer.width, outer.height - inner.height]);

        return { rect, orientation: lib.Orientation.VERTICAL, visible_first: inner_on_top };
    }

    return null;
}

function populate_stack_tabs(
    tiler: AutoTiler,
    ext: Ext,
    inner: node.NodeStack,
    primary: ShellWindow,
) {
    inner.rect = primary.rect();
    tiler.update_stack(ext, inner);
}

/**
 * The smallest rectangle that contains the current frame rects of all given windows. Used in
 * place of the full monitor work area when a [monitor, workspace] also has a maximized/fullscreen
 * sibling: the visible windows only ever occupied part of the screen, and we must not stretch
 * them into the space the maximized sibling is still logically holding onto.
 */
function bounding_rect(windows: ShellWindow[]): Rectangle {
    const rects = windows.map(w => w.meta.get_frame_rect());

    const x = Math.min(...rects.map(r => r.x));
    const y = Math.min(...rects.map(r => r.y));
    const right = Math.max(...rects.map(r => r.x + r.width));
    const bottom = Math.max(...rects.map(r => r.y + r.height));

    return new Rectangle([x, y, right - x, bottom - y]);
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
        const primary = windows[0];
        const stack_idx = tiler.forest.stacks.insert(new Stack(ext, primary.entity, workspace, monitor));
        const stack_node = node.Node.stacked(primary.entity, stack_idx);
        const inner = stack_node.inner as node.NodeStack;
        for (let i = 1; i < windows.length; i++) {
            inner.entities.push(windows[i].entity);
        }

        populate_stack_tabs(tiler, ext, inner, primary);
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