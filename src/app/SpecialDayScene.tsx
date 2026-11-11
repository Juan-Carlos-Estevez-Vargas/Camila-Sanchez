import { memo, useState, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import type { SpecialScene } from "@/domain/specialDays";
import { useSpecialDay } from "@/state/SpecialDayContext";
import { useReducedMotion } from "@/ui/motion";

/**
 * La escena de la fecha especial: guirnalda bajo la cabecera y, de fondo,
 * lo que cae (nieve, hojas, confeti), lo que vuela (murciélagos, el
 * trineo), lo que cuelga (arañas, adornos), telarañas, fuegos artificiales
 * y la fila del suelo (calabazas, tumbas, árboles, regalos).
 *
 * Todo es CSS (transform y opacity); las posiciones salen del índice, así
 * que no hay azar ni JS por cuadro. Es decoración: aria-hidden y sin
 * clics. Con «Reducir animaciones» sólo queda lo quieto. No sale en el chat.
 */
const isChat = (path: string) => path === "/chat" || path.startsWith("/chat/");
type Vars = CSSProperties & Record<`--${string}`, string>;

function useMobile(): boolean {
  const [mobile] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(max-width: 640px)").matches);
  return mobile;
}

/** Guirnalda en el flujo de la página, justo bajo la cabecera (se va al desplazarse). */
export const SpecialDayGarland = memo(function SpecialDayGarland() {
  const { day } = useSpecialDay();
  const { pathname } = useLocation();
  const mobile = useMobile();
  if (!day || isChat(pathname)) return null;
  const { kind, items } = day.style.scene.garland;
  const count = kind === "lights" ? (mobile ? 16 : 36) : mobile ? 10 : 22;
  return (
    <div className={`garland garland--${kind}`} aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const item = items[i % items.length]!;
        const style: Vars = { "--i": String(i), animationDelay: `${(i % 5) * -0.37}s` };
        if (kind !== "emoji") style["--c"] = item;
        return <span key={i} style={style}>{kind === "emoji" ? item : null}</span>;
      })}
    </div>
  );
});

function Fall({ scene, count }: { scene: SpecialScene; count: number }) {
  const confetti = scene.confetti ? scene.garland.items.filter((c) => c.startsWith("#")) : [];
  const palette = confetti.length ? confetti : ["#ff4d8d", "#ffd166", "#4cc9f0", "#8c5cff"];
  return (
    <div className="scene__fall">
      {Array.from({ length: count }, (_, i) => {
        const paper = scene.confetti && i % 2 === 0;
        const style: Vars = {
          left: `${(i * 37 + 11) % 100}%`,
          animationDuration: `${9 + ((i * 7) % 9)}s`,
          animationDelay: `-${(i * 1.9) % 16}s`,
          fontSize: `${0.8 + ((i * 5) % 8) / 10}rem`,
          "--sway": `${((i * 13) % 7) * 12 - 36}px`,
        };
        if (paper) style["--c"] = palette[i % palette.length]!;
        return paper
          ? <i key={i} className="scene__paper" style={style} />
          : <span key={i} style={style}>{scene.fall[i % scene.fall.length]}</span>;
      })}
    </div>
  );
}

function Fireworks({ colors }: { colors: string[] }) {
  const spots = [[18, 22], [78, 16], [55, 34], [32, 12], [88, 40]] as const;
  return (
    <div className="scene__fireworks">
      {spots.map(([x, y], n) => (
        <div key={n} className="scene__firework"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${n * 0.9}s`, "--c": colors[n % colors.length] } as Vars}>
          {Array.from({ length: 12 }, (_, k) => <i key={k} style={{ "--k": String(k) } as Vars} />)}
        </div>
      ))}
    </div>
  );
}

export const SpecialDayScene = memo(function SpecialDayScene() {
  const { day } = useSpecialDay();
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const mobile = useMobile();
  if (!day || isChat(pathname)) return null;
  const scene = day.style.scene;
  const fall = reduced || !(scene.fall.length || scene.confetti) ? 0 : mobile ? 14 : 30;
  const ground = mobile ? scene.ground.slice(0, 6) : scene.ground;
  const hangSpots = mobile ? [6, 94] : [4, 92, 97];

  return (
    <div className={`scene scene--${day.id}`} aria-hidden>
      {scene.cobwebs && (
        <>
          <Cobweb className="scene__web scene__web--left" />
          <Cobweb className="scene__web scene__web--right" />
        </>
      )}
      {fall > 0 && <Fall scene={scene} count={fall} />}
      {!reduced && scene.fireworks && <Fireworks colors={scene.garland.items} />}
      {!reduced && scene.flyers.map((f, i) => (
        <span key={i} className="scene__flyer"
          style={{ top: `${14 + ((i * 17) % 40)}%`, animationDuration: `${16 + i * 5}s`, animationDelay: `${i * 4.5}s` }}>
          {f}
        </span>
      ))}
      {scene.hang.slice(0, hangSpots.length).map((h, i) => (
        <span key={i} className="scene__hang" style={{ left: `${hangSpots[i]}%`, animationDelay: `${i * -1.3}s`, "--len": `${60 + i * 34}px` } as Vars}>
          {h}
        </span>
      ))}
      <div className="scene__ground">
        {ground.map((g, i) => <span key={i} style={{ animationDelay: `${i * -0.6}s` }}>{g}</span>)}
      </div>
    </div>
  );
});

/** Telaraña dibujada (radios y anillos), en las esquinas de Halloween. */
function Cobweb({ className }: { className: string }) {
  const rays = [0, 15, 30, 45, 60, 75, 90];
  const rings = [30, 58, 88, 120];
  return (
    <svg className={className} viewBox="0 0 150 150" fill="none" stroke="currentColor" strokeWidth="1.2">
      {rays.map((a) => {
        const r = (a * Math.PI) / 180;
        return <line key={a} x1="0" y1="0" x2={150 * Math.cos(r)} y2={150 * Math.sin(r)} />;
      })}
      {rings.map((d) => (
        <path key={d} d={rays.slice(1).reduce((acc, a, idx) => {
          const cur = (a * Math.PI) / 180;
          const mid = ((rays[idx]! + a) / 2) * (Math.PI / 180);
          const sag = d * 0.82;
          return `${acc} Q ${sag * Math.cos(mid)} ${sag * Math.sin(mid)} ${d * Math.cos(cur)} ${d * Math.sin(cur)}`;
        }, `M ${d} 0`)} />
      ))}
    </svg>
  );
}
