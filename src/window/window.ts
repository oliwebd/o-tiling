import * as lib from '../utils/lib.js';
import * as log from '../utils/log.js';
import * as once_cell from '../utils/once_cell.js';
import * as Rect from '../utils/rectangle.js';
import * as Tags from '../utils/tags.js';
import * as utils from '../utils/utils.js';
import type { Entity } from '../core/ecs.js';
import type { Ext } from '../extension.js';
import type { Rectangle } from '../utils/rectangle.js';
import * as scheduler from '../system/scheduler.js';
import * as focus from './focus.js';

import Meta from 'gi://Meta';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import St from 'gi://St';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const { OnceCell } = once_cell;

export var window_tracker = Shell.WindowTracker.get_default();

/** Contains SourceID of an active hint operation. Used to clean up on extension disable. */
let ACTIVE_HINT_SHOW_ID: number | null = null;

const WM_TITLE_BLACKLIST: Array<string> = [
    'Firefox',
    'Nightly', // Firefox Nightly
    'Tor Browser',
];

enum RESTACK_STATE {
    RAISED,
    WORKSPACE_CHANGED,
    NORMAL,
}

enum RESTACK_SPEED {
    RAISED = 50,
    WORKSPACE_CHANGED = 100,
    NORMAL = 150,
}

interface X11Info {
    normal_hints: once_cell.OnceCell<lib.SizeHint | null>;
    wm_role_: once_cell.OnceCell<string | null>;
    xid_: once_cell.OnceCell<string | null>;
}

/** Cleanup global main loop sources in window module */
export function cleanup_main_loop_sources() {
    if (ACTIVE_HINT_SHOW_ID !== null) {
        GLib.source_remove(ACTIVE_HINT_SHOW_ID);
        ACTIVE_HINT_SHOW_ID = null;
    }
}

// True if Clutter key-focus is on the top panel, Quick Settings, Dash-to-Dock, or system indicators instead of a window.
function is_panel_actor(focused_actor: Clutter.Actor | null): boolean {
    if (!focused_actor) return false;

    // Fast path: check if it's inside Main.panel directly
    if ((Main as any).panel?.contains?.(focused_actor)) return true;

    // A window actor always exposes get_meta_window — bail out immediately.
    if (typeof (focused_actor as any).get_meta_window === 'function') return false;

    // Walk up the Clutter actor tree up to 20 levels.
    let actor: Clutter.Actor | null = focused_actor;
    for (let depth = 0; depth < 20 && actor !== null; depth++) {
        const style_class: string = (actor as any).style_class ?? '';
        const name: string = (actor as any).name ?? '';

        if (
            // ── Top panel buttons / corners (GNOME 48–50) ─────────────────────────
            style_class.includes('panel-button') ||
            style_class.includes('panel-corner') ||
            style_class.includes('panel-status-button') ||
            style_class.includes('activities') ||

            // ── System status / indicator area ─────────────────────────────────────
            style_class.includes('panel-status-indicators-box') ||
            style_class.includes('aggregate-menu') ||
            style_class.includes('system-status-area') ||
            style_class.includes('quick-settings') ||
            style_class.includes('quick-settings-system-item') ||
            name === 'quickSettings' ||
            name === 'quickSettingsBox' ||
            style_class.includes('clock-display') ||
            name === 'dateMenu' ||

            // ── Dock / Dash-to-Dock / Ubuntu dock ─────────────────────────────────
            style_class.includes('dash-item') ||
            style_class.includes('dash-container') ||
            style_class.includes('dashtodock') ||
            name === 'dashtodockContainer' ||
            name === 'dash' ||

            // ── Direct panel actor references ──────────────────────────────────────
            actor === (Main as any).panel ||
            actor === (Main as any).panel?.statusArea?.activities ||
            (actor as any) === (Main as any).panel?._centerBox ||
            (actor as any) === (Main as any).panel?._leftBox ||
            (actor as any) === (Main as any).panel?._rightBox
        ) {
            return true;
        }
        actor = actor.get_parent();
    }
    return false;
}

