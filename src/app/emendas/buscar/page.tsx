import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { lerNomesDosMunicipios } from "@/lib/oportunidades/emendas-publico.server";
import { normalizarTexto } from "@/lib/oportunidades/tabela-filtro";
import { anoAtualBrasilia, limparBusca, periodoPadrao, urlFicha, urlMunicipio } from "@/lib/oportunidades/emendas-recorte";

export const metadata: Metadata = { title: "Buscar", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * A busca do cabeçalho (versão 2): o código da emenda (12 dígitos, com ou sem espaços) abre a ficha; o nome de um
 * município (com ou sem acento) abre o município no período padrão; mais de um nome parecido vira uma lista para escolher.
 * Não é busca em linguagem natural. Formulário GET, sem JavaScript.
 */
export default async function Buscar({ searchParams }: Props) {
  const sp = await searchParams;
  const q = limparBusca((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "");
  const digitos = q.replace(/[\s.\-/]/g, "");
  if (/^\d{12}$/.test(digitos)) redirect(urlFicha(digitos, null));
  const periodo = periodoPadrao(anoAtualBrasilia());
  const alvo = normalizarTexto(q);
  const nomes = alvo ? await lerNomesDosMunicipios() : [];
  const exatos = nomes.filter((m) => normalizarTexto(m.nome) === alvo);
  if (exatos.length === 1) redirect(urlMunicipio(exatos[0].ibge, periodo));
  const parecidos = alvo.length >= 2 ? nomes.filter((m) => normalizarTexto(m.nome).includes(alvo)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) : [];
  if (parecidos.length === 1) redirect(urlMunicipio(parecidos[0].ibge, periodo));
  return (
    <section className="envolve pilha" style={{ paddingTop: 32, paddingBottom: 48, gap: 16 }}>
      <h1 className="disp titulo-tela">Buscar</h1>
      {q ? (
        parecidos.length ? (
          <>
            <p className="t16" role="status">
              {parecidos.length} municípios com “{q}” no nome. Escolha um:
            </p>
            <ul className="lista-mun t16">
              {parecidos.map((m) => (
                <li key={m.ibge}>
                  <Link prefetch={false} className="lnk" href={urlMunicipio(m.ibge, periodo)}>
                    {m.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="t16" role="status">
            Nada encontrado para “{q}”. A busca aceita o código da emenda (12 dígitos: ano, autoria e número, com ou sem espaços) ou o nome de
            um município da Paraíba.
          </p>
        )
      ) : (
        <p className="t16">Digite o código da emenda (12 dígitos) ou o nome de um município da Paraíba.</p>
      )}
      <p className="t14">
        <Link prefetch={false} href="/emendas/registros">
          Ver todos os registros da Paraíba
        </Link>
      </p>
    </section>
  );
}
