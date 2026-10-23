/* A self-contained, animated ocean. No images, network requests or dependencies. */
const VERTEX = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;
uniform float uProgress;

const vec3 SUN = vec3(0.491, 0.048, -0.870);
const mat2 TURN = mat2(1.64, 1.18, -1.18, 1.64);

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
             mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y);
}
float fbm(vec2 p) {
  float value = 0., weight = .5;
  for (int i = 0; i < 5; i++) {
    value += noise(p) * weight;
    p = TURN * p + 17.1;
    weight *= .48;
  }
  return value;
}
float octave(vec2 p, float sharpness) {
  p += (noise(p) - .5) * .8;
  vec2 a = 1. - abs(sin(p));
  vec2 b = abs(cos(p));
  a = mix(a, b, a);
  return pow(max(1. - pow(a.x * a.y, .67), .001), sharpness);
}
float sea(vec2 p, bool detailed) {
  p.x *= .79;
  float frequency = .20, amplitude = .43, sharpness = 3.4;
  float height = 0.;
  float t = uTime * .48;
  for (int i = 0; i < 5; i++) {
    if (i == 3 && !detailed) break;
    float wave = octave((p + vec2(t, t * .62)) * frequency, sharpness);
    wave += octave((p - vec2(t * .68, t)) * frequency, sharpness);
    height += wave * amplitude;
    p = TURN * p;
    frequency *= 1.83;
    amplitude *= .225;
    sharpness = mix(sharpness, 1., .22);
  }
  return height - .72;
}
vec3 sky(vec3 ray, bool clouds) {
  float altitude = max(ray.y, 0.);
  float gradient = pow(clamp(altitude * 1.45, 0., 1.), .45);
  vec3 color = mix(vec3(.92, .81, .65), vec3(.39, .65, .79), gradient);
  float sun = max(dot(ray, SUN), 0.);
  color += vec3(1., .53, .20) * pow(sun, 20.) * .20;
  color += vec3(1., .73, .37) * pow(sun, 180.) * .38;
  if (clouds && ray.y > -.035) {
    vec2 p = ray.xz / max(ray.y + .14, .065);
    p = p * vec2(1.3, .74) + vec2(uTime * .004, 4.2);
    float cloud = fbm(p * 1.55 + fbm(p * .38) * 2.2);
    float wisps = fbm(p * vec2(.72, 2.7) + 19.);
    float amount = smoothstep(.43, .70, cloud) * .76;
    amount += smoothstep(.55, .73, wisps) * .32;
    amount *= smoothstep(-.025, .045, ray.y);
    vec3 cloudColor = mix(vec3(.57, .64, .66), vec3(1., .96, .84),
                          smoothstep(.41, .65, cloud));
    cloudColor = mix(cloudColor, vec3(1., .86, .65), pow(sun, 13.) * .58);
    color = mix(color, cloudColor, clamp(amount, 0., .85));
  }
  color += vec3(1., .83, .54) * smoothstep(.9995, .99991, sun) * 2.1;
  return color;
}
float intersect(vec3 origin, vec3 ray) {
  float nearT = 0., farT = 1300.;
  float nearH = origin.y - sea(origin.xz, false);
  float farH = (origin + ray * farT).y - sea((origin + ray * farT).xz, false);
  if (farH > 0.) return farT;
  float midT = 0.;
  for (int i = 0; i < 8; i++) {
    midT = mix(nearT, farT, clamp(nearH / (nearH - farH), .02, .98));
    vec3 p = origin + ray * midT;
    float h = p.y - sea(p.xz, false);
    if (h < 0.) { farT = midT; farH = h; }
    else { nearT = midT; nearH = h; }
  }
  return midT;
}
vec3 aboveWater(vec2 uv, float progress) {
  float descent = smoothstep(0., .50, progress);
  float tilt = mix(.198, .11, descent);
  vec3 ray = normalize(vec3(uv.x * .74 + uPointer.x * .018,
                            uv.y * .74 + tilt + uPointer.y * .008, -1.5));
  if (ray.y > -.0012) return sky(ray, true);
  vec3 origin = vec3(uPointer.x * .12, mix(1.34, .55, descent), 4.8 + uTime * .10);
  float distance = intersect(origin, ray);
  vec3 p = origin + ray * distance;
  float epsilon = max(.012, distance * .00075);
  float h = sea(p.xz, true);
  vec3 normal = normalize(vec3(h - sea(p.xz + vec2(epsilon, 0.), true),
                               epsilon, h - sea(p.xz + vec2(0., epsilon), true)));
  vec3 reflected = reflect(ray, normal);
  reflected.y = max(reflected.y, .008);
  float facing = clamp(dot(normal, -ray), 0., 1.);
  float fresnel = .045 + .955 * pow(1. - facing, 4.4);
  vec3 reflection = sky(normalize(reflected), false);
  vec3 deep = vec3(.006, .065, .095);
  float light = max(dot(normal, SUN), 0.);
  vec3 water = deep + vec3(.018, .15, .17) * light * .65;
  water += vec3(.03, .16, .17) * max(h + .30, 0.) * (1. - facing) * .8;
  vec3 color = mix(water, reflection, fresnel);
  float sparkle = max(dot(reflected, SUN), 0.);
  color += vec3(1., .77, .43) * (pow(sparkle, 90.) * .60 + pow(sparkle, 580.) * 5.0);
  float crest = smoothstep(.27, .48, h) * smoothstep(.42, .82, noise(p.xz * 4.));
  color += vec3(.15, .21, .22) * crest * .11;
  color = mix(color, vec3(.58, .66, .66), 1. - exp(-distance * .0007));
  float horizon = smoothstep(-.035, -.001, ray.y);
  return mix(color, sky(ray, false) * .78, horizon * .25);
}