export function clutter_focus_is_shell_panel(): boolean {
    const stage = (global as any).stage;
    if (!stage) return false;

    // Check if the keyboard focus is on a shell element
    const key_actor: Clutter.Actor | null = stage.get_key_focus();
    if (is_panel_actor(key_actor)) return true;

    // Check if the pointer is hovering over a shell element
    const pointer = (global as any).get_pointer();
    if (!pointer) return false;

    const [x, y] = pointer;
    const pointer_actor = stage.get_actor_at_pos(1 /* Clutter.PickMode.REACTIVE */, x, y);
    if (is_panel_actor(pointer_actor)) return true;

    return false;
}

export class ShellWindow {
    entity: Entity;
    meta: Meta.Window;
    ext: Ext;
    stack: number | null = null;
    known_workspace: number;
    grab: boolean = false;
    activate_after_move: boolean = false;
    ignore_detach: boolean = false;
    was_attached_to?: [Entity, boolean | number];
    destroying: boolean = false;

    // Awaiting reassignment after a display update
    reassignment: boolean = false;

    // True if this window is currently smart-gapped
    smart_gapped: boolean = false;

    border: null | St.Bin = new St.Bin({
        style_class: 'o-tiling-active-hint o-tiling-border-normal',
        reactive: false,
    });

    private _restack_id: number | null = null;

    /** GLib source ID for the post-tile border-settle delay; suppresses show_border() until Mutter commits the new frame rect. */
    private _border_settle_id: number | null = null;

    prev_rect: null | Rectangle = null;

    window_app: any;

    private was_hidden: boolean = false;

    private extra: X11Info = {
        normal_hints: new OnceCell(),
        wm_role_: new OnceCell(),
        xid_: new OnceCell(),
    };

    private border_size = 0;

    constructor(entity: Entity, window: Meta.Window, window_app: any, ext: Ext) {
        this.window_app = window_app;

        this.entity = entity;
        this.meta = window;
        this.ext = ext;

        this.known_workspace = this.workspace_id();

        // Float fullscreen windows by default, such as Kodi.
        if (this.meta.is_fullscreen()) {
            ext.add_tag(entity, Tags.Floating);
        }

        if (this.may_decorate()) {
            if (!this.is_client_decorated()) {
                if (ext.settings.show_title()) {
                    this.decoration_show(ext);
                } else {
                    this.decoration_hide(ext);
                }
            }
        }

        this.bind_window_events();
        this.bind_hint_events();



        this.hide_border();
        this.restack();
        this.update_border_layout();

        if ((this.meta.get_compositor_private() as any)?.get_stage()) this.on_style_changed();
    }

    activate(move_mouse: boolean = true): void {
        activate(this.ext, move_mouse, this.meta);
    }

    actor_exists(): boolean {
        return !this.destroying && (this.meta.get_compositor_private() as any) !== null;
    }

    private bind_window_events() {
        this.ext.window_signals
            .get_or(this.entity, () => [])
            .push(
                this.meta.connect('size-changed', () => {
                    this.window_changed();
                }),
                this.meta.connect('position-changed', () => {
                    this.window_changed();
                }),
                this.meta.connect('workspace-changed', () => {
                    this.workspace_changed();
                }),
                this.meta.connect('notify::wm-class', () => {
                    this.wm_class_changed();
                }),
                this.meta.connect('raised', () => {
                    this.window_raised();
                }),
            );
    }

    private bind_hint_events() {
        if (!this.border) return;

        const settings = this.ext.settings;
        const change_id = settings.ext.connect('changed', (_, key) => {
            if (this.border) {
                if (key === 'hint-color-rgba' ||
                    key === 'active-hint-overlay-enabled' ||
                    key === 'active-hint-overlay-color-rgba' ||
                    key === 'active-hint-border-radius' ||
                    key === 'active-hint-border-width' ||
                    key === 'active-hint-overlay-opacity' ||
                    key === 'active-hint-overlay-all-windows'
                ) {
                    this.update_hint_colors();
                    this.update_border_layout();
                }
            }
            return false;
        });

        this.border.connect('destroy', () => {
            settings.ext.disconnect(change_id);
        });
        this.border.connect('style-changed', () => {
            this.on_style_changed();
        });

        this.update_hint_colors();
    }

