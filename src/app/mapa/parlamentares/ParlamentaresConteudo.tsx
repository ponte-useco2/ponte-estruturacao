/**
 * A lista dos autores de emendas com recurso para a Paraíba (onda 14, parte 2, B, 13/10/2026). Recebe a leitura pronta
 * (`lerParlamentares`, em `emendas.server.ts`); aqui só se apresenta.
 *
 * O desenho é o do estudo da onda 13 (B, seção 7.1), com as decisões do titular:
 *   · a ordem é por tipo e nome; não há posição, medalha, nota única nem cor de "bom" ou "ruim";
 *   · as colunas são dos canais (convênio, Pix, saúde fundo a fundo e pago ao favorecido), com o válido e o pago, mais os
 *     municípios atendidos ("n de 223"), os caducados e a fila; não há coluna de "% executado", que fora da safra engana;
 *   · os 383 autores ficam em quatro grupos (`grupoDeDestino`): os com destino público na PB primeiro, os que só pagaram
 *     entidade com sede aqui à parte. A lista não traz o destino linha a linha, então a separação usa as colunas de
 *     `emd_autores`; a ficha de cada autor separa com `separarDestino`, e a nota de cada grupo diz a regra;
 *   · a data do dado (o arquivo do Portal), as propostas do FNS ainda sem detalhe e a nota de método sempre à vista.
 *
 * Parlamentar, bancada e comissão são agentes públicos: o nome é o publicado para o código. Nenhum nome de pessoa
 * física e nenhum nome de entidade nesta tela.
 */
import {
  ROTULO_CANAL,
  ROTULO_TIPO_AUTOR,
  TIPOS_AUTOR,
  rotuloTipoAutor,
  type AutorEmendas,
  type ExecucaoEmendas,
  type TipoAutor,
} from "@/lib/oportunidades/emendas";
import {
  contarPorTipo,
  listaDaTela,
  municipiosDe223,
  periodoDoAutor,
  urlParlamentar,
  urlParlamentares,
  type GrupoDaLista,
  type GrupoDestino,
} from "@/lib/oportunidades/parlamentares-tela";
import { Tag } from "../../_design/primitivos";
import { LinkMapa } from "../_componentes/LinkMapa";
import { TabelaRolagem } from "../_componentes/TabelaRolagem";
import { CarimboDoDado, CartaoNumero, CelulaValidoPago, NotaDeMetodo, dinheiro, n } from "./PecasParlamentares";

const AVISO =
  "Uso interno da PONTE, só administrador até a revisão jurídica. Parlamentar, bancada e comissão são agentes públicos, com o nome " +
  "como o Portal publica para o código. Nenhuma pessoa física aparece. Os números de execução dependem também do município, da " +
  "entidade e do órgão.";

