import { Link } from "react-router-dom";
import { legalPath } from "@/domain/legal";

export function Refunds() {
  return (
    <>
      <h2>La app es gratis</h2>
      <p>
        No cobramos nada: ni por crear la cuenta, ni por usarla, ni por guardar fotos o mensajes. No hay planes de pago,
        suscripciones, compras dentro de la app, periodos de prueba que se renueven solos ni cobros «por mantenimiento». Ninguna función depende de
        pagar.
      </p>

      <h2>Sin cobros ocultos</h2>
      <ul>
        <li>La app nunca te pide una tarjeta, una cuenta bancaria ni ningún dato de pago.</li>
        <li>Los permisos del navegador para pagos están desactivados en todas las páginas.</li>
        <li>No mostramos publicidad ni enlaces de afiliados.</li>
      </ul>
      <p>
        Si alguien te pide dinero en nombre de esta app, no somos nosotros: no pagues y avísale al administrador.
      </p>

      <h2>Donaciones voluntarias</h2>
      <p>
        La cabecera y el pie de página pueden tener un botón «Invítame un café». Es un enlace a una plataforma externa (por ejemplo
        Ko-fi): si decides donar, el pago lo hace esa plataforma con sus propios términos y su política de privacidad, y
        la app no recibe tus datos de pago. Donar es completamente opcional, no desbloquea nada y no cambia en nada cómo
        funciona la app. Si quieres que te devuelvan una donación, pídelo por esa plataforma o escríbele al
        administrador.
      </p>

      <h2>Reembolsos</h2>
      <p>
        Como la app no cobra, no hay nada que reembolsar ni derecho de retracto que ejercer (Ley 1480 de 2011). Si algún día
        la app empezara a cobrar algo, antes se publicaría aquí el precio, cómo pagar y cómo pedir un reembolso, y se te
        pediría aceptarlo de forma expresa. Nunca se cobraría sin que lo aceptes.
      </p>
      <p>
        Lo demás está en los <Link to={legalPath("terminos")}>términos y condiciones</Link>.
      </p>
    </>
  );
}
