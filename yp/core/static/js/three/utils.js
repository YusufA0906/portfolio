// Shared helpers for the 3D scene: device capabilities, math and GLSL chunks.

const mq = (q) => window.matchMedia(q).matches;

// `?motion` in the URL forces the full experience even with reduced motion on (for testing)
const forceMotion = new URLSearchParams(window.location.search).has('motion');

export const caps = {
    isMobile: mq('(max-width: 767px)'),
    reducedMotion: !forceMotion && mq('(prefers-reduced-motion: reduce)'),
    finePointer: mq('(pointer: fine)'),
};

// ---- Concepts -------------------------------------------------------------
// Alternative designs under comparison. The inline script in index.html applies
// the same rules (URL ?concept= > remembered choice > default) before first paint.
export const CONCEPTS = ['engine', 'city', 'glass', 'terminal'];
export const DEFAULT_CONCEPT = 'engine';

export function getConcept() {
    const fromUrl = new URLSearchParams(window.location.search).get('concept');
    if (CONCEPTS.includes(fromUrl)) return fromUrl;
    try {
        const saved = localStorage.getItem('concept');
        if (CONCEPTS.includes(saved)) return saved;
    } catch (e) { /* storage blocked */ }
    return DEFAULT_CONCEPT;
}

// ---- Tunables -------------------------------------------------------------
// Everything worth tweaking lives here. See README "3D scene" section.
export const CONFIG = {
    colors: {
        background: 0x05070d,
        cyan: 0x22d3ee,
        emerald: 0x10b981,
        white: 0xe6edf6,
    },
    particles: {
        desktop: 3000,
        mobileFactor: 0.3, // ~70% fewer particles on phones
    },
    stars: 1400,
    bloom: { strength: 0.6, radius: 0.4, threshold: 0.55 },
    maxPixelRatio: 2,
    fov: 45,
    // How quickly the camera catches up with the scroll position (per second)
    scrollDamping: 4.5,
    // Hero core halo radius in world units (the camera distance adapts so the
    // halo frames the profile picture at any viewport size)
    coreRadius: 1.25,
};

export const particleCount = () =>
    Math.round(CONFIG.particles.desktop * (caps.isMobile ? CONFIG.particles.mobileFactor : 1));

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
};
// Frame-rate independent exponential smoothing
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

// Bell-shaped "how close is the scroll to this station" in [0, 1]
export const proximity = (s, station, width = 0.6) => {
    const d = (s - station) / width;
    return Math.exp(-d * d);
};

// Deterministic PRNG so the scene looks the same on every load
export function mulberry32(seed) {
    return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Ashima 3D simplex noise (MIT) — used by the core's vertex displacement
export const GLSL_NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;
