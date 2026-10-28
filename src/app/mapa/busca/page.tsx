import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { LIMITE_POR_PAGINA, PAGINA_MAXIMA, parametrosBusca, urlBusca } from "@/lib/oportunidades/busca";
import { estadoDaBusca, tetoDePaginas } from "@/lib/oportunidades/busca-tabelas";
import { parametrosDaPagina } from "@/lib/oportunidades/painel-tabelas";
import { lerBusca, lerBuscaUnificada } from "@/lib/oportunidades/busca.server";
import { classificarEntrada, pedeDireto } from "@/lib/oportunidades/busca-unificada";
import { lerSeguidas } from "@/lib/oportunidades/favoritos.server";
import { registrarUso } from "@/lib/oportunidades/uso.server";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { BuscaConteudo, DadoIndisponivel } from "./BuscaConteudo";
import { BuscaUnificada } from "./BuscaUnificada";

export const metadata: Metadata = {
  title: "Busca · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * Busca do Mapa — para qualquer usuário aprovado.
 *
 * O portão de login e aprovação é do layout de `/mapa`; a página repete a checagem porque
 * layout e página renderizam em paralelo. Formulário GET: funciona sem JavaScript e cada
 * busca tem URL própria para ser mandada a alguém.
 *
 * C2 (08/10/2026): sem `aba`, a busca unificada (os cinco tipos num campo só); com `aba`, as listas de antes.
 * Entrada exata vai direto à página — o CNPJ válido à entidade, o número ao convênio — só quando veio do formulário
 * da unificada (`direto=1`) e a página existe na base. Os links de outras páginas para a busca nunca redirecionam: a
 * entidade indisponível oferece "Procurar o CNPJ na busca", e redirecionar de volta faria um vai e vem.
 */
export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const sp = await searchParams;
  const p = parametrosBusca(sp);

  if (p.aba === "tudo") {
    const entrada = classificarEntrada(p.q);
    const leitura = await lerBuscaUnificada(p, entrada, pedeDireto(sp));
    // C2: o registro guarda o tipo da entrada (texto, CNPJ, número), a UF e se foi direto; nunca o termo digitado.
    if (entrada.tipo !== "vazia") {
      after(() => registrarUso(visitante, "mapa_busca", { entrada: entrada.tipo, uf: p.uf ?? "PB", direto: leitura.estado === "direto" }));
    }
    if (leitura.estado === "direto") redirect(leitura.destino);
    if (leitura.estado !== "ok") {
      return <DadoIndisponivel kicker="Busca" titulo="A busca está indisponível agora" endereco={urlBusca(p, {})} />;
    }
    return <BuscaUnificada p={p} entrada={entrada} leitura={leitura} />;
  }

  // F3.5b (28/10/2026): o filtro e a ordem da tabela vão ao banco; quem não administra percorre até 34 páginas (a busca
  // é a porta da raspagem), e a página pedida além do teto vira a última permitida.
  const estado = estadoDaBusca(p.aba, parametrosDaPagina(sp));
  const teto = tetoDePaginas(LIMITE_POR_PAGINA, ehAdministrador(visitante.email), PAGINA_MAXIMA);
  const naPagina = { ...p, pagina: Math.min(p.pagina, teto) };
  const [leitura, seguidas] = await Promise.all([lerBusca(naPagina, estado), lerSeguidas()]);
  // "Tentar de novo" refaz a mesma busca, na mesma página (B12).
  if (leitura.estado !== "ok") {
    return <DadoIndisponivel kicker="Busca" titulo="A busca está indisponível agora" endereco={urlBusca(naPagina, { pagina: naPagina.pagina })} />;
  }
  return <BuscaConteudo p={naPagina} leitura={leitura} seguidas={seguidas} estado={estado} tetoPaginas={teto} />;
}
