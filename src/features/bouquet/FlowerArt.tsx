/**
 * El ramo dibujado en SVG: flores de cada tipo, tallos, hojas, flores de
 * nube (paniculata), el envoltorio de papel y el moño. Todo sale de los
 * colores de `BOUQUETS` (domain/bouquets.ts), así que no hay imágenes que
 * descargar y se ve nítido en cualquier pantalla.
 *
 * Las clases (`stem`, `leaf`, `bloom`…) son las que anima el CSS del ramo:
 * los tallos se dibujan, las hojas brotan y cada flor se abre a su turno
 * (`--i`). Con «Reducir animaciones» todo aparece ya abierto.
 */
import type { CSSProperties, ReactNode } from "react";
import { BOUQUET_LAYOUT, type BouquetStyle, type FlowerKind } from "@/domain/bouquets";
import styles from "./Bouquet.module.scss";

/** Mezcla dos colores #rrggbb (t = 0: el primero; 1: el segundo). */
export function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

const light = (c: string, t: number) => mix(c, "#ffffff", t);
const dark = (c: string, t: number) => mix(c, "#000000", t);

/** Pétalo en punta (dalia, girasol, Nochebuena, hojas). */
const pointed = (len: number, w: number) =>
  `M0 0 C ${w} ${-len * 0.22} ${w * 0.95} ${-len * 0.72} 0 ${-len} C ${-w * 0.95} ${-len * 0.72} ${-w} ${-len * 0.22} 0 0Z`;

/** `n` copias rotadas alrededor del centro. */
function ring(n: number, offset: number, draw: (angle: number, k: number) => ReactNode) {
  return Array.from({ length: n }, (_, k) => draw(offset + (360 / n) * k, k));
}

function Gerbera({ r, c, center }: { r: number; c: string; center: string }) {
  return (
    <>
      {ring(22, 0, (a, k) => (
        <ellipse key={`o${k}`} cx={0} cy={-r * 0.56} rx={r * 0.11} ry={r * 0.46} fill={c} stroke={dark(c, 0.12)} strokeWidth={0.6}
          transform={`rotate(${a})`} />
      ))}
      {ring(22, 360 / 44, (a, k) => (
        <ellipse key={`i${k}`} cx={0} cy={-r * 0.4} rx={r * 0.08} ry={r * 0.32} fill={light(c, 0.22)} transform={`rotate(${a})`} />
      ))}
      <circle r={r * 0.27} fill={mix(center, "#f9c74f", 0.55)} />
      {ring(18, 0, (a, k) => <circle key={`d${k}`} cx={0} cy={-r * 0.21} r={r * 0.035} fill={light(center, 0.15)} transform={`rotate(${a})`} />)}
      <circle r={r * 0.17} fill={center} />
    </>
  );
}

function Sunflower({ r, c, center }: { r: number; c: string; center: string }) {
  // Semillas en espiral (ángulo de oro), como en un girasol de verdad.
  const seeds = Array.from({ length: 70 }, (_, k) => {
    const d = Math.sqrt(k / 70) * r * 0.36;
    const a = k * 2.39996;
    return <circle key={k} cx={Math.cos(a) * d} cy={Math.sin(a) * d} r={r * 0.028} fill={light(center, 0.28)} />;
  });
  return (
    <>
      {ring(18, 10, (a, k) => <path key={`o${k}`} d={pointed(r, r * 0.17)} fill={dark(c, 0.08)} transform={`rotate(${a})`} />)}
      {ring(18, 0, (a, k) => <path key={`i${k}`} d={pointed(r * 0.88, r * 0.16)} fill={c} stroke={dark(c, 0.15)} strokeWidth={0.5} transform={`rotate(${a})`} />)}
      <circle r={r * 0.42} fill={center} />
      {seeds}
    </>
  );
}

