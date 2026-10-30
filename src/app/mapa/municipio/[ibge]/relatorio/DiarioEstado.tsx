/**
 * O Diário Oficial do Estado e a Transparência PB no relatório do município (oport_61, 30/10/2026). Só para o
 * administrador, como as emendas estaduais: a lista ato a ato traz CNPJ e valor "a conferir", e abrir para outros é
 * decisão do titular. Três partes, que nunca se somam entre si:
 *   1. atos da prefeitura e da câmara publicados no DOE (contagem por classe e ano; os mais recentes com o PDF e a
 *      página; "pessoal" só conta);
 *   2. dinheiro do Estado: transferências à prefeitura e aos fundos (o pagamento direto à prefeitura fica à parte) e, a
 *      conferir, a despesa com o município informado na nota (nunca para a capital);
 *   3. convênios do Estado: com o ente municipal, e, em outra lista, de quem só tem sede no município.
 */
import {
  atosPorAno,
  atosPorClasse,
  avisoDespesaLocal,
  despesaLocalPorAno,
  IBGE_CAPITAL,
  repassesPorAno,
  separarConvenios,
  totalConcedente,
  transferenciasPorOrgao,
  type ConvenioTpb,
  type LeituraDoeMunicipio,
} from "@/lib/oportunidades/doe-municipal";
import { dataBrasilia } from "@/lib/oportunidades/datas";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { TabelaRolagem } from "../../../_componentes/TabelaRolagem";
import type { ReactNode } from "react";

const n = (x: number) => x.toLocaleString("pt-BR");
const dia = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
const CONVENIOS_NA_LISTA = 15;

