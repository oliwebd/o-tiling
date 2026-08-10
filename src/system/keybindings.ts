import type { Ext } from '../extension.js';

import { wm } from 'resource:///org/gnome/shell/ui/main.js';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import Gio from 'gi://Gio';

const SYSTEM_KEYBINDING_SCHEMAS = [
    'org.gnome.desktop.wm.keybindings',
    'org.gnome.shell.keybindings',
    'org.gnome.mutter.keybindings',
    'org.gnome.mutter.wayland.keybindings',
];

interface ClearedBinding {
    schema_id: string;
    key: string;
    accelerator: string;
}

const MODIFIER_ALIASES: Record<string, string> = {
    '<Primary>': '<Control>',
};

function normalize_accelerator(accelerator: string): string | null {
    if (!accelerator) return null;

    const modifiers: string[] = [];

    const modifier_pattern = /<[^<>]+>/g;
    let match: RegExpExecArray | null;
    while ((match = modifier_pattern.exec(accelerator)) !== null) {
        const token = MODIFIER_ALIASES[match[0]] ?? match[0];
        modifiers.push(token);
    }
    const rest = accelerator.replace(modifier_pattern, '');

    if (!rest) return null;

    const key = rest.length === 1 ? rest.toLowerCase() : rest;

    modifiers.sort();
    return `${modifiers.join('')}${key}`;
}

export class Keybindings {
    global: object;
    window_focus: object;

    private ext: Ext;
    private active: Set<string> = new Set();

    private cleared_system_bindings: Map<string, ClearedBinding[]> = new Map();
    private system_settings: Map<string, Gio.Settings> = new Map();

    private get_system_settings(schema_id: string): Gio.Settings | null {
        let settings = this.system_settings.get(schema_id);
        if (settings) return settings;

        const source = Gio.SettingsSchemaSource.get_default();
        if (!source || !source.lookup(schema_id, true)) return null;

        settings = new Gio.Settings({ schema_id });
        this.system_settings.set(schema_id, settings);
        return settings;
    }

    private resolve_conflicts(name: string, accelerators: string[]) {
        for (const accel of accelerators) {
            const target = normalize_accelerator(accel);
            if (!target) continue;

            for (const schema_id of SYSTEM_KEYBINDING_SCHEMAS) {
                const settings = this.get_system_settings(schema_id);
                if (!settings) continue;

                for (const key of settings.settings_schema.list_keys()) {
                    const schema_key = settings.settings_schema.get_key(key);
                    if (schema_key.get_value_type().dup_string() !== 'as') continue;

                    const current: string[] = settings.get_strv(key);
                    if (current.length === 0) continue;

                    const remaining = current.filter((existing) => normalize_accelerator(existing) !== target);
                    if (remaining.length === current.length) continue;

                    settings.set_strv(key, remaining);

                    const removed = current.filter((existing) => normalize_accelerator(existing) === target);
                    const entries = this.cleared_system_bindings.get(name) ?? [];
                    for (const removed_accel of removed) {
                        entries.push({ schema_id, key, accelerator: removed_accel });
                    }
                    this.cleared_system_bindings.set(name, entries);
                }
            }
        }
    }

    private restore_conflicts(name: string) {
        const entries = this.cleared_system_bindings.get(name);
        if (!entries) return;

        for (const { schema_id, key, accelerator } of entries) {
            const settings = this.get_system_settings(schema_id);
            if (!settings) continue;

            const current: string[] = settings.get_strv(key);
            if (current.includes(accelerator)) continue;

            settings.set_strv(key, [...current, accelerator]);
        }

        this.cleared_system_bindings.delete(name);
    }

    constructor(ext: Ext) {
        this.ext = ext;
        this.global = {
            'tile-enter': () => ext.tiler.enter(ext),
        };

        this.window_focus = {
            'focus-left': () => ext.focus_left(),

            'focus-down': () => ext.focus_down(),

            'focus-up': () => ext.focus_up(),

            'focus-right': () => ext.focus_right(),

            'tile-orientation': () => {
                const win = ext.focus_window();
                if (win && ext.auto_tiler) {
                    ext.auto_tiler.toggle_orientation(ext, win);
                    ext.register_fn(() => win.activate(true));
                }
            },

            'toggle-floating': () => ext.auto_tiler?.toggle_floating(ext),

            'toggle-tiling': () => ext.toggle_tiling(),

            'toggle-stacking-global': () => ext.auto_tiler?.toggle_stacking(ext),

            'tile-move-left-global': () => ext.tiler.move_left(ext, ext.focus_window()?.entity),

            'tile-move-down-global': () => ext.tiler.move_down(ext, ext.focus_window()?.entity),

            'tile-move-up-global': () => ext.tiler.move_up(ext, ext.focus_window()?.entity),

            'tile-move-right-global': () => ext.tiler.move_right(ext, ext.focus_window()?.entity),

            'pop-monitor-left': () => ext.move_monitor(Meta.DisplayDirection.LEFT),

            'pop-monitor-right': () => ext.move_monitor(Meta.DisplayDirection.RIGHT),

            'pop-monitor-up': () => ext.move_monitor(Meta.DisplayDirection.UP),

            'pop-monitor-down': () => ext.move_monitor(Meta.DisplayDirection.DOWN),

            'pop-workspace-up': () => ext.move_workspace(Meta.DisplayDirection.UP),

            'pop-workspace-down': () => ext.move_workspace(Meta.DisplayDirection.DOWN),
        };
    }

    enable(keybindings: any) {
        for (const name in keybindings) {
            if (this.active.has(name)) {
                continue;
            }

            const accelerators: string[] = this.ext.settings.ext.get_strv(name);
            this.resolve_conflicts(name, accelerators);

            wm.addKeybinding(
                name,
                this.ext.settings.ext,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL,
                keybindings[name],
            );

            this.active.add(name);
        }

        return this;
    }

    disable(keybindings: object) {
        for (const name in keybindings) {
            if (!this.active.has(name)) continue;

            wm.removeKeybinding(name);
            this.restore_conflicts(name);
            this.active.delete(name);
        }

        return this;
    }
}
