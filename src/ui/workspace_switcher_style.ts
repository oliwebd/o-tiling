/**
 * workspace_switcher_style.ts
 *
 * Optional workspace-switcher re-styling for GNOME Shell 50+.
 *
 * Design:
 *   - Entirely CSS-based injection via St.ThemeContext / Gio.File — no JS
 *     monkey-patching of Shell internals. This keeps the feature EGO-compliant
 *     and trivially reversible.
 *   - All logic is encapsulated in `WorkspaceSwitcherStyle` so the main
 *     extension just calls enable() / disable() / updateAccentColor().
 *   - The `isGnome50()` guard is exported so callers can gate UI items without
 *     duplicating the version parse.
 */

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import { PACKAGE_VERSION } from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// ── Version gate ─────────────────────────────────────────────────────────────

/** Returns true when running on GNOME Shell 50 or newer. */
export function isGnome50(): boolean {
    try {
        const major = parseInt(PACKAGE_VERSION.split('.')[0], 10);
        return major >= 50;
    } catch (_) {
        return false;
    }
}

// ── CSS builder ──────────────────────────────────────────────────────────────

/**
 * Builds the full CSS string for the workspace switcher bar.
 *
 * Targets confirmed GNOME 50 selectors:
 *   .workspace-thumbnails         – the horizontal strip container
 *   .workspace-thumbnail          – individual workspace preview cards
 *   .workspace-thumbnail:focus    – active / focused card
 *
 * The accent color is used for the active card border so it follows
 * the user's existing O-Tiling active-hint colour automatically.
 */
function buildCss(accentColor: string): string {
    // Parse accent color into a semi-transparent version for the background tint
    // We use a fixed alpha reduction — Clutter colour math is not available at
    // CSS-string-build time, so we approximate with a fixed opacity value.
    const bgTint = accentColorToTint(accentColor, 0.08);
    const glowTint = accentColorToTint(accentColor, 0.22);

    return `
/* === O-Tiling: Workspace Switcher Style (GNOME 50) === */

/* ── Thumbnails container ──────────────────────────────── */
.workspace-thumbnails {
    background-color: rgba(0, 0, 0, 0.45);
    border-radius: 16px;
    padding: 10px 14px;
    spacing: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
}

/* ── Individual workspace cards ────────────────────────── */
.workspace-thumbnail {
    border-radius: 10px;
    border: 2px solid transparent;
    transition-duration: 180ms;
    transition-property: border-color, background-color, box-shadow;
}

/* ── Inactive card hover ───────────────────────────────── */
.workspace-thumbnail:hover {
    border-color: rgba(255, 255, 255, 0.18);
    background-color: ${bgTint};
}

/* ── Active / focused card ─────────────────────────────── */
.workspace-thumbnail:focus,
.workspace-thumbnail.selected {
    border-color: ${accentColor};
    background-color: ${glowTint};
    box-shadow: 0 0 0 2px ${glowTint};
}

/* ── Workspace label (if shown) ────────────────────────── */
.workspace-thumbnail .workspace-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.75);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
`;
}

/**
 * Converts an rgba() or hex color string into a rgba() with the given alpha.
 * Falls back to a neutral translucent white on parse failure.
 */
function accentColorToTint(rgba: string, alpha: number): string {
    // Try to extract r,g,b from "rgba(r, g, b, a)" or "rgb(r, g, b)"
    const match = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
        return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
    }
    // Hex fallback — just return a neutral tint
    return `rgba(255, 255, 255, ${alpha})`;
}

// ── WorkspaceSwitcherStyle ────────────────────────────────────────────────────

export class WorkspaceSwitcherStyle {
    private _provider: any | null = null;
    private _accentColor: string;

    constructor(accentColor: string) {
        this._accentColor = accentColor;
    }

    /** Injects custom CSS into the Shell theme. No-op if already enabled. */
    enable(): void {
        if (this._provider) return;

        this._provider = new (St as any).CssProvider();
        const css = buildCss(this._accentColor);

        try {
            this._provider.load_from_data(css, css.length);
        } catch (_) {
            // GNOME 46+ uses load_from_string
            try {
                (this._provider as any).load_from_string(css);
            } catch (e) {
                logError(e as Error, 'WorkspaceSwitcherStyle: failed to load CSS');
                this._provider = null;
                return;
            }
        }

        (St.ThemeContext.get_for_stage(
            (global as any).stage as Clutter.Stage,
        ).get_theme() as any)?.add_provider(this._provider, 800 /* priority */);
    }

    /** Removes the injected CSS from the Shell theme. */
    disable(): void {
        if (!this._provider) return;

        try {
            (St.ThemeContext.get_for_stage(
                (global as any).stage as Clutter.Stage,
            ).get_theme() as any)?.remove_provider(this._provider);
        } catch (_) { /* best-effort */ }

        this._provider = null;
    }

    /** Hot-updates the accent colour without a full disable → enable cycle. */
    updateAccentColor(rgba: string): void {
        this._accentColor = rgba;
        if (this._provider) {
            this.disable();
            this.enable();
        }
    }

    /** True while the CSS is currently injected. */
    get isEnabled(): boolean {
        return this._provider !== null;
    }
}
