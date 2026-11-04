import { AUTHOR } from "@/core/author";
import { FONTS, LIBRARIES } from "../Licenses";

export function Licenses() {
  return (
    <>
      <h2>O código do app</h2>
      <p>
        Foi escrito por {AUTHOR.name} e é aberto, com <a href={`${AUTHOR.repository}/blob/master/LICENSE`} target="_blank" rel="noopener noreferrer">licença MIT</a>.
        Você pode ver o <a href={AUTHOR.repository} target="_blank" rel="noopener noreferrer">repositório no GitHub</a>.
      </p>

      <h2>Fotos e textos</h2>
      <p>
        As fotos da página, os textos pessoais e as capturas de tela são do casal e de quem as envia. <strong>Não</strong> estão
        sob a licença MIT e não podem ser copiadas nem reutilizadas sem permissão. Cada pessoa que envia uma foto declara
        que tem direito de fazê-lo e a permissão de quem aparece nela. O app não usa fotos de bancos de imagens.
      </p>

      <h2>Ícones, figurinhas e desenhos</h2>
      <p>
        O coração do ícone e as figurinhas do chat foram desenhados para este app (SVGs próprios, mesma licença do código).
        Os emojis são desenhados pelo seu dispositivo com a própria fonte de emojis (Apple, Google, Microsoft…), por isso não
        são distribuídos com o app.
      </p>

      <h2>Tipografias</h2>
      <p>
        {FONTS.join(", ")}: todas com a <a href="https://openfontlicense.org" target="_blank" rel="noopener noreferrer">SIL Open Font License 1.1</a>,
        servidas pelo Google Fonts só se você as aceitar no aviso de cookies.
      </p>

      <h2>Bibliotecas</h2>
      <table>
        <thead><tr><th scope="col">Biblioteca</th><th scope="col">Licença</th></tr></thead>
        <tbody>
          {LIBRARIES.map((lib) => (
            <tr key={lib.name}>
              <td><a href={lib.url} target="_blank" rel="noopener noreferrer">{lib.name}</a></td>
              <td>{lib.license}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Junto com suas dependências (todas MIT, ISC, Apache 2.0 ou 0BSD). Um teste automático verifica que nenhuma
        dependência do app tenha uma licença que não permita este uso.
      </p>

      <h2>Música</h2>
      <p>
        Se a página tiver música de fundo, é um link configurado pelo administrador. Quem o coloca se responsabiliza por ter
        permissão para usar essa música.
      </p>
    </>
  );
}
