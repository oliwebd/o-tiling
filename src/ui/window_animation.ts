import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export type WindowAnimationStyle = 'default' | 'hyprland' | 'glide';

export class WindowAnimationManager {
    private _style: WindowAnimationStyle;
    private _duration: number;
    private _enabled = false;
    private _origMapWindow: (shellwm: any, actor: any) => void;
    private _origDestroyWindow: (shellwm: any, actor: any) => void;
    private _origMinimizeWindow: (shellwm: any, actor: any) => void;
    private _origUnminimizeWindow: (shellwm: any, actor: any) => void;

    constructor(style: WindowAnimationStyle = 'default', duration: number = 200) {
        this._style = style;
        this._duration = duration;
        // Capture originals lazily at enable() time so we always get the real GNOME Shell prototype method.
        this._origMapWindow = null!;
        this._origDestroyWindow = null!;
        this._origMinimizeWindow = null!;
        this._origUnminimizeWindow = null!;
    }

    enable(): void {
        if (this._enabled) return;
        this._enabled = true;

        const wm = Main.wm as any;

        // Capture the current (unpatched) originals now.
        this._origMapWindow = wm._mapWindow;
        this._origDestroyWindow = wm._destroyWindow;
        this._origMinimizeWindow = wm._minimizeWindow;
        this._origUnminimizeWindow = wm._unminimizeWindow;

        const manager = this;

        wm._mapWindow = function (shellwm: any, actor: any) {
            // Suppress during workspace-switch gesture (GNOME 48: _workspaceAnimation.gestureActive).
            const workspaceSwitching = !!(wm._workspaceAnimation?.gestureActive);
            if (manager._style === 'default' || workspaceSwitching)
                return manager._origMapWindow.call(this, shellwm, actor);

            actor._windowType = actor.meta_window.get_window_type();
            actor.meta_window.connectObject('notify::window-type', () => {
                const type = actor.meta_window.get_window_type();
                if (type === actor._windowType) return;
                if (type === Meta.WindowType.MODAL_DIALOG ||
                    actor._windowType === Meta.WindowType.MODAL_DIALOG) {
                    const parent = actor.get_meta_window().get_transient_for();
                    if (parent) wm._checkDimming(parent);
                }
                actor._windowType = type;
            }, actor);
            actor.meta_window.connect('unmanaged', (window: any) => {
                const parent = window.get_transient_for();
                if (parent) wm._checkDimming(parent);
            });

            if (actor.meta_window.is_attached_dialog())
                wm._checkDimming(actor.get_meta_window().get_transient_for());

            const types = [
                Meta.WindowType.NORMAL,
                Meta.WindowType.DIALOG,
                Meta.WindowType.MODAL_DIALOG,
            ];
            if (!wm._shouldAnimateActor(actor, types)) {
                shellwm.completed_map(actor);
                return;
            }

            if (wm._getAnimationWindowType(actor) !== Meta.WindowType.NORMAL)
                return manager._origMapWindow.call(this, shellwm, actor);

            const { duration, mode, initProps } = manager._getMapParams();
            actor.set_pivot_point(0.5, 0.5);
            Object.assign(actor, initProps);
            actor.show();
            wm._mapping.add(actor);

            actor.ease({
                opacity: 255,
                scale_x: 1,
                scale_y: 1,
                translation_y: 0,
                duration,
                mode,
                onStopped: () => wm._mapWindowDone(shellwm, actor),
            });
        };

        wm._destroyWindow = function (shellwm: any, actor: any) {
            const workspaceSwitching = !!(wm._workspaceAnimation?.gestureActive);
            if (manager._style === 'default' || workspaceSwitching)
                return manager._origDestroyWindow.call(this, shellwm, actor);

            const window = actor.meta_window;
            window.disconnectObject(actor);

            if (window.is_attached_dialog())
                wm._checkDimming(window.get_transient_for());

            const types = [
                Meta.WindowType.NORMAL,
                Meta.WindowType.DIALOG,
                Meta.WindowType.MODAL_DIALOG,
            ];
            if (!wm._shouldAnimateActor(actor, types)) {
                shellwm.completed_destroy(actor);
                return;
            }

            if (wm._getAnimationWindowType(actor) !== Meta.WindowType.NORMAL)
                return manager._origDestroyWindow.call(this, shellwm, actor);

            const { duration, mode, targetProps } = manager._getDestroyParams();
            actor.set_pivot_point(0.5, 0.5);
            wm._destroying.add(actor);

            actor.ease({
                ...targetProps,
                duration,
                mode,
                onStopped: () => wm._destroyWindowDone(shellwm, actor),
            });
        };

        wm._minimizeWindow = function (shellwm: any, actor: any) {
            const workspaceSwitching = !!(wm._workspaceAnimation?.gestureActive);
            if (manager._style === 'default' || workspaceSwitching)
                return manager._origMinimizeWindow.call(this, shellwm, actor);

            const types = [
                Meta.WindowType.NORMAL,
                Meta.WindowType.DIALOG,
                Meta.WindowType.MODAL_DIALOG,
            ];
            if (!wm._shouldAnimateActor(actor, types)) {
                shellwm.completed_minimize(actor);
                return;
            }

            if (wm._getAnimationWindowType(actor) !== Meta.WindowType.NORMAL)
                return manager._origMinimizeWindow.call(this, shellwm, actor);

            const { duration, mode, targetProps } = manager._getDestroyParams();
            actor.set_pivot_point(0.5, 0.5);
            wm._minimizing.add(actor);

            actor.ease({
                ...targetProps,
                duration,
                mode,
                onStopped: () => wm._minimizeWindowDone(shellwm, actor),
            });
        };

        wm._unminimizeWindow = function (shellwm: any, actor: any) {
            const workspaceSwitching = !!(wm._workspaceAnimation?.gestureActive);
            if (manager._style === 'default' || workspaceSwitching)
                return manager._origUnminimizeWindow.call(this, shellwm, actor);

            const types = [
                Meta.WindowType.NORMAL,
                Meta.WindowType.DIALOG,
                Meta.WindowType.MODAL_DIALOG,
            ];
            if (!wm._shouldAnimateActor(actor, types)) {
                shellwm.completed_unminimize(actor);
                return;
            }

            if (wm._getAnimationWindowType(actor) !== Meta.WindowType.NORMAL)
                return manager._origUnminimizeWindow.call(this, shellwm, actor);

            const { duration, mode, initProps } = manager._getMapParams();
            actor.set_pivot_point(0.5, 0.5);
            Object.assign(actor, initProps);
            actor.show();
            wm._unminimizing.add(actor);

            actor.ease({
                opacity: 255,
                scale_x: 1,
                scale_y: 1,
                translation_y: 0,
                duration,
                mode,
                onStopped: () => wm._unminimizeWindowDone(shellwm, actor),
            });
        };
    }

