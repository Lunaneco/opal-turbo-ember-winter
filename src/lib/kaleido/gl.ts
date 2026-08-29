const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPhoto;
uniform sampler2D uMask;
uniform vec2 uOffset;
uniform vec2 uFocus;
uniform float uHeroR;
uniform float uRot;
uniform float uSlices;
uniform float uZoom;
uniform float uShatter;
uniform vec2 uLight;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uAccent;
uniform float uGem;
uniform float uStar;
uniform float uPrism;
uniform float uMood;
uniform float uHasPhoto;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float starLayer(vec2 uv, float cell, float glow, float time) {
  vec2 g = uv * cell;
  vec2 n = floor(g);
  vec2 f = fract(g);
  vec2 o = hash2(n);
  float d = length(f - o);
  float m = hash(n * 1.17);
  float rate = mix(1.1, 2.6, hash(n + 4.2));
  float tw = 0.45 + 0.55 * (0.5 + 0.5 * sin(time * rate + m * 6.28318));
  return (exp(-d * d * glow) * pow(m, 12.0) + exp(-d * d * 36.0) * 0.1 * pow(m, 5.0)) * tw;
}

vec2 kaleido(vec2 p, float slices, float rot) {
  float rad = length(p);
  float a = atan(p.y, p.x) - rot;
  float slice = 3.14159265 / max(slices, 2.0);
  a = mod(a, slice * 2.0);
  if (a < 0.0) a += slice * 2.0;
  if (a > slice) a = slice * 2.0 - a;
  return vec2(cos(a), sin(a)) * rad;
}

vec2 mirrorUv(vec2 uv) {
  uv = abs(mod(uv, 2.0) - 1.0);
  return clamp(uv, 0.001, 0.999);
}

vec3 fireHue(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

vec3 bodyGrade(vec3 c) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 ch = c - vec3(l);
  float chromaAmt = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float stone = smoothstep(0.025, 0.16, chromaAmt);
  float lift = mix(0.7, 0.52, uGem);
  float sat = mix(1.22, 1.88, uGem);
  vec3 s = vec3(l * lift) + ch * sat;
  s = mix(s, s * uAccent, uGem * 0.16);
  vec3 matrix = mix(vec3(0.07, 0.08, 0.11), uAccent * 0.18, 0.35);
  s = mix(matrix * (0.45 + l * 0.4), s, stone);
  return max(s, 0.0);
}

vec4 facetAt(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float md = 8.0;
  float md2 = 8.0;
  vec2 bestOff = vec2(0.0);
  vec2 bestId = n;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 id = n + g;
      vec2 o = hash2(id);
      vec2 off = g + o - f;
      off.y *= mix(0.68, 1.32, hash(id + 2.1));
      float d = length(off);
      if (d < md) {
        md2 = md;
        md = d;
        bestOff = off;
        bestId = id;
      } else if (d < md2) {
        md2 = d;
      }
    }
  }
  return vec4(clamp(md2 - md, 0.0, 1.0), hash(bestId), bestOff);
}