vec3 underwater(vec2 st, vec2 uv, float progress) {
  float depth = smoothstep(.28, 1., progress);
  vec3 color = mix(vec3(.003, .035, .064), vec3(.018, .22, .28), pow(st.y, 1.40));
  vec2 lightPos = vec2(.78 + uPointer.x * .007, 1.04);
  vec2 fromLight = (st - lightPos) * vec2(uResolution.x / uResolution.y, .86);
  float glow = exp(-length(fromLight) * 2.4);
  color += vec3(.06, .27, .29) * glow * .55;

  // Ripples are projected onto the underside of the moving water surface.
  float surfaceY = st.y - .50;
  vec2 surfaceP = vec2(uv.x, -1.7) / max(surfaceY + .12, .075);
  surfaceP += vec2(uTime * .065, uTime * .11);
  float surface = sea(surfaceP * 2., true);
  float surface2 = sea(surfaceP * 2. + vec2(.035, .02), true);
  float slope = (surface - surface2) * 17.;
  float ripples = smoothstep(-.035, .12, slope);
  float fine = noise(surfaceP * 4. + surface * 3.);
  float surfaceMask = smoothstep(.48, .91, st.y);
  vec3 surfaceColor = mix(vec3(.006, .06, .09), vec3(.10, .34, .38), ripples);
  surfaceColor += vec3(.13, .25, .25) * pow(fine, 5.) * ripples;
  float sunPatch = exp(-pow((st.x - .77) * 5.0, 2.) - pow((st.y - .90) * 8., 2.));
  surfaceColor += vec3(.95, .80, .48) * sunPatch * pow(max(slope + .35, 0.), 3.) * .9;
  color = mix(color, surfaceColor, surfaceMask * .88);

  // The light shafts fan out from the sun, with independent slow drift.
  float rayAngle = atan(fromLight.x, -fromLight.y + .035);
  float shaft = pow(.5 + .5 * sin(rayAngle * 31. + sin(rayAngle * 7. + uTime * .15) * 2.), 10.);
  shaft += pow(.5 + .5 * sin(rayAngle * 57. - uTime * .13), 20.) * .45;
  float shaftFade = smoothstep(.01, .23, 1. - st.y) * exp(-(1. - st.y) * 1.5);
  color += vec3(.12, .35, .32) * shaft * shaftFade * .25;
  color += vec3(.23, .40, .33) * sunPatch * .32;

  // Sparse suspended particles, each anchored to its own slowly rising cell.
  for (int i = 0; i < 3; i++) {
    float layer = float(i);
    vec2 cells = st * vec2(33. * uResolution.x / uResolution.y, 33.) * (1. + layer * .57);
    cells += vec2(sin(uTime * .05 + layer) * .35, -uTime * (.11 + layer * .055));
    vec2 id = floor(cells);
    vec2 local = fract(cells) - vec2(.22 + hash(id) * .55, .22 + hash(id + 7.) * .55);
    float particle = 1. - smoothstep(.018, .055, length(local));
    particle *= step(.966, hash(id + layer * 73.));
    color += vec3(.25, .48, .49) * particle * (.30 - layer * .07);
  }
  color *= 1. - depth * .12;
  return color;
}

