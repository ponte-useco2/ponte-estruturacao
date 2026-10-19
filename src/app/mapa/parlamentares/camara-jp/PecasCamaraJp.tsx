/**
 * Peças comuns às telas das emendas da Câmara de João Pessoa (J2, 16/10/2026): o aviso, a data do dado, a nota de
 * método e a tela de "ainda não publicado". Só desenham o que recebem; a leitura mora em `emendas-jp.server.ts`.
 */
import type { ReactNode } from "react";
import { URL_PAINEL_PREFEITURA, type ExecucaoEjp } from "@/lib/oportunidades/emendas-jp";
import { dataHoraBrasilia } from "@/lib/oportunidades/rodadas";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { dinheiro } from "../PecasParlamentares";
import "../parlamentares.css";

export const AVISO_CAMARA_JP =
  "Uso interno da PONTE. Vereador é agente público, com o nome como o painel da Prefeitura e o SAPL da Câmara publicam e a " +
  "pessoa pela tabela curada da PONTE (ligada pelo código do autor no SAPL, nunca por semelhança de nome). Credor pessoa " +
  "jurídica aparece só nestas telas; pessoa física é só somada; dado bancário nunca é guardado.";

/** A data do dado, sempre à vista: a hora do painel e a rodada. */
export function CarimboEjp({ execucao }: { execucao: ExecucaoEjp }) {
  return (
    <p className="pa-nota mp-parl-carimbo">
      Painel da Prefeitura de João Pessoa lido em <strong>{dataHoraBrasilia(execucao.dadoAte ?? execucao.concluidaEm)}</strong>
      {execucao.exercicio ? ` (exercício de ${execucao.exercicio})` : ""}, com o SAPL da Câmara e a despesa do município no TCE-PB. A rodada é
      diária; os anos de 2021 a 2025 vêm dos arquivos do portal da Prefeitura.
    </p>
  );
}

/** Dinheiro que pode faltar: "—" para null e zero. */
export const reais = (v: number | null | undefined): string => dinheiro(v ?? null);

export function NotaDeMetodoEjp({ id }: { id: string }) {
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        Como ler
      </h2>
      <ul className="pa-nota mp-parl-lista">
        <li>
          <strong>Cada ano tem uma fonte.</strong> O exercício corrente vem do{" "}
          <a href={URL_PAINEL_PREFEITURA} rel="noreferrer">
            painel da Prefeitura
          </a>{" "}
          (lido todo dia); 2021 a 2025, dos arquivos de execução do portal da Prefeitura (2023 só tem a posição de agosto). As duas fontes
          nunca se somam no mesmo ano.
        </li>
        <li>
          <strong>Valor original e valor atual.</strong> O original é o da LOA; o atual é o que sobrou depois de remanejamentos e cortes. A
          emenda remanejada de unidade aparece na unidade nova; a linha antiga fica com valor zero e sai das somas.
        </li>
        <li>
          <strong>O vereador.</strong> No exercício corrente, pelo autor da matéria no SAPL da Câmara (o link de cada linha do painel); de
          2021 a 2024, pela lista da LOA publicada no portal, pelo número da emenda. A lista de 2025 não está publicada: o ano aparece sem
          autor.
        </li>
        <li>
          <strong>O empenho com número e data</strong> vem do TCE-PB (código de acompanhamento 3310, “emendas de vereador”, desde 2026),
          ligado à emenda pelo número citado no histórico do empenho. Empenho sem a citação não se liga.
        </li>
        <li>
          <strong>Sem posição, sem nota.</strong> A lista abre por nome. Execução só se compara no mesmo ano. O que chama a atenção é ponto
          para olhar, nunca irregularidade.
        </li>
      </ul>
    </section>
  );
}

export function SemEjpPublicadas({ kicker }: { kicker: string }) {
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha">
        <p className="pa-kicker">{kicker}</p>
        <h1 className="pa-titulo">As emendas da Câmara de João Pessoa ainda não foram publicadas</h1>
        <p>
          O job das emendas de João Pessoa ainda não concluiu a primeira rodada, ou a tabela ainda não está no banco. Quando a rodada concluir,
          esta página mostra os vereadores, a execução de cada emenda e os empenhos.
        </p>
        <p className="pa-linha">
          <LinkMapa href="/mapa/painel/rodadas" className="pa-btn pa-btn-pequeno">
            Ver a saúde das rodadas
          </LinkMapa>
        </p>
      </div>
    </div>
  );
}

export function Secao({ id, titulo, nota, children }: { id: string; titulo: string; nota?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        {titulo}
      </h2>
      {nota && <p className="pa-nota">{nota}</p>}
      {children}
    </section>
  );
}
