import { AUTHOR } from "@/core/author";
import { FONT_OPTIONS } from "@/domain/defaults";

/** Bibliotecas que llegan al navegador (las de desarrollo no se publican). */
export const LIBRARIES = [
  { name: "React y React DOM", license: "MIT", url: "https://github.com/facebook/react" },
  { name: "React Router", license: "MIT", url: "https://github.com/remix-run/react-router" },
  { name: "Supabase JS", license: "MIT", url: "https://github.com/supabase/supabase-js" },
  { name: "idb-keyval", license: "Apache 2.0", url: "https://github.com/jakearchibald/idb-keyval" },
  { name: "node-qrcode", license: "MIT", url: "https://github.com/soldair/node-qrcode" },
] as const;

export const FONTS = [...new Set([...FONT_OPTIONS.display, ...FONT_OPTIONS.body])];

export function Licenses() {
  return (
    <>
      <h2>El código de la app</h2>
      <p>
        Lo escribió {AUTHOR.name} y es abierto, con <a href={`${AUTHOR.repository}/blob/master/LICENSE`} target="_blank" rel="noopener noreferrer">licencia MIT</a>.
        Puedes ver el <a href={AUTHOR.repository} target="_blank" rel="noopener noreferrer">repositorio en GitHub</a>.
      </p>

      <h2>Fotos y textos</h2>
      <p>
        Las fotos de la página, los textos personales y las capturas son de la pareja y de quienes las suben. <strong>No</strong> están
        bajo la licencia MIT y no se pueden copiar ni reutilizar sin su permiso. Cada persona que sube una foto declara que
        tiene derecho a hacerlo y permiso de quienes salen en ella. La app no usa fotos de bancos de imágenes.
      </p>

      <h2>Iconos, stickers y dibujos</h2>
      <p>
        El corazón del icono y los stickers del chat están dibujados para esta app (SVG propios,
        misma licencia que el código). Los emojis los dibuja tu dispositivo con su propia fuente de emojis
        (Apple, Google, Microsoft…), así que no se distribuyen con la app.
      </p>

      <h2>Tipografías</h2>
      <p>
        {FONTS.join(", ")}: todas con la <a href="https://openfontlicense.org" target="_blank" rel="noopener noreferrer">SIL Open Font License 1.1</a>,
        servidas por Google Fonts sólo si las aceptas en el aviso de cookies.
      </p>

      <h2>Bibliotecas</h2>
      <table>
        <thead><tr><th scope="col">Biblioteca</th><th scope="col">Licencia</th></tr></thead>
        <tbody>
          {LIBRARIES.map((lib) => (
            <tr key={lib.name}>
              <td><a href={lib.url} target="_blank" rel="noopener noreferrer">{lib.name}</a></td>
              <td>{lib.license}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Junto con sus dependencias (todas MIT, ISC, Apache 2.0 o 0BSD). Una prueba automática revisa que ninguna dependencia
        de la app tenga una licencia que no permita este uso.
      </p>

      <h2>Música</h2>
      <p>
        Si la página tiene música de fondo, es un enlace que configura el administrador. Quien lo pone se encarga de que
        tenga permiso para usar esa canción.
      </p>
    </>
  );
}
