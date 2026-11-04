import { Link } from "react-router-dom";
import { DATA_CONTROLLER, legalPath } from "@/domain/legal";
import { Contact } from "../Contact";

export function Terms() {
  return (
    <>
      <h2>1. O que é este app</h2>
      <p>
        Um cantinho privado para um casal: lembranças, datas especiais, bilhetinhos, chat e listas compartilhadas. Quem o
        fez e o administra é <strong>{DATA_CONTROLLER.name}</strong>. Ao criar sua conta ou continuar usando-a, você aceita
        estes termos e a <Link to={legalPath("privacidad")}>política de privacidade</Link>.
      </p>

      <h2>2. Quem pode usá-lo</h2>
      <ul>
        <li>Não há cadastro público: só se entra com uma conta criada pelo administrador ou com um convite.</li>
        <li>Você deve ser maior de idade ou ter a autorização da mãe, do pai ou do representante legal.</li>
        <li>Sua conta é pessoal. Cuide da sua senha e não a passe para ninguém.</li>
      </ul>

      <h2>3. Grátis e sem compromisso</h2>
      <p>
        O app é <strong>gratuito</strong>. Não há planos, assinaturas, compras dentro do app nem períodos de teste que virem
        cobranças. Mais detalhes em <Link to={legalPath("reembolsos")}>cobranças e reembolsos</Link>.
      </p>

      <h2>4. O que você envia é seu</h2>
      <p>
        As fotos, mensagens e textos que você compartilha continuam sendo seus. Ao enviá-los, você só nos dá permissão para
        guardá-los e mostrá-los às pessoas do app que podem vê-los, enquanto estiverem nele. Quando você os apaga, deixam
        de ser mostrados.
      </p>
      <p>Ao enviar algo, você se compromete a que:</p>
      <ul>
        <li>Tem direito de compartilhá-lo (é seu ou tem permissão) e, se aparecem outras pessoas, elas estão de acordo.</li>
        <li>Não é ilegal, não assedia nem ameaça ninguém e não mostra menores de idade de forma inadequada.</li>
        <li>Não contém vírus nem tenta quebrar ou contornar a segurança do app.</li>
      </ul>
      <p>O administrador pode remover conteúdo ou desativar contas que não cumpram estas regras.</p>

      <h2>5. O código</h2>
      <p>
        O código do app é aberto, com <Link to={legalPath("licencias")}>licença MIT</Link>. As fotos, os textos pessoais e
        o design da página do casal não estão cobertos por essa licença.
      </p>

      <h2>6. Disponibilidade</h2>
      <p>
        É um projeto pessoal: fazemos o possível para que funcione sempre, mas pode haver pausas, erros ou mudanças. Guarde
        por conta própria o que não quiser perder. Na medida em que a lei permitir, o app é oferecido «no estado em que se
        encontra», sem as garantias de um serviço comercial.
      </p>

      <h2>7. Encerrar sua conta</h2>
      <p>
        Você pode deixar de usá-lo quando quiser. Para que sua conta e seus dados sejam apagados, peça <Contact />; é feito
        sem perguntas e sem custo.
      </p>

      <h2>8. Mudanças e lei aplicável</h2>
      <p>
        Se estes termos mudarem, o app vai pedir que você os aceite de novo. Eles se regem pelas leis da República da
        Colômbia. Diante de qualquer dúvida ou desacordo, primeiro vamos conversar <Contact />.
      </p>
    </>
  );
}
