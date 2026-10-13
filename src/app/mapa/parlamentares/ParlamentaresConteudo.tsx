/**
 * A lista dos autores de emendas com recurso para a Paraíba (onda 14, parte 2, B, 13/10/2026). Recebe a leitura pronta
 * (`lerParlamentares`, em `emendas.server.ts`); aqui só se apresenta.
 *
 * O desenho é o do estudo da onda 13 (B, seção 7.1), com as decisões do titular:
 *   · a ordem padrão é por grupo, tipo e nome; não há posição, medalha, nota única nem cor de "bom" ou "ruim";
 *   · as colunas são dos canais (convênio, Pix, saúde fundo a fundo e pago ao favorecido), com o válido e o pago, mais os
 *     municípios atendidos ("n de 223"), os caducados e a fila; não há coluna de "% executado", que fora da safra engana;
 *   · os 383 autores ficam em quatro grupos (`grupoDeDestino`): os com destino público na PB primeiro, os que só pagaram
 *     entidade com sede aqui à parte. A lista não traz o destino linha a linha, então a separação usa as colunas de
 *     `emd_autores`; a ficha de cada autor separa com `separarDestino`, e a nota de cada grupo diz a regra;
 *   · a data do dado (o arquivo do Portal), as propostas do FNS ainda sem detalhe e a nota de método sempre à vista.
 *
 * Onda 15, A (13/10/2026): a regra do titular de filtro e ordem em cada coluna. As quatro tabelas, uma por grupo,
 * viraram uma tabela só (`TabelaFiltravel`), com a coluna "Grupo" como categoria. Por quê:
 *   · achar um autor pelo nome é o uso mais comum, e com quatro tabelas era preciso procurar em quatro lugares, com
 *     quatro painéis de filtro e quatro CSV; agora é uma busca, um filtro de tipo e um CSV com os 383 e o grupo de cada;
 *   · a ordem padrão (grupo, tipo e nome) é a de antes: os do destino público continuam no alto, e os cartões e a regra
 *     de cada grupo continuam à vista;
 *   · o válido e o pago de cada canal viraram duas colunas, e os caducados, quantidade e valor: cada número filtra,
 *     ordena e vai ao CSV. O catálogo com a PB só tem valor no grupo "sem canal", como era na tabela dele.
 * É tela de administrador: toda coluna ordena. O `?tipo=` antigo redireciona para o filtro da coluna "Tipo".
 *
 * Parlamentar, bancada e comissão são agentes públicos: o nome é o publicado para o código. Nenhum nome de pessoa
 * física e nenhum nome de entidade nesta tela.
 */
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ROTULO_CANAL, type AutorEmendas, type ExecucaoEmendas, type TipoAutor } from "@/lib/oportunidades/emendas";
import {
  COLUNAS_PARLAMENTARES,
  GRUPOS_DESTINO,
  ROTULO_CURTO_GRUPO,
  TABELA_PARLAMENTARES,
  autoresNaOrdemPadrao,
  grupoDeDestino,
  municipiosDe223,
  nomeDoAutor,
  urlParlamentar,
  urlParlamentares,
  valoresDoAutor,
  type GrupoDestino,
} from "@/lib/oportunidades/parlamentares-tela";
import type { LinhaTabela, ValorCelula } from "@/lib/oportunidades/tabela-filtro";
import { Tag } from "../../_design/primitivos";
import { LinkMapa } from "../_componentes/LinkMapa";
import { TabelaFiltravel } from "../_componentes/TabelaFiltravel";
import { CarimboDoDado, CartaoNumero, NotaDeMetodo, dinheiro, n } from "./PecasParlamentares";

const AVISO =
  "Uso interno da PONTE, só administrador até a revisão jurídica. Parlamentar, bancada e comissão são agentes públicos, com o nome " +
  "como o Portal publica para o código. Nenhuma pessoa física aparece. Os números de execução dependem também do município, da " +
  "entidade e do órgão.";

/** As colunas em reais: a célula mostra o valor curto ("R$ 1,2 mi"); o CSV leva o valor inteiro. */
const COLUNAS_EM_REAIS = [
  "convenio-valido",
  "convenio-pago",
  "pix-valido",
  "pix-pago",
  "fns-valido",
  "fns-pago",
  "favorecido-pago",
  "caducado-valor",
  "catalogo-empenhado",
  "catalogo-pago",
] as const;

