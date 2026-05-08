import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import { PACKAGE_VERSION } from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Utils from '../utils/utils.js';

// ── Version gate ─────────────────────────────────────────────────────────────

/** Returns true when running on GNOME Shell 50 or newer. */
export function isGnome50(): boolean {
    try {
        const major = parseInt(PACKAGE_VERSION.split('.')[0], 10);
        return major >= 50;
    } catch (_) {
        return false;
    }
}

// ── CSS builder ──────────────────────────────────────────────────────────────

/**
 * Builds the full CSS string for the workspace switcher bar.
 *
 * Targets confirmed GNOME 50 selectors:
 *   .workspace-thumbnails         – the horizontal strip container
 *   .workspace-thumbnail          – individual workspace preview cards
 *   .workspace-thumbnail:focus    – active / focused card
 */
function buildCss(accentColor: string, thumbnailCornerRadius: number, bgCornerSize: number): string {
    // Determine the effective accent color; fallback to GNOME blue if 'auto' or invalid.
    const activeColor = (accentColor === 'auto' || !Utils.isValidColor(accentColor))
        ? '#3584e4'
        : accentColor;

    return `
/* === O-Tiling: COSMIC-style Workspace Switcher (GNOME 50) === */

.workspace-thumbnails,
.thumbnails-box,
.workspace-thumbnails-container {
    background-color: transparent !important;
    background: transparent !important;
}

.workspace-thumbnails {
    padding: 12px 16px;
    spacing: 12px;
    border-radius: 0px;
    border: none !important;
}

/* Individual workspace card */
.workspace-thumbnail {
    border-radius: ${thumbnailCornerRadius}px !important;
    border: 3px solid transparent;
    transition-duration: 200ms;
}

.workspace-thumbnail-background {
    border-radius: ${thumbnailCornerRadius}px !important;
    /* Do NOT set background-color here — it hides the wallpaper render.
       Leave it transparent so the actual workspace wallpaper shows through. */
    background-color: transparent;
}

/* Active card gets accent color border */
.workspace-thumbnail:focus,
.workspace-thumbnail.selected {
    border-color: ${activeColor} !important;
    border-width: 3px !important;
}

/* Hover state */
.workspace-thumbnail:hover {
    border-color: rgba(255, 255, 255, 0.25) !important;
    background-color: rgba(255, 255, 255, 0.06);
}

/* Workspace label always visible below each card */
.workspace-label {
    color: rgba(255, 255, 255, 0.85);
    font-size: 12px;
    font-weight: 600;
    text-align: center;
    padding-top: 6px;
}

/* Overview workspace background corner */
.workspace-background,
.workspace-background-content,
.workspace-background-bin {
    border-radius: ${bgCornerSize}px !important;
}
`;
}


// ── WorkspaceSwitcherStyle ────────────────────────────────────────────────────

export class WorkspaceSwitcherStyle {
    private _file: Gio.File | null = null;
    private _accentColor: string;
    private _thumbnailCornerRadius: number;
    private _switcherSize: number;      // percent (5-25)
    private _bgCornerSize: number;       // pixels (0-60)
    private _blurEffect: any = null;
    private _origMaxThumbnailScale: number | null = null;
    private _origMinThumbnailScale: number | null = null;
    private _workspaceChangedId: number | null = null;
    private _workspaceAddedId: number | null = null;
    private _workspaceRemovedId: number | null = null;
    private _overviewShowingId: number | null = null;

    constructor(
        accentColor: string,
        thumbnailCornerRadius: number,
        switcherSize: number,
        bgCornerSize: number,
    ) {
        this._accentColor = accentColor;
        this._thumbnailCornerRadius = thumbnailCornerRadius;
        this._switcherSize = switcherSize;
        this._bgCornerSize = bgCornerSize;
    }

    /** Injects custom CSS into the Shell theme. No-op if already enabled. */
    enable(): void {
        if (this._file) return;

        const css = buildCss(this._accentColor, this._thumbnailCornerRadius, this._bgCornerSize);
        const path = `/tmp/o-tiling-ws-style-${GLib.get_monotonic_time()}.css`;

        try {
            GLib.file_set_contents(path, css);
            this._file = Gio.File.new_for_path(path);
            const theme = St.ThemeContext.get_for_stage(
                (global as any).stage as Clutter.Stage,
            ).get_theme() as any;

            if (theme) {
                theme.load_stylesheet(this._file);
                this._applyBlur();
                this._applyThumbnailScale();
                this._applyBackgroundCorners();
                this._setupAutoScroll();
            } else {
                console.warn('WorkspaceSwitcherStyle: could not find theme to load stylesheet');
                this._file = null;
            }
        } catch (e) {
            console.error('WorkspaceSwitcherStyle: failed to load CSS', e);
            this._file = null;
        }
    }

