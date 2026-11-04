import { openCookiePreferences } from "@/services/consent/cookieConsent";

export function Cookies() {
  return (
    <>
      <h2>Resumo</h2>
      <p>
        O app <strong>não usa cookies</strong> próprios nem de terceiros para publicidade, análise ou rastreamento. Para
        funcionar, seu navegador guarda alguns dados no armazenamento local (<em>localStorage</em>, <em>sessionStorage</em>
        e <em> IndexedDB</em>), que é parecido com um cookie, mas nunca é enviado sozinho a nenhum servidor.
      </p>

      <h2>O que sempre é guardado (necessário)</h2>
      <p>Sem isso o app não funciona ou teria que perguntar a mesma coisa toda vez. Não precisa da sua permissão, mas contamos mesmo assim.</p>
      <table>
        <thead>
          <tr><th scope="col">O quê</th><th scope="col">Para quê</th><th scope="col">Quanto dura</th></tr>
        </thead>
        <tbody>
          <tr><td>Sessão</td><td>Saber que você já entrou. Com «manter a sessão» ela fica guardada; sem isso, é apagada ao fechar a aba.</td><td>Até você sair</td></tr>
          <tr><td>Cópia rápida do conteúdo</td><td>Para a página abrir na hora e funcionar sem conexão. É apagada ao sair.</td><td>Até sair</td></tr>
          <tr><td>Preferências</td><td>Reduzir animações, seu idioma, o tutorial já visto, as surpresas já vistas e sua escolha neste aviso.</td><td>Até você apagar os dados do navegador</td></tr>
          <tr><td>Avisos no celular</td><td>O <em>service worker</em> que recebe os avisos, se você os ativar.</td><td>Até você desativá-los</td></tr>
        </tbody>
      </table>

      <h2>O opcional (com sua permissão)</h2>
      <table>
        <thead>
          <tr><th scope="col">O quê</th><th scope="col">Fornecedor</th><th scope="col">O que acontece se você aceitar</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Tipografias</td>
            <td>Google Fonts (Google LLC)</td>
            <td>Seu navegador baixa as letras dos servidores do Google, que recebem seu endereço IP e seu navegador. Segundo o Google, ele não as usa para criar perfis nem para publicidade. Se você não aceitar, são usadas as letras do seu dispositivo.</td>
          </tr>
        </tbody>
      </table>

      <h2>Serviços de segurança</h2>
      <p>
        Se o administrador ativar a verificação «não sou um robô» (Cloudflare Turnstile), ao entrar é carregado um quadro
        da Cloudflare que pode usar armazenamento próprio só para detectar robôs. É necessário para a segurança das contas e
        não é usado para publicidade.
      </p>

      <h2>Mudar sua escolha</h2>
      <p>
        Você pode mudá-la quando quiser, também em «Preferências de cookies» no rodapé. E sempre pode apagar tudo nas
        configurações do seu navegador.
      </p>
      <p>
        <button type="button" className="btn btn--soft" onClick={openCookiePreferences}>Abrir preferências de cookies</button>
      </p>
    </>
  );
}
