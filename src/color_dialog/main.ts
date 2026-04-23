import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk?version=4.0';
import GLib from 'gi://GLib';

Gtk.init();

function get_settings(): Gio.Settings {
    const GioSSS = Gio.SettingsSchemaSource;
    // The script is in dist/color_dialog/main.js, schemas are in dist/schemas/
    const scriptFile = Gio.File.new_for_uri(import.meta.url);
    const scriptDir = scriptFile.get_parent();
    if (!scriptDir) throw new Error('Could not find script directory');
    const distDir = scriptDir.get_parent();
    if (!distDir) throw new Error('Could not find dist directory');
    const schemaDir = distDir.get_child('schemas');

    const defaultSource = GioSSS.get_default();
    let schemaSource = (schemaDir.query_exists(null) && defaultSource)
        ? GioSSS.new_from_directory(schemaDir.get_path()!, defaultSource, false)
        : defaultSource;

    if (!schemaSource) {
        throw new Error('Could not load GSettings schema source');
    }

    const schemaObj = schemaSource.lookup('org.gnome.shell.extensions.o-tiling', true);

    if (!schemaObj) {
        throw new Error('Schema org.gnome.shell.extensions.o-tiling could not be found');
    }

    return new Gio.Settings({ settings_schema: schemaObj });
}

const settings = get_settings();
const currentColorStr = settings.get_string('hint-color-rgba');

const dialog = new Gtk.ColorChooserDialog({
    title: 'Select Active Hint Color',
});

// Set current color if possible
if (currentColorStr && currentColorStr !== 'auto') {
    const rgba = new Gdk.RGBA();
    if (rgba.parse(currentColorStr)) {
        dialog.set_rgba(rgba);
    }
}

dialog.connect('response', (_, response_id) => {
    if (response_id === Gtk.ResponseType.OK) {
        const color = dialog.get_rgba();
        const rgbaStr = color.to_string(); // This returns something like rgba(r,g,b,a)
        settings.set_string('hint-color-rgba', rgbaStr);
    }
    dialog.destroy();
});

// Simple way for GJS + Gtk4 standalone script
dialog.show();

// We need a way to keep the script running until the dialog is closed.
// In Gtk4, we usually use Gtk.Application.
// But for a quick fix, let's use the simplest GJS loop.
const loop = GLib.MainLoop.new(null, false);
dialog.connect('close-request', () => {
    loop.quit();
    return false;
});
dialog.connect('response', () => {
    loop.quit();
});
loop.run();