// A mesma moldura de seção do relatório (`Secao` de RelatorioConteudo), aqui para não importar de volta o arquivo que
// importa este.
function Secao({ id, titulo, nota, children }: { id: string; titulo: string; nota?: ReactNode; children: ReactNode }) {
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

function TabelaConvenios({ lista, rotulo }: { lista: ConvenioTpb[]; rotulo: string }) {
  return (
    <TabelaRolagem rotulo={rotulo}>
      <table className="mp-tabela">
        <thead>
          <tr>
            <th scope="col">Ano</th>
            <th scope="col">Instrumento</th>
            <th scope="col">Concedente</th>
            <th scope="col">Convenente</th>
            <th scope="col">Objeto</th>
            <th scope="col" className="mp-num">
              Do Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {lista.slice(0, CONVENIOS_NA_LISTA).map((c, i) => (
            <tr key={i}>
              <td>{c.ano ?? "—"}</td>
              <td>
                {c.link ? (
                  <a href={c.link} target="_blank" rel="noopener noreferrer">
                    {c.instrumento ?? "instrumento"} {c.numero ?? ""}
                  </a>
                ) : (
                  `${c.instrumento ?? "—"} ${c.numero ?? ""}`
                )}
              </td>
              <td>{c.concedente ?? "—"}</td>
              <td>{c.convenente ?? "—"}</td>
              <td>{c.objeto ?? "—"}</td>
              <td className="mp-num">{c.valor_concedente === null ? "—" : moedaCurta(c.valor_concedente)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TabelaRolagem>
  );
}

export function DiarioEstadoDoMunicipio({ leitura, ibge, municipio }: { leitura: LeituraDoeMunicipio; ibge: string; municipio: string }) {
  const titulo = "Diário Oficial do Estado e Transparência PB";
  if (leitura.estado === "sem_dado") return null;
  if (leitura.estado === "falha") {
    return (
      <Secao id="rel-doe" titulo={titulo}>
        <p className="pa-nota">A leitura do Diário Oficial e da Transparência PB falhou agora; o resto do relatório não depende dela.</p>
      </Secao>
    );
  }
  if (leitura.estado === "fora_do_escopo") {
    return (
      <Secao id="rel-doe" titulo={titulo}>
        <p className="pa-nota">
          {municipio} ainda não foi lido nesta fonte: o pacote carregado é uma amostra de municípios. Isso não quer dizer que não há atos nem repasses.
        </p>
      </Secao>
    );
  }
  const classes = atosPorClasse(leitura.meses);
  const anosAtos = atosPorAno(leitura.meses);
  const totalAtos = classes.reduce((a, c) => a + c.n, 0);
  const repAno = repassesPorAno(leitura.repasses);
  const porOrgao = transferenciasPorOrgao(leitura.repasses).slice(0, 8);
  const local = ibge === IBGE_CAPITAL ? [] : despesaLocalPorAno(leitura.despesaLocal);
  const conv = separarConvenios(leitura.convenios);
  return (
    <Secao
      id="rel-doe"
      titulo={titulo}
      nota={`Atos publicados no Diário Oficial do Estado e despesas e convênios do Governo do Estado (API dados.pb.gov.br), lidos até ${leitura.dadoAte ? dataBrasilia(leitura.dadoAte) : "—"}. Classificação automática dos atos: "a conferir" onde a amostra não confirmou a classe e em todo ato lido por OCR.`}
    >
      <div className="mp-rel-sub">
        <h3 id="rel-doe-atos" className="mp-rel-h3">
          Atos da prefeitura e da câmara no Diário Oficial do Estado
        </h3>
        {totalAtos ? (
          <>
            <p className="pa-nota">
              {n(totalAtos)} atos de {anosAtos[0]?.ano} a {anosAtos[anosAtos.length - 1]?.ano}:{" "}
              {classes.map((c) => `${c.classe} ${n(c.n)}${c.confianca && c.confianca !== "alta" ? " (a conferir)" : ""}`).join(" · ")}. Atos de pessoal só
              são contados, sem título nem nome. O município pode publicar também em diário próprio, que não está aqui.
            </p>
            {leitura.atos.length ? (
              <TabelaRolagem rotulo="Atos mais recentes no Diário Oficial do Estado">
                <table className="mp-tabela">
                  <thead>
                    <tr>
                      <th scope="col">Edição</th>
                      <th scope="col">Órgão</th>
                      <th scope="col">Ato</th>
                      <th scope="col">Classe</th>
                      <th scope="col" className="mp-num">
                        Valor (a conferir)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leitura.atos.map((a) => (
                      <tr key={a.ato_id}>
                        <td>
                          <a href={a.link} target="_blank" rel="noopener noreferrer">
                            {dia(a.data_edicao)}
                            {a.pagina ? `, p. ${a.pagina}` : ""}
                          </a>
                        </td>
                        <td>{a.orgao ?? "—"}</td>
                        <td>
                          {a.tipo ?? "—"} {a.numero ?? ""}
                          {a.cnpjs.length ? <span className="pa-mono"> · CNPJ {a.cnpjs.join(", ")}</span> : null}
                        </td>
                        <td>
                          {a.classe}
                          {a.subclasse ? ` (${a.subclasse})` : ""}
                          {a.confianca !== "alta" ? " · a conferir" : ""}
                          {a.origem_texto === "ocr" ? " · OCR" : ""}
                        </td>
                        <td className="mp-num">{a.valor_max === null ? "—" : moedaCurta(a.valor_max)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabelaRolagem>
            ) : null}
          </>
        ) : (
          <p className="pa-nota">Nenhum ato da prefeitura ou da câmara foi achado no Diário Oficial do Estado no período lido; o município pode publicar em diário próprio.</p>
        )}
      </div>

      <div className="mp-rel-sub">
        <h3 id="rel-doe-repasses" className="mp-rel-h3">
          Transferências do Estado à prefeitura e aos fundos municipais
        </h3>
        {repAno.length ? (
          <>
            <TabelaRolagem rotulo="Transferências do Estado por ano">
              <table className="mp-tabela">
                <thead>
                  <tr>
                    <th scope="col">Ano</th>
                    <th scope="col" className="mp-num">
                      Transferências pagas
                    </th>
                    <th scope="col" className="mp-num">
                      Pagamento direto à prefeitura (à parte)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {repAno.map((r) => (
                    <tr key={r.ano}>
                      <td>{r.ano}</td>
                      <td className="mp-num">
                        {moedaCurta(r.transferencia)}
                        {r.mediaConfianca ? " *" : ""}
                      </td>
                      <td className="mp-num">{moedaCurta(r.direto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaRolagem>
            <p className="pa-nota">
              Notas de empenho do Estado pagas ao CNPJ da prefeitura ou, marcado com *, a fundo ou órgão municipal achado pelo nome do credor (confiança
              média). Sem as notas de emenda parlamentar, que estão no bloco da Assembleia. O pagamento direto (tributo, contribuição, tarifa,
              ressarcimento) não é repasse e não soma.
              {porOrgao.length ? ` Por órgão: ${porOrgao.map((o) => `${o.orgao} ${moedaCurta(o.pago)}`).join(" · ")}.` : ""}
            </p>
          </>
        ) : (
          <p className="pa-nota">Nenhuma nota de empenho do Estado paga à prefeitura ou a fundo municipal no período lido.</p>
        )}
        <p className="pa-nota">
          {avisoDespesaLocal(ibge)}
          {local.length ? ` Despesa do Estado com ${municipio} informado na nota, paga: ${local.map((l) => `${l.ano} ${moedaCurta(l.pago)}`).join(" · ")}.` : ""}
        </p>
      </div>

      <div className="mp-rel-sub">
        <h3 id="rel-doe-convenios" className="mp-rel-h3">
          Convênios do Estado
        </h3>
        <p className="pa-nota">
          Com o ente municipal (prefeitura, câmara, fundos, secretarias): {n(conv.ente.length)}, {moedaCurta(totalConcedente(conv.ente))} do Estado. De
          entidades só sediadas em {municipio}: {n(conv.sediado.length)}, em lista à parte (não somam ao município). Lista da CGE; o tipo do convenente
          vem pelo nome, porque a fonte não traz o CNPJ.
        </p>
        {conv.ente.length ? <TabelaConvenios lista={conv.ente} rotulo="Convênios do Estado com o ente municipal" /> : null}
        {conv.sediado.length ? (
          <details>
            <summary className="pa-nota">Convênios de entidades sediadas no município ({n(conv.sediado.length)}; os {CONVENIOS_NA_LISTA} mais recentes)</summary>
            <TabelaConvenios lista={conv.sediado} rotulo="Convênios do Estado com entidades sediadas no município" />
          </details>
        ) : null}
      </div>
    </Secao>
  );
}
