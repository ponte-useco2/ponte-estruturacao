import type { Metadata } from "next";
import { after } from "next/server";
import { lerCatalogo } from "@/lib/oportunidades/catalogo.server";
import { formatarPublicacao } from "@/lib/oportunidades/central";
import {
  LIMITE_SEGUIDOS,
  ROTULO_TIPO_ITEM,
  chaveSeguida,
  fraseDoAviso,
  urlDoItem,
  type TipoItem,
} from "@/lib/oportunidades/favoritos";
import { contarAvisosItensNaoLidos, lerItensSeguidos, lerNormas } from "@/lib/oportunidades/favoritos.server";
import {
  contarNaoLidas,
  lerCentral,
  lerPreferencias,
  lerTentativasFalhas,
  registrarVisita,
} from "@/lib/oportunidades/notificacoes.server";
import { opcoesDePreferencia } from "@/lib/oportunidades/opcoes";
import { sincronizarCentral } from "@/lib/oportunidades/sincronizar.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { MapaClient } from "./MapaClient";
import { MeusItensClient, type AvisoVista, type SeguidoVista } from "./MeusItensClient";
import { MuralAbas, muralDe } from "./MuralAbas";
import { NormasConteudo } from "./NormasConteudo";

export const metadata: Metadata = {
  title: "Avisos · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * O portão de acesso que decide a RESPOSTA vem do layout do segmento. A página
 * lê — e decide o que a tela pode afirmar.
 */
export default async function MapaDeOportunidadesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // No App Router, layout e página renderizam em PARALELO: o redirect do layout
  // decide o que volta ao navegador, mas não impede esta função de rodar. Sem
  // esta checagem, uma visita anônima lia a central vazia pela RLS, concluía que
  // havia publicação pendente e disparava a sincronização com a chave de serviço.
  // Achado ao verificar o build no navegador, em 11/09/2026.
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  // Onda 7: o mural tem três partes. O catálogo continua sendo a de entrada.
  const mural = muralDe((await searchParams).mural);
  if (mural === "itens") return <MuralItens />;
  if (mural === "normas") return <MuralNormas />;

  // `registrarVisita` devolve a marca ANTERIOR e só então carimba a de agora: é a
  // anterior que posiciona a divisória na lista.
  const [catalogo, central, preferencias, visitaAnterior, tentativas, naoLidasItens] = await Promise.all([
    lerCatalogo(),
    lerCentral(),
    lerPreferencias(),
    registrarVisita(visitante.id),
    lerTentativasFalhas(),
    contarAvisosItensNaoLidos(),
  ]);

  // Publicação nova no disco que a central ainda não processou. Sincroniza DEPOIS
  // de responder, para não prender quem abriu a aba — e a tela avisa que há
  // processamento pendente, em vez de fingir que está em dia.
  const pendente =
    central.status === "ok" &&
    catalogo !== null &&
    (central.ultimaProcessada === null || catalogo.gerado_em > central.ultimaProcessada);

  if (pendente) {
    after(async () => {
      await sincronizarCentral("aba");
    });
  }

  // O universo do catálogo: quantas janelas existem, quantas fecham na semana e
  // quantas não têm tema. Sem isso a tela não consegue dizer que as janelas
  // continuam lá quando a fila de avisos está vazia.
  const agora = new Date();
  const ate = new Date(agora.getTime());
  ate.setUTCDate(ate.getUTCDate() + 7);
  const ateIso = ate.toISOString().slice(0, 10);
  const resumoCatalogo = catalogo
    ? {
        total: catalogo.oportunidades.length,
        fecham7: catalogo.oportunidades.filter((o) => o.fecha <= ateIso).length,
        ate: ateIso,
        semTema: catalogo.oportunidades.filter((o) => (o.temas ?? []).length === 0).length,
      }
    : null;

  // O instante vem do servidor: calcular frescor com o relógio do navegador faria
  // servidor e cliente discordarem na hidratação, e o relógio do cliente é o menos
  // confiável dos dois.
  // As opções vêm do catálogo de hoje: oferecer órgão que não está em janela
  // nenhuma é prometer um destaque que nunca apareceria.
  return (
    <>
      <MuralAbas atual="catalogo" naoLidas={{ itens: naoLidasItens }} />
      <MapaClient
        central={central}
        pendente={pendente}
        agoraIso={agora.toISOString()}
        resumoCatalogo={resumoCatalogo}
        visitaAnterior={visitaAnterior}
        tentativas={tentativas}
        preferencias={preferencias}
        opcoes={opcoesDePreferencia(catalogo?.oportunidades ?? [])}
      />
    </>
  );
}

