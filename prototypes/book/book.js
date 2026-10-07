// .works — un cuadernillo impreso en 3D para el hero.
// createBook(container, options) dibuja el libro dentro de `container` y devuelve { destroy, goto, setTheme }.
// Three.js con imports puntuales. Sin dependencias más allá de three.

import {
  BoxGeometry, CanvasTexture, Color, DoubleSide, Group, LinearMipmapLinearFilter, Mesh, MeshBasicMaterial,
  PerspectiveCamera, PlaneGeometry, Raycaster, Scene, ShaderMaterial, Sphere, SRGBColorSpace, Vector2, Vector3,
  WebGLRenderer, NoToneMapping,
} from "three";

export function canUseWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Medidas del objeto (unidades de mundo). Proporción de página 3:4, como un A5 apaisado al revés.
const W = 1.5, H = 2;
const SX = 44, SY = 12;          // segmentos de cada hoja: a lo ancho para la curva, a lo alto para la torsión
const GAP = 0.0045;              // separación entre hojas
const BLOCK = 0.034;             // grosor del bloque de páginas que no se ven (el "relleno" del cuadernillo)
const TEX = { w: 1280, h: 1707 };
const PAPER = "#f3f0e8";
const INK = "#121212";

// ---------------------------------------------------------------------------
// Páginas: cada una se dibuja en un canvas 2D y se sube como textura.

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// El dibujo trae relleno blanco (la gorra): lo pasamos a trazos de tinta sobre transparente.
function inkOnly(img, ink = [18, 18, 18]) {
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
    px[i + 3] = px[i + 3] * (1 - lum);
    px[i] = ink[0]; px[i + 1] = ink[1]; px[i + 2] = ink[2];
  }
  g.putImageData(d, 0, 0);
  return c;
}

