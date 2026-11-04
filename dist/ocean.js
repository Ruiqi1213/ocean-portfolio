/* Animated ocean with a local sky photograph and no library dependencies.
 * Wave-profile / analytical-gradient approach adapted from sunset-shader,
 * Copyright (c) 2026 Nimesh Mohanakrishnan (MIT). See vendor-LICENSE.txt.
 */
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
uniform sampler2D uSkyTexture;
uniform float uHasSkyTexture;
uniform sampler2D uWaterNormals;
uniform float uHasWaterNormals;
uniform sampler2D uUnderTexture;
uniform float uHasUnderTexture;

vec3 sunDirection() {
  return normalize(vec3(.42328 * uResolution.x / uResolution.y, .0572, -1.5));
}
#define SUN sunDirection()
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
// Physical dispersion gives each wavelength its own speed. The peaked profile
// produces rounded troughs and steep, translucent crests instead of flat noise.
vec3 oceanWave(vec2 p, vec2 direction, float wavelength, float amplitude, float phase, float distance) {
  float k = 6.2831853 / wavelength;
  float angle = dot(p, direction) * k - uTime * sqrt(9.81 * k) * .76 + phase;
  float profile = exp(sin(angle) - 1.);
  float weight = amplitude * exp(-distance * .085 / wavelength);
  float slope = weight * profile * cos(angle) * k;
  return vec3(weight * (profile - .4658), slope * direction);
}
vec3 waveSpectrum(vec2 p, float distance, bool detailed) {
  vec3 wave = oceanWave(p, vec2(.24, .971), 26., 1.25, .2, distance);
  wave += oceanWave(p, vec2(-.37, .929), 15.3, .92, 2.4, distance);
  wave += oceanWave(p, vec2(.65, .760), 9.1, .46, 5.3, distance);
  wave += oceanWave(p, vec2(-.79, .613), 5.7, .18, 1.1, distance);
  wave += oceanWave(p, vec2(.12, .993), 3.25, .070, 3.7, distance);
  if (detailed) {
    wave += oceanWave(p, vec2(.88, .475), 1.95, .065, 4.9, distance * .45);
    wave += oceanWave(p, vec2(-.58, .815), 1.13, .032, 2.8, distance * .45);
    wave += oceanWave(p, vec2(.44, .898), .61, .014, .9, distance * .35);
    wave += oceanWave(p, vec2(-.91, .415), .34, .005, 5.7, distance * .30);
  }
  return wave;
}
float sea(vec2 p, bool detailed) { return waveSpectrum(p, 0., detailed).x; }
vec2 waterDetail(vec2 p, float distance) {
  if (uHasWaterNormals < .5) return vec2(0.);
  float t = uTime;
  vec2 n = (texture2D(uWaterNormals, p * .024 + vec2(t * .006, t * .003)).rg * 2. - 1.) * .32;
  n += (texture2D(uWaterNormals, p.yx * .041 + vec2(-t * .004, t * .005)).rg * 2. - 1.) * .28;
  n += (texture2D(uWaterNormals, p * .065 + vec2(t * .002, -t * .004)).rg * 2. - 1.) * .23;
  n += (texture2D(uWaterNormals, p.yx * .12 + vec2(-t * .006, -t * .002)).rg * 2. - 1.) * .17;
  return n * 1.15 * exp(-distance * .025);
}
vec3 inverseFilmic(vec3 displayLinear) {
  vec3 a = 2.51 - 2.43 * displayLinear;
  vec3 b = .03 - .59 * displayLinear;
  return (-b + sqrt(b * b + .56 * a * displayLinear)) / (2. * a);
}
vec3 sky(vec3 ray, bool clouds) {
  if (uHasSkyTexture > .5) {
    // Project the photographic sky above the same horizon used by the waves.
    // The identical environment is reflected by every moving water facet.
    float projection = max(-ray.z, .12);
    float aspect = uResolution.x / uResolution.y;
    vec2 skyUV = vec2(.5 + ray.x / projection / (.9866667 * aspect),
                      ray.y / projection / .6253333);
    skyUV = clamp(skyUV, vec2(.001), vec2(.999));
    vec3 photograph = texture2D(uSkyTexture, skyUV).rgb;
    // Undo the display curve before lighting, so the final sky retains the
    // image's natural blue and warm gold instead of being tone-mapped twice.
    return inverseFilmic(pow(photograph, vec3(2.2)));
  }
  float altitude = max(ray.y, 0.);
  float gradient = pow(clamp(altitude * 1.75, 0., 1.), .47);
  vec3 color = mix(vec3(.92, .78, .55), vec3(.18, .43, .68), gradient);
  float sun = max(dot(ray, SUN), 0.);
  color += vec3(1., .55, .22) * pow(sun, 28.) * .24;
  color += vec3(1., .72, .35) * pow(sun, 210.) * .65;
  if (ray.y > -.035) {
    vec2 p = ray.xz / max(ray.y + .14, .065);
    p = p * vec2(1.3, .74) + vec2(uTime * .004, 4.2);
    float warp = noise(p * .38) * 2.2;
    float cloud = fbm(p * 1.55 + warp);
    float wisps = clouds ? fbm(p * vec2(.72, 2.7) + 19.) : .0;
    float amount = smoothstep(.42, .67, cloud) * .90;
    amount += smoothstep(.53, .73, wisps) * .33;
    amount *= smoothstep(-.025, .045, ray.y);
    float sunward = fbm(p * 1.55 + warp + vec2(.11, -.08));
    float rim = clamp((cloud - sunward) * 6., 0., 1.);
    vec3 cloudColor = mix(vec3(.23, .32, .40), vec3(1.45, 1.32, 1.10),
                          smoothstep(.43, .65, cloud) * .75 + rim * .25);
    cloudColor = mix(cloudColor, vec3(1.45, 1.10, .68), pow(sun, 13.) * .48);
    color = mix(color, cloudColor, clamp(amount, 0., .85));
  }
  color += vec3(1., .80, .47) * smoothstep(.99970, .99994, sun) * 8.;
  return color;
}
vec3 reflectedSky(vec3 direction, float distance) {
  // A small reflection cone represents unresolved capillary waves. Unlike an
  // ideal mirror this keeps cloud edges soft and eliminates metallic contours.
  float blur = mix(.022, .070, 1. - exp(-distance * .025));
  vec3 reflected = min(sky(direction, false), vec3(1.6)) * .34;
  reflected += min(sky(normalize(direction + vec3(blur, blur * .4, 0.)), false), vec3(1.6)) * .22;
  reflected += min(sky(normalize(direction + vec3(-blur, blur * .4, 0.)), false), vec3(1.6)) * .22;
  reflected += min(sky(normalize(direction + vec3(0., blur, .01)), false), vec3(1.6)) * .22;
  float brightness = dot(reflected, vec3(.2126, .7152, .0722));
  return mix(vec3(brightness), reflected, .68) * .60;
}
float intersect(vec3 origin, vec3 ray) {
  float nearT = 0., farT = 1300.;
  float nearH = origin.y - sea(origin.xz, false);
  float farH = (origin + ray * farT).y - waveSpectrum((origin + ray * farT).xz, farT, false).x;
  if (farH > 0.) return farT;
  float midT = 0.;
  for (int i = 0; i < 8; i++) {
    midT = mix(nearT, farT, clamp(nearH / (nearH - farH), .02, .98));
    vec3 p = origin + ray * midT;
    float h = p.y - waveSpectrum(p.xz, midT, false).x;
    if (h < 0.) { farT = midT; farH = h; }
    else { nearT = midT; nearH = h; }
  }
  return midT;
}
vec3 aboveWater(vec2 uv, float progress) {
  float descent = smoothstep(.08, .82, progress);
  float tilt = mix(.198, .11, descent) + sin(uTime * .63) * .006;
  vec3 ray = normalize(vec3(uv.x * .74 + uPointer.x * .018,
                            uv.y * .74 + tilt + uPointer.y * .008, -1.5));
  if (ray.y > -.0012) return sky(ray, true);
  vec3 origin = vec3(uPointer.x * .12, mix(1.58, .95, descent) + sin(uTime * .76) * .075, 4.8);
  float distance = intersect(origin, ray);
  vec3 p = origin + ray * distance;
  vec3 spectrum = waveSpectrum(p.xz, distance, true);
  float h = spectrum.x;
  vec2 gradient = spectrum.yz;
  // Four drifting layers of the licensed water material add fine ripples.
  // Mipmaps and distance attenuation prevent glittering noise at the horizon.
  gradient += waterDetail(p.xz, distance);
  vec3 normal = normalize(vec3(-gradient.x, 1., -gradient.y));
  vec3 reflected = reflect(ray, normal);
  reflected.y = max(reflected.y, .008);
  float facing = clamp(dot(normal, -ray), 0., 1.);
  float fresnel = .0204 + .9796 * pow(1. - facing, 5.);
  vec3 reflection = reflectedSky(normalize(reflected), distance);
  vec3 deep = vec3(.0025, .028, .044);
  float light = max(dot(normal, SUN), 0.);
  vec3 water = deep + vec3(.006, .10, .135) * light * .55;
  float crest = smoothstep(-.20, .75, h);
  float throughCrest = crest * (.35 + .65 * pow(max(dot(ray, SUN), 0.), 3.));
  water += vec3(.015, .20, .19) * throughCrest * (1. - fresnel) * .85;
  vec3 color = mix(water, reflection, fresnel * .84);
  vec3 halfway = normalize(SUN - ray);
  float sparkle = max(dot(normal, halfway), 0.);
  float shininess = mix(35., 480., exp(-distance * .025));
  float glint = pow(sparkle, shininess) * (shininess + 2.) / 25.1327;
  float glintFresnel = .0204 + .9796 * pow(1. - max(dot(halfway, -ray), 0.), 5.);
  color += vec3(1., .79, .45) * glint * glintFresnel * .55;
  float foam = smoothstep(.82, 1.24, h) * smoothstep(.53, .8, noise(p.xz * 7.));
  color = mix(color, vec3(.75, .88, .88), foam * .20);
  color = mix(color, sky(normalize(vec3(ray.x, .004, ray.z)), false) * .65,
              1. - exp(-distance * .00045));
  return color;
}

