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


import { get_current_path } from './paths.js';

export class Indicator {
    button: any;

    toggle_tiled: any;
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

        const button_icon_auto_on = new St.Icon({
            gicon: ext.button_gio_icon_auto_on,
            style_class: 'system-status-icon',
        });
        const button_icon_auto_off = new St.Icon({
            gicon: ext.button_gio_icon_auto_off,
            style_class: 'system-status-icon',
        });

        if (ext.settings.tile_by_default()) {
            this.button.icon = button_icon_auto_on;
        } else {
            this.button.icon = button_icon_auto_off;
        }

        this.button.add_child(this.button.icon);

        const bm = this.button.menu;
        bm.box.add_style_class_name('o-tiling-menu');

        // ── Tiling ──────────────────────────────────────────────
        this.toggle_tiled = tiled(ext);
        bm.addMenuItem(this.toggle_tiled);

        bm.addMenuItem(floating_window_exceptions(ext, bm, this.signals));

        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Active Hint ─────────────────────────────────────────
        this.toggle_active = toggle(
            _('Active Hint'),
            ext.settings.active_hint(),
            'focus-windows-symbolic',
            (state) => ext.settings.set_active_hint(state),
        );
        bm.addMenuItem(this.toggle_active);

        bm.addMenuItem(toggle(
            _('Hint Glow'),
            ext.settings.active_hint_glow(),
            'display-brightness-symbolic',
            (state) => ext.settings.set_active_hint_glow(state),
        ));

        



        


        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Numeric Settings ────────────────────────────────────
        this.entry_gaps = number_entry(
            _('Gaps'),
            { value: ext.settings.gap_inner(), min: 0, max: 24 },
            'view-fullscreen-symbolic',
            (value) => {
                ext.settings.set_gap_inner(value);
                ext.settings.set_gap_outer(value);
            },
        );
        bm.addMenuItem(this.entry_gaps);

        this.border_radius = number_entry(
            _('Border Radius'),
            { value: ext.settings.active_hint_border_radius(), min: 0, max: 30 },
            'selection-mode-symbolic',
            (value) => ext.settings.set_active_hint_border_radius(value),
        );
        bm.addMenuItem(this.border_radius);

        bm.addMenuItem(number_entry(
            _('Border Width'),
            { value: ext.settings.active_hint_border_width(), min: 1, max: 10 },
            'border-all-symbolic',
            (value) => ext.settings.set_active_hint_border_width(value),
        ));

        bm.addMenuItem(number_entry(
            _('Glow Opacity'),
            { value: ext.settings.active_hint_glow_opacity(), min: 0, max: 50 },
            'view-reveal-symbolic',
            (value) => ext.settings.set_active_hint_glow_opacity(value),
        ));



        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Actions ─────────────────────────────────────────────
        bm.addMenuItem(settings_button(bm));
        bm.addMenuItem(shortcuts_button(bm));

        const reset_item = new PopupMenuItem(_('Reset All Settings'));
        const reset_icon = new St.Icon({
            icon_name: 'edit-clear-all-symbolic',
            icon_size: 16,
            style_class: 'popup-menu-icon'
        });
        if (typeof (reset_item as any).insert_child_at_index === 'function') {
            (reset_item as any).insert_child_at_index(reset_icon, 0);
        } else {
            reset_item.add_child(reset_icon);
        }


        reset_item.connect('activate', () => {
            ext.settings.reset_all();
            ext.settings.set_gap_inner(4);
            ext.settings.set_gap_outer(4);
            ext.settings.set_active_hint_border_radius(10);
            ext.settings.set_active_hint_border_width(4);
            bm.close();
        });
        bm.addMenuItem(reset_item);


        bm.addMenuItem(new PopupSeparatorMenuItem());

        bm.addMenuItem(restart_button(bm));
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
    const item = new PopupMenuItem(_('Settings'));
    const icon = new St.Icon({
        icon_name: 'preferences-system-symbolic',
        icon_size: 16,
        style_class: 'popup-menu-icon'
    });
    if (typeof (item as any).insert_child_at_index === 'function') {
        (item as any).insert_child_at_index(icon, 0);
    } else {
        item.add_child(icon);
    }



    item.connect('activate', () => {
        const ext = (globalThis as any).oTilingExtension;
        if (ext && typeof ext.openPreferences === 'function') {
            ext.openPreferences();
        }

        menu.close();
    });

    return item;
}

function shortcuts_button(menu: any): any {
    const item = new PopupMenuItem(_('Shortcuts'));
    const icon = new St.Icon({
        icon_name: 'input-keyboard-symbolic',
        icon_size: 16,
        style_class: 'popup-menu-icon'
    });
    if (typeof (item as any).insert_child_at_index === 'function') {
        (item as any).insert_child_at_index(icon, 0);
    } else {
        item.add_child(icon);
    }



    item.connect('activate', () => {
        const ext = (globalThis as any).oTilingExtension;
        if (ext && typeof ext.openPreferences === 'function') {
            ext.openPreferences();
        }

        menu.close();
    });

    return item;
}

