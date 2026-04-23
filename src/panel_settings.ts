import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Utils from './utils.js';

import type { Ext } from './extension.js';

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import St from 'gi://St';

import {
    PopupBaseMenuItem,
    PopupMenuItem,
    PopupSwitchMenuItem,
    PopupSeparatorMenuItem,
} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Button } from 'resource:///org/gnome/shell/ui/panelMenu.js';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import { spawn } from 'resource:///org/gnome/shell/misc/util.js';
import { get_current_path } from './paths.js';

export class Indicator {
    button: any;

    toggle_tiled: any;
    toggle_titles: null | any;
    toggle_active: any;
    border_radius: any;

    entry_gaps: any;
    signals: Array<[any, number]> = [];

    constructor(ext: Ext) {
        this.button = new Button(0.0, _('O-tiling Settings'));

        const path = get_current_path();
        ext.button = this.button;
        ext.button_gio_icon_auto_on = Gio.icon_new_for_string(`${path}/icons/o-tiling-auto-on-symbolic.svg`);
        ext.button_gio_icon_auto_off = Gio.icon_new_for_string(`${path}/icons/o-tiling-auto-off-symbolic.svg`);

        let button_icon_auto_on = new St.Icon({
            gicon: ext.button_gio_icon_auto_on,
            style_class: 'system-status-icon',
        });
        let button_icon_auto_off = new St.Icon({
            gicon: ext.button_gio_icon_auto_off,
            style_class: 'system-status-icon',
        });

        if (ext.settings.tile_by_default()) {
            this.button.icon = button_icon_auto_on;
        } else {
            this.button.icon = button_icon_auto_off;
        }

        this.button.add_child(this.button.icon);

        let bm = this.button.menu;

        // ── General ─────────────────────────────────────────────
        bm.addMenuItem(toggle(
            _('Enabled'),
            !ext.suspended,
            (state) => {
                if (state) ext.resume();
                else ext.suspend();
            }
        ));

        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Tiling ──────────────────────────────────────────────
        this.toggle_tiled = tiled(ext);
        bm.addMenuItem(this.toggle_tiled);

        bm.addMenuItem(floating_window_exceptions(ext, bm, this.signals));

        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Active Hint ─────────────────────────────────────────
        this.toggle_active = toggle(
            _('Active Hint'),
            ext.settings.active_hint(),
            (state) => ext.settings.set_active_hint(state),
        );
        bm.addMenuItem(this.toggle_active);

        bm.addMenuItem(toggle(
            _('Hint Glow'),
            ext.settings.active_hint_glow(),
            (state) => ext.settings.set_active_hint_glow(state),
        ));

        bm.addMenuItem(toggle(
            _('Rounded Corners'),
            ext.settings.force_rounded_corners(),
            (state) => ext.settings.set_force_rounded_corners(state),
        ));
        


        bm.addMenuItem(color_selector(ext, bm, this.signals));

        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Numeric Settings ────────────────────────────────────
        this.entry_gaps = number_entry(
            _('Gaps'),
            { value: ext.settings.gap_inner(), min: 0, max: 24 },
            (value) => {
                ext.settings.set_gap_inner(value);
                ext.settings.set_gap_outer(value);
            },
        );
        bm.addMenuItem(this.entry_gaps);

        this.border_radius = number_entry(
            _('Border Radius'),
            { value: ext.settings.active_hint_border_radius(), min: 0, max: 30 },
            (value) => ext.settings.set_active_hint_border_radius(value),
        );
        bm.addMenuItem(this.border_radius);

        bm.addMenuItem(number_entry(
            _('Border Width'),
            { value: ext.settings.active_hint_border_width(), min: 1, max: 10 },
            (value) => ext.settings.set_active_hint_border_width(value),
        ));

        bm.addMenuItem(number_entry(
            _('Glow Opacity'),
            { value: ext.settings.active_hint_glow_opacity(), min: 0, max: 50 },
            (value) => ext.settings.set_active_hint_glow_opacity(value),
        ));

        if (!Utils.is_wayland()) {
            bm.addMenuItem(new PopupSeparatorMenuItem());
            this.toggle_titles = show_title(ext);
            bm.addMenuItem(this.toggle_titles);
        }

        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Actions ─────────────────────────────────────────────
        bm.addMenuItem(settings_button(bm));
        bm.addMenuItem(shortcuts_button(bm));

        let reset_item = new PopupMenuItem(_('Reset All Settings'));
        reset_item.connect('activate', () => {
            ext.settings.reset_all();
            bm.close();
        });
        bm.addMenuItem(reset_item);

        bm.addMenuItem(new PopupSeparatorMenuItem());

        bm.addMenuItem(disable_button(bm));
    }

    destroy() {
        for (const [obj, id] of this.signals) {
            obj.disconnect(id);
        }
        this.signals = [];
        this.button.destroy();
    }
}

