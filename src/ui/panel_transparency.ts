import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as log from '../utils/log.js';

/**
 * PanelTransparencyManager
 *
 * Injects CSS to make the GNOME Shell panel transparent.
 * Works by loading a temporary stylesheet into the Shell theme context,
 * following the same pattern as WorkspaceSwitcherStyle and ThemeConsistencyManager.
 *
 * Supports:
 *  - Full transparency (opacity 0 background)
 *  - Semi-transparent blur-style background
 *  - Dynamic opacity level (0–100%)
 *  - Auto-restore on disable (EGO-compliant)
 */
export class PanelTransparencyManager {
    private _file: Gio.File | null = null;
    private _opacity: number;            // 0 = fully transparent, 100 = opaque
    private _blurStyle: boolean;         // true = add blur-like semi-dark backdrop

    constructor(opacity: number = 0, blurStyle: boolean = false) {
        this._opacity = Math.max(0, Math.min(100, opacity));
        this._blurStyle = blurStyle;
    }

    enable(): void {
        if (this._file) return;   // already enabled

        const css = this._buildCss();
        const path = `/tmp/o-tiling-panel-transparency-${GLib.get_monotonic_time()}.css`;

        try {
            GLib.file_set_contents(path, css);
            this._file = Gio.File.new_for_path(path);

            const theme = St.ThemeContext
                .get_for_stage((global as any).stage as Clutter.Stage)
                .get_theme() as any;

            if (theme) {
                theme.load_stylesheet(this._file);
                log.info('PanelTransparencyManager: panel CSS injected');
            } else {
                log.warn('PanelTransparencyManager: no theme to inject into');
                this._file = null;
            }
        } catch (e) {
            log.error(`PanelTransparencyManager: failed to inject CSS: ${e}`);
            this._file = null;
        }
    }

    disable(): void {
        if (!this._file) return;

        try {
            const theme = St.ThemeContext
                .get_for_stage((global as any).stage as Clutter.Stage)
                .get_theme() as any;

            if (theme) theme.unload_stylesheet(this._file);
            this._file.delete(null);
        } catch (_) { /* best-effort */ }

        this._file = null;
        log.info('PanelTransparencyManager: panel CSS removed');
    }

    get isEnabled(): boolean {
        return this._file !== null;
    }

    /** Hot-update opacity without full disable/enable cycle */
    updateOpacity(opacity: number): void {
        this._opacity = Math.max(0, Math.min(100, opacity));
        this._refresh();
    }

    updateBlurStyle(blur: boolean): void {
        this._blurStyle = blur;
        this._refresh();
    }

    // ── Private ────────────────────────────────────────────────────────────

    private _refresh(): void {
        if (this._file) {
            this.disable();
            this.enable();
        }
    }

    private _buildCss(): string {
        const alpha = (this._opacity / 100).toFixed(2);

        // blurStyle adds a very subtle dark gradient so text stays readable
        const bg = this._blurStyle
            ? `linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.25))`
            : `rgba(0, 0, 0, 0)`;

        return `
/* === O-Tiling: Panel Transparency === */

/* The main panel bar */
#panel {
    background-color: rgba(0, 0, 0, ${alpha}) !important;
    background-image: none !important;
    box-shadow: none !important;
    border-bottom: none !important;
    transition-duration: 200ms;
}

/* Panel buttons — keep them readable on transparent background */
#panel .panel-button {
    color: rgba(255, 255, 255, 0.92) !important;
    -natural-hpadding: 12px;
    -minimum-hpadding: 6px;
}

#panel .panel-button:hover,
#panel .panel-button:focus {
    background-color: rgba(255, 255, 255, 0.12) !important;
    border-radius: 8px;
}

#panel .panel-button:active {
    background-color: rgba(255, 255, 255, 0.20) !important;
}

/* Clock label */
#panel .clock {
    color: rgba(255, 255, 255, 0.92) !important;
    font-weight: 600;
}

/* System status area icons */
#panel .system-status-icon {
    color: rgba(255, 255, 255, 0.92) !important;
}

/* Blur-style backdrop (only applied when blurStyle = true) */
${this._blurStyle ? `
#panel {
    background-image: ${bg} !important;
}
` : ''}
`;
    }
}
