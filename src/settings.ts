import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import { get_current_path } from './paths.js';
import * as utils from './utils.js';

const DARK = ['dark', 'adapta', 'plata', 'dracula'];

// Use Gio.Settings directly as our Settings type
type Settings = Gio.Settings;

function settings_new_id(schema_id: string): Settings | null {
    try {
        return new Gio.Settings({ schema_id });
    } catch (why) {
        if (schema_id !== 'org.gnome.shell.extensions.user-theme') {
            // (global as any).log(`failed to get settings for ${schema_id}: ${why}`);
        }

        return null;
    }
}

function settings_new_schema(schema: string): Settings {
    const GioSSS = Gio.SettingsSchemaSource;
    const schemaDir = Gio.File.new_for_path(get_current_path()).get_child('schemas');

    const defaultSource = GioSSS.get_default();

    let schemaSource = (schemaDir.query_exists(null) && defaultSource)
        ? GioSSS.new_from_directory(schemaDir.get_path()!, defaultSource, false)
        : defaultSource;

    if (!schemaSource) {
        throw new Error('Could not load GSettings schema source for o-tiling.');
    }

    const schemaObj = schemaSource.lookup(schema, true);

    if (!schemaObj) {
        throw new Error(
            'Schema ' + schema + ' could not be found for extension o-tiling. Please check your installation.',
        );
    }

    return new Gio.Settings({ settings_schema: schemaObj });
}

const ACTIVE_HINT = 'active-hint';
const ACTIVE_HINT_BORDER_RADIUS = 'active-hint-border-radius';
const ACTIVE_HINT_BORDER_WIDTH = 'active-hint-border-width';
const STACKING_WITH_MOUSE = 'stacking-with-mouse';
const COLUMN_SIZE = 'column-size';
const EDGE_TILING = 'edge-tiling';
const GAP_INNER = 'gap-inner';
const GAP_OUTER = 'gap-outer';
const ROW_SIZE = 'row-size';
const SHOW_TITLE = 'show-title';
const SMART_GAPS = 'smart-gaps';
const SNAP_TO_GRID = 'snap-to-grid';
const TILE_BY_DEFAULT = 'tile-by-default';
const HINT_COLOR_RGBA = 'hint-color-rgba';
const DEFAULT_RGBA_COLOR = 'rgba(53, 132, 228, 1)'; // Aura Blue
const LOG_LEVEL = 'log-level';
const SHOW_SKIPTASKBAR = 'show-skip-taskbar';
const MOUSE_CURSOR_FOLLOWS_ACTIVE_WINDOW = 'mouse-cursor-follows-active-window';
const MOUSE_CURSOR_FOCUS_LOCATION = 'mouse-cursor-focus-location';
const MAX_WINDOW_WIDTH = 'max-window-width';
const ACTIVE_HINT_OVERLAY_OPACITY = 'active-hint-overlay-opacity';
const ACTIVE_HINT_GLOW_OPACITY = 'active-hint-glow-opacity';
const ACTIVE_HINT_GLOW = 'active-hint-glow';

export class ExtensionSettings {
    ext: Settings = settings_new_schema('org.gnome.shell.extensions.o-tiling');
    int: Settings | null = settings_new_id('org.gnome.desktop.interface');
    mutter: Settings | null = settings_new_id('org.gnome.mutter');
    shell: Settings | null = settings_new_id('org.gnome.shell.extensions.user-theme');

    // Getters

    active_hint(): boolean {
        return this.ext.get_boolean(ACTIVE_HINT);
    }

    active_hint_border_radius(): number {
        return this.ext.get_uint(ACTIVE_HINT_BORDER_RADIUS);
    }

    active_hint_border_width(): number {
        return this.ext.get_uint(ACTIVE_HINT_BORDER_WIDTH);
    }

    stacking_with_mouse(): boolean {
        return this.ext.get_boolean(STACKING_WITH_MOUSE);
    }

    column_size(): number {
        return this.ext.get_uint(COLUMN_SIZE);
    }

    dynamic_workspaces(): boolean {
        return this.mutter ? this.mutter.get_boolean('dynamic-workspaces') : false;
    }


    gap_inner(): number {
        return this.ext.get_uint(GAP_INNER);
    }

    gap_outer(): number {
        return this.ext.get_uint(GAP_OUTER);
    }

    get_system_accent_color(): string {
        if (!this.int) return DEFAULT_RGBA_COLOR;

        try {
            const accent = this.int.get_string('accent-color');
            const map: Record<string, string> = {
                'blue': 'rgba(53, 132, 228, 1)',
                'teal': 'rgba(33, 144, 175, 1)',
                'green': 'rgba(58, 148, 74, 1)',
                'yellow': 'rgba(200, 136, 0, 1)',
                'orange': 'rgba(237, 91, 0, 1)',
                'red': 'rgba(224, 27, 36, 1)',
                'pink': 'rgba(205, 64, 119, 1)',
                'purple': 'rgba(145, 65, 172, 1)',
                'slate': 'rgba(111, 119, 131, 1)',
            };
            return map[accent] || DEFAULT_RGBA_COLOR;
        } catch (e) {
            return DEFAULT_RGBA_COLOR;
        }
    }

    hint_color_rgba() {
        let rgba = this.ext.get_string(HINT_COLOR_RGBA);
        
        if (rgba === 'auto') {
            return this.get_system_accent_color();
        }

        let valid_color = utils.isValidColor(rgba);

        if (!valid_color) {
            return this.get_system_accent_color();
        }

        return rgba;
    }