export function ParlamentaresConteudo({ execucao, autores, tipo }: { execucao: ExecucaoEmendas; autores: AutorEmendas[]; tipo: TipoAutor | null }) {
  const grupos = listaDaTela(autores, tipo);
  const porTipo = contarPorTipo(autores);
  const coletivos = autores.filter((a) => a.coletivo).length;
  const noRecorte = grupos.reduce((s, g) => s + g.autores.length, 0);
  const contaGrupo = (id: GrupoDestino) => grupos.find((g) => g.id === id)?.autores.length ?? 0;

  return (
    <div className="pa-pagina mp-radar mp-parl">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Painel · parlamentares</p>
        <h1 className="pa-titulo">Autores de emendas com recurso para a Paraíba</h1>
        <p className="pa-sub">
          {n(autores.length)} autores ({n(coletivos)} de autoria coletiva), por tipo e nome. Para cada um, o que chegou pelos canais com
          destino: convênio, Pix, saúde fundo a fundo e pago ao favorecido (o pagamento direto do Portal), com o válido e o pago, os municípios atendidos, o
          que caducou e o que está na fila. Cada nome abre a ficha do autor.
        </p>
        <p className="mp-fiscal-aviso">{AVISO}</p>
        <CarimboDoDado execucao={execucao} />
        <p className="pa-linha">
          <LinkMapa href="/mapa/painel" className="pa-btn pa-btn-pequeno">
            Voltar ao painel de execução
          </LinkMapa>
        </p>
      </div>

      <div className="pa-grade pa-grade-4 mp-painel-cartoes">
        <CartaoNumero titulo="Destino público na PB" numero={n(contaGrupo("publico"))} nota="com município atendido, ou Pix e FNS válidos" />
        <CartaoNumero titulo="Convênio sem município" numero={n(contaGrupo("convenio_sem_municipio"))} nota="com entidade sediada aqui ou com o estado" />
        <CartaoNumero titulo="Só entidade com sede na PB" numero={n(contaGrupo("entidade"))} nota="só pago ao favorecido, sem destino público" />
        <CartaoNumero titulo="Sem canal com valor" numero={n(contaGrupo("sem_canal"))} nota="só no catálogo, só proposta ou só pessoa física" />
      </div>

      <nav aria-label="Filtrar os autores por tipo" className="mp-nao-imprimir">
        <ul className="mp-parl-filtro">
          <li>
            <ChipTipo href={urlParlamentares(null)} ativo={tipo === null} rotulo="Todos" conta={autores.length} />
          </li>
          {TIPOS_AUTOR.filter((t) => t !== "outro" || porTipo.outro > 0).map((t) => (
            <li key={t}>
              <ChipTipo href={urlParlamentares(t)} ativo={tipo === t} rotulo={ROTULO_TIPO_AUTOR[t]} conta={porTipo[t]} />
            </li>
          ))}
        </ul>
      </nav>
      <p className="pa-nota" aria-live="polite">
        {tipo ? `Mostrando ${n(noRecorte)} ${noRecorte === 1 ? "autor" : "autores"} do tipo ${ROTULO_TIPO_AUTOR[tipo].toLowerCase()}.` : `Mostrando os ${n(noRecorte)} autores.`}
      </p>

      {grupos.map((g) => (
        <Grupo key={g.id} g={g} tipo={tipo} />
      ))}

      <NotaDeMetodo id="parl-como-ler" />
      <section aria-labelledby="parl-colunas" className="mp-radar-secao">
        <h2 id="parl-colunas" className="mp-radar-h2">
          O que cada coluna diz
        </h2>
        <ul className="pa-nota mp-parl-lista">
          <li>
            <strong>Convênio</strong>: o valor da emenda nos convênios assinados e não extintos (válido) e o desembolso, na fatia da emenda
            (pago).
          </li>
          <li>
            <strong>Pix</strong>: a transferência especial, só os planos prontos para pagar (válido) e o pago. O plano “gêmeo” não soma.
          </li>
          <li>
            <strong>Saúde fundo a fundo</strong>: as propostas do FNS não canceladas nem arquivadas (válido) e o pago ao fundo, no rateio
            por autor.
          </li>
          <li>
            <strong>{ROTULO_CANAL.favorecido}</strong>: o pagamento direto que o Portal mostra ao favorecido e nenhum outro canal da mesma emenda já mostra.
            Inclui prefeitura e fundo pagos por outras modalidades, além de entidade e empresa.
          </li>
          <li>
            <strong>Municípios</strong>: os atendidos, prefeitura ou fundo municipal, com instrumento válido ou pago ao favorecido. Empresa
            ou entidade com sede no município não conta.
          </li>
          <li>
            <strong>Caducados</strong>: propostas de convênio nunca assinadas, depois de 31/12 do ano seguinte ao da emenda. Ficam fora da
            fila.
          </li>
          <li>
            <strong>Na fila</strong>: instrumentos em que o dado diz de quem é a vez (concedente, proponente ou autor). A vez só aparece
            quando o dado diz.
          </li>
        </ul>
      </section>
    </div>
  );
}

function ChipTipo({ href, ativo, rotulo, conta }: { href: string; ativo: boolean; rotulo: string; conta: number }) {
  return (
    <LinkMapa href={href} className={`pa-chip${ativo ? " pa-ativo" : ""}`} aria-current={ativo ? "page" : undefined} scroll={false}>
      {rotulo} <span className="pa-chip-contagem">{n(conta)}</span>
    </LinkMapa>
  );
}

function Grupo({ g, tipo }: { g: GrupoDaLista<AutorEmendas>; tipo: TipoAutor | null }) {
  const id = `parl-grupo-${g.id}`;
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        {g.titulo}: {n(g.autores.length)}
      </h2>
      <p className="pa-nota mp-parl-grupo-nota">{g.nota}</p>
      {g.autores.length === 0 ? (
        <p className="pa-cartao pa-cartao-plano">
          Nenhum autor {tipo ? `do tipo ${ROTULO_TIPO_AUTOR[tipo].toLowerCase()} ` : ""}neste grupo.
          {tipo && (
            <>
              {" "}
              <LinkMapa href={urlParlamentares(null)}>Ver todos os tipos</LinkMapa>
            </>
          )}
        </p>
      ) : (
        <TabelaRolagem rotuloId={id}>
          {g.id === "publico" || g.id === "convenio_sem_municipio" ? (
            <TabelaCanais autores={g.autores} />
          ) : g.id === "entidade" ? (
            <TabelaEntidade autores={g.autores} />
          ) : (
            <TabelaSemCanal autores={g.autores} />
          )}
        </TabelaRolagem>
      )}
    </section>
  );
}

