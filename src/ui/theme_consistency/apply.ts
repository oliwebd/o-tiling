import GLib from 'gi://GLib';
import * as log from '../../utils/log.js';
import { getGtkCss } from './gtk.js';

/**
 * Applies theme consistency CSS files to GTK.
 * This function is safe to call from the preferences process
 * (it does NOT import St or Clutter).
 *
 * BUG-02 fix: writes CSS files directly instead of using a shell script.
 * BUG-03 fix: passes plain strings to GLib.file_set_contents (not Uint8Array).
 */
export function applyThemeConsistency(style: 'rounded' | 'sharp' = 'rounded') {
    const gtkCss = getGtkCss(style);

    try {
        const gtk4Dir = GLib.get_home_dir() + '/.config/gtk-4.0';
        const gtk3Dir = GLib.get_home_dir() + '/.config/gtk-3.0';

        GLib.mkdir_with_parents(gtk4Dir, 0o755);
        GLib.mkdir_with_parents(gtk3Dir, 0o755);

        // GJS GLib.file_set_contents expects a plain string, NOT new TextEncoder().encode()
        GLib.file_set_contents(`${gtk4Dir}/gtk.css`, gtkCss);
        GLib.file_set_contents(`${gtk3Dir}/gtk.css`, gtkCss);
    } catch (e) {
        log.warn('Could not apply GTK theme consistency: ' + e);
    }
}
