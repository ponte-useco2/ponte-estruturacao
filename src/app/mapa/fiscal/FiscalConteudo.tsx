/**
 * A lista dos 223 municípios da PB no Painel de Capacidade Fiscal. Recebe os dados já lidos e só desenha.
 *
 * Onda 15, fase 2, lote C (13/10/2026): a lista é a `TabelaFiltravel`, com filtro e ordem em cada coluna (a regra do
 * titular; tela de administrador, toda coluna ordena). O formulário GET de antes (nome ou IBGE, decisão e situação) só
 * filtrava colunas desta lista: o filtro da tabela o substitui. O link antigo (`?q=`, `?decisao=`, `?estado=`)
 * redireciona para a forma nova (`urlFiscalDoFiltroAntigo`), e as contagens dos cartões levam ao filtro da decisão
 * (`urlFiscalPorDecisao`). As colunas e os valores crus estão em `fiscal.ts`; as células são as de antes.
 */
import { redirect } from "next/navigation";
import { formatarData, formatarPublicacao } from "@/lib/oportunidades/central";
import {
  AVISO_FIXO,
  COLUNAS_FISCAL,
  DECISOES,
  MARCA_ESTADO,
  NOME_CURTO,
  ROTULO_DECISAO,
  TABELA_FISCAL,
  TOM_ESTADO,
  colunaDaDecisao,
  conclusaoDe,
  contarDecisoes,
  pct,
  urlFiscalDoFiltroAntigo,
  urlFiscalPorDecisao,
  urlMunicipioFiscal,
  valoresDoMunicipioFiscal,
  type EstadoFiscal,
  type MunicipioFiscal,
  type ParametrosFiscal,
} from "@/lib/oportunidades/fiscal";
import type { LeituraFiscal } from "@/lib/oportunidades/fiscal.server";
import type { LinhaTabela } from "@/lib/oportunidades/tabela-filtro";
import { Tag } from "../../_design/primitivos";
import type { Saida } from "../painel/Pecas";
import { LinkMapa } from "../_componentes/LinkMapa";
import { TabelaFiltravel } from "../_componentes/TabelaFiltravel";
import { Termo } from "../_componentes/Termo";

type LeituraOk = Extract<LeituraFiscal, { estado: "ok" }>;

const n = (x: number) => x.toLocaleString("pt-BR");
const GRUPOS_DECISAO: EstadoFiscal[] = ["nao_atendido", "atencao", "nao_verificavel", "atendido"];

export function EstadoDecisao({ estado }: { estado: EstadoFiscal }) {
  return (
    <Tag tom={TOM_ESTADO[estado]}>
      <span aria-hidden="true">{MARCA_ESTADO[estado]} </span>
      {ROTULO_DECISAO[estado]}
    </Tag>
  );
}

