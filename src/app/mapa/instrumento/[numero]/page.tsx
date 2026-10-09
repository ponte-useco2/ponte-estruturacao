import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { numeroValido, urlInstrumento } from "@/lib/oportunidades/busca";
import { podeVerInstrumento } from "@/lib/oportunidades/cliente";
import { lerAcessoFicha } from "@/lib/oportunidades/cliente.server";
import { lerInstrumento } from "@/lib/oportunidades/busca.server";
import { chaveSeguida } from "@/lib/oportunidades/favoritos";
import { lerSeguidas } from "@/lib/oportunidades/favoritos.server";
import { urlBrasil } from "@/lib/oportunidades/pagina-brasil";
import { MARCA_PEDE_CADASTRO, chaveDoAmbiente, linkNoPublico, quemAPaginaAtende } from "@/lib/oportunidades/publico";
import { tituloInstrumento } from "@/lib/oportunidades/titulo-pagina";
import { recorteDaBase } from "@/lib/oportunidades/vazios";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { InstrumentoConteudo } from "./InstrumentoConteudo";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { ConvitePublico } from "../../_componentes/MapaFrame";

/**
 * Onda 7, C (09/10/2026; N01 da auditoria R1, WCAG 2.4.2): o título diz o número ("Convênio nº 912345"). Era o mesmo
 * para todo convênio, e o leitor de tela não anunciava a troca de um para outro. Só o número do endereço, já validado:
 * nada do banco, nada que a página não mostre.
 */
export async function generateMetadata({ params }: { params: Promise<{ numero: string }> }): Promise<Metadata> {
  const { numero } = await params;
  return { title: tituloInstrumento(numero), robots: { index: false, follow: false } };
}

/**
 * Um convênio pelo número — para qualquer usuário aprovado.
 *
 * C4a (09/10/2026): com a chave `MAPA_PUBLICO` ligada, também o público, com nível 0 (D1: a situação do instrumento).
 * Sem conta, sem estrela de seguir (`seguindo` null) e sem o atalho do laudo, que é do administrador e do cliente; o
 * laudo (`/laudo`, debaixo desta rota) fica fora da lista branca.
 */
export default async function InstrumentoPage({ params }: { params: Promise<{ numero: string }> }) {
  const [visitanteOuNao, { numero }] = await Promise.all([visitanteAtual(), params]);
  const acesso = quemAPaginaAtende(visitanteOuNao, chaveDoAmbiente(), `/mapa/instrumento/${encodeURIComponent(numero)}`);
  if (!acesso) return null;
  const visitante = acesso.aprovado;

  if (!numeroValido(numero)) notFound();
  const [leitura, seguidas] = await Promise.all([lerInstrumento(numero), visitante ? lerSeguidas() : null]);
  const buscaDoNumero = `/mapa/busca?q=${encodeURIComponent(numero)}`;
  // C4a: a busca pede cadastro; no nível 0 o link diz "(pede cadastro)" e leva à entrada.
  const buscar = linkNoPublico(buscaDoNumero, !visitante);

  if (leitura.estado === "nao_encontrado") {
    return (
      <div className="pa-pagina pa-pagina-estreita">
        <div className="pa-pilha">
          <p className="pa-kicker">Convênio nº {numero}</p>
          <h1 className="pa-titulo">Este convênio não está na busca</h1>
          {/* B12b: o recorte vem de `recorteDaBase`, o mesmo do laudo e dos investimentos (antes faltava a tomada de contas especial). */}
          <p>A busca traz {recorteDaBase(null).convenios}. Confira o número ou procure pelo programa.</p>
          <p className="pa-nota">
            <LinkMapa href={buscar.href}>
              Buscar por “{numero}”{buscar.pedeCadastro && ` ${MARCA_PEDE_CADASTRO}`}
            </LinkMapa>
          </p>
        </div>
      </div>
    );
  }
  if (leitura.estado !== "ok") {
    // B12b: sem a leitura não se sabe o município nem a entidade (o nível acima na trilha); a volta é a busca pelo número.
    // C4a: no nível 0, a volta é o topo do território, que não pede cadastro.
    return (
      <DadoIndisponivel
        kicker={`Convênio nº ${numero}`}
        titulo="O convênio está indisponível agora"
        endereco={urlInstrumento(numero)}
        voltarPara={visitante ? { rotulo: `Buscar “${numero}”`, href: buscaDoNumero } : { rotulo: "Abrir a página do Brasil", href: urlBrasil() }}
        publico={!visitante}
      />
    );
  }
  const i = leitura.instrumento;
  // O laudo nomeia servidores e interpreta o andamento: o administrador vê o atalho em todo instrumento.
  // Desde a onda 12, parte 3, a prefeitura também, nos instrumentos do próprio município (a página do
  // laudo confere de novo no servidor e mostra a versão do cliente).
  if (!visitante) {
    return (
      <>
        {acesso.sessao && (
          <ConvitePublico sessao={acesso.sessao} caminho={urlInstrumento(numero)} acao="seguir este convênio e ser avisado quando ele mudar" />
        )}
        <InstrumentoConteudo leitura={leitura} seguindo={null} laudo={false} publico />
      </>
    );
  }
  const admin = ehAdministrador(visitante.email);
  const laudo = admin || (i.tipo_agente === "municipio" && podeVerInstrumento((await lerAcessoFicha(visitante)).acesso, i).ok);
  return (
    <InstrumentoConteudo
      leitura={leitura}
      seguindo={seguidas ? seguidas.has(chaveSeguida("instrumento", i.nr_convenio)) : null}
      laudo={laudo}
    />
  );
}
