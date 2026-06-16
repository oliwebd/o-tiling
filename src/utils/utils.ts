import * as result from './result.js';
import * as error from './error.js';
import * as log from './log.js';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
const { Ok, Err } = result;
const { Error } = error;

export function is_wayland(): boolean {
    // GNOME 50 removed Meta.is_wayland_compositor() — use global.context first,
    // fall back to the old Meta API, then fall back to environment detection.
    if (typeof (global as any).context?.is_wayland_compositor === 'function') {
        return (global as any).context.is_wayland_compositor();
    }
    if (typeof (Meta as any).is_wayland_compositor === 'function') {
        return (Meta as any).is_wayland_compositor();
    }
    // Last resort: Wayland sessions have WAYLAND_DISPLAY set but no DISPLAY.
    return GLib.getenv('WAYLAND_DISPLAY') !== null && GLib.getenv('DISPLAY') === null;
}

export function block_signal(object: GObject.Object, signal: SignalID) {
    GObject.signal_handler_block(object, signal);
}

export function unblock_signal(object: GObject.Object, signal: SignalID) {
    GObject.signal_handler_unblock(object, signal);
}

export function read_to_string(path: string): Promise<result.Result<string, error.Error>> {
    const file = Gio.File.new_for_path(path);
    return new Promise((resolve) => {
        file.load_contents_async(null, (obj: any, res: any) => {
            try {
                const [ok, contents] = obj.load_contents_finish(res);
                if (ok) {
                    resolve(Ok(new TextDecoder().decode(contents)));
                } else {
                    resolve(Err(new Error(`failed to load contents of ${path}`)));
                }
            } catch (e) {
                resolve(Err(new Error(String(e)).context(`failed to load contents of ${path}`)));
            }
        });
    });
}

export function source_remove(id: number | null): boolean {
    if (id === null || id <= 0) return false;
    try {
        GLib.source_remove(id);
        return true;
    } catch (e) {
        console.warn(`source_remove: failed to remove source ${id}:`, e);
        return false;
    }
}

export function exists(path: string): boolean {
    return Gio.File.new_for_path(path).query_exists(null);
}

/**
 * Parse the current background color's darkness
 * https://stackoverflow.com/a/41491220 - the advanced solution
 * @param color - the RGBA or hex string value
 */