void main() {
  vec2 st = gl_FragCoord.xy / uResolution;
  vec2 uv = (gl_FragCoord.xy * 2. - uResolution) / uResolution.y;
  float progress = clamp(uProgress, 0., 1.);
  float crossing = smoothstep(.22, .72, progress);
  float wave = sin(st.x * 13. + uTime * .9) * .014
             + sin(st.x * 31. - uTime * .63) * .006;
  float waterline = mix(-.10, 1.13, crossing) + wave * sin(crossing * 3.14159);
  float submerged = 1. - smoothstep(waterline - .016, waterline + .016, st.y);
  vec3 color;
  if (submerged < .001) {
    color = aboveWater(uv, progress);
  } else if (submerged > .999) {
    color = underwater(st, uv, progress);
  } else {
    vec2 distorted = uv;
    distorted.y += sin((st.y - waterline) * 90.) * .035;
    color = mix(aboveWater(distorted, progress), underwater(st, uv, progress), submerged);
    color += vec3(.12, .25, .25) * exp(-abs(st.y - waterline) * 340.) * .65;
  }
  // Gentle film response preserves bright sunset glints without clipping the sky.
  color = 1. - exp(-color * 1.18);
  color = pow(max(color, .0), vec3(.83));
  float vignette = 1. - .10 * dot(st - .5, st - .5);
  color *= vignette;
  color += (hash(gl_FragCoord.xy + fract(uTime) * 73.) - .5) / 255.;
  gl_FragColor = vec4(color, 1.);
}
`;

export class OceanScene {
  constructor(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('OceanScene requires a canvas.');
    this.canvas = canvas;
    this.progress = 0;
    this.targetProgress = 0;
    this.pointer = [0, 0];
    this.targetPointer = [0, 0];
    this.paused = false;
    this.destroyed = false;
    this.time = 12;
    this.frame = 0;
    this.last = 0;
    this.slowFrames = 0;
    this.quality = 1;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.onResize = () => this.resize();
    this.onVisibility = () => { this.last = 0; if (!document.hidden) this.requestFrame(); };
    this.onContextLost = (event) => { event.preventDefault(); this.contextLost = true; };
    this.onContextRestored = () => { this.contextLost = false; this.setup(); this.resize(); this.requestFrame(); };
    this.gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, powerPreference: 'high-performance',
    });
    if (!this.gl) {
      this.fallback();
      return;
    }
    try { this.setup(); } catch (error) {
      console.warn('Ocean renderer could not initialize:', error.message);
      this.fallback();
      return;
    }
    window.addEventListener('resize', this.onResize, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.resize();
    this.requestFrame();
  }

  setup() {
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    this.program = program;
    gl.useProgram(program);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    this.uniforms = Object.fromEntries(['uResolution', 'uPointer', 'uTime', 'uProgress']
      .map(name => [name, gl.getUniformLocation(program, name)]));
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  fallback() {
    this.isFallback = true;
    this.canvas.style.background = 'radial-gradient(ellipse at 78% 61%, #f7d7a0 0, transparent 20%), linear-gradient(#95bfd0 0%, #bfd2d3 48%, #e8d7b7 63%, #386b7b 64%, #174557 82%, #0b2b3d 100%)';
    this.canvas.setAttribute('data-ocean-fallback', '');
  }

  resize() {
    if (this.destroyed || this.isFallback || !this.gl) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    const pixelBudget = 1_350_000 * this.quality;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.4,
      Math.sqrt(pixelBudget / Math.max(width * height, 1)));
    this.canvas.width = Math.max(1, Math.round(width * ratio));
    this.canvas.height = Math.max(1, Math.round(height * ratio));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.requestFrame();
  }

  setProgress(value) {
    this.targetProgress = Math.min(1, Math.max(0, Number(value) || 0));
    if (this.isFallback) {
      const p = this.targetProgress;
      this.canvas.style.filter = `brightness(${1 - p * .45}) saturate(${1 + p * .35})`;
      if (p > .5) this.canvas.style.background = 'radial-gradient(ellipse at 78% 0%, #237e8c, transparent 63%), linear-gradient(#145c71, #031b30)';
      else this.fallback();
    } else {
      this.requestFrame();
    }
  }

  setPointer(x, y) {
    this.targetPointer = [Math.min(1, Math.max(-1, Number(x) || 0)),
      Math.min(1, Math.max(-1, Number(y) || 0))];
    this.requestFrame();
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    this.last = 0;
    this.requestFrame();
  }

  requestFrame() {
    if (!this.frame && !this.destroyed && !this.isFallback && !document.hidden && !this.contextLost) {
      this.frame = requestAnimationFrame(time => this.render(time));
    }
  }

  render(now) {
    this.frame = 0;
    if (this.destroyed || this.contextLost || document.hidden) return;
    const elapsed = this.last ? Math.min((now - this.last) / 1000, .1) : 1 / 60;
    this.last = now;
    if (!this.paused && !this.reducedMotion) this.time += elapsed;
    const easing = 1 - Math.exp(-elapsed * 8);
    this.progress += (this.targetProgress - this.progress) * easing;
    this.pointer[0] += (this.targetPointer[0] - this.pointer[0]) * easing;
    this.pointer[1] += (this.targetPointer[1] - this.pointer[1]) * easing;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.uniforms.uPointer, this.pointer[0], this.pointer[1]);
    gl.uniform1f(this.uniforms.uTime, this.time);
    gl.uniform1f(this.uniforms.uProgress, this.progress);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (elapsed > .043 && !this.paused) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 70 && this.quality > .5) {
      this.quality = Math.max(.5, this.quality * .78);
      this.slowFrames = 0;
      this.resize();
    }
    const settling = Math.abs(this.targetProgress - this.progress) > .0001
      || Math.abs(this.targetPointer[0] - this.pointer[0]) > .001
      || Math.abs(this.targetPointer[1] - this.pointer[1]) > .001;
    if ((!this.paused && !this.reducedMotion) || settling) this.requestFrame();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    if (this.gl && !this.contextLost) {
      this.gl.deleteBuffer(this.buffer);
      this.gl.deleteProgram(this.program);
    }
  }
}

export const initOcean = canvas => new OceanScene(canvas);
