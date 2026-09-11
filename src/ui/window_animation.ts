import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export type WindowAnimationStyle = 'default' | 'hyprland' | 'glide';

type EffectKind = 'map' | 'destroy' | 'minimize' | 'unminimize';

const ANIMATABLE_TYPES = [
    Meta.WindowType.NORMAL,
    Meta.WindowType.DIALOG,
    Meta.WindowType.MODAL_DIALOG,
];

// Matches GNOME Shell's own attached-dialog dim effect (WINDOW_DIMMER
// constants in windowManager.js), reimplemented with only public API so it
// keeps working when we take over _mapWindow/_destroyWindow ourselves.
const DIM_BRIGHTNESS = -0.3;
const DIM_TIME = 500;
const UNDIM_TIME = 250;

class WindowDimmer {
    private _actor: any;
    private _effect: any;
    private _enabled = true;
    private _dimFactor = 0;
    private _timeline: any = null;

    constructor(actor: any) {
        this._actor = actor;
        this._effect = new Clutter.BrightnessContrastEffect();
        actor.add_effect(this._effect);
        this._syncEnabled();
    }

    private _syncEnabled(): void {
        this._effect.enabled = this._enabled && this._dimFactor > 0;
    }

    setEnabled(enabled: boolean): void {
        this._enabled = enabled;
        this._syncEnabled();
    }

    private _apply(factor: number): void {
        this._dimFactor = factor;
        this._effect.set_brightness(factor * DIM_BRIGHTNESS);
        this._syncEnabled();
    }

    // Cross-fades the brightness effect via a plain Clutter.Timeline, since
    // the dimmer itself isn't a Clutter.Actor and can't use actor.ease().
    animateTo(target: number, duration: number): void {
        this._timeline?.stop();
        if (this._dimFactor === target) {
            this._apply(target);
            return;
        }

        const start = this._dimFactor;
        const timeline = new Clutter.Timeline({ duration });
        this._timeline = timeline;
        timeline.connect('new-frame', () =>
            this._apply(start + (target - start) * timeline.get_progress()));
        timeline.connect('stopped', () => {
            this._apply(target);
            if (this._timeline === timeline) this._timeline = null;
        });
        timeline.start();
    }

    destroy(): void {
        this._timeline?.stop();
        this._actor.remove_effect(this._effect);
    }
}

export class WindowAnimationManager {
    private _style: WindowAnimationStyle;
    private _duration: number;
    private _origMapWindow: ((shellwm: any, actor: any) => void) | null;
    private _origDestroyWindow: ((shellwm: any, actor: any) => void) | null;
    private _origMinimizeWindow: ((shellwm: any, actor: any) => void) | null;
    private _origUnminimizeWindow: ((shellwm: any, actor: any) => void) | null;
    // Actors we're easing ourselves, so a forced 'kill-window-effects' (public
    // signal) can complete them via the public shellwm.completed_* calls
    // instead of relying on wm's private _mapping/_destroying bookkeeping.
    private _animating: Map<any, EffectKind> = new Map();
    private _killEffectsId = 0;
    private _dimmers: Map<any, WindowDimmer> = new Map();
    private _dimmedWindows: Set<any> = new Set();

    constructor(style: WindowAnimationStyle = 'default', duration: number = 300) {
        this._style = style;
        this._duration = duration;
        // Captured at enable() time so we always store the real GNOME Shell prototype method.
        this._origMapWindow = null;
        this._origDestroyWindow = null;
        this._origMinimizeWindow = null;
        this._origUnminimizeWindow = null;
    }

