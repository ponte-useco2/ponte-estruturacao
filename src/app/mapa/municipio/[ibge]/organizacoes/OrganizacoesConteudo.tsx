/**
 * A lista das organizações da sociedade civil ativas de um município (E3, 07/10/2026). As filiais vêm agrupadas pela
 * raiz do CNPJ; quem tem instrumento federal na base vem primeiro. Cada nome leva à página da entidade — com a
 * carteira, quando há, ou só com o cadastro do Mapa. Inaptas, suspensas e baixadas aparecem só como número.
 */
import Link from "next/link";
import { cnpjLegivel } from "@/lib/oportunidades/fornecedores";
import {
  areasDaLista,
  fantasiaUtil,
  listaDoMunicipio,
  nomeOsc,
  rotuloArea,
  rotuloNatureza,
  versaoLegivel,
} from "@/lib/oportunidades/osc";
import type { OscDoMunicipio } from "@/lib/oportunidades/osc.server";
import { urlEntidade } from "@/lib/oportunidades/pagina-entidade";
import { urlMunicipio } from "@/lib/oportunidades/pagina-municipio";
import { Carregando } from "../../../_componentes/Carregando";

const n = (x: number) => x.toLocaleString("pt-BR");

function url(ibge: string, f: { area?: string | null; q?: string; p?: number }): string {
  const s = new URLSearchParams();
  if (f.area) s.set("area", f.area);
  if (f.q) s.set("q", f.q);
  if (f.p && f.p > 1) s.set("p", String(f.p));
  const qs = s.toString();
  return `/mapa/municipio/${ibge}/organizacoes${qs ? `?${qs}` : ""}`;
}