function CelulaAutor({ a }: { a: AutorEmendas }) {
  return (
    <th scope="row">
      <LinkMapa href={urlParlamentar(a.codigo)} className="mp-tabela-principal">
        {a.nome ?? `Autor ${a.codigo} (sem nome publicado)`}
      </LinkMapa>
      <span className="mp-tabela-secundario">
        código {a.codigo}
        {a.emendas > 0 ? ` · ${n(a.emendas)} ${a.emendas === 1 ? "emenda" : "emendas"}` : ""}
      </span>
      {a.coletivo && <Tag>autoria coletiva</Tag>}
    </th>
  );
}

function CelulaCaducados({ a }: { a: AutorEmendas }) {
  if (a.caducados === 0) return <td className="mp-num">—</td>;
  return (
    <td className="mp-num">
      <span className="mp-tabela-principal">{n(a.caducados)}</span>
      <span className="mp-tabela-secundario">{dinheiro(a.caducado_valor)}</span>
    </td>
  );
}

/** Os grupos com canal de destino: as colunas completas, por canal (válido e pago). */
function TabelaCanais({ autores }: { autores: AutorEmendas[] }) {
  return (
    <table className="mp-tabela">
      <thead>
        <tr>
          <th scope="col">Autor</th>
          <th scope="col">Tipo</th>
          <th scope="col" className="mp-num">
            {ROTULO_CANAL.convenio}
          </th>
          <th scope="col" className="mp-num">
            {ROTULO_CANAL.pix}
          </th>
          <th scope="col" className="mp-num">
            {ROTULO_CANAL.fns}
          </th>
          <th scope="col" className="mp-num">
            {ROTULO_CANAL.favorecido}
          </th>
          <th scope="col">Municípios</th>
          <th scope="col" className="mp-num">
            Caducados
          </th>
          <th scope="col" className="mp-num">
            Na fila
          </th>
          <th scope="col">Anos</th>
        </tr>
      </thead>
      <tbody>
        {autores.map((a) => (
          <tr key={a.codigo}>
            <CelulaAutor a={a} />
            <td>{rotuloTipoAutor(a.tipo)}</td>
            <CelulaValidoPago valido={a.convenio_valido} pago={a.convenio_pago} />
            <CelulaValidoPago valido={a.pix_valido} pago={a.pix_pago} />
            <CelulaValidoPago valido={a.fns_valido} pago={a.fns_pago} />
            <td className="mp-num">{dinheiro(a.favorecido_pago)}</td>
            <td className="mp-nowrap">{municipiosDe223(a.municipios)}</td>
            <CelulaCaducados a={a} />
            <td className="mp-num">{a.na_fila > 0 ? n(a.na_fila) : "—"}</td>
            <td className="mp-nowrap">{periodoDoAutor(a)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Só pago ao favorecido, entidade com sede na PB: o que interessa é o pago e os anos. */
function TabelaEntidade({ autores }: { autores: AutorEmendas[] }) {
  return (
    <table className="mp-tabela">
      <thead>
        <tr>
          <th scope="col">Autor</th>
          <th scope="col">Tipo</th>
          <th scope="col" className="mp-num">
            Pago a entidade com sede na PB
          </th>
          <th scope="col" className="mp-num">
            Caducados
          </th>
          <th scope="col">Anos</th>
        </tr>
      </thead>
      <tbody>
        {autores.map((a) => (
          <tr key={a.codigo}>
            <CelulaAutor a={a} />
            <td>{rotuloTipoAutor(a.tipo)}</td>
            <td className="mp-num">{dinheiro(a.favorecido_pago)}</td>
            <CelulaCaducados a={a} />
            <td className="mp-nowrap">{periodoDoAutor(a)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Sem canal com valor: só o catálogo com a PB na localidade (nunca o bruto, que traz o Brasil inteiro). */
function TabelaSemCanal({ autores }: { autores: AutorEmendas[] }) {
  return (
    <table className="mp-tabela">
      <thead>
        <tr>
          <th scope="col">Autor</th>
          <th scope="col">Tipo</th>
          <th scope="col" className="mp-num">
            Catálogo com a PB na localidade
          </th>
          <th scope="col" className="mp-num">
            Caducados
          </th>
        </tr>
      </thead>
      <tbody>
        {autores.map((a) => (
          <tr key={a.codigo}>
            <CelulaAutor a={a} />
            <td>{rotuloTipoAutor(a.tipo)}</td>
            <td className="mp-num">
              {a.catalogo_empenhado_pb > 0 ? (
                <>
                  <span className="mp-tabela-principal">{dinheiro(a.catalogo_empenhado_pb)}</span>
                  <span className="mp-tabela-secundario">pago {dinheiro(a.catalogo_pago_total_pb)}</span>
                </>
              ) : (
                "—"
              )}
            </td>
            <CelulaCaducados a={a} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}
