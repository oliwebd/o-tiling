import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
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
import GLib from 'gi://GLib';
import { spawn } from 'resource:///org/gnome/shell/misc/util.js';
import { get_current_path } from './paths.js';
// import * as Settings from './settings.js';

export class Indicator {
    button: any;

    toggle_tiled: any;
    toggle_titles: null | any;
    toggle_active: any;
    border_radius: any;

    entry_gaps: any;

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

        // Tile Windows Toggle with Icon
        this.toggle_tiled = tiled(ext);
        bm.addMenuItem(this.toggle_tiled);

        // Exceptions with Icon
        bm.addMenuItem(floating_window_exceptions(ext, bm));

        bm.addMenuItem(new PopupSeparatorMenuItem());

        // Shortcuts Section
        bm.addMenuItem(shortcuts(bm));
        
        bm.addMenuItem(new PopupSeparatorMenuItem());

        this.toggle_active = toggle(_('Show Active Hint'), 'focus-windows-symbolic', ext.settings.active_hint(), (state) => {
            ext.settings.set_active_hint(state);
        });
        bm.addMenuItem(this.toggle_active);

        // Active Hint Glow Toggle
        bm.addMenuItem(toggle(_('Show Active Hint Glow'), 'star-symbolic', ext.settings.active_hint_glow(), (state) => {
            ext.settings.set_active_hint_glow(state);
        }));

        // Active Hint Glow Opacity (%)
        bm.addMenuItem(number_entry(
            _('Glow Opacity (%)'),
            'star-symbolic',
            {
                value: ext.settings.active_hint_glow_opacity(),
                min: 0,
                max: 50,
            },
            (value) => {
                ext.settings.set_active_hint_glow_opacity(value);
            },
        ));

        // Border Radius with Icon
        this.border_radius = number_entry(
            _('Active Border Radius'),
            'view-quilt-symbolic',
            {
                value: ext.settings.active_hint_border_radius(),
                min: 0,
                max: 30,
            },
            (value) => {
                ext.settings.set_active_hint_border_radius(value);
            },
        );
        bm.addMenuItem(this.border_radius);

        // Force Rounded Corners Toggle
        bm.addMenuItem(toggle(_('Force Rounded Corners'), 'view-reveal-symbolic', ext.settings.force_rounded_corners(), (state) => {
            ext.settings.set_force_rounded_corners(state);
        }));

        // Active Hint Color with Icon
        bm.addMenuItem(color_selector(ext, bm));

        // Gaps with Icon
        this.entry_gaps = number_entry(_('Gaps'), 'view-grid-symbolic', ext.settings.gap_inner(), (value) => {
            ext.settings.set_gap_inner(value);
            ext.settings.set_gap_outer(value);
        });
        bm.addMenuItem(this.entry_gaps);

        bm.addMenuItem(new PopupSeparatorMenuItem());
        
        // View All Settings
        bm.addMenuItem(settings_button(bm));

        if (!Utils.is_wayland()) {
            bm.addMenuItem(new PopupSeparatorMenuItem());
            this.toggle_titles = show_title(ext);
            bm.addMenuItem(this.toggle_titles);
        }

        bm.addMenuItem(new PopupSeparatorMenuItem());

        // Reset Settings Button
        let reset_item = new PopupMenuItem(_('Reset All Settings'));
        (reset_item as any).insert_child_at_index(new St.Icon({ icon_name: 'edit-clear-all-symbolic', icon_size: 18, style_class: 'o-tiling-menu-icon' }), 0);
        (reset_item as any).label.style_class = 'o-tiling-menu-label';
        reset_item.connect('activate', () => {
            ext.settings.reset_all();
            bm.close();
        });
        bm.addMenuItem(reset_item);
    }

    destroy() {
        this.button.destroy();
    }
}

function settings_button(menu: any): any {
    let item = new PopupMenuItem(_('Settings & Shortcuts'));
    (item as any).spacing = 12;
    let icon = new St.Icon({ icon_name: 'emblem-system-symbolic', icon_size: 18, style_class: 'o-tiling-menu-icon' });
    
    (item as any).insert_child_at_index(icon, 0);
    (item as any).label.style_class = 'o-tiling-menu-label';
    
    item.connect('activate', () => {
        let path: string | null = GLib.find_program_in_path('o-tiling-shortcuts');
        if (path) {
            spawn([path]);
        } else {
            spawn(['xdg-open', 'https://github.com/oliwebd/o-tiling']);
        }

        menu.close();
    });

    return item;
}

function floating_window_exceptions(ext: Ext, menu: any): any {
    let item = new PopupBaseMenuItem({ style_class: 'o-tiling-menu-item' });
    (item as any).spacing = 12;
    let icon = new St.Icon({ icon_name: 'list-add-symbolic', icon_size: 18, style_class: 'o-tiling-menu-icon' });
    let label = new St.Label({ text: _('Floating Window Exceptions'), style_class: 'o-tiling-menu-label', y_align: Clutter.ActorAlign.CENTER });
    let arrow = new St.Icon({ icon_name: 'go-next-symbolic', icon_size: 14, style_class: 'o-tiling-menu-shortcut', y_align: Clutter.ActorAlign.CENTER });

    let box = new St.BoxLayout({ x_expand: true });
    (box as any).spacing = 12;
    box.add_child(icon);
    box.add_child(label);
    
    item.add_child(box);
    item.add_child(new St.Widget({ x_expand: true }));
    item.add_child(arrow);

    item.connect('activate', () => {
        ext.exception_dialog();
        GLib.timeout_add(GLib.PRIORITY_LOW, 300, () => {
            menu.close();
            return false;
        });
    });

    return item;
}

