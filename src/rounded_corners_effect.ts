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

        // Cogl.SnippetHook.FRAGMENT is correct for GNOME 45-50 (GJS-48 docs)
        // Shell.SnippetHook.FRAGMENT is the deprecated path — remove it
        const fragmentHook: number =
            (Cogl as any).SnippetHook?.FRAGMENT ??
            2048; // stable numeric constant for FRAGMENT across GNOME 45-50

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

    update_uniforms(radius: number, width: number, height: number) {
        const bounds = [0, 0, width, height];
        const pixelStep = [1.0 / width, 1.0 / height];

        this.set_uniform_float(this._uniforms.bounds, 4, bounds);
        this.set_uniform_float(this._uniforms.clipRadius, 1, [radius]);
        this.set_uniform_float(this._uniforms.pixelStep, 2, pixelStep);
    }
}

export const RoundedCornersEffect = GObject.registerClass(
    {
        GTypeName: 'OTilingRoundedCornersEffect',
    },
    RoundedCornersEffectInternal
);

export type RoundedCornersEffect = RoundedCornersEffectInternal;
