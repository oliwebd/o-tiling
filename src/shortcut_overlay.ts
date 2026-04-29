import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Lib from './lib.js';

const { separator } = Lib;

export class Shortcut {
    description: string;
    bindings: Array<Array<string>>;

    constructor(description: string) {
        this.description = description;
        this.bindings = [];
    }

    add(binding: Array<string>) {
        this.bindings.push(binding);
        return this;
    }
}

export class Section {
    header: string;
    shortcuts: Array<Shortcut>;

    constructor(header: string, shortcuts: Array<Shortcut>) {
        this.header = header;
        this.shortcuts = shortcuts;
    }
}

export class Column {
    sections: Array<Section>;

    constructor(sections: Array<Section>) {
        this.sections = sections;
    }
}

export var ShortcutOverlay = GObject.registerClass(
    {
        GTypeName: 'OTilingShortcutOverlay',
    },
    class ShortcutOverlay extends St.BoxLayout {
        constructor(title: string, columns: Array<Column>) {
            super({
                style_class: 'o-tiling-shortcuts',
                orientation: (Clutter as any).Orientation.VERTICAL,
            });

            const columns_layout = new St.BoxLayout({
                style_class: 'o-tiling-shortcuts-columns',
                orientation: (Clutter as any).Orientation.HORIZONTAL,
            });

            for (const column of columns) {
                const column_layout = new St.BoxLayout({
                    style_class: 'o-tiling-shortcuts-column',
                    orientation: (Clutter as any).Orientation.VERTICAL,
                });

                for (const section of column.sections) {
                    column_layout.add_child(this.gen_section(section));
                }

                columns_layout.add_child(column_layout);
            }

            this.add_child(
                new St.Label({
                    style_class: 'o-tiling-shortcuts-title',
                    text: title,
                }),
            );

            this.add_child(columns_layout);
        }

        gen_combination(combination: Array<string>) {
            const layout = new St.BoxLayout({
                style_class: 'o-tiling-binding',
                orientation: (Clutter as any).Orientation.HORIZONTAL,
            });

            for (const key of combination) {
                layout.add_child(new St.Label({ text: key }));
            }

            return layout;
        }

        gen_section(section: Section) {
            const layout = new St.BoxLayout({
                style_class: 'o-tiling-section',
                orientation: (Clutter as any).Orientation.VERTICAL,
            });

            layout.add_child(
                new St.Label({
                    style_class: 'o-tiling-section-header',
                    text: section.header,
                }),
            );

            for (const subsection of section.shortcuts) {
                layout.add_child(separator());
                layout.add_child(this.gen_shortcut(subsection));
            }

            return layout;
        }

        gen_shortcut(shortcut: Shortcut) {
            const layout = new St.BoxLayout({
                style_class: 'o-tiling-shortcut',
                orientation: (Clutter as any).Orientation.HORIZONTAL,
            });

            layout.add_child(
                new St.Label({
                    text: shortcut.description,
                }),
            );

            return layout;
        }
    },
);
