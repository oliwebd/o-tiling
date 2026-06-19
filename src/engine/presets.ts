import type { Ext } from '../extension.js';
import type { Entity } from '../core/ecs.js';
import { Fork } from './fork.js';
import * as Node from './node.js';
import { Rectangle } from '../utils/rectangle.js';
import * as Lib from '../utils/lib.js';

export enum PresetType {
    COLUMNS = 'columns',
    STACKED = 'stacked',
    GRID = 'grid',
    SPIRAL = 'spiral',
}

export function apply_preset(ext: Ext, preset: PresetType, workspace: number, monitor: number) {
    if (!ext.auto_tiler) return;

    // Get all windows currently tiled on this workspace
    const ws_windows = Array.from(ext.windows.values()).filter(
        w => w.known_workspace === workspace && ext.auto_tiler!.attached.contains(w.entity)
    );

    if (ws_windows.length < 2) return;

    // Sort by entity ID or their current coordinates to keep ordering stable
    ws_windows.sort((a, b) => a.rect().x - b.rect().x || a.rect().y - b.rect().y);

    const forest = ext.auto_tiler.forest;

    // 1. Detach all windows from current tree (but keep ignore_detach so they don't get unmanaged)
    for (const win of ws_windows) {
        win.ignore_detach = true;
        ext.auto_tiler.detach_window(ext, win.entity);
    }

    const area = ext.monitor_work_area(monitor);
    area.x += ext.gap_outer;
    area.y += ext.gap_top;
    area.width -= ext.gap_outer * 2;
    area.height -= ext.gap_outer + ext.gap_top;

    const entities = ws_windows.map(w => w.entity);

    // 2. Build the preset tree topology
    const [toplevel_entity, toplevel_fork] = build_topology(forest, preset, entities, area, workspace, monitor);

    // 3. Mark toplevel and set parents for all sub-forks
    if (toplevel_fork) {
        const sid = `${toplevel_entity}`;
        forest.string_reps.insert(toplevel_entity, sid);
        toplevel_fork.set_toplevel(forest, toplevel_entity, sid, [monitor, workspace]);

        // Register each window with its parent fork
        register_parents(forest, ext.auto_tiler.attached, toplevel_entity, toplevel_fork);

        // 4. Measure and Tile!
        forest.tile(ext, toplevel_fork, area);
    }

    for (const win of ws_windows) {
        win.ignore_detach = false;
    }
}

function register_parents(forest: any, attached: any, fork_entity: Entity, fork: Fork) {
    // Left branch
    if (fork.left.inner.kind === 1) {
        const left_fork = forest.forks.get(fork.left.inner.entity);
        if (left_fork) {
            forest.parents.insert(left_fork.entity, fork_entity);
            register_parents(forest, attached, left_fork.entity, left_fork);
        }
    } else if (fork.left.inner.kind === 2) {
        attached.insert(fork.left.inner.entity, fork_entity);
        forest.on_attach(fork_entity, fork.left.inner.entity);
    }

    // Right branch
    if (fork.right) {
        if (fork.right.inner.kind === 1) {
            const right_fork = forest.forks.get(fork.right.inner.entity);
            if (right_fork) {
                forest.parents.insert(right_fork.entity, fork_entity);
                register_parents(forest, attached, right_fork.entity, right_fork);
            }
        } else if (fork.right.inner.kind === 2) {
            attached.insert(fork.right.inner.entity, fork_entity);
            forest.on_attach(fork_entity, fork.right.inner.entity);
        }
    }
}