    disable(): void {
        this._enabled = false;
        const wm = Main.wm as any;
        wm._mapWindow = this._origMapWindow;
        wm._destroyWindow = this._origDestroyWindow;
        wm._minimizeWindow = this._origMinimizeWindow;
        wm._unminimizeWindow = this._origUnminimizeWindow;
    }

    setStyle(style: WindowAnimationStyle): void {
        this._style = style;
    }

    setDuration(duration: number): void {
        this._duration = duration;
    }

    get style(): WindowAnimationStyle {
        return this._style;
    }

    applyMove(actor: Clutter.Actor, x: number, y: number, width: number, height: number, commit: () => void, skipAnim: boolean = false): void {
        actor.remove_transition('translation-x');
        actor.remove_transition('translation-y');

        if (skipAnim || actor.width !== width || actor.height !== height) {
            commit();
            return;
        }

        const mode = this._style === 'hyprland'
            ? Clutter.AnimationMode.EASE_OUT_EXPO
            : this._style === 'glide'
                ? Clutter.AnimationMode.EASE_OUT_QUART
                : Clutter.AnimationMode.EASE_OUT_CUBIC;

        commit();
        actor.translation_x = actor.x - x;
        actor.translation_y = actor.y - y;
        (actor as any).ease({
            translation_x: 0,
            translation_y: 0,
            duration: this._duration,
            mode,
        });
    }

    private _getMapParams() {
        if (this._style === 'glide') {
            return {
                duration: this._duration,
                mode: Clutter.AnimationMode.EASE_OUT_QUART,
                // Start slightly below final position and fully transparent.
                initProps: { opacity: 0, scale_x: 1, scale_y: 1, translation_y: 40 },
            };
        }

        // hyprland: start small and transparent, overshoot to 1.0 via EASE_OUT_BACK.
        return {
            duration: this._duration,
            mode: Clutter.AnimationMode.EASE_OUT_BACK,
            initProps: { opacity: 0, scale_x: 0.65, scale_y: 0.65, translation_y: 0 },
        };
    }

    private _getDestroyParams() {
        if (this._style === 'glide') {
            return {
                duration: Math.round(this._duration * 0.75),
                mode: Clutter.AnimationMode.EASE_IN_QUART,
                targetProps: { opacity: 0, translation_y: 40 },
            };
        }

        // hyprland: scale down and fade out quickly like Hyprland's close animation.
        return {
            duration: Math.round(this._duration * 0.75),
            mode: Clutter.AnimationMode.EASE_IN_EXPO,
            targetProps: { opacity: 0, scale_x: 0.7, scale_y: 0.7 },
        };
    }
}
