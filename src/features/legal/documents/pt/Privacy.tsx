import { Link } from "react-router-dom";
import { DATA_CONTROLLER, legalPath } from "@/domain/legal";
import { Contact } from "../Contact";

/** Política de tratamento de dados pessoais (Lei colombiana 1581 de 2012, Decreto 1074 de 2015). */
export function Privacy() {
  return (
    <>
      <h2>1. Quem cuida dos seus dados</h2>
      <p>
        O responsável pelo tratamento é <strong>{DATA_CONTROLLER.name}</strong>, pessoa física na {DATA_CONTROLLER.country}.
        Você pode entrar em contato <Contact />.
      </p>
      <p>
        Este é um app privado e gratuito, feito para um casal e para as poucas pessoas que eles convidam. Não é um
        serviço comercial, não tem publicidade e não vende nem aluga dados para ninguém.
      </p>

      <h2>2. Quais dados guardamos</h2>
      <p>Só o necessário para o app funcionar. Nenhum é obrigatório, exceto os da sua conta.</p>
      <table>
        <thead>
          <tr><th scope="col">Tipo</th><th scope="col">O que inclui</th><th scope="col">De onde vem</th></tr>
        </thead>
        <tbody>
          <tr><td>Conta</td><td>E-mail, nome e função. A senha é guardada cifrada (com hash): ninguém, nem mesmo o administrador, pode lê-la.</td><td>Você, ao criar a conta</td></tr>
          <tr><td>Perfil (opcional)</td><td>Foto ou ícone, uma frase, seu aniversário e suas cores.</td><td>Você, em Minha conta</td></tr>
          <tr><td>O que você compartilha</td><td>Fotos e suas descrições, bilhetinhos, mensagens, fotos e figurinhas do chat, reações, listas, tarefas, datas e surpresas.</td><td>Você, ao usar o app</td></tr>
          <tr><td>Uso do app</td><td>Sua última conexão, quais mensagens você já leu («visto»), quando você abriu uma dedicatória (só quem a escreveu vê) e um registro de alterações (quem mudou o quê e quando) para investigar erros ou abusos.</td><td>O app, enquanto você o usa</td></tr>
          <tr><td>Dados técnicos</td><td>Se você ativar os avisos no celular: o endereço do serviço de avisos do seu navegador e o tipo de navegador. Os servidores guardam por pouco tempo registros com o endereço IP, por segurança.</td><td>Seu navegador</td></tr>
        </tbody>
      </table>
      <p>
        As fotos são otimizadas no seu próprio dispositivo antes do envio e os metadados da câmera, como a localização GPS,
        são removidos. <strong>Não pedimos dados sensíveis</strong> (saúde, religião, opinião política, dados biométricos…):
        por favor, não os envie. Se enviar uma foto em que aparecem outras pessoas, faça isso só com a permissão delas.
      </p>

      <h2>3. Para que os usamos</h2>
      <ul>
        <li>Para você entrar, ver a página, escrever no chat, compartilhar listas e receber avisos.</li>
        <li>Para mostrar às pessoas com quem você conversa seu nome, sua foto e se você já leu as mensagens delas.</li>
        <li>Para proteger o app: barrar tentativas de entrar à força, investigar erros e manter cópias de segurança.</li>
      </ul>
      <p>
        <strong>Não</strong> usamos seus dados para publicidade, não montamos perfis de comportamento, não os vendemos e
        não os usamos para treinar inteligência artificial.
      </p>

      <h2>4. Com quem são compartilhados</h2>
      <p>
        Ninguém fora das pessoas do app vê seus dados, de acordo com as permissões de cada uma. Para funcionar, o app usa
        estes fornecedores, que atuam como <em>operadores</em> e só os processam para prestar o seu serviço:
      </p>
      <table>
        <thead>
          <tr><th scope="col">Fornecedor</th><th scope="col">Para quê</th><th scope="col">O que recebe</th></tr>
        </thead>
        <tbody>
          <tr><td>Supabase</td><td>Banco de dados, contas, fotos e mensagens ao vivo</td><td>Tudo o que está na seção 2</td></tr>
          <tr><td>Netlify</td><td>Publicar a página</td><td>Endereço IP e navegador ao visitá-la</td></tr>
          <tr><td>Google Fonts</td><td>Tipografias, <strong>só se você aceitar</strong> no aviso de cookies</td><td>Endereço IP e navegador</td></tr>
          <tr><td>Cloudflare Turnstile</td><td>Verificar que você não é um robô ao entrar, se estiver ativado</td><td>Endereço IP e sinais do navegador</td></tr>
          <tr><td>Serviço de avisos do seu navegador (Google, Apple ou Mozilla)</td><td>Fazer os avisos chegarem ao celular, só se você os ativar</td><td>Um aviso cifrado; não conseguem ler o conteúdo</td></tr>
        </tbody>
      </table>
      <p>
        Os links para GitHub, LinkedIn ou Instagram e o botão de doação («Me pague um café») no rodapé só levam a esses
        sites se você os abrir; o app não carrega nada deles. Se você doar, essa plataforma trata seus dados com a própria
        política. Se a página tiver música de fundo, o arquivo é pedido ao servidor dela só quando você toca em ♪.
      </p>

      <h2>5. Onde são guardados</h2>
      <p>
        Os servidores desses fornecedores podem estar fora da Colômbia (por exemplo, nos Estados Unidos). Ao aceitar esta
        política, você autoriza essa transferência internacional, feita com fornecedores que oferecem criptografia e
        medidas de segurança reconhecidas.
      </p>

      <h2>6. Por quanto tempo</h2>
      <p>
        Enquanto sua conta existir. Se você pedir para apagá-la, são removidos sua conta, seu perfil, suas mensagens do chat
        e seus dados de uso. Algumas coisas compartilhadas que você criou (por exemplo, fotos do álbum ou tarefas de uma
        lista comum) podem ficar sem o seu nome para não quebrar o app para as outras pessoas; se quiser que também sejam
        apagadas, diga ao pedir. As cópias de segurança do fornecedor se sobrescrevem sozinhas em poucos dias.
      </p>

      <h2>7. Seus direitos</h2>
      <p>De acordo com a Lei colombiana 1581 de 2012, você tem direito a:</p>
      <ul>
        <li>Conhecer, atualizar e corrigir seus dados (quase tudo você mesmo pode fazer em <Link to="/cuenta">Minha conta</Link>).</li>
        <li>Pedir prova de que aceitou esta política.</li>
        <li>Saber como seus dados foram usados.</li>
        <li>Revogar sua autorização e pedir que seus dados sejam apagados, quando não houver dever legal de conservá-los.</li>
        <li>Acessar seus dados gratuitamente.</li>
        <li>Apresentar reclamações à Superintendência de Indústria e Comércio (SIC) se não for respondido como manda a lei.</li>
      </ul>
      <p>
        Para exercê-los, escreva <Contact />. As consultas são respondidas em no máximo 10 dias úteis e as reclamações
        (corrigir, apagar ou revogar a autorização) em no máximo 15 dias úteis, como manda a lei.
      </p>

      <h2>8. Menores de idade</h2>
      <p>
        O app não é pensado para menores de idade. Se uma pessoa menor de 18 anos receber um convite, precisa da
        autorização da mãe, do pai ou do representante legal antes de criar a conta.
      </p>

      <h2>9. Segurança</h2>
      <p>
        Tudo trafega cifrado (HTTPS), as fotos ficam em armazenamento privado, cada tabela do banco de dados tem regras que
        só deixam ver o que é seu e não há cadastro público: só se entra com convite. Nenhum sistema é 100% seguro; se notar
        algo estranho, avise o responsável o quanto antes.
      </p>

      <h2>10. Mudanças nesta política</h2>
      <p>
        Se algo importante mudar, a data acima é atualizada e o app vai pedir que você leia e aceite a nova versão na
        próxima vez que entrar. Também se aplicam os <Link to={legalPath("terminos")}>termos e condições</Link> e
        a <Link to={legalPath("cookies")}>política de cookies</Link>.
      </p>
    </>
  );
}
