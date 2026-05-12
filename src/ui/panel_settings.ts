import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Utils from '../utils/utils.js';

import type { Ext } from '../extension.js';

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


import { get_current_path } from '../utils/paths.js';
import { isGnome50 } from './workspace_switcher_style.js';


export class Indicator {
    button: any;

    toggle_tiled: any;
    toggle_workspace_tiled: any;
    toggle_new_workspaces_tiled: any;
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

        this.button.connect('button-press-event', (actor: any, event: any) => {
            if (event.get_button() === 1) { // Left click
                if (ext._ext_soft_disabled) {
                    // Extension is fully off — left click re-enables everything
                    ext.ext_soft_enable();
                } else {
                    // Extension is on — left click toggles only auto-tiling
                    if (ext.auto_tiler) ext.auto_tile_off();
                    else ext.auto_tile_on();
                }
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        const bm = this.button.menu;
        bm.box.add_style_class_name('o-tiling-menu');

        // ── Tiling ──────────────────────────────────────────────
        this.toggle_workspace_tiled = workspace_tiled(ext);
        bm.addMenuItem(this.toggle_workspace_tiled);

        this.toggle_new_workspaces_tiled = new_workspaces_tiled(ext);
        bm.addMenuItem(this.toggle_new_workspaces_tiled);

        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Active Hint ─────────────────────────────────────────
        this.toggle_active = toggle(
            _('Active Hint'),
            ext.settings.active_hint(),
            'focus-windows-symbolic',
            (state) => ext.settings.set_active_hint(state),
        );
        bm.addMenuItem(this.toggle_active);

        // Panel Transparency quick-toggle
        const toggle_panel_trans = toggle(
            _('Transparent Panel'),
            ext.settings.panel_transparency(),
            { on: 'display-brightness-symbolic', off: 'display-brightness-symbolic' },
            (state) => ext.toggle_panel_transparency(state),
        );
        bm.addMenuItem(toggle_panel_trans);




        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Numeric Settings ────────────────────────────────────
        this.entry_gaps = number_entry(
            _('Gaps'),
            { value: ext.settings.gap_inner(), min: 0, max: 24, reset_value: 4 },
            'view-fullscreen-symbolic',
            (value) => {
                ext.settings.set_gap_inner(value);
                ext.settings.set_gap_outer(value);
            },
        );
        bm.addMenuItem(this.entry_gaps);

        this.border_radius = number_entry(
            _('Border Radius'),
            { value: ext.settings.active_hint_border_radius(), min: 0, max: 30, reset_value: 8 },
            'selection-mode-symbolic',
            (value) => ext.settings.set_active_hint_border_radius(value),
        );
        bm.addMenuItem(this.border_radius);

        bm.addMenuItem(number_entry(
            _('Border Width'),
            { value: ext.settings.active_hint_border_width(), min: 1, max: 10, reset_value: 3 },
            'border-all-symbolic',
            (value) => ext.settings.set_active_hint_border_width(value),
        ));



        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Actions ─────────────────────────────────────────────
        bm.addMenuItem(settings_button(bm));

        bm.addMenuItem(new PopupSeparatorMenuItem());

        this.toggle_tiled = tiled(ext);
        bm.addMenuItem(this.toggle_tiled);

    }

    update_workspace_tiling_state() {
        const ext = (globalThis as any).oTilingExtension?.ext;
        if (ext && this.toggle_workspace_tiled) {
            const workspace = ext.active_workspace();
            const tiled = ext.is_workspace_tiled(workspace);
            this.toggle_workspace_tiled.setToggleState(tiled);
            if (this.toggle_workspace_tiled.updateIcon) {
                this.toggle_workspace_tiled.updateIcon(tiled);
            }

            // Update panel icon to reflect current workspace tiling state
            if (ext.auto_tiler && tiled) {
                this.button.icon.gicon = ext.button_gio_icon_auto_on;
            } else {
                this.button.icon.gicon = ext.button_gio_icon_auto_off;
            }
        }
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




function number_entry(
    label_text: string,
    options: { value: number; min: number; max: number; reset_value?: number },
    icon_name: string | null,
    callback: (a: number) => void,
): any {
    const { value, min, max, reset_value } = options;

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

    if (reset_value !== undefined) {
        const btn_reset = new St.Button({
            child: new St.Icon({ icon_name: 'edit-undo-symbolic', icon_size: 14 }),
            style_class: 'o-tiling-spin-btn',
        });
        entry_box.add_child(btn_reset);
        btn_reset.connect('clicked', () => updateValue(reset_value));
    }

    item.add_child(label);
    item.add_child(entry_box);

    return item;
}


function toggle(
    desc: string,
    active: boolean,
    icon_names: string | { on: string; off: string } | null,
    callback: (state: boolean) => void,
): any {
    const item = new PopupSwitchMenuItem(desc, active);

    if (icon_names) {
        const icon_name = typeof icon_names === 'string'
            ? icon_names
            : (active ? icon_names.on : icon_names.off);

        const icon = new St.Icon({
            icon_name: icon_name,
            icon_size: 16,
            style_class: 'popup-menu-icon',
        });

        if (typeof (item as any).insert_child_at_index === 'function') {
            (item as any).insert_child_at_index(icon, 1);
        } else {
            item.add_child(icon);
        }

        if (typeof icon_names !== 'string') {
            (item as any).updateIcon = (state: boolean) => {
                icon.icon_name = state ? icon_names.on : icon_names.off;
            };

            item.connect('toggled', (_, state) => {
                (item as any).updateIcon(state);
            });
        }
    }

    item.connect('toggled', (_, state) => {
        callback(state);
    });

    return item;
}

function tiled(ext: Ext): any {
    // Extension is "on" when it is NOT soft-disabled
    const isOn = !ext._ext_soft_disabled;
    return toggle(
        _('Enable O-Tiling Extension'),
        isOn,
        { on: 'view-grid-symbolic', off: 'view-module-symbolic' },
        (shouldEnable) => {
            if (shouldEnable) {
                ext.ext_soft_enable();
            } else {
                ext.ext_soft_disable();
            }
        }
    );
}

function workspace_tiled(ext: Ext): any {
    return toggle(
        _('Tile This Workspace'),
        ext.is_workspace_tiled(ext.active_workspace()),
        { on: 'view-quilt-symbolic', off: 'view-compact-symbolic' },
        (shouldTile) => {
            ext.workspace_tiling_set(ext.active_workspace(), shouldTile);
        }
    );
}

function new_workspaces_tiled(ext: Ext): any {
    return toggle(
        _('Tile New Workspaces'),
        ext.settings.new_workspaces_tiled(),
        { on: 'tab-new-symbolic', off: 'tab-new-symbolic' },
        (state) => ext.settings.set_new_workspaces_tiled(state),
    );
}