function shortcuts(menu: any): any {
    let item = new PopupBaseMenuItem({ style_class: 'o-tiling-menu-item', reactive: false });
    let box = new St.BoxLayout({ x_expand: true });
    (box as any).set_orientation(Clutter.Orientation.VERTICAL);
    (box as any).spacing = 8;
    
    let header = new St.Label({ text: _('Shortcuts'), style_class: 'o-tiling-menu-label', style: 'color: #3584e4; font-size: 0.9em; text-transform: uppercase;' });
    box.add_child(header);

    const shortcut_items = [
        [_('Navigate Windows'), _('Super + Alt + Arrows')],
        [_('Toggle Tiling'), _('Super + T')],
    ];

    shortcut_items.forEach((s) => {
        let row = new St.BoxLayout();
        (row as any).spacing = 12;
        let label = new St.Label({ text: s[0], style_class: 'o-tiling-menu-label', style: 'font-size: 0.95em;' });
        let shortcut = new St.Label({ text: s[1], style_class: 'o-tiling-menu-shortcut', x_align: Clutter.ActorAlign.END, x_expand: true });
        
        row.add_child(label);
        row.add_child(shortcut);
        box.add_child(row);
    });

    item.add_child(box);
    return item;
}

function number_entry(
    label_text: string,
    icon_name: string,
    valueOrOptions: number | { value: number; min: number; max: number },
    callback: (a: number) => void,
): any {
    let value = valueOrOptions, min = 0, max = 100;
    if (typeof valueOrOptions !== 'number') ({ value, min, max } = valueOrOptions);

    let item = new PopupBaseMenuItem({ style_class: 'o-tiling-menu-item', reactive: false });
    (item as any).spacing = 12;
    let icon = new St.Icon({ icon_name, icon_size: 18, style_class: 'o-tiling-menu-icon' });
    let label = new St.Label({ text: label_text, style_class: 'o-tiling-menu-label', y_align: Clutter.ActorAlign.CENTER });
    
    let entry_box = new St.BoxLayout({ style_class: 'o-tiling-number-entry', x_expand: false });
    (entry_box as any).set_orientation(Clutter.Orientation.HORIZONTAL);
    (entry_box as any).spacing = 4;
    entry_box.y_align = Clutter.ActorAlign.CENTER;
    
    let btn_minus = new St.Button({ child: new St.Icon({ icon_name: 'list-remove-symbolic', icon_size: 12 }), style_class: 'button' });
    let btn_plus = new St.Button({ child: new St.Icon({ icon_name: 'list-add-symbolic', icon_size: 12 }), style_class: 'button' });
    
    let entry = new St.Entry({
        text: String(value),
        input_purpose: Clutter.InputContentPurpose.NUMBER,
        style: 'width: 2.5em; background: transparent; border: none; padding: 0; text-align: center;'
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
    
    entry.clutter_text.connect('text-changed', () => {
        let v = parseInt(entry.text);
        if (!isNaN(v)) callback(v);
    });

    item.add_child(icon);
    item.add_child(label);
    item.add_child(new St.Widget({ x_expand: true }));
    item.add_child(entry_box);

    return item;
}

function show_title(ext: Ext): any {
    return toggle(_('Show Window Titles'), 'format-text-bold-symbolic', ext.settings.show_title(), (state) => {
        ext.settings.set_show_title(state);
    });
}

function toggle(desc: string, icon_name: string, active: boolean, callback: (state: boolean) => void): any {
    let item = new PopupSwitchMenuItem(desc, active);
    (item as any).spacing = 12;
    let icon = new St.Icon({ icon_name, icon_size: 18, style_class: 'o-tiling-menu-icon' });
    
    // Customize the label style
    (item as any).label.style_class = 'o-tiling-menu-label';
    (item as any).insert_child_at_index(icon, 0);
    
    item.connect('toggled', (_, state) => {
        callback(state);
    });

    return item;
}

function tiled(ext: Ext): any {
    return toggle(_('Tile Windows'), 'view-quilt-symbolic', null != ext.auto_tiler, (shouldTile) => {
        if (shouldTile) ext.auto_tile_on();
        else ext.auto_tile_off();
    });
}

function color_selector(ext: Ext, menu: any) {
    let item = new PopupBaseMenuItem({ style_class: 'o-tiling-menu-item' });
    (item as any).spacing = 12;
    let icon = new St.Icon({ icon_name: 'color-select-symbolic', icon_size: 18, style_class: 'o-tiling-menu-icon' });
    let label = new St.Label({ text: _('Active Hint Color'), style_class: 'o-tiling-menu-label', y_align: Clutter.ActorAlign.CENTER });
    
    let color_button = new St.Button({ style_class: 'o-tiling-color-button' });
    let settings = ext.settings;
    
    const updateColor = () => {
        let color = settings.hint_color_rgba();
        color_button.set_style(`background-color: ${color};`);
    };

    updateColor();
    settings.ext.connect('changed::hint-color-rgba', () => updateColor());

    color_button.connect('clicked', () => {
        let path = get_current_path() + '/color_dialog/main.js';
        GLib.spawn_command_line_async(`gjs --module ${path}`);
        GLib.timeout_add(GLib.PRIORITY_LOW, 300, () => {
            menu.close();
            return false;
        });
    });

    item.add_child(icon);
    item.add_child(label);
    item.add_child(new St.Widget({ x_expand: true }));
    item.add_child(color_button);

    return item;
}
