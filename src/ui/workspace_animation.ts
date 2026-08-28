import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as WorkspaceAnimation from 'resource:///org/gnome/shell/ui/workspaceAnimation.js';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import * as log from '../utils/log.js';

export type AnimationStyle = 'slide' | 'swing' | 'none';

const SWING_OVERSHOOT = 0.12;
const SWING_OVERSHOOT_FRACTION = 0.55;

export class WorkspaceAnimationManager {
    private _style: AnimationStyle;
    private _enabled = false;

    private _origCreateBackground = (WorkspaceAnimation as any).WorkspaceBackground?.prototype?._createBackground;
    private _origEaseProperty = (WorkspaceAnimation as any).MonitorGroup.prototype.ease_property;
    private _origPrepareWorkspaceSwitch = (WorkspaceAnimation as any).WorkspaceAnimationController.prototype._prepareWorkspaceSwitch;
    private _warmManagers: Map<number, { container: Meta.BackgroundGroup; manager: any }> = new Map();
    private _monitorsChangedId = 0;
    private _origSyncStacking: any = null;

    constructor(style: AnimationStyle = 'swing') {
        this._style = style;
    }

    enable(): boolean {
        if (this._enabled) return true;
        if (typeof this._origCreateBackground !== 'function') {
            log.warn('WorkspaceAnimationManager: WorkspaceBackground is unavailable; animation disabled');
            return false;
        }
        this._enabled = true;

        (WorkspaceAnimation as any).WorkspaceBackground.prototype._createBackground = function (this: any) {
            this._bgManager = { destroy: () => { } };
        };

        this._warmBackgrounds();

        // Keep pre-warm set current when monitors change.
        this._monitorsChangedId = (global as any).backend.get_monitor_manager().connect(
            'monitors-changed',
            () => this._warmBackgrounds(),
        );

        this._patchStaticBackground();
        this._patchSyncStackingGuard();

        if (this._style === 'swing') this._patchSwing();
        return true;
    }

    disable(): void {
        if (!this._enabled) return;
        this._enabled = false;

        (WorkspaceAnimation as any).WorkspaceBackground.prototype._createBackground = this._origCreateBackground;
        (WorkspaceAnimation as any).MonitorGroup.prototype.ease_property = this._origEaseProperty;
        (WorkspaceAnimation as any).WorkspaceAnimationController.prototype._prepareWorkspaceSwitch = this._origPrepareWorkspaceSwitch;

        const proto = (WorkspaceAnimation as any).WorkspaceGroup.prototype;
        if (this._origSyncStacking) {
            proto._syncStacking = this._origSyncStacking;
            this._origSyncStacking = null;
        }

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

    private _warmBackgrounds(): void {
        this._destroyWarmManagers();

        const monitors = Meta.prefs_get_workspaces_only_on_primary()
            ? [Main.layoutManager.primaryMonitor]
            : (Main.layoutManager as any).monitors;

        for (const monitor of monitors) {
            if (!monitor || monitor.width < 1 || monitor.height < 1) continue;

            const container = new Meta.BackgroundGroup();
            container.set_size(monitor.width, monitor.height);
            container.set_position(monitor.x, monitor.y);
            container.hide();
            Main.layoutManager.uiGroup.insert_child_below(container, null);

            const manager = new Background.BackgroundManager({
                container,
                monitorIndex: monitor.index,
                controlPosition: false,
            });
            this._warmManagers.set(monitor.index, { container, manager });
        }
    }

    private _destroyWarmManagers(): void {
        for (const { container, manager } of this._warmManagers.values()) {
            manager.destroy();
            container.destroy();
        }
        this._warmManagers.clear();
    }

    private _patchSyncStackingGuard(): void {
        const proto = (WorkspaceAnimation as any).WorkspaceGroup.prototype;
        this._origSyncStacking = proto._syncStacking;
        const original = this._origSyncStacking;

        proto._syncStacking = function (this: any, ...args: any[]) {
            try {
                original.apply(this, args);
            } catch (e) {
                log.warn(`WorkspaceAnimationManager: guarded _syncStacking error: ${e}`);
            }
        };
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


            if (!Number.isFinite(this.progress)) {
                original.call(this, 'progress', 0, { duration: 0 });
            }

            if (!Number.isFinite(target) || !Number.isFinite(params?.duration)) {
                original.call(this, propertyName, Number.isFinite(target) ? target : this.progress, { ...params, duration: 0 });
                return;
            }

            const delta = target - this.progress;
            const snapPoints: number[] = this.getSnapPoints();
            const minSnap = snapPoints.length ? Math.min(...snapPoints) : target;
            const maxSnap = snapPoints.length ? Math.max(...snapPoints) : target;
            const overshootTarget = Math.min(Math.max(target + delta * SWING_OVERSHOOT, minSnap), maxSnap);
            const overshootDuration = Math.round(params.duration * SWING_OVERSHOOT_FRACTION);
            const settleDuration = params.duration - overshootDuration;

            original.call(this, propertyName, overshootTarget, {
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

                const warm = warmManagers.get(monitorGroup.index);
                if (warm) {
                    const actor = warm.manager.backgroundActor;
                    if (actor) {
                        const clone = new Clutter.Clone({ source: actor, x_expand: true, y_expand: true });
                        bgGroup.add_child(clone);
                    }
                }
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
