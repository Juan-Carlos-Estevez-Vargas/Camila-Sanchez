import { openCookiePreferences } from "@/services/consent/cookieConsent";

export function Cookies() {
  return (
    <>
      <h2>Resumen</h2>
      <p>
        La app <strong>no usa cookies</strong> propias ni de terceros para publicidad, analítica o seguimiento. Para
        funcionar, tu navegador guarda algunos datos en su almacenamiento local (<em>localStorage</em>,
        <em> sessionStorage</em> e <em>IndexedDB</em>), que es parecido a una cookie pero nunca se envía solo a ningún
        servidor.
      </p>

      <h2>Lo que se guarda siempre (necesario)</h2>
      <p>Sin esto la app no funciona o tendría que preguntarte lo mismo cada vez. No necesita tu permiso, pero te lo contamos.</p>
      <table>
        <thead>
          <tr><th scope="col">Qué</th><th scope="col">Para qué</th><th scope="col">Cuánto dura</th></tr>
        </thead>
        <tbody>
          <tr><td>Sesión</td><td>Saber que ya entraste. Con «mantener la sesión» queda guardada; sin eso, se borra al cerrar la pestaña.</td><td>Hasta que cierres sesión</td></tr>
          <tr><td>Copia rápida del contenido</td><td>Que la página abra al instante y se vea sin conexión. Se borra al cerrar sesión.</td><td>Hasta cerrar sesión</td></tr>
          <tr><td>Preferencias</td><td>Reducir animaciones, tu idioma, el tutorial ya visto, las sorpresas ya vistas, si cerraste el aviso de instalar la app y tu elección en este aviso.</td><td>Hasta que borres los datos del navegador</td></tr>
          <tr><td>App y avisos en el celular</td><td>El <em>service worker</em>: guarda el código de la app para que abra rápido y sin conexión, y recibe los avisos si los activas.</td><td>Hasta que borres los datos del navegador o desinstales la app</td></tr>
        </tbody>
      </table>

      <h2>Lo opcional (con tu permiso)</h2>
      <table>
        <thead>
          <tr><th scope="col">Qué</th><th scope="col">Proveedor</th><th scope="col">Qué pasa si lo aceptas</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Tipografías</td>
            <td>Google Fonts (Google LLC)</td>
            <td>Tu navegador descarga las letras desde servidores de Google, que reciben tu dirección IP y tu navegador. Según Google, no las usa para crear perfiles ni para publicidad. Si no aceptas, se usan las letras de tu dispositivo.</td>
          </tr>
        </tbody>
      </table>

      <h2>Servicios de seguridad</h2>
      <p>
        Si el administrador activa la comprobación «no soy un robot» (Cloudflare Turnstile), al entrar se carga un
        recuadro de Cloudflare que puede usar almacenamiento propio sólo para detectar robots. Es necesario para la
        seguridad de las cuentas y no se usa para publicidad.
      </p>

      <h2>Cambiar tu elección</h2>
      <p>
        Puedes cambiarla cuando quieras, también desde «Preferencias de cookies» en el pie de página. Y siempre puedes
        borrar todo desde los ajustes de tu navegador.
      </p>
      <p>
        <button type="button" className="btn btn--soft" onClick={openCookiePreferences}>Abrir preferencias de cookies</button>
      </p>
    </>
  );
}