    enable(): void {
        const wm = Main.wm as any;
        const shellwm = wm._shellwm;

        // Capture the current (unpatched) originals now.
        this._origMapWindow = wm._mapWindow;
        this._origDestroyWindow = wm._destroyWindow;
        this._origMinimizeWindow = wm._minimizeWindow;
        this._origUnminimizeWindow = wm._unminimizeWindow;

        const manager = this;

        // Public signal for force-cancelled effects (logout, screen lock, etc.).
        // We only touch actors we're tracking, finishing them via the public
        // completed_* calls rather than depending on wm's private cleanup.
        this._killEffectsId = shellwm.connect('kill-window-effects', (_shellwm: any, actor: any) => {
            manager._finishEffect(shellwm, actor);
        });

        wm._mapWindow = function (shellwm2: any, actor: any) {
            // Suppress during workspace-switch gesture (GNOME 48: _workspaceAnimation.gestureActive).
            const workspaceSwitching = !!(wm._workspaceAnimation?.gestureActive);
            if (manager._style === 'default' || workspaceSwitching)
                return manager._origMapWindow!.call(this, shellwm2, actor);

            actor._windowType = actor.meta_window.get_window_type();
            actor.meta_window.connectObject('notify::window-type', () => {
                const type = actor.meta_window.get_window_type();
                if (type === actor._windowType) return;
                if (type === Meta.WindowType.MODAL_DIALOG ||
                    actor._windowType === Meta.WindowType.MODAL_DIALOG) {
                    const parent = actor.get_meta_window().get_transient_for();
                    if (parent) manager._checkDimming(parent);
                }
                actor._windowType = type;
            }, actor);
            actor.meta_window.connect('unmanaged', (window: any) => {
                const parent = window.get_transient_for();
                if (parent) manager._checkDimming(parent);
            });

            if (actor.meta_window.is_attached_dialog())
                manager._checkDimming(actor.get_meta_window().get_transient_for());

            if (!manager._shouldAnimate(actor)) {
                shellwm2.completed_map(actor);
                return;
            }

            if (manager._effectiveWindowType(actor) !== Meta.WindowType.NORMAL)
                return manager._origMapWindow!.call(this, shellwm2, actor);

            const { duration, mode, initProps } = manager._getMapParams();
            actor.set_pivot_point(0.5, 0.5);
            Object.assign(actor, initProps);
            actor.show();
            manager._animating.set(actor, 'map');

            actor.ease({
                opacity: 255,
                scale_x: 1,
                scale_y: 1,
                translation_y: 0,
                duration,
                mode,
                onStopped: () => manager._finishEffect(shellwm2, actor),
            });
        };

        wm._destroyWindow = function (shellwm2: any, actor: any) {
            const workspaceSwitching = !!(wm._workspaceAnimation?.gestureActive);
            if (manager._style === 'default' || workspaceSwitching)
                return manager._origDestroyWindow!.call(this, shellwm2, actor);

            const window = actor.meta_window;
            window.disconnectObject(actor);

            if (window.is_attached_dialog())
                manager._checkDimming(window.get_transient_for(), window);

            if (!manager._shouldAnimate(actor)) {
                shellwm2.completed_destroy(actor);
                return;
            }

            if (manager._effectiveWindowType(actor) !== Meta.WindowType.NORMAL)
                return manager._origDestroyWindow!.call(this, shellwm2, actor);

            const { duration, mode, targetProps } = manager._getDestroyParams();
            actor.set_pivot_point(0.5, 0.5);
            manager._animating.set(actor, 'destroy');

            actor.ease({
                ...targetProps,
                duration,
                mode,
                onStopped: () => manager._finishEffect(shellwm2, actor),
            });
        };

        wm._minimizeWindow = function (shellwm2: any, actor: any) {
            const workspaceSwitching = !!(wm._workspaceAnimation?.gestureActive);
            if (manager._style === 'default' || workspaceSwitching)
                return manager._origMinimizeWindow!.call(this, shellwm2, actor);

            if (!manager._shouldAnimate(actor)) {
                shellwm2.completed_minimize(actor);
                return;
            }

            if (manager._effectiveWindowType(actor) !== Meta.WindowType.NORMAL)
                return manager._origMinimizeWindow!.call(this, shellwm2, actor);

            const { duration, mode, targetProps } = manager._getDestroyParams();
            actor.set_pivot_point(0.5, 0.5);
            manager._animating.set(actor, 'minimize');

            actor.ease({
                ...targetProps,
                duration,
                mode,
                onStopped: () => manager._finishEffect(shellwm2, actor),
            });
        };

        wm._unminimizeWindow = function (shellwm2: any, actor: any) {
            const workspaceSwitching = !!(wm._workspaceAnimation?.gestureActive);
            if (manager._style === 'default' || workspaceSwitching)
                return manager._origUnminimizeWindow!.call(this, shellwm2, actor);

            if (!manager._shouldAnimate(actor)) {
                shellwm2.completed_unminimize(actor);
                return;
            }

            if (manager._effectiveWindowType(actor) !== Meta.WindowType.NORMAL)
                return manager._origUnminimizeWindow!.call(this, shellwm2, actor);

            const { duration, mode, initProps } = manager._getMapParams();
            actor.set_pivot_point(0.5, 0.5);
            Object.assign(actor, initProps);
            actor.show();
            manager._animating.set(actor, 'unminimize');

            actor.ease({
                opacity: 255,
                scale_x: 1,
                scale_y: 1,
                translation_y: 0,
                duration,
                mode,
                onStopped: () => manager._finishEffect(shellwm2, actor),
            });
        };
    }