    /** Refreshes border hint and overlay colors from current settings. */
    private update_hint_colors() {
        const settings = this.ext.settings;
        const color_value = settings.hint_color_rgba();
        const overlay_color_val = settings.active_hint_overlay_color_rgba();
        const overlay_base = overlay_color_val === 'auto' ? color_value : overlay_color_val;

        if (this.ext.overlay) {
            const orig_overlay = 'rgba(53, 132, 228, 0.3)';
            let final_color = overlay_base;

            if (overlay_color_val === 'auto') {
                if (utils.is_dark(color_value)) {
                    final_color = orig_overlay;
                } else {
                    final_color = utils.set_alpha(color_value, 0.3);
                }
            } else {
                final_color = utils.set_alpha(overlay_base, 0.3);
            }

            const radius_value = settings.active_hint_border_radius();
            this.ext.overlay.set_style(`background: ${final_color}; border-radius: ${radius_value}px;`);
        }

        this.update_border_style();
    }

    async cmdline(): Promise<string | null> {
        let pid = this.meta.get_pid(),
            out = null;
        if (-1 === pid) return out;

        const path = '/proc/' + pid + '/cmdline';
        if (!utils.exists(path)) return out;

        const result = await utils.read_to_string(path);
        if (result.kind === 1) {
            out = result.value.trim();
        } else {
            log.error(`failed to fetch cmdline: ${(result as any).value.format ? (result as any).value.format() : result.value}`);
        }

        return out;
    }

    private decoration(_ext: Ext, callback: (xid: string) => void): void {
        if (this.may_decorate()) {
            const xid = this.xid();
            if (xid) callback(xid);
        }
    }

    decoration_hide(ext: Ext): void {
        if (this.ignore_decoration()) return;
        this.was_hidden = true;
    }

    decoration_show(ext: Ext): void {
        if (!this.was_hidden) return;
    }

    icon(_ext: Ext, size: number): any {
        let icon = this.window_app.create_icon_texture(size);

        if (!icon) {
            icon = new St.Icon({
                icon_name: 'applications-other',
                icon_style: St.IconStyle.SYMBOLIC,
                icon_size: size,
            } as any);
        }

        return icon;
    }

    ignore_decoration(): boolean {
        const name = this.meta.get_wm_class();
        if (name === null) return true;
        return WM_TITLE_BLACKLIST.findIndex((n) => name.startsWith(n)) !== -1;
    }

    is_client_decorated(): boolean {
        // Undecorated normal windows are CSD on Wayland.
        if (!this.meta.decorated && this.meta.window_type === Meta.WindowType.NORMAL) {
            return true;
        }

        return false;
    }

    is_maximized(): boolean {
        return lib.is_maximized(this.meta);
    }



    is_snap_edge(): boolean {
        return this.meta.maximized_vertically && !this.meta.maximized_horizontally;
    }

    is_eligible_for_tiling(ext: Ext): boolean {
        let wm_class = this.meta.get_wm_class();

        if (wm_class !== null && wm_class.trim().length === 0) {
            wm_class = this.name(ext);
        }

        if (wm_class === null || wm_class.trim().length === 0) {
            return false;
        }

        const role = this.meta.get_role();

        if (role === 'quake') return false;

        if (this.meta.get_title() === 'Steam') {
            const rect = this.rect();

            const is_dialog = rect.width < 400 && rect.height < 200;
            const is_first_login = rect.width === 432 && rect.height === 438;

            if (is_dialog || is_first_login) return false;
        }

        if (wm_class !== null && ext.conf.window_shall_float(wm_class, this.title())) {
            return ext.contains_tag(this.entity, Tags.ForceTile);
        }

        return (
            this.meta.window_type == Meta.WindowType.NORMAL &&
            !this.is_transient() &&
            wm_class !== null
        );
    }

    is_tilable(ext: Ext): boolean {
        return !ext.contains_tag(this.entity, Tags.Floating) && this.is_eligible_for_tiling(ext);
    }

    is_transient(): boolean {
        return this.meta.get_transient_for() !== null;
    }

    may_decorate(): boolean {
        return false;
    }

