import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as log from './utils/log.js';
import { applyThemeConsistency, restoreGtkDefaults } from './ui/theme_consistency/apply.js';

export default class OTilingPreferences extends ExtensionPreferences {
    async fillPreferencesWindow(window: Adw.PreferencesWindow) {
        const settings = this.getSettings();

        // Compact fixed-size window, close button only (no minimize/maximize)
        window.set_default_size(720, 650);
        window.resizable = false;
        // Show only the close button in the titlebar (Gtk already imported above)
        Gtk.Settings.get_default()?.set_property('gtk-decoration-layout', 'close:');

        const behaviorPage = new Adw.PreferencesPage({
            title: _('Behavior'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(behaviorPage);

        // Tiling Group
        const tilingGroup = new Adw.PreferencesGroup({
            title: _('Tiling'),
        });
        behaviorPage.add(tilingGroup);

        const tileByDefault = new Adw.SwitchRow({
            title: _('Tile Windows by Default'),
            subtitle: _('Automatically tile new windows as they are opened'),
        });
        tilingGroup.add(tileByDefault);
        settings.bind('tile-by-default', tileByDefault as any, 'active', Gio.SettingsBindFlags.DEFAULT);


        const snapToGrid = new Adw.SwitchRow({
            title: _('Snap to Grid (Floating Mode)'),
            subtitle: _('Snap floating windows to a grid while moving or resizing'),
        });
        tilingGroup.add(snapToGrid);
        settings.bind('snap-to-grid', snapToGrid as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const smartGaps = new Adw.SwitchRow({
            title: _('Smart Gaps'),
            subtitle: _('Remove gaps when only one window is tiled on the screen'),
        });
        tilingGroup.add(smartGaps);
        settings.bind('smart-gaps', smartGaps as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const placementRow = new Adw.ComboRow({
            title: _('New Window Placement'),
            subtitle: _('Where to place a new window when auto-tiling'),
            model: Gtk.StringList.new([_('Active Window (default)'), _('Largest Window')]),
        });
        tilingGroup.add(placementRow);
        const placementValues = ['focused', 'largest'];
        placementRow.set_selected(Math.max(0, placementValues.indexOf(settings.get_string('new-window-placement'))));
        placementRow.connect('notify::selected', () => {
            settings.set_string('new-window-placement', placementValues[placementRow.selected] ?? 'focused');
        });
        settings.connect('changed::new-window-placement', () => {
            const idx = Math.max(0, placementValues.indexOf(settings.get_string('new-window-placement')));
            if (placementRow.selected !== idx) placementRow.set_selected(idx);
        });

        const appearancePage = new Adw.PreferencesPage({
            title: _('Appearance'),
            icon_name: 'preferences-desktop-theme-symbolic',
        });
        window.add(appearancePage);

        // Appearance Group
        const appearanceGroup = new Adw.PreferencesGroup({
            title: _('Window'),
        });
        appearancePage.add(appearanceGroup);

        const showTitle = new Adw.SwitchRow({
            title: _('Show Window Titles'),
            subtitle: _('Display title bars on tiled windows'),
        });
        appearanceGroup.add(showTitle);
        settings.bind('show-title', showTitle as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showMinMax = new Adw.SwitchRow({
            title: _('Show Minimize and Maximize Buttons'),
            subtitle: _('Show standard window controls on title bars'),
        });
        appearanceGroup.add(showMinMax);
        settings.bind('show-minimize-maximize-buttons', showMinMax as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showClose = new Adw.SwitchRow({
            title: _('Show Close Button'),
            subtitle: _('Show the close button on title bars'),
        });
        appearanceGroup.add(showClose);
        settings.bind('show-close-button', showClose as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const themesConsistencyRow = new Adw.ComboRow({
            title: _('Themes Consistency'),
            subtitle: _('Stock GNOME, Rounded Corners, or Sharp Corners'),
            model: Gtk.StringList.new([_('Default'), _('Rounded'), _('Sharp')]),
        });
        appearanceGroup.add(themesConsistencyRow);

        // Bind the combo row index to our enum setting
        themesConsistencyRow.connect('notify::selected', async () => {
            const selected = themesConsistencyRow.selected;
            const style = selected === 0 ? 'default' : selected === 1 ? 'rounded' : 'sharp';
            settings.set_string('theme-consistency-style', style);

            // Apply GTK theme consistency immediately
            if (style !== 'default') {
                await applyThemeConsistency(style as 'rounded' | 'sharp');
            } else {
                await restoreGtkDefaults();
            }
        });

        // Set initial value
        const currentStyle = settings.get_string('theme-consistency-style');
        themesConsistencyRow.selected = currentStyle === 'rounded' ? 1 : currentStyle === 'sharp' ? 2 : 0;

        // Ensure GTK consistency is applied if active
        if (currentStyle !== 'default') {
            await applyThemeConsistency(currentStyle as 'rounded' | 'sharp');
        }

        // Overview Group
        const overviewGroup = new Adw.PreferencesGroup({
            title: _('Workspace Overview'),
        });
        appearancePage.add(overviewGroup);

        const skipOverview = new Adw.SwitchRow({
            title: _('Skip Overview on Startup'),
            subtitle: _('Go directly to the desktop after logging in'),
        });
        overviewGroup.add(skipOverview);
        settings.bind('skip-overview', skipOverview as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const switcherStyleRow = new Adw.SwitchRow({
            title: _('Workspace Switcher Styling'),
            subtitle: _('Customize the appearance and auto-scaling of the workspace thumbnails strip'),
        });
        overviewGroup.add(switcherStyleRow);
        settings.bind('workspace-switcher-style', switcherStyleRow as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const wsNumberIndicatorRow = new Adw.SwitchRow({
            title: _('Workspace Number Indicator'),
            subtitle: _('Show workspace number (e.g. "2 / 4") in the panel instead of the dot indicator'),
        });
        overviewGroup.add(wsNumberIndicatorRow);
        settings.bind('workspace-number-indicator', wsNumberIndicatorRow as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Workspace Animation Style
        const wsAnimRow = new Adw.ComboRow({
            title: _('Workspace Switch Animation'),
            subtitle: _('Wallpaper stays fixed; only windows animate. "Swing" mimics Hyprland elastic slide.'),
            model: Gtk.StringList.new(['None (default GNOME)', 'Slide', 'Swing (Hyprland-style)']),
        });
        overviewGroup.add(wsAnimRow);
        // Map setting value to combo index: 0=none, 1=slide, 2=swing
        const wsAnimValues: string[] = ['none', 'slide', 'swing'];
        wsAnimRow.set_selected(Math.max(0, wsAnimValues.indexOf(settings.get_string('workspace-animation-style'))));
        wsAnimRow.connect('notify::selected', () => {
            settings.set_string('workspace-animation-style', wsAnimValues[wsAnimRow.selected] ?? 'none');
        });

        const winAnimRow = new Adw.ComboRow({
            title: _('Window Animations'),
            subtitle: _('Open/close/move/resize animation style. "Hyprland" adds bouncy overshoot like Hyprland/niri.'),
            model: Gtk.StringList.new(['Default (native GNOME)', 'Hyprland-style (bouncy)', 'Glide (smooth slide)']),
        });
        overviewGroup.add(winAnimRow);
        const winAnimValues: string[] = ['default', 'hyprland', 'glide'];
        winAnimRow.set_selected(Math.max(0, winAnimValues.indexOf(settings.get_string('window-animation-style'))));
        winAnimRow.connect('notify::selected', () => {
            settings.set_string('window-animation-style', winAnimValues[winAnimRow.selected] ?? 'default');
        });

        // Panel Transparency Group
        const panelGroup = new Adw.PreferencesGroup({
            title: _('Panel'),
        });
        appearancePage.add(panelGroup);

        const panelTransRow = new Adw.SwitchRow({
            title: _('Transparent Panel'),
            subtitle: _('Remove the panel background color'),
        });
        panelGroup.add(panelTransRow);
        settings.bind('panel-transparency', panelTransRow as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const hidePanelIconRow = new Adw.SwitchRow({
            title: _('Hide Panel Icon'),
            subtitle: _('Hide the O-Tiling icon and menu from the top panel'),
        });
        panelGroup.add(hidePanelIconRow);
        settings.bind('hide-panel-icon', hidePanelIconRow as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const quickSettingsRow = new Adw.SwitchRow({
            title: _('Show in Quick Settings'),
            subtitle: _('Add an O-Tiling toggle to the Quick Settings menu instead of a dedicated panel icon'),
        });
        panelGroup.add(quickSettingsRow);
        settings.bind('quick-settings-toggle', quickSettingsRow as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const panelOpacityRow = new Adw.SpinRow({
            title: _('Panel Opacity (%)'),
            subtitle: _('0 = fully transparent, 100 = fully opaque'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 5 }),
        });
        panelGroup.add(panelOpacityRow);
        settings.bind('panel-transparency-opacity', panelOpacityRow as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const panelTopGapRow = new Adw.SpinRow({
            title: _('Top Smart Gap'),
            subtitle: _('Gap between the transparent panel and window top edge (replaces top outer gap when panel is fully transparent)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1 }),
        });
        panelGroup.add(panelTopGapRow);
        settings.bind('panel-top-gap', panelTopGapRow as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        /** Show/hide the Top Smart Gap row based on panel transparency state */
        const updatePanelTopGapVisibility = () => {
            const fullyTransparent = panelTransRow.active && panelOpacityRow.value === 0;
            panelTopGapRow.visible = fullyTransparent;
        };
        panelTransRow.connect('notify::active', updatePanelTopGapVisibility);
        panelOpacityRow.connect('notify::value', updatePanelTopGapVisibility);
        // Set initial state
        updatePanelTopGapVisibility();



        // Aura Master Group
        const auraMasterGroup = new Adw.PreferencesGroup({
            title: _('Active Hint (Aura)'),
        });
        appearancePage.add(auraMasterGroup);

        const activeHint = new Adw.SwitchRow({
            title: _('Show Active Hint (Aura)'),
            subtitle: _('Highlight the currently focused window with a colored border'),
        });
        auraMasterGroup.add(activeHint);
        settings.bind('active-hint', activeHint as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Border Outline Group
        const auraBorderGroup = new Adw.PreferencesGroup({
            title: _('Active Border Outline'),
        });
        appearancePage.add(auraBorderGroup);

        const borderWidth = new Adw.SpinRow({
            title: _('Active Border Width'),
            subtitle: _('Thickness of the active window hint'),
            adjustment: new Gtk.Adjustment({ lower: 1, upper: 10, step_increment: 1 }),
        });
        auraBorderGroup.add(borderWidth);
        settings.bind('active-hint-border-width', borderWidth as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const borderRadius = new Adw.SpinRow({
            title: _('Active Border Radius'),
            subtitle: _('Corner roundness of the active window hint'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 30, step_increment: 1 }),
        });
        auraBorderGroup.add(borderRadius);
        settings.bind('active-hint-border-radius', borderRadius as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const colorRow = new Adw.ActionRow({
            title: _('Active Border Color'),
            subtitle: _('Color of the active window hint'),
        });
        auraBorderGroup.add(colorRow);

        const colorDialog = new Gtk.ColorDialog({ with_alpha: true });
        const colorButton = new Gtk.ColorDialogButton({
            dialog: colorDialog,
            valign: Gtk.Align.CENTER,
        });
        colorRow.add_suffix(colorButton);

        // Bind color button manually as it's not a standard property bind
        const { default: Gdk } = await import('gi://Gdk?version=4.0');
        try {
            const initialColor = new Gdk.RGBA();
            if (initialColor.parse(settings.get_string('hint-color-rgba'))) {
                colorButton.rgba = initialColor;
            }
        } catch (e) {
            log.warn('Could not set initial color: ' + e);
        }

        colorButton.connect('notify::rgba', () => {
            const rgba = colorButton.rgba;
            settings.set_string('hint-color-rgba', rgba.to_string());
        });

        // ── Window Tint Overlay (4 settings) ──────────────────────────
        const auraOverlayGroup = new Adw.PreferencesGroup({
            title: _('Window Tint Overlay'),
        });
        appearancePage.add(auraOverlayGroup);

        // <1> Master enable toggle
        const overlayEnabled = new Adw.SwitchRow({
            title: _('Enable Window Tint Overlay'),
            subtitle: _('Apply a color tint overlay on tiled windows'),
        });
        auraOverlayGroup.add(overlayEnabled);
        settings.bind('active-hint-overlay-enabled', overlayEnabled as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        // <2> Opacity slider (Scale 0–100%)
        const overlayOpacityRow = new Adw.ActionRow({
            title: _('Overlay Opacity (%)'),
            subtitle: _('How opaque the tint overlay appears (0 = invisible, 100 = solid)'),
        });
        auraOverlayGroup.add(overlayOpacityRow);

        const overlayOpacity = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1, page_increment: 10 }),
            hexpand: true,
            valign: Gtk.Align.CENTER,
            draw_value: true,
            value_pos: Gtk.PositionType.RIGHT,
        });
        overlayOpacity.set_size_request(200, -1);
        overlayOpacityRow.add_suffix(overlayOpacity);

        settings.bind('active-hint-overlay-opacity', overlayOpacity as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        // <3> Color dialog — default = GNOME accent color, with custom color support
        const overlayColorRow = new Adw.ActionRow({
            title: _('Tint Color'),
            subtitle: _('Default uses the GNOME accent color; enable custom to override'),
        });
        auraOverlayGroup.add(overlayColorRow);

        const useCustomColor = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            tooltip_text: _('Use a custom tint color instead of the GNOME accent color'),
        });
        overlayColorRow.add_suffix(useCustomColor);
        overlayColorRow.activatable_widget = useCustomColor;

        const overlayColorDialog = new Gtk.ColorDialog({ with_alpha: true });
        const overlayColorButton = new Gtk.ColorDialogButton({
            dialog: overlayColorDialog,
            valign: Gtk.Align.CENTER,
        });
        overlayColorRow.add_suffix(overlayColorButton);

        // <4> Only active window toggle (inverts active-hint-overlay-all-windows)
        const overlayOnlyActive = new Adw.SwitchRow({
            title: _('Only Active Window'),
            subtitle: _('Tint only the focused window; disable to tint all tiled windows on the workspace'),
        });
        auraOverlayGroup.add(overlayOnlyActive);

        // ── Wire up color row state ─────────────────────────────────────────
        const currentOverlayVal = settings.get_string('active-hint-overlay-color-rgba');
        const overlayIsCustom = currentOverlayVal !== 'auto';
        useCustomColor.active = overlayIsCustom;

        // Initialise button: show custom value if set, otherwise show accent color
        try {
            const initialOverlayColor = new Gdk.RGBA();
            // Fall back to hint-color-rgba which already resolves 'auto' → accent
            const colorStringToParse = overlayIsCustom
                ? currentOverlayVal
                : settings.get_string('hint-color-rgba');
            if (initialOverlayColor.parse(colorStringToParse)) {
                overlayColorButton.rgba = initialOverlayColor;
            }
        } catch (e) {
            log.warn('Could not set initial overlay color: ' + e);
        }

        // Color button is only actionable when custom mode is on
        const syncColorButtonSensitivity = () => {
            overlayColorButton.sensitive = useCustomColor.active;
        };

        useCustomColor.connect('notify::active', () => {
            syncColorButtonSensitivity();
            if (useCustomColor.active) {
                settings.set_string('active-hint-overlay-color-rgba', overlayColorButton.rgba.to_string());
            } else {
                settings.set_string('active-hint-overlay-color-rgba', 'auto');
            }
        });

        overlayColorButton.connect('notify::rgba', () => {
            if (useCustomColor.active) {
                settings.set_string('active-hint-overlay-color-rgba', overlayColorButton.rgba.to_string());
            }
        });

        // ── Wire up only-active toggle ──────────────────────────────────────
        // The schema key is "all-windows" (true = all), so we invert for the UI.
        const currentAllWindows = settings.get_boolean('active-hint-overlay-all-windows');
        overlayOnlyActive.active = !currentAllWindows;

        overlayOnlyActive.connect('notify::active', () => {
            settings.set_boolean('active-hint-overlay-all-windows', !overlayOnlyActive.active);
        });

        // Reflect external changes to the schema key back into the toggle
        settings.connect('changed::active-hint-overlay-all-windows', () => {
            const newVal = settings.get_boolean('active-hint-overlay-all-windows');
            if (overlayOnlyActive.active === newVal) {
                // Invert is wrong — fix it without re-triggering the toggle signal.
                overlayOnlyActive.active = !newVal;
            }
        });

        // ── Sensitivity gating ──────────────────────────────────────────────
        const updateOverlaySensitivity = () => {
            const isEnabled = overlayEnabled.active;
            overlayOpacityRow.sensitive = isEnabled;
            overlayColorRow.sensitive = isEnabled;
            overlayOnlyActive.sensitive = isEnabled;
            syncColorButtonSensitivity();
        };

        overlayEnabled.connect('notify::active', updateOverlaySensitivity);
        // Set initial state
        syncColorButtonSensitivity();
        updateOverlaySensitivity();

        // Set up sensitivity based on active-hint master switch
        const updateAuraGroupsSensitivity = () => {
            const isEnabled = activeHint.active;
            auraBorderGroup.sensitive = isEnabled;
            auraOverlayGroup.sensitive = isEnabled;
        };
        activeHint.connect('notify::active', updateAuraGroupsSensitivity);
        // Set initial sensitivity state
        updateAuraGroupsSensitivity();

        // Behavior Group
        const behaviorGroup = new Adw.PreferencesGroup({
            title: _('Miscellaneous Behavior'),
        });
        behaviorPage.add(behaviorGroup);

        const mouseFollows = new Adw.SwitchRow({
            title: _('Mouse Cursor Follows Active Window'),
            subtitle: _('Automatically move the mouse pointer when focus changes'),
        });
        behaviorGroup.add(mouseFollows);
        settings.bind('mouse-cursor-follows-active-window', mouseFollows as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const stackingWithMouse = new Adw.SwitchRow({
            title: _('Allow Stacking with Mouse'),
            subtitle: _('Create window stacks by dragging windows over each other'),
        });
        behaviorGroup.add(stackingWithMouse);
        settings.bind('stacking-with-mouse', stackingWithMouse as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const debugMode = new Adw.SwitchRow({
            title: _('Debug Mode'),
            subtitle: _('Enable detailed logging for debugging purposes'),
        });
        behaviorGroup.add(debugMode);
        
        debugMode.active = settings.get_uint('log-level') === 4;
        debugMode.connect('notify::active', () => {
            settings.set_uint('log-level', debugMode.active ? 4 : 0);
        });
        settings.connect('changed::log-level', () => {
            const isDebug = settings.get_uint('log-level') === 4;
            if (debugMode.active !== isDebug) {
                debugMode.active = isDebug;
            }
        });


        // Gaps Group
        const gapsGroup = new Adw.PreferencesGroup({
            title: _('Gaps'),
        });
        behaviorPage.add(gapsGroup);

        const innerGap = new Adw.SpinRow({
            title: _('Inner Gap'),
            subtitle: _('Spacing between tiled windows'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1 }),
        });
        gapsGroup.add(innerGap);
        settings.bind('gap-inner', innerGap as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const outerGap = new Adw.SpinRow({
            title: _('Outer Gap'),
            subtitle: _('Spacing between windows and screen edges'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1 }),
        });
        gapsGroup.add(outerGap);
        settings.bind('gap-outer', outerGap as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        // --- Shortcuts Page ---
        const shortcutsPage = new Adw.PreferencesPage({
            title: _('Shortcuts'),
            icon_name: 'input-keyboard-symbolic',
        });
        window.add(shortcutsPage);

        // Navigation Group
        const navGroup = new Adw.PreferencesGroup({
            title: _('Navigation'),
            description: _('Shortcuts for moving focus between windows'),
        });
        shortcutsPage.add(navGroup);

        this._addShortcutRow(navGroup, settings, 'focus-left', _('Focus Left'));
        this._addShortcutRow(navGroup, settings, 'focus-right', _('Focus Right'));
        this._addShortcutRow(navGroup, settings, 'focus-up', _('Focus Up'));
        this._addShortcutRow(navGroup, settings, 'focus-down', _('Focus Down'));

        // Tiling Group
        const tilingGroupShortcuts = new Adw.PreferencesGroup({
            title: _('Tiling'),
            description: _('Shortcuts for tiling operations'),
        });
        shortcutsPage.add(tilingGroupShortcuts);

        this._addShortcutRow(tilingGroupShortcuts, settings, 'toggle-tiling', _('Toggle Auto-Tiling'));
        this._addShortcutRow(tilingGroupShortcuts, settings, 'tile-enter', _('Enter Management Mode'));
        this._addShortcutRow(tilingGroupShortcuts, settings, 'tile-accept', _('Accept Changes'));
        this._addShortcutRow(tilingGroupShortcuts, settings, 'tile-reject', _('Reject Changes'));
        this._addShortcutRow(tilingGroupShortcuts, settings, 'tile-orientation', _('Toggle Orientation'));
        this._addShortcutRow(tilingGroupShortcuts, settings, 'toggle-stacking-global', _('Toggle Stacking (Global)'));
        this._addShortcutRow(tilingGroupShortcuts, settings, 'toggle-floating', _('Toggle Floating'));

        // Window Movement Group
        const movementGroup = new Adw.PreferencesGroup({
            title: _('Window Movement'),
            description: _('Shortcuts for moving, swapping, and resizing windows'),
        });
        shortcutsPage.add(movementGroup);

        this._addShortcutRow(movementGroup, settings, 'tile-move-left-global', _('Move Left'));
        this._addShortcutRow(movementGroup, settings, 'tile-move-right-global', _('Move Right'));
        this._addShortcutRow(movementGroup, settings, 'tile-move-up-global', _('Move Up'));
        this._addShortcutRow(movementGroup, settings, 'tile-move-down-global', _('Move Down'));

        this._addShortcutRow(movementGroup, settings, 'tile-swap-left', _('Swap Left'));
        this._addShortcutRow(movementGroup, settings, 'tile-swap-right', _('Swap Right'));
        this._addShortcutRow(movementGroup, settings, 'tile-swap-up', _('Swap Up'));
        this._addShortcutRow(movementGroup, settings, 'tile-swap-down', _('Swap Down'));

        this._addShortcutRow(movementGroup, settings, 'tile-resize-left', _('Resize Left'));
        this._addShortcutRow(movementGroup, settings, 'tile-resize-right', _('Resize Right'));
        this._addShortcutRow(movementGroup, settings, 'tile-resize-up', _('Resize Up'));
        this._addShortcutRow(movementGroup, settings, 'tile-resize-down', _('Resize Down'));

        // Workspaces & Monitors Group
        const workspaceGroup = new Adw.PreferencesGroup({
            title: _('Workspaces & Monitors'),
            description: _('Shortcuts for moving windows between workspaces and monitors'),
        });
        shortcutsPage.add(workspaceGroup);

        this._addShortcutRow(workspaceGroup, settings, 'pop-workspace-up', _('Move to Upper Workspace'));
        this._addShortcutRow(workspaceGroup, settings, 'pop-workspace-down', _('Move to Lower Workspace'));
        this._addShortcutRow(workspaceGroup, settings, 'pop-monitor-left', _('Move to Left Monitor'));
        this._addShortcutRow(workspaceGroup, settings, 'pop-monitor-right', _('Move to Right Monitor'));
        this._addShortcutRow(workspaceGroup, settings, 'pop-monitor-up', _('Move to Upper Monitor'));
        this._addShortcutRow(workspaceGroup, settings, 'pop-monitor-down', _('Move to Lower Monitor'));

        // Reset Group
        const resetGroup = new Adw.PreferencesGroup({
            title: _('Danger Zone'),
        });
        behaviorPage.add(resetGroup);

        const resetRow = new Adw.ActionRow({
            title: _('Reset All Settings'),
            subtitle: _('Restore all extension settings to their default values'),
        });
        resetGroup.add(resetRow);

        const resetButton = new Gtk.Button({
            label: _('Reset'),
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
        });
        resetRow.add_suffix(resetButton);

        resetButton.connect('clicked', () => {
            const keys = settings.list_keys();
            keys.forEach(key => settings.reset(key));

            // Manual overrides from original indicator logic
            settings.set_uint('gap-inner', 4);
            settings.set_uint('gap-outer', 4);
            settings.set_uint('active-hint-border-radius', 10);
            settings.set_uint('active-hint-border-width', 4);
        });
    }

    private _addShortcutRow(group: Adw.PreferencesGroup, settings: Gio.Settings, key: string, title: string) {
        const row = new Adw.EntryRow({
            title: title,
        });
        group.add(row);

        // Get initial value
        const initialValue = settings.get_strv(key);
        row.text = initialValue.join(', ');

        // Update settings when text changes
        row.connect('notify::text', () => {
            const text = row.text;
            const values = text.split(',').map(s => s.trim()).filter(s => s.length > 0);
            settings.set_strv(key, values);
        });
    }
}
