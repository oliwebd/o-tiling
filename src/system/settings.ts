import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import { get_current_path } from '../utils/paths.js';
import * as utils from '../utils/utils.js';

const DARK = ['dark', 'adapta', 'plata', 'dracula'];

const ACCENT_COLOR_MAP: Record<string, string> = {
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

    const schemaSource = (schemaDir.query_exists(null) && defaultSource)
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
const NEW_WORKSPACES_TILED = 'new-workspaces-tiled';
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
const WORKSPACE_SWITCHER_STYLE = 'workspace-switcher-style';
const WORKSPACE_THUMBNAIL_CORNER_RADIUS = 'workspace-thumbnail-corner-radius';
const WORKSPACE_SWITCHER_SIZE = 'workspace-switcher-size';
const WORKSPACE_BACKGROUND_CORNER_SIZE = 'workspace-background-corner-size';
const THEME_CONSISTENCY = 'theme-consistency';
const THEME_CONSISTENCY_STYLE = 'theme-consistency-style';
const SKIP_OVERVIEW = 'skip-overview';
const SHOW_MINIMIZE_MAXIMIZE_BUTTONS = 'show-minimize-maximize-buttons';
const SHOW_CLOSE_BUTTON = 'show-close-button';
const WORKSPACE_OVERVIEW_LARGE_ACTIVE = 'workspace-overview-large-active';
const PANEL_TRANSPARENCY = 'panel-transparency';
const PANEL_TRANSPARENCY_OPACITY = 'panel-transparency-opacity';
const PANEL_TRANSPARENCY_BLUR_STYLE = 'panel-transparency-blur-style';



export class ExtensionSettings {
    ext: Settings = settings_new_schema('org.gnome.shell.extensions.o-tiling');
    int: Settings | null = settings_new_id('org.gnome.desktop.interface');
    mutter: Settings | null = settings_new_id('org.gnome.mutter');
    shell: Settings | null = settings_new_id('org.gnome.shell.extensions.user-theme');
    wm: Settings | null = settings_new_id('org.gnome.desktop.wm.preferences');

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
            return ACCENT_COLOR_MAP[accent] ?? DEFAULT_RGBA_COLOR;
        } catch (e) {
            return DEFAULT_RGBA_COLOR;
        }
    }

    hint_color_rgba() {
        const rgba = this.ext.get_string(HINT_COLOR_RGBA);

        if (rgba === 'auto') {
            return this.get_system_accent_color();
        }

        const valid_color = utils.isValidColor(rgba);

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

    new_workspaces_tiled(): boolean {
        return this.ext.get_boolean(NEW_WORKSPACES_TILED);
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

    workspace_switcher_style(): boolean {
        return this.ext.get_boolean(WORKSPACE_SWITCHER_STYLE);
    }


    workspace_thumbnail_corner_radius(): number {
        return this.ext.get_uint(WORKSPACE_THUMBNAIL_CORNER_RADIUS);
    }

    workspace_switcher_size(): number {
        return this.ext.get_uint(WORKSPACE_SWITCHER_SIZE);
    }

    workspace_background_corner_size(): number {
        return this.ext.get_uint(WORKSPACE_BACKGROUND_CORNER_SIZE);
    }

    theme_consistency(): boolean {
        return this.ext.get_boolean(THEME_CONSISTENCY);
    }

    theme_consistency_style(): string {
        return this.ext.get_string(THEME_CONSISTENCY_STYLE);
    }

    skip_overview(): boolean {
        return this.ext.get_boolean(SKIP_OVERVIEW);
    }

    show_minimize_maximize_buttons(): boolean {
        return this.ext.get_boolean(SHOW_MINIMIZE_MAXIMIZE_BUTTONS);
    }

    show_close_button(): boolean {
        return this.ext.get_boolean(SHOW_CLOSE_BUTTON);
    }

    workspace_overview_large_active(): boolean {
        return this.ext.get_boolean(WORKSPACE_OVERVIEW_LARGE_ACTIVE);
    }

    panel_transparency(): boolean {
        return this.ext.get_boolean(PANEL_TRANSPARENCY);
    }

    panel_transparency_opacity(): number {
        return this.ext.get_uint(PANEL_TRANSPARENCY_OPACITY);
    }

    panel_transparency_blur_style(): boolean {
        return this.ext.get_boolean(PANEL_TRANSPARENCY_BLUR_STYLE);
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
        const valid_color = utils.isValidColor(rgba);

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

    set_new_workspaces_tiled(set: boolean) {
        this.ext.set_boolean(NEW_WORKSPACES_TILED, set);
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

    set_workspace_switcher_style(set: boolean) {
        this.ext.set_boolean(WORKSPACE_SWITCHER_STYLE, set);
    }


    set_workspace_thumbnail_corner_radius(set: number) {
        this.ext.set_uint(WORKSPACE_THUMBNAIL_CORNER_RADIUS, set);
    }

    set_workspace_switcher_size(set: number) {
        this.ext.set_uint(WORKSPACE_SWITCHER_SIZE, set);
    }

    set_workspace_background_corner_size(set: number) {
        this.ext.set_uint(WORKSPACE_BACKGROUND_CORNER_SIZE, set);
    }

    set_theme_consistency(set: boolean) {
        this.ext.set_boolean(THEME_CONSISTENCY, set);
    }

    set_theme_consistency_style(style: string) {
        this.ext.set_string(THEME_CONSISTENCY_STYLE, style);
    }

    set_skip_overview(set: boolean) {
        this.ext.set_boolean(SKIP_OVERVIEW, set);
    }

    set_workspace_overview_large_active(set: boolean) {
        this.ext.set_boolean(WORKSPACE_OVERVIEW_LARGE_ACTIVE, set);
    }

    set_panel_transparency(v: boolean) {
        this.ext.set_boolean(PANEL_TRANSPARENCY, v);
    }

    set_panel_transparency_opacity(v: number) {
        this.ext.set_uint(PANEL_TRANSPARENCY_OPACITY, v);
    }

    set_panel_transparency_blur_style(v: boolean) {
        this.ext.set_boolean(PANEL_TRANSPARENCY_BLUR_STYLE, v);
    }




    reset_all() {
        const keys = this.ext.list_keys();
        keys.forEach((key) => this.ext.reset(key));
    }
}