export function OrganizacoesConteudo({
  ibge,
  osc,
  instrumentos,
  area,
  q,
  pagina,
}: {
  ibge: string;
  osc: OscDoMunicipio;
  instrumentos: ReadonlyMap<string, number>;
  area: string | null;
  q: string;
  pagina: number;
}) {
  const r = osc.resumo;
  const municipio = osc.ativas[0]?.municipio ?? `IBGE ${ibge}`;
  const lista = listaDoMunicipio(osc.ativas, instrumentos, { area, q, pagina });
  const areas = areasDaLista(osc.ativas);
  const atual = Math.min(pagina, lista.paginas);
  const fora = r.inaptas + r.suspensas + r.baixadas;
  return (
    <div className="pa-pagina mp-radar mp-mun">
      <div className="pa-pilha mp-radar-cabeca">
        <nav aria-label="Onde você está" className="mp-mun-trilha">
          <span>Brasil</span>
          <span>Paraíba</span>
          <Link href={urlMunicipio(ibge, "dinheiro")} prefetch={false}>
            {municipio}
          </Link>
          <span aria-current="page">Organizações da sociedade civil</span>
        </nav>
        <h1 className="pa-titulo">Organizações da sociedade civil em {municipio}</h1>
        <p className="pa-sub">
          {n(r.ativas)} {r.ativas === 1 ? "organização ativa" : "organizações ativas"} ({n(r.matrizes)} matrizes e {n(r.filiais)} filiais) no Mapa das
          OSC do Ipea, versão de {versaoLegivel(osc.fonte.versao)}.
          {fora > 0 && ` Outras ${n(fora)} estão inaptas, suspensas ou baixadas na Receita e não entram na lista.`} Primeiro as que têm instrumento
          federal na base; as filiais aparecem junto da matriz.
        </p>
      </div>

      <nav aria-label="Área de atuação" className="pa-chips mp-radar-filtros">
        <Link href={url(ibge, { q })} className={`pa-chip${!area ? " pa-ativo" : ""}`} aria-current={!area ? "page" : undefined} prefetch={false}>
          Todas ({n(r.ativas)})
        </Link>
        {areas.map((a) => (
          <Link
            key={a.area}
            href={url(ibge, { area: a.area, q })}
            className={`pa-chip${area === a.area ? " pa-ativo" : ""}`}
            aria-current={area === a.area ? "page" : undefined}
            prefetch={false}
          >
            {rotuloArea(a.area)} ({n(a.n)})
          </Link>
        ))}
      </nav>

      <form method="get" action={`/mapa/municipio/${ibge}/organizacoes`} className="mp-filtros mp-busca-form" role="search">
        {area && <input type="hidden" name="area" value={area} />}
        <div className="mp-busca-termo">
          <label htmlFor="osc-q" className="pa-campo-rotulo">
            Buscar pelo nome ou CNPJ
          </label>
          <input id="osc-q" name="q" type="search" defaultValue={q} className="pa-input" autoComplete="off" />
        </div>
        <button type="submit" className="pa-btn pa-btn-pequeno">
          Buscar
        </button>
      </form>

      <section aria-labelledby="osc-lista" className="mp-radar-secao">
        <h2 id="osc-lista" className="mp-radar-h2" aria-live="polite">
          {lista.organizacoes ? `${n(lista.organizacoes)} ${lista.organizacoes === 1 ? "organização" : "organizações"}` : "Nenhuma organização com esses filtros"}
          {area ? ` · ${rotuloArea(area)}` : ""}
        </h2>
        {lista.grupos.length > 0 && (
          <div className="mp-tabela-rolagem">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Organização</th>
                  <th scope="col">Natureza</th>
                  <th scope="col">Área</th>
                  <th scope="col">Fundação</th>
                  <th scope="col">Instrumentos federais</th>
                </tr>
              </thead>
              <tbody>
                {lista.grupos.map((g) => (
                  <tr key={g.principal.cnpj}>
                    <td>
                      <Link href={urlEntidade(g.principal.cnpj)} prefetch={false}>
                        {nomeOsc(g.principal)}
                        <Carregando />
                      </Link>
                      {g.principal.razao_social && fantasiaUtil(g.principal) && <span className="pa-nota"> ({fantasiaUtil(g.principal)})</span>}
                      <br />
                      <span className="pa-nota pa-mono">{cnpjLegivel(g.principal.cnpj)}</span>
                      {g.filiais > 0 && (
                        <span className="pa-nota">
                          {" "}
                          · e mais {n(g.filiais)} {g.filiais === 1 ? "filial" : "filiais"} aqui
                        </span>
                      )}
                      {g.matrizFora && g.principal.matriz === false && <span className="pa-nota"> · filial (a matriz fica fora desta lista)</span>}
                    </td>
                    <td>{rotuloNatureza(g.principal.natureza_juridica)}</td>
                    <td>{g.principal.areas.length ? g.principal.areas.map(rotuloArea).join("; ") : "—"}</td>
                    <td>{g.principal.dt_fundacao?.slice(0, 4) ?? "—"}</td>
                    <td className="mp-rel-num">{g.instrumentos ? n(g.instrumentos) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lista.paginas > 1 && (
          <nav aria-label="Páginas" className="pa-linha mp-busca-paginas">
            {atual > 1 && (
              <Link href={url(ibge, { area, q, p: atual - 1 })} className="pa-btn pa-btn-pequeno" rel="prev" prefetch={false}>
                ← Anteriores
              </Link>
            )}
            <span className="pa-nota">
              Página {n(atual)} de {n(lista.paginas)}
            </span>
            {atual < lista.paginas && (
              <Link href={url(ibge, { area, q, p: atual + 1 })} className="pa-btn pa-btn-pequeno" rel="next" prefetch={false}>
                Próximas →
              </Link>
            )}
          </nav>
        )}
        <p className="pa-nota">
          Fonte: Mapa das Organizações da Sociedade Civil (Ipea), arquivo de divulgação da versão de {versaoLegivel(osc.fonte.versao)}, com o
          cadastro da Receita Federal; instrumentos federais pelo Transferegov. A área de atuação é a classificação do Ipea. Endereço, dirigentes e
          contatos não entram no Mapa de Oportunidades.
        </p>
      </section>
    </div>
  );
}
