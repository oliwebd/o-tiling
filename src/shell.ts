import Meta from 'gi://Meta';

export function monitor_neighbor_index(which: number, direction: Meta.DisplayDirection): number | null {
    try {
        const neighbor: number = (global as any).display.get_monitor_neighbor_index(which, direction);
        return neighbor < 0 ? null : neighbor;
    } catch (e) {
        // Fallback for GNOME 50 when get_monitor_neighbor_index is removed
        const mm = (global as any).backend.get_monitor_manager();
        if (!mm) return null;

        const monitors = mm.get_logical_monitors();
        const current = monitors.find((m: any) => m.get_number() === which);
        if (!current) return null;

        let closest: any = null;
        let min_dist = Infinity;

        for (const m of monitors) {
            if (m.get_number() === which) continue;

            let is_adjacent = false;
            let dist = Infinity;

            switch (direction) {
                case Meta.DisplayDirection.UP:
                    is_adjacent = false;
                    is_adjacent = m.y + m.height === current.y;
                    if (is_adjacent) dist = Math.abs(m.x - current.x);
                    break;
                case Meta.DisplayDirection.DOWN:
                    is_adjacent = false;
                    is_adjacent = current.y + current.height === m.y;
                    if (is_adjacent) dist = Math.abs(m.x - current.x);
                    break;
                case Meta.DisplayDirection.LEFT:
                    is_adjacent = false;
                    is_adjacent = m.x + m.width === current.x;
                    if (is_adjacent) dist = Math.abs(m.y - current.y);
                    break;
                case Meta.DisplayDirection.RIGHT:
                    is_adjacent = false;
                    is_adjacent = current.x + current.width === m.x;
                    if (is_adjacent) dist = Math.abs(m.y - current.y);
                    break;
            }

            if (is_adjacent && dist < min_dist) {
                min_dist = dist;
                closest = m;
            }
        }

        return closest ? closest.get_number() : null;
    }
}
