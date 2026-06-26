#!/usr/bin/gjs --module

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import GioUnix from 'gi://GioUnix?version=2.0';

/** The directory that this script is executed from. */
const SCRIPT_DIR = GLib.path_get_dirname(new Error().stack!.split(':')[0].slice(1));

import * as config from './config.js';

const WM_CLASS_ID = 'o-tiling-exceptions';

interface SelectWindow {
    tag: 0;
}

enum ViewNum {
    MainView = 0,
    Exceptions = 1,
}

interface SwitchTo {
    tag: 1;
    view: ViewNum;
}

interface ToggleException {
    tag: 2;
    wmclass: string | undefined;
    wmtitle: string | undefined;
    enable: boolean;
}

interface RemoveException {
    tag: 3;
    wmclass: string | undefined;
    wmtitle: string | undefined;
}

type Event = SelectWindow | SwitchTo | ToggleException | RemoveException;

interface View {
    widget: any;
    callback: (event: Event) => void;
}

export class MainView implements View {
    widget: any;
    callback: (event: Event) => void = () => {};
    private list: any;

    constructor() {
        // "Select a window" button — uses Adw.Clamp for alignment
        const select = new Gtk.Button({
            label: 'Select Window…',
            halign: Gtk.Align.CENTER,
            margin_bottom: 12,
            css_classes: ['suggested-action', 'pill'],
        });
        select.connect('clicked', () => this.callback({ tag: 0 }));

        // System exceptions navigation row
        const exceptions_row = new Adw.ActionRow({
            title: 'System Exceptions',
            subtitle: 'Updated based on validated user reports.',
            activatable: true,
        });
        exceptions_row.add_suffix(new Gtk.Image({
            icon_name: 'go-next-symbolic',
            valign: Gtk.Align.CENTER,
        }));
        exceptions_row.connect('activated', () =>
            this.callback({ tag: 1, view: ViewNum.Exceptions }));

        this.list = new Adw.PreferencesGroup({
            title: 'User Exceptions',
            description: 'Add exceptions by selecting currently running applications and windows.',
        });

        // Put the system-exceptions row in its own group
        const system_group = new Adw.PreferencesGroup({
            title: 'Settings',
        });
        system_group.add(exceptions_row);

        this.widget = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 24,
            margin_top: 24,
            margin_bottom: 24,
            margin_start: 24,
            margin_end: 24,
        });
        this.widget.append(select);
        this.widget.append(system_group);
        this.widget.append(this.list);
    }

    add_rule(wmclass: string | undefined, wmtitle: string | undefined) {
        const label_text = wmtitle === undefined ? (wmclass ?? '') : `${wmclass} / ${wmtitle}`;

        const row = new Adw.ActionRow({
            title: label_text,
        });

        const remove_btn = new Gtk.Button({
            icon_name: 'edit-delete-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat', 'circular'],
            tooltip_text: 'Remove exception',
        });
        remove_btn.connect('clicked', () => {
            this.list.remove(row);
            this.callback({ tag: 3, wmclass, wmtitle });
        });

        row.add_suffix(remove_btn);
        this.list.add(row);
    }
}

export class ExceptionsView implements View {
    widget: any;
    callback: (event: Event) => void = () => {};
    exceptions_group: any;

    constructor() {
        this.exceptions_group = new Adw.PreferencesGroup({
            title: 'System Exceptions',
            description: 'Toggle system-level floating exceptions on or off.',
        });

        this.widget = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 16,
            margin_top: 24,
            margin_bottom: 24,
            margin_start: 24,
            margin_end: 24,
        });
        this.widget.append(this.exceptions_group);
    }

    add_rule(wmclass: string | undefined, wmtitle: string | undefined, enabled: boolean) {
        const label_text = wmtitle === undefined ? (wmclass ?? '') : `${wmclass} / ${wmtitle}`;

        const row = new Adw.SwitchRow({
            title: label_text,
            active: enabled,
        });

        row.connect('notify::active', () => {
            this.callback({ tag: 2, wmclass, wmtitle, enable: row.active });
        });

        this.exceptions_group.add(row);
    }
}

class App {
    main_view: MainView = new MainView();
    exceptions_view: ExceptionsView = new ExceptionsView();
    config: config.Config = new config.Config();
    window: Adw.Window;

    constructor(app: Adw.Application) {
        const stack = new Gtk.Stack({
            transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
        });

        const main_page = stack.add_child(this.main_view.widget);
        const exceptions_page = stack.add_child(this.exceptions_view.widget);

        const back = new Gtk.Button({
            icon_name: 'go-previous-symbolic',
            visible: false,
        });

        const header = new Adw.HeaderBar({
            title_widget: new Adw.WindowTitle({
                title: 'Floating Window Exceptions',
            }),
        });
        header.pack_start(back);

        const content = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
        });
        content.append(header);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vexpand: true,
        });
        scrolled.set_child(stack);
        content.append(scrolled);

        this.window = new Adw.Window({
            application: app,
            content: content,
            default_width: 550,
            default_height: 700,
            title: 'Floating Window Exceptions',
        });

        this.config.reload();

        // Populate system exceptions
        for (const value of config.DEFAULT_FLOAT_RULES.values()) {
            const wmtitle = value.title ?? undefined;
            const wmclass = value.class ?? undefined;
            const disabled = this.config.rule_disabled({ class: wmclass, title: wmtitle });
            this.exceptions_view.add_rule(wmclass, wmtitle, !disabled);
        }

        // Populate user exceptions
        for (const value of Array.from<any>(this.config.float)) {
            const wmtitle = value.title ?? undefined;
            const wmclass = value.class ?? undefined;
            if (!value.disabled) this.main_view.add_rule(wmclass, wmtitle);
        }

        const event_handler = (event: Event) => {
            switch (event.tag) {
                case 0: // SelectWindow
                    println('SELECT');
                    app.quit();
                    break;
                case 1: // SwitchTo
                    switch (event.view) {
                        case ViewNum.MainView:
                            stack.set_visible_child(this.main_view.widget);
                            back.visible = false;
                            break;
                        case ViewNum.Exceptions:
                            stack.set_visible_child(this.exceptions_view.widget);
                            back.visible = true;
                            break;
                    }
                    break;
                case 2: // ToggleException
                    this.config.toggle_system_exception(event.wmclass, event.wmtitle, !event.enable);
                    println('MODIFIED');
                    break;
                case 3: // RemoveException
                    this.config.remove_user_exception(event.wmclass, event.wmtitle);
                    println('MODIFIED');
                    break;
            }
        };

        this.main_view.callback = event_handler;
        this.exceptions_view.callback = event_handler;
        back.connect('clicked', () => event_handler({ tag: 1, view: ViewNum.MainView }));

        this.window.present();
    }
}

const STDOUT = new Gio.DataOutputStream({
    base_stream: new GioUnix.OutputStream({ fd: 1 }),
});

/** Utility function for printing a message to stdout with an added newline */
function println(message: string) {
    STDOUT.put_string(message + '\n', null);
}

/** Initialize Adw and start the application */
function main() {
    GLib.set_prgname(WM_CLASS_ID);
    GLib.set_application_name('O-Tiling Floating Window Exceptions');

    const app = new Adw.Application({
        application_id: 'com.o_tiling.floating_exceptions',
        flags: Gio.ApplicationFlags.FLAGS_NONE,
    });

    app.connect('activate', () => {
        new App(app);
    });

    app.run(null);
}

main();