    /** Removes the injected CSS from the Shell theme. */
    disable(): void {
        this._teardownAutoScroll();
        if (!this._file) return;

        try {
            const theme = St.ThemeContext.get_for_stage(
                (global as any).stage as Clutter.Stage,
            ).get_theme() as any;

            if (theme) {
                theme.unload_stylesheet(this._file);
                this._removeBlur();
                this._restoreThumbnailScale();
                this._restoreBackgroundCorners();
                this._teardownSignals();
            }
            this._file.delete(null);
        } catch (_) { /* best-effort */ }

        this._file = null;
    }

    /** Hot-updates the accent colour. */
    updateAccentColor(rgba: string): void {
        this._accentColor = rgba;
        this._refresh();
    }


    /** Hot-updates the thumbnail corner radius. */
    updateThumbnailCornerRadius(radius: number): void {
        this._thumbnailCornerRadius = radius;
        this._refresh();
    }

    /** Hot-updates the workspace switcher size (percentage). */
    updateSwitcherSize(percent: number): void {
        this._switcherSize = percent;
        this._applyThumbnailScale();
    }

    /** Hot-updates the workspace background corner radius. */
    updateBgCornerSize(px: number): void {
        this._bgCornerSize = px;
        this._applyBackgroundCorners();
        this._refresh();
    }

    private _refresh(): void {
        if (this._file) {
            this.disable();
            this.enable();
        }
    }

    /** True while the CSS is currently injected. */
    get isEnabled(): boolean {
        return this._file !== null;
    }

    private _applyBlur(): void {
        // Disabled to keep the switcher fully transparent as requested.
        /*
        if (!isGnome50()) return;

        try {
            const thumbnailsBox = this._getThumbnailsBox();
            if (thumbnailsBox && !this._blurEffect) {
                this._blurEffect = new Shell.BlurEffect({
                    brightness: 0.6,
                    radius: 60,
                    mode: Shell.BlurMode.BACKGROUND,
                });
                thumbnailsBox.add_effect_with_name('o-tiling-blur', this._blurEffect);
            }
        } catch (e) {
            console.warn('WorkspaceSwitcherStyle: failed to apply blur effect', e);
        }
        */
    }

    private _removeBlur(): void {
        if (this._blurEffect) {
            try {
                const thumbnailsBox = this._getThumbnailsBox();
                if (thumbnailsBox) {
                    thumbnailsBox.remove_effect_by_name('o-tiling-blur');
                }
            } catch (_) { }
            this._blurEffect = null;
        }
    }

    private _getThumbnailsBox(): any {
        return (Main as any).overview?._controls?._thumbnailsBox ||
            (Main as any).overview?._overview?._controls?._thumbnailsBox ||
            null;
    }

    /**
     * Applies the percentage-based scale to ThumbnailsBox._maxThumbnailScale,
     * mirroring what Just Perfection's workspaceSwitcherSetSize() does.
     */
    private _applyThumbnailScale(): void {
        if (!isGnome50()) return;
        try {
            const thumbnailsBox = this._getThumbnailsBox();
            if (!thumbnailsBox) return;

            // 1. Center the thumbnails strip horizontally
            // Setting x_expand to false allows the box to take its natural width,
            // while x_align CENTER centers that width within the parent.
            thumbnailsBox.set_x_expand(false);
            thumbnailsBox.set_x_align(Clutter.ActorAlign.CENTER);

            const parent = thumbnailsBox.get_parent();
            if (parent) {
                parent.set_x_expand(true);
                parent.set_x_align(Clutter.ActorAlign.FILL); 
            }

            // 2. Dynamic scale calculation ("Auto Small") to fit all thumbnails
            const monitor = (Main as any).layoutManager.primaryMonitor;
            if (!monitor) return;

            const availWidth = monitor.width - 64; // Account for safe margins
            const nWorkspaces = (global as any).workspace_manager.n_workspaces;
            const aspectRatio = monitor.width / monitor.height;
            const spacing = 12; // Matching CSS spacing

            // Calculate scale based on user preference
            let scale = this._switcherSize / 100;

            // Calculate total width if we used the preferred scale
            const preferredWidth = (monitor.height * scale * aspectRatio + spacing) * nWorkspaces - spacing;

            if (preferredWidth > availWidth) {
                // Shrink scale so all thumbnails fit on screen
                const maxThumbWidth = (availWidth + spacing) / nWorkspaces - spacing;
                scale = (maxThumbWidth / aspectRatio) / monitor.height;
                // Minimum usable scale
                scale = Math.max(scale, 0.02); // Allow very small thumbnails if many workspaces
            }

            if (this._origMaxThumbnailScale === null) {
                this._origMaxThumbnailScale = thumbnailsBox._maxThumbnailScale ?? null;
            }
            if (this._origMinThumbnailScale === null) {
                this._origMinThumbnailScale = thumbnailsBox._minThumbnailScale ?? null;
            }

            // Overriding both ensures it can shrink below default 0.05
            thumbnailsBox._maxThumbnailScale = scale;
            thumbnailsBox._minThumbnailScale = scale;

            // Force a layout update
            thumbnailsBox.queue_relayout?.();
            thumbnailsBox.get_parent()?.queue_relayout?.();
        } catch (e) {
            console.warn('WorkspaceSwitcherStyle: failed to set thumbnail scale', e);
        }
    }

