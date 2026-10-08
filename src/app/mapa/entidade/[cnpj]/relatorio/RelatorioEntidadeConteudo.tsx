/**
 * O relatório da entidade para imprimir (C1c, 08/10/2026; B11, 9.5): a página da entidade inteira numa peça só, no
 * modelo do relatório do município (`municipio/[ibge]/relatorio`). A4 pelas regras de impressão do `mapa.css`
 * (`mp-laudo`): a trilha, a data do dado, as ações (fora do papel), o aviso, as seções na ordem das abas, as fontes com
 * a data de cada uma e a assinatura da PONTE (no fim de "Fontes, datas e limites").
 *
 * Os blocos são os da página da entidade (`EntidadeConteudo`) e os do relatório do município; aqui só se escolhe a
 * ordem. Ordem das abas: o que trava (em uma página, o que fazer, o fiscal), o resumo (quem é, o cadastro do Mapa das
 * OSC), os instrumentos, o dinheiro federal, o controle e, por fim, as fontes.
 *
 * A OSC que só está no cadastro do Mapa das OSC (E3, sem instrumento nem proposta) tem o relatório do cadastro:
 * quem é, o cadastro (natureza, situação, fundação, áreas, CEBAS, município — sem endereço, dirigentes nem contatos)
 * e as fontes. Quem não é administrador recebe o relatório já sem nomes de fornecedor (`relatorioSemNomes`, na página).
 */
import { formatarData } from "@/lib/oportunidades/central";
import { cnpjLegivel } from "@/lib/oportunidades/fornecedores";
import { ROTULO_ESPECIE, ehMunicipal, urlEntidade } from "@/lib/oportunidades/pagina-entidade";
import { PODE, destinoConvenio, urlMunicipio, type NivelAcesso } from "@/lib/oportunidades/pagina-municipio";
import type { LeituraCadastroOsc } from "@/lib/oportunidades/osc.server";
import type { InstrumentoRelatorio, PropostaRelatorio, Relatorio } from "@/lib/oportunidades/relatorio-municipio";
import type { IdentidadeEntidade } from "@/lib/oportunidades/relatorio-municipio.server";
import { lugarDaEntidade, trilha } from "@/lib/oportunidades/trilha";
import { EstrelaSeguir } from "../../../_componentes/EstrelaSeguir";
import { LinkMapa } from "../../../_componentes/LinkMapa";
import { Trilha } from "../../../_componentes/Trilha";
import { BotaoImprimir } from "../../../fiscal/[ibge]/simular/BotaoImprimir";
import {
  BlocoControle,
  BlocoConvenios,
  BlocoEmendas,
  BlocoFontes,
  BlocoFornecedores,
  BlocoPassos,
  BlocoPix,
  BlocoPropostas,
  BlocoTcePb,
  Cartoes,
  EmOrdem,
  ListaAchados,
  Secao,
} from "../../../municipio/[ibge]/relatorio/RelatorioConteudo";
import {
  AvisoFiscal,
  CadastroMapa,
  Carteira,
  EntidadeVazia,
  ListaPropostas,
  PorOrgao,
  Sobre,
  comFontesDaEntidade,
  ehPb,
  entidadeLegivel,
  temAvisoFiscal,
} from "../EntidadeConteudo";

// Os mesmos avisos do relatório do município (lá não são exportados); o do cadastro é só desta página.
const AVISO_INTERNO =
  "Uso interno da PONTE. Leitura automática de fontes públicas, cada uma com a sua data (ver o fim). «A conferir» é ponto para olhar, " +
  "nunca irregularidade; não substitui certidão, parecer do concedente, decisão do Tribunal de Contas nem orientação jurídica.";
const AVISO =
  "Leitura automática de fontes públicas pela PONTE, cada uma com a sua data (ver o fim). «A conferir» é ponto para olhar, nunca " +
  "irregularidade; não substitui certidão, parecer do concedente, decisão do Tribunal de Contas nem orientação jurídica.";
const AVISO_CADASTRO =
  "Leitura automática de fontes públicas pela PONTE, cada uma com a sua data (ver o fim). O cadastro é o do Mapa das OSC (Ipea), com " +
  "dados da Receita Federal; não substitui certidão nem a consulta ao cadastro da Receita.";

const data = (iso: string | null | undefined) => (iso ? formatarData(iso.slice(0, 10)) : "—");

/**
 * A capacidade fiscal na entidade: o aviso de onde mora o fiscal (o CAUC e a LRF são do município; a OSC não os tem) e
 * os pontos fiscais que a fila da entidade traz. Na página, os dois ficam na aba "O que trava e o que destrava"; o
 * relatório não repete a fila inteira (cada ponto vai na seção do seu assunto, como no relatório do município), e o
 * fiscal não tem bloco próprio na entidade, por isso a seção.
 */
function PontosFiscais({ e, r, destino }: { e: IdentidadeEntidade; r: Relatorio; destino: (nr: string) => string }) {
  const achados = r.achados.filter((a) => a.dimensao === "fiscal" && a.nivel !== "em_dia");
  if (!achados.length && !temAvisoFiscal(e)) return null;
  return (
    <Secao id="ent-rel-fiscal" titulo="Capacidade fiscal">
      <AvisoFiscal e={e} />
      <ListaAchados achados={achados} destino={destino} />
    </Secao>
  );
}

