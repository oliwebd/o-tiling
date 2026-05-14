import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import * as log from '../utils/log.js';
import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Shell from 'gi://Shell';
import Clutter from 'gi://Clutter';

function buildWorkspaceBgCss(): string {
    return `

/* Search bar styling in overview */
.search-entry {
    background-color: rgba(0, 0, 0, 0.35) !important;
    border-radius: 12px !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    color: white !important;
}

.search-entry:focus {
    background-color: rgba(0, 0, 0, 0.5) !important;
}

/* ── Shell UI frosted-glass layer (complements Shell.BlurEffect) ── */

/* Overview controls panel background */
.overview-controls,
.controls-manager {
    background-color: rgba(0, 0, 0, 0.18) !important;
}

/* Workspace thumbnails strip — completely transparent */
.workspace-thumbnails,
.thumbnails-box,
.workspace-thumbnails-container {
    background-color: transparent !important;
}

/* Individual thumbnail cards — slight tint */
.workspace-thumbnail {
    background-color: rgba(255, 255, 255, 0.04) !important;
}

/* App grid / dash area */
.dash-background {
    background-color: rgba(0, 0, 0, 0.30) !important;
    border-radius: 16px !important;
}

/* Window picker caption */
.window-caption {
    background-color: rgba(0, 0, 0, 0.55) !important;
    border-radius: 8px !important;
    color: rgba(255, 255, 255, 0.90) !important;
}

/* ── Search results — frosted-glass backgrounds ── */

/* Search result section cards (the rounded containers) */
.search-section-content {
    background-color: rgba(0, 0, 0, 0.25) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 24px !important;
}

/* List and Grid search results */
.list-search-result,
.grid-search-result,
.search-provider-icon {
    background-color: transparent !important;
    border-radius: 16px !important;
    transition: background-color 0.2s ease !important;
}

.list-search-result:hover,
.grid-search-result:hover,
.search-provider-icon:hover {
    background-color: rgba(255, 255, 255, 0.08) !important;
}

/* Selection / Focus / Active states — replace solid blue with frosted selection */
.list-search-result:selected,
.list-search-result:focus,
.list-search-result:active,
.grid-search-result:selected,
.grid-search-result:focus,
.grid-search-result:active,
.search-provider-icon:selected,
.search-provider-icon:focus,
.search-provider-icon:active {
    background-color: rgba(255, 255, 255, 0.14) !important;
    color: white !important;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
}

/* Search status text */
.search-statustext {
    color: rgba(255, 255, 255, 0.7) !important;
}

/* ── App folder dialog — frosted-glass ── */
.app-folder-dialog {
    background-color: rgba(0, 0, 0, 0.20) !important;
    border-radius: 32px !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
}

.app-folder-dialog .folder-name-entry {
    background-color: transparent !important;
}

.app-folder-dialog .folder-name-label {
    color: rgba(255, 255, 255, 0.9) !important;
}

/* App folder dialog scrim (the dimming overlay behind the dialog) */
.app-folder-dialog-container {
    background-color: transparent !important;
}

/* Closed app folder icon */
.app-folder,
.app-folder-icon,
.overview-icon.app-folder {
    background-color: rgba(0, 0, 0, 0.2) !important;
    border-radius: 18px !important;
}
`;
}

/**
 * Manages the aesthetic of a "Full Screen" overview with:
 *   1. Wallpaper background blur  — Shell.BlurEffect on the overview controls actor
 *   2. Shell UI blur              — Shell.BlurEffect on the workspace-thumbnails box
 *      so the thumbnails themselves appear over a blurred background
 */
export class OverviewWallpaperStyle {
    private _file: Gio.File | null = null;
    private _shellUIBlurEffect: any = null;    // blur behind thumbnails strip (shell blur)
    private _signals: number[] = [];
    private _bgManagers: any[] = [];
    private _bgActors: Clutter.Actor[] = [];

    constructor() { }

    enable(): void {
        if (this._file) return;

        const css = buildWorkspaceBgCss();
        const path = `/tmp/o-tiling-overview-bg-${GLib.get_monotonic_time()}.css`;

        try {
            GLib.file_set_contents(path, css);
            this._file = Gio.File.new_for_path(path);
            const theme = St.ThemeContext.get_for_stage(
                (global as any).stage as Clutter.Stage,
            ).get_theme() as any;

            if (theme) {
                theme.load_stylesheet(this._file);
                this._patchAppFolderDialog();
                this._setupBlurSignals();

                // If overview is already open, apply immediately
                if (Main.overview.visible || (Main.overview as any).showing) {
                    this._applyBackgroundBlur();
                    this._applyShellUIBlur();
                }
            }
        } catch (e) {
            log.error(`OverviewWallpaperStyle: failed to load CSS: ${e}`);
        }
    }

