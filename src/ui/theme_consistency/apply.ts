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

        const updateCssFile = (path: string, newCss: string) => {
            const S = '/* === O-TILING START === */';
            const E = '/* === O-TILING END === */';
            let content = '';
            try {
                const [, bytes] = GLib.file_get_contents(path);
                content = new TextDecoder().decode(bytes);
            } catch (_) {}

            const startIndex = content.indexOf(S);
            const endIndex = content.indexOf(E);

            if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                content = content.slice(0, startIndex) + content.slice(endIndex + E.length);
            }

            content = content.trim() + '\n\n' + S + '\n' + newCss + '\n' + E + '\n';
            GLib.file_set_contents(path, content.trimStart());
        };

        updateCssFile(`${gtk4Dir}/gtk.css`, gtkCss);
        updateCssFile(`${gtk3Dir}/gtk.css`, gtkCss);
    } catch (e) {
        log.warn('Could not apply GTK theme consistency: ' + e);
    }
}
