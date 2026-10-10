#!/usr/bin/gjs --module

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import GioUnix from 'gi://GioUnix?version=2.0';

import * as config from '../floating_exceptions/config.js';

const WM_CLASS_ID = 'o-tiling-lone-exceptions';

class App {
    config: config.Config = new config.Config();
    window: Adw.PreferencesWindow;
    user_exceptions_group: Adw.PreferencesGroup;

    constructor(app: Adw.Application) {
        this.window = new Adw.PreferencesWindow({
            application: app,
            default_width: 550,
            default_height: 700,
            title: 'Lone Window Exceptions',
            search_enabled: false,
        });

        const main_page = new Adw.PreferencesPage();
        this.window.add(main_page);

        // User Exceptions Group
        this.user_exceptions_group = new Adw.PreferencesGroup({
            title: 'User Exceptions',
            description: 'Apps that keep filling the screen instead of centering.',
        });

        // Add Window Action Row
        const add_row = new Adw.ActionRow({
            title: 'Select Window…',
            activatable: true,
        });
        add_row.add_prefix(new Gtk.Image({
            icon_name: 'list-add-symbolic',
        }));
        add_row.connect('activated', () => {
            println('SELECT');
            app.quit();
        });
        this.user_exceptions_group.add(add_row);

        main_page.add(this.user_exceptions_group);

        // Load data
        this.config.reload();

        // Populate user exceptions
        for (const value of Array.from<any>(this.config.lone)) {
            const wmtitle = value.title ?? undefined;
            const wmclass = value.class ?? undefined;
            this.add_user_rule(wmclass, wmtitle);
        }

        this.window.present();
    }

    add_user_rule(wmclass: string | undefined, wmtitle: string | undefined) {
        const title = wmtitle ?? wmclass ?? 'Unknown';
        const subtitle = (wmtitle && wmclass) ? wmclass : '';

        const row = new Adw.ActionRow({
            title: title,
            subtitle: subtitle,
        });

        const remove_btn = new Gtk.Button({
            icon_name: 'user-trash-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat', 'circular', 'destructive-action'],
            tooltip_text: 'Remove exception',
        });
        remove_btn.connect('clicked', () => {
            this.user_exceptions_group.remove(row);
            this.config.remove_lone_user_exception(wmclass, wmtitle);
            println('MODIFIED');
        });

        row.add_suffix(remove_btn);
        this.user_exceptions_group.add(row);
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
    GLib.set_application_name('O-Tiling Lone Window Exceptions');

    const app = new Adw.Application({
        application_id: 'com.o_tiling.lone_exceptions',
        flags: Gio.ApplicationFlags.FLAGS_NONE,
    });

    app.connect('activate', () => {
        new App(app);
    });

    app.run(null);
}

main();
