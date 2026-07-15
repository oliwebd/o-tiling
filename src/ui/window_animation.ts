import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export type WindowAnimationStyle = 'default' | 'hyprland' | 'glide';

const SHOW_WINDOW_ANIMATION_TIME = 150;
const DESTROY_WINDOW_ANIMATION_TIME = 100;

export class WindowAnimationManager {
    private _style: WindowAnimationStyle;
    private _duration: number;
    private _enabled = false;
    private _origMapWindow = (Main.wm as any)._mapWindow;
    private _origDestroyWindow = (Main.wm as any)._destroyWindow;

    constructor(style: WindowAnimationStyle = 'default', duration: number = 200) {
        this._style = style;
        this._duration = duration;
    }

    enable(): void {
        if (this._enabled) return;
        this._enabled = true;

        const wm = Main.wm as any;

        const manager = this;

        wm._mapWindow = function (shellwm: any, actor: any) {
            if (manager._style === 'default')
                return manager._origMapWindow.call(this, shellwm, actor);

            actor._windowType = actor.meta_window.get_window_type();
            actor.meta_window.connectObject('notify::window-type', () => {
                const type = actor.meta_window.get_window_type();
                if (type === actor._windowType) return;
                if (type === Meta.WindowType.MODAL_DIALOG ||
                    actor._windowType === Meta.WindowType.MODAL_DIALOG) {
                    const parent = actor.get_meta_window().get_transient_for();
                    if (parent) (wm as any)._checkDimming(parent);
                }
                actor._windowType = type;
            }, actor);
            actor.meta_window.connect('unmanaged', (window: any) => {
                const parent = window.get_transient_for();
                if (parent) (wm as any)._checkDimming(parent);
            });

            if (actor.meta_window.is_attached_dialog())
                (wm as any)._checkDimming(actor.get_meta_window().get_transient_for());

            const types = [
                Meta.WindowType.NORMAL,
                Meta.WindowType.DIALOG,
                Meta.WindowType.MODAL_DIALOG,
            ];
            if (!(wm as any)._shouldAnimateActor(actor, types)) {
                shellwm.completed_map(actor);
                return;
            }

            const animType = (wm as any)._getAnimationWindowType(actor);
            if (animType !== Meta.WindowType.NORMAL) {
                return manager._origMapWindow.call(this, shellwm, actor);
            }

            const { duration, mode, initProps } = manager._getMapParams();
            actor.set_pivot_point(0.5, 0.5);
            Object.assign(actor, initProps);
            actor.show();
            (wm as any)._mapping.add(actor);

            actor.ease({
                opacity: 255,
                scale_x: 1,
                scale_y: 1,
                translation_y: 0,
                duration,
                mode,
                onStopped: () => (wm as any)._mapWindowDone(shellwm, actor),
            });
        };

        wm._destroyWindow = function (shellwm: any, actor: any) {
            if (manager._style === 'default')
                return manager._origDestroyWindow.call(this, shellwm, actor);

            const window = actor.meta_window;
            window.disconnectObject(actor);

            if (window.is_attached_dialog())
                (wm as any)._checkDimming(window.get_transient_for());

            const types = [
                Meta.WindowType.NORMAL,
                Meta.WindowType.DIALOG,
                Meta.WindowType.MODAL_DIALOG,
            ];
            if (!(wm as any)._shouldAnimateActor(actor, types)) {
                shellwm.completed_destroy(actor);
                return;
            }

            const animType = (wm as any)._getAnimationWindowType(actor);
            if (animType !== Meta.WindowType.NORMAL) {
                return manager._origDestroyWindow.call(this, shellwm, actor);
            }

            const { duration, mode, targetProps } = manager._getDestroyParams();
            actor.set_pivot_point(0.5, 0.5);
            (wm as any)._destroying.add(actor);

            actor.ease({
                ...targetProps,
                duration,
                mode,
                onStopped: () => (wm as any)._destroyWindowDone(shellwm, actor),
            });
        };
    }

    disable(): void {
        this._enabled = false;
        const wm = Main.wm as any;
        wm._mapWindow = this._origMapWindow;
        wm._destroyWindow = this._origDestroyWindow;
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

    applyMove(actor: Clutter.Actor, x: number, y: number, width: number, height: number, commit: () => void): void {
        actor.remove_transition('translation-x');
        actor.remove_transition('translation-y');

        if (actor.width !== width || actor.height !== height) {
            commit();
            return;
        }

        const mode = this._style === 'hyprland'
            ? Clutter.AnimationMode.EASE_OUT_EXPO
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
                initProps: { opacity: 0, scale_x: 1, scale_y: 1, translation_y: 30 },
            };
        }

        // hyprland
        return {
            duration: this._duration,
            mode: Clutter.AnimationMode.EASE_OUT_BACK,
            initProps: { opacity: 0, scale_x: 0.85, scale_y: 0.85, translation_y: 0 },
        };
    }

    private _getDestroyParams() {
        if (this._style === 'glide') {
            return {
                duration: Math.round(this._duration * 0.8),
                mode: Clutter.AnimationMode.EASE_IN_QUART,
                targetProps: { opacity: 0, translation_y: 30 },
            };
        }

        // hyprland
        return {
            duration: Math.round(this._duration * 0.8),
            mode: Clutter.AnimationMode.EASE_IN_CUBIC,
            targetProps: { opacity: 0, scale_x: 0.85, scale_y: 0.85 },
        };
    }
}