export function FiscalConteudo({ p, leitura }: { p: ParametrosFiscal; leitura: LeituraOk }) {
  // O link de antes (`?q=agua&decisao=B&estado=atencao`) vira o filtro da tabela: o link guardado continua abrindo a
  // lista filtrada, e o filtro passa a morar num lugar só (onda 15, fase 2, lote C, 13/10/2026).
  const novo = urlFiscalDoFiltroAntigo(p);
  if (novo) redirect(novo);

  const contagem = contarDecisoes(leitura.municipios);
  const c = leitura.execucao.contagens;
  const cauc = typeof c.cauc_data_pesquisa === "string" ? c.cauc_data_pesquisa : null;
  const linhas = [...leitura.municipios].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map(linhaMunicipio);

  return (
    <div className="pa-pagina mp-radar mp-painel mp-fiscal">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Painel da PONTE · uso interno</p>
        <h1 className="pa-titulo">Capacidade fiscal · Paraíba</h1>
        <p className="pa-sub">
          Os {n(leitura.municipios.length)} municípios, lidos em <strong>{formatarPublicacao(leitura.execucao.concluida_em)}</strong>
          {cauc ? <> · CAUC consultado em {formatarData(cauc)}</> : null}
          {typeof c.versao_regras === "string" ? <> · regras {c.versao_regras}</> : null}. Para cada uma das três{" "}
          <Termo slug="decisoes-fiscais">decisões</Termo>, o que bloqueia e o que não deu para verificar, e as pendências no{" "}
          <Termo slug="cauc">CAUC</Termo>.
        </p>
        <p className="mp-fiscal-aviso">{AVISO_FIXO}</p>
      </div>

      <div className="pa-grade pa-grade-3 mp-painel-cartoes">
        {DECISOES.map((d) => (
          <article key={d.id} className="pa-cartao mp-painel-cartao">
            <h2 className="pa-mono">
              {d.id} · {d.nome}
            </h2>
            <ul className="mp-fiscal-contagem">
              {GRUPOS_DECISAO.map((e) => (
                <li key={e}>
                  <LinkMapa href={urlFiscalPorDecisao(d.id, e)}>
                    <EstadoDecisao estado={e} /> <span className="mp-num">{n(contagem[d.id][e] ?? 0)}</span>
                  </LinkMapa>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <section aria-labelledby="fiscal-lista" className="mp-radar-secao">
        <h2 id="fiscal-lista" className="mp-radar-h2">
          Os {n(leitura.municipios.length)} municípios
        </h2>
        <p className="pa-nota">
          Cada contagem dos cartões filtra a lista pela decisão. “Filtrar e ordenar” filtra e ordena por qualquer coluna, também pelo que
          bloqueia cada decisão e pelos itens do CAUC; o CSV sai só com o que está filtrado.
        </p>
        {/* A classe de antes, num invólucro: as larguras mínimas de `mp-fiscal-tabela` (mapa.css) valem para a tabela de dentro. */}
        <div className="mp-fiscal-tabela">
          <TabelaFiltravel
            id={TABELA_FISCAL}
            rotulo="Os municípios da PB nas três decisões fiscais"
            colunas={COLUNAS_FISCAL}
            linhas={linhas}
            ordemPadrao={{ coluna: "municipio", sentido: "asc" }}
            csv={{ nome: "capacidade-fiscal-pb" }}
          />
        </div>
      </section>
    </div>
  );
}

/** Uma linha da lista: os valores crus de `fiscal.ts` e as células de antes (onda 15, fase 2, lote C, 13/10/2026). */
function linhaMunicipio(m: MunicipioFiscal): LinhaTabela {
  const pendencias = m.indicadores.cauc_pendencias ?? [];
  const celulas: LinhaTabela["celulas"] = {
    municipio: (
      <>
        <LinkMapa href={urlMunicipioFiscal(m.ibge)} className="mp-tabela-principal">
          {m.nome}
        </LinkMapa>
        <span className="mp-tabela-secundario">
          IBGE {m.ibge}
          {m.populacao ? ` · ${n(m.populacao)} hab.` : ""}
        </span>
      </>
    ),
    pessoal: (
      <>
        {pct(m.indicadores.pessoal_pct)}
        {m.indicadores.rgf && <span className="mp-tabela-secundario">RGF {m.indicadores.rgf}</span>}
      </>
    ),
    cauc: pendencias.length ? `${pendencias.length} ${pendencias.length === 1 ? "pendência" : "pendências"}` : "sem pendência",
  };
  for (const d of DECISOES) {
    const cd = conclusaoDe(m, d.id);
    celulas[colunaDaDecisao(d.id)] = (
      <>
        {cd ? <EstadoDecisao estado={cd.estado} /> : "—"}
        {cd && cd.bloqueantes.length > 0 && <span className="mp-tabela-secundario">{cd.bloqueantes.map((b) => NOME_CURTO[b] ?? b).join(" · ")}</span>}
      </>
    );
  }
  return { chave: m.ibge, valores: valoresDoMunicipioFiscal(m), celulas };
}

/**
 * Indisponível do painel fiscal, só para administrador. B14b (08/10/2026): como o `DadoIndisponivel` da B12,
 * `endereco` vira "Tentar de novo" (quando a leitura falhou) e `voltarPara` troca a volta ao painel de execução.
 */
export function FiscalIndisponivel({
  estado,
  endereco,
  voltarPara = { rotulo: "Voltar ao painel de execução", href: "/mapa/painel" },
}: {
  estado: "nao_ativado" | "sem_execucao" | "erro";
  endereco?: string;
  voltarPara?: Saida;
}) {
  const texto = {
    nao_ativado: { titulo: "O painel fiscal ainda não foi ativado no banco", corpo: "Falta aplicar a migração fiscal_1 no Supabase." },
    sem_execucao: {
      titulo: "O painel fiscal ainda não rodou",
      corpo: "As tabelas existem, mas nenhuma execução foi concluída. O job roda todo dia às 12h UTC no workflow Painel fiscal do monorepo.",
    },
    erro: { titulo: "O painel fiscal está indisponível agora", corpo: "A leitura dos dados falhou. O detalhe está no registro do servidor." },
  }[estado];
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">Painel da PONTE · uso interno</p>
        <h1 className="pa-titulo">{texto.titulo}</h1>
        <p>{texto.corpo}</p>
        <p className="pa-linha">
          {estado === "erro" && endereco && (
            <LinkMapa href={endereco} className="pa-btn pa-btn-pequeno">
              Tentar de novo
            </LinkMapa>
          )}
          <LinkMapa href={voltarPara.href} className="pa-btn pa-btn-pequeno">
            {voltarPara.rotulo}
          </LinkMapa>
        </p>
      </div>
    </div>
  );
}