function Dahlia({ r, c, center }: { r: number; c: string; center: string }) {
  const rows: Array<[number, number, number, number]> = [
    // [pétalos, largo, ancho, tono]
    [16, 1, 0.2, -0.12], [14, 0.8, 0.18, 0], [12, 0.6, 0.16, 0.14], [9, 0.4, 0.13, 0.28],
  ];
  return (
    <>
      {rows.map(([n, len, w, tone], row) =>
        ring(n, row * 11, (a, k) => (
          <path key={`${row}-${k}`} d={pointed(r * len, r * w)} transform={`rotate(${a})`}
            fill={tone < 0 ? dark(c, -tone) : light(c, tone)} stroke={dark(c, 0.25)} strokeWidth={0.5} />
        )),
      )}
      <circle r={r * 0.1} fill={center} />
    </>
  );
}

function Poinsettia({ r, c, center }: { r: number; c: string; center: string }) {
  return (
    <>
      {ring(7, 0, (a, k) => (
        <g key={`o${k}`} transform={`rotate(${a})`}>
          <path d={pointed(r, r * 0.3)} fill={c} stroke={dark(c, 0.2)} strokeWidth={0.6} />
          <path d={`M0 0 L0 ${-r * 0.92}`} stroke={dark(c, 0.22)} strokeWidth={0.8} />
        </g>
      ))}
      {ring(6, 30, (a, k) => (
        <path key={`i${k}`} d={pointed(r * 0.62, r * 0.22)} fill={light(c, 0.1)} stroke={dark(c, 0.2)} strokeWidth={0.5} transform={`rotate(${a})`} />
      ))}
      {ring(6, 0, (a, k) => <circle key={`c${k}`} cx={0} cy={-r * 0.09} r={r * 0.06} fill={k % 2 ? "#7cb342" : center} transform={`rotate(${a})`} />)}
      <circle r={r * 0.05} fill="#c62828" />
    </>
  );
}

function Peony({ r, c }: { r: number; c: string }) {
  const layers: Array<[number, number, number, number]> = [
    // [pétalos, distancia, radio, tono]
    [9, 0.55, 0.45, -0.08], [8, 0.36, 0.4, 0], [7, 0.2, 0.32, 0.16], [5, 0.08, 0.2, 0.3],
  ];
  return (
    <>
      {layers.map(([n, d, rad, tone], row) =>
        ring(n, row * 17, (a, k) => (
          <circle key={`${row}-${k}`} cx={0} cy={-r * d} r={r * rad} transform={`rotate(${a})`}
            fill={tone < 0 ? dark(c, -tone) : light(c, tone)} stroke={dark(c, 0.14)} strokeWidth={0.7} />
        )),
      )}
    </>
  );
}

function Rose({ r, c }: { r: number; c: string }) {
  const s = dark(c, 0.35);
  return (
    <>
      {ring(5, 0, (a, k) => (
        <circle key={`o${k}`} cx={0} cy={-r * 0.42} r={r * 0.5} fill={dark(c, 0.06)} stroke={s} strokeWidth={0.9} transform={`rotate(${a})`} />
      ))}
      {ring(4, 45, (a, k) => (
        <circle key={`m${k}`} cx={0} cy={-r * 0.24} r={r * 0.4} fill={c} stroke={s} strokeWidth={0.9} transform={`rotate(${a})`} />
      ))}
      <circle r={r * 0.36} fill={light(c, 0.06)} stroke={s} strokeWidth={0.9} />
      {/* El corazón de la rosa: pétalos enrollados en espiral. */}
      <path d={`M ${-r * 0.22} ${r * 0.04} C ${-r * 0.24} ${-r * 0.24} ${r * 0.2} ${-r * 0.28} ${r * 0.22} ${-r * 0.02}
               C ${r * 0.24} ${r * 0.18} ${-r * 0.08} ${r * 0.22} ${-r * 0.1} ${r * 0.02}
               C ${-r * 0.11} ${-r * 0.1} ${r * 0.08} ${-r * 0.12} ${r * 0.08} ${0}`}
        fill="none" stroke={dark(c, 0.45)} strokeWidth={1.3} strokeLinecap="round" />
    </>
  );
}

