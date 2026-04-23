uniform float radius;
uniform vec2 size;

void main() {
    vec2 pos = cogl_tex_coord_in[0].st * size;
    vec2 dist = min(pos, size - pos);
    
    if (dist.x < radius && dist.y < radius) {
        if (distance(dist, vec2(radius)) > radius) {
            cogl_color_out.a = 0.0;
        }
    }
}
