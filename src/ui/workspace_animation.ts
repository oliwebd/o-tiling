import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
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

    constructor(style: AnimationStyle = 'swing') {
        this._style = style;
    }

    enable(): void {
        if (this._enabled) return;
        this._enabled = true;

        (WorkspaceAnimation as any).WorkspaceBackground.prototype._createBackground = function (this: any) { };

        this._patchStaticBackground();

        if (this._style === 'swing') this._patchSwing();
    }

    disable(): void {
        if (!this._enabled) return;
        this._enabled = false;

        (WorkspaceAnimation as any).WorkspaceBackground.prototype._createBackground = this._origCreateBackground;
        (WorkspaceAnimation as any).MonitorGroup.prototype.ease_property = this._origEaseProperty;
        (WorkspaceAnimation as any).WorkspaceAnimationController.prototype._prepareWorkspaceSwitch = this._origPrepareWorkspaceSwitch;
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
        (WorkspaceAnimation as any).WorkspaceAnimationController.prototype._prepareWorkspaceSwitch = function (
            this: any,
            ...args: any[]
        ) {
            origPrepare.apply(this, args);

            for (const monitorGroup of this._switchData.monitors) {
                if (monitorGroup._staticBackground) continue;

                const bgGroup = new Meta.BackgroundGroup();
                monitorGroup.insert_child_below(bgGroup, null);

                monitorGroup._bgManager = new Background.BackgroundManager({
                    container: bgGroup,
                    monitorIndex: monitorGroup.index,
                    controlPosition: false,
                });

                monitorGroup._staticBackground = bgGroup;

                monitorGroup.connect('destroy', () => {
                    if (monitorGroup._bgManager) {
                        monitorGroup._bgManager.destroy();
                        monitorGroup._bgManager = null;
                    }
                });
            }
        };
    }
}