export function ParlamentaresConteudo({ execucao, autores, tipo }: { execucao: ExecucaoEmendas; autores: AutorEmendas[]; tipo: TipoAutor | null }) {
  // O endereço de antes (`?tipo=comissao`) vira o filtro da coluna "Tipo" (`?t.parl.tipo=Comiss%C3%A3o`): o link guardado
  // continua abrindo a lista filtrada, e o filtro passa a morar num lugar só.
  if (tipo) redirect(urlParlamentares(tipo));

  const ordenados = autoresNaOrdemPadrao(autores);
  const coletivos = autores.filter((a) => a.coletivo).length;
  const porGrupo: Record<GrupoDestino, number> = { publico: 0, convenio_sem_municipio: 0, entidade: 0, sem_canal: 0 };
  for (const a of autores) porGrupo[grupoDeDestino(a)] += 1;
  const linhas: LinhaTabela[] = ordenados.map((a) => {
    const valores = valoresDoAutor(a);
    return { chave: a.codigo, valores, celulas: celulasDoAutor(a, valores) };
  });

  return (
    <div className="pa-pagina mp-radar mp-parl">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Painel · parlamentares</p>
        <h1 className="pa-titulo">Autores de emendas com recurso para a Paraíba</h1>
        <p className="pa-sub">
          {n(autores.length)} autores ({n(coletivos)} de autoria coletiva), por grupo, tipo e nome. Para cada um, o que chegou pelos canais
          com destino: convênio, Pix, saúde fundo a fundo e pago ao favorecido (o pagamento direto do Portal), com o válido e o pago, os
          municípios atendidos, o que caducou e o que está na fila. Cada coluna filtra e ordena, e cada nome abre a ficha do autor.
        </p>
        <p className="mp-fiscal-aviso">{AVISO}</p>
        <CarimboDoDado execucao={execucao} />
        <p className="pa-linha">
          <LinkMapa href="/mapa/painel" className="pa-btn pa-btn-pequeno">
            Voltar ao painel de execução
          </LinkMapa>
        </p>
      </div>

      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <CartaoNumero titulo={ROTULO_CURTO_GRUPO.publico} numero={n(porGrupo.publico)} nota="com município atendido, ou Pix e FNS válidos" />
        <CartaoNumero
          titulo={ROTULO_CURTO_GRUPO.convenio_sem_municipio}
          numero={n(porGrupo.convenio_sem_municipio)}
          nota="com entidade sediada aqui ou com o estado"
        />
        <CartaoNumero titulo={ROTULO_CURTO_GRUPO.entidade} numero={n(porGrupo.entidade)} nota="só pago ao favorecido, sem destino público" />
        <CartaoNumero titulo={ROTULO_CURTO_GRUPO.sem_canal} numero={n(porGrupo.sem_canal)} nota="só no catálogo, só proposta ou só pessoa física" />
      </div>

      <section aria-labelledby="parl-lista" className="mp-radar-secao">
        <h2 id="parl-lista" className="mp-radar-h2">
          Os {n(autores.length)} autores
        </h2>
        <p className="pa-nota mp-parl-grupo-nota">
          Na ordem padrão, os quatro grupos vêm na ordem dos cartões e, dentro de cada um, por tipo e nome. “Filtrar e ordenar” filtra por
          qualquer coluna (o grupo e o tipo inclusive) e ordena por qualquer uma; o CSV sai só com o que está filtrado. Ordenar por valor é
          leitura, não posição.
        </p>
        <TabelaFiltravel
          id={TABELA_PARLAMENTARES}
          rotulo="Autores de emendas com recurso para a Paraíba"
          colunas={COLUNAS_PARLAMENTARES}
          linhas={linhas}
          descricaoOrdemPadrao="por grupo, tipo e nome"
          csv={{ nome: "parlamentares-pb" }}
        />
      </section>

      <section aria-labelledby="parl-grupos" className="mp-radar-secao">
        <h2 id="parl-grupos" className="mp-radar-h2">
          Os quatro grupos
        </h2>
        <ul className="pa-nota mp-parl-lista">
          {GRUPOS_DESTINO.map((g) => (
            <li key={g.id}>
              <strong>
                {ROTULO_CURTO_GRUPO[g.id]} ({n(porGrupo[g.id])})
              </strong>
              : {g.nota}
            </li>
          ))}
        </ul>
      </section>

      <NotaDeMetodo id="parl-como-ler" />
      <section aria-labelledby="parl-colunas" className="mp-radar-secao">
        <h2 id="parl-colunas" className="mp-radar-h2">
          O que cada coluna diz
        </h2>
        <ul className="pa-nota mp-parl-lista">
          <li>
            <strong>Código</strong>: o código do autor no Portal. <strong>Grupo</strong>: um dos quatro acima.
          </li>
          <li>
            <strong>{ROTULO_CANAL.convenio}</strong>: o valor da emenda nos convênios assinados e não extintos (válido) e o desembolso, na fatia
            da emenda (pago).
          </li>
          <li>
            <strong>Pix</strong>: a transferência especial, só os planos prontos para pagar (válido) e o pago. O plano “gêmeo” não soma.
          </li>
          <li>
            <strong>FNS</strong>: a saúde fundo a fundo, com as propostas do FNS não canceladas nem arquivadas (válido) e o pago ao fundo, no
            rateio por autor.
          </li>
          <li>
            <strong>{ROTULO_CANAL.favorecido}</strong>: o pagamento direto que o Portal mostra ao favorecido e nenhum outro canal da mesma emenda já mostra.
            Inclui prefeitura e fundo pagos por outras modalidades, além de entidade e empresa.
          </li>
          <li>
            <strong>Municípios atendidos</strong>: prefeitura ou fundo municipal, com instrumento válido ou pago ao favorecido. Empresa ou
            entidade com sede no município não conta.
          </li>
          <li>
            <strong>Caducados</strong> e <strong>valor caducado</strong>: propostas de convênio nunca assinadas, depois de 31/12 do ano
            seguinte ao da emenda. Ficam fora da fila.
          </li>
          <li>
            <strong>Na fila</strong>: instrumentos em que o dado diz de quem é a vez (concedente, proponente ou autor). A vez só aparece
            quando o dado diz.
          </li>
          <li>
            <strong>Ano inicial</strong> e <strong>ano final</strong>: o primeiro e o último ano das emendas do autor.
          </li>
          <li>
            <strong>Catálogo PB</strong> (empenhado e pago): o catálogo do Portal com a PB na localidade, só no grupo “sem canal”, que não tem
            outro número. Nos outros fica em branco: catálogo e canal são o mesmo dinheiro visto de dois lugares, e a ficha de cada autor
            mostra o catálogo na aba Contexto.
          </li>
        </ul>
      </section>
    </div>
  );
}