vec3 underwaterPhotograph(vec2 st, float progress) {
  float depth = smoothstep(.20, 1., progress);
  vec2 coordinates = (st - .5) / mix(1.012, 1., depth) + .5;
  coordinates.y += (1. - depth) * .008;
  // Cover-fit the 16:9 photograph without squeezing its waves on tall screens.
  float viewportAspect = uResolution.x / uResolution.y;
  float photoAspect = 1672. / 941.;
  vec2 crop = vec2(min(1., viewportAspect / photoAspect), min(1., photoAspect / viewportAspect));
  float horizontalFocus = mix(.70, .5, smoothstep(.65, 1.30, viewportAspect));
  coordinates = (coordinates - .5) * crop + vec2(horizontalFocus, .5);

  // Refraction is anchored in the water's own coordinates. Independent bands
  // keep the ceiling moving while the camera and the open water remain steady.
  vec2 waterPosition = coordinates * vec2(photoAspect, 1.);
  float upper = smoothstep(.28, .88, coordinates.y);
  float waveA = dot(waterPosition, vec2(19., 8.)) - uTime * .72;
  float waveB = dot(waterPosition, vec2(-13., 22.)) + uTime * .58;
  float waveC = dot(waterPosition, vec2(39., -29.)) - uTime * 1.08;
  vec2 swell = vec2(sin(waveA) * .0023 + sin(waveB) * .0013,
                    cos(waveB) * .0031 + sin(waveC) * .0012);
  vec2 fineRefraction = waterDetail(waterPosition * vec2(34., 29.)
                       + vec2(uTime * .14, -uTime * .20), 0.) * .018;
  coordinates += (swell + fineRefraction) * upper;
  coordinates += uPointer * vec2(.0015, .0010) * upper;
  vec3 photo = texture2D(uUnderTexture, clamp(coordinates, .003, .997)).rgb;
  vec3 color = inverseFilmic(pow(photo, vec3(2.2)));

  // Local moving caustics follow the ripple bands; this does not pulse the
  // exposure of the entire photograph or shift its original color balance.
  float surfaceLight = .080 * sin(waveA + sin(waveB) * .45)
                     + .045 * sin(waveC + .7);
  float highlightMask = .35 + .65 * smoothstep(.20, .72, dot(photo, vec3(.2126, .7152, .0722)));
  color *= 1. + surfaceLight * upper * highlightMask;

  // Broad, independently drifting shafts simulate sunlight scattered through
  // the water. Their varying widths and soft falloff avoid regular laser lines.
  vec2 fromSun = vec2((coordinates.x - .79) * photoAspect, .91 - coordinates.y);
  float shaftAngle = atan(fromSun.x, max(fromSun.y, .08));
  float shaftA = exp(-pow((shaftAngle + .48 + .055 * sin(uTime * .24)) / .19, 2.));
  float shaftB = exp(-pow((shaftAngle + .13 - .045 * sin(uTime * .31 + 1.7)) / .125, 2.));
  float shaftC = exp(-pow((shaftAngle - .23 + .065 * sin(uTime * .19 + 3.2)) / .22, 2.));
  float shafts = shaftA * (.56 + .22 * sin(uTime * .37 + .8))
               + shaftB * (.65 + .26 * sin(uTime * .43 + 2.4))
               + shaftC * (.38 + .17 * sin(uTime * .29 + 4.1));
  float depthFade = (1. - smoothstep(.66, .91, coordinates.y))
                  * exp(-max(.73 - coordinates.y, 0.) * 2.6);
  float shaftDapple = .70 + .30 * noise(vec2(shaftAngle * 8. + uTime * .11,
                                             coordinates.y * 3. - uTime * .13));
  color += vec3(.020, .054, .052) * shafts * depthFade * shaftDapple;

  // Tiny air bubbles rise at different speeds. The offset rim highlight and
  // faint core distinguish them from opaque white dots or a particle overlay.
  for (int i = 0; i < 3; i++) {
    float layer = float(i);
    float spacing = 86. + layer * 31.;
    vec2 cells = gl_FragCoord.xy / spacing;
    cells.y -= uTime * (.13 / (1. + layer * .70));
    cells.x += sin(uTime * .16 + layer * 2.) * .08;
    vec2 id = floor(cells);
    float seed = hash(id + layer * 71.);
    vec2 center = vec2(.22 + hash(id + 3.) * .56, .20 + hash(id + 13.) * .60);
    vec2 delta = (fract(cells) - center) * spacing;
    float radius = mix(.62, 1.65, hash(id + 41.)) * (1. - layer * .12);
    float d = length(delta);
    float softness = .38 + layer * .20;
    float rim = exp(-pow((d - radius) / softness, 2.));
    float highlight = exp(-dot(delta - vec2(-radius * .34, radius * .40),
                               delta - vec2(-radius * .34, radius * .40)) / (.20 + radius * .22));
    float visible = step(.91, seed) * (.14 + .05 * sin(seed * 12. + uTime * .7));
    color += vec3(.25, .53, .61) * (rim * .24 + highlight * .62) * visible;
  }
  return color;
}