float sparkle(vec2 uv, vec3 H, float cells, float cut, float hard) {
  vec2 n = floor(uv * cells);
  vec2 f = fract(uv * cells);
  vec2 o = hash2(n);
  vec2 d = f - o;
  float dist2 = dot(d, d);
  float live = step(cut, hash(n * 1.37));
  vec3 flake = normalize(vec3(hash2(n + 9.2) - 0.5, 0.28));
  float gl = pow(max(dot(flake, H), 0.0), hard);
  gl *= gl;
  float core = exp(-dist2 * 26.0);
  float needle = exp(-abs(d.x) * 16.0) * exp(-abs(d.y) * 3.2)
               + exp(-abs(d.y) * 16.0) * exp(-abs(d.x) * 3.2);
  float point = exp(-dist2 * 120.0);
  return live * (gl * (core * 1.4 + needle * 1.2) + point * (0.22 + gl * 2.5));
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (min(uRes.x, uRes.y) * 0.5);
  float rad = length(p);

  float barrel = 1.0 + 0.045 * rad * rad;
  vec2 q = kaleido(p * barrel, uSlices, uRot);

  float inner = 1.0 - smoothstep(0.06, 0.36, rad);
  float mid = smoothstep(0.22, 0.40, rad) * (1.0 - smoothstep(0.60, 0.88, rad));
  float outer = smoothstep(0.58, 1.08, rad);

  float qLen = length(q);
  vec2 qDir = q / max(qLen, 1e-5);

  float flow = sin(rad * 8.0 - uTime * 1.15 - uRot * 2.4) * (0.006 * mid + 0.016 * outer);
  q += qDir * flow;
  qLen = length(q);
  qDir = q / max(qLen, 1e-5);

  vec2 drift = vec2(uRot * 0.85, -uRot * 0.62);
  float cellFreq = mix(3.8, 8.6, outer) + mid * 1.1 + uShatter * 2.4;
  vec2 hexQ = vec2(q.x * 0.8660254, q.y + q.x * 0.5);
  vec4 fac = facetAt(hexQ * cellFreq + drift * 0.35 + 1.7);
  float edgeGap = fac.x;
  float fid = fac.y;
  vec2 fOff = fac.zw;
  vec2 jolt = hash2(vec2(fid, fid + 3.1)) - 0.5;

  float scale = max(uHeroR, 0.1) / 0.4 * uZoom;
  float rHero = max(qLen, 0.085 * inner);
  float rMid = mix(0.15, 0.28, clamp(qLen * 0.9, 0.0, 1.0));
  float rGem = mix(mix(rHero, rMid, 1.0 - inner), qLen * (1.0 + outer * 0.22), outer);

  vec2 tumble = vec2(cos(uRot * 0.9), sin(uRot * 1.25)) * mix(0.008, 0.045, outer);
  tumble += vec2(sin(uRot * 1.55), cos(uRot * 0.7)) * (0.006 * mid + 0.028 * outer);

  vec2 uvHero = qDir * rHero * scale + uFocus + tumble * 0.28 + uOffset * 0.1;
  vec2 uvGem = qDir * rGem * scale + jolt * mix(0.004, 0.012, outer) * (0.35 + uShatter)
             + uFocus + tumble + uOffset * 0.16;
  uvHero = mirrorUv(uvHero);
  uvGem = mirrorUv(uvGem);

  vec3 photo = texture2D(uPhoto, uvHero).rgb;
  float hero = texture2D(uMask, uvHero).r;

  vec2 tilt = (hash2(vec2(fid * 5.1, fid * 2.7)) - 0.5) * mix(0.28, 1.15, uGem);
  float bevel = 1.0 - smoothstep(0.012, mix(0.11, 0.055, uGem), edgeGap);
  vec3 N = normalize(vec3(
    tilt + fOff * bevel * 1.65,
    mix(0.92, 0.62, uGem)
  ));
  vec2 micro = hash2(floor(q * 36.0 + fid * 8.0)) - 0.5;
  N = normalize(N + vec3(micro * 0.12, 0.0));

  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(uLight, 0.82));
  vec3 L2 = normalize(vec3(-uLight.y * 0.75, uLight.x * 0.45, 0.52));
  vec3 H = normalize(L + V);
  float ndv = max(dot(N, V), 0.0);
  float ndl = max(dot(N, L), 0.0);
  float ndh = max(dot(N, H), 0.0);
  float F0 = mix(0.045, 0.17, uGem);
  float fres = F0 + (1.0 - F0) * pow(1.0 - ndv, 5.0);
  float spec = pow(ndh, mix(28.0, 64.0, uGem));
  spec *= spec;
  float spec2 = pow(max(dot(N, normalize(L2 + V)), 0.0), 28.0) * 0.28;

  float eta = 1.0 / mix(1.48, 2.38, uGem);
  vec3 rd = refract(-V, N, eta);
  if (dot(rd, rd) < 1e-4) {
    rd = reflect(-V, N);
  }
  float disp = mix(0.0, 0.022, uPrism) * (0.35 + outer + mid * 0.4);
  vec2 ruv = uvGem + rd.xy * mix(0.018, 0.055, uGem);
  vec3 photoGem;
  photoGem.r = texture2D(uPhoto, mirrorUv(ruv + N.xy * disp)).r;
  photoGem.g = texture2D(uPhoto, mirrorUv(ruv)).g;
  photoGem.b = texture2D(uPhoto, mirrorUv(ruv - N.xy * disp)).b;

  vec3 R = reflect(-V, N);
  vec3 bounce = texture2D(uPhoto, mirrorUv(uvGem + R.xy * 0.07)).rgb;

  float thick = mix(0.32, 1.25, 1.0 - ndv) * mix(0.7, 1.15, 1.0 - edgeGap);
  vec3 absorb = exp(-(vec3(1.05) - clamp(uAccent, 0.2, 1.0)) * thick * mix(0.4, 1.15, uGem));
  vec3 gem = bodyGrade(photoGem) * absorb;
  gem += bounce * fres * 0.28 * absorb;
  gem *= 0.42 + 0.58 * (0.38 + 0.62 * ndl);
  gem += bounce * spec2 * 0.22;

  float stria = 0.5 + 0.5 * sin(dot(q, normalize(vec2(0.72, 0.28))) * 22.0 + fid * 5.0);
  gem *= 0.93 + 0.07 * stria;

  float cau = sin(q.x * 10.0 + N.x * 7.0 + uRot * 1.8);
  cau *= sin(q.y * 8.5 - uTime * 0.55 + fid * 6.28318);
  cau = pow(0.5 + 0.5 * cau, 5.0);
  gem += gem * cau * (0.22 * mid + 0.12 * outer);

  vec3 env = mix(vec3(0.03, 0.035, 0.055), uAccent, pow(max(R.y * 0.5 + 0.5, 0.0), 1.4) * 0.55);
  env += vec3(1.0, 0.97, 0.92) * pow(max(dot(R, L), 0.0), 36.0);
  gem += env * fres * mix(0.16, 0.42, uGem) * (0.28 + 0.72 * (mid + outer));

  vec3 sharp = clamp(photo * vec3(1.06, 1.03, 1.05), 0.0, 1.0);
  float keep = clamp(hero * inner * 0.28, 0.0, 1.0);
  keep *= 1.0 - mid * 0.92;
  keep *= 1.0 - outer;
  vec3 col = mix(gem, sharp, keep);

  vec3 edgeCol = mix(vec3(0.97, 0.99, 1.0), uAccent, 0.22);
  float specVis = spec * (0.35 + 0.65 * (mid + outer));
  col += edgeCol * bevel * (0.16 + specVis * 2.1) * mix(0.55, 1.2, uGem);
  col += specVis * mix(0.22, 0.62, uGem) * mix(vec3(1.0, 0.98, 0.93), uAccent, 0.28);
  col += spec2 * uAccent * 0.14;

  float fireAmt = spec * (1.0 - spec) * 4.0 * uPrism;
  col += fireHue(fid + ndh * 2.0 + rad) * fireAmt * (0.2 + 0.55 * mid + 0.7 * outer);

  vec3 irid = 0.5 + 0.5 * cos(vec3(0.0, 2.094, 4.188) + (1.0 - ndv) * 8.5 + fid * 6.28318);
  col += irid * fres * uPrism * 0.1 * (1.0 - inner);

  float sp1 = sparkle(q + drift * 0.08, H, mix(14.0, 22.0, uStar), mix(0.7, 0.42, uStar), mix(28.0, 18.0, uStar));
  float sp2 = sparkle(q * 1.7 + 4.2, H, mix(28.0, 42.0, uStar), mix(0.82, 0.6, uStar), 40.0);
  float sp3 = sparkle(q * 0.52 + 8.1, H, mix(7.5, 11.0, uStar), mix(0.86, 0.68, uStar), 20.0);
  vec3 sparkCol = mix(vec3(1.0, 0.97, 0.88), uAccent, 0.28);
  sparkCol += fireHue(fid * 1.7 + uRot) * uPrism * 0.55;
  float sparkAmt = (0.2 + 0.55 * mid + mix(0.75, 1.5, uStar) * outer) + uShatter * 0.4;
  col += sparkCol * (sp1 * 1.35 + sp2 * 1.05 + sp3 * 2.1) * sparkAmt;

  float slice = 3.14159265 / max(uSlices, 2.0);
  float ang = atan(p.y, p.x) - uRot;
  float folded = abs(mod(ang + slice, slice * 2.0) - slice);
  float spoke = 1.0 - smoothstep(0.0, 0.032, folded * (0.4 + rad));
  float core = exp(-rad * rad * 7.2);

  float portR = 0.3;
  vec2 uvFace = uFocus + vec2(p.x, p.y) * (max(uHeroR, 0.04) / portR);
  uvFace = clamp(uvFace, 0.001, 0.999);
  vec3 faceCol = texture2D(uPhoto, uvFace).rgb;
  float portrait = 1.0 - smoothstep(portR * 0.94, portR, rad);

  col += mix(vec3(0.92, 0.96, 1.0), uAccent, 0.32) * spoke * (0.07 + specVis * 0.32) * (1.0 - portrait);
  col += gem * core * 0.045 * (1.0 - portrait);
  float petal = (1.0 - smoothstep(0.0, 0.055, folded * (0.4 + rad))) * mid * (1.0 - portrait);
  col += mix(vec3(0.85, 0.92, 1.0), uAccent, 0.4) * petal * (0.05 + bevel * 0.08);

  float prismBand = pow(0.5 + 0.5 * sin(folded * 16.0 + rad * 7.0 - uTime * 0.45), 9.0);
  col += fireHue(folded * 1.8 + rad) * prismBand * uPrism * 0.14 * mid * (1.0 - portrait);

  col = mix(col, faceCol, portrait * uHasPhoto);

  float rim = smoothstep(portR * 0.93, portR * 0.995, rad) *
    (1.0 - smoothstep(portR * 1.0, portR * 1.12, rad));
  vec3 bezel = mix(vec3(0.88, 0.93, 1.0), uAccent, 0.38);
  bezel += specVis * 0.4 + fireHue(uRot * 0.2) * uPrism * 0.16;
  col = mix(col, max(col, bezel), rim * 0.48);

  float cover = smoothstep(0.86, 1.32, rad) * (1.0 - portrait);
  vec2 uv = gl_FragCoord.xy / max(uRes.y, 1.0);

  if (cover > 0.01 && uMood > 0.5) {
    if (uMood < 1.5) {
      float dust = starLayer(uv, 42.0, 4800.0, uTime);
      float trail = starLayer(uv + vec2(uTime * 0.04, -uTime * 0.025), 20.0, 1600.0, uTime);
      vec3 space = vec3(0.02, 0.03, 0.07);
      space += vec3(0.78, 0.88, 1.0) * dust * 1.5;
      space += uAccent * trail * 1.1;
      col = mix(col, space, cover * 0.88);
      col += vec3(0.85, 0.92, 1.0) * dust * 0.28;
    } else if (uMood > 1.5 && uMood < 2.5) {
      vec3 night = vec3(0.008, 0.012, 0.04);
      float faint = starLayer(uv, 34.0, 3600.0, uTime);
      float bright = starLayer(uv + 2.7, 13.0, 1200.0, uTime);
      night += vec3(0.8, 0.88, 1.0) * faint;
      night += vec3(1.0, 0.97, 0.92) * bright * 1.25;
      col = mix(col, night, cover);
    } else if (uMood > 2.5 && uMood < 3.5) {
      vec3 velvet = vec3(0.018, 0.012, 0.016);
      float ring = pow(0.5 + 0.5 * sin(rad * 16.0 - uTime * 0.65), 10.0);
      float caustic = pow(max(0.0, sin(folded * 7.0 + rad * 10.0 - uTime * 1.1)), 8.0);
      float glint = starLayer(uv, 15.0, 1100.0, uTime);
      velvet += uAccent * (ring * 0.5 + caustic * 0.55 + glint * 1.4);
      velvet += vec3(1.0, 0.92, 0.75) * glint * 0.35;
      col = mix(col, velvet, cover * 0.9);
    } else if (uMood > 3.5 && uMood < 4.5) {
      float w1 = exp(-pow(p.x * 1.25 + 0.28 * sin(p.y * 4.2 + uTime * 0.55), 2.0) * 2.6);
      float w2 = exp(-pow(p.x * 1.7 - 0.38 + 0.22 * sin(uTime * 0.32 + p.y * 2.2), 2.0) * 2.1);
      float w3 = exp(-pow(p.x * 2.15 + 0.5 * sin(p.y * 3.0 - uTime * 0.4), 2.0) * 3.2);
      float curtains = (w1 * 0.95 + w2 * 0.7 + w3 * 0.5) * (0.4 + 0.6 * sin(p.y * 6.5 + uTime * 1.05));
      vec3 aur = vec3(0.012, 0.035, 0.04);
      aur += uAccent * curtains * 0.95;
      aur += vec3(0.2, 0.7, 1.0) * w2 * 0.4;
      aur += vec3(0.55, 1.0, 0.7) * w1 * 0.22;
      col = mix(col, aur, cover * 0.88);
    } else if (uMood > 4.5) {
      vec2 mp = vec2(0.7, 0.58);
      float md = length(p - mp);
      float moon = 1.0 - smoothstep(0.11, 0.15, md);
      float hole = smoothstep(0.085, 0.125, length(p - mp - vec2(0.055, 0.035)));
      float crescent = moon * hole;
      float glow = exp(-md * md * 7.0);
      vec3 dusk = vec3(0.045, 0.018, 0.025);
      dusk += vec3(0.5, 0.16, 0.06) * exp(-max(p.y + 0.2, 0.0) * 2.2) * 0.6;
      dusk += uAccent * glow * 0.4;
      dusk += vec3(1.0, 0.86, 0.68) * crescent;
      float embers = starLayer(uv, 16.0, 2200.0, uTime);
      dusk += uAccent * embers * 0.5;
      col = mix(col, dusk, cover * 0.88);
    }
  }

  float vig = smoothstep(1.42, 0.72, rad);
  col *= mix(0.78, 1.0, vig);
  col = max(col, 0.0);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= 1.24 / (1.0 + lum * 0.46);
  col = pow(col, vec3(0.94));
  col = clamp(col, 0.0, 1.0);
  col *= uHasPhoto;

  gl_FragColor = vec4(col, 1.0);
}
`;

export type KaleidoUniforms = {
  offsetX: number;
  offsetY: number;
  focusX: number;
  focusY: number;
  heroR: number;
  rot: number;
  slices: number;
  zoom: number;
  shatter: number;
  lightX: number;
  lightY: number;
  time: number;
  width: number;
  height: number;
  accentR: number;
  accentG: number;
  accentB: number;
  gem: number;
  star: number;
  prism: number;
  mood: number;
  hasPhoto: number;
};

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? "compile";
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

function makeTexture(gl: WebGLRenderingContext): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("texture");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([9, 9, 11, 255]),
  );
  return tex;
}

export class KaleidoGL {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private photo: WebGLTexture;
  private mask: WebGLTexture;
  private loc: Record<string, WebGLUniformLocation | null>;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!prog) throw new Error("program");
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "link");
    }
    this.program = prog;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.photo = makeTexture(gl);
    this.mask = makeTexture(gl);
    gl.useProgram(prog);
    this.loc = {
      uPhoto: gl.getUniformLocation(prog, "uPhoto"),
      uMask: gl.getUniformLocation(prog, "uMask"),
      uOffset: gl.getUniformLocation(prog, "uOffset"),
      uFocus: gl.getUniformLocation(prog, "uFocus"),
      uHeroR: gl.getUniformLocation(prog, "uHeroR"),
      uRot: gl.getUniformLocation(prog, "uRot"),
      uSlices: gl.getUniformLocation(prog, "uSlices"),
      uZoom: gl.getUniformLocation(prog, "uZoom"),
      uShatter: gl.getUniformLocation(prog, "uShatter"),
      uLight: gl.getUniformLocation(prog, "uLight"),
      uTime: gl.getUniformLocation(prog, "uTime"),
      uRes: gl.getUniformLocation(prog, "uRes"),
      uAccent: gl.getUniformLocation(prog, "uAccent"),
      uGem: gl.getUniformLocation(prog, "uGem"),
      uStar: gl.getUniformLocation(prog, "uStar"),
      uPrism: gl.getUniformLocation(prog, "uPrism"),
      uMood: gl.getUniformLocation(prog, "uMood"),
      uHasPhoto: gl.getUniformLocation(prog, "uHasPhoto"),
    };
    gl.uniform1i(this.loc.uPhoto, 0);
    gl.uniform1i(this.loc.uMask, 1);
  }

  setPhoto(source: TexImageSource) {
    this.upload(this.photo, source);
  }

  setMask(source: TexImageSource) {
    this.upload(this.mask, source);
  }

  private upload(tex: WebGLTexture, source: TexImageSource) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  resize(w: number, h: number) {
    this.gl.viewport(0, 0, w, h);
  }

  render(u: KaleidoUniforms) {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.photo);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.uniform2f(this.loc.uOffset, u.offsetX, u.offsetY);
    gl.uniform2f(this.loc.uFocus, u.focusX, u.focusY);
    gl.uniform1f(this.loc.uHeroR, u.heroR);
    gl.uniform1f(this.loc.uRot, u.rot);
    gl.uniform1f(this.loc.uSlices, u.slices);
    gl.uniform1f(this.loc.uZoom, u.zoom);
    gl.uniform1f(this.loc.uShatter, u.shatter);
    gl.uniform2f(this.loc.uLight, u.lightX, u.lightY);
    gl.uniform1f(this.loc.uTime, u.time);
    gl.uniform2f(this.loc.uRes, u.width, u.height);
    gl.uniform3f(this.loc.uAccent, u.accentR, u.accentG, u.accentB);
    gl.uniform1f(this.loc.uGem, u.gem);
    gl.uniform1f(this.loc.uStar, u.star);
    gl.uniform1f(this.loc.uPrism, u.prism);
    gl.uniform1f(this.loc.uMood, u.mood);
    gl.uniform1f(this.loc.uHasPhoto, u.hasPhoto);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

export class Kaleido2D {
  private ctx: CanvasRenderingContext2D;
  private photo: CanvasImageSource | null = null;
  private w = 1;
  private h = 1;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d unavailable");
    this.ctx = ctx;
  }

  setPhoto(source: TexImageSource) {
    this.photo = source as CanvasImageSource;
  }

  setMask(_source: TexImageSource) {}

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  render(u: KaleidoUniforms) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, w, h);
    const src = this.photo;
    if (!src) return;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.hypot(w, h) * 0.62;
    const n = Math.max(2, Math.round(u.slices));
    const wedge = Math.PI / n;
    const scale = radius * 1.35 * u.zoom;
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(u.rot + i * 2 * wedge);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, -wedge - 0.02, wedge + 0.02);
      ctx.closePath();
      ctx.clip();
      if (i % 2 === 1) ctx.scale(1, -1);
      ctx.filter =
        i % 2 === 0
          ? "saturate(1.55) contrast(1.22) brightness(1.04)"
          : "saturate(1.2) contrast(1.08)";
      ctx.drawImage(
        src,
        -scale * u.focusX + u.offsetX * radius,
        -scale * u.focusY + u.offsetY * radius,
        scale,
        scale,
      );
      ctx.filter = "none";
      ctx.restore();
    }
    const g = ctx.createRadialGradient(cx, cy, radius * 0.08, cx, cy, radius);
    g.addColorStop(0, "rgba(255,255,255,0.16)");
    g.addColorStop(0.42, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const sparks = 18;
    for (let i = 0; i < sparks; i++) {
      const seed = (i * 17.13 + u.rot * 2.1 + u.time * 0.7) % 1;
      if (seed < 0.55) continue;
      const a = u.rot * 1.3 + i * 0.73 + u.time * 0.21;
      const rr = radius * (0.22 + ((i * 0.37) % 1) * 0.62);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      const s = 0.6 + seed * 1.8;
      ctx.fillStyle = `rgba(255,248,230,${0.18 + seed * 0.35})`;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function createKaleido(canvas: HTMLCanvasElement): KaleidoGL | Kaleido2D {
  try {
    return new KaleidoGL(canvas);
  } catch {
    return new Kaleido2D(canvas);
  }
}