function floating_window_exceptions(ext: Ext, menu: any, signals: Array<[any, number]>): any {
    const item = new PopupMenuItem(_('Floating Exceptions'));
    const icon = new St.Icon({
        icon_name: 'window-new-symbolic',
        icon_size: 16,
        style_class: 'popup-menu-icon'
    });
    if (typeof (item as any).insert_child_at_index === 'function') {
        (item as any).insert_child_at_index(icon, 0);
    } else {
        item.add_child(icon);
    }


    const arrow = new St.Icon({
        icon_name: 'go-next-symbolic',
        icon_size: 16,

        y_align: Clutter.ActorAlign.CENTER,
        x_align: Clutter.ActorAlign.END,
        x_expand: true,
    });
    (item as any).add_child(arrow);

    item.connect('activate', () => {
        ext.exception_dialog();
        menu.close();
    });

    return item;
}

function number_entry(
    label_text: string,
    options: { value: number; min: number; max: number },
    icon_name: string | null,
    callback: (a: number) => void,
): any {
    const { value, min, max } = options;

    const item = new PopupBaseMenuItem({ reactive: false });

    if (icon_name) {
        const icon = new St.Icon({
            icon_name: icon_name,
            icon_size: 16,
            style_class: 'popup-menu-icon'
        });
        item.add_child(icon);
    }

    const label = new St.Label({

        text: label_text,
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
    });

    const entry_box = new St.BoxLayout({
        style_class: 'o-tiling-spin-box',
        y_align: Clutter.ActorAlign.CENTER,
    });
    (entry_box as any).set_orientation(Clutter.Orientation.HORIZONTAL);

    const btn_minus = new St.Button({
        child: new St.Icon({ icon_name: 'list-remove-symbolic', icon_size: 14 }),
        style_class: 'o-tiling-spin-btn',
    });
    const btn_plus = new St.Button({
        child: new St.Icon({ icon_name: 'list-add-symbolic', icon_size: 14 }),
        style_class: 'o-tiling-spin-btn',
    });

    const entry = new St.Label({
        text: String(value),
        style_class: 'o-tiling-spin-value',
        y_align: Clutter.ActorAlign.CENTER,
    });

    entry_box.add_child(btn_minus);
    entry_box.add_child(entry);
    entry_box.add_child(btn_plus);

    const updateValue = (v: number) => {
        const clamped = Math.min(Math.max(min, v), max);
        entry.text = String(clamped);
        callback(clamped);
    };

    btn_minus.connect('clicked', () => updateValue(parseInt(entry.text) - 1));
    btn_plus.connect('clicked', () => updateValue(parseInt(entry.text) + 1));

    item.add_child(label);
    item.add_child(entry_box);

    return item;
}


function toggle(desc: string, active: boolean, icon_name: string | null, callback: (state: boolean) => void): any {
    const item = new PopupSwitchMenuItem(desc, active);

    if (icon_name) {
        const icon = new St.Icon({
            icon_name: icon_name,
            icon_size: 16,
            style_class: 'popup-menu-icon'
        });
    if (typeof (item as any).insert_child_at_index === 'function') {
        (item as any).insert_child_at_index(icon, 1);
    } else {
        item.add_child(icon);
    }
    }


    item.connect('toggled', (_, state) => {

        callback(state);
    });

    return item;
}

function tiled(ext: Ext): any {
    return toggle(_('Tile Windows'), null != ext.auto_tiler, 'view-grid-symbolic', (shouldTile) => {
        if (shouldTile) ext.auto_tile_on();
        else ext.auto_tile_off();
    });
}



function restart_button(menu: any): any {
    const item = new PopupMenuItem(_('Restart Extension'));
    const icon = new St.Icon({
        icon_name: 'view-refresh-symbolic',
        icon_size: 16,
        style_class: 'popup-menu-icon'
    });
    if (typeof (item as any).insert_child_at_index === 'function') {
        (item as any).insert_child_at_index(icon, 0);
    } else {
        item.add_child(icon);
    }



    item.connect('activate', () => {
        const uuid = 'o-tiling@oliwebd.github.com';
        const extMgr = (Main as any).extensionManager;
        if (extMgr) {
            extMgr.disableExtension(uuid);
            // Re-enable after a short idle to allow cleanup to complete
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                extMgr.enableExtension(uuid);
                return GLib.SOURCE_REMOVE;
            });
        } else {
            (global as any).log('O-Tiling: extensionManager unavailable, cannot restart');
        }
        menu.close();
    });

    return item;
}