function Tulip({ r, c }: { r: number; c: string }) {
  // De lado: la copa cerrada con tres pétalos.
  const w = r * 0.62;
  const h = r * 1.15;
  const s = dark(c, 0.25);
  return (
    <g transform={`translate(0 ${h * 0.45})`}>
      <path d={`M0 0 C ${-w * 1.25} ${-h * 0.1} ${-w * 1.15} ${-h * 0.8} ${-w * 0.55} ${-h} C ${-w * 0.3} ${-h * 0.72} ${-w * 0.1} ${-h * 0.62} 0 ${-h * 0.6} Z`}
        fill={dark(c, 0.06)} stroke={s} strokeWidth={0.8} />
      <path d={`M0 0 C ${w * 1.25} ${-h * 0.1} ${w * 1.15} ${-h * 0.8} ${w * 0.55} ${-h} C ${w * 0.3} ${-h * 0.72} ${w * 0.1} ${-h * 0.62} 0 ${-h * 0.6} Z`}
        fill={dark(c, 0.1)} stroke={s} strokeWidth={0.8} />
      <path d={`M0 0 C ${-w * 0.95} ${-h * 0.15} ${-w * 0.6} ${-h * 0.92} 0 ${-h * 1.06} C ${w * 0.6} ${-h * 0.92} ${w * 0.95} ${-h * 0.15} 0 0 Z`}
        fill={light(c, 0.12)} stroke={s} strokeWidth={0.8} />
      <path d={`M0 ${-h * 0.1} Q ${w * 0.08} ${-h * 0.55} 0 ${-h * 0.95}`} fill="none" stroke={light(c, 0.45)} strokeWidth={1.2} opacity={0.6} />
    </g>
  );
}

function Flower({ kind, r, c, center }: { kind: FlowerKind; r: number; c: string; center: string }) {
  switch (kind) {
    case "gerbera": return <Gerbera r={r} c={c} center={center} />;
    case "sunflower": return <Sunflower r={r} c={c} center={center} />;
    case "dahlia": return <Dahlia r={r} c={c} center={center} />;
    case "poinsettia": return <Poinsettia r={r} c={c} center={center} />;
    case "peony": return <Peony r={r} c={c} />;
    case "rose": return <Rose r={r} c={c} />;
    case "tulip": return <Tulip r={r} c={c} />;
  }
}

/** Una flor suelta (el botón 💐, la nota). */
export function SingleFlower({ style, size = 40 }: { style: BouquetStyle; size?: number }) {
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden focusable="false">
      <Flower kind={style.flower} r={44} c={style.colors[0]!} center={style.center} />
    </svg>
  );
}

const GATHER = { x: 160, y: 292 };
/** De atrás hacia adelante: la del centro queda encima. */
const DRAW_ORDER = [5, 6, 3, 4, 1, 2, 0];
/** Hojas entre las flores: [x, y, ángulo, largo]. */
const LEAVES: Array<[number, number, number, number]> = [
  [70, 200, -62, 62], [250, 200, 62, 62], [40, 150, -78, 48], [282, 152, 78, 48], [130, 210, -24, 46], [192, 212, 26, 46],
];
/** Ramitas de paniculata (flor de nube) entre las flores. */
const BABY_BREATH: Array<[number, number]> = [
  [36, 92], [80, 70], [160, 56], [242, 72], [286, 94], [56, 196], [266, 198], [116, 132], [206, 134], [160, 206],
];

