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
    // GNOME 48+ runs exclusively as a Wayland compositor; XDG_SESSION_TYPE is
    // the canonical way to distinguish a Wayland session from XWayland/X11.
    return GLib.getenv('XDG_SESSION_TYPE') === 'wayland';
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
    GLib.source_remove(id);
    return true;
}

export function exists(path: string): boolean {
    return Gio.File.new_for_path(path).query_exists(null);
}

/** Checks if a color (RGBA/hex) is dark using relative luminance (HSP/WCAG formula). */
export function is_dark(color: string): boolean {
    let color_val = '';
    let r = 255;
    let g = 255;
    let b = 255;

    // Handle rgba(r,g,b,a) or rgb(r,g,b)
    if (color.indexOf('rgb') >= 0) {
        color = color.replace('rgba', 'rgb').replace('rgb(', '').replace(')', '');
        const colors = color.split(',');
        r = parseInt(colors[0].trim());
        g = parseInt(colors[1].trim());
        b = parseInt(colors[2].trim());
    } else if (color.charAt(0) === '#') {
        color_val = color.substring(1, 7);
        r = parseInt(color_val.substring(0, 2), 16);
        g = parseInt(color_val.substring(2, 4), 16);
        b = parseInt(color_val.substring(4, 6), 16);
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


// GNOME 48+: maximize/unmaximize always act on both axes.
export function maximize(window: Meta.Window) {
    window.maximize();
}

export function unmaximize(window: Meta.Window) {
    window.unmaximize();
}

export function is_maximized(window: Meta.Window): boolean {
    return window.maximized_horizontally || window.maximized_vertically;
}

/** Sets the alpha component of a color string (rgba or hex). */
export function set_alpha(color: string, alpha: number): string {
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
    
    // Named/unparseable colors are returned as-is (using a temp actor to parse alpha would be overkill).
    return color;
}
/** Checks if a string is a valid color (hex, rgb, rgba) using regex — no GI bindings required. */
export function isValidColor(color: string): boolean {
    // Hex: #abc or #abcdef or #abcdef00
    if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) {
        return true;
    }

    // RGB/RGBA: e.g. rgb(255, 255, 255) or rgba(255, 255, 255, 1.0) (lenient with spaces/decimals)
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/i.test(color)) {
        return true;
    }

    return false;
}

/** Schedules a callback before the next compositor redraw (GNOME 45+ API). */
export function later_add(type: Meta.LaterType, action: () => boolean | number): number {
    return (global as any).compositor.get_laters().add(type, action);
}

/** Removes a previously scheduled later callback (GNOME 45+ API). */
export function later_remove(id: number) {
    (global as any).compositor.get_laters().remove(id);
}

/** Activates a window that is not an override-redirect window. */
export function activate_window(window: Meta.Window) {
    // override-redirect windows don't participate in normal focus management
    if (window.is_override_redirect()) return;
    window.activate(Clutter.get_current_event_time());
}