    disable(): void {
        if (!this._file) return;

        try {
            const theme = St.ThemeContext.get_for_stage(
                (global as any).stage as Clutter.Stage,
            ).get_theme() as any;

            if (theme) {
                theme.unload_stylesheet(this._file);
            }
            if (this._file.query_exists(null)) {
                this._file.delete(null);
            }
            this._unpatchAppFolderDialog();
            this._removeBackgroundBlur();
            this._removeShellUIBlur();
        } catch (_) { /* best-effort cleanup */ }

        this._file = null;
        this._signals.forEach(id => Main.overview.disconnect(id));
        this._signals = [];
    }

    // ── Private ──────────────────────────────────────────────────────────────

    private _patchAppFolderDialog(): void {
        const { AppFolderDialog } = AppDisplay as any;
        if (!AppFolderDialog) {
            log.warn('OverviewWallpaperStyle: AppFolderDialog not found in AppDisplay');
            return;
        }

        const proto = AppFolderDialog.prototype as any;
        if (!proto._o_tiling_patched) {
            const origOpen = proto.open;
            proto._o_tiling_orig_open = origOpen;
            proto.open = function (this: any, ...args: any[]) {
                if (origOpen) origOpen.apply(this, args);
                
                if (!this._blurEffect) {
                    try {
                        this._blurEffect = new Shell.BlurEffect();
                        (this._blurEffect as any).brightness = 0.55;

                        const blurMode = (Shell as any).BlurMode;
                        if (blurMode !== undefined && 'mode' in this._blurEffect) {
                            this._blurEffect.mode = blurMode.BACKGROUND ?? 1;
                        }

                        const sigma = 30;
                        if ('radius' in this._blurEffect) {
                            this._blurEffect.radius = sigma * 2;
                        } else if ('sigma' in this._blurEffect) {
                            this._blurEffect.sigma = sigma;
                        }

                        // Apply to the main dialog actor for full coverage
                        const target = this;
                        target.add_effect_with_name('o-tiling-appfolder-blur', this._blurEffect);
                        log.info('OverviewWallpaperStyle: Applied high-quality blur to AppFolderDialog');
                    } catch (e) {
                        log.warn(`OverviewWallpaperStyle: Failed to apply blur to AppFolderDialog: ${e}`);
                    }
                }
            };
            proto._o_tiling_patched = true;
        }
    }

    private _setupBlurSignals(): void {
        this._signals.push(Main.overview.connect('showing', () => {
            this._applyBackgroundBlur();
            this._applyShellUIBlur();
        }));
        this._signals.push(Main.overview.connect('hiding', () => {
            this._removeBackgroundBlur();
            this._removeShellUIBlur();
        }));
    }

    // ── Wallpaper blur (using BackgroundManager like Blur my Shell) ───────────

    private _applyBackgroundBlur(): void {
        if (this._bgActors.length > 0) return;

        const sigma = 20;

        try {
            for (let i = 0; i < Main.layoutManager.monitors.length; i++) {
                const monitor = Main.layoutManager.monitors[i];

                // Guard against zero-dimension monitors (e.g. during hotplug)
                if (!monitor || monitor.width < 1 || monitor.height < 1) continue;

                const bgActor = new St.Widget({
                    x: monitor.x,
                    y: monitor.y,
                    width: monitor.width,
                    height: monitor.height
                });

                const bgManager = new (Background as any).BackgroundManager({
                    container: bgActor,
                    monitorIndex: i,
                    controlPosition: false,
                });

                const blurEffect = new Shell.BlurEffect();
                (blurEffect as any).brightness = 0.85;

                const blurMode = (Shell as any).BlurMode;
                if (blurMode !== undefined && 'mode' in (blurEffect as any)) {
                    (blurEffect as any).mode = blurMode.ACTOR ?? 0;
                }

                if ('radius' in (blurEffect as any)) {
                    (blurEffect as any).radius = sigma * 2;
                } else if ('sigma' in (blurEffect as any)) {
                    (blurEffect as any).sigma = sigma;
                }

                bgActor.add_effect_with_name('o-tiling-overview-blur', blurEffect);
                Main.layoutManager.overviewGroup.insert_child_at_index(bgActor, 0);

                this._bgActors.push(bgActor);
                this._bgManagers.push(bgManager);
            }
        } catch (e) {
            log.warn(`OverviewWallpaperStyle: bg blur failed: ${e}`);
            this._removeBackgroundBlur();
        }
    }