/** O que se desenha em cada coluna; o que não está aqui sai do valor cru (o código, o tipo e o grupo). */
function celulasDoAutor(a: AutorEmendas, valores: Record<string, ValorCelula>): Record<string, ReactNode> {
  const celulas: Record<string, ReactNode> = {};
  for (const id of COLUNAS_EM_REAIS) {
    const v = valores[id];
    celulas[id] = typeof v === "number" ? dinheiro(v) : "—";
  }
  celulas.autor = (
    <>
      <LinkMapa href={urlParlamentar(a.codigo)} className="mp-tabela-principal">
        {nomeDoAutor(a)}
      </LinkMapa>
      {a.emendas > 0 && (
        <span className="mp-tabela-secundario">
          {n(a.emendas)} {a.emendas === 1 ? "emenda" : "emendas"}
        </span>
      )}
      {a.coletivo && <Tag>autoria coletiva</Tag>}
    </>
  );
  celulas.municipios = municipiosDe223(a.municipios);
  celulas.caducados = a.caducados > 0 ? n(a.caducados) : "—";
  celulas["na-fila"] = a.na_fila > 0 ? n(a.na_fila) : "—";
  celulas["ano-inicial"] = a.ano_min === null ? "—" : String(a.ano_min);
  celulas["ano-final"] = a.ano_max === null ? "—" : String(a.ano_max);
  return celulas;
}