/** Os avisos dos itens seguidos, com as frases montadas aqui no servidor. */
async function MuralItens() {
  const [leitura, naoLidasCatalogo] = await Promise.all([lerItensSeguidos(), contarNaoLidas()]);
  if (leitura.estado !== "ok") {
    return (
      <>
        <MuralAbas atual="itens" naoLidas={{ catalogo: naoLidasCatalogo }} />
        <div className="pa-pagina pa-pagina-estreita">
          <p className="pa-cartao pa-cartao-plano">
            {leitura.estado === "nao_ativado"
              ? "Seguir itens ainda não foi ativado."
              : "Não foi possível ler os seus itens agora. Tente de novo em alguns minutos."}
          </p>
        </div>
      </>
    );
  }

  const titulos = new Map(leitura.seguidos.map((s) => [chaveSeguida(s.tipo, s.chave), s.titulo]));
  const nomeDoItem = (tipo: TipoItem, chave: string, titulo: string | null) =>
    titulo ?? titulos.get(chaveSeguida(tipo, chave)) ?? `${ROTULO_TIPO_ITEM[tipo]} ${chave}`;

  const avisos: AvisoVista[] = leitura.avisos.map((a) => ({
    id: a.id,
    tipoRotulo: tipo(a.tipo, a.chave),
    titulo: nomeDoItem(a.tipo, a.chave, a.titulo),
    url: urlDoItem(a.tipo, a.chave),
    ...fraseDoAviso(a),
    quando: formatarPublicacao(a.criado_em),
    lida_em: a.lida_em,
    arquivada_em: a.arquivada_em,
  }));
  const seguidos: SeguidoVista[] = leitura.seguidos.map((s) => ({
    tipo: s.tipo,
    chave: s.chave,
    tipoRotulo: tipo(s.tipo, s.chave),
    titulo: nomeDoItem(s.tipo, s.chave, s.titulo),
    url: urlDoItem(s.tipo, s.chave),
    ausente: s.ausente,
  }));
  const naoLidasItens = avisos.filter((a) => !a.lida_em && !a.arquivada_em).length;

  return (
    <>
      <MuralAbas atual="itens" naoLidas={{ catalogo: naoLidasCatalogo, itens: naoLidasItens }} />
      <MeusItensClient avisos={avisos} seguidos={seguidos} truncada={leitura.truncada} limite={LIMITE_SEGUIDOS} />
    </>
  );
}

/**
 * "Convênio nº 956541": o número do convênio vai no rótulo, porque o título é o objeto.
 * A proposta fica sem número: a chave é o id do SICONV, que não é o "nº 34797/2026" da página.
 */
function tipo(t: TipoItem, chave: string): string {
  return t === "instrumento" ? `${ROTULO_TIPO_ITEM.instrumento} nº ${chave}` : ROTULO_TIPO_ITEM[t];
}

async function MuralNormas() {
  const [leitura, naoLidasCatalogo, naoLidasItens] = await Promise.all([lerNormas(), contarNaoLidas(), contarAvisosItensNaoLidos()]);
  return (
    <>
      <MuralAbas atual="normas" naoLidas={{ catalogo: naoLidasCatalogo, itens: naoLidasItens }} />
      <NormasConteudo leitura={leitura} />
    </>
  );
}
