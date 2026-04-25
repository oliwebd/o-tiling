import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk?version=4.0';

function get_settings(): Gio.Settings {
    const GioSSS = Gio.SettingsSchemaSource;
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

const app = new Gtk.Application({
    application_id: 'org.gnome.shell.extensions.o-tiling.ColorPicker',
    flags: Gio.ApplicationFlags.FLAGS_NONE,
});

app.connect('activate', () => {
    let settings: Gio.Settings;
    let currentColorStr: string;

    try {
        settings = get_settings();
        currentColorStr = settings.get_string('hint-color-rgba');
    } catch (e) {
        console.error(`O-Tiling color dialog: Failed to load settings: ${e}`);
        app.quit();
        return;
    }

    const initialColor = new Gdk.RGBA();
    if (currentColorStr && currentColorStr !== 'auto') {
        initialColor.parse(currentColorStr);
    } else {
        initialColor.parse('rgba(53,132,228,1)'); // Default blue
    }

    const window = new Gtk.ApplicationWindow({ application: app });

    const dialog = new Gtk.ColorDialog({
        title: 'Select Active Hint Color',
        with_alpha: true,
    });

    dialog.choose_rgba(window, initialColor, null, (_src, result) => {
        try {
            const color = dialog.choose_rgba_finish(result);
            if (color) {
                settings.set_string('hint-color-rgba', color.to_string());
            }
        } catch (e) {
            // User cancelled or error
        } finally {
            app.quit();
            window.destroy();
        }
    });
});

app.run([]);

