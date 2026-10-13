/**
 * A ficha de um autor de emendas (onda 14, parte 2, B, 13/10/2026), em quatro abas pela URL, como a página do município.
 * Recebe a leitura pronta (`lerParlamentar`, em `emendas.server.ts`); aqui só se apresenta. O desenho é o do estudo da
 * onda 13 (B, seções 2 e 7.2):
 *   · **Acesso:** por ano da emenda e canal, o indicado, o válido, o pago e o caducado;
 *   · **Destinação:** o mapa dos 223 com o não atendido à vista, a tabela por município (prefeitura e fundo municipal),
 *     o estadual à parte e a entidade com sede na PB à parte (`separarDestino`), o pago por habitante e a fatia dos
 *     municípios menores (`porHabitante`);
 *   · **Execução:** o pago ÷ válido do autor contra a PB na mesma safra e no mesmo canal (`execucaoNaSafra`), com os
 *     caducados à parte e a fila só contada;
 *   · **Contexto e método:** quem é (a pessoa só da tabela curada; o coletivo diz "autoria coletiva"), o catálogo do
 *     Portal no recorte da PB, as fontes, as definições e os limites.
 *
 * Sem nota, sem posição e sem cor de "bom" ou "ruim". O que chama a atenção é "ponto para olhar". Nenhum nome de pessoa
 * física; nenhum nome de entidade (a leitura do destino não traz, e esta ficha não precisa dele).
 */
import {
  CANAIS,
  FRASE_AUTORIA_COLETIVA,
  datasDaExecucao,
  destinoNaoClassificado,
  execucaoNaSafra,
  porHabitante,
  rotuloCanal,
  rotuloEnteTipo,
  rotuloTipoAutor,
  separarDestino,
  somarDestino,
  type AnoCanalEmendas,
  type AutorEmendas,
  type DestinoEmendas,
  type ExecucaoEmendas,
  type LeituraParlamentar,
  type MunicipioPopulacao,
  type SafraEmendas,
} from "@/lib/oportunidades/emendas";
import { urlMunicipio } from "@/lib/oportunidades/pagina-municipio";
import {
  ABAS_PARLAMENTAR,
  TOTAL_MUNICIPIOS_PB,
  caducadosPorAno,
  cortesDasFaixas,
  linhasPorMunicipio,
  naoAtendidos,
  periodoDoAutor,
  porcento,
  reaisPorHabitante,
  resumoPorCanalETipo,
  serieDoAcesso,
  soPago,
  totaisPorCanal,
  urlParlamentar,
  type AbaParlamentar,
  type LinhaResumo,
} from "@/lib/oportunidades/parlamentares-tela";
import { Tag } from "../../../_design/primitivos";
import { LinkMapa } from "../../_componentes/LinkMapa";
import { TabelaRolagem } from "../../_componentes/TabelaRolagem";
import { CarimboDoDado, CartaoNumero, NotaDeMetodo, dinheiro, n } from "../../parlamentares/PecasParlamentares";
import { MapaDestino } from "./MapaDestino";

type LeituraOk = Extract<LeituraParlamentar, { estado: "ok" }>;

export function ParlamentarConteudo({ leitura, aba }: { leitura: LeituraOk; aba: AbaParlamentar }) {
  const { autor, execucao } = leitura;
  const nomeAba = ABAS_PARLAMENTAR.find((a) => a.id === aba)?.nome ?? "";
  return (
    <div className="pa-pagina mp-radar mp-parl">
      <Cabeca autor={autor} execucao={execucao} />
      <nav aria-label="Partes da ficha do autor" className="mp-mun-abas mp-nao-imprimir">
        {ABAS_PARLAMENTAR.map((a) => (
          <LinkMapa key={a.id} href={urlParlamentar(autor.codigo, a.id)} aria-current={a.id === aba ? "page" : undefined} scroll={false}>
            {a.nome}
          </LinkMapa>
        ))}
      </nav>
      <p className="mp-so-imprimir pa-kicker">{nomeAba}</p>

      {aba === "acesso" && <AbaAcesso autor={autor} anos={leitura.anos} />}
      {aba === "destinacao" && <AbaDestinacao destino={leitura.destino} municipios={leitura.municipios} />}
      {aba === "execucao" && <AbaExecucao autor={autor} anos={leitura.anos} safra={leitura.safra} />}
      {aba === "contexto" && <AbaContexto autor={autor} execucao={execucao} />}
    </div>
  );
}

