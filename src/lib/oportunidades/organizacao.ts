/**
 * Tipos de agente — quem capta recurso público, e o que cada um pode pleitear.
 *
 * Os doze ids são EXATAMENTE os de `ORGANIZATION_TYPES`, em
 * `funding_intelligence/models.py` no radar. Não é gosto: o catálogo v2 traz
 * `eligibility.organization_types` com essas mesmas cadeias, e o cruzamento
 * precisa ser comparação de string. Qualquer tradução aqui viraria tabela
 * de-para, e tabela de-para vira divergência silenciosa na primeira vez que um
 * dos lados ganhar um tipo novo.
 *
 * Os rótulos e exemplos, esses sim, são para gente: ninguém se reconhece em
 * "consorcio_publico", mas todo mundo reconhece "consórcio intermunicipal".
 *
 * Cobertura no catálogo v2 de 10/09/2026, em 171 oportunidades: empresa 39,
 * estado 36, OSC 36, município 35, consórcio 20, ICT 11, startup 9,
 * cooperativa 8, pesquisador 6, universidade 4, pessoa física 3. Só `outros`
 * não aparece — é a saída para quem não se encaixa, não uma categoria do dado.
 */

export type TipoAgente =
  | "municipio"
  | "estado"
  | "consorcio_publico"
  | "osc"
  | "cooperativa"
  | "empresa"
  | "startup"
  | "universidade"
  | "ict"
  | "pesquisador"
  | "pessoa_fisica"
  | "outros";

/** Grupos existem para a tela, não para o dado: doze opções soltas não se leem. */
export type GrupoAgente = "publico" | "civil" | "produtivo" | "ciencia" | "individual";

export interface Agente {
  id: TipoAgente;
  rotulo: string;
  /** O que a pessoa procura para se reconhecer. Nunca jargão do sistema. */
  exemplos: string;
  grupo: GrupoAgente;
}

export const ROTULO_GRUPO: Record<GrupoAgente, string> = {
  publico: "Poder público",
  civil: "Sociedade civil",
  produtivo: "Setor produtivo",
  ciencia: "Ciência e tecnologia",
  individual: "Pessoa física",
};

export const AGENTES: Agente[] = [
  {
    id: "municipio",
    rotulo: "Município",
    exemplos: "prefeitura, secretaria, autarquia ou fundação municipal",
    grupo: "publico",
  },
  {
    id: "estado",
    rotulo: "Estado",
    exemplos: "governo estadual, secretaria, autarquia ou fundação estadual",
    grupo: "publico",
  },
  {
    id: "consorcio_publico",
    rotulo: "Consórcio público",
    exemplos: "consórcio intermunicipal ou interfederativo",
    grupo: "publico",
  },
  {
    id: "osc",
    rotulo: "Organização da sociedade civil",
    exemplos: "associação, fundação, instituto ou OSCIP sem fins lucrativos",
    grupo: "civil",
  },
  {
    id: "cooperativa",
    rotulo: "Cooperativa",
    exemplos: "cooperativa de produção, de crédito ou de trabalho",
    grupo: "civil",
  },
  {
    id: "empresa",
    rotulo: "Empresa",
    exemplos: "sociedade empresária de qualquer porte",
    grupo: "produtivo",
  },
  {
    id: "startup",
    rotulo: "Startup",
    exemplos: "empresa de base tecnológica em estágio inicial",
    grupo: "produtivo",
  },
  {
    id: "universidade",
    rotulo: "Universidade",
    exemplos: "instituição de ensino superior, pública ou privada",
    grupo: "ciencia",
  },
  {
    id: "ict",
    rotulo: "ICT",
    exemplos: "instituto de ciência e tecnologia, instituto federal, fundação de apoio",
    grupo: "ciencia",
  },
  {
    id: "pesquisador",
    rotulo: "Pesquisador",
    exemplos: "proponente vinculado a grupo ou programa de pesquisa",
    grupo: "ciencia",
  },
  {
    id: "pessoa_fisica",
    rotulo: "Pessoa física",
    exemplos: "proponente individual, sem vínculo institucional",
    grupo: "individual",
  },
  {
    id: "outros",
    rotulo: "Outro",
    exemplos: "nenhum dos anteriores descreve a entidade",
    grupo: "individual",
  },
];

export const ROTULO_AGENTE: Record<TipoAgente, string> = Object.fromEntries(
  AGENTES.map((a) => [a.id, a.rotulo]),
) as Record<TipoAgente, string>;

export function ehTipoAgente(v: unknown): v is TipoAgente {
  return typeof v === "string" && AGENTES.some((a) => a.id === v);
}

/** Os grupos na ordem em que a tela os mostra, cada um com os seus. */
export function agentesPorGrupo(): { grupo: GrupoAgente; rotulo: string; agentes: Agente[] }[] {
  const ordem: GrupoAgente[] = ["publico", "civil", "produtivo", "ciencia", "individual"];
  return ordem.map((g) => ({
    grupo: g,
    rotulo: ROTULO_GRUPO[g],
    agentes: AGENTES.filter((a) => a.grupo === g),
  }));
}

// ============================ CAMPOS DA FICHA ============================

/**
 * As 27 unidades da federação. A lista é fechada porque o banco também fecha
 * (`uf ~ '^[A-Z]{2}$'` não basta: 'XX' passaria no regex e não existe).
 */
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type UF = (typeof UFS)[number];

export function ehUF(v: unknown): v is UF {
  return typeof v === "string" && (UFS as readonly string[]).includes(v);
}

/** Só dígitos. Máscara é assunto de tela; o banco recusa qualquer outra coisa. */
export function digitosDoCnpj(v: string | null | undefined): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  return d === "" ? null : d;
}

/**
 * Validação de CNPJ pelos dois dígitos verificadores.
 *
 * Existe porque o banco só confere o formato: `^[0-9]{14}$` aceita
 * `00000000000000`. Um CNPJ inválido no cadastro só aparece quando alguém tenta
 * submeter proposta — tarde demais.
 */
export function cnpjValido(v: string | null | undefined): boolean {
  const d = digitosDoCnpj(v);
  if (d === null) return true; // ausente é permitido; inválido não.
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const dv = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((s, p, i) => s + Number(base[i]) * p, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };

  const d1 = dv(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

export interface Organizacao {
  id: string;
  nome: string;
  tipo: TipoAgente;
  uf: string | null;
  municipioIbge: string | null;
  cnpj: string | null;
  papel: "dono" | "editor" | "leitor";
}
