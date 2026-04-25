import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import Cogl from 'gi://Cogl';
import * as utils from './utils.js';
import { get_current_path } from './paths.js';

class Uniforms {
    bounds: number = 0;
    clipRadius: number = 0;
    pixelStep: number = 0;
}

class RoundedCornersEffectInternal extends Shell.GLSLEffect {
    private _shader_declarations: string = '';
    private _shader_code: string = '';
    private _uniforms: Uniforms = new Uniforms();

    // Stored uniform values — applied on every paint via vfunc_paint_target
    // so that non-active windows and CSD windows always render correctly.
    private _bounds: number[] = [0, 0, 0, 0];
    private _clipRadius: number = 0;
    private _pixelStep: number[] = [1, 1];

    constructor(params?: object) {
        super(params);
        
        // Load shader source from file
        const shader_path = `${get_current_path()}/rounded_corners.frag`;
        const result = utils.read_to_string(shader_path);
        if (result.kind === 1) { // Ok
            const shader = result.value;
            // Split shader into declarations and main code
            // Based on Rounded Window Corners Reborn technique
            const parts = shader.split(/^.*?main\(\s?\)\s?/m);
            if (parts.length >= 2) {
                this._shader_declarations = parts[0].trim();
                this._shader_code = parts[1].trim().replace(/^[{}]/gm, '').trim();
            } else {
                (global as any).log('O-Tiling: Failed to split shader into declarations and code');
                this._shader_code = shader;
            }
        } else {
            (global as any).log(`O-Tiling: Failed to load shader from ${shader_path}`);
        }
    }

    vfunc_build_pipeline() {
        if (!this._shader_code) return;

        const fragmentHook = (Cogl as any).SnippetHook?.FRAGMENT;
        if (fragmentHook === undefined || fragmentHook === null) {
            (global as any).log('O-Tiling: Cogl.SnippetHook.FRAGMENT not available; rounded corners disabled.');
            return;
        }

        this.add_glsl_snippet(
            fragmentHook,
            this._shader_declarations,
            this._shader_code,
            false
        );

        // Cache uniform locations after the pipeline is built (Bug 1 fix)
        this._uniforms.bounds = this.get_uniform_location('bounds');
        this._uniforms.clipRadius = this.get_uniform_location('clipRadius');
        this._uniforms.pixelStep = this.get_uniform_location('pixelStep');
    }

    /**
     * Called on every repaint. By pushing uniforms here we guarantee that:
     *  - Non-active (unfocused) windows always have correct values,
     *    even after mutter rebuilds the pipeline internally.
     *  - CSD-adjusted bounds are always applied.
     */
    vfunc_paint_target(node: any, paint_context: any) {
        const actor = (this as any).get_actor();
        if (!actor || actor.get_width() <= 0 || actor.get_height() <= 0) {
            return;
        }

        this.set_uniform_float(this._uniforms.bounds, 4, this._bounds);
        this.set_uniform_float(this._uniforms.clipRadius, 1, [this._clipRadius]);
        this.set_uniform_float(this._uniforms.pixelStep, 2, this._pixelStep);
        super.vfunc_paint_target(node, paint_context);
    }

    /**
     * Update the stored uniform values.
     * @param radius  corner radius in pixels
     * @param innerX  left edge of visible content within the actor (0 for SSD)
     * @param innerY  top edge of visible content within the actor  (0 for SSD)
     * @param innerW  width  of visible content (actor width for SSD)
     * @param innerH  height of visible content (actor height for SSD)
     */
    update_uniforms(radius: number, innerX: number, innerY: number, innerW: number, innerH: number) {
        // bounds = [left, top, right, bottom] in the actor-local pixel space
        this._bounds = [innerX, innerY, innerX + innerW, innerY + innerH];
        this._clipRadius = radius;

        // pixelStep converts normalised tex-coords → actor-local pixels
        // We use the full actor allocation (innerX + innerW + remaining padding)
        // which equals actor.get_width()/get_height().  The caller already
        // computes those, but to keep this self-contained we derive from bounds.
        const actorW = innerX + innerW + innerX;  // symmetric padding assumed
        const actorH = innerY + innerH + innerY;

        if (actorW <= 0 || actorH <= 0) return;

        this._pixelStep = [1.0 / actorW, 1.0 / actorH];

        this.queue_repaint();
    }

    /**
     * Overload that also accepts the full actor dimensions explicitly.
     * Preferred when the caller already knows the actor size.
     */
    update_uniforms_full(radius: number, innerX: number, innerY: number, innerW: number, innerH: number, actorW: number, actorH: number) {
        if (actorW <= 0 || actorH <= 0) return;

        this._bounds = [innerX, innerY, innerX + innerW, innerY + innerH];
        this._clipRadius = radius;
        this._pixelStep = [1.0 / actorW, 1.0 / actorH];
        this.queue_repaint();
    }
}

export const RoundedCornersEffect = GObject.registerClass(
    {
        GTypeName: 'OTilingRoundedCornersEffect',
    },
    RoundedCornersEffectInternal
);

export type RoundedCornersEffect = RoundedCornersEffectInternal;