function Cabeca({
  e,
  r,
  nivel,
  seguindo,
  soCadastro,
}: {
  e: IdentidadeEntidade;
  r: Relatorio;
  nivel: NivelAcesso;
  seguindo?: boolean;
  soCadastro: boolean;
}) {
  const csv = `/mapa/entidade/${e.cnpj}/csv`;
  return (
    <div className="pa-pilha mp-radar-cabeca">
      {/* A entidade volta à aba de onde o relatório se abre ("Relatório e dados"); a OSC só do cadastro não tem abas. */}
      <Trilha elos={trilha(lugarDaEntidade(e, soCadastro ? undefined : "relatorio"), "Relatório completo")} />
      <p className="pa-kicker">
        Relatório completo da entidade · {ROTULO_ESPECIE[e.especie]} · CNPJ {cnpjLegivel(e.cnpj)}
      </p>
      <h1 className="pa-titulo">{e.nome}</h1>
      <p className="pa-sub">
        {soCadastro ? "Cadastro no Mapa das OSC" : "Convênios, propostas, dinheiro federal e controle"}
        {e.municipio ? ` · sede em ${e.municipio}/${e.uf ?? "—"}` : ""} · dados lidos em {data(r.hoje)}
      </p>
      <p className="mp-nao-imprimir mp-laudo-acoes">
        {seguindo !== undefined && <EstrelaSeguir tipo="entidade" chave={e.cnpj} nome={`a entidade ${e.nome}`} seguindo={seguindo} />}
        <BotaoImprimir />
        {!soCadastro && (
          <>
            <a href={csv} className="pa-btn pa-btn-pequeno">
              Baixar os instrumentos (CSV)
            </a>
            <a href={`${csv}?tipo=achados`} className="pa-btn pa-btn-pequeno">
              Baixar os pontos do relatório (CSV)
            </a>
          </>
        )}
        <LinkMapa href={urlEntidade(e.cnpj)} className="pa-btn pa-btn-pequeno">
          Abrir a página da entidade
        </LinkMapa>
        {ehPb(e.cod_ibge) && (
          <LinkMapa href={urlMunicipio(e.cod_ibge as string)} className="pa-btn pa-btn-pequeno">
            Abrir a página do município
          </LinkMapa>
        )}
        {PODE.interno(nivel) && ehPb(e.cod_ibge) && ehMunicipal(e.especie) && (
          <LinkMapa href={`/mapa/painel/municipio/${e.cod_ibge}?quem=todos`} className="pa-btn pa-btn-pequeno">
            Abrir a ficha no painel
          </LinkMapa>
        )}
      </p>
      <p className="mp-fiscal-aviso">{soCadastro ? AVISO_CADASTRO : PODE.interno(nivel) ? AVISO_INTERNO : AVISO}</p>
    </div>
  );
}

export function RelatorioEntidadeConteudo({
  e: entidade,
  r: relatorio,
  instrumentos,
  propostas,
  osc,
  nivel,
  seguindo,
}: {
  e: IdentidadeEntidade;
  r: Relatorio;
  instrumentos: InstrumentoRelatorio[];
  propostas: PropostaRelatorio[];
  osc: LeituraCadastroOsc;
  nivel: NivelAcesso;
  seguindo?: boolean;
}) {
  const e = entidadeLegivel(entidade);
  const soCadastro = !instrumentos.length && !propostas.length;
  const r = comFontesDaEntidade(relatorio, e, osc, soCadastro);
  const destino = destinoConvenio(nivel);

  if (soCadastro) {
    return (
      <div className="pa-pagina mp-radar mp-laudo mp-rel">
        <Cabeca e={e} r={r} nivel={nivel} seguindo={seguindo} soCadastro />
        <EntidadeVazia e={e} cadastro />
        <Sobre e={e} instrumentos={instrumentos} propostas={propostas} />
        <CadastroMapa osc={osc} hoje={r.hoje} especie={e.especie} />
        <BlocoFontes r={r} />
      </div>
    );
  }

  return (
    <div className="pa-pagina mp-radar mp-laudo mp-rel">
      <Cabeca e={e} r={r} nivel={nivel} seguindo={seguindo} soCadastro={false} />

      {/* O que trava e o que destrava, e o resumo */}
      <Secao id="ent-rel-pagina" titulo="Em uma página">
        <Cartoes r={r} />
        <ListaAchados achados={r.destaques} destino={destino} fila="com_classe" hoje={r.hoje} />
        <EmOrdem r={r} />
      </Secao>
      <BlocoPassos r={r} />
      <Sobre e={e} instrumentos={instrumentos} propostas={propostas} />
      <CadastroMapa osc={osc} hoje={r.hoje} especie={e.especie} />
      <PontosFiscais e={e} r={r} destino={destino} />

      {/* Instrumentos */}
      <BlocoConvenios r={r} destino={destino} />
      <Carteira instrumentos={instrumentos} destino={destino} />
      <BlocoPropostas r={r} destino={destino} />
      <ListaPropostas propostas={propostas} aberta />

      {/* Dinheiro federal */}
      <PorOrgao instrumentos={instrumentos} />
      <BlocoEmendas r={r} />
      <BlocoPix r={r} destino={destino} />
      <BlocoTcePb r={r} />
      <BlocoFornecedores r={r} destino={destino} />

      {/* Controle e, por fim, as fontes com a assinatura */}
      <BlocoControle r={r} destino={destino} />
      <BlocoFontes r={r} />
    </div>
  );
}
