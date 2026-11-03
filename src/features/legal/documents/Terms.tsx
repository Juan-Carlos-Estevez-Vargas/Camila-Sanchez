import { Link } from "react-router-dom";
import { DATA_CONTROLLER, legalPath } from "@/domain/legal";
import { Contact } from "./Contact";

export function Terms() {
  return (
    <>
      <h2>1. Qué es esta app</h2>
      <p>
        Un rincón privado para una pareja: recuerdos, fechas especiales, notitas, chat y listas compartidas. La hizo y
        la administra <strong>{DATA_CONTROLLER.name}</strong>. Al crear tu cuenta o seguir usándola aceptas estos términos
        y la <Link to={legalPath("privacidad")}>política de privacidad</Link>.
      </p>

      <h2>2. Quién puede usarla</h2>
      <ul>
        <li>No hay registro público: sólo se entra con una cuenta creada por el administrador o con una invitación.</li>
        <li>Debes ser mayor de edad o tener la autorización de tu madre, padre o representante legal.</li>
        <li>Tu cuenta es personal. Cuida tu contraseña y no se la des a nadie.</li>
      </ul>

      <h2>3. Gratis y sin compromisos</h2>
      <p>
        La app es <strong>gratuita</strong>. No hay planes, suscripciones, compras dentro de la app ni periodos de prueba
        que se conviertan en cobros. Más detalle en <Link to={legalPath("reembolsos")}>cobros y reembolsos</Link>.
      </p>

      <h2>4. Lo que subes es tuyo</h2>
      <p>
        Las fotos, mensajes y textos que compartes siguen siendo tuyos. Al subirlos sólo nos das permiso para guardarlos
        y mostrárselos a las personas de la app que pueden verlos, mientras estén en ella. Cuando los borras, dejan de
        mostrarse.
      </p>
      <p>Al subir algo te comprometes a que:</p>
      <ul>
        <li>Tienes derecho a compartirlo (es tuyo o tienes permiso) y, si salen otras personas, ellas están de acuerdo.</li>
        <li>No es ilegal, no acosa ni amenaza a nadie y no muestra a menores de edad de forma inapropiada.</li>
        <li>No contiene virus ni intenta romper o saltarse la seguridad de la app.</li>
      </ul>
      <p>El administrador puede quitar contenido o desactivar cuentas que no cumplan estas reglas.</p>

      <h2>5. El código</h2>
      <p>
        El código de la app es abierto, con <Link to={legalPath("licencias")}>licencia MIT</Link>. Las fotos, los textos
        personales y el diseño de la página de la pareja no están cubiertos por esa licencia.
      </p>

      <h2>6. Disponibilidad</h2>
      <p>
        Es un proyecto personal: hacemos lo posible por que funcione siempre, pero puede haber pausas, errores o cambios.
        Guarda por tu cuenta lo que no quieras perder. En la medida que lo permita la ley, la app se ofrece «tal cual»,
        sin garantías de un servicio comercial.
      </p>

      <h2>7. Cerrar tu cuenta</h2>
      <p>
        Puedes dejar de usarla cuando quieras. Para que borren tu cuenta y tus datos, pídelo <Contact />; se hace sin
        preguntas y sin costo.
      </p>

      <h2>8. Cambios y ley aplicable</h2>
      <p>
        Si estos términos cambian, la app te pedirá aceptarlos otra vez. Se rigen por las leyes de la República de
        Colombia. Ante cualquier duda o desacuerdo, primero conversémoslo <Contact />.
      </p>
    </>
  );
}