// scale: resolución de las texturas. Se dibuja siempre en coordenadas de 1280×1707 y se escala:
// en pantallas chicas, 0.7 baja la memoria de video a la mitad sin cambiar el diseño.
function makePainter(fonts, scale = 1) {
  const M = 104; // margen
  const page = (draw) => {
    const c = document.createElement("canvas");
    c.width = Math.round(TEX.w * scale); c.height = Math.round(TEX.h * scale);
    const g = c.getContext("2d");
    g.scale(scale, scale);
    g.fillStyle = PAPER; g.fillRect(0, 0, TEX.w, TEX.h);
    g.fillStyle = INK; g.strokeStyle = INK; g.textBaseline = "alphabetic";
    draw(g);
    return c;
  };
  const text = (g, s, x, y, size, { font = fonts.text, color = INK, align = "left", track = 0 } = {}) => {
    g.font = `${size}px ${font}`; g.fillStyle = color; g.textAlign = align;
    if ("letterSpacing" in g) g.letterSpacing = `${track}px`;
    g.fillText(s, x, y);
    if ("letterSpacing" in g) g.letterSpacing = "0px";
  };
  const wrap = (g, s, x, y, max, size, lh, color = "#2b2b2b") => {
    g.font = `${size}px ${fonts.text}`; g.fillStyle = color; g.textAlign = "left";
    let line = "";
    for (const w of s.split(" ")) {
      const t = line ? `${line} ${w}` : w;
      if (g.measureText(t).width > max && line) { g.fillText(line, x, y); y += lh; line = w; } else line = t;
    }
    g.fillText(line, x, y);
    return y;
  };
  const rule = (g, y, x0 = M, x1 = TEX.w - M, color = "#cfcabe") => { g.fillStyle = color; g.fillRect(x0, y, x1 - x0, 2); };
  // Encabezado y folio de cada página, como en una publicación.
  const chrome = (g, header, folio, side) => {
    text(g, header, side === "left" ? M : TEX.w - M, M + 18, 26, { color: "#6d6a63", align: side === "left" ? "left" : "right", track: 0.5 });
    rule(g, M + 44);
    text(g, folio, side === "left" ? M : TEX.w - M, TEX.h - M + 10, 26, { color: "#6d6a63", align: side === "left" ? "left" : "right" });
  };
  // Una imagen impresa: trama de puntos muy fina y el papel por debajo.
  const printImage = (g, img, x, y, w, h) => {
    const s = Math.max(w / img.width, h / img.height);
    const sw = w / s, sh = h / s;
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = "rgba(243,240,232,0.12)"; g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(0,0,0,0.05)";
    for (let yy = y; yy < y + h; yy += 7) for (let xx = x + ((yy / 7) % 2) * 3.5; xx < x + w; xx += 7) {
      g.beginPath(); g.arc(xx, yy, 1.4, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  };
  return { page, text, wrap, rule, chrome, printImage, M };
}

async function buildPages(data, fonts, scale = 1) {
  // Si una tipografía no carga, se dibuja con la de respaldo: el libro no puede depender de eso.
  await Promise.allSettled([document.fonts.load(`120px ${fonts.display}`), document.fonts.load(`40px ${fonts.text}`)]);
  const [character, ...images] = await Promise.all([loadImage(data.character), ...data.cases.map((c) => loadImage(c.image))]);
  const ink = inkOnly(character);
  const P = makePainter(fonts, scale);
  const { page, text, wrap, rule, chrome, printImage, M } = P;
  const head = `${data.author} — ${data.title}`;
  const n = data.cases.length;

  const cover = page((g) => {
    text(g, data.author, M, M + 18, 30);
    text(g, data.edition, TEX.w - M, M + 18, 30, { align: "right", color: "#6d6a63" });
    rule(g, M + 46, M, TEX.w - M, INK);
    const cw = 640, ch = cw * ink.height / ink.width;
    g.drawImage(ink, (TEX.w - cw) / 2, 330, cw, ch);
    text(g, data.title, M - 10, TEX.h - 380, 300, { font: fonts.display, track: -6 });
    rule(g, TEX.h - 300, M, TEX.w - M, INK);
    data.cases.forEach((c, i) => {
      const y = TEX.h - 236 + i * 50;
      text(g, `${String(i + 1).padStart(2, "0")}  ${c.title}`, M, y, 30);
      text(g, String(4 + i * 2).padStart(2, "0"), TEX.w - M, y, 30, { align: "right", color: "#6d6a63" });
    });
  });

  const caseText = (c, i) => page((g) => {
    chrome(g, head, String(3 + i * 2).padStart(2, "0"), "left");
    text(g, String(i + 1).padStart(2, "0"), M, 330, 64, { font: fonts.display });
    text(g, c.title, M - 8, 560, c.title.length > 12 ? 128 : 200, { font: fonts.display, track: -4 });
    wrap(g, c.lead, M, 680, TEX.w - 2 * M - 40, 44, 62);
    rule(g, TEX.h - 330);
    text(g, c.kind, M, TEX.h - 270, 30, { color: "#6d6a63" });
    text(g, data.labels.read, M, TEX.h - 200, 38);
  });

  const caseImage = (c, img, i) => page((g) => {
    chrome(g, head, String(4 + i * 2).padStart(2, "0"), "right");
    // A sangre: la imagen va de borde a borde, como en una revista.
    const w = TEX.w, h = Math.round(w * img.height / img.width), y = Math.round((TEX.h - h) / 2) - 40;
    printImage(g, img, 0, y, w, h);
    text(g, `Fig. ${String(i + 1).padStart(2, "0")}`, M, y + h + 70, 28, { color: "#6d6a63" });
    wrap(g, c.caption, M + 150, y + h + 70, TEX.w - 2 * M - 150, 28, 40, "#3a3a3a");
  });

  const closing = page((g) => {
    chrome(g, head, String(3 + n * 2).padStart(2, "0"), "left");
    const cw = 320, ch = cw * ink.height / ink.width;
    g.drawImage(ink, M - 20, 300, cw, ch);
    text(g, data.closing.title, M - 8, 860, 180, { font: fonts.display, track: -4 });
    wrap(g, data.closing.body, M, 980, TEX.w - 2 * M - 40, 44, 62);
    rule(g, TEX.h - 260);
    text(g, data.closing.contact, M, TEX.h - 200, 32, { color: "#6d6a63" });
  });

  const innerBack = page((g) => {
    const cw = 200, ch = cw * ink.height / ink.width;
    g.drawImage(ink, (TEX.w - cw) / 2, TEX.h / 2 - ch, cw, ch);
    text(g, data.colophon, TEX.w / 2, TEX.h / 2 + 90, 28, { align: "center", color: "#6d6a63" });
  });

  // Hojas: frente = página derecha, dorso = página izquierda una vez dada vuelta.
  const sheets = [{ front: cover, back: caseText(data.cases[0], 0) }];
  for (let i = 0; i < n; i++) {
    sheets.push({ front: caseImage(data.cases[i], images[i], i), back: i + 1 < n ? caseText(data.cases[i + 1], i + 1) : closing });
  }
  return { sheets, innerBack };
}

// Canto del bloque de páginas: líneas finas, como hojas apiladas.
function edgeTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#ebe7dd"; g.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 3) {
    g.fillStyle = `rgba(80,70,55,${0.08 + Math.random() * 0.1})`;
    g.fillRect(0, y, 64, 1);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Shaders del papel.

const pageVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vLocal;
  void main() {
    vUv = uv;
    vLocal = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const pageFragment = /* glsl */ `
  uniform sampler2D uFront;
  uniform sampler2D uBack;
  uniform vec3 uLight;
  uniform float uAmbient;
  uniform float uTurning;     // 1 en la hoja que se está dando vuelta
  uniform float uShadowEdge;  // x (en el espacio del lomo) del borde libre de la hoja que gira
  uniform float uShadowAmt;   // cuánto se levantó esa hoja
  uniform float uHover;
  uniform float uOpen;        // 0 = libro cerrado: la costura apenas se marca en la tapa
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vLocal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
  }

  void main() {
    bool front = gl_FrontFacing;
    vec2 uv = front ? vUv : vec2(1.0 - vUv.x, vUv.y);
    vec3 col = front ? texture2D(uFront, uv).rgb : texture2D(uBack, uv).rgb;

    // Transparencia del papel: se intuye lo impreso del otro lado.
    vec3 other = front ? texture2D(uBack, vec2(1.0 - vUv.x, vUv.y)).rgb : texture2D(uFront, vUv).rgb;
    float otherInk = 1.0 - dot(other, vec3(0.299, 0.587, 0.114));
    col *= 1.0 - otherInk * 0.012;

    // Normal hacia la cámara, con un relieve mínimo de fibras.
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 n = normalize(vWorldNormal);
    n *= sign(dot(n, V) + 1e-4);
    float fib = noise(vUv * vec2(260.0, 90.0));
    n = normalize(n + vec3(fib - 0.5, noise(vUv * vec2(90.0, 260.0)) - 0.5, 0.0) * 0.06);

    // Luz: difusa envolvente, un brillo muy suave de papel mate y ambiente.
    vec3 L = normalize(uLight);
    float diff = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);
    float sheen = pow(max(dot(reflect(-L, n), V), 0.0), 18.0) * 0.04;
    float light = mix(uAmbient, 1.06, diff);

    // Costura: el papel se hunde y se oscurece hacia el lomo.
    float gutter = smoothstep(0.0, 0.24, vUv.x);
    light *= mix(mix(0.82, 0.5, uOpen), 1.0, gutter * gutter * (3.0 - 2.0 * gutter));
    // Bordes de la hoja apenas más oscuros, por el canto.
    float edge = smoothstep(0.0, 0.012, 1.0 - vUv.x) * smoothstep(0.0, 0.01, vUv.y) * smoothstep(0.0, 0.01, 1.0 - vUv.y);
    light *= mix(0.9, 1.0, edge);

    // Sombra que proyecta la hoja que gira sobre la de abajo.
    // La luz viene de la izquierda: una hoja parada proyecta su sombra hacia la derecha,
    // larga y suave sobre la página abierta, y apenas una franja del lado de la luz.
    if (uTurning < 0.5 && uShadowAmt > 0.001) {
      float x = vLocal.x;
      if (x > 0.0) {
        float reach = mix(0.2, 1.25, uShadowAmt) + max(uShadowEdge, 0.0);
        float sh = 1.0 - smoothstep(0.0, reach, x);
        light *= 1.0 - sh * sh * uShadowAmt * 0.42;
      } else {
        float sh = 1.0 - smoothstep(0.0, 0.32 * uShadowAmt, -x);
        light *= 1.0 - sh * uShadowAmt * 0.18;
      }
    }

    col = col * light + sheen;
    // Grano del papel.
    float grain = noise(gl_FragCoord.xy * 0.9) * 0.5 + noise(vUv * vec2(1400.0, 1800.0)) * 0.5;
    col += (grain - 0.5) * 0.035;
    col += uHover * 0.015;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Bloque de páginas (cantos y tapas internas): mismo papel, sin curva.
const blockFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uLight;
  uniform float uAmbient;
  uniform float uTint;
  uniform float uGutter;   // en la tapa interna: la misma sombra de costura que las páginas
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vLocal;
  void main() {
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 n = normalize(vWorldNormal);
    vec3 col = texture2D(uMap, vUv).rgb * uTint;
    float diff = clamp(dot(n, normalize(uLight)) * 0.5 + 0.5, 0.0, 1.0);
    col *= mix(uAmbient, 1.06, diff);
    float g = smoothstep(0.0, 0.24, vUv.x);
    col *= mix(1.0, mix(0.5, 1.0, g * g * (3.0 - 2.0 * g)), uGutter);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// ---------------------------------------------------------------------------

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export async function createBook(container, options) {
  const {
    data,
    fonts = { display: "Boska", text: "Switzer" },
    onOpen = () => {},
    onChange = () => {},
    reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches,
    theme = "light",
    debug = false,
  } = options;

  // --- Renderer y escena ---
  const small = innerWidth < 768;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: debug });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.6 : 2));
  renderer.outputColorSpace = SRGBColorSpace;
  // Sin mapeo de tonos de cine: el papel tiene que verse del color del papel, no gris.
  renderer.toneMapping = NoToneMapping;
  const canvas = renderer.domElement;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;outline:none";
  canvas.setAttribute("aria-hidden", "true");
  container.appendChild(canvas);

  const label = document.createElement("div");
  label.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;padding:6px 10px;border-radius:999px;background:#121212;color:#f3f0e8;font:13px/1 " +
    `${fonts.text},system-ui,sans-serif;opacity:0;transform:translate(-50%,-50%) scale(.9);transition:opacity .2s,transform .2s cubic-bezier(.16,1,.3,1);white-space:nowrap;z-index:2`;
  container.appendChild(label);

  const scene = new Scene();
  const camera = new PerspectiveCamera(28, 1, 0.1, 60);
  const root = new Group();      // flota y se inclina con el cursor
  const book = new Group();      // se desplaza para centrar el libro cerrado o abierto
  const spine = new Group();     // origen en el lomo
  scene.add(root);
  root.add(book);
  book.add(spine);

  const light = new Vector3(-0.55, 0.75, 0.9);
  const ambient = { light: 0.58, dark: 0.5 };

  // --- Páginas ---
  const { sheets: pageCanvases, innerBack } = await buildPages(data, fonts, small ? 0.7 : 1);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const texture = (c) => {
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = Math.min(8, maxAniso);
    t.minFilter = LinearMipmapLinearFilter;
    return t;
  };
  const disposables = [];
  const N = pageCanvases.length;

  const sheets = pageCanvases.map((p, i) => {
    const geo = new PlaneGeometry(W, H, SX, SY);
    geo.translate(W / 2, 0, 0);
    geo.boundingSphere = new Sphere(new Vector3(0, 0, 0), 3); // la geometría se deforma: esfera fija y generosa
    const mat = new ShaderMaterial({
      vertexShader: pageVertex,
      fragmentShader: pageFragment,
      side: DoubleSide,
      uniforms: {
        uFront: { value: texture(p.front) }, uBack: { value: texture(p.back) },
        uLight: { value: light }, uAmbient: { value: ambient[theme] },
        uTurning: { value: 0 }, uShadowEdge: { value: 0 }, uShadowAmt: { value: 0 }, uHover: { value: 0 }, uOpen: { value: 0 },
      },
    });
    const mesh = new Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.userData.sheet = i;
    spine.add(mesh);
    disposables.push(geo, mat, mat.uniforms.uFront.value, mat.uniforms.uBack.value);
    const pos = geo.attributes.position;
    const u = new Float32Array(pos.count), v = new Float32Array(pos.count);
    const uvs = geo.attributes.uv;
    for (let k = 0; k < pos.count; k++) { u[k] = uvs.getX(k); v[k] = uvs.getY(k); }
    return { i, mesh, geo, mat, u, v, last: "" };
  });

  // Bloques de páginas a cada lado: canto rayado, tapa interna arriba, contratapa abajo.
  const edgeTex = texture(edgeTexture());
  const innerTex = texture(innerBack);
  const blankTex = texture((() => { const c = document.createElement("canvas"); c.width = c.height = 8; const g = c.getContext("2d"); g.fillStyle = PAPER; g.fillRect(0, 0, 8, 8); return c; })());
  const blockMat = (map, tint = 1) => {
    const m = new ShaderMaterial({ vertexShader: pageVertex, fragmentShader: blockFragment,
      uniforms: { uMap: { value: map }, uLight: { value: light }, uAmbient: { value: ambient[theme] }, uTint: { value: tint }, uGutter: { value: 0 } } });
    disposables.push(m);
    return m;
  };
  const coverStock = blockMat(blankTex, 0.9);
  const makeBlock = (top) => {
    const geo = new BoxGeometry(W, H, 1);
    disposables.push(geo);
    // Orden de caras de BoxGeometry: +x, -x, +y, -y, +z, -z
    const mesh = new Mesh(geo, [blockMat(edgeTex), blockMat(edgeTex), blockMat(edgeTex), blockMat(edgeTex), blockMat(top), coverStock]);
    mesh.userData.block = true;
    spine.add(mesh);
    return mesh;
  };
  const right = makeBlock(innerTex);
  const left = makeBlock(blankTex);
  disposables.push(edgeTex, innerTex, blankTex);

  // Sombra difusa sobre "la mesa": un degradé que sigue la forma del libro.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 256;
  {
    const g = shadowCanvas.getContext("2d");
    const grd = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    grd.addColorStop(0, "rgba(0,0,0,0.42)"); grd.addColorStop(0.5, "rgba(0,0,0,0.16)"); grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  }
  const shadowTex = new CanvasTexture(shadowCanvas);
  const shadowMat = new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: theme === "dark" ? 0.9 : 0.55 });
  const shadow = new Mesh(new PlaneGeometry(1, 1), shadowMat);
  shadow.position.z = -0.42;
  book.add(shadow);
  disposables.push(shadowTex, shadowMat, shadow.geometry);

  // --- Curva de una hoja ---
  // t: 0 = a la derecha, 1 = a la izquierda. lag: la punta va detrás del movimiento (papel con peso).
  // gutterOpen: cuánto se curvan las páginas hacia el lomo cuando el libro está abierto.
  const xs = new Float32Array(SX + 1), zs = new Float32Array(SX + 1);
  function bend(s, t, lag, peek, gutterOpen, zRest, twist) {
    const key = `${t.toFixed(4)}|${lag.toFixed(3)}|${peek.toFixed(3)}|${gutterOpen.toFixed(3)}|${zRest.toFixed(4)}|${twist.toFixed(3)}`;
    if (key === s.last) return;
    s.last = key;
    const pos = s.geo.attributes.position;
    const a0 = t * Math.PI;
    const lift = Math.sin(t * Math.PI);
    const du = W / SX;
    for (let row = 0; row <= SY; row++) {
      const vv = row / SY; // 0 = abajo
      xs[0] = 0; zs[0] = 0;
      for (let k = 1; k <= SX; k++) {
        const uu = k / SX;
        // Lomo: la página sube desde la costura y se aplana hacia afuera.
        let a = a0 + gutterOpen * 0.62 * (1 - smooth(0, 0.34, uu)) * Math.cos(a0);
        // Peso del papel: la parte libre queda atrás del giro; la esquina de abajo, un poco más.
        a -= lag * lift * 1.15 * Math.pow(uu, 1.6) * (1 + twist * (0.5 - vv));
        // Asomo: la esquina inferior se levanta al pasar el cursor.
        a += peek * Math.pow(uu, 2.4) * Math.pow(1 - vv, 1.6) * 3.4;
        a = clamp(a, -0.05, Math.PI + 0.05);
        xs[k] = xs[k - 1] + Math.cos(a) * du;
        zs[k] = zs[k - 1] + Math.sin(a) * du;
      }
      for (let k = 0; k <= SX; k++) {
        const idx = (SY - row) * (SX + 1) + k; // PlaneGeometry ordena de arriba hacia abajo
        pos.setXYZ(idx, xs[k], (vv - 0.5) * H, zs[k] + zRest);
      }
    }
    pos.needsUpdate = true;
    s.geo.computeVertexNormals();
  }

  // --- Estado ---
  let progress = 0, target = 0, vel = 0;      // páginas dadas vuelta (0..N)
  let peek = 0, peekTarget = 0;
  let introT = reducedMotion ? 1 : 0;
  let frozen = false;
  const pointer = new Vector2(), tilt = { x: 0, y: 0 };
  let hoverSide = null, drag = null;
  let disposed = false, visible = true, raf = 0;
  const t0 = performance.now();
  let lastIndex = -1;

  const spreads = N; // 0 = tapa, 1..N-1 = casos, N = cierre
  const stateIndex = () => Math.round(target);

  function labelFor(side) {
    const i = stateIndex();
    if (i === 0) return data.labels.open;
    if (i >= spreads) return data.labels.back;
    return side ? data.labels.read : "";
  }

  // --- Interacción ---
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  function hit(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects([...sheets.map((s) => s.mesh), right, left], false);
    if (!hits.length) return null;
    const p = spine.worldToLocal(hits[0].point.clone());
    return p.x >= 0 ? "right" : "left";
  }
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    if (drag) {
      const dx = e.clientX - drag.x;
      target = clamp(drag.start - dx / drag.px, 0, spreads);
      drag.moved = Math.max(drag.moved, Math.abs(dx));
      drag.v = 0.8 * drag.v + 0.2 * (e.clientX - drag.last);
      drag.last = e.clientX;
      return;
    }
    hoverSide = hit(e);
    const text = hoverSide ? labelFor(hoverSide) : "";
    canvas.style.cursor = hoverSide ? "pointer" : "";
    label.textContent = text;
    label.style.opacity = text ? "1" : "0";
    label.style.transform = `translate(${e.clientX - r.left + 18}px, ${e.clientY - r.top + 18}px) scale(${text ? 1 : 0.9})`;
    // Asomar la esquina: tapa cerrada o página derecha de un caso.
    peekTarget = !reducedMotion && hoverSide === "right" && stateIndex() < spreads ? 0.11 : 0;
  }
  function onLeave() {
    hoverSide = null; peekTarget = 0; pointer.set(0, 0);
    label.style.opacity = "0";
  }
  function onDown(e) {
    if (!hit(e)) return;
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, last: e.clientX, start: target, moved: 0, v: 0, px: Math.max(160, canvas.clientWidth * 0.45) }; // ~ el ancho de una página en pantalla
  }
  function onUp(e) {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moved < 6) {
      const i = stateIndex();
      if (i === 0) go(1);
      else if (i >= spreads) go(0);
      else onOpen(data.cases[i - 1].slug, data.cases[i - 1]);
      return;
    }
    // La velocidad solo decide si la página que estás pasando se completa o vuelve; nunca saltea páginas.
    // Un arrastre pasa como mucho una página, hacia donde vas.
    const next = Math.round(target - clamp(d.v * 0.02, -0.45, 0.45));
    go(clamp(next, Math.round(d.start) - 1, Math.round(d.start) + 1));
  }
  function onKey(e) {
    if (e.key === "ArrowRight") { go(stateIndex() + 1); e.preventDefault(); }
    if (e.key === "ArrowLeft") { go(stateIndex() - 1); e.preventDefault(); }
    if (e.key === "Enter") { const i = stateIndex(); if (i > 0 && i < spreads) onOpen(data.cases[i - 1].slug, data.cases[i - 1]); }
  }
  function go(i) { target = clamp(i, 0, spreads); if (reducedMotion) progress = target; }

  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", () => (drag = null));
  container.addEventListener("keydown", onKey);

  // --- Tamaño: la cámara se aleja lo justo para que entre el libro abierto ---
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tan = Math.tan((camera.fov / 2) * Math.PI / 180);
    camera.position.z = Math.max((W * 2 * 1.1) / 2 / (tan * camera.aspect), (H * 1.22) / 2 / tan);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting));
  io.observe(container);

  // --- Cuadro ---
  let lastT = performance.now();
  function frame(now = performance.now()) {
    const dt = Math.min((now - lastT) / 1000, 1 / 30);
    lastT = now;
    const time = frozen ? 0 : (now - t0) / 1000;

    // Resorte críticamente amortiguado hacia la página elegida.
    if (reducedMotion) { progress = target; vel = 0; }
    else if (drag) { vel = (target - progress) / Math.max(dt, 1e-3) * 0.25; progress += (target - progress) * 0.25; }
    else {
      const k = 38, c = 2 * Math.sqrt(k) * 0.92;
      vel += ((target - progress) * k - vel * c) * dt;
      progress += vel * dt;
    }
    peek += (peekTarget - peek) * (reducedMotion ? 1 : 0.12);

    // Entrada: cae con peso y se acomoda.
    if (!frozen && introT < 1) introT = Math.min(1, introT + dt / 1.9);
    const ie = easeOutExpo(introT);

    // Hojas
    const open = clamp(progress, 0, 1);
    const lag = clamp(vel * 0.35, -1, 1);
    let turning = -1, maxLift = 0;
    sheets.forEach((s) => {
      const t = clamp(progress - s.i, 0, 1);
      const lift = Math.sin(t * Math.PI);
      if (lift > maxLift) { maxLift = lift; turning = s.i; }
      const zRight = GAP * (N - s.i), zLeft = GAP * (s.i + 1);
      const z = zRight + (zLeft - zRight) * smooth(0.25, 0.75, t);
      const p = s.i === Math.floor(progress + 1e-3) && t < 0.02 ? peek : 0;
      bend(s, t, lag, p, open * (1 - lift), z, 0.6);
    });
    sheets.forEach((s) => {
      s.mat.uniforms.uTurning.value = s.i === turning && maxLift > 0.02 ? 1 : 0;
      s.mat.uniforms.uShadowAmt.value = maxLift;
      s.mat.uniforms.uHover.value = 0;
      s.mat.uniforms.uOpen.value = open;
    });
    if (turning >= 0) {
      // Borde libre de la hoja que gira: la columna más lejana del lomo.
      const pos = sheets[turning].geo.attributes.position;
      const edgeX = pos.getX(Math.round(SY / 2) * (SX + 1) + SX);
      sheets.forEach((s) => (s.mat.uniforms.uShadowEdge.value = edgeX));
    }

    // Bloques: el relleno se reparte entre los dos lados según dónde estamos.
    const leftShare = clamp(progress / spreads, 0, 1) * open;
    const dl = Math.max(0.0001, BLOCK * leftShare), dr = Math.max(0.0001, BLOCK * (1 - leftShare));
    right.scale.set(1, 1, dr); right.position.set(W / 2, 0, -dr / 2);
    left.scale.set(1, 1, dl); left.position.set(-W / 2, 0, -dl / 2);
    left.visible = dl > 0.0005;
    right.material[4].uniforms.uGutter.value = open;
    left.rotation.y = 0;

    // Centrado: cerrado se centra en la tapa, abierto en el lomo.
    spine.position.x = (-W / 2) * (1 - open);
    shadow.position.x = spine.position.x + (W / 2) * (1 - open) + 0.12;
    shadow.position.y = -0.1;
    shadow.scale.set(W * (1 + open) * 1.45, H * 1.35, 1);

    // Pose: entrada + respiración + cursor.
    const breathe = reducedMotion || frozen ? 0 : 1;
    tilt.x += ((reducedMotion ? 0 : pointer.y * 0.09) - tilt.x) * 0.05;
    tilt.y += ((reducedMotion ? 0 : pointer.x * 0.16) - tilt.y) * 0.05;
    root.rotation.set(
      0.16 + tilt.x + (1 - ie) * 0.55 + Math.sin(time * 0.7) * 0.012 * breathe,
      -0.34 + tilt.y + (1 - ie) * -0.9 + Math.sin(time * 0.5) * 0.02 * breathe,
      0.03 + (1 - ie) * 0.12,
    );
    root.position.set(0, (1 - ie) * -0.9 + Math.sin(time * 0.9) * 0.018 * breathe, (1 - ie) * -1.5);

    renderer.render(scene, camera);

    const idx = Math.round(progress);
    if (idx !== lastIndex) { lastIndex = idx; onChange(idx); }
  }
  function loop(now) {
    if (disposed) return;
    if (visible && !document.hidden) frame(now);
    raf = requestAnimationFrame(loop);
  }
  frame();
  raf = requestAnimationFrame(loop);

  // Una pista de que se puede abrir: la tapa se asoma una vez después de la entrada.
  let hintTimer = 0;
  if (!reducedMotion) hintTimer = setTimeout(() => { if (!hoverSide && target === 0) { peekTarget = 0.16; setTimeout(() => { if (!hoverSide) peekTarget = 0; }, 900); } }, 2300);

  // --- Estados con nombre, para capturas y pruebas ---
  const states = {
    intro: () => { frozen = true; introT = 0.35; progress = target = 0; vel = 0; peek = peekTarget = 0; },
    cover: () => { frozen = true; introT = 1; progress = target = 0; vel = 0; peek = peekTarget = 0; },
    peek: () => { frozen = true; introT = 1; progress = target = 0; vel = 0; peek = peekTarget = 0.16; },
    turning: () => { frozen = true; introT = 1; progress = target = 1.45; vel = 1.6; peek = peekTarget = 0; },
    "spread-1": () => { frozen = true; introT = 1; progress = target = 1; vel = 0; peek = peekTarget = 0; },
    "spread-2": () => { frozen = true; introT = 1; progress = target = 2; vel = 0; },
    "spread-3": () => { frozen = true; introT = 1; progress = target = 3; vel = 0; },
    closing: () => { frozen = true; introT = 1; progress = target = spreads; vel = 0; },
  };
  function goto(name) {
    states[name]?.();
    pointer.set(0, 0); tilt.x = tilt.y = 0;
    sheets.forEach((s) => (s.last = ""));
    // Con el estado congelado no hay resorte: dibujar varias veces para asentar la pose.
    for (let k = 0; k < 4; k++) frame(lastT + 16);
  }
  if (debug) window.__app = { ready: true, goto, states: Object.keys(states) };

  function setTheme(next) {
    const a = ambient[next] ?? ambient.light;
    sheets.forEach((s) => (s.mat.uniforms.uAmbient.value = a));
    shadowMat.opacity = next === "dark" ? 0.9 : 0.55;
  }

  function destroy() {
    disposed = true;
    cancelAnimationFrame(raf);
    clearTimeout(hintTimer);
    ro.disconnect(); io.disconnect();
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointerup", onUp);
    container.removeEventListener("keydown", onKey);
    disposables.forEach((d) => d.dispose?.());
    renderer.dispose();
    canvas.remove(); label.remove();
    if (window.__app?.goto === goto) delete window.__app;
  }

  return { destroy, goto, setTheme, go, get index() { return Math.round(target); } };
}