    theme(): string {
        return this.shell ? this.shell.get_string('name') : this.int ? this.int.get_string('gtk-theme') : 'Adwaita';
    }

    is_dark(): boolean {
        const theme = this.theme().toLowerCase();
        return DARK.some((dark) => theme.includes(dark));
    }

    is_high_contrast(): boolean {
        return this.theme().toLowerCase() === 'highcontrast';
    }

    row_size(): number {
        return this.ext.get_uint(ROW_SIZE);
    }

    show_title(): boolean {
        return this.ext.get_boolean(SHOW_TITLE);
    }

    smart_gaps(): boolean {
        return this.ext.get_boolean(SMART_GAPS);
    }

    snap_to_grid(): boolean {
        return this.ext.get_boolean(SNAP_TO_GRID);
    }

    tile_by_default(): boolean {
        return this.ext.get_boolean(TILE_BY_DEFAULT);
    }

    workspaces_only_on_primary(): boolean {
        return this.mutter ? this.mutter.get_boolean('workspaces-only-on-primary') : false;
    }

    log_level(): number {
        return this.ext.get_uint(LOG_LEVEL);
    }

    show_skiptaskbar(): boolean {
        return this.ext.get_boolean(SHOW_SKIPTASKBAR);
    }

    mouse_cursor_follows_active_window(): boolean {
        return this.ext.get_boolean(MOUSE_CURSOR_FOLLOWS_ACTIVE_WINDOW);
    }

    mouse_cursor_focus_location(): number {
        return this.ext.get_uint(MOUSE_CURSOR_FOCUS_LOCATION);
    }

    max_window_width(): number {
        return this.ext.get_uint(MAX_WINDOW_WIDTH);
    }

    active_hint_overlay_opacity(): number {
        return this.ext.get_uint(ACTIVE_HINT_OVERLAY_OPACITY);
    }

    active_hint_glow_opacity(): number {
        return this.ext.get_uint(ACTIVE_HINT_GLOW_OPACITY);
    }

    active_hint_glow(): boolean {
        return this.ext.get_boolean(ACTIVE_HINT_GLOW);
    }

    force_rounded_corners(): boolean {
        return this.ext.get_boolean('force-rounded-corners');
    }

    // Setters

    set_active_hint(set: boolean) {
        this.ext.set_boolean(ACTIVE_HINT, set);
    }

    set_active_hint_border_radius(set: number) {
        this.ext.set_uint(ACTIVE_HINT_BORDER_RADIUS, set);
    }

    set_active_hint_border_width(set: number) {
        this.ext.set_uint(ACTIVE_HINT_BORDER_WIDTH, set);
    }

    set_stacking_with_mouse(set: boolean) {
        this.ext.set_boolean(STACKING_WITH_MOUSE, set);
    }

    set_column_size(size: number) {
        this.ext.set_uint(COLUMN_SIZE, size);
    }

    set_edge_tiling(enable: boolean) {
        this.mutter?.set_boolean(EDGE_TILING, enable);
    }


    set_gap_inner(gap: number) {
        this.ext.set_uint(GAP_INNER, gap);
    }

    set_gap_outer(gap: number) {
        this.ext.set_uint(GAP_OUTER, gap);
    }

    set_hint_color_rgba(rgba: string) {
        let valid_color = utils.isValidColor(rgba);

        if (valid_color) {
            this.ext.set_string(HINT_COLOR_RGBA, rgba);
        } else {
            this.ext.set_string(HINT_COLOR_RGBA, DEFAULT_RGBA_COLOR);
        }
    }

    set_row_size(size: number) {
        this.ext.set_uint(ROW_SIZE, size);
    }

    set_show_title(set: boolean) {
        this.ext.set_boolean(SHOW_TITLE, set);
    }

    set_smart_gaps(set: boolean) {
        this.ext.set_boolean(SMART_GAPS, set);
    }

    set_snap_to_grid(set: boolean) {
        this.ext.set_boolean(SNAP_TO_GRID, set);
    }

    set_tile_by_default(set: boolean) {
        this.ext.set_boolean(TILE_BY_DEFAULT, set);
    }

    set_log_level(set: number) {
        this.ext.set_uint(LOG_LEVEL, set);
    }

    set_show_skiptaskbar(set: boolean) {
        this.ext.set_boolean(SHOW_SKIPTASKBAR, set);
    }

    set_mouse_cursor_follows_active_window(set: boolean) {
        this.ext.set_boolean(MOUSE_CURSOR_FOLLOWS_ACTIVE_WINDOW, set);
    }

    set_mouse_cursor_focus_location(set: number) {
        this.ext.set_uint(MOUSE_CURSOR_FOCUS_LOCATION, set);
    }

    set_max_window_width(set: number) {
        this.ext.set_uint(MAX_WINDOW_WIDTH, set);
    }

    set_active_hint_overlay_opacity(set: number) {
        this.ext.set_uint(ACTIVE_HINT_OVERLAY_OPACITY, set);
    }

    set_active_hint_glow_opacity(set: number) {
        this.ext.set_uint(ACTIVE_HINT_GLOW_OPACITY, set);
    }

    set_active_hint_glow(set: boolean) {
        this.ext.set_boolean(ACTIVE_HINT_GLOW, set);
    }

    set_force_rounded_corners(set: boolean) {
        this.ext.set_boolean('force-rounded-corners', set);
    }

    reset_all() {
        const keys = this.ext.list_keys();
        keys.forEach((key) => this.ext.reset(key));
    }
}
