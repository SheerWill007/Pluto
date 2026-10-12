import { useEffect, useRef } from 'react';
import { scrollState } from '../../lib/scrollState';

/**
 * A full-bleed WebGL "cosmic eye": swirling star streaks around a glowing blue core.
 * The core travels on a circular orbit while the streaks rotate around it, and scroll
 * velocity spins the vortex faster. Rendering pauses while the canvas is off-screen.
 */

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uSpin;
uniform float uZoom;
uniform float uOrbit;
uniform float uCenterY;
uniform float uBright;
uniform float uDive;
uniform vec2 uMouse;

// --- Simplex 3D noise (Ashima Arts / Stefan Gustavson, MIT) ---------------------------
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Thin bright filaments along the noise zero-crossings: long along the swirl, thin across it.
// aa fades a layer to its average brightness once strands get thinner than ~2 pixels.
float strands(vec3 p, float sharpness, float aa) {
  float ridge = pow(1.0 - abs(snoise(p)), sharpness);
  return mix(0.45 / (sharpness + 1.0), ridge, aa);
}

float stars(vec2 uv, float scale, float t, float seed) {
  vec2 g = uv * scale;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash12(id + seed);
  if (h < 0.94) return 0.0;
  vec2 off = vec2(hash12(id + seed + 1.7), hash12(id + seed + 9.1)) - 0.5;
  float d = length(f - off * 0.7) / scale * uRes.y;   // distance in pixels
  float twinkle = 0.65 + 0.35 * sin(t * (0.8 + h * 3.0) + h * 40.0);
  return (exp(-d * d * 0.9) + 0.12 * exp(-d * 0.6)) * twinkle * (h - 0.94) * 16.0;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 suv = uv;
  uv /= uZoom;
  float t = uTime;

  // The glowing core travels on a circle; the mouse nudges it a little
  vec2 center = vec2(0.0, uCenterY) + uOrbit * vec2(cos(t * 0.32), sin(t * 0.32)) + uMouse * 0.03;
  vec2 d = uv - center;
  d.y *= 1.8;                                   // a tunnel mouth seen at an angle
  float r = max(length(d), 1e-4);
  float a = atan(d.y, d.x);
  float facing = d.y / r;                       // +1 = far (upper) wall, lit; -1 = near wall

  // Polar frame that winds tighter toward the throat and rotates as a whole
  float swirl = a + 1.25 / (r + 0.2) + uSpin;
  vec2 ring = vec2(cos(swirl), sin(swirl));
  float flow = t * 0.05;                        // slow drift inward, into the throat
  float lr = log(r + 0.02);

  // Strands wander instead of tracing perfect circles
  float warp = snoise(vec3(ring * 1.4 + 3.0, lr * 2.0 - flow)) * 0.045;
  float lw = lr + warp;

  // Pixel footprint in log-radius units, for anti-aliasing the finest layers
  float foot = 1.8 / (uRes.y * uZoom * r);
  float aa1 = smoothstep(0.75, 0.3, 40.0 * foot);
  float aa2 = smoothstep(0.75, 0.3, 105.0 * foot);
  float aa3 = smoothstep(0.75, 0.3, 230.0 * foot);

  float h1 = strands(vec3(ring * 2.0, lw * 40.0 + flow * 3.0), 5.0, aa1);
  float h2 = strands(vec3(ring * 3.4 + 11.0, lw * 105.0 + flow * 7.0), 9.0, aa2);
  float h3 = strands(vec3(ring * 5.5 + 23.0, lw * 230.0 + flow * 14.0), 14.0, aa3);

  // Strands gather in clumps, like brush strokes of light
  float clump = smoothstep(-0.15, 0.8, snoise(vec3(ring * 0.9, lr * 3.2 + flow * 0.6)));
  clump *= clump;
  float clump2 = 0.55 + 0.45 * snoise(vec3(ring * 1.8 + 7.0, lr * 7.5 + flow * 1.4));
  float fibres = (h1 * 0.85 + h2 * 0.95 + h3 * 0.8) * mix(0.12, 1.0, clump) * clump2;

  // Radial profile: glowing throat, brightest at the rim, fading into space
  float rim = 0.22;
  float body = smoothstep(rim - 0.1, rim + 0.02, r) * exp(-max(r - rim, 0.0) * 1.25);
  float light = mix(0.35, 1.25, smoothstep(-0.8, 0.85, facing));
  float heat = smoothstep(0.85, 0.2, r);        // inner strands run hotter (whiter)

  vec3 steel = vec3(0.16, 0.36, 0.62);
  vec3 ice = vec3(0.78, 0.92, 1.0);
  vec3 fibreCol = mix(steel, ice, clamp(fibres * 1.3 * (0.35 + heat) + heat * 0.2, 0.0, 1.0));
  vec3 col = fibreCol * fibres * body * light * 2.5;

  // Deep blue body of the vortex behind the strands
  col += vec3(0.01, 0.035, 0.08) * clump * body * light * 1.6;

  // Rim: a luminous lip where the tunnel turns inward
  float lip = exp(-pow((r - rim) / 0.045, 2.0));
  col += vec3(0.42, 0.74, 1.0) * lip * (0.35 + 0.65 * clump) * (0.4 + 0.6 * light) * 0.55;

  // Throat: a glowing ice-blue interior, still faintly streaked
  float inside = 1.0 - smoothstep(rim * 0.55, rim + 0.02, r);
  float throatGlow = exp(-r * r / 0.03);
  vec3 throatCol = mix(vec3(0.1, 0.36, 0.6), vec3(0.55, 0.85, 1.0), throatGlow);
  col += throatCol * (throatGlow * 0.85 + inside * 0.25) * (0.75 + 0.35 * fibres);
  col += vec3(0.85, 0.96, 1.0) * exp(-r * r / 0.0035) * 0.45;   // hot centre

  // Broad bloom so the light spills into the surrounding dark
  col += vec3(0.05, 0.14, 0.3) * exp(-r * 2.4) * 0.55;

  // Faint nebula haze far from the vortex
  float haze = 0.5 + 0.5 * snoise(vec3(suv * 1.1, t * 0.015));
  col += vec3(0.008, 0.022, 0.05) * haze;

  // Stars: cool white plus a few warm ones, drifting slowly
  vec2 starUv = suv + vec2(t * 0.003, 0.0);
  float st = stars(starUv, 34.0, t, 0.0) + stars(starUv, 61.0, t * 1.3, 41.0) * 0.6;
  float warm = stars(starUv, 19.0, t * 0.7, 83.0);
  col += vec3(0.82, 0.9, 1.0) * st * 0.75;
  col += vec3(1.0, 0.56, 0.52) * warm * 0.7;

  // Diving in brightens the tunnel
  col *= uBright * (1.0 + uDive * 0.6);

  // Vignette toward the bottom and edges
  float vig = smoothstep(1.3, 0.25, length(suv * vec2(0.85, 1.0) - vec2(0.0, 0.12)));
  col *= mix(0.3, 1.0, vig);

  // Filmic tone curve, then fine grain (also hides gradient banding)
  col = aces(col * 1.15);
  float grain = hash12(gl_FragCoord.xy + fract(t * 7.0) * 517.0) - 0.5;
  col += grain * 0.022;
  gl_FragColor = vec4(col, 1.0);
}
`;

export interface VortexCanvasProps {
  className?: string;
  /** Larger = closer to the vortex */
  zoom?: number;
  /** Vertical position of the core in viewport-height units (0 = middle) */
  centerY?: number;
  /** Radius of the core's circular orbit */
  orbit?: number;
  brightness?: number;
  /** Device-pixel-ratio cap; lower renders cheaper (useful for blurred backdrops) */
  maxDpr?: number;
  /** Feed scroll velocity / dive progress into the shader */
  reactToScroll?: boolean;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Vortex shader failed to compile:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function VortexCanvas({
  className = '',
  zoom = 1,
  centerY = 0.28,
  orbit = 0.075,
  brightness = 1,
  maxDpr = 1.5,
  reactToScroll = true,
}: VortexCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Props are read inside the render loop through a ref, so changing them never restarts WebGL
  const propsRef = useRef({ zoom, centerY, orbit, brightness, reactToScroll });
  propsRef.current = { zoom, centerY, orbit, brightness, reactToScroll };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return; // the CSS gradient fallback behind the canvas stays visible

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('Vortex program failed to link:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u('uRes'), uTime = u('uTime'), uSpin = u('uSpin'), uZoom = u('uZoom'), uOrbit = u('uOrbit');
    const uCenterY = u('uCenterY'), uBright = u('uBright'), uDive = u('uDive'), uMouse = u('uMouse');

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motionScale = reducedMotion ? 0.15 : 1;

    let width = 0, height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width * dpr));
      height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    // Smoothed pointer, normalized to [-1, 1]
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(canvas);

    let raf = 0;
    let last = performance.now();
    let time = 0;
    let spin = 0;
    let zoomNow = propsRef.current.zoom;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!visible || document.hidden) return;

      const p = propsRef.current;
      const velocity = p.reactToScroll ? scrollState.velocity : 0;
      const dive = p.reactToScroll ? scrollState.dive : 0;

      time += dt * motionScale;
      // Base rotation plus a kick from scroll velocity (either direction spins it)
      spin += dt * motionScale * (0.22 + Math.min(Math.abs(velocity) * 0.04, 1.6));
      // Zoom eases toward its target so dive transitions feel weighty
      const targetZoom = p.zoom * (1 + dive * 1.35);
      zoomNow += (targetZoom - zoomNow) * Math.min(1, dt * 6);
      mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 2.5);
      mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 2.5);

      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uSpin, spin);
      gl.uniform1f(uZoom, zoomNow);
      gl.uniform1f(uOrbit, p.orbit);
      gl.uniform1f(uCenterY, p.centerY * (1 - dive * 0.85));
      gl.uniform1f(uBright, p.brightness);
      gl.uniform1f(uDive, dive);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [maxDpr]);

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 22%, #1d4f7a 0%, #0a1a2c 40%, #03050a 75%)' }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

export default VortexCanvas;
