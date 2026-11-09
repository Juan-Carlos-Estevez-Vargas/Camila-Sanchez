import { Link } from "react-router-dom";
import { DATA_CONTROLLER, legalPath } from "@/domain/legal";
import { Contact } from "./Contact";

/** Política de tratamiento de datos personales (Ley 1581 de 2012, Decreto 1074 de 2015). */
export function Privacy() {
  return (
    <>
      <h2>1. Quién cuida tus datos</h2>
      <p>
        El responsable del tratamiento es <strong>{DATA_CONTROLLER.name}</strong>, persona natural en {DATA_CONTROLLER.country}.
        Puedes contactarlo <Contact />.
      </p>
      <p>
        Esta es una app privada y gratuita, hecha para una pareja y para las pocas personas a las que ellos
        invitan. No es un servicio comercial, no tiene publicidad y no vende ni alquila datos a nadie.
      </p>

      <h2>2. Qué datos guardamos</h2>
      <p>Sólo lo que hace falta para que la app funcione. Ninguno es obligatorio salvo los de tu cuenta.</p>
      <table>
        <thead>
          <tr><th scope="col">Tipo</th><th scope="col">Qué incluye</th><th scope="col">De dónde sale</th></tr>
        </thead>
        <tbody>
          <tr><td>Cuenta</td><td>Correo, nombre y rol. La contraseña se guarda cifrada (con un hash): nadie, ni siquiera el administrador, puede leerla.</td><td>Tú, al crear la cuenta</td></tr>
          <tr><td>Perfil (opcional)</td><td>Foto o icono, una frase, tu cumpleaños y tus colores.</td><td>Tú, en Mi cuenta</td></tr>
          <tr><td>Lo que compartes</td><td>Fotos y sus descripciones, notitas, mensajes, fotos y stickers del chat, reacciones, listas, tareas, fechas y sorpresas.</td><td>Tú, al usar la app</td></tr>
          <tr><td>Uso de la app</td><td>Tu última conexión, qué mensajes ya leíste («visto»), cuándo abriste una dedicatoria (lo ve sólo quien la escribió) y un registro de cambios (quién cambió qué y cuándo) para poder revisar errores o abusos.</td><td>La app, mientras la usas</td></tr>
          <tr><td>Datos técnicos</td><td>Si activas los avisos en el celular: la dirección del servicio de avisos de tu navegador y el tipo de navegador. Los servidores guardan por un tiempo corto registros con la dirección IP, por seguridad.</td><td>Tu navegador</td></tr>
        </tbody>
      </table>
      <p>
        Las fotos se optimizan en tu propio dispositivo antes de subirse y se les quitan los metadatos de la cámara,
        como la ubicación GPS. <strong>No pedimos datos sensibles</strong> (salud, religión, orientación política,
        datos biométricos…): por favor no los subas. Si subes una foto en la que salen otras personas, hazlo sólo con su permiso.
      </p>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Que puedas entrar, ver la página, escribir en el chat, compartir listas y recibir avisos.</li>
        <li>Mostrarle a las personas con las que hablas tu nombre, tu foto y si ya leíste sus mensajes.</li>
        <li>Proteger la app: frenar intentos de entrar a la fuerza, investigar errores y mantener copias de seguridad.</li>
      </ul>
      <p>
        <strong>No</strong> usamos tus datos para publicidad, no armamos perfiles de comportamiento, no los vendemos
        y no los usamos para entrenar inteligencia artificial.
      </p>

      <h2>4. Con quién se comparten</h2>
      <p>
        Nadie más ve tus datos fuera de las personas de la app según sus permisos. Para funcionar, la app usa estos
        proveedores, que actúan como <em>encargados</em> y sólo los procesan para prestar su servicio:
      </p>
      <table>
        <thead>
          <tr><th scope="col">Proveedor</th><th scope="col">Para qué</th><th scope="col">Qué recibe</th></tr>
        </thead>
        <tbody>
          <tr><td>Supabase</td><td>Base de datos, cuentas, fotos y mensajes en vivo</td><td>Todo lo de la sección 2</td></tr>
          <tr><td>Netlify</td><td>Publicar la página</td><td>Dirección IP y navegador al visitarla</td></tr>
          <tr><td>Google Fonts</td><td>Tipografías, <strong>sólo si las aceptas</strong> en el aviso de cookies</td><td>Dirección IP y navegador</td></tr>
          <tr><td>Cloudflare Turnstile</td><td>Comprobar que no eres un robot al entrar, si está activado</td><td>Dirección IP y señales del navegador</td></tr>
          <tr><td>Servicio de avisos de tu navegador (Google, Apple o Mozilla)</td><td>Hacer llegar los avisos al celular, sólo si los activas</td><td>Un aviso cifrado; no pueden leer su contenido</td></tr>
        </tbody>
      </table>
      <p>
        Los enlaces a GitHub, LinkedIn o Instagram y el botón de donación («Invítame un café») del pie de página sólo te
        llevan a esos sitios si los abres; la app no carga nada de ellos. Si donas, esa plataforma trata tus datos con su
        propia política. Si la página tiene música de fondo, el archivo se pide a su servidor sólo cuando pulsas ♪.
      </p>

      <h2>5. Dónde se guardan</h2>
      <p>
        Los servidores de estos proveedores pueden estar fuera de Colombia (por ejemplo en Estados Unidos). Al aceptar
        esta política autorizas esa transferencia internacional, que se hace con proveedores que ofrecen cifrado y
        medidas de seguridad reconocidas.
      </p>

      <h2>6. Cuánto tiempo</h2>
      <p>
        Mientras tu cuenta exista. Si pides borrarla, se eliminan tu cuenta, tu perfil, tus mensajes del chat y tus
        datos de uso. Algunas cosas compartidas que creaste (por ejemplo fotos del álbum o tareas de una lista común)
        pueden quedarse sin tu nombre para no romperle la app a las demás personas; si quieres que también se borren,
        dilo al pedirlo. Las copias de seguridad del proveedor se sobrescriben solas en pocos días.
      </p>

      <h2>7. Tus derechos</h2>
      <p>Según la Ley 1581 de 2012 tienes derecho a:</p>
      <ul>
        <li>Conocer, actualizar y corregir tus datos (casi todo lo puedes hacer tú en <Link to="/cuenta">Mi cuenta</Link>).</li>
        <li>Pedir prueba de que aceptaste esta política.</li>
        <li>Saber cómo se han usado tus datos.</li>
        <li>Retirar tu autorización y pedir que se borren tus datos, cuando no haya un deber legal de conservarlos.</li>
        <li>Acceder a tus datos gratis.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) si no te responden como dice la ley.</li>
      </ul>
      <p>
        Para ejercerlos, escribe <Contact />. Las consultas se responden en máximo 10 días hábiles y los reclamos
        (corregir, borrar o retirar la autorización) en máximo 15 días hábiles, como manda la ley.
      </p>

      <h2>8. Menores de edad</h2>
      <p>
        La app no está pensada para menores de edad. Si una persona menor de 18 años recibe una invitación, necesita
        la autorización de su madre, padre o representante legal antes de crear la cuenta.
      </p>

      <h2>9. Seguridad</h2>
      <p>
        Todo viaja cifrado (HTTPS), las fotos están en almacenamiento privado, cada tabla de la base de datos tiene
        reglas que sólo dejan ver lo que te corresponde y no hay registro público: sólo se entra con invitación.
        Ningún sistema es 100 % seguro; si notas algo raro, avísale al responsable cuanto antes.
      </p>

      <h2>10. Cambios a esta política</h2>
      <p>
        Si cambia algo importante, la fecha de arriba se actualiza y la app te pedirá leer y aceptar la nueva versión
        la próxima vez que entres. También aplican los <Link to={legalPath("terminos")}>términos y condiciones</Link> y
        la <Link to={legalPath("cookies")}>política de cookies</Link>.
      </p>
    </>
  );
}