// ================================================================ cabeçalho

function Cabeca({ autor, execucao }: { autor: AutorEmendas; execucao: ExecucaoEmendas }) {
  return (
    <div className="pa-pilha mp-radar-cabeca">
      <p className="pa-kicker">Parlamentares · autor {autor.codigo}</p>
      <h1 className="pa-titulo">{autor.nome ?? `Autor ${autor.codigo}`}</h1>
      <p className="pa-sub mp-parl-chips">
        <span>código {autor.codigo}</span>
        <span>{rotuloTipoAutor(autor.tipo)}</span>
        {autor.emendas > 0 && (
          <span>
            {n(autor.emendas)} {autor.emendas === 1 ? "emenda" : "emendas"} com canal na PB
          </span>
        )}
        {periodoDoAutor(autor) !== "—" && <span>anos {periodoDoAutor(autor)}</span>}
      </p>
      {autor.coletivo ? (
        <p>
          <Tag>autoria coletiva</Tag> {FRASE_AUTORIA_COLETIVA} Nenhuma pessoa é ligada a este código.
        </p>
      ) : autor.pessoa ? (
        <p>
          Pessoa ligada ao código pela tabela curada da PONTE: <strong>{autor.pessoa}</strong>. O código é do mandato: a mesma pessoa pode
          ter outro.
        </p>
      ) : null}
      <p className="mp-fiscal-aviso">
        Agente público. Uso interno da PONTE, só administrador até a revisão jurídica. A execução depende também do município, da entidade
        e do órgão; o que chama a atenção é ponto para olhar, nunca irregularidade.
      </p>
      <CarimboDoDado execucao={execucao} />
      <p className="pa-linha mp-nao-imprimir">
        <LinkMapa href="/mapa/parlamentares" className="pa-btn pa-btn-pequeno">
          Ver a lista dos autores
        </LinkMapa>
      </p>
    </div>
  );
}

// ================================================================ Acesso

