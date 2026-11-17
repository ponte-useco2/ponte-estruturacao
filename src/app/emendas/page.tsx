import type { Metadata } from "next";
import Link from "next/link";
import malha from "@/lib/oportunidades/malhas/pb-municipios.json";
import { parametrosDoEndereco } from "@/lib/oportunidades/emendas-publico";
import { lerInicioV2 } from "@/lib/oportunidades/emendas-publico.server";
import {
  ANO_INICIAL_PERCURSO,
  anoAtualBrasilia,
  caixaDoContorno,
  comp,
  emendasDoPeriodo,
  ibgeValido,
  inteiroPt,
  lerPeriodo,
  periodoDoEndereco,
  plural,
  recorteVazio,
  textoPeriodo,
  textoPeriodoUrl,
  urlInicio,
  urlMunicipio,
  urlRegistros,
} from "@/lib/oportunidades/emendas-recorte";
import { SeletorPeriodo } from "./_componentes/BarraRecorte";
import { Ajuda, Datas, Indisponivel, SemDado } from "./_componentes/Percurso";
import { SeletorMunicipio } from "./_componentes/SeletorMunicipio";

export const metadata: Metadata = {
  title: { absolute: "Emendas federais na Paraíba | PONTE" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

/**
 * O início (versão 2): o seletor de município e de período (ano da emenda), um botão principal "Ver [Município]", o
 * mosaico dos 223 municípios com o escolhido em destaque e, abaixo, no máximo três números da Paraíba no período, cada
 * um com o "?". O estado vive no endereço (`/emendas?periodo=2023-2026&municipio=2510808`).
 */
export default async function InicioEmendas({ searchParams }: Props) {
  const sp = await searchParams;
  const anoMax = anoAtualBrasilia();
  const periodo = lerPeriodo(periodoDoEndereco(parametrosDoEndereco(sp)), anoMax);
  const ibge = ibgeValido(um(sp.municipio));
  const l = await lerInicioV2(periodo, ibge);
  if (l.estado === "sem_dado") return <SemDado />;
  if (l.estado !== "ok") return <Indisponivel endereco={urlInicio(periodo, ibge)} />;

  const escolhido = ibge ? (l.municipios.find((m) => m.ibge === ibge) ?? null) : null;
  const caminho = escolhido ? (malha.areas.find((a) => a.id === escolhido.ibge)?.d ?? null) : null;
  const cx = caminho ? caixaDoContorno(caminho) : null;
  const pb = l.pb;
  const perTxt = emendasDoPeriodo(periodo).toLowerCase();
  const munReal = l.municipio ? comp(l.municipio.pago) : comp(0);
  const munSub = l.municipio ? `${plural(l.municipio.emendas, "emenda", "emendas")} · ${textoPeriodo(periodo)}` : `nenhum registro · ${textoPeriodo(periodo)}`;
  const acima = cx ? cx.cy / 578 < 0.3 : false;
  const ordenados = [...l.municipios].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <>
      <section aria-labelledby="titulo-tela" style={{ borderBottom: "2px solid var(--linha)" }}>
        <div className="heroi envolve">
          <div className="heroi-texto">
            <p className="t14 rotulo tinta-2">
              Emendas parlamentares federais · 223 municípios · {ANO_INICIAL_PERCURSO}–{anoMax}
            </p>
            <h1 id="titulo-tela" className="disp titulo-abertura cinetico">
              <span>Emendas</span> <span>federais</span>{" "}
              <span>
                na <span className="marca">Paraíba</span>
              </span>
            </h1>
            <p className="t22 tinta-2" style={{ maxWidth: "34ch" }}>
              Consulte a origem, o destino e a execução dos recursos.
            </p>

            <div className="painel sombra" style={{ padding: 24 }}>
              <SeletorMunicipio municipios={ordenados} inicial={escolhido} periodo={textoPeriodoUrl(periodo)}>
                <SeletorPeriodo
                  periodo={periodo}
                  anoMax={anoMax}
                  urlDoPeriodo={(p) => urlInicio(p, ibge)}
                  acao="/emendas"
                  ocultos={ibge ? [["municipio", ibge]] : []}
                />
              </SeletorMunicipio>
            </div>

            <form action="/emendas/emenda" method="get" className="pilha" style={{ gap: 8 }}>
              <label htmlFor="campo-codigo" className="t18" style={{ fontWeight: 700 }}>
                Abrir uma emenda pelo código
              </label>
              <div className="linha-flex" style={{ gap: 12 }}>
                <input
                  id="campo-codigo"
                  name="codigo"
                  className="campo t16 mono"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="2024 5007 0002"
                  aria-describedby="msg-codigo"
                  style={{ flex: "1 1 260px", width: "auto", minHeight: 48 }}
                />
                <button className="btn t16" type="submit">
                  Abrir a emenda
                </button>
              </div>
              <p id="msg-codigo" className="t14 tinta-2">
                O código tem 12 dígitos: ano, autoria e número (com ou sem espaços).
              </p>
            </form>
          </div>

          <div className="heroi-mapa">
            <figure style={{ margin: "24px 0 0" }} aria-labelledby="legenda-mapa">
              <div className="mapa-caixa">
                <svg className="mosaico" viewBox={malha.viewBox} aria-hidden="true" focusable="false">
                  {malha.areas.map((a) => (
                    <path key={a.id} d={a.d} />
                  ))}
                  {caminho ? <path d={caminho} className="escolhido" /> : null}
                </svg>
                {cx && escolhido ? (
                  <div
                    className="rotulo-mapa t14"
                    aria-hidden="true"
                    style={{
                      left: `${Math.min(78, Math.max(22, (cx.cx / 1000) * 100)).toFixed(1)}%`,
                      top: `${(((acima ? cx.y1 : cx.y0) / 578) * 100).toFixed(1)}%`,
                      transform: acima ? "translate(-50%, 16px)" : "translate(-50%, calc(-100% - 16px))",
                    }}
                  >
                    <span className="disp t22" style={{ fontWeight: 760 }}>
                      {escolhido.nome}
                    </span>
                    <span className="num">
                      <strong>{munReal}</strong> realizados
                    </span>
                    <span className="num tinta-2">{munSub}</span>
                  </div>
                ) : null}
              </div>
              <figcaption id="legenda-mapa" className="t12 tinta-2" style={{ marginTop: 12, maxWidth: "46ch" }}>
                Os 223 municípios da Paraíba (malha municipal do IBGE).
                {escolhido ? ` Em destaque, ${escolhido.nome}: ${munReal} realizados, ${munSub}.` : " Escolha um município para vê-lo em destaque."}
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section aria-labelledby="titulo-numeros" className="envolve pilha" style={{ paddingTop: 56, paddingBottom: 24, gap: 24 }}>
        <div className="linha-flex" style={{ justifyContent: "space-between", alignItems: "end", gap: "12px 32px" }}>
          <h2 id="titulo-numeros" className="disp t48" style={{ fontWeight: 740, fontVariationSettings: "'wdth' 84", lineHeight: 1.02 }}>
            Na Paraíba, {perTxt}
          </h2>
          <Link prefetch={false} className="btn t14" href={urlRegistros(recorteVazio(periodo))}>
            Ver os registros da Paraíba
          </Link>
        </div>
        <dl className="tres">
          <div>
            <dt className="t16">
              Realizado com destino na Paraíba <Ajuda chave="realizado" territorio="Paraíba" periodo={perTxt} />
            </dt>
            <dd>
              <span className="disp num t64 numero-grande">{pb ? comp(pb.pago) : "nenhum registro"}</span>
            </dd>
          </div>
          <div>
            <dt className="t16">
              Emendas com recurso na Paraíba <Ajuda chave="registros" territorio="Paraíba" periodo={perTxt} />
            </dt>
            <dd>
              <span className="disp num t64 numero-grande">{pb ? inteiroPt(pb.emendas) : "0"}</span>
            </dd>
          </div>
          <div>
            <dt className="t16">
              Municípios com algum registro <Ajuda chave="municipios" territorio="Paraíba" periodo={perTxt} />
            </dt>
            <dd>
              <span className="disp num t64 numero-grande">
                {pb ? inteiroPt(pb.municipios) : "0"}{" "}
                <span className="t28" style={{ fontWeight: 500 }}>
                  de 223
                </span>
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="titulo-lista" className="envolve" style={{ paddingTop: 8, paddingBottom: 32 }}>
        <h2 id="titulo-lista" className="sr">
          Lista dos municípios
        </h2>
        <details className="t16 mais">
          <summary>Ver a lista dos 223 municípios, em ordem alfabética</summary>
          <ul className="lista-mun t16">
            {ordenados.map((m) => (
              <li key={m.ibge}>
                <Link prefetch={false} className="lnk" href={urlMunicipio(m.ibge, periodo)}>
                  {m.nome}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </section>
      <Datas execucao={l.execucao} />
    </>
  );
}
