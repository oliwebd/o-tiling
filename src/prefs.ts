import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
// Gdk dynamically imported
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as log from './log.js';
import * as focus from './focus.js';

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
            title: _('Appearance'),
        });
        page.add(appearanceGroup);

        const showTitle = new Adw.SwitchRow({
            title: _('Show Window Titles'),
        });
        appearanceGroup.add(showTitle);
        settings.bind('show-title', showTitle as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const activeHint = new Adw.SwitchRow({
            title: _('Show Active Hint (Aura)'),
        });
        appearanceGroup.add(activeHint);
        settings.bind('active-hint', activeHint as any, 'active', Gio.SettingsBindFlags.DEFAULT);

        const borderRadius = new Adw.SpinRow({
            title: _('Active Border Radius'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 30, step_increment: 1 }),
        });
        appearanceGroup.add(borderRadius);
        settings.bind('active-hint-border-radius', borderRadius as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const borderWidth = new Adw.SpinRow({
            title: _('Active Border Width'),
            adjustment: new Gtk.Adjustment({ lower: 1, upper: 10, step_increment: 1 }),
        });
        appearanceGroup.add(borderWidth);
        settings.bind('active-hint-border-width', borderWidth as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const overlayOpacity = new Adw.SpinRow({
            title: _('Active Hint Overlay Opacity (%)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1 }),
        });
        appearanceGroup.add(overlayOpacity);
        settings.bind('active-hint-overlay-opacity', overlayOpacity as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const glowOpacity = new Adw.SpinRow({
            title: _('Active Hint Glow Opacity (%)'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1 }),
        });
        appearanceGroup.add(glowOpacity);
        settings.bind('active-hint-glow-opacity', glowOpacity as any, 'value', Gio.SettingsBindFlags.DEFAULT);

        const colorRow = new Adw.ActionRow({
            title: _('Active Border Color'),
        });
        appearanceGroup.add(colorRow);

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
