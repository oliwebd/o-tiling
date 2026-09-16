import St from 'gi://St';

/**
 * Background tint fill, kept as a separate actor/class from the border ring so that
 * ring-only style changes (e.g. focus toggling border-color/width) don't repaint this
 * layer and cause it to flicker.
 */
export class Tint {
    actor: St.Bin;

    private last_style: string | null = null;

    constructor() {
        this.actor = new St.Bin({
            style_class: 'o-tiling-tint-bg',
            reactive: false,
            x_expand: true,
            y_expand: true,
        });
    }

    /** Applies the given style string, skipping set_style() (and its repaint) if unchanged. */
    update(style: string) {
        if (style !== this.last_style) {
            this.last_style = style;
            this.actor.set_style(style);
        }
    }
}