export function is_dark(color: string): boolean {
    // 'rgba(251, 184, 108, 1)' - pop orange!
    let color_val = '';
    let r = 255;
    let g = 255;
    let b = 255;

    // handle rgba(255,255,255,1.0) format
    if (color.indexOf('rgb') >= 0) {
        // starts with parsed value from Gdk.RGBA
        color = color.replace('rgba', 'rgb').replace('rgb(', '').replace(')', ''); // make it 255, 255, 255, 1
        // log.debug(`util color: ${color}`);
        const colors = color.split(',');
        r = parseInt(colors[0].trim());
        g = parseInt(colors[1].trim());
        b = parseInt(colors[2].trim());
    } else if (color.charAt(0) === '#') {
        color_val = color.substring(1, 7);
        r = parseInt(color_val.substring(0, 2), 16); // hexToR
        g = parseInt(color_val.substring(2, 4), 16); // hexToG
        b = parseInt(color_val.substring(4, 6), 16); // hexToB
    }

    const uicolors = [r / 255, g / 255, b / 255];
    const c = uicolors.map((col) => {
        if (col <= 0.03928) {
            return col / 12.92;
        }
        return Math.pow((col + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return L <= 0.179;
}

/** Utility function for running a process in the background and fetching its standard output as a string. */
export function async_process(argv: Array<string>, input = null, cancellable: null | any = null): Promise<string> {
    let flags = Gio.SubprocessFlags.STDOUT_PIPE;

    if (input !== null) flags |= Gio.SubprocessFlags.STDIN_PIPE;

    const proc = new Gio.Subprocess({ argv, flags });
    proc.init(cancellable);

    proc.wait_async(null, (source: any, res: any) => {
        source.wait_finish(res);
        if (cancellable !== null) {
            cancellable.cancel();
        }
    });

    return new Promise((resolve, reject) => {
        proc.communicate_utf8_async(input, cancellable, (proc: any, res: any) => {
            try {
                const bytes = proc.communicate_utf8_finish(res)[1];
                resolve(bytes.toString());
            } catch (e) {
                reject(e);
            }
        });
    });
}

export type AsyncIPC = {
    child: any;
    stdout: any;
    stdin: any;
    cancellable: any;
};

export function async_process_ipc(argv: Array<string>): AsyncIPC | null {
    const { SubprocessLauncher, SubprocessFlags } = Gio;

    const launcher = new SubprocessLauncher({
        flags: SubprocessFlags.STDIN_PIPE | SubprocessFlags.STDOUT_PIPE,
    });

    let child: any;

    const cancellable = new Gio.Cancellable();

    try {
        child = launcher.spawnv(argv);
    } catch (why) {
        log.error(`failed to spawn ${argv}: ${why}`);
        return null;
    }

    const stdin = new Gio.DataOutputStream({
        base_stream: child.get_stdin_pipe(),
        close_base_stream: true,
    });

    const stdout = new Gio.DataInputStream({
        base_stream: child.get_stdout_pipe(),
        close_base_stream: true,
    });

    child.wait_async(null, (source: any, res: any) => {
        source.wait_finish(res);
        cancellable.cancel();
    });

    return { child, stdin, stdout, cancellable };
}

export function map_eq<K, V>(map1: Map<K, V>, map2: Map<K, V>) {
    if (map1.size !== map2.size) {
        return false;
    }

    let cmp;

    for (const [key, val] of map1) {
        cmp = map2.get(key);
        if (cmp !== val || (cmp === undefined && !map2.has(key))) {
            return false;
        }
    }

    return true;
}


export function maximize(
    window: Meta.Window,
    flags: number = 3 // Meta.MaximizeFlags.BOTH
) {
    if (typeof (window as any).set_maximize_flags === 'function') {
        (window as any).set_maximize_flags(flags);
        (window as any).maximize();
    } else {
        if ((window as any).maximize.length === 0) {
            (window as any).maximize();
        } else {
            try {
                (window as any).maximize(flags);
            } catch (e) {
                (window as any).maximize();
            }
        }
    }
}

export function unmaximize(
    window: Meta.Window,
    flags: number = 3 // Meta.MaximizeFlags.BOTH
) {
    if (typeof (window as any).set_unmaximize_flags === 'function') {
        (window as any).set_unmaximize_flags(flags);
        (window as any).unmaximize();
    } else {
        if ((window as any).unmaximize.length === 0) {
            (window as any).unmaximize();
        } else {
            try {
                (window as any).unmaximize(flags);
            } catch (e) {
                (window as any).unmaximize();
            }
        }
    }
}

export function is_maximized(window: Meta.Window): boolean {
    if (typeof (window as any).is_maximized === 'function') {
        return (window as any).is_maximized();
    }
    return (window as any).maximized_horizontally || (window as any).maximized_vertically;
}

/**
 * Sets the alpha component of a color string (rgba or hex).
 * Returns the modified color string.
 */
export function set_alpha(color: string, alpha: number): string {
    if (!color) return `rgba(53, 132, 228, ${alpha})`;

    // Handle rgba(r, g, b, a)
    if (color.startsWith('rgba')) {
        return color.replace(/,[\s]*[\d.]+\)$/, `, ${alpha})`);
    } else if (color.startsWith('rgb')) {
        return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
    } else if (color.startsWith('#')) {
        let r = 255,
            g = 255,
            b = 255;
        const color_val = color.substring(1);
        if (color_val.length === 3) {
            r = parseInt(color_val[0] + color_val[0], 16);
            g = parseInt(color_val[1] + color_val[1], 16);
            b = parseInt(color_val[2] + color_val[2], 16);
        } else if (color_val.length >= 6) {
            r = parseInt(color_val.substring(0, 2), 16);
            g = parseInt(color_val.substring(2, 4), 16);
            b = parseInt(color_val.substring(4, 6), 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    // If it's a named color or something we can't parse, we can't easily set alpha
    // unless we use a temporary actor to parse it, which is overkill here.
    // We'll return it as is, but log a warning if it's not a standard format.
    return color;
}
/**
 * Checks if a string is a valid color (hex, rgb, or rgba).
 * This avoids depending on Clutter.Color or Gdk.RGBA for basic validation.
 */
export function isValidColor(color: string): boolean {
    if (!color) return false;
    
    // Hex: #abc or #abcdef or #abcdef00
    if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) {
        return true;
    }
    
    // RGB/RGBA: rgb(255, 255, 255) or rgba(255, 255, 255, 1.0)
    // We're being a bit lenient with the spaces and decimals
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/i.test(color)) {
        return true;
    }
    
    return false;
}

/**
 * Schedules a callback to be executed later, handling GNOME 45+ API changes.
 */
export function later_add(type: Meta.LaterType, action: () => boolean | number): number {
    const laters = (global as any).compositor?.get_laters?.();
    if (laters && typeof laters.add === 'function') {
        return laters.add(type, action);
    }
    if (typeof (Meta as any).later_add === 'function') {
        return (Meta as any).later_add(type, action);
    }
    // Last-resort safe fallback: GLib idle
    return GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        action();
        return GLib.SOURCE_REMOVE;
    }) as any;
}

/**
 * Removes a scheduled callback, handling GNOME 45+ API changes.
 */
export function later_remove(id: number) {
    if (!id) return;
    const laters = (global as any).compositor?.get_laters?.();
    if (laters && typeof laters.remove === 'function') {
        laters.remove(id);
        return;
    }
    if (typeof (Meta as any).later_remove === 'function') {
        (Meta as any).later_remove(id);
        return;
    }
    GLib.source_remove(id);
}

/**
 * Gets a safe timestamp for Mutter/X11 operations.
 * Prioritizes Clutter event time to avoid synchronous roundtrips.
 */
export function get_current_time(): number {
    const time = Clutter.get_current_event_time();
    // 0 (CurrentTime) is safe; avoid get_current_time() — it's a blocking X11 roundtrip.
    return time;
}

/**
 * Safely activates a window using a non-blocking timestamp.
 */
export function activate_window(window: Meta.Window, move_mouse: boolean = true) {
    if (!window || window.is_override_redirect()) return;
    
    try {
        const time = get_current_time();
        if (typeof (window as any).activate === 'function') {
            (window as any).activate(time);
        } else {
            // Fallback for older Mutter or specific window types
            window.foreach_transient((transient) => {
                transient.activate(time);
                return false;
            });
            window.activate(time);
        }
    } catch (e) {
        // Log error but don't crash the shell
        const log = (global as any).log;
        if (log) log(`o-tiling: failed to activate window: ${e}`);
    }
}