function build_topology(
    forest: any,
    preset: PresetType,
    entities: Array<Entity>,
    area: Rectangle,
    workspace: number,
    monitor: number
): [Entity, Fork] {
    if (entities.length === 2) {
        // Base case: 2 windows always split
        const left = Node.Node.window(entities[0]);
        const right = Node.Node.window(entities[1]);
        const orient = preset === PresetType.STACKED ? Lib.Orientation.VERTICAL : Lib.Orientation.HORIZONTAL;
        const [entity, fork] = forest.create_fork(left, right, area.clone(), workspace, monitor);
        fork.set_orientation(orient);
        return [entity, fork];
    }

    if (preset === PresetType.COLUMNS) {
        // Split HORIZONTAL recursively
        const left = Node.Node.window(entities[0]);
        const sub_area = area.clone();
        sub_area.width = (area.width * (entities.length - 1)) / entities.length;
        const [right_entity, _fork] = build_topology(forest, preset, entities.slice(1), sub_area, workspace, monitor);
        const right = Node.Node.fork(right_entity);
        const [entity, fork] = forest.create_fork(left, right, area.clone(), workspace, monitor);
        fork.set_orientation(Lib.Orientation.HORIZONTAL);
        return [entity, fork];
    }

    if (preset === PresetType.STACKED) {
        // Split VERTICAL recursively
        const left = Node.Node.window(entities[0]);
        const sub_area = area.clone();
        sub_area.height = (area.height * (entities.length - 1)) / entities.length;
        const [right_entity, _fork] = build_topology(forest, preset, entities.slice(1), sub_area, workspace, monitor);
        const right = Node.Node.fork(right_entity);
        const [entity, fork] = forest.create_fork(left, right, area.clone(), workspace, monitor);
        fork.set_orientation(Lib.Orientation.VERTICAL);
        return [entity, fork];
    }

    if (preset === PresetType.SPIRAL) {
        // Alternating orientations recursively
        const left = Node.Node.window(entities[0]);
        const sub_area = area.clone();
        const orient = entities.length % 2 === 0 ? Lib.Orientation.HORIZONTAL : Lib.Orientation.VERTICAL;
        if (orient === Lib.Orientation.HORIZONTAL) {
            sub_area.width = area.width / 2;
        } else {
            sub_area.height = area.height / 2;
        }
        const [right_entity, _fork] = build_topology(forest, preset, entities.slice(1), sub_area, workspace, monitor);
        const right = Node.Node.fork(right_entity);
        const [entity, fork] = forest.create_fork(left, right, area.clone(), workspace, monitor);
        fork.set_orientation(orient);
        return [entity, fork];
    }

    // PresetType.GRID
    // Dynamic Grid layout for 3 to 6 windows
    const len = entities.length;
    if (len === 3) {
        // 1 left (main), 2 right (vertical split)
        const left = Node.Node.window(entities[0]);
        const sub_area = area.clone();
        sub_area.width = area.width / 2;
        const [right_entity, _fork] = build_topology(forest, PresetType.STACKED, entities.slice(1), sub_area, workspace, monitor);
        const right = Node.Node.fork(right_entity);
        const [entity, fork] = forest.create_fork(left, right, area.clone(), workspace, monitor);
        fork.set_orientation(Lib.Orientation.HORIZONTAL);
        return [entity, fork];
    } else if (len === 4) {
        // 2x2 grid
        // Split horizontal, then split both left and right vertically
        const sub_area_l = area.clone();
        sub_area_l.width = area.width / 2;
        const [left_entity, _lfork] = build_topology(forest, PresetType.STACKED, entities.slice(0, 2), sub_area_l, workspace, monitor);
        const left = Node.Node.fork(left_entity);

        const sub_area_r = area.clone();
        sub_area_r.width = area.width / 2;
        const [right_entity, _rfork] = build_topology(forest, PresetType.STACKED, entities.slice(2, 4), sub_area_r, workspace, monitor);
        const right = Node.Node.fork(right_entity);

        const [entity, fork] = forest.create_fork(left, right, area.clone(), workspace, monitor);
        fork.set_orientation(Lib.Orientation.HORIZONTAL);
        return [entity, fork];
    } else if (len === 5) {
        // 2 left (vertical split), 3 right (grid or stacked)
        const sub_area_l = area.clone();
        sub_area_l.width = area.width / 2;
        const [left_entity, _lfork] = build_topology(forest, PresetType.STACKED, entities.slice(0, 2), sub_area_l, workspace, monitor);
        const left = Node.Node.fork(left_entity);

        const sub_area_r = area.clone();
        sub_area_r.width = area.width / 2;
        const [right_entity, _rfork] = build_topology(forest, PresetType.STACKED, entities.slice(2, 5), sub_area_r, workspace, monitor);
        const right = Node.Node.fork(right_entity);

        const [entity, fork] = forest.create_fork(left, right, area.clone(), workspace, monitor);
        fork.set_orientation(Lib.Orientation.HORIZONTAL);
        return [entity, fork];
    } else {
        // len === 6: 3 left (vertical), 3 right (vertical)
        const sub_area_l = area.clone();
        sub_area_l.width = area.width / 2;
        const [left_entity, _lfork] = build_topology(forest, PresetType.STACKED, entities.slice(0, 3), sub_area_l, workspace, monitor);
        const left = Node.Node.fork(left_entity);

        const sub_area_r = area.clone();
        sub_area_r.width = area.width / 2;
        const [right_entity, _rfork] = build_topology(forest, PresetType.STACKED, entities.slice(3, 6), sub_area_r, workspace, monitor);
        const right = Node.Node.fork(right_entity);

        const [entity, fork] = forest.create_fork(left, right, area.clone(), workspace, monitor);
        fork.set_orientation(Lib.Orientation.HORIZONTAL);
        return [entity, fork];
    }
}