/** El ramo completo (viewBox 320 × 400). */
export function BouquetArt({ style, title }: { style: BouquetStyle; title: string }) {
  const [outside, inside] = style.paper;
  return (
    <svg className={styles.art} viewBox="0 0 320 400" role="img" aria-label={title}>
      {/* Papel de atrás. */}
      <path className={styles.paper} d="M18 128 L160 250 L302 128 L210 382 L110 382 Z" fill={inside} stroke={dark(inside, 0.12)} strokeWidth={1} />

      {/* Tallos: todos se juntan bajo el moño. */}
      {BOUQUET_LAYOUT.map((f, k) => (
        <path key={`s${k}`} className={styles.stem} style={{ "--i": k } as CSSProperties} pathLength={1}
          d={`M ${GATHER.x} ${GATHER.y + 40} Q ${(f.x + GATHER.x) / 2} ${(f.y + GATHER.y) / 2 + 30} ${f.x} ${f.y}`}
          fill="none" stroke={dark(style.leaf, 0.1)} strokeWidth={4} strokeLinecap="round" />
      ))}

      {LEAVES.map(([x, y, a, len], k) => (
        <g key={`l${k}`} transform={`translate(${x} ${y}) rotate(${a})`}>
          <g className={styles.leaf} style={{ "--i": k } as CSSProperties}>
            <path d={pointed(len, len * 0.26)} fill={k % 2 ? style.leaf : light(style.leaf, 0.12)} stroke={dark(style.leaf, 0.25)} strokeWidth={0.8} />
            <path d={`M0 0 L0 ${-len * 0.9}`} stroke={dark(style.leaf, 0.3)} strokeWidth={0.8} />
          </g>
        </g>
      ))}

      {BABY_BREATH.map(([x, y], k) => (
        <g key={`b${k}`} transform={`translate(${x} ${y})`}>
          <g className={styles.filler} style={{ "--i": k } as CSSProperties}>
            {[[0, 0], [6, -4], [-5, -5], [3, 6], [-6, 4], [9, 3]].map(([dx, dy], j) => (
              <circle key={j} cx={dx} cy={dy} r={2.6} fill="#ffffff" stroke="#e6e6e6" strokeWidth={0.5} />
            ))}
          </g>
        </g>
      ))}

      {DRAW_ORDER.map((k, order) => {
        const f = BOUQUET_LAYOUT[k]!;
        const color = style.colors[k % style.colors.length]!;
        return (
          <g key={`f${k}`} transform={`translate(${f.x} ${f.y}) rotate(${f.tilt})`}>
            <g className={styles.bloom} style={{ "--i": order } as CSSProperties}>
              <Flower kind={style.flower} r={f.r} c={color} center={style.center} />
            </g>
          </g>
        );
      })}

      {/* Papel de adelante, con sus pliegues. */}
      <path className={styles.paper} d="M40 218 L160 282 L280 218 L206 388 L114 388 Z" fill={outside} stroke={dark(outside, 0.18)} strokeWidth={1.2} />
      <path d="M160 282 L150 388 M160 282 L176 388" stroke={dark(outside, 0.14)} strokeWidth={1} fill="none" opacity={0.7} />

      {/* El moño (la animación va en el <g> de adentro: el CSS pisaría el translate). */}
      <g transform={`translate(${GATHER.x} ${GATHER.y + 18})`}>
        <g className={styles.ribbon}>
          <path d="M0 0 C -18 -22 -48 -18 -40 0 C -48 18 -18 22 0 0 Z" fill={style.ribbon} stroke={dark(style.ribbon, 0.25)} strokeWidth={1} />
          <path d="M0 0 C 18 -22 48 -18 40 0 C 48 18 18 22 0 0 Z" fill={style.ribbon} stroke={dark(style.ribbon, 0.25)} strokeWidth={1} />
          <path d="M-4 4 L-22 52 L-12 46 L-6 56 L2 6 Z" fill={dark(style.ribbon, 0.08)} />
          <path d="M4 4 L22 50 L12 45 L8 56 L-2 6 Z" fill={dark(style.ribbon, 0.12)} />
          <ellipse rx={8} ry={9} fill={light(style.ribbon, 0.1)} stroke={dark(style.ribbon, 0.25)} strokeWidth={1} />
        </g>
      </g>
    </svg>
  );
}
