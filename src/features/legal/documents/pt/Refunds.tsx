import { Link } from "react-router-dom";
import { legalPath } from "@/domain/legal";

export function Refunds() {
  return (
    <>
      <h2>O app é grátis</h2>
      <p>
        Não cobramos nada: nem para criar a conta, nem para usá-la, nem para guardar fotos ou mensagens. Não há planos
        pagos, assinaturas, compras dentro do app, períodos de teste que se renovam sozinhos, gorjetas nem cobranças «de
        manutenção».
      </p>

      <h2>Sem cobranças ocultas</h2>
      <ul>
        <li>O app nunca pede cartão, conta bancária nem nenhum dado de pagamento.</li>
        <li>As permissões de pagamento do navegador estão desativadas em todas as páginas.</li>
        <li>Não mostramos publicidade nem links de afiliados.</li>
      </ul>
      <p>
        Se alguém pedir dinheiro em nome deste app, não somos nós: não pague e avise o administrador.
      </p>

      <h2>Reembolsos</h2>
      <p>
        Como não há pagamentos, não há nada para reembolsar nem direito de arrependimento a exercer (Lei colombiana 1480 de
        2011). Se um dia o app começasse a cobrar algo, antes seriam publicados aqui o preço, como pagar e como pedir um
        reembolso, e você teria que aceitar de forma expressa. Nunca seria cobrado sem que você aceite.
      </p>
      <p>
        O resto está nos <Link to={legalPath("terminos")}>termos e condições</Link>.
      </p>
    </>
  );
}
