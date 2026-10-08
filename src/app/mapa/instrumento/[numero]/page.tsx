import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { numeroValido, urlInstrumento } from "@/lib/oportunidades/busca";
import { podeVerInstrumento } from "@/lib/oportunidades/cliente";
import { lerAcessoFicha } from "@/lib/oportunidades/cliente.server";
import { lerInstrumento } from "@/lib/oportunidades/busca.server";
import { chaveSeguida } from "@/lib/oportunidades/favoritos";
import { lerSeguidas } from "@/lib/oportunidades/favoritos.server";
import { recorteDaBase } from "@/lib/oportunidades/vazios";
import { ehAdministrador, visitanteAtual } from "@/lib/supabase-auth";
import { DadoIndisponivel } from "../../busca/BuscaConteudo";
import { InstrumentoConteudo } from "./InstrumentoConteudo";
import { LinkMapa } from "../../_componentes/LinkMapa";

export const metadata: Metadata = {
  title: "Convênio · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/** Um convênio pelo número — para qualquer usuário aprovado. */
export default async function InstrumentoPage({ params }: { params: Promise<{ numero: string }> }) {
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const { numero } = await params;
  if (!numeroValido(numero)) notFound();
  const [leitura, seguidas] = await Promise.all([lerInstrumento(numero), lerSeguidas()]);
  const buscaDoNumero = `/mapa/busca?q=${encodeURIComponent(numero)}`;

  if (leitura.estado === "nao_encontrado") {
    return (
      <div className="pa-pagina pa-pagina-estreita">
        <div className="pa-pilha">
          <p className="pa-kicker">Convênio nº {numero}</p>
          <h1 className="pa-titulo">Este convênio não está na busca</h1>
          {/* B12b: o recorte vem de `recorteDaBase`, o mesmo do laudo e dos investimentos (antes faltava a tomada de contas especial). */}
          <p>A busca traz {recorteDaBase(null).convenios}. Confira o número ou procure pelo programa.</p>
          <p className="pa-nota">
            <LinkMapa href={buscaDoNumero}>Buscar por “{numero}”</LinkMapa>
          </p>
        </div>
      </div>
    );
  }
  if (leitura.estado !== "ok") {
    // B12b: sem a leitura não se sabe o município nem a entidade (o nível acima na trilha); a volta é a busca pelo número.
    return (
      <DadoIndisponivel
        kicker={`Convênio nº ${numero}`}
        titulo="O convênio está indisponível agora"
        endereco={urlInstrumento(numero)}
        voltarPara={{ rotulo: `Buscar “${numero}”`, href: buscaDoNumero }}
      />
    );
  }
  const i = leitura.instrumento;
  // O laudo nomeia servidores e interpreta o andamento: o administrador vê o atalho em todo instrumento.
  // Desde a onda 12, parte 3, a prefeitura também, nos instrumentos do próprio município (a página do
  // laudo confere de novo no servidor e mostra a versão do cliente).
  const admin = ehAdministrador(visitante.email);
  const laudo = admin || (i.tipo_agente === "municipio" && podeVerInstrumento((await lerAcessoFicha(visitante)).acesso, i).ok);
  return (
    <InstrumentoConteudo
      leitura={leitura}
      seguindo={seguidas ? seguidas.has(chaveSeguida("instrumento", i.nr_convenio)) : null}
      laudo={laudo}
    />
  );
}
