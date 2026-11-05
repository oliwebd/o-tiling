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

const MODES: Array<config.AppMode> = ['float', 'tile', 'ignore'];
const MODE_LABELS = ['Floating', 'Tiled', 'Ignore (leave alone)'];

class App {
    config: config.Config = new config.Config();
    window: Adw.PreferencesWindow;
    
    user_exceptions_group: Adw.PreferencesGroup;
    sys_exceptions_group: Adw.PreferencesGroup;

    constructor(app: Adw.Application) {
        this.window = new Adw.PreferencesWindow({
            application: app,
            default_width: 550,
            default_height: 700,
            title: 'Window Rules',
            search_enabled: false,
        });

        const main_page = new Adw.PreferencesPage();
        this.window.add(main_page);

        // System Exceptions Group
        const sys_nav_group = new Adw.PreferencesGroup();
        const sys_nav_row = new Adw.ActionRow({
            title: 'System Exceptions',
            subtitle: 'Manage default rules based on user reports',
            activatable: true,
        });
        sys_nav_row.add_prefix(new Gtk.Image({
            icon_name: 'applications-system-symbolic',
        }));
        sys_nav_row.add_suffix(new Gtk.Image({
            icon_name: 'go-next-symbolic',
            valign: Gtk.Align.CENTER,
        }));
        
        const sys_subpage = new Adw.NavigationPage({
            title: 'System Exceptions',
            tag: 'system',
        });
        
        const sys_toolbar = new Adw.ToolbarView();
        sys_toolbar.add_top_bar(new Adw.HeaderBar());
        
        const sys_subpage_pref = new Adw.PreferencesPage();
        this.sys_exceptions_group = new Adw.PreferencesGroup({
            title: 'Built-in Rules',
            description: 'Toggle built-in system rules on or off.',
        });
        sys_subpage_pref.add(this.sys_exceptions_group);
        
        sys_toolbar.set_content(sys_subpage_pref);
        sys_subpage.set_child(sys_toolbar);
        
        sys_nav_row.connect('activated', () => {
            this.window.push_subpage(sys_subpage);
        });
        sys_nav_group.add(sys_nav_row);
        
        // User Exceptions Group
        this.user_exceptions_group = new Adw.PreferencesGroup({
            title: 'User Rules',
            description: 'Custom app and window rules added by you.',
        });

        // Add Window Rule Group
        const add_group = new Adw.PreferencesGroup({
            title: 'Add Window Rule',
            description: 'Choose a default mode, then select a window to apply it to.',
        });

        const mode_row = new Adw.ComboRow({
            title: 'Default Mode',
            subtitle: 'How matching windows should open',
            model: Gtk.StringList.new(MODE_LABELS),
        });
        mode_row.selected = 0;
        add_group.add(mode_row);

        const add_row = new Adw.ActionRow({
            title: 'Select Window…',
            activatable: true,
        });
        add_row.add_prefix(new Gtk.Image({
            icon_name: 'list-add-symbolic',
        }));
        add_row.connect('activated', () => {
            println(`SELECT ${MODES[mode_row.selected] ?? 'float'}`);
            app.quit();
        });
        add_group.add(add_row);

        main_page.add(sys_nav_group);
        main_page.add(add_group);
        main_page.add(this.user_exceptions_group);

        // Load data
        this.config.reload();

        // Populate system exceptions
        for (const value of config.DEFAULT_FLOAT_RULES.values()) {
            const wmtitle = value.title ?? undefined;
            const wmclass = value.class ?? undefined;
            const disabled = this.config.rule_disabled({ class: wmclass, title: wmtitle });
            this.add_sys_rule(wmclass, wmtitle, !disabled);
        }

        // Populate user exceptions
        for (const value of Array.from<any>(this.config.float)) {
            const wmtitle = value.title ?? undefined;
            const wmclass = value.class ?? undefined;
            const example = wmclass === 'o-tiling-example' && wmtitle === 'o-tiling-example';
            if (!value.disabled && !example) this.add_user_rule(wmclass, wmtitle, value.mode ?? 'float');
        }

        this.window.present();
    }

    add_sys_rule(wmclass: string | undefined, wmtitle: string | undefined, enabled: boolean) {
        const title = wmtitle ?? wmclass ?? 'Unknown';
        const subtitle = (wmtitle && wmclass) ? wmclass : '';
        
        const row = new Adw.SwitchRow({
            title: title,
            subtitle: subtitle,
            active: enabled,
        });

        row.connect('notify::active', () => {
            this.config.toggle_system_exception(wmclass, wmtitle, !row.active);
            println('MODIFIED');
        });

        this.sys_exceptions_group.add(row);
    }

    add_user_rule(wmclass: string | undefined, wmtitle: string | undefined, mode: config.AppMode = 'float') {
        const title = wmtitle ?? wmclass ?? 'Unknown';
        const subtitle = (wmtitle && wmclass) ? wmclass : '';
        
        const row = new Adw.ActionRow({
            title: title,
            subtitle: subtitle,
        });

        const mode_dropdown = Gtk.DropDown.new_from_strings(MODE_LABELS);
        mode_dropdown.valign = Gtk.Align.CENTER;
        mode_dropdown.selected = Math.max(0, MODES.indexOf(mode));
        mode_dropdown.connect('notify::selected', () => {
            this.config.set_rule_mode(wmclass, wmtitle, MODES[mode_dropdown.selected] ?? 'float');
            println('MODIFIED');
        });
        row.add_suffix(mode_dropdown);

        const remove_btn = new Gtk.Button({
            icon_name: 'user-trash-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat', 'circular', 'destructive-action'],
            tooltip_text: 'Remove rule',
        });
        remove_btn.connect('clicked', () => {
            this.user_exceptions_group.remove(row);
            this.config.remove_user_exception(wmclass, wmtitle);
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
    GLib.set_application_name('O-Tiling Window Rules');

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
