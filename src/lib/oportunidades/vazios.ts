/**
 * Os estados vazios das telas de cliente (B12b, onda 3 de UX, 08/10/2026; lista da seção 5 da B12). O vazio diz o que
 * se procurou ou qual é o recorte, dá o motivo provável sem inventar e oferece no máximo duas ou três saídas. Aqui
 * ficam as regras de texto que se repetem entre telas; os componentes só desenham. Funções puras, sem banco.
 */
import type { SaidaIndisponivel } from "./busca.ts";
import { UF_DETALHE } from "./instrumentos-escopo.ts";
import { NOME_UF, siglaDaUrl, urlUf } from "./pagina-uf.ts";

/** "A", "A e B", "A, B e C". */
function lista(xs: string[]): string {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`;
}

// A4x (08/10/2026): a fonte única do recorte da base. Os vazios (convênio, laudo, proposta, investimentos) e a ficha da
// entidade (`RECORTE_DA_BASE`, abaixo) leem daqui; antes a entidade tinha uma cópia em `pagina-entidade.ts`, com outra
// redação. As propostas de fora da PB ficaram com a regra precisa que a cópia da entidade trazia.
const RECORTE_PB = {
  convenios: "todos os convênios e contratos de repasse de proponente da Paraíba, desde 2008",
  propostas: "todas as propostas de proponente da Paraíba enviadas desde 2019",
};
const RECORTE_FORA = {
  convenios: "só os convênios em execução, em prestação de contas ou em tomada de contas especial",
  propostas: "as propostas dos últimos três anos e as antigas sem desfecho que se moveram no último ano",
};
const RECORTE_TODO = {
  convenios: `${RECORTE_PB.convenios}, e, no resto do país, ${RECORTE_FORA.convenios}`,
  propostas: `${RECORTE_PB.propostas} e, no resto do país, ${RECORTE_FORA.propostas}`,
};

/**
 * O recorte da base do Mapa, como o job `painel_execucao/` grava: na UF detalhada (PB), todos os convênios e as propostas
 * enviadas desde 2019; no resto do país, só os convênios vivos (o `vivo` de `instrumentos.py`: em execução, em
 * prestação de contas ou em tomada de contas especial) e as propostas dos últimos três anos, mais as antigas sem desfecho
 * que se moveram no último ano (`propostas.py`).
 *
 * Antes a regra estava escrita à mão em cada tela (convênio e laudo não encontrados, proposta não encontrada,
 * investimentos), e as duas do convênio esqueciam a tomada de contas especial. `uf` vazia ou desconhecida: as duas
 * partes numa frase só, para a página que não sabe a UF.
 */
export function recorteDaBase(uf?: string | null): { convenios: string; propostas: string } {
  const sigla = siglaDaUrl(uf);
  if (sigla === UF_DETALHE) return RECORTE_PB;
  if (sigla) return RECORTE_FORA;
  return RECORTE_TODO;
}

/**
 * O recorte em duas frases, para a ficha "Quem é" da entidade e para o CNPJ sem instrumento nem proposta (C1c). Sai do
 * mesmo texto de `recorteDaBase` sem UF (A4x): a entidade pode ser de qualquer UF. Conferido no job e no banco em
 * 08/10/2026: fora da PB há propostas (121.683 na execução da época), e o texto antigo da ficha ("Propostas: só as de
 * proponente da Paraíba") estava errado.
 */
export const RECORTE_DA_BASE = `A base traz ${RECORTE_TODO.convenios}. Traz também ${RECORTE_TODO.propostas}.`;

/**
 * A volta "um nível acima" até a UF, para o `voltarPara` do `DadoIndisponivel`. Fora da PB, o nome vai entre parênteses,
 * porque o "de/do/da" muda de UF para UF (o mesmo cuidado de `saidasBuscaVazia`). UF desconhecida: null.
 */
export function voltarParaUf(uf: string | null | undefined): SaidaIndisponivel | null {
  const sigla = siglaDaUrl(uf);
  if (!sigla) return null;
  return { rotulo: sigla === UF_DETALHE ? "Voltar à Paraíba" : `Voltar à página da UF (${NOME_UF[sigla]})`, href: urlUf(sigla) };
}

/**
 * O próximo dia `dia` do mês a partir de `hoje` (AAAA-MM-DD), contando o próprio dia. Serve à rodada mensal dos
 * indicadores (`.github/workflows/municipios.yml`, cron "0 10 5 * *": dia 5 de cada mês). Dia que o mês não tem (31 em
 * novembro) vai ao último dia dele. Data ou dia inválidos: null.
 */
export function proximoDiaDoMes(hoje: string, dia: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(hoje);
  if (!m || !Number.isInteger(dia) || dia < 1 || dia > 31) return null;
  let ano = Number(m[1]);
  let mes = Number(m[2]);
  // Dia 0 do mês seguinte é o último deste (mês contado de 1 a 12).
  const ultimo = (a: number, ms: number) => new Date(Date.UTC(a, ms, 0)).getUTCDate();
  if (Number(m[3]) > Math.min(dia, ultimo(ano, mes))) {
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  const alvo = Math.min(dia, ultimo(ano, mes));
  return `${ano}-${String(mes).padStart(2, "0")}-${String(alvo).padStart(2, "0")}`;
}

/**
 * A frase do catálogo sem janela (`CatalogoClient`) e, à parte, o motivo provável. Antes eram três frases soltas:
 * "Nenhuma janela com esses filtros." sem dizer o termo, e "aceita ict", com o tipo em minúscula crua.
 *
 * `tipo`: o tipo de agente já na forma de frase ("município", "ICT", "outros proponentes"); null sem entidade
 * declarada. `fontesComProblema`: os nomes das fontes que a faixa "Cobertura incompleta" já nomeia; com elas, o vazio
 * pode ser falta de leitura, e a frase diz isso em vez de afirmar que não há janela.
 */
export function vazioCatalogo(v: {
  busca: string;
  /** Algum filtro além da busca: fonte, canal ou assunto. */
  outrosFiltros: boolean;
  tipo: string | null;
  abertasHoje: number;
  fontesComProblema: string[];
}): { frase: string; motivo: string | null } {
  const termo = v.busca.trim();
  let frase: string;
  if (termo) {
    frase = `Nenhuma janela com “${termo}” no programa ou no órgão${v.outrosFiltros ? ", com os filtros escolhidos" : ""}.`;
  } else if (v.outrosFiltros) {
    frase = "Nenhuma janela com os filtros escolhidos.";
  } else if (v.tipo && v.abertasHoje > 0) {
    frase =
      v.abertasHoje === 1
        ? `A única janela aberta hoje no catálogo não aceita ${v.tipo}.`
        : `Nenhuma das ${v.abertasHoje.toLocaleString("pt-BR")} janelas abertas hoje no catálogo aceita ${v.tipo}.`;
  } else {
    frase = "Nenhuma janela aberta hoje no catálogo.";
  }
  const fontes = v.fontesComProblema.filter((f) => f.trim());
  const motivo = fontes.length
    ? `As janelas de ${lista(fontes)} podem estar faltando: a leitura ${fontes.length === 1 ? "dessa fonte está" : "dessas fontes está"} com problema.`
    : null;
  return { frase, motivo };
}