function settings_button(menu: any): any {
    let item = new PopupMenuItem(_('Settings'));

    item.connect('activate', () => {
        const ext = (globalThis as any).oTilingExtension;
        if (ext && typeof ext.openPrefs === 'function') {
            ext.openPrefs();
        } else {
            spawn(['gnome-extensions', 'prefs', 'o-tiling@oliwebd.github.com']);
        }

        menu.close();
    });

    return item;
}

function shortcuts_button(menu: any): any {
    let item = new PopupMenuItem(_('Shortcuts'));

    item.connect('activate', () => {
        let path: string | null = GLib.find_program_in_path('o-tiling-shortcuts');
        if (path) {
            spawn([path]);
        } else {
            spawn(['xdg-open', 'https://github.com/oliwebd/o-tiling#shortcuts']);
        }

        menu.close();
    });

    return item;
}

function floating_window_exceptions(ext: Ext, menu: any, signals: Array<[any, number]>): any {
    let item = new PopupMenuItem(_('Floating Exceptions'));
    let arrow = new St.Icon({
        icon_name: 'go-next-symbolic',
        icon_size: 16,
        y_align: Clutter.ActorAlign.CENTER,
        x_align: Clutter.ActorAlign.END,
        x_expand: true,
    });
    (item as any).add_child(arrow);

    item.connect('activate', () => {
        ext.exception_dialog();
        GLib.timeout_add(GLib.PRIORITY_LOW, 300, () => {
            menu.close();
            return false;
        });
    });

    return item;
}

function number_entry(
    label_text: string,
    options: { value: number; min: number; max: number },
    callback: (a: number) => void,
): any {
    let { value, min, max } = options;

    let item = new PopupBaseMenuItem({ reactive: false });
    let label = new St.Label({
        text: label_text,
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
    });

    let entry_box = new St.BoxLayout({
        style_class: 'o-tiling-spin-box',
        y_align: Clutter.ActorAlign.CENTER,
    });
    (entry_box as any).set_orientation(Clutter.Orientation.HORIZONTAL);

    let btn_minus = new St.Button({
        child: new St.Icon({ icon_name: 'list-remove-symbolic', icon_size: 14 }),
        style_class: 'o-tiling-spin-btn',
    });
    let btn_plus = new St.Button({
        child: new St.Icon({ icon_name: 'list-add-symbolic', icon_size: 14 }),
        style_class: 'o-tiling-spin-btn',
    });

    let entry = new St.Label({
        text: String(value),
        style_class: 'o-tiling-spin-value',
        y_align: Clutter.ActorAlign.CENTER,
    });

    entry_box.add_child(btn_minus);
    entry_box.add_child(entry);
    entry_box.add_child(btn_plus);

    const updateValue = (v: number) => {
        let clamped = Math.min(Math.max(min, v), max);
        entry.text = String(clamped);
        callback(clamped);
    };

    btn_minus.connect('clicked', () => updateValue(parseInt(entry.text) - 1));
    btn_plus.connect('clicked', () => updateValue(parseInt(entry.text) + 1));

    item.add_child(label);
    item.add_child(entry_box);

    return item;
}

function show_title(ext: Ext): any {
    return toggle(_('Show Window Titles'), ext.settings.show_title(), (state) => {
        ext.settings.set_show_title(state);
    });
}

function toggle(desc: string, active: boolean, callback: (state: boolean) => void): any {
    let item = new PopupSwitchMenuItem(desc, active);

    item.connect('toggled', (_, state) => {
        callback(state);
    });

    return item;
}

function tiled(ext: Ext): any {
    return toggle(_('Tile Windows'), null != ext.auto_tiler, (shouldTile) => {
        if (shouldTile) ext.auto_tile_on();
        else ext.auto_tile_off();
    });
}

function color_selector(ext: Ext, menu: any, signals: Array<[any, number]>) {
    let item = new PopupBaseMenuItem();
    let label = new St.Label({
        text: _('Hint Color'),
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
    });

    let color_button = new St.Button({ style_class: 'o-tiling-color-swatch' });
    let settings = ext.settings;

    const updateColor = () => {
        let color = settings.hint_color_rgba();
        color_button.set_style(`background-color: ${color};`);
    };

    updateColor();
    signals.push([settings.ext, settings.ext.connect('changed::hint-color-rgba', () => updateColor())]);

    color_button.connect('clicked', () => {
        let path = get_current_path() + '/color_dialog/main.js';
        GLib.spawn_command_line_async(`gjs --module ${path}`);
        GLib.timeout_add(GLib.PRIORITY_LOW, 300, () => {
            menu.close();
            return false;
        });
    });

    item.add_child(label);
    item.add_child(color_button);

    return item;
}

function disable_button(menu: any): any {
    let item = new PopupMenuItem(_('Disable Extension'));

    item.connect('activate', () => {
        const uuid = 'o-tiling@oliwebd.github.com';
        Main.extensionManager.disableExtension(uuid);
        menu.close();
    });

    return item;
}
