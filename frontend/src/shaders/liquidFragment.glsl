varying vec2 vUv;
uniform vec2 u_points[8];
uniform float u_radii[8];
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_velocity;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;

float metaballField(vec2 pos) {
  float val = 0.0;
  float vel = length(u_velocity);

  for (int i = 0; i < 8; i++) {
    vec2 diff = (pos - u_points[i]) / u_resolution.y;
    float dist = length(diff);
    float r = u_radii[i];

    if (i == 0) {
      r += vel * 0.22;
    } else if (i == 1) {
      r += vel * 0.14;
    }

    if (dist > 0.001) {
      val += r / dist;
    }
  }

  return val;
}

vec3 computeNormal(vec2 pos) {
  float eps = 2.5;
  float dx = metaballField(pos + vec2(eps, 0.0)) - metaballField(pos - vec2(eps, 0.0));
  float dy = metaballField(pos + vec2(0.0, eps)) - metaballField(pos - vec2(0.0, eps));
  return normalize(vec3(-dx * 1.4, -dy * 1.4, 0.12));
}

void main() {
  vec2 fragPos = gl_FragCoord.xy;
  float field = metaballField(fragPos);

  float threshold = 10.0;
  float alpha = smoothstep(threshold - 1.4, threshold + 0.8, field);

  if (alpha < 0.004) {
    discard;
  }

  vec3 normal = computeNormal(fragPos);
  vec3 lightDir = normalize(vec3(0.25, 0.55, 1.0));
  vec3 lightDir2 = normalize(vec3(-0.4, -0.2, 0.8));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);

  float diff = max(dot(normal, lightDir), 0.0);
  float diff2 = max(dot(normal, lightDir2), 0.0) * 0.35;
  float spec = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 48.0);
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.8);

  float vel = length(u_velocity);
  float ripple = sin(field * 3.5 - u_time * 4.0 + vel * 0.08) * 0.04;
  float pattern = sin(vUv.x * 10.0 + u_time * 0.9 + ripple) * cos(vUv.y * 8.0 + u_time * 0.7);

  vec3 base = mix(u_color1, u_color2, vUv.y + pattern * 0.1 + ripple);
  vec3 lit = base * (0.5 + diff * 0.42 + diff2);
  lit += u_color3 * spec * 0.9;
  lit += vec3(1.0) * fresnel * 0.45;

  float innerGlow = smoothstep(threshold + 0.5, threshold + 4.0, field);
  lit = mix(lit, vec3(1.0), innerGlow * 0.18);

  gl_FragColor = vec4(lit, alpha * 0.52);
}
