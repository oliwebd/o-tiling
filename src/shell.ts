import Meta from 'gi://Meta';

export function monitor_neighbor_index(which: number, direction: Meta.DisplayDirection): number | null {
    const neighbor: number = (global as any).display.get_monitor_neighbor_index(which, direction);
    return neighbor < 0 ? null : neighbor;
}
