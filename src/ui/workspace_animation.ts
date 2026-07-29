import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as WorkspaceAnimation from 'resource:///org/gnome/shell/ui/workspaceAnimation.js';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';

export type AnimationStyle = 'slide' | 'swing' | 'none';

const SWING_OVERSHOOT = 0.12;
const SWING_OVERSHOOT_FRACTION = 0.55;

export class WorkspaceAnimationManager {
    private _style: AnimationStyle;
    private _enabled = false;

    private _origCreateBackground = (WorkspaceAnimation as any).WorkspaceBackground.prototype._createBackground;
    private _origEaseProperty = (WorkspaceAnimation as any).MonitorGroup.prototype.ease_property;
    private _origPrepareWorkspaceSwitch = (WorkspaceAnimation as any).WorkspaceAnimationController.prototype._prepareWorkspaceSwitch;

    // Pre-warmed BackgroundManagers keyed by monitor index, created at enable() time
    // so MetaBackgroundImageCache is hot before the first workspace switch.
    private _warmManagers: Map<number, { container: Meta.BackgroundGroup; manager: any }> = new Map();
    private _monitorsChangedId = 0;

    constructor(style: AnimationStyle = 'swing') {
        this._style = style;
    }

    enable(): void {
        if (this._enabled) return;
        this._enabled = true;

        (WorkspaceAnimation as any).WorkspaceBackground.prototype._createBackground = function (this: any) {
            this._bgManager = { destroy: () => {} };
        };

        this._warmBackgrounds();

        // Keep pre-warm set current when monitors change.
        this._monitorsChangedId = (global as any).backend.get_monitor_manager().connect(
            'monitors-changed',
            () => this._warmBackgrounds(),
        );

        this._patchStaticBackground();

        if (this._style === 'swing') this._patchSwing();
    }

    disable(): void {
        this._enabled = false;

        (WorkspaceAnimation as any).WorkspaceBackground.prototype._createBackground = this._origCreateBackground;
        (WorkspaceAnimation as any).MonitorGroup.prototype.ease_property = this._origEaseProperty;
        (WorkspaceAnimation as any).WorkspaceAnimationController.prototype._prepareWorkspaceSwitch = this._origPrepareWorkspaceSwitch;

        if (this._monitorsChangedId) {
            (global as any).backend.get_monitor_manager().disconnect(this._monitorsChangedId);
            this._monitorsChangedId = 0;
        }

        this._destroyWarmManagers();
    }

    setStyle(style: AnimationStyle): void {
        if (style === this._style) return;
        const wasEnabled = this._enabled;
        if (wasEnabled) this.disable();
        this._style = style;
        if (wasEnabled) this.enable();
    }

    get style(): AnimationStyle {
        return this._style;
    }

    get isEnabled(): boolean {
        return this._enabled;
    }

    /** Create one BackgroundManager per monitor so the texture cache is warm. */
    private _warmBackgrounds(): void {
        this._destroyWarmManagers();

        const monitors = Meta.prefs_get_workspaces_only_on_primary()
            ? [Main.layoutManager.primaryMonitor]
            : (Main.layoutManager as any).monitors;

        for (const monitor of monitors) {
            const container = new Meta.BackgroundGroup();
            const manager = new Background.BackgroundManager({
                container,
                monitorIndex: monitor.index,
                controlPosition: false,
            });
            this._warmManagers.set(monitor.index, { container, manager });
        }
    }

    private _destroyWarmManagers(): void {
        for (const { manager } of this._warmManagers.values()) {
            manager.destroy();
        }
        this._warmManagers.clear();
    }

    private _patchSwing(): void {
        const original = this._origEaseProperty;

        (WorkspaceAnimation as any).MonitorGroup.prototype.ease_property = function (
            this: any,
            propertyName: string,
            target: number,
            params: any,
        ) {
            if (propertyName !== 'progress') {
                original.call(this, propertyName, target, params);
                return;
            }

            const delta = target - this.progress;
            const overshootDuration = Math.round(params.duration * SWING_OVERSHOOT_FRACTION);
            const settleDuration = params.duration - overshootDuration;

            original.call(this, propertyName, target + delta * SWING_OVERSHOOT, {
                duration: overshootDuration,
                mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
                onComplete: () => {
                    original.call(this, propertyName, target, {
                        duration: settleDuration,
                        mode: Clutter.AnimationMode.EASE_IN_OUT_CUBIC,
                        onComplete: params.onComplete,
                    });
                },
            });
        };
    }

    private _patchStaticBackground(): void {
        const origPrepare = this._origPrepareWorkspaceSwitch;
        const warmManagers = this._warmManagers;

        (WorkspaceAnimation as any).WorkspaceAnimationController.prototype._prepareWorkspaceSwitch = function (
            this: any,
            ...args: any[]
        ) {
            origPrepare.apply(this, args);

            for (const monitorGroup of this._switchData.monitors) {
                if (monitorGroup._staticBackground) continue;

                const bgGroup = new Meta.BackgroundGroup();
                monitorGroup.insert_child_below(bgGroup, null);

                // Use the pre-warmed manager's background actor directly so the
                // texture is guaranteed loaded. Clone its actor into our group
                // rather than constructing a new BackgroundManager cold.
                const warm = warmManagers.get(monitorGroup.index);
                if (warm) {
                    const actor = warm.manager.backgroundActor;
                    if (actor) {
                        // Add a clone of the already-painted actor — zero async latency.
                        const clone = new Clutter.Clone({ source: actor, x_expand: true, y_expand: true });
                        bgGroup.add_child(clone);
                    }
                }

                // Also create a fresh manager so the group owns its own ref and
                // keeps updating if the wallpaper changes mid-session.
                const freshManager = new Background.BackgroundManager({
                    container: bgGroup,
                    monitorIndex: monitorGroup.index,
                    controlPosition: false,
                });

                monitorGroup._staticBackground = bgGroup;

                monitorGroup.connect('destroy', () => {
                    if (monitorGroup._staticBgManager) {
                        monitorGroup._staticBgManager.destroy();
                        monitorGroup._staticBgManager = null;
                    }
                });

                monitorGroup._staticBgManager = freshManager;
            }
        };
    }
}