    move(ext: Ext, rect: Rectangle, on_complete?: () => void) {
        if (!this.same_workspace() && this.is_maximized()) {
            return;
        }

        this.hide_border();

        const max_width = ext.settings.max_window_width();
        if (max_width > 0 && rect.width > max_width) {
            rect.x += (rect.width - max_width) / 2;
            rect.width = max_width;
        }

        const clone = Rect.Rectangle.from_meta(rect);
        const meta = this.meta;
        const actor = meta.get_compositor_private() as any;

        if (actor) {
            if (this.is_maximized()) {
                lib.unmaximize(this.meta);
            }
            (actor as any).remove_transition('translation-x');
            (actor as any).remove_transition('translation-y');

            ext.movements.insert(this.entity, clone);

            ext.register({ tag: 2, window: this, kind: { tag: 1 } });
            if (on_complete) ext.register_fn(on_complete);
            if (meta.appears_focused) {
                this.update_border_layout();
                ext.show_border_on_focused();
            }
        }
    }

    name(ext: Ext): string {
        return ext.names.get_or(this.entity, () => 'unknown');
    }

    private on_style_changed() {
        if (!this.border) return;
        if (!this.border.get_stage()) return;
        this.border_size = this.border.get_theme_node().get_border_width(St.Side.TOP);
    }

    rect(): Rectangle {
        return Rect.Rectangle.from_meta(this.meta.get_frame_rect());
    }

    size_hint(): lib.SizeHint | null {
        return this.extra.normal_hints.get_or_init(() => null);
    }

    swap(ext: Ext, other: ShellWindow): void {
        const ar = this.rect().clone();
        const br = other.rect().clone();

        other.move(ext, ar);
        this.move(ext, br, () => place_pointer_on(this.ext, this.meta));
    }

    title(): string {
        const title = this.meta.get_title();
        return title ? title : this.name(this.ext);
    }

    wm_role(): string | null {
        return this.extra.wm_role_.get_or_init(() => {
            return this.meta.get_role() || null;
        });
    }

    workspace_id(): number {
        const workspace = this.meta.get_workspace();
        if (workspace) {
            return workspace.index();
        } else {
            this.meta.change_workspace_by_index(0, false);
            return 0;
        }
    }

    xid(): string | null {
        return this.extra.xid_.get_or_init(() => {
            if (this.meta.get_client_type() === Meta.WindowClientType.WAYLAND) return null;
            const desc = this.meta.get_description();
            if (!desc) return null;
            const match = desc.match(/0x[a-f0-9]+/i);
            return match ? match[0] : null;
        });
    }

