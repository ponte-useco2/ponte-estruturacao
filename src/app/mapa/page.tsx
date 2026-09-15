import type { Metadata } from "next";
import Link from "next/link";
import { lerCatalogo, lerCatalogoV2 } from "@/lib/oportunidades/catalogo.server";
import { montarCatalogo } from "@/lib/oportunidades/catalogo-v2";
import { codigosPorJanela } from "@/lib/oportunidades/codigos-transferegov";
import { hojeLocal } from "@/lib/oportunidades/contrato-v2";
import { lerSeguidas } from "@/lib/oportunidades/favoritos.server";
import { lerPreferencias } from "@/lib/oportunidades/notificacoes.server";
import { ROTULO_AGENTE } from "@/lib/oportunidades/organizacao";
import { lerContexto } from "@/lib/oportunidades/organizacao.server";
import { visitanteAtual } from "@/lib/supabase-auth";
import { CatalogoClient } from "./CatalogoClient";

export const metadata: Metadata = {
  title: "Janelas · Mapa de Oportunidades · PONTE",
  robots: { index: false, follow: false },
};

/**
 * A tela de entrada do Mapa: as janelas que a entidade de quem olha pode
 * pleitear, das quatro fontes do catálogo v2.
 *
 * Até 12/09/2026 o `/mapa` era a central de avisos, que foi para `/mapa/avisos`.
 * A troca foi decisão do titular: a fila de avisos só enche quando algo muda, e
 * passou a maior parte dos dias vazia — quem abria o Mapa caía numa tela sem
 * nada. O catálogo é o mapa propriamente dito.
 *
 * Os avisos continuam no contrato v1.1 com a chave atual, e o re-chaveamento
 * espera a correção do id do Transferegov no radar (ver o guia, seção 3g).
 */
export default async function JanelasPage() {
  // Layout e página renderizam em paralelo: o redirect do layout decide a
  // resposta, mas não impede esta função de rodar. Mesmo guarda da central.
  const visitante = await visitanteAtual();
  if (!visitante || visitante.status !== "aprovado") return null;

  const [leitura, catalogoV1, contexto, preferencias, seguidas] = await Promise.all([
    lerCatalogoV2(),
    // Só pelos códigos do Transferegov, que o v2 não traz. Sem o v1, o cartão
    // perde o código e continua com o botão da consulta.
    lerCatalogo(),
    lerContexto(),
    lerPreferencias(),
    lerSeguidas(),
  ]);

  // O instante vem do servidor: calcular "hoje" no navegador faria servidor e
  // cliente discordarem na hidratação, e o relógio do cliente é o menos confiável.
  const hoje = hojeLocal(new Date());

  if (leitura.estado !== "ok") {
    return <CatalogoIndisponivel estado={leitura.estado} />;
  }

  const ativa = contexto.ativa;
  // A geografia é da entidade; os temas, da pessoa — o corte da oport_6.
  const quem = ativa ? { tipo: ativa.tipo, uf: ativa.uf, temas: preferencias.temas } : null;
  const codigos = catalogoV1 ? codigosPorJanela(leitura.payload, catalogoV1) : new Map<string, string[]>();
  const vista = montarCatalogo(leitura.payload, quem, hoje, codigos);

  return (
    <CatalogoClient
      vista={vista}
      entidade={ativa ? { nome: ativa.nome, tipo: ROTULO_AGENTE[ativa.tipo], uf: ativa.uf } : null}
      seguindoTemas={preferencias.temas.length > 0}
      janelasSeguidas={seguidas ? [...seguidas].filter((k) => k.startsWith("janela:")).map((k) => k.slice("janela:".length)) : null}
    />
  );
}

/**
 * Dois estados distintos, com duas frases distintas. "Ainda não publicado" é
 * esperado durante a implantação; "indisponível" é defeito, porque a Action
 * valida antes de aceitar o arquivo.
 */
function CatalogoIndisponivel({ estado }: { estado: "ausente" | "invalido" }) {
  const ausente = estado === "ausente";
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">Janelas abertas</p>
        <h1 className="pa-titulo">
          {ausente ? "O catálogo multifonte ainda não foi publicado" : "O catálogo está indisponível agora"}
        </h1>
        <p>
          {ausente
            ? "Ele passa a existir na próxima sincronização com o radar, que roda todo dia. Enquanto isso, os avisos do Transferegov continuam funcionando."
            : "O arquivo do catálogo não pôde ser lido. A equipe é avisada pelo registro do servidor. Os avisos do Transferegov continuam funcionando."}
        </p>
        <div className="pa-linha">
          <Link href="/mapa/avisos" className="pa-btn">
            Ver os avisos
          </Link>
        </div>
      </div>
    </div>
  );
}
