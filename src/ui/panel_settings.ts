import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Utils from '../utils/utils.js';
import * as log from '../utils/log.js';

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
import { QuickMenuToggle, SystemIndicator } from 'resource:///org/gnome/shell/ui/quickSettings.js';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';


import { get_current_path } from '../utils/paths.js';
import { isGnome50 } from './workspace_switcher_style.js';
import { apply_preset, PresetType } from '../engine/presets.js';



export class Indicator {
    button: any;
    private ext: Ext;

    toggle_tiled: any;
    toggle_workspace_tiled: any;
    presets_item: any;


    toggle_active: any;
    border_radius: any;

    entry_gaps: any;

    constructor(ext: Ext) {
        this.ext = ext;
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
                    if (ext.auto_tiler) ext.auto_tile_off(false);
                    else ext.auto_tile_on(false);
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

        // ── Layout Presets ──────────────────────────────────────
        this.presets_item = presets_row(ext);
        bm.addMenuItem(this.presets_item);

        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Active Hint ─────────────────────────────────────────
        this.toggle_active = toggle(
            _('Active Hint'),
            ext.settings.active_hint(),
            'focus-windows-symbolic',
            (state) => ext.settings.set_active_hint(state),
        );
        bm.addMenuItem(this.toggle_active);





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
            'edit-select-all-symbolic',
            (value) => ext.settings.set_active_hint_border_width(value),
        ));



        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Actions ─────────────────────────────────────────────
        bm.addMenuItem(settings_button(bm));
        bm.addMenuItem(floating_window_exceptions(ext, bm));

        bm.addMenuItem(new PopupSeparatorMenuItem());

        this.toggle_tiled = tiled(ext);
        bm.addMenuItem(this.toggle_tiled);

    }

    update_workspace_tiling_state() {
        const ext = this.ext;
        if (!this.button || !this.button.visible || !this.button.get_stage()) {
            return;
        }
        if (ext && this.toggle_workspace_tiled) {
            const workspace = ext.active_workspace();
            const monitor = ext.active_monitor();
            const tiled = ext.is_workspace_tiled(workspace);
            ext._indicator_updating = true;
            this.toggle_workspace_tiled.setToggleState(tiled);
            ext._indicator_updating = false;
            if (this.toggle_workspace_tiled.updateIcon) {
                this.toggle_workspace_tiled.updateIcon(tiled);
            }


            if (this.presets_item) {
                if (ext.auto_tiler) {
                    const workspace_windows = Array.from(ext.windows.values()).filter(
                        w => w.known_workspace === workspace && ext.auto_tiler!.attached.contains(w.entity)
                    );
                    const enabled = workspace_windows.length >= 2 && workspace_windows.length <= 6;
                    this.presets_item.setSensitive(enabled);
                } else {
                    this.presets_item.setSensitive(false);
                }
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
    item.insert_child_at_index(icon, 0);



    item.connect('activate', () => {
        const ext = (globalThis as any).oTilingExtension;
        if (ext) {
            ext.openPreferences();
        }

        menu.close();
    });

    return item;
}

function floating_window_exceptions(ext: Ext, menu: any): any {
    const item = new PopupMenuItem(_('Floating Window Exceptions'));
    const icon = new St.Icon({
        icon_name: 'go-next-symbolic',
        icon_size: 16,
        style_class: 'popup-menu-icon'
    });

    item.insert_child_at_index(icon, 0);

    item.connect('activate', () => {
        ext.exception_dialog();

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

        item.insert_child_at_index(icon, 1);

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
        'view-grid-symbolic',
        (shouldEnable) => {
            if (ext._indicator_updating)
                return;
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
        { on: 'view-grid-symbolic', off: 'view-list-symbolic' },
        (shouldTile) => {
            if (ext._indicator_updating)
                return;
            ext.workspace_tiling_set(ext.active_workspace(), shouldTile);
        }
    );
}

function presets_row(ext: Ext): any {
    const item = new PopupBaseMenuItem({ reactive: false });

    const label = new St.Label({
        text: _('Layout Presets'),
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
    });
    item.add_child(label);

    const row = new St.BoxLayout({
        y_align: Clutter.ActorAlign.CENTER,
    });
    (row as any).set_orientation(Clutter.Orientation.HORIZONTAL);

    const presets = [
        { name: _('Columns'), type: PresetType.COLUMNS, icon: 'view-column-symbolic' },
        { name: _('Stacked'), type: PresetType.STACKED, icon: 'view-list-symbolic' },
        { name: _('Grid'), type: PresetType.GRID, icon: 'view-grid-symbolic' },
        { name: _('Spiral'), type: PresetType.SPIRAL, icon: 'media-playlist-consecutive-symbolic' },
    ];

    for (const p of presets) {
        const btn = new St.Button({
            child: new St.Icon({ icon_name: p.icon, icon_size: 14 }),
            style_class: 'o-tiling-spin-btn',
        });

        btn.connect('clicked', () => {
            const ws = ext.active_workspace();
            const monitor = ext.active_monitor();
            apply_preset(ext, p.type, ws, monitor);
        });
        row.add_child(btn);
    }

    item.add_child(row);
    return item;
}


// ── WorkspaceNumberIndicator ──────────────────────────────────────────────────
// A panel bar supporting Omarchy and Hyprland style workspace representations:
// - Styles: Numbers (1, 2, 3), Hyprland expanding dots, Roman numerals, or Compact index ("2 / 4")
// - Active styling: Pill (accent fill) or Outline (accent border)
// - Occupied indicator: workspaces with open windows are visually distinguished
// - Mouse wheel scrolling on indicator cycles through workspaces
// - Custom workspace labels support and live settings reactivity

function toRoman(num: number): string {
    const romanMap: [number, string][] = [
        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
    ];
    let result = '';
    let n = num;
    for (const [val, str] of romanMap) {
        while (n >= val) {
            result += str;
            n -= val;
        }
    }
    return result || String(num);
}

function isWorkspaceOccupied(ws: any): boolean {
    if (!ws) return false;
    try {
        const windows = ws.list_windows();
        if (!windows || windows.length === 0) return false;
        for (const win of windows) {
            if (!win.is_on_all_workspaces?.() && !win.skip_taskbar) {
                return true;
            }
        }
    } catch {
        // Fallback
    }
    return false;
}

export class WorkspaceNumberIndicator {
    readonly button: any; // PanelMenu.Button (required for addToStatusArea)

    private _ext: any; // Ext reference for reading hint color & settings
    private _box: St.BoxLayout;
    private _ovBtn: St.Button | null = null;
    private _wsBtns: St.Button[] = [];
    private _settingsSignals: number[] = [];
    private _lastScrollTime = 0;
    private _lastSignature = '';

    constructor(ext: any) {
        this._ext = ext;
        // `true` = don't create a menu: the bar has no popup, and an empty one
        // would still open when clicking dead space between the pills.
        this.button = new Button(0.0, 'O-Tiling Workspace Switcher', true);
        this.button.reactive = true;
        // Suppress the default panel-button hover box drawn behind the whole bar
        this.button.add_style_class_name('o-tiling-ws-panel-button');

        this._box = new St.BoxLayout({
            style_class: 'o-tiling-ws-bar',
            y_align: Clutter.ActorAlign.CENTER,
            reactive: true,
        });
        (this._box as any).set_orientation(Clutter.Orientation.HORIZONTAL);
        this.button.add_child(this._box);

        // Mouse wheel scroll over the indicator to switch workspaces
        this.button.connect('scroll-event', (_actor: any, event: any) => this._onScroll(event));

        if (this._ext.settings.show_overview_button_in_indicator()) {
            this._createOverviewButton();
        }

        // Mutter workspace and window signals
        const wm = (global as any).workspace_manager;
        wm.connectObject(
            'active-workspace-changed', () => this._update(),
            'workspace-added',          () => this._rebuild(),
            'workspace-removed',        () => this._rebuild(),
            'workspaces-reordered',      () => this._rebuild(),
            this
        );

        const display = (global as any).display;
        if (display?.connectObject) {
            display.connectObject(
                'window-created', () => this._update(),
                'restacked',      () => this._update(),
                this
            );
        }

        // Live settings reactivity: update immediately on settings change
        const s = this._ext.settings.ext;
        this._settingsSignals = [
            s.connect('changed::workspace-indicator-style', () => this._rebuild()),
            s.connect('changed::workspace-indicator-active-style', () => this._update()),
            s.connect('changed::workspace-indicator-border-radius', () => this._rebuild()),
            s.connect('changed::workspace-indicator-show-empty', () => this._rebuild()),
            s.connect('changed::workspace-indicator-show-occupied', () => this._update()),
            s.connect('changed::workspace-indicator-custom-labels', () => this._rebuild()),
            s.connect('changed::hint-color-rgba', () => this._update()),
            s.connect('changed::show-overview-button-in-indicator', () => {
                this.setOverviewButtonVisible(this._ext.settings.show_overview_button_in_indicator());
            }),
        ];

        this._rebuild();
    }

    private _onScroll(event: any): boolean {
        if (!this._ext.settings.workspace_indicator_scroll()) {
            return Clutter.EVENT_PROPAGATE;
        }

        const now = GLib.get_monotonic_time() / 1000; // ms
        if (now - this._lastScrollTime < 180) {
            return Clutter.EVENT_STOP;
        }

        let direction = event.get_scroll_direction();
        if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [, dy] = event.get_scroll_delta();
            if (dy < -0.2) {
                direction = Clutter.ScrollDirection.UP;
            } else if (dy > 0.2) {
                direction = Clutter.ScrollDirection.DOWN;
            } else {
                return Clutter.EVENT_PROPAGATE;
            }
        }

        const wm = (global as any).workspace_manager;
        const current = wm.get_active_workspace_index();
        const total = wm.get_n_workspaces();
        let target = current;

        if (direction === Clutter.ScrollDirection.UP || direction === Clutter.ScrollDirection.LEFT) {
            target = Math.max(0, current - 1);
        } else if (direction === Clutter.ScrollDirection.DOWN || direction === Clutter.ScrollDirection.RIGHT) {
            target = Math.min(total - 1, current + 1);
        }

        if (target !== current) {
            this._lastScrollTime = now;
            const ws = wm.get_workspace_by_index(target);
            if (ws) ws.activate(Clutter.get_current_event_time());
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    /** Creates the overview toggle button and inserts it at the start of the bar. */
    private _createOverviewButton(): void {
        const radius: number = this._ext.settings.workspace_indicator_border_radius();
        const icon = new St.Icon({
            icon_name: 'view-grid-symbolic',
            icon_size: 13,
            style_class: 'o-tiling-ws-overview-icon',
        });
        this._ovBtn = new St.Button({
            style_class: 'o-tiling-ws-overview-btn',
            child: icon,
            y_align: Clutter.ActorAlign.CENTER,
            style: `border-radius: ${radius}px;`,
        });
        this._ovBtn.connect('clicked', () => {
            if (Main.overview.visible) {
                Main.overview.hide();
            } else {
                Main.overview.show();
            }
        });
        this._box.insert_child_at_index(this._ovBtn, 0);
    }

    /** Shows or hides the overview button live, without rebuilding the whole indicator. */
    setOverviewButtonVisible(show: boolean): void {
        if (show && !this._ovBtn) {
            this._createOverviewButton();
        } else if (!show && this._ovBtn) {
            this._box.remove_child(this._ovBtn);
            this._ovBtn.destroy();
            this._ovBtn = null;
        }
    }

    /** Fingerprint of everything the indicator renders, used to skip redundant updates. */
    private _signature(style: string): string {
        const wm = (global as any).workspace_manager;
        const total: number = wm.get_n_workspaces();
        const s = this._ext.settings;

        // Index mode shows only "current / total", so occupancy never affects it.
        let occupancy = '';
        if (style !== 'index') {
            for (let i = 0; i < total; i++) {
                occupancy += isWorkspaceOccupied(wm.get_workspace_by_index(i)) ? '1' : '0';
            }
        }

        return [
            style,
            total,
            wm.get_active_workspace_index(),
            occupancy,
            s.workspace_indicator_active_style(),
            s.workspace_indicator_show_empty() ? '1' : '0',
            s.workspace_indicator_show_occupied() ? '1' : '0',
            s.hint_color_rgba(),
            s.workspace_indicator_border_radius(),
        ].join('|');
    }

    /** Rebuilds the workspace buttons according to style and configuration. */
    private _rebuild(): void {
        for (const btn of this._wsBtns) {
            this._box.remove_child(btn);
            btn.destroy();
        }
        this._wsBtns = [];

        const wm = (global as any).workspace_manager;
        const total: number = wm.get_n_workspaces();
        const current: number = wm.get_active_workspace_index();
        const hintColor: string = this._ext.settings.hint_color_rgba();
        const radius: number = this._ext.settings.workspace_indicator_border_radius();

        if (this._ovBtn) {
            this._ovBtn.style = `border-radius: ${radius}px;`;
        }

        const style: string = this._ext.settings.workspace_indicator_style();
        const activeStyle: string = this._ext.settings.workspace_indicator_active_style();
        const showEmpty: boolean = this._ext.settings.workspace_indicator_show_empty();
        const showOccupied: boolean = this._ext.settings.workspace_indicator_show_occupied();

        this._lastSignature = this._signature(style);

        const customLabelsStr: string = this._ext.settings.workspace_indicator_custom_labels().trim();
        const customLabels = customLabelsStr ? customLabelsStr.split(',').map(s => s.trim()) : [];

        // 1. Compact index mode: "current / total"
        if (style === 'index') {
            const label = new St.Label({
                text: `${current + 1} / ${total}`,
                y_align: Clutter.ActorAlign.CENTER,
            });
            const btn = new St.Button({
                style_class: 'o-tiling-ws-btn o-tiling-ws-index-btn o-tiling-ws-btn-active',
                child: label,
                y_align: Clutter.ActorAlign.CENTER,
            });
            if (activeStyle === 'pill') {
                btn.add_style_class_name('o-tiling-ws-btn-active-pill');
                btn.style = `background-color: ${hintColor}; color: #ffffff; border-radius: ${radius}px;`;
            } else {
                btn.add_style_class_name('o-tiling-ws-btn-active-outline');
                btn.style = `box-shadow: inset 0 0 0 1.5px ${hintColor}; color: ${hintColor}; border-radius: ${radius}px;`;
            }
            btn.connect('clicked', () => {
                if (Main.overview.visible) {
                    Main.overview.hide();
                } else {
                    Main.overview.show();
                }
            });
            (btn as any)._wsIndex = current;
            (btn as any)._label = label;
            this._box.add_child(btn);
            this._wsBtns.push(btn);
            return;
        }

        // 2. Dots mode (Hyprland expanding dots)
        if (style === 'dots') {
            for (let i = 0; i < total; i++) {
                const idx = i;
                const ws = wm.get_workspace_by_index(idx);
                const occupied = isWorkspaceOccupied(ws);

                if (!showEmpty && !occupied && idx !== current) {
                    continue;
                }

                const btn = new St.Button({
                    style_class: 'o-tiling-ws-dot',
                    y_align: Clutter.ActorAlign.CENTER,
                });
                (btn as any)._wsIndex = idx;

                if (idx === current) {
                    btn.add_style_class_name('o-tiling-ws-dot-active');
                    if (activeStyle === 'pill') {
                        btn.style = `min-width: 26px; background-color: ${hintColor}; border-radius: ${radius}px;`;
                    } else {
                        btn.style = `min-width: 26px; box-shadow: inset 0 0 0 1.5px ${hintColor}; background-color: rgba(255, 255, 255, 0.2); border-radius: ${radius}px;`;
                    }
                } else if (occupied && showOccupied) {
                    btn.add_style_class_name('o-tiling-ws-dot-occupied');
                    btn.style = `border-radius: ${Math.min(radius, 9)}px;`;
                } else {
                    btn.add_style_class_name('o-tiling-ws-dot-empty');
                    btn.style = `border-radius: ${Math.min(radius, 9)}px;`;
                }

                btn.connect('clicked', () => {
                    const targetWs = (global as any).workspace_manager.get_workspace_by_index(idx);
                    if (targetWs) targetWs.activate(Clutter.get_current_event_time());
                });

                this._box.add_child(btn);
                this._wsBtns.push(btn);
            }
            return;
        }

        // 3. Numbers / Roman / Custom labels mode
        for (let i = 0; i < total; i++) {
            const idx = i;
            const ws = wm.get_workspace_by_index(idx);
            const occupied = isWorkspaceOccupied(ws);

            if (!showEmpty && !occupied && idx !== current) {
                continue;
            }

            let text: string;
            if (customLabels[idx] !== undefined && customLabels[idx].length > 0) {
                text = customLabels[idx];
            } else if (style === 'roman') {
                text = toRoman(idx + 1);
            } else {
                text = String(idx + 1);
            }

            const label = new St.Label({
                text,
                y_align: Clutter.ActorAlign.CENTER,
            });
            const btn = new St.Button({
                style_class: 'o-tiling-ws-btn',
                child: label,
                y_align: Clutter.ActorAlign.CENTER,
            });
            (btn as any)._wsIndex = idx;
            (btn as any)._label = label;

            if (idx === current) {
                btn.add_style_class_name('o-tiling-ws-btn-active');
                if (activeStyle === 'pill') {
                    btn.add_style_class_name('o-tiling-ws-btn-active-pill');
                    btn.style = `background-color: ${hintColor}; color: #ffffff; border-radius: ${radius}px;`;
                } else {
                    btn.add_style_class_name('o-tiling-ws-btn-active-outline');
                    btn.style = `box-shadow: inset 0 0 0 1.5px ${hintColor}; color: ${hintColor}; border-radius: ${radius}px;`;
                }
            } else if (occupied && showOccupied) {
                btn.add_style_class_name('o-tiling-ws-btn-occupied');
                btn.style = `border-radius: ${radius}px;`;
            } else {
                btn.add_style_class_name('o-tiling-ws-btn-empty');
                btn.style = `border-radius: ${radius}px;`;
            }

            btn.connect('clicked', () => {
                const targetWs = (global as any).workspace_manager.get_workspace_by_index(idx);
                if (targetWs) targetWs.activate(Clutter.get_current_event_time());
            });

            this._box.add_child(btn);
            this._wsBtns.push(btn);
        }
    }

    /** Updates button active-state and occupied-state styles without full rebuild when possible. */
    private _update(): void {
        const style: string = this._ext.settings.workspace_indicator_style();

        // `restacked` fires on nearly every focus change, so do nothing at all
        // unless something the indicator actually draws has changed.
        const signature = this._signature(style);
        if (signature === this._lastSignature) return;
        this._lastSignature = signature;

        const wm = (global as any).workspace_manager;
        const total: number = wm.get_n_workspaces();
        const current: number = wm.get_active_workspace_index();
        const hintColor: string = this._ext.settings.hint_color_rgba();
        const radius: number = this._ext.settings.workspace_indicator_border_radius();

        if (this._ovBtn) {
            this._ovBtn.style = `border-radius: ${radius}px;`;
        }

        const activeStyle: string = this._ext.settings.workspace_indicator_active_style();
        const showEmpty: boolean = this._ext.settings.workspace_indicator_show_empty();
        const showOccupied: boolean = this._ext.settings.workspace_indicator_show_occupied();

        // 1. Index mode update — the "2 / 4" pill is independent of occupancy
        if (style === 'index') {
            const btn = this._wsBtns[0];
            if (!btn || (btn as any)._label === undefined) {
                this._rebuild();
                return;
            }
            (btn as any)._label.text = `${current + 1} / ${total}`;
            if (activeStyle === 'pill') {
                btn.remove_style_class_name('o-tiling-ws-btn-active-outline');
                btn.add_style_class_name('o-tiling-ws-btn-active-pill');
                btn.style = `background-color: ${hintColor}; color: #ffffff; border-radius: ${radius}px;`;
            } else {
                btn.remove_style_class_name('o-tiling-ws-btn-active-pill');
                btn.add_style_class_name('o-tiling-ws-btn-active-outline');
                btn.style = `box-shadow: inset 0 0 0 1.5px ${hintColor}; color: ${hintColor}; border-radius: ${radius}px;`;
            }
            return;
        }

        // Hiding empty workspaces changes which buttons exist at all
        if (!showEmpty) {
            this._rebuild();
            return;
        }

        // If count does not match total workspaces, rebuild
        if (this._wsBtns.length !== total) {
            this._rebuild();
            return;
        }

        // 2. Dots mode update
        if (style === 'dots') {
            for (let i = 0; i < this._wsBtns.length; i++) {
                const btn = this._wsBtns[i];
                const idx = (btn as any)._wsIndex ?? i;
                const ws = wm.get_workspace_by_index(idx);
                const occupied = isWorkspaceOccupied(ws);

                btn.remove_style_class_name('o-tiling-ws-dot-active');
                btn.remove_style_class_name('o-tiling-ws-dot-occupied');
                btn.remove_style_class_name('o-tiling-ws-dot-empty');

                if (idx === current) {
                    btn.add_style_class_name('o-tiling-ws-dot-active');
                    if (activeStyle === 'pill') {
                        btn.style = `min-width: 26px; background-color: ${hintColor}; border-radius: ${radius}px;`;
                    } else {
                        btn.style = `min-width: 26px; box-shadow: inset 0 0 0 1.5px ${hintColor}; background-color: rgba(255, 255, 255, 0.2); border-radius: ${radius}px;`;
                    }
                } else {
                    btn.style = `border-radius: ${Math.min(radius, 9)}px;`;
                    if (occupied && showOccupied) {
                        btn.add_style_class_name('o-tiling-ws-dot-occupied');
                    } else {
                        btn.add_style_class_name('o-tiling-ws-dot-empty');
                    }
                }
            }
            return;
        }

        // 3. Numbers / Roman / Custom labels update
        for (let i = 0; i < this._wsBtns.length; i++) {
            const btn = this._wsBtns[i];
            const idx = (btn as any)._wsIndex ?? i;
            const ws = wm.get_workspace_by_index(idx);
            const occupied = isWorkspaceOccupied(ws);

            btn.remove_style_class_name('o-tiling-ws-btn-active');
            btn.remove_style_class_name('o-tiling-ws-btn-active-pill');
            btn.remove_style_class_name('o-tiling-ws-btn-active-outline');
            btn.remove_style_class_name('o-tiling-ws-btn-occupied');
            btn.remove_style_class_name('o-tiling-ws-btn-empty');

            if (idx === current) {
                btn.add_style_class_name('o-tiling-ws-btn-active');
                if (activeStyle === 'pill') {
                    btn.add_style_class_name('o-tiling-ws-btn-active-pill');
                    btn.style = `background-color: ${hintColor}; color: #ffffff; border-radius: ${radius}px;`;
                } else {
                    btn.add_style_class_name('o-tiling-ws-btn-active-outline');
                    btn.style = `box-shadow: inset 0 0 0 1.5px ${hintColor}; color: ${hintColor}; border-radius: ${radius}px;`;
                }
            } else {
                btn.style = `border-radius: ${radius}px;`;
                if (occupied && showOccupied) {
                    btn.add_style_class_name('o-tiling-ws-btn-occupied');
                } else {
                    btn.add_style_class_name('o-tiling-ws-btn-empty');
                }
            }
        }
    }

    destroy(): void {
        (global as any).workspace_manager?.disconnectObject(this);
        (global as any).display?.disconnectObject?.(this);

        for (const id of this._settingsSignals) {
            this._ext.settings.ext.disconnect(id);
        }
        this._settingsSignals = [];

        for (const btn of this._wsBtns) btn.destroy();
        this._wsBtns = [];
        this._ovBtn?.destroy();
        this._ovBtn = null;

        this.button.destroy();
    }
}

export const QuickSettingsToggle = GObject.registerClass(
class QuickSettingsToggle extends QuickMenuToggle {
    constructor(ext: Ext) {
        
        const startIcon = ext.settings.tile_by_default()
            ? ext.button_gio_icon_auto_on
            : ext.button_gio_icon_auto_off;

        super({ title: _('O-Tiling'), gicon: startIcon, toggleMode: true });
        this.checked = !ext._ext_soft_disabled;

        this.connect('clicked', () => {
            if (this.checked) {
                ext.ext_soft_enable();
            } else {
                ext.ext_soft_disable();
            }
        });

        this.menu.setHeader(startIcon, _('O-Tiling'), _('Tiling Window Management'));
        this.menu.addMenuItem(workspace_tiled(ext));
        this.menu.addMenuItem(new PopupSeparatorMenuItem());
        this.menu.addMenuItem(toggle(
            _('Active Hint'),
            ext.settings.active_hint(),
            'focus-windows-symbolic',
            (state) => ext.settings.set_active_hint(state),
        ));
        this.menu.addMenuItem(new PopupSeparatorMenuItem());
        this.menu.addMenuItem(settings_button(this.menu));
    }

    updateIcon(gicon: any): void {
        this.gicon = gicon;
        this.menu.setHeader(gicon, _('O-Tiling'), _('Tiling Window Management'));
    }
}) as unknown as { new (ext: Ext): QuickMenuToggle & { updateIcon(gicon: any): void } };

export const QuickSettingsIndicator = GObject.registerClass(
class QuickSettingsIndicator extends SystemIndicator {
    quickSettingsItems: any[];
    indicatorIcon: any;

    constructor(ext: Ext) {
        super();
        const indicatorIcon = this._addIndicator();
        // Match the main panel indicator's icon (same custom SVGs, same on/off state)
        indicatorIcon.gicon = ext.settings.tile_by_default()
            ? ext.button_gio_icon_auto_on
            : ext.button_gio_icon_auto_off;
        indicatorIcon.visible = !ext._ext_soft_disabled;
        this.indicatorIcon = indicatorIcon;

        this.quickSettingsItems = [];
        const toggleItem = new QuickSettingsToggle(ext);
        this.quickSettingsItems.push(toggleItem);

        toggleItem.bind_property(
            'checked',
            indicatorIcon,
            'visible',
            GObject.BindingFlags.SYNC_CREATE
        );
    }

    updateIcon(gicon: any): void {
        this.indicatorIcon.gicon = gicon;
        const toggleItem = this.quickSettingsItems?.[0];
        if (toggleItem && toggleItem.updateIcon) toggleItem.updateIcon(gicon);
    }

    destroy() {
        for (const item of this.quickSettingsItems) {
            item.destroy();
        }
        this.quickSettingsItems = [];
        super.destroy();
    }
});