vec3 underwater(vec2 st, vec2 uv, float progress) {
  if (uHasUnderTexture > .5) return underwaterPhotograph(st, progress);
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
  float crossing = smoothstep(.12, .90, progress);
  float wave = sin(st.x * 13. + uTime * .9) * .014
             + sin(st.x * 31. - uTime * .63) * .006;
  float waterline = mix(-.13, 1.15, crossing) + wave * sin(crossing * 3.14159);
  float submerged = 1. - smoothstep(waterline - .025, waterline + .025, st.y);
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
  // Linear lighting is displayed through a filmic curve followed by sRGB gamma.
  // Keeping this order preserves bright cloud reflections and clear blue water.
  color = max(color, vec3(0.));
  color = clamp((color * (2.51 * color + .03)) / (color * (2.43 * color + .59) + .14), 0., 1.);
  color = pow(color, vec3(1. / 2.2));
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
    this.uniforms.uSkyTexture = gl.getUniformLocation(program, 'uSkyTexture');
    this.uniforms.uHasSkyTexture = gl.getUniformLocation(program, 'uHasSkyTexture');
    this.skyTexture = gl.createTexture();
    this.hasSkyTexture = false;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.skyTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([145, 185, 213, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const skyImage = new Image();
    this.skyImage = skyImage;
    skyImage.onload = () => {
      if (this.destroyed || this.contextLost) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.skyTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, skyImage);
      this.hasSkyTexture = true;
      this.canvas.dataset.oceanSky = 'photographic';
      this.requestFrame();
    };
    skyImage.src = new URL('./assets/sunset-sky-light.png', import.meta.url).href;
    this.uniforms.uWaterNormals = gl.getUniformLocation(program, 'uWaterNormals');
    this.uniforms.uHasWaterNormals = gl.getUniformLocation(program, 'uHasWaterNormals');
    this.waterNormals = gl.createTexture();
    this.hasWaterNormals = false;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.waterNormals);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([128, 128, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const normalsImage = new Image();
    this.normalsImage = normalsImage;
    normalsImage.onload = () => {
      if (this.destroyed || this.contextLost) return;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.waterNormals);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      // Normal vectors are data, deliberately sampled without sRGB conversion.
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, normalsImage);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      this.hasWaterNormals = true;
      this.canvas.dataset.oceanMaterial = 'waternormals';
      this.requestFrame();
    };
    normalsImage.src = new URL('./assets/waternormals.jpg', import.meta.url).href;
    this.uniforms.uUnderTexture = gl.getUniformLocation(program, 'uUnderTexture');
    this.uniforms.uHasUnderTexture = gl.getUniformLocation(program, 'uHasUnderTexture');
    this.underTexture = gl.createTexture();
    this.hasUnderTexture = false;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.underTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([8, 65, 88, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const underImage = new Image();
    this.underImage = underImage;
    underImage.onload = () => {
      if (this.destroyed || this.contextLost) return;
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.underTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, underImage);
      this.hasUnderTexture = true;
      this.canvas.dataset.oceanUnderwater = 'photographic';
      this.requestFrame();
    };
    underImage.src = new URL('./assets/underwater-reference-v2.png', import.meta.url).href;
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
    const wallElapsed = this.last ? Math.max(0, (now - this.last) / 1000) : 1 / 60;
    const elapsed = Math.min(wallElapsed, .1);
    this.last = now;
    // Wave speed follows real time even when a device renders fewer frames.
    // Camera easing remains capped; visibility and pause changes reset `last`.
    if (!this.paused && !this.reducedMotion) this.time += wallElapsed;
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
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.skyTexture);
    gl.uniform1i(this.uniforms.uSkyTexture, 0);
    gl.uniform1f(this.uniforms.uHasSkyTexture, this.hasSkyTexture ? 1 : 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.waterNormals);
    gl.uniform1i(this.uniforms.uWaterNormals, 1);
    gl.uniform1f(this.uniforms.uHasWaterNormals, this.hasWaterNormals ? 1 : 0);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.underTexture);
    gl.uniform1i(this.uniforms.uUnderTexture, 2);
    gl.uniform1f(this.uniforms.uHasUnderTexture, this.hasUnderTexture ? 1 : 0);
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
      this.gl.deleteTexture(this.skyTexture);
      this.gl.deleteTexture(this.waterNormals);
      this.gl.deleteTexture(this.underTexture);
    }
  }
}

export const initOcean = canvas => new OceanScene(canvas);
