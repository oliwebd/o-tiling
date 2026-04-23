import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gtk.init();

const CONF_DIR: string = GLib.get_user_config_dir() + '/o-tiling';
const CONF_FILE: string = CONF_DIR + '/config.json';

interface FloatRule {
    class?: string;
    title?: string;
}

interface Config {
    float: FloatRule[];
}

function load_config(): Config {
    try {
        const file = Gio.File.new_for_path(CONF_FILE);
        const [ok, contents] = file.load_contents(null);
        if (ok) {
            return JSON.parse(new TextDecoder().decode(contents));
        }
    } catch (_e) {}
    return { float: [] };
}

function save_config(config: Config) {
    try {
        const file = Gio.File.new_for_path(CONF_FILE);
        (file as any).replace_contents(JSON.stringify(config, null, 2), null, false, Gio.FileCreateFlags.NONE, null);
    } catch (e) {
        printerr(`Failed to save config: ${e}`);
    }
}

const config = load_config();

const win = new Gtk.Window({
    title: 'Floating Window Exceptions',
    default_width: 400,
    default_height: 500,
} as any);

const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 12,
} as any);
(box as any).set_margin_top(12);
(box as any).set_margin_bottom(12);
(box as any).set_margin_start(12);
(box as any).set_margin_end(12);
(win as any).set_child(box);

const scrolled = new Gtk.ScrolledWindow({
    vexpand: true,
    hscrollbar_policy: Gtk.PolicyType.NEVER,
} as any);
(box as any).append(scrolled);

const list_box = new Gtk.ListBox({
    selection_mode: Gtk.SelectionMode.SINGLE,
} as any);
(scrolled as any).set_child(list_box);

function update_list() {
    let child = (list_box as any).get_first_child();
    while (child) {
        (list_box as any).remove(child);
        child = (list_box as any).get_first_child();
    }

    config.float.forEach((rule, index) => {
        const row = new Gtk.ListBoxRow();
        const row_box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
        } as any);
        (row_box as any).set_margin_top(8);
        (row_box as any).set_margin_bottom(8);
        (row_box as any).set_margin_start(8);
        (row_box as any).set_margin_end(8);
        (row as any).set_child(row_box);

        const text = rule.title ? `${rule.class} (${rule.title})` : (rule.class || 'Unknown');
        const label = new Gtk.Label({ label: text, xalign: 0, hexpand: true } as any);
        (row_box as any).append(label);

        const del_btn = new Gtk.Button({ icon_name: 'user-trash-symbolic' } as any);
        (del_btn as any).connect('clicked', () => {
            config.float.splice(index, 1);
            save_config(config);
            update_list();
            print('MODIFIED');
        });
        (row_box as any).append(del_btn);

        (list_box as any).append(row);
    });
}

update_list();

const action_box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
} as any);
(box as any).append(action_box);

const add_btn = new Gtk.Button({
    label: 'Select Window to Float',
    hexpand: true,
} as any);
(add_btn as any).add_css_class('suggested-action');
(add_btn as any).connect('clicked', () => {
    print('SELECT');
    (win as any).close();
});
(action_box as any).append(add_btn);

(win as any).connect('close-request', () => {
    loop.quit();
});

(win as any).show();
const loop = GLib.MainLoop.new(null, false);
loop.run();
