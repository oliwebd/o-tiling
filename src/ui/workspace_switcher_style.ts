import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import { PACKAGE_VERSION } from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Utils from '../utils/utils.js';
import * as log from '../utils/log.js';
import type { Ext } from '../extension.js';


// ── Version gate ─────────────────────────────────────────────────────────────

/** Returns true when running on GNOME Shell 48 or newer (horizontal overview). */
export function isGnome50(): boolean {
    try {
        const major = parseInt(PACKAGE_VERSION.split('.')[0], 10);
        return major >= 48;
    } catch (_) {
        return true;
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
function buildCss(accentColor: string): string {
    const thumbnailCornerRadius = 10;
    const activeColor = (accentColor === 'auto' || !Utils.isValidColor(accentColor))
        ? '#3584e4'
        : accentColor;

    return `.workspace-thumbnails,.thumbnails-box,.workspace-thumbnails-container{background-color:transparent !important;background:transparent !important;}.workspace-thumbnails{padding:12px 16px;spacing:12px;border-radius:0px;border:none !important;}.workspace-thumbnail{border-radius:${thumbnailCornerRadius}px !important;border:3px solid transparent;}.workspace-thumbnail-background{border-radius:${thumbnailCornerRadius}px !important;background-color:transparent;}.workspace-thumbnail:focus,.workspace-thumbnail.selected{border-color:${activeColor} !important;border-width:3px !important;border-radius:${thumbnailCornerRadius}px !important;}.workspace-thumbnail:hover{border-color:rgba(255,255,255,0.25) !important;background-color:rgba(255,255,255,0.06);border-radius:${thumbnailCornerRadius}px !important;}.workspace-label{color:rgba(255,255,255,0.85);font-size:12px;font-weight:600;text-align:center;padding-top:6px;}`;
}


// ── WorkspaceSwitcherStyle ────────────────────────────────────────────────────

export class WorkspaceSwitcherStyle {
    private _file: Gio.File | null = null;
    private _accentColor: string;
    private _blurEffect: any = null;
    private _origMaxThumbnailScale: number | null = null;
    private _origMinThumbnailScale: number | null = null;
    private _workspaceChangedId: number | null = null;
    private _workspaceAddedId: number | null = null;
    private _workspaceRemovedId: number | null = null;
    private _overviewShowingId: number | null = null;
    private _origUpdateMaxThumbnailScale: any = null;
    private _origUpdateBorderRadius: any = null;


    constructor(
        accentColor: string,
    ) {
        this._accentColor = accentColor;
    }

    /** Injects custom CSS into the Shell theme. No-op if already enabled. */
    enable(): void {
        if (this._file) return;

        const css = buildCss(this._accentColor);
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
                this._setupAutoScroll();
            } else {
                log.warn('WorkspaceSwitcherStyle: could not find theme to load stylesheet');
                this._file = null;
            }
        } catch (e) {
            log.error(`WorkspaceSwitcherStyle: failed to load CSS: ${e}`);
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
            log.warn(`WorkspaceSwitcherStyle: failed to apply blur effect: ${e}`);
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
        const ov = (Main as any).overview;
        if (!ov) return null;

        // GNOME 45+ (including 50)
        if (ov._overviewControls?._thumbnailsBox) {
            log.debug('WorkspaceSwitcherStyle: found thumbnailsBox in _overviewControls');
            return ov._overviewControls._thumbnailsBox;
        }

        // Fallbacks for older/different layouts
        const manager = ov._overviewControls || ov._controls || ov._overview?._controls;
        const box = manager?._thumbnailsBox || manager?._controls?._thumbnailsBox || null;
        if (box) log.debug('WorkspaceSwitcherStyle: found thumbnailsBox via fallback manager');
        else log.debug('WorkspaceSwitcherStyle: could NOT find thumbnailsBox');
        return box;
    }

    private _getPreferredScale(): number {
        const monitor = (Main as any).layoutManager.primaryMonitor;
        const availWidth = monitor.width - 64; // Account for safe margins
        const nWorkspaces = (global as any).workspace_manager.n_workspaces;
        if (nWorkspaces <= 0) return 0.15;

        const aspectRatio = monitor.width / monitor.height;
        if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return 0.15;

        const spacing = 12; // Matching CSS spacing

        // Calculate scale based on hardcoded 15% preference
        let scale = 15 / 100;

        // Calculate total width if we used the preferred scale
        const preferredWidth = (monitor.height * scale * aspectRatio + spacing) * nWorkspaces - spacing;

        if (preferredWidth > availWidth) {
            // Shrink scale so all thumbnails fit on screen
            const maxThumbWidth = (availWidth + spacing) / nWorkspaces - spacing;
            scale = (maxThumbWidth / aspectRatio) / monitor.height;
            // Minimum usable scale
            scale = Math.max(scale, 0.02);
        }

        if (!Number.isFinite(scale)) return 0.15;
        return scale;
    }

    /**
     * Applies the percentage-based scale to ThumbnailsBox.
     * Patches the instance's _updateMaxThumbnailScale to ensure it's sticky.
     */
    private _applyThumbnailScale(): void {
        if (!isGnome50()) return;
        try {
            const thumbnailsBox = this._getThumbnailsBox();
            if (!thumbnailsBox) return;

            // 1. Center the thumbnails strip horizontally
            thumbnailsBox.set_x_expand(false);
            thumbnailsBox.set_x_align(Clutter.ActorAlign.CENTER);

            const parent = thumbnailsBox.get_parent();
            if (parent) {
                parent.set_x_expand(true);
                parent.set_x_align(Clutter.ActorAlign.FILL);
            }

            // 2. Patch the update method so Shell can't override our scale
            if (!this._origUpdateMaxThumbnailScale && typeof thumbnailsBox._updateMaxThumbnailScale === 'function') {
                log.debug('WorkspaceSwitcherStyle: patching ThumbnailsBox._updateMaxThumbnailScale');
                this._origUpdateMaxThumbnailScale = thumbnailsBox._updateMaxThumbnailScale;

                const self = this;
                thumbnailsBox._updateMaxThumbnailScale = function (this: any, ...args: any[]) {
                    // Call original to let Shell do its thing (calculating its own internal _maxThumbnailScale)
                    self._origUpdateMaxThumbnailScale.apply(this, args);

                    // Then override with our preferred scale
                    const scale = self._getPreferredScale();
                    this._maxThumbnailScale = scale;
                    this._minThumbnailScale = scale;

                    log.debug(`WorkspaceSwitcherStyle: enforced thumbnail scale ${scale}`);

                    // Ensure alignment is also enforced during updates
                    this.set_x_expand(false);
                    this.set_x_align(Clutter.ActorAlign.CENTER);

                    this.queue_relayout();
                };
            }

            // Initial force update
            const scale = this._getPreferredScale();
            if (this._origMaxThumbnailScale === null) {
                this._origMaxThumbnailScale = thumbnailsBox._maxThumbnailScale ?? null;
            }
            if (this._origMinThumbnailScale === null) {
                this._origMinThumbnailScale = thumbnailsBox._minThumbnailScale ?? null;
            }

            thumbnailsBox._maxThumbnailScale = scale;
            thumbnailsBox._minThumbnailScale = scale;

            // Force a layout update
            thumbnailsBox.queue_relayout?.();
            thumbnailsBox.get_parent()?.queue_relayout?.();
        } catch (e) {
            log.warn(`WorkspaceSwitcherStyle: failed to set thumbnail scale: ${e}`);
        }
    }


    /** Restores the original _maxThumbnailScale on disable. */
    private _restoreThumbnailScale(): void {
        if (!isGnome50()) return;
        try {
            const thumbnailsBox = this._getThumbnailsBox();
            if (thumbnailsBox) {
                if (this._origUpdateMaxThumbnailScale) {
                    thumbnailsBox._updateMaxThumbnailScale = this._origUpdateMaxThumbnailScale;
                    this._origUpdateMaxThumbnailScale = null;
                }

                if (this._origMaxThumbnailScale !== null)
                    thumbnailsBox._maxThumbnailScale = this._origMaxThumbnailScale;
                if (this._origMinThumbnailScale !== null)
                    thumbnailsBox._minThumbnailScale = this._origMinThumbnailScale;

                // Restore alignment
                thumbnailsBox.set_x_expand(true);
                thumbnailsBox.set_x_align(Clutter.ActorAlign.FILL);

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
        });
        this._workspaceRemovedId = workspace_manager.connect('workspace-removed', () => {
            this._applyThumbnailScale();
        });

        // 2. Rescale when overview shows (ensures state is fresh)
        this._overviewShowingId = Main.overview.connect('showing', () => {
            this._applyThumbnailScale();
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

            // Guard: if the child hasn't been allocated yet, its allocation box
            // will contain INT_MIN sentinel values (-2147483648) which propagate
            // NaN through StDrawingArea / StBin allocation assertions.
            if (!child.has_allocation?.() && typeof child.has_allocation === 'function') return;

            const box = child.get_allocation_box();

            // Sanity-check: reject sentinel / unallocated boxes
            if (!Number.isFinite(box.x1) || !Number.isFinite(box.x2) ||
                box.x1 < -1e9 || box.x2 < -1e9) return;

            const childCenter = (box.x1 + box.x2) / 2;

            const scroll = thumbnailsBox.get_parent();
            if (!scroll || !scroll.get_hadjustment) return;

            const adjustment = scroll.get_hadjustment();
            const pageSize = adjustment.page_size;
            if (!Number.isFinite(pageSize) || pageSize <= 0) return;

            adjustment.value = childCenter - pageSize / 2;
        } catch (e) {
            log.warn(`WorkspaceSwitcherStyle: _scrollToActiveWorkspace failed: ${e}`);
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
