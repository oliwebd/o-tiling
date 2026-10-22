/** Plain session-local data: never retain Meta.Window, actors, signals or ECS entities. */
export type LayoutNode =
    | { kind: 'window'; id: number }
    | { kind: 'stack'; ids: number[]; active: number }
    | { kind: 'split'; horizontal: boolean; ratio: number; left: LayoutNode; right: LayoutNode };

export interface WorkArea { x: number; y: number; width: number; height: number }
export interface WorkspaceLayout {
    monitor: number;
    workspace: number;
    area: WorkArea;
    tree: LayoutNode;
}
export interface LayoutSnapshot {
    layouts: WorkspaceLayout[];
    floating: number[];
    forceTiled: number[];
}

export function sameArea(a: WorkArea, b: WorkArea): boolean {
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** Remove vanished/moved windows without changing surviving branch or tab order. */
export function pruneTree(tree: LayoutNode, available: ReadonlySet<number>): LayoutNode | null {
    switch (tree.kind) {
        case 'window': return available.has(tree.id) ? { ...tree } : null;
        case 'stack': {
            const ids = tree.ids.filter(id => available.has(id));
            if (!ids.length) return null;
            if (ids.length === 1) return { kind: 'window', id: ids[0] };
            return { kind: 'stack', ids, active: ids.includes(tree.active) ? tree.active : ids[0] };
        }
        case 'split': {
            const left = pruneTree(tree.left, available);
            const right = pruneTree(tree.right, available);
            return left && right ? { ...tree, left, right } : left ?? right;
        }
    }
}

export function snapshotIds(tree: LayoutNode | null): number[] {
    if (!tree) return [];
    if (tree.kind === 'window') return [tree.id];
    if (tree.kind === 'stack') return [...tree.ids];
    return [...snapshotIds(tree.left), ...snapshotIds(tree.right)];
}

/** A second lock can cancel the deferred restore; retain data until it completes. */
export class PendingLayout {
    private pending: LayoutSnapshot | null = null;

    peek(): LayoutSnapshot | null { return this.pending; }

    save(snapshot: LayoutSnapshot | null, locking: boolean): void {
        this.pending = locking ? snapshot ?? this.pending : null;
    }

    restored(snapshot: LayoutSnapshot | null): void {
        if (this.pending === snapshot) this.pending = null;
    }
}