function AbaAcesso({ autor, anos }: { autor: AutorEmendas; anos: AnoCanalEmendas[] }) {
  const totais = totaisPorCanal(anos);
  const serie = serieDoAcesso(anos);
  return (
    <>
      <section aria-labelledby="parl-acesso-canais" className="mp-radar-secao">
        <h2 id="parl-acesso-canais" className="mp-radar-h2">
          O que chegou à PB, por canal
        </h2>
        {totais.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">
            Nenhum canal com valor na PB para este código. Ele aparece só no catálogo do Portal com a PB na localidade, só com proposta
            que não virou instrumento válido, ou só em pagamento a pessoa física, que entra somado e nunca por autor. O catálogo está na
            aba{" "}
            <LinkMapa href={urlParlamentar(autor.codigo, "contexto")} scroll={false}>
              Contexto e método
            </LinkMapa>
            .
          </p>
        ) : (
          <div className="pa-grade pa-grade-4 mp-painel-cartoes">
            {totais.map((t) =>
              soPago(t.canal) ? (
                <CartaoNumero
                  key={t.canal}
                  titulo={rotuloCanal(t.canal)}
                  numero={dinheiro(t.pago)}
                  nota="pago direto ao favorecido, sem outro canal da mesma emenda que o mostre"
                />
              ) : (
                <CartaoNumero
                  key={t.canal}
                  titulo={rotuloCanal(t.canal)}
                  numero={dinheiro(t.valido)}
                  nota={`válido · indicado ${dinheiro(t.indicado)} · pago ${dinheiro(t.pago)}${t.caducado > 0 ? ` · caducado ${dinheiro(t.caducado)}` : ""}`}
                />
              ),
            )}
          </div>
        )}
      </section>

      {serie.length > 0 && (
        <section aria-labelledby="parl-acesso-anos" className="mp-radar-secao">
          <h2 id="parl-acesso-anos" className="mp-radar-h2">
            Por ano da emenda e canal
          </h2>
          <TabelaRolagem rotuloId="parl-acesso-anos">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Ano e canal</th>
                  <th scope="col" className="mp-num">
                    Emendas
                  </th>
                  <th scope="col" className="mp-num">
                    Indicado
                  </th>
                  <th scope="col" className="mp-num">
                    Válido
                  </th>
                  <th scope="col" className="mp-num">
                    Pago
                  </th>
                  <th scope="col" className="mp-num">
                    Caducado
                  </th>
                </tr>
              </thead>
              <tbody>
                {serie.map((l) => (
                  <tr key={`${l.ano}-${l.canal}`}>
                    <th scope="row">
                      <span className="mp-tabela-principal">{l.ano}</span>
                      <span className="mp-tabela-secundario">{rotuloCanal(l.canal)}</span>
                    </th>
                    <td className="mp-num">{n(l.emendas)}</td>
                    <td className="mp-num">{soPago(l.canal) ? "—" : dinheiro(l.indicado)}</td>
                    <td className="mp-num">{soPago(l.canal) ? "—" : dinheiro(l.valido)}</td>
                    <td className="mp-num">{dinheiro(l.pago)}</td>
                    <td className="mp-num">{dinheiro(l.caducado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        </section>
      )}

      <section aria-labelledby="parl-acesso-ler" className="mp-radar-secao">
        <h2 id="parl-acesso-ler" className="mp-radar-h2">
          Como ler o acesso
        </h2>
        <ul className="pa-nota mp-parl-lista">
          <li>
            <strong>Indicado</strong>: o valor da emenda no instrumento (convênio, plano do Pix ou proposta do FNS), assinado ou não.
          </li>
          <li>
            <strong>Válido</strong>: convênio assinado e não extinto, plano do Pix pronto para pagar, proposta do FNS não cancelada nem
            arquivada.
          </li>
          <li>
            <strong>Pago</strong>: o desembolso do convênio na fatia da emenda, o pagamento do Pix, o pago ao fundo no rateio por autor e,
            no pago ao favorecido (o pagamento direto do Portal), o recebido. Este não tem indicado nem válido.
          </li>
          <li>
            <strong>Caducado</strong>: proposta de convênio nunca assinada, depois de 31/12 do ano seguinte ao da emenda. Fica fora da fila
            e da execução.
          </li>
          <li>
            O ano é o da emenda, não o do pagamento. O catálogo do Portal (empenhado e pago da emenda) não soma com estes números e fica na
            aba Contexto e método.
          </li>
        </ul>
      </section>
    </>
  );
}

// ================================================================ Destinação

const somaPago = (linhas: readonly LinhaResumo[]) => linhas.reduce((s, l) => s + l.pago, 0);

function AbaDestinacao({ destino, municipios }: { destino: DestinoEmendas[]; municipios: MunicipioPopulacao[] }) {
  const { municipal, estadual, entidadeComSede } = separarDestino(destino);
  const linhas = linhasPorMunicipio(municipal, municipios);
  const atendidos = linhas.filter((l) => l.atendido);
  const fora = naoAtendidos(linhas, municipios);
  const semDestino = Math.max(0, TOTAL_MUNICIPIOS_PB - atendidos.length);
  const noPago = porHabitante(municipal, municipios, "pago");
  const noValido = porHabitante(municipal, municipios, "valido");
  const cortes = cortesDasFaixas(atendidos.map((l) => l.pagoPorHabitante ?? 0));
  const nomes = new Map(municipios.map((m) => [m.ibge, m.nome]));
  const est = resumoPorCanalETipo(estadual);
  const ent = resumoPorCanalETipo(entidadeComSede);
  // Ente municipal sem município identificado e linha sem tipo de ente: fora das três classes, mas dito na tela.
  const semClasse = somarDestino(destinoNaoClassificado(destino));

  return (
    <>
      <section aria-labelledby="parl-dest-numeros" className="mp-radar-secao">
        <h2 id="parl-dest-numeros" className="mp-radar-h2">
          Nos municípios: prefeitura e fundo municipal
        </h2>
        <div className="pa-grade pa-grade-3 mp-painel-cartoes">
          <CartaoNumero
            titulo="Municípios atendidos"
            numero={`${n(atendidos.length)} de ${TOTAL_MUNICIPIOS_PB}`}
            nota={`${n(semDestino)} ${semDestino === 1 ? "município" : "municípios"} sem destino deste autor`}
          />
          <CartaoNumero
            titulo="Pago por habitante"
            numero={reaisPorHabitante(noPago.valorPorHabitante)}
            nota={
              <>
                pago ÷ {n(noPago.populacaoAtendida)} habitantes, a soma dos {n(noPago.atendidos)} municípios com pagamento; no válido,{" "}
                {reaisPorHabitante(noValido.valorPorHabitante)}
              </>
            }
          />
          <CartaoNumero
            titulo="Fatia dos menores"
            numero={porcento(noPago.fatiaMenores)}
            nota={`do pago foi aos 20% menores municípios da PB, que têm ${porcento(noPago.fatiaPopulacaoMenores)} da população`}
          />
        </div>
      </section>

      <section aria-labelledby="parl-dest-mapa" className="mp-radar-secao">
        <h2 id="parl-dest-mapa" className="mp-radar-h2">
          O mapa dos {TOTAL_MUNICIPIOS_PB}
        </h2>
        <MapaDestino
          linhas={linhas}
          nomes={nomes}
          cortes={cortes}
          titulo={`Mapa dos ${TOTAL_MUNICIPIOS_PB} municípios da Paraíba: ${atendidos.length} com destino deste autor, em faixas de pago por habitante, e ${semDestino} sem destino, hachurados`}
        />
        {municipios.length === 0 ? (
          // Sem a base do fiscal, a leitura devolve a lista vazia: sem nome nem população, não há "não atendido" a listar.
          <p className="pa-nota">
            A base de população dos municípios não pôde ser lida nesta visita: os não atendidos ficam sem nome e o valor por habitante
            fica sem conta. O mapa e a tabela mostram só o que o autor tem.
          </p>
        ) : fora.length > 0 ? (
          <details className="mp-parl-nao-atendidos">
            <summary>
              Os {n(fora.length)} {fora.length === 1 ? "município" : "municípios"} sem destino deste autor
            </summary>
            <p className="pa-nota">{fora.map((m) => m.nome).join(", ")}.</p>
          </details>
        ) : (
          <p className="pa-nota">Todos os municípios da PB têm destino deste autor.</p>
        )}
        <p className="pa-nota">
          O estado e a entidade com sede na PB ficam fora do mapa e do valor por habitante: aparecem à parte, logo abaixo da tabela.
        </p>
      </section>

      <section aria-labelledby="parl-dest-municipios" className="mp-radar-secao">
        <h2 id="parl-dest-municipios" className="mp-radar-h2">
          Por município, em ordem alfabética
        </h2>
        {linhas.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhum destino em prefeitura ou fundo municipal da PB para este autor.</p>
        ) : (
          <TabelaRolagem rotuloId="parl-dest-municipios">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Município</th>
                  <th scope="col" className="mp-num">
                    População
                  </th>
                  <th scope="col">Canais</th>
                  <th scope="col" className="mp-num">
                    Instrumentos
                  </th>
                  <th scope="col" className="mp-num">
                    Válido
                  </th>
                  <th scope="col" className="mp-num">
                    Pago
                  </th>
                  <th scope="col" className="mp-num">
                    Pago por habitante
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.ibge}>
                    <th scope="row">
                      {nomes.has(l.ibge) ? (
                        <LinkMapa href={urlMunicipio(l.ibge, "dinheiro")} className="mp-tabela-principal">
                          {l.nome}
                        </LinkMapa>
                      ) : (
                        <span className="mp-tabela-principal">{l.nome}</span>
                      )}
                      {!l.atendido && <span className="mp-tabela-secundario">só proposta ou caducado, sem instrumento válido</span>}
                    </th>
                    <td className="mp-num">{l.populacao !== null ? n(l.populacao) : "—"}</td>
                    <td>{l.canais.map((c) => rotuloCanal(c)).join(" · ")}</td>
                    <td className="mp-num">{n(l.instrumentos)}</td>
                    <td className="mp-num">{dinheiro(l.valido)}</td>
                    <td className="mp-num">{dinheiro(l.pago)}</td>
                    <td className="mp-num">{reaisPorHabitante(l.pagoPorHabitante)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        )}
        <p className="pa-nota">
          Pago por habitante alto num município pequeno costuma ser uma obra só: é efeito do denominador, e não preferência. O município
          do convenente nem sempre é o lugar do objeto. Ponto para olhar, não conclusão.
        </p>
      </section>

      <SecaoAParte
        id="parl-dest-estadual"
        titulo="Estadual, à parte"
        linhas={est}
        vazio="Nenhum destino no governo ou em fundo estadual da PB."
        nota="O governo e o fundo estadual não têm município: a sede, em João Pessoa, não é o destino. Por isso ficam fora do mapa e do valor por habitante."
      />
      <SecaoAParte
        id="parl-dest-entidade"
        titulo="Pago a entidade com sede na PB, à parte"
        linhas={ent}
        comSede
        vazio="Nenhum pagamento a entidade ou empresa com sede na PB."
        nota="Empresa, organização da sociedade civil, consórcio e outros favorecidos com sede na PB não são destino na PB: o recurso pode atender uma região inteira ou outro lugar. A sede conta município, mas não entra no mapa nem no valor por habitante."
      />
      {(semClasse.pago > 0 || semClasse.valido > 0 || semClasse.indicado > 0) && (
        <p className="pa-nota">
          Fora das três partes acima: {dinheiro(semClasse.pago)} pagos e {dinheiro(semClasse.valido)} válidos em linhas de prefeitura ou
          fundo municipal sem o município identificado, ou sem o tipo do ente. Não entram no mapa, na tabela nem no valor por habitante.
        </p>
      )}
    </>
  );
}

function SecaoAParte({
  id,
  titulo,
  linhas,
  vazio,
  nota,
  comSede = false,
}: {
  id: string;
  titulo: string;
  linhas: LinhaResumo[];
  vazio: string;
  nota: string;
  comSede?: boolean;
}) {
  return (
    <section aria-labelledby={id} className="mp-radar-secao">
      <h2 id={id} className="mp-radar-h2">
        {titulo}
        {linhas.length > 0 ? `: ${dinheiro(somaPago(linhas))} pagos` : ""}
      </h2>
      {linhas.length === 0 ? (
        <p className="pa-cartao pa-cartao-plano">{vazio}</p>
      ) : (
        <TabelaRolagem rotuloId={id}>
          <table className="mp-tabela">
            <thead>
              <tr>
                <th scope="col">Canal e ente</th>
                <th scope="col" className="mp-num">
                  {comSede ? "Instrumentos ou CNPJs" : "Instrumentos"}
                </th>
                {comSede && (
                  <th scope="col" className="mp-num">
                    Municípios da sede
                  </th>
                )}
                <th scope="col" className="mp-num">
                  Válido
                </th>
                <th scope="col" className="mp-num">
                  Pago
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.canal}-${l.ente_tipo ?? ""}`}>
                  <th scope="row">
                    <span className="mp-tabela-principal">{rotuloEnteTipo(l.ente_tipo)}</span>
                    <span className="mp-tabela-secundario">{rotuloCanal(l.canal)}</span>
                  </th>
                  <td className="mp-num">{n(l.instrumentos)}</td>
                  {comSede && <td className="mp-num">{l.municipiosSede > 0 ? n(l.municipiosSede) : "—"}</td>}
                  <td className="mp-num">{soPago(l.canal) ? "—" : dinheiro(l.valido)}</td>
                  <td className="mp-num">{dinheiro(l.pago)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolagem>
      )}
      <p className="pa-nota">{nota}</p>
    </section>
  );
}

// ================================================================ Execução

function AbaExecucao({ autor, anos, safra }: { autor: AutorEmendas; anos: AnoCanalEmendas[]; safra: SafraEmendas[] }) {
  // O pago ao favorecido não tem válido: não há pago ÷ válido para ele (`execucaoNaSafra` já o deixa fora).
  const linhas = execucaoNaSafra(anos, safra, autor.tipo)
    .filter((l) => !soPago(l.canal))
    .sort((a, b) => b.ano - a.ano || CANAIS.indexOf(a.canal) - CANAIS.indexOf(b.canal));
  const cad = caducadosPorAno(anos);
  return (
    <>
      <section aria-labelledby="parl-exec-safra" className="mp-radar-secao">
        <h2 id="parl-exec-safra" className="mp-radar-h2">
          Pago ÷ válido, na mesma safra e no mesmo canal
        </h2>
        <p className="pa-nota">
          Cada linha põe o autor ao lado da PB inteira, com os autores do mesmo tipo ({rotuloTipoAutor(autor.tipo).toLowerCase()}), na
          mesma safra (o ano da emenda) e no mesmo canal. A safra nova ainda está pagando, e a diferença pode ser do município, da
          entidade, do órgão ou do concedente: é ponto para olhar, não nota.
        </p>
        {linhas.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhum valor válido em convênio, Pix ou saúde fundo a fundo para comparar.</p>
        ) : (
          <TabelaRolagem rotuloId="parl-exec-safra">
            <table className="mp-tabela">
              <thead>
                <tr>
                  <th scope="col">Safra e canal</th>
                  <th scope="col" className="mp-num">
                    Válido do autor
                  </th>
                  <th scope="col" className="mp-num">
                    Pago do autor
                  </th>
                  <th scope="col" className="mp-num">
                    Pago ÷ válido do autor
                  </th>
                  <th scope="col" className="mp-num">
                    Pago ÷ válido da PB
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={`${l.ano}-${l.canal}`}>
                    <th scope="row">
                      <span className="mp-tabela-principal">{l.ano}</span>
                      <span className="mp-tabela-secundario">{rotuloCanal(l.canal)}</span>
                    </th>
                    <td className="mp-num">{dinheiro(l.validoAutor)}</td>
                    <td className="mp-num">{dinheiro(l.pagoAutor)}</td>
                    <td className="mp-num">{porcento(l.fracaoAutor)}</td>
                    <td className="mp-num">{porcento(l.fracaoPb)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolagem>
        )}
      </section>

      <section aria-labelledby="parl-exec-caducados" className="mp-radar-secao">
        <h2 id="parl-exec-caducados" className="mp-radar-h2">
          Caducados, à parte
        </h2>
        {autor.caducados === 0 && cad.linhas.length === 0 ? (
          <p className="pa-cartao pa-cartao-plano">Nenhuma proposta de convênio deste autor caducou.</p>
        ) : (
          <>
            <p>
              <strong>
                {n(autor.caducados)} {autor.caducados === 1 ? "proposta" : "propostas"} de convênio
              </strong>{" "}
              nunca {autor.caducados === 1 ? "assinada" : "assinadas"}, com {dinheiro(autor.caducado_valor)} indicados.
            </p>
            {cad.linhas.length > 0 && (
              <TabelaRolagem rotuloId="parl-exec-caducados">
                <table className="mp-tabela">
                  <thead>
                    <tr>
                      <th scope="col">Ano da emenda</th>
                      <th scope="col" className="mp-num">
                        Indicado que caducou
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cad.linhas.map((l) => (
                      <tr key={l.ano}>
                        <th scope="row">{l.ano}</th>
                        <td className="mp-num">{dinheiro(l.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabelaRolagem>
            )}
          </>
        )}
        <p className="pa-nota">
          A proposta de convênio que nunca foi assinada deixa de contar como pendente depois de 31/12 do ano seguinte ao da emenda: caducou.
          Fica fora do pago ÷ válido e da fila, e não diz de quem é a vez.
        </p>
      </section>

      <section aria-labelledby="parl-exec-fila" className="mp-radar-secao">
        <h2 id="parl-exec-fila" className="mp-radar-h2">
          Na fila
        </h2>
        <p>
          {autor.na_fila > 0 ? (
            <>
              <strong>
                {n(autor.na_fila)} {autor.na_fila === 1 ? "instrumento" : "instrumentos"}
              </strong>{" "}
              em que o dado diz de quem é a vez: do concedente, do proponente ou do autor.
            </>
          ) : (
            "Nenhum instrumento em que o dado diga de quem é a vez."
          )}
        </p>
        <p className="pa-nota">
          A vez só aparece quando o dado diz. O que cada convênio espera, e quem resolve, está no laudo do convênio e no{" "}
          <LinkMapa href="/mapa/painel">painel de execução</LinkMapa>.
        </p>
      </section>
    </>
  );
}

// ================================================================ Contexto e método

function AbaContexto({ autor, execucao }: { autor: AutorEmendas; execucao: ExecucaoEmendas }) {
  return (
    <>
      <section aria-labelledby="parl-ctx-quem" className="mp-radar-secao">
        <h2 id="parl-ctx-quem" className="mp-radar-h2">
          Quem é
        </h2>
        <ul className="pa-nota mp-parl-lista">
          <li>
            <strong>Nome publicado</strong>: {autor.nome ?? "nenhum nome publicado para o código"}. É o nome que o Portal (ou, na falta,
            o SICONV ou o Pix) publica para o código, sem correção.
          </li>
          <li>
            <strong>Código {autor.codigo}</strong>: o do autor no mandato. A mesma pessoa pode ter dois códigos (deputado e, depois,
            senador), e os dois nunca são juntados por nome.
          </li>
          <li>
            <strong>Tipo</strong>: {rotuloTipoAutor(autor.tipo)}.
          </li>
          <li>
            {autor.coletivo ? (
              <>
                <strong>Autoria coletiva</strong>: bancada, comissão e relator-geral não têm padrinho. O dado aberto não identifica quem
                indicou cada destino, e nenhuma pessoa é ligada a este código.
              </>
            ) : autor.pessoa ? (
              <>
                <strong>Pessoa</strong>: {autor.pessoa}, pela tabela curada da PONTE, com fonte para cada ligação. Nunca por cruzamento de
                nome.
              </>
            ) : (
              <>
                <strong>Pessoa</strong>: sem ligação na tabela curada da PONTE. O código não é cruzado por nome com nenhuma outra base.
              </>
            )}
          </li>
          <li>Agente público. Sem votos, sem partido e sem eleição nesta ficha.</li>
        </ul>
      </section>

      <section aria-labelledby="parl-ctx-catalogo" className="mp-radar-secao">
        <h2 id="parl-ctx-catalogo" className="mp-radar-h2">
          O catálogo do Portal, com a PB na localidade
        </h2>
        <div className="pa-grade pa-grade-2 mp-painel-cartoes">
          <CartaoNumero titulo="Empenhado" numero={dinheiro(autor.catalogo_empenhado_pb)} nota="emendas com a PB na localidade" />
          <CartaoNumero titulo="Pago" numero={dinheiro(autor.catalogo_pago_total_pb)} nota="pago no ano mais restos a pagar pagos depois" />
        </div>
        <p className="pa-nota">
          O catálogo é a execução orçamentária da emenda; os canais das outras abas mostram o mesmo dinheiro pelo destino. Os dois nunca se
          somam. Só entra a emenda com a PB na localidade: a emenda “Múltiplo” ou “Nacional” traz o valor do Brasil inteiro, e por isso o
          catálogo dela não aparece aqui, mesmo quando um canal mostra dinheiro na PB.
        </p>
      </section>

      <section aria-labelledby="parl-ctx-fontes" className="mp-radar-secao">
        <h2 id="parl-ctx-fontes" className="mp-radar-h2">
          Fontes
        </h2>
        <ul className="pa-nota mp-parl-lista">
          <li>
            <strong>Portal da Transparência</strong>, arquivo de emendas parlamentares de {datasDaExecucao(execucao).dadoAte}: o catálogo
            (empenhado, liquidado, pago e restos a pagar) e o pagamento direto ao favorecido. A pessoa física entra só somada, sem nome nem documento.
          </li>
          <li>
            <strong>Transferegov (SICONV)</strong>: os convênios com emenda, com o valor da emenda em cada convênio e o desembolso.
          </li>
          <li>
            <strong>Transferegov, transferência especial (Pix)</strong>: os planos de ação, com o pago.
          </li>
          <li>
            <strong>Fundo Nacional de Saúde (FNS)</strong>: as propostas de emenda pagas fundo a fundo, com o rateio por autor.
          </li>
          <li>
            <strong>População</strong>: a mesma base do fiscal dos municípios. <strong>Malha</strong>: IBGE.
          </li>
          <li>A ligação entre as fontes é sempre pelo código da emenda (ano, autor e número), nunca pelo nome.</li>
        </ul>
      </section>

      <section aria-labelledby="parl-ctx-limites" className="mp-radar-secao">
        <h2 id="parl-ctx-limites" className="mp-radar-h2">
          Limites
        </h2>
        <ul className="pa-nota mp-parl-lista">
          {execucao.fnsPendentes > 0 && (
            <li>
              <strong>Carga do FNS em curso</strong>: {n(execucao.fnsPendentes)} propostas ainda sem o detalhe contam no município, mas
              ainda não no autor. A saúde fundo a fundo deste autor vai crescer até a carga terminar.
            </li>
          )}
          <li>
            A emenda de saúde “Nacional” de antes de 2025 que só aparece pelo FNS fica fora do catálogo do Portal: ela aparece pelo canal,
            e o catálogo dela não.
          </li>
          <li>
            O pago ao favorecido inclui prefeitura e fundo pagos por outras modalidades, além de entidade e empresa: só soma o que nenhum
            outro canal da mesma emenda já mostra.
          </li>
          <li>
            O município do convenente nem sempre é o lugar do objeto, e a entidade regional (hospital, universidade, consórcio) atende mais
            que o município da sede.
          </li>
          <li>
            Comparar autores de épocas diferentes confunde a época com o autor: a execução só se compara na mesma safra e no mesmo canal.
          </li>
          <li>Nada aqui é nota, posição ou juízo sobre o autor. O que chama a atenção é ponto para olhar.</li>
        </ul>
      </section>

      <NotaDeMetodo id="parl-ctx-metodo" titulo="Regras de método" />
    </>
  );
}
