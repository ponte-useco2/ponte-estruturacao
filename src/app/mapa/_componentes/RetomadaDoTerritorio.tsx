/**
 * O Pacto de Retomada na página da UF e do Brasil (R2, 05/11/2026): a UF ao lado do Brasil, sem ranking de município.
 * Cadastrado e acima (quem chama confere o nível). Lê sozinho (`lerRetomadaUf`), e a falha não derruba a aba.
 */
import { lerRetomadaUf } from "@/lib/oportunidades/retomada.server";
import { situacoesDoResumo, type ResumoRetomadaUf } from "@/lib/oportunidades/retomada";
import { moedaCurta } from "@/lib/oportunidades/radar";
import { Secao } from "../municipio/[ibge]/relatorio/RelatorioConteudo";
import { TabelaRolagem } from "./TabelaRolagem";

const n = (x: number) => x.toLocaleString("pt-BR");
const dia = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

function Linha({ rotulo, r }: { rotulo: string; r: ResumoRetomadaUf }) {
  return (
    <tr>
      <th scope="row">{rotulo}</th>
      <td className="mp-rel-num">{n(r.obras)}</td>
      <td className="mp-rel-num">{n(r.municipios)}</td>
      <td className="mp-rel-num">{moedaCurta(r.valor_pactuado)}</td>
      <td className="mp-rel-num">{moedaCurta(r.valor_repassado)}</td>
      <td className="mp-rel-num">
        {moedaCurta(r.saldo)} ({n(r.processos_com_saldo)})
      </td>
      <td className="mp-rel-num">
        {moedaCurta(r.saldo_recente)} ({n(r.processos_saldo_recente)})
      </td>
      <td className="mp-rel-num">{n(r.diligencias_abertas)}</td>
    </tr>
  );
}

export async function RetomadaDoTerritorio({ uf }: { uf: string }) {
  const l = await lerRetomadaUf(uf);
  if (l.estado === "sem_dado") return null;
  const titulo = "Obras da educação no Pacto de Retomada (FNDE)";
  if (l.estado === "falha") {
    return (
      <Secao id="uf-retomada" titulo={titulo}>
        <p className="pa-nota">A leitura do Pacto de Retomada falhou agora; o resto da página não depende dela.</p>
      </Secao>
    );
  }
  const base = l.uf ?? l.brasil;
  if (!base) return null;
  return (
    <Secao
      id="uf-retomada"
      titulo={titulo}
      nota={`Plataforma Antonieta de Barros do FNDE, rodada de ${dia(l.referencia)}. Escolas, creches e quadras no Pacto Nacional pela Retomada de Obras (Lei 14.719/2023).`}
    >
      <TabelaRolagem rotulo="Pacto de Retomada">
        <table className="mp-tabela">
          <thead>
            <tr>
              <th scope="col">Recorte</th>
              <th scope="col">Obras</th>
              <th scope="col">Municípios</th>
              <th scope="col">Pactuado</th>
              <th scope="col">Repassado</th>
              <th scope="col">Saldo em conta (processos)</th>
              <th scope="col">Saldo com extrato de até 1 ano (processos)</th>
              <th scope="col">Pedidos em diligência</th>
            </tr>
          </thead>
          <tbody>
            {l.uf && <Linha rotulo={l.uf.uf} r={l.uf} />}
            {l.brasil && <Linha rotulo="Brasil" r={l.brasil} />}
          </tbody>
        </table>
      </TabelaRolagem>
      <p className="pa-nota">
        {l.uf ? `Na ${l.uf.uf}, por situação: ` : "No Brasil, por situação: "}
        {situacoesDoResumo(base)
          .map((s) => `${s.situacao.toLowerCase()} ${n(s.obras)}`)
          .join(" · ")}
        . O saldo é do processo e soma uma vez por processo, mesmo com várias obras; há extratos parados há anos, por isso a coluna do extrato recente.
        {l.uf?.uf === "PB" ? " A lista de cada município está na aba Controle da página dele." : ""}
      </p>
    </Secao>
  );
}