    private _removeBackgroundBlur(): void {
        this._bgManagers.forEach(m => m.destroy());
        this._bgManagers = [];

        this._bgActors.forEach(a => {
            if (a.get_parent()) {
                a.get_parent()?.remove_child(a);
            }
            a.destroy();
        });
        this._bgActors = [];
    }

    // ── Shell UI blur (behind workspace-thumbnails strip) ─────────────────

    private _getThumbnailsBox(): Clutter.Actor | null {
        const ov = (Main as any).overview;
        if (!ov) return null;

        // GNOME 50+
        if (ov._overviewControls?._thumbnailsBox)
            return ov._overviewControls._thumbnailsBox;

        const mgr = ov._overviewControls || ov._controls || ov._overview?._controls;
        return mgr?._thumbnailsBox ?? mgr?._controls?._thumbnailsBox ?? null;
    }

    private _applyShellUIBlur(): void {
        if (this._shellUIBlurEffect) return;

        try {
            this._shellUIBlurEffect = new Shell.BlurEffect();
            (this._shellUIBlurEffect as any).brightness = 0.75;

            const blurMode = (Shell as any).BlurMode;
            if (blurMode !== undefined && 'mode' in (this._shellUIBlurEffect as any)) {
                // BACKGROUND mode blurs what is behind the actor (the wallpaper)
                // giving a frosted-glass look to the thumbnails strip
                (this._shellUIBlurEffect as any).mode = blurMode.BACKGROUND ?? 1;
            }

            // Slightly stronger blur for the UI panel (40px radius)
            if ('radius' in (this._shellUIBlurEffect as any)) {
                (this._shellUIBlurEffect as any).radius = 40;
            } else if ('sigma' in (this._shellUIBlurEffect as any)) {
                (this._shellUIBlurEffect as any).sigma = 20;
            }

            const thumbnailsBox = this._getThumbnailsBox();
            if (thumbnailsBox) {
                thumbnailsBox.add_effect_with_name('o-tiling-shell-blur', this._shellUIBlurEffect);
                log.info('OverviewWallpaperStyle: shell UI blur applied to thumbnails box');
            } else {
                log.warn('OverviewWallpaperStyle: could not find thumbnails box for shell UI blur');
                this._shellUIBlurEffect = null;
            }
        } catch (e) {
            log.warn(`OverviewWallpaperStyle: shell UI blur failed: ${e}`);
            this._shellUIBlurEffect = null;
        }
    }

    private _removeShellUIBlur(): void {
        if (!this._shellUIBlurEffect) return;

        const thumbnailsBox = this._getThumbnailsBox();
        if (thumbnailsBox) {
            try { thumbnailsBox.remove_effect_by_name('o-tiling-shell-blur'); } catch (_) { }
        }
        try { this._shellUIBlurEffect.destroy?.(); } catch (_) { }
        this._shellUIBlurEffect = null;
    }

    private _unpatchAppFolderDialog(): void {
        const { AppFolderDialog } = AppDisplay as any;
        if (!AppFolderDialog) return;

        const proto = AppFolderDialog.prototype as any;
        if (proto._o_tiling_patched) {
            // Clean up blur effects on any live dialog instances
            try {
                const appDisplay = (Main as any).overview?._controls?._appDisplay
                    ?? (Main as any).overview?._overview?._controls?._appDisplay;
                const folders = appDisplay?._folderIcons;
                if (folders) {
                    for (const folder of folders) {
                        const dialog = folder?._dialog;
                        if (dialog?._blurEffect) {
                            // Clean up from both potential targets (legacy and new)
                            try { dialog.remove_effect_by_name('o-tiling-appfolder-blur'); } catch (_) { }
                            try { dialog._viewBox?.remove_effect_by_name('o-tiling-appfolder-blur'); } catch (_) { }
                            
                            try { dialog._blurEffect.destroy?.(); } catch (_) { }
                            dialog._blurEffect = null;
                        }
                    }
                }
            } catch (_) { /* best-effort cleanup of live instances */ }

            if (proto._o_tiling_orig_open) {
                proto.open = proto._o_tiling_orig_open;
            }
            delete proto._o_tiling_orig_open;
            delete proto._o_tiling_patched;
        }
    }
}