    /** Restores the original _maxThumbnailScale on disable. */
    private _restoreThumbnailScale(): void {
        if (!isGnome50()) return;
        try {
            const thumbnailsBox = this._getThumbnailsBox();
            if (thumbnailsBox) {
                if (this._origMaxThumbnailScale !== null)
                    thumbnailsBox._maxThumbnailScale = this._origMaxThumbnailScale;
                if (this._origMinThumbnailScale !== null)
                    thumbnailsBox._minThumbnailScale = this._origMinThumbnailScale;

                thumbnailsBox.queue_relayout?.();
            }
        } catch (_) { }
        this._origMaxThumbnailScale = null;
        this._origMinThumbnailScale = null;
    }

    private _getWorkspacesDisplay(): any {
        return (Main as any).overview?._controls?._workspacesDisplay ||
            (Main as any).overview?._overview?._controls?._workspacesDisplay ||
            null;
    }

    private _applyBackgroundCorners(): void {
        const radius = this._bgCornerSize;
        const workspacesDisplay = this._getWorkspacesDisplay();
        if (!workspacesDisplay) return;

        const views = workspacesDisplay._workspacesViews || [];
        for (const view of views) {
            const workspaces = view._workspaces || [];
            for (const ws of workspaces) {
                const bg = ws._background;
                if (bg) {
                    bg.clip_to_allocation = radius > 0;
                }
            }
        }
    }

    private _restoreBackgroundCorners(): void {
        const workspacesDisplay = this._getWorkspacesDisplay();
        if (!workspacesDisplay) return;

        const views = workspacesDisplay._workspacesViews || [];
        for (const view of views) {
            const workspaces = view._workspaces || [];
            for (const ws of workspaces) {
                const bg = ws._background;
                if (bg) {
                    bg.clip_to_allocation = false;
                }
            }
        }
    }

    private _setupAutoScroll(): void {
        const workspace_manager = (global as any).workspace_manager;
        this._workspaceChangedId = workspace_manager.connect('active-workspace-changed', () => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._scrollToActiveWorkspace();
                return GLib.SOURCE_REMOVE;
            });
        });

        // 1. Rescale when workspaces are added/removed
        this._workspaceAddedId = workspace_manager.connect('workspace-added', () => {
            this._applyThumbnailScale();
            this._applyBackgroundCorners();
        });
        this._workspaceRemovedId = workspace_manager.connect('workspace-removed', () => {
            this._applyThumbnailScale();
            this._applyBackgroundCorners();
        });

        // 2. Rescale when overview shows (ensures state is fresh)
        this._overviewShowingId = Main.overview.connect('showing', () => {
            this._applyThumbnailScale();
            this._applyBackgroundCorners();
        });
    }

    private _scrollToActiveWorkspace(): void {
        try {
            const thumbnailsBox = this._getThumbnailsBox();
            if (!thumbnailsBox) return;

            const workspace_manager = (global as any).workspace_manager;
            const activeIndex = workspace_manager.get_active_workspace_index();

            if (typeof thumbnailsBox._scrollToActive === 'function') {
                thumbnailsBox._scrollToActive();
                return;
            }

            const children = thumbnailsBox.get_children();
            const child = children[activeIndex];
            if (!child) return;

            const box = child.get_allocation_box();
            const childCenter = (box.x1 + box.x2) / 2;

            const scroll = thumbnailsBox.get_parent();
            if (!scroll || !scroll.get_hadjustment) return;

            const adjustment = scroll.get_hadjustment();
            const pageSize = adjustment.page_size;
            adjustment.value = childCenter - pageSize / 2;
        } catch (e) {
            console.warn('WorkspaceSwitcherStyle: _scrollToActiveWorkspace failed', e);
        }
    }

    private _teardownSignals(): void {
        this._teardownAutoScroll();
    }

    private _teardownAutoScroll(): void {
        const workspace_manager = (global as any).workspace_manager;

        if (this._workspaceChangedId !== null) {
            workspace_manager.disconnect(this._workspaceChangedId);
            this._workspaceChangedId = null;
        }
        if (this._workspaceAddedId !== null) {
            workspace_manager.disconnect(this._workspaceAddedId);
            this._workspaceAddedId = null;
        }
        if (this._workspaceRemovedId !== null) {
            workspace_manager.disconnect(this._workspaceRemovedId);
            this._workspaceRemovedId = null;
        }
        if (this._overviewShowingId !== null) {
            Main.overview.disconnect(this._overviewShowingId);
            this._overviewShowingId = null;
        }
    }
}
