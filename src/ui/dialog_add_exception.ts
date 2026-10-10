import * as lib from '../utils/lib.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

export class AddExceptionDialog {
    dialog: any; // Using any because ModalDialog type is sometimes tricky

    constructor(
        cancel: () => void,
        this_app: () => void,
        current_window: () => void,
        on_close: () => void,
        opts: { title?: string; description?: string } = {},
    ) {
        this.dialog = new ModalDialog.ModalDialog({
            styleClass: 'modal-dialog o-tiling-modal',
            destroyOnClose: false,
            shellReactive: true,
            shouldFadeIn: true,
            shouldFadeOut: true,
        });

        // Title with modern typography
        let title = new St.Label({
            text: opts.title ?? 'Add Floating Exception',
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'modal-dialog-linked-button', // Gives it a nice bold look in some themes, or just inline
            style: 'font-weight: bold; font-size: 1.2em; margin-bottom: 12px;',
        });

        // Description
        let desc = new St.Label({
            text: opts.description ?? 'Float the selected window, or all windows from the application.',
            x_align: Clutter.ActorAlign.CENTER,
            style: 'color: #a0a0a0; font-size: 0.9em; margin-bottom: 24px;',
        });

        let l = this.dialog.contentLayout;

        l.add_child(title);
        l.add_child(desc);

        // Modern width scaling
        let monitor = lib.current_monitor();
        this.dialog.contentLayout.width = monitor ? Math.max(monitor.width / 4, 400) : 400;

        this.dialog.addButton({
            label: 'Cancel',
            action: () => {
                cancel();
                on_close();
                this.close();
            },
            key: Clutter.KEY_Escape,
        });

        this.dialog.addButton({
            label: "This App's Windows",
            action: () => {
                this_app();
                on_close();
                this.close();
            },
        });

        this.dialog.addButton({
            label: 'Current Window Only',
            action: () => {
                current_window();
                on_close();
                this.close();
            },
            default: true,
        });
    }

    close() {
        this.dialog.close((global as any).get_current_time());
    }

    show() {
        this.dialog.show();
    }

    open() {
        this.dialog.open((global as any).get_current_time(), false);
        this.show();
    }
}
