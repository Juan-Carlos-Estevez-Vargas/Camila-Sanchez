import { Link } from "react-router-dom";
import { legalPath } from "@/domain/legal";

export function Refunds() {
  return (
    <>
      <h2>O app é grátis</h2>
      <p>
        Não cobramos nada: nem para criar a conta, nem para usá-la, nem para guardar fotos ou mensagens. Não há planos
        pagos, assinaturas, compras dentro do app, períodos de teste que se renovam sozinhos nem cobranças «de manutenção».
        Nenhuma função depende de pagar.
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

      <h2>Doações voluntárias</h2>
      <p>
        O cabeçalho e o rodapé podem ter um botão «Me pague um café». É um link para uma plataforma externa (por exemplo
        Ko-fi): se você decidir doar, o pagamento é feito por essa plataforma com os próprios termos e a própria política de
        privacidade, e o app não recebe seus dados de pagamento. Doar é totalmente opcional, não desbloqueia nada e não muda
        em nada o funcionamento do app. Se quiser o reembolso de uma doação, peça por essa plataforma ou escreva ao
        administrador.
      </p>

      <h2>Reembolsos</h2>
      <p>
        Como o app não cobra, não há nada para reembolsar nem direito de arrependimento a exercer (Lei colombiana 1480 de
        2011). Se um dia o app começasse a cobrar algo, antes seriam publicados aqui o preço, como pagar e como pedir um
        reembolso, e você teria que aceitar de forma expressa. Nunca seria cobrado sem que você aceite.
      </p>
      <p>
        O resto está nos <Link to={legalPath("terminos")}>termos e condições</Link>.
      </p>
    </>
  );
}
