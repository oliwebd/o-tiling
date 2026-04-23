uniform vec4 bounds;
uniform float clipRadius;
uniform vec2 pixelStep;

float circleBounds(vec2 p, vec2 center, float radius) {
    vec2 delta = p - center;
    float distSquared = dot(delta, delta);
    float outerRadius = radius + 0.5;
    if (distSquared >= (outerRadius * outerRadius)) return 0.0;
    float innerRadius = radius - 0.5;
    if (distSquared <= (innerRadius * innerRadius)) return 1.0;
    return outerRadius - sqrt(distSquared);
}

float getPointOpacity(vec2 p, vec4 bounds, float radius) {
    if (p.x < bounds.x || p.x > bounds.z || p.y < bounds.y || p.y > bounds.w) return 0.0;
    
    float centerLeft = bounds.x + radius;
    float centerRight = bounds.z - radius;
    float centerTop = bounds.y + radius;
    float centerBottom = bounds.w - radius;
    
    vec2 center;
    if (p.x < centerLeft) center.x = centerLeft;
    else if (p.x > centerRight) center.x = centerRight;
    else return 1.0;
    
    if (p.y < centerTop) center.y = centerTop;
    else if (p.y > centerBottom) center.y = centerBottom;
    else return 1.0;
    
    return circleBounds(p, center, radius);
}

void main() {
    vec2 p = cogl_tex_coord0_in.xy / pixelStep;
    cogl_color_out *= getPointOpacity(p, bounds, clipRadius);
}
