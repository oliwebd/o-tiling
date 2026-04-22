import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as log from './log.js';
import * as focus from './focus.js';

export default class OTilingPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window: Adw.PreferencesWindow) {
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
        settings.bind('tile-by-default', tileByDefault, 'active', Gio.SettingsBindFlags.DEFAULT);

        const snapToGrid = new Adw.SwitchRow({
            title: _('Snap to Grid (Floating Mode)'),
        });
        tilingGroup.add(snapToGrid);
        settings.bind('snap-to-grid', snapToGrid, 'active', Gio.SettingsBindFlags.DEFAULT);

        const smartGaps = new Adw.SwitchRow({
            title: _('Smart Gaps'),
        });
        tilingGroup.add(smartGaps);
        settings.bind('smart-gaps', smartGaps, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Appearance Group
        const appearanceGroup = new Adw.PreferencesGroup({
            title: _('Appearance'),
        });
        page.add(appearanceGroup);

        const showTitle = new Adw.SwitchRow({
            title: _('Show Window Titles'),
        });
        appearanceGroup.add(showTitle);
        settings.bind('show-title', showTitle, 'active', Gio.SettingsBindFlags.DEFAULT);

        const activeHint = new Adw.SwitchRow({
            title: _('Show Active Hint (Aura)'),
        });
        appearanceGroup.add(activeHint);
        settings.bind('active-hint', activeHint, 'active', Gio.SettingsBindFlags.DEFAULT);

        const borderRadius = new Adw.SpinRow({
            title: _('Active Border Radius'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 30, step_increment: 1 }),
        });
        appearanceGroup.add(borderRadius);
        settings.bind('active-hint-border-radius', borderRadius, 'value', Gio.SettingsBindFlags.DEFAULT);

        const borderWidth = new Adw.SpinRow({
            title: _('Active Border Width'),
            adjustment: new Gtk.Adjustment({ lower: 1, upper: 10, step_increment: 1 }),
        });
        appearanceGroup.add(borderWidth);
        settings.bind('active-hint-border-width', borderWidth, 'value', Gio.SettingsBindFlags.DEFAULT);

        const colorRow = new Adw.ActionRow({
            title: _('Active Border Color'),
        });
        appearanceGroup.add(colorRow);

        const colorButton = new Gtk.ColorButton({
            use_alpha: true,
            valign: Gtk.Align.CENTER,
        });
        colorRow.add_suffix(colorButton);

        // Bind color button manually as it's not a standard property bind
        const initialColor = new Gdk.RGBA();
        initialColor.parse(settings.get_string('hint-color-rgba'));
        colorButton.set_rgba(initialColor);

        colorButton.connect('color-set', () => {
            const rgba = colorButton.get_rgba();
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
        settings.bind('mouse-cursor-follows-active-window', mouseFollows, 'active', Gio.SettingsBindFlags.DEFAULT);

        const stackingWithMouse = new Adw.SwitchRow({
            title: _('Allow Stacking with Mouse'),
        });
        behaviorGroup.add(stackingWithMouse);
        settings.bind('stacking-with-mouse', stackingWithMouse, 'active', Gio.SettingsBindFlags.DEFAULT);

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
        settings.bind('gap-inner', innerGap, 'value', Gio.SettingsBindFlags.DEFAULT);

        const outerGap = new Adw.SpinRow({
            title: _('Outer Gap'),
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1 }),
        });
        gapsGroup.add(outerGap);
        settings.bind('gap-outer', outerGap, 'value', Gio.SettingsBindFlags.DEFAULT);
    }
}
