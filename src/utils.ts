import * as result from './result.js';
import * as error from './error.js';
import * as log from './log.js';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import GObject from 'gi://GObject';
const { Ok, Err } = result;
const { Error } = error;

export function is_wayland(): boolean {
    // GNOME 49/50+ favors or requires Wayland; our targets are Wayland-native
    return Meta.is_wayland_compositor();
}


export function block_signal(object: GObject.Object, signal: SignalID) {
    GObject.signal_handler_block(object, signal);
}

export function unblock_signal(object: GObject.Object, signal: SignalID) {
    GObject.signal_handler_unblock(object, signal);
}

export function read_to_string(path: string): result.Result<string, error.Error> {
    const file = Gio.File.new_for_path(path);
    try {
        const [ok, contents] = file.load_contents(null);
        if (ok) {
            return Ok(new TextDecoder().decode(contents));
        } else {
            return Err(new Error(`failed to load contents of ${path}`));
        }
    } catch (e) {
        return Err(new Error(String(e)).context(`failed to load contents of ${path}`));
    }
}

export function source_remove(id: SignalID): boolean {
    return GLib.source_remove(id) as any;
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
        let colors = color.split(',');
        r = parseInt(colors[0].trim());
        g = parseInt(colors[1].trim());
        b = parseInt(colors[2].trim());
    } else if (color.charAt(0) === '#') {
        color_val = color.substring(1, 7);
        r = parseInt(color_val.substring(0, 2), 16); // hexToR
        g = parseInt(color_val.substring(2, 4), 16); // hexToG
        b = parseInt(color_val.substring(4, 6), 16); // hexToB
    }

    let uicolors = [r / 255, g / 255, b / 255];
    let c = uicolors.map((col) => {
        if (col <= 0.03928) {
            return col / 12.92;
        }
        return Math.pow((col + 0.055) / 1.055, 2.4);
    });
    let L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return L <= 0.179;
}

/** Utility function for running a process in the background and fetching its standard output as a string. */
export function async_process(argv: Array<string>, input = null, cancellable: null | any = null): Promise<string> {
    let flags = Gio.SubprocessFlags.STDOUT_PIPE;

    if (input !== null) flags |= Gio.SubprocessFlags.STDIN_PIPE;

    let proc = new Gio.Subprocess({ argv, flags });
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
                let bytes = proc.communicate_utf8_finish(res)[1];
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

    let cancellable = new Gio.Cancellable();

    try {
        child = launcher.spawnv(argv);
    } catch (why) {
        log.error(`failed to spawn ${argv}: ${why}`);
        return null;
    }

    let stdin = new Gio.DataOutputStream({
        base_stream: child.get_stdin_pipe(),
        close_base_stream: true,
    });

    let stdout = new Gio.DataInputStream({
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

    for (let [key, val] of map1) {
        cmp = map2.get(key);
        if (cmp !== val || (cmp === undefined && !map2.has(key))) {
            return false;
        }
    }

    return true;
}

export function os_release(): null | string {
    const [ok, bytes] = GLib.file_get_contents('/etc/os-release');
    if (!ok) return null;

    const contents: string = new TextDecoder().decode(bytes);
    for (const line of contents.split('\n')) {
        if (line.startsWith('VERSION_ID')) {
            return line.split('"')[1];
        }
    }

    return null;
}
export function maximize(
    window: Meta.Window,
    flags: number = 3 // Meta.MaximizeFlags.BOTH
) {
    if (typeof (window as any).set_maximize_flags === 'function') {
        (window as any).set_maximize_flags(flags);
        (window as any).maximize();
    } else {
        try {
            (window as any).maximize(flags);
        } catch {
            (window as any).maximize();
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
        try {
            (window as any).unmaximize(flags);
        } catch {
            (window as any).unmaximize();
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
        let color_val = color.substring(1);
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
    const laters = (global as any).compositor?.get_laters();
    if (laters) {
        return laters.add(type, action);
    }
    return (Meta as any).later_add(type, action);
}

/**
 * Removes a scheduled callback, handling GNOME 45+ API changes.
 */
export function later_remove(id: number) {
    if (!id) return;
    const laters = (global as any).compositor?.get_laters();
    if (laters) {
        laters.remove(id);
    } else {
        (Meta as any).later_remove(id);
    }
}
