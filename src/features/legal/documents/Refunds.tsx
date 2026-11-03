import { Link } from "react-router-dom";
import { legalPath } from "@/domain/legal";

export function Refunds() {
  return (
    <>
      <h2>La app es gratis</h2>
      <p>
        No cobramos nada: ni por crear la cuenta, ni por usarla, ni por guardar fotos o mensajes. No hay planes de pago,
        suscripciones, compras dentro de la app, periodos de prueba que se renueven solos, propinas ni cobros «por
        mantenimiento».
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

      <h2>Reembolsos</h2>
      <p>
        Como no hay pagos, no hay nada que reembolsar ni derecho de retracto que ejercer (Ley 1480 de 2011). Si algún día
        la app empezara a cobrar algo, antes se publicaría aquí el precio, cómo pagar y cómo pedir un reembolso, y se te
        pediría aceptarlo de forma expresa. Nunca se cobraría sin que lo aceptes.
      </p>
      <p>
        Lo demás está en los <Link to={legalPath("terminos")}>términos y condiciones</Link>.
      </p>
    </>
  );
}
