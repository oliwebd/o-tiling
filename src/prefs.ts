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

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        // Tiling Group
        const tilingGroup = new Adw.PreferencesGroup({
            title: _('Tiling'),
        });
        page.add(tilingGroup);

        const tileByDefault = new Adw.SwitchRow({
            title: _('Tile Windows by Default'),
        });
        tilingGroup.add(tileByDefault);
        settings.bind('tile-by-default', tileByDefault as any, 'active', Gio.SettingsBindFlags.DEFAULT);


        const snapToGrid = new Adw.SwitchRow({
            title: _('Snap to Grid (Floating Mode)'),
        });
        tilingGroup.add(snapToGrid);
        settings.bind('snap-to-grid', snapToGrid as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const smartGaps = new Adw.SwitchRow({
            title: _('Smart Gaps'),
        });
        tilingGroup.add(smartGaps);
        settings.bind('smart-gaps', smartGaps as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Appearance Group
        const appearanceGroup = new Adw.PreferencesGroup({
            title: _('Appearance — General'),
        });
        page.add(appearanceGroup);

        const showTitle = new Adw.SwitchRow({
            title: _('Show Window Titles'),
        });
        appearanceGroup.add(showTitle);
        settings.bind('show-title', showTitle as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showMinMax = new Adw.SwitchRow({
            title: _('Show Minimize and Maximize Buttons'),
        });
        appearanceGroup.add(showMinMax);
        settings.bind('show-minimize-maximize-buttons', showMinMax as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showClose = new Adw.SwitchRow({
            title: _('Show Close Button'),
        });
        appearanceGroup.add(showClose);
        settings.bind('show-close-button', showClose as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const themesConsistencyRow = new Adw.SwitchRow({
            title: _('Themes Consistency'),
            subtitle: _('Applies uniform corner styles to GTK apps and GNOME Shell'),
        });
        appearanceGroup.add(themesConsistencyRow);
        settings.bind('theme-consistency', themesConsistencyRow as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const themeStyleRow = new Adw.ComboRow({
            title: _('Theme Consistency Style'),
            model: Gtk.StringList.new([_('Rounded'), _('Sharp GTK')]),
        });
        appearanceGroup.add(themeStyleRow);

        // Bind the combo row index to our enum setting
        themeStyleRow.connect('notify::selected', () => {
            const selected = themeStyleRow.selected;
            settings.set_string('theme-consistency-style', selected === 0 ? 'rounded' : 'sharp');
            if (themesConsistencyRow.active) {
                applyThemeConsistency(selected === 0 ? 'rounded' : 'sharp');
            }
        });

        // Set initial value
        themeStyleRow.selected = settings.get_string('theme-consistency-style') === 'sharp' ? 1 : 0;

        themesConsistencyRow.connect('notify::active', () => {
            if (themesConsistencyRow.active) {
                applyThemeConsistency(settings.get_string('theme-consistency-style') as any);
            }
        });

        // Overview Group
        const overviewGroup = new Adw.PreferencesGroup({
            title: _('Appearance — Workspace Overview'),
        });
        page.add(overviewGroup);

        const skipOverview = new Adw.SwitchRow({
            title: _('Skip Overview on Startup'),
            subtitle: _('Go directly to the desktop after logging in'),
        });
        overviewGroup.add(skipOverview);
        settings.bind('skip-overview', skipOverview as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const workspaceSwitcherStyle = new Adw.SwitchRow({
            title: _('Workspace Switcher Style'),
            subtitle: _('GNOME 50+ only — styles the workspace thumbnails bar'),
        });
        overviewGroup.add(workspaceSwitcherStyle);
        settings.bind('workspace-switcher-style', workspaceSwitcherStyle as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const thumbnailCornerRadius = new Adw.SpinRow({
            title: _('Workspace Thumbnail Corner Radius'),
            subtitle: _('GNOME 50+ only — set the roundness of workspace previews'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 60, step_increment: 1 }),
        });
        overviewGroup.add(thumbnailCornerRadius);
        settings.bind('workspace-thumbnail-corner-radius', thumbnailCornerRadius as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const switcherSizeRow = new Adw.SpinRow({
            title: _('Workspace Switcher Size'),
            subtitle: _('GNOME 50+ only — size of workspace switcher as a percentage of screen height'),
            adjustment: new Gtk.Adjustment({ lower: 5, upper: 25, step_increment: 1 }),
        });
        overviewGroup.add(switcherSizeRow);
        settings.bind('workspace-switcher-size', switcherSizeRow as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const bgCornerSizeRow = new Adw.SpinRow({
            title: _('Workspace Background Corner Size'),
            subtitle: _('Workspace background corner size in overview'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 60, step_increment: 1 }),
        });
        overviewGroup.add(bgCornerSizeRow);
        settings.bind('workspace-background-corner-size', bgCornerSizeRow as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const overviewLargeActive = new Adw.SwitchRow({
            title: _('Enlarge Active Workspace'),
            subtitle: _('Whether the active workspace in the overview should be larger than others (GNOME default)'),
        });
        overviewGroup.add(overviewLargeActive);
        settings.bind('workspace-overview-large-active', overviewLargeActive as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Panel Transparency Group
        const panelGroup = new Adw.PreferencesGroup({
            title: _('Appearance — Panel'),
        });
        page.add(panelGroup);

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
            title: _('Appearance — Active Hint (Aura)'),
        });
        page.add(auraGroup);

        const activeHint = new Adw.SwitchRow({
            title: _('Show Active Hint (Aura)'),
        });
        auraGroup.add(activeHint);
        settings.bind('active-hint', activeHint as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const borderRadius = new Adw.SpinRow({
            title: _('Active Border Radius'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 30, step_increment: 1 }),
        });
        auraGroup.add(borderRadius);
        settings.bind('active-hint-border-radius', borderRadius as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const borderWidth = new Adw.SpinRow({
            title: _('Active Border Width'),
            adjustment: new Gtk.Adjustment({ lower: 1, upper: 10, step_increment: 1 }),
        });
        auraGroup.add(borderWidth);
        settings.bind('active-hint-border-width', borderWidth as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const overlayOpacity = new Adw.SpinRow({
            title: _('Active Hint Overlay Opacity (%)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1 }),
        });
        auraGroup.add(overlayOpacity);
        settings.bind('active-hint-overlay-opacity', overlayOpacity as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const glowOpacity = new Adw.SpinRow({
            title: _('Active Hint Glow Opacity (%)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1 }),
        });
        auraGroup.add(glowOpacity);
        settings.bind('active-hint-glow-opacity', glowOpacity as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const colorRow = new Adw.ActionRow({
            title: _('Active Border Color'),
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
            title: _('Behavior'),
        });
        page.add(behaviorGroup);

        const mouseFollows = new Adw.SwitchRow({
            title: _('Mouse Cursor Follows Active Window'),
        });
        behaviorGroup.add(mouseFollows);
        settings.bind('mouse-cursor-follows-active-window', mouseFollows as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const stackingWithMouse = new Adw.SwitchRow({
            title: _('Allow Stacking with Mouse'),
        });
        behaviorGroup.add(stackingWithMouse);
        settings.bind('stacking-with-mouse', stackingWithMouse as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Gaps Group
        const gapsGroup = new Adw.PreferencesGroup({
            title: _('Gaps'),
        });
        page.add(gapsGroup);

        const innerGap = new Adw.SpinRow({
            title: _('Inner Gap'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1 }),
        });
        gapsGroup.add(innerGap);
        settings.bind('gap-inner', innerGap as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const outerGap = new Adw.SpinRow({
            title: _('Outer Gap'),
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
        page.add(resetGroup);

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