    show_border() {
        if (!this.border) return;

        // Bail while the settle timer is active; mark_border_settling() will re-show once geometry is final.
        if (this._border_settle_id !== null) return;

        this.update_border_layout();
        this.update_border_style();

        if (this.ext.settings.active_hint()) {
            const border = this.border;

            const permitted = () =>
                this.actor_exists() &&
                this.ext.focus_window() == this &&
                !this.meta.is_fullscreen() &&
                (!this.is_maximized() || this.is_snap_edge()) &&
                !this.meta.minimized &&
                this.meta.appears_focused &&
                !this.smart_gapped;

            if (permitted()) {
                this.restack();
                border.show();

                if (ACTIVE_HINT_SHOW_ID !== null) GLib.source_remove(ACTIVE_HINT_SHOW_ID);
                ACTIVE_HINT_SHOW_ID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
                    ACTIVE_HINT_SHOW_ID = null;
                    if (permitted()) {
                        this.update_border_layout();
                        border.show();
                    } else {
                        border.hide();
                    }
                    return GLib.SOURCE_REMOVE;
                });
            } else {
                border.hide();
            }
        }
    }

    /** Hides the border and defers show_border() by 120 ms so Mutter can commit the post-tile frame rect. */
    mark_border_settling() {
        // Cancel any previous settle timer.
        if (this._border_settle_id !== null) {
            GLib.source_remove(this._border_settle_id);
            this._border_settle_id = null;
        }

        this.hide_border();

        this._border_settle_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
            this._border_settle_id = null;
            // Show only if the border/actor still exist and this window is still focused.
            if (this.border && this.actor_exists() && this.ext.focus_window() === this &&
                !this.meta.is_fullscreen() &&
                (!this.is_maximized() || this.is_snap_edge()) &&
                !this.smart_gapped) {
                this.show_border();
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    same_workspace() {
        const workspace = this.meta.get_workspace();
        if (workspace) {
            const workspace_id = workspace.index();
            return workspace_id === (global as any).workspace_manager.get_active_workspace_index();
        }
        return false;
    }

    same_monitor() {
        return this.meta.get_monitor() === lib.active_monitor_index();
    }


    /** Sorts the window/always-top group with each window border based on the update state (NORMAL, RAISED, WORKSPACE_CHANGED). */
    restack(_updateState: RESTACK_STATE = RESTACK_STATE.NORMAL, immediate: boolean = false) {
        this.update_border_layout();
        if (
            this.meta.is_fullscreen() ||
            (this.is_maximized() && !this.is_snap_edge()) ||
            this.meta.minimized
        ) {
            this.hide_border();
            return;
        }

        let id: number;
        const action = () => {
            if (typeof id !== 'undefined' && this._restack_id === id) {
                this._restack_id = null;
            }

            if (!this.border) return GLib.SOURCE_REMOVE;

            if (!this.actor_exists()) return GLib.SOURCE_REMOVE;

            const border = this.border;
            const actor = (this.meta.get_compositor_private() as any);
            if (!actor || !border) return GLib.SOURCE_REMOVE;

            const parent = actor.get_parent();
            if (!parent) return GLib.SOURCE_REMOVE;

            this.update_border_layout();

            if (border.get_parent() !== parent) {
                if (border.get_parent()) {
                    border.get_parent()!.remove_child(border);
                }
                parent.add_child(border);
            }

            parent.set_child_above_sibling(border, actor);


            for (const above_actor of (global as any).get_window_actors()) {
                const meta = above_actor.get_meta_window();
                if (!meta || !meta.is_above()) continue;
                if (above_actor !== actor && above_actor.get_parent() === parent) {
                    parent.set_child_below_sibling(border, above_actor);
                    break;
                }
            }

            const siblings: Array<any> = parent.get_children();
            const candidates: Set<any> = new Set();

            for (const window of this.ext.windows.values()) {
                const trans_parent = window.meta.get_transient_for();
                if (!trans_parent) continue;
                const parent_actor = trans_parent.get_compositor_private() as any;
                if (parent_actor !== actor) continue;
                const window_actor = window.meta.get_compositor_private() as any;
                if (window_actor && window_actor.get_parent() === parent) {
                    candidates.add(window_actor);
                }
            }

            for (const popup_actor of (global as any).get_window_actors()) {
                const wtype = popup_actor.get_meta_window()?.get_window_type();
                if (
                    wtype === Meta.WindowType.DROPDOWN_MENU ||
                    wtype === Meta.WindowType.POPUP_MENU ||
                    wtype === Meta.WindowType.COMBO ||
                    wtype === Meta.WindowType.TOOLTIP
                ) {
                    if (popup_actor.get_parent() === parent) {
                        candidates.add(popup_actor);
                    }
                }
            }

            if (candidates.size > 0) {
                // Find the candidate with the lowest index among siblings (closest to bottom).
                let lowest: any = null;
                let lowest_idx = siblings.length;
                for (const candidate of candidates) {
                    const idx = siblings.indexOf(candidate);
                    if (idx !== -1 && idx < lowest_idx) {
                        lowest_idx = idx;
                        lowest = candidate;
                    }
                }
                if (lowest !== null) {
                    parent.set_child_below_sibling(border, lowest);
                }
            }

            return GLib.SOURCE_REMOVE;
        };

        const old_id = this._restack_id;
        this._restack_id = null;
        if (old_id !== null) lib.later_remove(old_id);
        if (immediate) {
            action();
        } else {
            id = lib.later_add(Meta.LaterType.BEFORE_REDRAW, action);
            this._restack_id = id;
        }
    }

    hide_border() {
        // Cancel the settle timer so it cannot re-show the border after an explicit hide.
        if (this._border_settle_id !== null) {
            GLib.source_remove(this._border_settle_id);
            this._border_settle_id = null;
        }
        const b = this.border;
        if (b) b.hide();
    }

    update_border_layout() {
        let { x, y, width, height } = this.meta.get_frame_rect();

        const border = this.border;
        // Read live from theme node to avoid cache staleness during rapid window_changed events.
        let borderSize = (border?.get_stage())
            ? border.get_theme_node().get_border_width(St.Side.TOP)
            : this.border_size;

        if (border) {
            if (!(this.is_maximized() || this.is_snap_edge())) {
                border.remove_style_class_name('o-tiling-border-maximize');
            } else {
                borderSize = 0;
                border.add_style_class_name('o-tiling-border-maximize');
            }

            const stack_number = this.stack;
            let dimensions = null;

            if (stack_number !== null) {
                const stack = this.ext.auto_tiler?.forest.stacks.get(stack_number);
                if (stack) {
                    let stack_tab_height = stack.tabs_height;

                    if (borderSize === 0 || this.grab) {
                        stack_tab_height = 0;
                    }

                    dimensions = [
                        x - borderSize,
                        y - stack_tab_height - borderSize,
                        width + 2 * borderSize,
                        height + stack_tab_height + 2 * borderSize,
                    ];
                }
            } else {
                dimensions = [x - borderSize, y - borderSize, width + 2 * borderSize, height + 2 * borderSize];
            }

            if (dimensions) {
                [x, y, width, height] = dimensions;

                const workspace = this.meta.get_workspace();

                if (workspace === null) return;

                border.set_position(x, y);
                border.set_size(width, height);
            }
        }
    }

    update_border_style() {
        const { settings } = this.ext;
        const color_value = settings.hint_color_rgba();
        const radius_value = settings.active_hint_border_radius();
        const width_value = settings.active_hint_border_width();

        // The tint overlay is only active when explicitly enabled.
        const overlay_enabled = settings.active_hint_overlay_enabled();
        const overlay_opacity = overlay_enabled ? settings.active_hint_overlay_opacity() / 100 : 0;

        // true (default) = tint focused only; false = tint all tiled windows.
        const only_active = settings.active_hint_overlay_only_active();

        if (this.border) {
            const is_focused = this.meta.appears_focused;
            const overlay_color_val = settings.active_hint_overlay_color_rgba();
            // 'auto' means fall back to the GNOME accent / border color.
            const overlay_base = overlay_color_val === 'auto' ? color_value : overlay_color_val;

            const is_maximized_os = this.is_maximized() || this.is_snap_edge();
            let current_radius = is_maximized_os ? 0 : radius_value;

            if (!is_maximized_os && this.is_browser()) {
                current_radius = Math.min(current_radius, 12);
            }

            // show_tint: overlay enabled + not maximized + (focused-only mode requires focus)
            const show_tint = overlay_opacity > 0 && !is_maximized_os &&
                (only_active ? is_focused : true);

            if (is_focused) {
                const total_radius = current_radius + width_value;
                let style = `border-color: ${color_value}; border-radius: ${total_radius}px; border-width: ${width_value}px; outline: none; background-clip: padding-box; box-shadow: none;`;

                if (show_tint) {
                    const overlay_color = utils.set_alpha(overlay_base, overlay_opacity);
                    style += ` background-color: ${overlay_color};`;
                } else {
                    style += ' background-color: rgba(0, 0, 0, 0.01);';
                }

                this.border.set_style(style);
            } else {
                const total_radius = current_radius;
                let style = `border-color: transparent; border-radius: ${total_radius}px; border-width: 0px; outline: none; background-clip: padding-box; box-shadow: none;`;

                if (show_tint) {
                    const overlay_color = utils.set_alpha(overlay_base, overlay_opacity);
                    style += ` background-color: ${overlay_color};`;
                } else {
                    style += ' background-color: rgba(0, 0, 0, 0.01);';
                }

                this.border.set_style(style);
            }
        }
    }

    private wm_class_changed() {
        if (this.is_tilable(this.ext)) {
            this.ext.connect_window(this);
            if (!this.meta.minimized) {
                this.ext.auto_tiler?.auto_tile(this.ext, this);
            }
        }
    }

    private window_changed() {
        if (clutter_focus_is_shell_panel()) return; // skip if focus is on a shell panel/dock
        this.update_border_layout();
        if (!this.meta.appears_focused) return; // skip border pipeline if not focused
        this.ext.show_border_on_focused();
    }

    private window_raised() {
        log.debug(`window_raised: ${this.meta.get_wm_class()}`);
        if (clutter_focus_is_shell_panel()) return; // skip if Clutter focus is on panel/dock
        if (!this.meta.appears_focused) return;     // skip spurious raises after focus loss
        this.restack(RESTACK_STATE.RAISED, true);
        if (this.ext._bordered_entity === this.entity) return; // already owns the border
        this.ext.show_border_on_focused();
    }

    private workspace_changed() {
        this.restack(RESTACK_STATE.WORKSPACE_CHANGED, true);
    }


    private is_browser(): boolean {
        const wm_class = this.meta.get_wm_class();
        if (!wm_class) return false;
        const browsers = ['firefox', 'chrome', 'chromium', 'brave', 'opera', 'vivaldi'];
        return browsers.some((b) => wm_class.toLowerCase().includes(b));
    }

    destroy() {
        this.destroying = true;
        if (this._restack_id !== null) {
            lib.later_remove(this._restack_id);
            this._restack_id = null;
        }
        if (this._border_settle_id !== null) {
            GLib.source_remove(this._border_settle_id);
            this._border_settle_id = null;
        }
        if (this.border) {
            this.border.destroy();
            this.border = null;
        }
    }
}

/// Activates a window, and moves the mouse point.
export function activate(ext: Ext, move_mouse: boolean, win: Meta.Window) {
    try {
        if (!(win.get_compositor_private() as any)) return;

        if (ext.get_window(win)?.destroying) return;

        if (win.is_override_redirect()) return;

        const workspace = win.get_workspace();
        if (!workspace) return;

        scheduler.setForeground(win);

        win.unminimize();
        workspace.activate_with_focus(win, Clutter.get_current_event_time());
        win.raise();

        const pointer_placement_permitted =
            move_mouse &&
            !(Main as any).isModal &&
            !(Main as any).layoutManager?.modalDialogGroup?.get_children()?.length &&
            ext.settings.mouse_cursor_follows_active_window() &&
            !pointer_already_on_window(win) &&
            pointer_in_work_area();

        if (pointer_placement_permitted) {
            place_pointer_on(ext, win);
        }
    } catch (error) {
        log.error(`failed to activate window: ${error}`);
    }
}

function pointer_in_work_area(): boolean {
    const cursor = lib.cursor_rect();
    const indice = lib.active_monitor_index();
    const mon = (global as any).workspace_manager.get_active_workspace().get_work_area_for_monitor(indice);

    return mon ? cursor.intersects(mon) : false;
}

function place_pointer_on(ext: Ext, win: Meta.Window) {
    const rect = win.get_frame_rect();
    let x = rect.x;
    let y = rect.y;

    const key = Object.keys(focus.FocusPosition)[ext.settings.mouse_cursor_focus_location()];
    const pointer_position_ = focus.FocusPosition[key as keyof typeof focus.FocusPosition];

    switch (pointer_position_) {
        case focus.FocusPosition.TopLeft:
            x += 8;
            y += 8;
            break;
        case focus.FocusPosition.BottomLeft:
            x += 8;
            y += rect.height - 16;
            break;
        case focus.FocusPosition.TopRight:
            x += rect.width - 16;
            y += 8;
            break;
        case focus.FocusPosition.BottomRight:
            x += rect.width - 16;
            y += rect.height - 16;
            break;
        case focus.FocusPosition.Center:
            x += rect.width / 2 + 8;
            y += rect.height / 2 + 8;
            break;
        default:
            x += 8;
            y += 8;
    }

    (global as any).stage.get_context().get_backend().get_default_seat().warp_pointer(x, y);
}

function pointer_already_on_window(meta: Meta.Window): boolean {
    const cursor = lib.cursor_rect();

    return cursor.intersects(meta.get_frame_rect());
}