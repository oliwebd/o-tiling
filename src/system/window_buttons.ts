import type { ExtensionSettings } from './settings.js';

/** Manages the window management buttons (Minimize, Maximize, Close). Synchronizes extension settings with the global GNOME button layout. */
export class WindowButtonsManager {
    private _settings: ExtensionSettings;
    private _signalIds: number[] = [];
    private _originalLayout: string | null = null;   // ← save original

    constructor(settings: ExtensionSettings) {
        this._settings = settings;
    }

    /** Enables the manager and connects settings signals. */
    enable() {
        // Save the layout BEFORE we touch it (only once)
        const wm = this._settings.wm;
        if (wm && this._originalLayout === null) {
            this._originalLayout = wm.get_string('button-layout');
        }

        this._signalIds.push(
            this._settings.ext.connect('changed::show-minimize-maximize-buttons', () => this.sync()),
            this._settings.ext.connect('changed::show-close-button', () => this.sync())
        );

        // ↓ Do NOT call sync() here — let the user's existing layout stand. sync() only fires when the extension's own settings change.
    }

    /** Disables the manager and disconnects signals. */
    disable() {
        for (const id of this._signalIds) {
            this._settings.ext.disconnect(id);
        }
        this._signalIds = [];

        // Restore the original layout when the extension is disabled
        if (this._originalLayout !== null && this._settings.wm) {
            this._settings.wm.set_string('button-layout', this._originalLayout);
            this._originalLayout = null;
        }
    }

    /** Synchronizes the global GNOME button layout with the extension settings. */
    sync() {
        const wm = this._settings.wm;
        if (!wm) return;

        const show_min_max = this._settings.show_minimize_maximize_buttons();
        const show_close = this._settings.show_close_button();

        const layout = wm.get_string('button-layout');
        const [left, right] = layout.split(':');

        const BTN = ['maximize', 'minimize', 'close'];

        // ↓ FIXED: check whether buttons are currently on the LEFT, not just whether the right side has *any* content (e.g. "appmenu").
        const leftHasButtons = (left ?? '').split(',').some(s => BTN.includes(s.trim()));
        const rightHasButtons = (right ?? '').split(',').some(s => BTN.includes(s.trim()));

        // If buttons are currently on the left, keep them left. If on the right (or not present yet), default to right.
        const isRight = !leftHasButtons && !rightHasButtons
            ? true              // no buttons anywhere yet → default right
            : rightHasButtons;  // honour current placement

        const BtnRight = (right ?? '').split(',').filter(s => !BTN.includes(s.trim()));
        const BtnLeft = (left ?? '').split(',').filter(s => !BTN.includes(s.trim()));

        if (show_min_max) {
            if (isRight) {
                BtnRight.push('minimize', 'maximize');
            } else {
                BtnLeft.splice(0, 0, 'minimize', 'maximize');
            }
        }

        if (show_close) {
            if (isRight) {
                BtnRight.push('close');
            } else {
                BtnLeft.splice(0, 0, 'close');
            }
        }

        const new_layout = `${BtnLeft.join(',')}:${BtnRight.join(',')}`;
        wm.set_string('button-layout', new_layout);
    }
}
