import "@girs/gjs";
import "@girs/gjs/dom";
import "@girs/gnome-shell/ambient";
import "@girs/gnome-shell/extensions/global";

// ─── Global convenience types ──────────────────────────────────────────────
declare global {
    type SignalID = number;
    type WorkspaceID = number;
    type MonitorID = number;

    interface Rectangular {
        x: number;
        y: number;
        width: number;
        height: number;
    }

    namespace GObject {
        type SignalID = number;
    }

    const global: any;
    const log: (msg: string) => void;
    const print: (msg: string) => void;
    const printerr: (msg: string) => void;
    const imports: any;
    const ARGV: string[];
}

