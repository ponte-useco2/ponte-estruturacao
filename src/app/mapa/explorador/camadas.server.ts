/**
 * As leituras do explorador em camadas (C3a, 09/10/2026) — só servidor. Nenhuma consulta nova: cada camada usa a leitura
 * que a página completa do nível já faz, com a memória de 10 minutos dela (a mesma chave, então abrir a camada aquece a
 * página e vice-versa):
 *   · Brasil: `lerBrasil` (as somas por UF);
 *   · UF e município: `lerUf(sigla, true)` — a do administrador, que a rota exige. O resumo do município sai da lista
 *     dos 223 que ela já traz, e não do relatório do município (`lerRelatorioMunicipio`, ~3 s e muito mais do que a
 *     camada mostra);
 *   · entidades do município: `lerEntidadesDoMunicipio` (o "Quem recebe");
 *   · entidade e instrumento: `lerRelatorioEntidade` (a identidade e a carteira; o instrumento é um item dela).
 * Só se lê o que as camadas desenhadas pedem (as 3 mais fundas): a trilha não precisa de banco (nomes pela lista fixa
 * dos 223 e pela leitura da entidade, que a camada da entidade ou a do instrumento já fazem).
 *
 * A pertença é conferida aqui: a entidade tem de estar entre as que recebem no município do endereço, e o instrumento,
 * na carteira da entidade. Fora disso, a descida para no nível de cima e a página diz por quê (nunca se mostra uma
 * entidade sob um município que não é o dela).
 */
import { niveisDesenhados, pilhaAte, type PilhaExplorador } from "@/lib/oportunidades/explorador";
import type { LinhaEntidadeMunicipio } from "@/lib/oportunidades/pagina-entidade";
import { lerBrasil, type LeituraBrasil } from "@/lib/oportunidades/pagina-brasil.server";
import { lerUf, type LeituraUf } from "@/lib/oportunidades/pagina-uf.server";
import { lerEntidadesDoMunicipio, lerRelatorioEntidade, type LeituraEntidade } from "@/lib/oportunidades/relatorio-municipio.server";

/** O que foi lido. `undefined`: a camada não pediu; nas entidades do município, `null` é leitura que falhou. */
interface Lidas {
  brasil?: LeituraBrasil;
  uf?: LeituraUf;
  entidades?: LinhaEntidadeMunicipio[] | null;
  entidade?: LeituraEntidade;
}

export interface LeiturasExplorador extends Lidas {
  /** A pilha que vale: a do endereço, ou cortada onde a pertença falhou. */
  pilha: PilhaExplorador;
  /** Por que a descida parou acima do que o endereço pedia; null quando não parou. */
  aviso: string | null;
}

/** Lê, em paralelo, o que as camadas desenhadas da pilha pedem e ainda não foi lido. */
async function lerFaltantes(p: PilhaExplorador, hoje: string, ja: Lidas): Promise<Lidas> {
  const desenhados = niveisDesenhados(p);
  const [brasil, uf, entidades, entidade] = await Promise.all([
    ja.brasil ?? (desenhados.includes("brasil") ? lerBrasil() : undefined),
    ja.uf ?? (p.uf && (desenhados.includes("uf") || desenhados.includes("municipio")) ? lerUf(p.uf, true) : undefined),
    ja.entidades !== undefined ? ja.entidades : p.ibge ? lerEntidadesDoMunicipio(p.ibge) : undefined,
    ja.entidade ?? (p.cnpj ? lerRelatorioEntidade(p.cnpj, hoje) : undefined),
  ]);
  return { brasil, uf, entidades, entidade };
}

/** As leituras das camadas, com a pilha conferida. `hoje`: o dia de Brasília (a chave da memória da entidade). */
export async function lerExplorador(pedida: PilhaExplorador, hoje: string): Promise<LeiturasExplorador> {
  let lidas = await lerFaltantes(pedida, hoje, {});
  let pilha = pedida;
  let aviso: string | null = null;

  if (pilha.cnpj && Array.isArray(lidas.entidades) && !lidas.entidades.some((l) => l.cnpj === pilha.cnpj)) {
    pilha = pilhaAte(pilha, "municipio");
    aviso = "A entidade do endereço não aparece entre as que têm instrumento neste município. A descida parou no município.";
  } else if (pilha.cnpj && lidas.entidade?.estado === "nao_encontrado") {
    pilha = pilhaAte(pilha, "municipio");
    aviso = "A entidade do endereço não está na base. A descida parou no município.";
  } else if (pilha.instrumento && lidas.entidade?.estado === "ok" && !lidas.entidade.instrumentos.some((i) => i.nr_convenio === pilha.instrumento)) {
    pilha = pilhaAte(pilha, "entidade");
    aviso = "O instrumento do endereço não está na carteira desta entidade. A descida parou na entidade.";
  }

  // Cortada a pilha, as camadas de cima voltam a ser desenhadas e podem pedir leitura (o Brasil, a UF).
  if (pilha !== pedida) lidas = await lerFaltantes(pilha, hoje, lidas);
  return { ...lidas, pilha, aviso };
}
