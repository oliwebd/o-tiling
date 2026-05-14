import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
// Gdk dynamically imported
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as log from './utils/log.js';
import { applyThemeConsistency } from './ui/theme_consistency/apply.js';

export default class OTilingPreferences extends ExtensionPreferences {
    async fillPreferencesWindow(window: Adw.PreferencesWindow) {
        const settings = this.getSettings();

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
        themesConsistencyRow.connect('notify::selected', () => {
            const selected = themesConsistencyRow.selected;
            const style = selected === 0 ? 'default' : selected === 1 ? 'rounded' : 'sharp';
            settings.set_string('theme-consistency-style', style);
            
            // Apply GTK theme consistency immediately
            if (style !== 'default') {
                applyThemeConsistency(style as 'rounded' | 'sharp');
            }
        });

        // Set initial value
        const currentStyle = settings.get_string('theme-consistency-style');
        themesConsistencyRow.selected = currentStyle === 'rounded' ? 1 : currentStyle === 'sharp' ? 2 : 0;
        
        // Ensure GTK consistency is applied if active
        if (currentStyle !== 'default') {
            applyThemeConsistency(currentStyle as 'rounded' | 'sharp');
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

        const overviewBlurRow = new Adw.SwitchRow({
            title: _('Overview Blur Effect'),
            subtitle: _('Apply a frosted-glass blur effect to the overview background and UI components'),
        });
        overviewGroup.add(overviewBlurRow);
        settings.bind('overview-blur-effect', overviewBlurRow as any, 'active', Gio.SettingsBindFlags.DEFAULT);


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

        const panelOpacityRow = new Adw.SpinRow({
            title: _('Panel Opacity (%)'),
            subtitle: _('0 = fully transparent, 100 = fully opaque'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 5 }),
        });
        panelGroup.add(panelOpacityRow);
        settings.bind('panel-transparency-opacity', panelOpacityRow as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const panelBlurRow = new Adw.SwitchRow({
            title: _('Panel Blur Style'),
            subtitle: _('Adds a subtle dark gradient behind the transparent panel for readability'),
        });
        panelGroup.add(panelBlurRow);
        settings.bind('panel-transparency-blur-style', panelBlurRow as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Aura Group
        const auraGroup = new Adw.PreferencesGroup({
            title: _('Active Hint (Aura)'),
        });
        appearancePage.add(auraGroup);

        const activeHint = new Adw.SwitchRow({
            title: _('Show Active Hint (Aura)'),
            subtitle: _('Highlight the currently focused window with a colored border'),
        });
        auraGroup.add(activeHint);
        settings.bind('active-hint', activeHint as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const borderRadius = new Adw.SpinRow({
            title: _('Active Border Radius'),
            subtitle: _('Corner roundness of the active window hint'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 30, step_increment: 1 }),
        });
        auraGroup.add(borderRadius);
        settings.bind('active-hint-border-radius', borderRadius as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const borderWidth = new Adw.SpinRow({
            title: _('Active Border Width'),
            subtitle: _('Thickness of the active window hint'),
            adjustment: new Gtk.Adjustment({ lower: 1, upper: 10, step_increment: 1 }),
        });
        auraGroup.add(borderWidth);
        settings.bind('active-hint-border-width', borderWidth as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const overlayOpacity = new Adw.SpinRow({
            title: _('Active Hint Overlay Opacity (%)'),
            subtitle: _('Opacity of the overlay color on the active window'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1 }),
        });
        auraGroup.add(overlayOpacity);
        settings.bind('active-hint-overlay-opacity', overlayOpacity as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const glowOpacity = new Adw.SpinRow({
            title: _('Active Hint Glow Opacity (%)'),
            subtitle: _('Opacity of the outer glow on the active window'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1 }),
        });
        auraGroup.add(glowOpacity);
        settings.bind('active-hint-glow-opacity', glowOpacity as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const colorRow = new Adw.ActionRow({
            title: _('Active Border Color'),
            subtitle: _('Color of the active window hint'),
        });
        auraGroup.add(colorRow);

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
