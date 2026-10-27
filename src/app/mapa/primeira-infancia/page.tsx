import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { nivelSemCliente } from "@/lib/oportunidades/pagina-municipio";
import { temCarimbado, totais } from "@/lib/oportunidades/primeira-infancia";
import { lerPrimeiraInfancia } from "@/lib/oportunidades/primeira-infancia.server";
import { chaveDoAmbiente, quemAPaginaAtende } from "@/lib/oportunidades/publico";
import { tituloDaPagina } from "@/lib/oportunidades/titulo-pagina";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { LinkMapa } from "../_componentes/LinkMapa";
import { DadoIndisponivel } from "../busca/BuscaConteudo";
import { CartoesPI, NotasPI, ObrasPI, TabelaMunicipiosPI } from "./PecasPrimeiraInfancia";

export const metadata: Metadata = {
  title: tituloDaPagina("Primeira infância na PB"),
  robots: { index: false, follow: false },
};

/**
 * A primeira infância na Paraíba (P2, 22/10/2026; plano em Site-Ponte/primeira-infancia/PLANO.md): o dinheiro
 * carimbado parado (creches, Pix, Criança Feliz), o contexto (FUNDEB, salário-educação, saúde) e a lista dos 223.
 *
 * Quem vê (decisão do titular, 22/10/2026): administrador e cadastrado (nível ≥ 1). O público vai ao `/mapa`, como nas
 * telas internas. Só o administrador ordena a lista por valor (sem ranking de municípios para quem não é da casa).
 * `?todos=1` mostra os 223; sem ele, só os que têm termo, plano ou saldo do Criança Feliz.
 */
export default async function PrimeiraInfanciaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const acesso = quemAPaginaAtende(await visitanteAtual(), chaveDoAmbiente(), "/mapa/primeira-infancia");
  if (!acesso) return null;
  const administrador = ehAdministrador(acesso.aprovado?.email);
  const nivel = nivelSemCliente({ aprovado: acesso.aprovado !== null, administrador });
  if (nivel < 1) redirect("/mapa");

  const sp = await searchParams;
  const todos = sp.todos === "1";
  const leitura = await lerPrimeiraInfancia();
  if (leitura.estado !== "ok") {
    return (
      <DadoIndisponivel
        kicker="Primeira infância"
        titulo="A página da primeira infância está indisponível agora"
        endereco="/mapa/primeira-infancia"
        voltarPara={{ rotulo: "Abrir a página da Paraíba", href: "/mapa/uf/pb" }}
        publico={false}
      />
    );
  }
  const t = totais(leitura.municipios);
  const lista = todos ? leitura.municipios : leitura.municipios.filter(temCarimbado);
  return (
    <div className="pa-pagina mp-radar mp-laudo">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Paraíba · primeira infância</p>
        <h1 className="pa-titulo">Dinheiro parado da primeira infância na Paraíba</h1>
        <p className="pa-sub">
          Creches e educação infantil, Criança Feliz e Pix: o que já foi depositado e não virou obra nem serviço, o que foi
          contratado e ainda não saiu, e, como contexto, o FUNDEB, o salário-educação e a saúde.
        </p>
      </div>
      {leitura.faltas.length > 0 && (
        <p className="pa-nota" role="status">
          Não foi possível ler agora: {leitura.faltas.join(", ")}. O resto da página está completo.
        </p>
      )}
      <CartoesPI t={t} datas={leitura.datas} estadual />

      <h2 className="mp-radar-h3">Obras de creche paralisadas no Obrasgov.br</h2>
      <ObrasPI
        obras={[...leitura.municipios.flatMap((m) => m.obras), ...leitura.obrasSemMunicipio].filter((o) => o.situacao === "Paralisada")}
        data={leitura.datas.obras}
        vazio="Nenhuma obra de creche paralisada na PB no Obrasgov.br."
        comMunicipio
      />
      {leitura.obrasSemMunicipio.length > 0 && (
        <p className="pa-nota">
          {leitura.obrasSemMunicipio.length} obras de creche da PB estão no Obrasgov.br sem município identificado (sem tomador, sem o nome do
          município e com a localização padrão): entram aqui, mas não na página de nenhum município.
        </p>
      )}

      <h2 className="mp-radar-h3">Por município</h2>
      <p className="pa-nota">
        {todos ? `Os ${leitura.municipios.length} municípios.` : `Os ${lista.length} municípios com termo de creche, plano do Pix ou saldo do Criança Feliz.`}{" "}
        <LinkMapa href={todos ? "/mapa/primeira-infancia" : "/mapa/primeira-infancia?todos=1"}>{todos ? "Ver só esses" : "Ver os 223"}</LinkMapa>. O nome abre a
        aba de primeira infância do município, com cada termo e o laudo.
      </p>
      <TabelaMunicipiosPI municipios={lista} administrador={administrador} />
      <NotasPI datas={leitura.datas} />
    </div>
  );
}
