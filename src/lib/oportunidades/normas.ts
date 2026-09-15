/**
 * Validação da norma que um administrador publica no mural (onda 7) — pura.
 *
 * As mesmas regras das checks da `oport_norma`, conferidas antes de ir ao banco para a
 * tela dizer o que está errado em vez de "não foi possível publicar".
 */
import { ehTemaConhecido } from "./temas.ts";

export interface NormaNova {
  titulo: string;
  orgao: string | null;
  publicada_em: string;
  link: string;
  resumo: string | null;
  temas: string[];
}

const opcional = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

function dataValida(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** A norma pronta para gravar, ou a frase do que está errado. */
export function normaValida(dados: unknown): NormaNova | string {
  if (typeof dados !== "object" || dados === null) return "Formulário inválido.";
  const d = dados as Record<string, unknown>;

  const titulo = opcional(d.titulo);
  if (!titulo || titulo.length < 3 || titulo.length > 300) return "O título precisa ter de 3 a 300 caracteres.";

  const orgao = opcional(d.orgao);
  if (orgao && orgao.length > 200) return "O órgão pode ter até 200 caracteres.";

  const publicada = opcional(d.publicada_em);
  if (!publicada || !dataValida(publicada)) return "Informe a data de publicação.";

  const link = opcional(d.link);
  if (!link || !/^https:\/\/\S+$/.test(link) || link.length > 500) return "O link precisa começar com https:// e levar ao texto oficial.";

  const resumo = opcional(d.resumo);
  if (resumo && resumo.length > 1000) return "O resumo pode ter até 1.000 caracteres.";

  const temas = Array.isArray(d.temas) ? d.temas.filter((t): t is string => typeof t === "string") : [];
  if (temas.length > 10 || temas.some((t) => !ehTemaConhecido(t))) return "Tema desconhecido.";

  return { titulo, orgao, publicada_em: publicada, link, resumo, temas: [...new Set(temas)] };
}
