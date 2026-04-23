import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import Cogl from 'gi://Cogl';
import * as utils from './utils.js';
import { get_current_path } from './paths.js';

class RoundedCornersEffectInternal extends Shell.GLSLEffect {
    private _radius: number = 0;
    private _width: number = 0;
    private _height: number = 0;
    private _shader_source: string | null = null;

    constructor(params?: object) {
        super(params);
        
        // Load shader source from file
        const shader_path = `${get_current_path()}/rounded_corners.frag`;
        const result = utils.read_to_string(shader_path);
        if (result.kind === 1) { // Ok
            this._shader_source = result.value;
        } else {
            // Fallback or log error
            (global as any).log(`O-Tiling: Failed to load shader from ${shader_path}`);
        }
    }

    vfunc_build_pipeline() {
        if (!this._shader_source) return;

        this.add_glsl_snippet(
            Cogl.SnippetHook.FRAGMENT,
            `
            uniform float radius;
            uniform vec2 size;
            `,
            this._shader_source,
            false
        );
    }

    update_uniforms(radius: number, width: number, height: number) {
        if (this._radius !== radius) {
            this._radius = radius;
            (this as any).set_uniform_float('radius', 1, [radius]);
        }
        if (this._width !== width || this._height !== height) {
            this._width = width;
            this._height = height;
            (this as any).set_uniform_float('size', 2, [width, height]);
        }
    }
}

export const RoundedCornersEffect = GObject.registerClass(
    {
        GTypeName: 'OTilingRoundedCornersEffect',
    },
    RoundedCornersEffectInternal
);

export type RoundedCornersEffect = RoundedCornersEffectInternal;
