/**
 * A trilha "Onde você está" (B11, 08/10/2026; achados H08 e A14 da auditoria B1+B2): Brasil › UF › região imediata ›
 * município › entidade › convênio, até onde a página sabe. Antes cada página montava a sua à mão, só cinco tinham, e
 * a da entidade pulava a região imediata que a do município mostrava. Aqui ficam os elos; o componente
 * `_componentes/Trilha.tsx` só desenha.
 *
 * Três regras:
 *   · nunca se inventa elo: sem a UF, sem o município ou sem a região no dado da página, o elo não aparece (a
 *     entidade não lê a região no banco: `lugarDaEntidade` a tira da lista fixa dos 223, pelo IBGE da sede — C1c);
 *   · o último elo é a página aberta e sai sem link (`aria-current="page"` na tela);
 *   · o município leva à página dele na PB e aos investimentos fora da PB, como em todo o Mapa (`urlDoMunicipio`).
 * Função pura, sem banco.
 */
import { rotuloModalidade, urlDoMunicipio, urlInstrumento, urlProposta } from "./busca.ts";
import { cnpjLegivel } from "./fornecedores.ts";
import { urlBrasil } from "./pagina-brasil.ts";
import { regiaoDoMunicipioPb } from "./municipios-pb.ts";
import { urlEntidade, type AbaEntidade } from "./pagina-entidade.ts";
import type { AbaMunicipio } from "./pagina-municipio.ts";
import { NOME_UF, siglaDaUrl, urlRegiao, urlUf } from "./pagina-uf.ts";

export interface Elo {
  rotulo: string;
  /** Sem link: a página aberta (o último elo) ou um lugar que não tem página própria. */
  href: string | null;
}

/** Onde a página está no território. Tudo opcional: cada página passa o que o dado dela traz. */
export interface Lugar {
  /** A sigla da UF ("PB" ou "pb"). Fora das 27, o elo da UF (e o da região) não aparece. */
  uf?: string | null;
  /** A região geográfica imediata do IBGE; só vem onde a página lê (município e relatório da PB). */
  regiaoImediata?: string | null;
  /**
   * O município: o código do IBGE (para o link) e o nome. `aba`: a aba de onde a subpágina se abre, para o elo voltar a
   * ela (as organizações e os investimentos saem do "Dinheiro federal"; o relatório, do "Relatório e dados").
   */
  municipio?: { ibge?: string | null; nome?: string | null; aba?: AbaMunicipio } | null;
  /**
   * O proponente (a entidade): o CNPJ (para o link) e o nome. `aba`: a aba de onde a subpágina se abre (o relatório
   * para imprimir volta ao "Relatório e dados", C1c).
   */
  entidade?: { cnpj?: string | null; nome?: string | null; aba?: AbaEntidade } | null;
}

const limpo = (s: string | null | undefined) => (s ?? "").trim() || null;

/** "Convênio nº 942082", ou a modalidade dele ("Contrato de repasse nº …"), com link para a página do instrumento. */
export function eloInstrumento(numero: string, modalidade?: string | null): Elo {
  const m = rotuloModalidade(modalidade) ?? "convênio";
  return { rotulo: `${m.charAt(0).toUpperCase()}${m.slice(1)} nº ${numero}`, href: urlInstrumento(numero) };
}

/** "Proposta nº 12345/2025" (o número do SICONV quando há; senão o id), com link para a página da proposta. */
export function eloProposta(id: string, numero?: string | null): Elo {
  return { rotulo: `Proposta nº ${limpo(numero) ?? id}`, href: urlProposta(id) };
}

/**
 * Os elos de Brasil até o lugar mais fundo que se conhece, e depois os da própria página (`depois`: um elo, ou só o
 * rótulo da página aberta). O último sai sempre sem link.
 */
export function trilha(lugar: Lugar, ...depois: (Elo | string | null | undefined | false)[]): Elo[] {
  const elos: Elo[] = [{ rotulo: "Brasil", href: urlBrasil() }];

  const sigla = siglaDaUrl(lugar.uf);
  if (sigla) {
    elos.push({ rotulo: NOME_UF[sigla], href: urlUf(sigla) });
    const regiao = limpo(lugar.regiaoImediata);
    if (regiao) elos.push({ rotulo: `Região imediata de ${regiao}`, href: urlRegiao(sigla, regiao) });
  }

  const ibge = limpo(lugar.municipio?.ibge);
  const municipio = limpo(lugar.municipio?.nome) ?? (ibge ? `IBGE ${ibge}` : null);
  if (municipio) elos.push({ rotulo: municipio, href: ibge ? urlDoMunicipio(ibge, lugar.municipio?.aba) : null });

  const cnpj = limpo(lugar.entidade?.cnpj);
  const entidade = limpo(lugar.entidade?.nome) ?? (cnpj ? `CNPJ ${cnpjLegivel(cnpj)}` : null);
  if (entidade) elos.push({ rotulo: entidade, href: cnpj ? urlEntidade(cnpj, lugar.entidade?.aba) : null });

  for (const d of depois) {
    if (!d) continue;
    elos.push(typeof d === "string" ? { rotulo: d, href: null } : d);
  }

  // O último elo é a página aberta: sem link, nem quando ele é um lugar (a página do município, da UF).
  const ultimo = elos.length - 1;
  elos[ultimo] = { ...elos[ultimo], href: null };
  return elos;
}

/**
 * O lugar de uma entidade, para a trilha da página dela e das subpáginas (C1c, 08/10/2026; B11, 9.1). A região
 * imediata vem da lista fixa dos 223 (`municipios-pb.ts`, copiada do `mun_grupo`), pelo IBGE da sede, e só quando a
 * UF do dado é a PB: sede de outra UF, UF ausente ou código que não é da PB ficam sem o elo da região (nunca se
 * inventa elo). O município entra com o nome, o código ou os dois, como a leitura trouxer.
 */
export function lugarDaEntidade(
  e: { cnpj: string; nome?: string | null; uf?: string | null; cod_ibge?: string | null; municipio?: string | null },
  aba?: AbaEntidade,
): Lugar {
  const ibge = limpo(e.cod_ibge);
  const regiao = siglaDaUrl(e.uf) === "PB" ? regiaoDoMunicipioPb(ibge) : null;
  return {
    uf: e.uf,
    regiaoImediata: regiao?.imediata ?? null,
    municipio: limpo(e.municipio) || ibge ? { ibge, nome: e.municipio } : null,
    entidade: { cnpj: e.cnpj, nome: e.nome, aba },
  };
}
