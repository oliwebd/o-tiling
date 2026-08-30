import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as log from '../utils/log.js';

export class PanelTransparencyManager {
    private _file: Gio.File | null = null;
    private _opacity: number;            // 0 = fully transparent, 100 = opaque

    constructor(opacity: number = 0) {
        this._opacity = Math.max(0, Math.min(100, opacity));
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
                if (this._file && this._file.query_exists(null)) {
                    try {
                        this._file.delete(null);
                    } catch (err) {
                        log.warn(`Failed to delete temporary panel CSS file: ${err}`);
                    }
                }
                this._file = null;
            }
        } catch (e) {
            log.error(`PanelTransparencyManager: failed to inject CSS: ${e}`);
            if (this._file && this._file.query_exists(null)) {
                try {
                    this._file.delete(null);
                } catch (err) {
                    log.warn(`Failed to delete temporary panel CSS file: ${err}`);
                }
            }
            this._file = null;
        }
    }

    disable(): void {
        if (!this._file) return;

        const theme = St.ThemeContext
            .get_for_stage((global as any).stage as Clutter.Stage)
            .get_theme() as any;

        if (theme) {
            try {
                theme.unload_stylesheet(this._file);
            } catch (e) {
                log.warn(`Failed to unload panel stylesheet: ${e}`);
            }
        }

        if (this._file.query_exists(null)) {
            try {
                this._file.delete(null);
            } catch (e) {
                log.warn(`Failed to delete panel stylesheet file: ${e}`);
            }
        }

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

    // ── Private ────────────────────────────────────────────────────────────

    private _refresh(): void {
        if (this._file) {
            this.disable();
            this.enable();
        }
    }

    private _buildCss(): string {
        const alpha = (this._opacity / 100).toFixed(2);

        return `
/* === O-Tiling: Panel Transparency === */

/* The main panel bar */
#panel,
#panel.solid,
#panel:overview {
    background-color: rgba(0, 0, 0, ${alpha}) !important;
    background-image: none !important;
    box-shadow: none !important;
    border-bottom: none !important;
}

/* Panel buttons — keep them readable on transparent background */
#panel .panel-button {
    color: rgba(255, 255, 255, 0.92) !important;
}

/* Also clear any other child backgrounds to be safe */
#panel .panel-button:hover > *,
#panel .panel-button:focus > *,
#panel .panel-button:active > *,
#panel .panel-button:checked > * {
    background-color: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
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
`;
    }
}