    disable(): void {
        const wm = Main.wm as any;

        if (this._origMapWindow) {
            wm._mapWindow = this._origMapWindow;
            this._origMapWindow = null;
        }
        if (this._origDestroyWindow) {
            wm._destroyWindow = this._origDestroyWindow;
            this._origDestroyWindow = null;
        }
        if (this._origMinimizeWindow) {
            wm._minimizeWindow = this._origMinimizeWindow;
            this._origMinimizeWindow = null;
        }
        if (this._origUnminimizeWindow) {
            wm._unminimizeWindow = this._origUnminimizeWindow;
            this._origUnminimizeWindow = null;
        }

        if (this._killEffectsId) {
            wm._shellwm.disconnect(this._killEffectsId);
            this._killEffectsId = 0;
        }
        this._animating.clear();

        for (const dimmer of this._dimmers.values()) dimmer.destroy();
        this._dimmers.clear();
        this._dimmedWindows.clear();
    }

    // Public completion contract for Meta.Plugin/Shell.WM effects: whichever
    // hook started the effect, tell the compositor via shellwm.completed_*
    // once, then stop tracking the actor.
    private _finishEffect(shellwm: any, actor: any): void {
        const kind = this._animating.get(actor);
        if (!kind) return;
        this._animating.delete(actor);
        actor.remove_all_transitions();

        switch (kind) {
            case 'map': shellwm.completed_map(actor); break;
            case 'destroy': shellwm.completed_destroy(actor); break;
            case 'minimize': shellwm.completed_minimize(actor); break;
            case 'unminimize': shellwm.completed_unminimize(actor); break;
        }
    }

    // Public-API equivalent of wm's private _shouldAnimateActor: respect the
    // system animation toggle, skip while the overview is showing, and only
    // animate the window types we actually theme.
    private _shouldAnimate(actor: any): boolean {
        if (!St.Settings.get().enable_animations) return false;
        if (Main.overview.visible) return false;
        return ANIMATABLE_TYPES.includes(actor.meta_window.get_window_type());
    }

    // Public-API equivalent of wm's private _getAnimationWindowType: an
    // attached dialog animates like a modal dialog regardless of its own type.
    private _effectiveWindowType(actor: any): Meta.WindowType {
        if (actor.meta_window.is_attached_dialog())
            return Meta.WindowType.MODAL_DIALOG;
        return actor.meta_window.get_window_type();
    }

    private _getDimmer(actor: any): WindowDimmer | null {
        if (!Meta.prefs_get_attach_modal_dialogs()) return null;

        let dimmer = this._dimmers.get(actor);
        if (!dimmer) {
            dimmer = new WindowDimmer(actor);
            this._dimmers.set(actor, dimmer);
            actor.connect('destroy', () => this._dimmers.delete(actor));
        }
        return dimmer;
    }

    private _hasAttachedDialogs(window: any, ignoreWindow?: any): boolean {
        let count = 0;
        window.foreach_transient((win: any) => {
            if (win !== ignoreWindow && win.is_attached_dialog() && win.get_transient_for() === window) {
                count++;
                return false;
            }
            return true;
        });
        return count !== 0;
    }

    // Public-API equivalent of wm's private _checkDimming/WindowDimmer:
    // dims/undims a window's actor when its attached-dialog count changes.
    private _checkDimming(window: any, ignoreWindow?: any): void {
        const shouldDim = this._hasAttachedDialogs(window, ignoreWindow);
        const isDimmed = this._dimmedWindows.has(window);
        if (shouldDim === isDimmed) return;

        if (shouldDim) this._dimmedWindows.add(window);
        else this._dimmedWindows.delete(window);

        const actor = window.get_compositor_private();
        if (!actor) return;
        const dimmer = this._getDimmer(actor);
        dimmer?.animateTo(shouldDim ? 1.0 : 0.0, shouldDim ? DIM_TIME : UNDIM_TIME);
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

        // EASE_OUT_EXPO vs EASE_OUT_QUART were too close to tell apart at
        // typical move durations. hyprland now overshoots (matches its
        // bouncy map/destroy curve); glide stays a slower, non-overshooting float.
        const { mode, duration } = this._style === 'hyprland'
            ? { mode: Clutter.AnimationMode.EASE_OUT_BACK, duration: Math.round(this._duration * 0.9) }
            : this._style === 'glide'
                ? { mode: Clutter.AnimationMode.EASE_OUT_QUART, duration: Math.round(this._duration * 1.25) }
                : { mode: Clutter.AnimationMode.EASE_OUT_CUBIC, duration: this._duration };

        commit();
        actor.translation_x = actor.x - x;
        actor.translation_y = actor.y - y;
        (actor as any).ease({
            translation_x: 0,
            translation_y: 0,
            duration,
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
