"use client";

import { useActionState, useState } from "react";
import { MUNICIPIOS_PB_POR_NOME, campoDoErro, municipioPeloNome, type CampoDaEntidade } from "@/lib/oportunidades/formulario-entidade";
import { UFS, agentesPorGrupo, type TipoAgente } from "@/lib/oportunidades/organizacao";
import { cadastrarOrganizacao, type ResultadoConta } from "./acoes";

const INICIAL: ResultadoConta = { ok: true };
const ID_ERRO = "org-erro";

/**
 * Declaração da entidade.
 *
 * O tipo vem primeiro e ocupa a maior parte da tela porque é o único campo que
 * muda o que o Mapa mostra: ele é o portão de elegibilidade do catálogo. Nome,
 * UF, município e CNPJ são ficha — úteis, mas não decidem nada hoje.
 *
 * Os doze aparecem agrupados e com exemplos. Ninguém se reconhece em
 * "consorcio_publico"; todo mundo reconhece "consórcio intermunicipal".
 *
 * Onda 7, C (09/10/2026; N08 da auditoria R1, WCAG 3.3.1 e 3.3.2), porque esta é a porta de quem chega pelas Janelas:
 * - o município se escolhe pelo nome, na lista fixa dos 223 da Paraíba; o valor enviado continua sendo o IBGE de 7
 *   dígitos. Em outra UF, o campo volta a pedir o código (a lista só tem a PB, onde estão os clientes);
 * - "(opcional)" está no rótulo, e não só no placeholder, que some ao digitar e o leitor de tela pode não ler;
 * - o erro sai em texto comum (era `.pa-ressalva`, 0,63rem em caixa alta) e fica ligado ao campo de que fala
 *   (`aria-describedby` e `aria-invalid`; o campo vem de `campoDoErro`, com teste);
 * - os campos guardam o que foi digitado: a ação do formulário do React limpa os campos não controlados ao terminar,
 *   também quando volta com erro, e o "CNPJ inválido" apontaria para um campo já vazio.
 */
export function OrganizacaoForm() {
  const [estado, acao, pendente] = useActionState(cadastrarOrganizacao, INICIAL);
  const [tipo, setTipo] = useState<TipoAgente | "">("");
  const [nome, setNome] = useState("");
  const [uf, setUf] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [cnpj, setCnpj] = useState("");

  // Município só faz sentido para ente municipal. Para os demais, pedir código
  // do IBGE é pedir dado que a pessoa não tem e que não vamos usar.
  const pedeMunicipio = tipo === "municipio" || tipo === "consorcio_publico";
  const pelaLista = municipioPeloNome(uf);
  const campoComErro = campoDoErro(estado.erro);

  /** O que liga o campo à mensagem de erro quando ela fala dele: `aria-invalid` e a mensagem depois da ajuda. */
  function ligacao(campo: CampoDaEntidade, ajuda?: string) {
    const comErro = campoComErro === campo;
    const descricao = [ajuda, comErro ? ID_ERRO : null].filter(Boolean).join(" ");
    return { "aria-invalid": comErro ? true : undefined, "aria-describedby": descricao || undefined } as const;
  }

  function trocarUf(nova: string) {
    // A lista e o código do IBGE não se confundem: trocar de um para o outro limpa o município.
    if (municipioPeloNome(nova) !== pelaLista) setMunicipio("");
    setUf(nova);
  }

  return (
    <form action={acao} className="pa-pilha-larga">
      <fieldset className="pa-fieldset" aria-describedby={campoComErro === "tipo" ? ID_ERRO : undefined}>
        <legend className="pa-mono">Que tipo de agente é a entidade</legend>
        <p className="pa-sub">
          É o que decide quais janelas ela pode pleitear. Um edital aberto só a município não
          aparece para uma OSC, e vice-versa.
        </p>

        <div className="mp-tipos">
          {agentesPorGrupo().map((g) => (
            // `role="group"` com rótulo: sem isso o leitor de tela anuncia doze
            // rádios em fila, e "Estado" sozinho não diz se é ente federativo
            // ou situação de algo. O agrupamento visual precisa existir também
            // para quem não vê o agrupamento.
            <div
              key={g.grupo}
              className="mp-tipo-grupo"
              role="group"
              aria-labelledby={`grupo-${g.grupo}`}
            >
              <p className="pa-mono" id={`grupo-${g.grupo}`}>
                {g.rotulo}
              </p>
              {g.agentes.map((a) => (
                <label key={a.id} className="pa-check mp-tipo">
                  <input
                    type="radio"
                    name="tipo"
                    value={a.id}
                    checked={tipo === a.id}
                    onChange={() => setTipo(a.id)}
                    required
                    aria-invalid={campoComErro === "tipo" ? true : undefined}
                  />
                  <span>
                    <strong>{a.rotulo}</strong>
                    <span className="mp-tipo-exemplo">{a.exemplos}</span>
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </fieldset>

      <div className="pa-campo">
        <label htmlFor="org-nome">Nome da entidade</label>
        <input
          id="org-nome"
          name="nome"
          className="pa-input"
          required
          minLength={2}
          maxLength={160}
          autoComplete="organization"
          placeholder="Como ela é conhecida oficialmente"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          {...ligacao("nome")}
        />
      </div>

      <div className="mp-ficha">
        <div className="pa-campo">
          <label htmlFor="org-uf">UF (opcional)</label>
          <select id="org-uf" name="uf" className="pa-select" value={uf} onChange={(e) => trocarUf(e.target.value)} {...ligacao("uf")}>
            <option value="">Não informar</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div className="pa-campo">
          <label htmlFor="org-cnpj">CNPJ (opcional)</label>
          <input
            id="org-cnpj"
            name="cnpj"
            className="pa-input"
            inputMode="numeric"
            maxLength={18}
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            {...ligacao("cnpj")}
          />
        </div>
      </div>

      {/* Numa linha só, com a ajuda embaixo: na grade da ficha, a ajuda desalinhava os campos vizinhos. */}
      {pedeMunicipio &&
        (pelaLista ? (
          <div className="pa-campo">
            <label htmlFor="org-municipio">Município (opcional)</label>
            <select
              id="org-municipio"
              name="municipio_ibge"
              className="pa-select"
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              {...ligacao("municipio", "org-municipio-ajuda")}
            >
              <option value="">Não informar</option>
              {MUNICIPIOS_PB_POR_NOME.map((m) => (
                <option key={m.ibge} value={m.ibge}>
                  {m.nome}
                </option>
              ))}
            </select>
            <p id="org-municipio-ajuda" className="mp-form-ajuda">
              Os 223 municípios da Paraíba, pelo nome. Se a entidade é de outro estado, escolha a UF acima e o campo passa a pedir o
              código do IBGE.
            </p>
          </div>
        ) : (
          <div className="pa-campo">
            <label htmlFor="org-municipio">Código do IBGE do município (opcional)</label>
            <input
              id="org-municipio"
              name="municipio_ibge"
              className="pa-input"
              inputMode="numeric"
              pattern="[0-9]{7}"
              maxLength={7}
              placeholder="7 dígitos"
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              {...ligacao("municipio", "org-municipio-ajuda")}
            />
            <p id="org-municipio-ajuda" className="mp-form-ajuda">
              A lista pelo nome cobre só a Paraíba. Nas outras UFs, são os 7 dígitos que o IBGE dá a cada município (estão na
              página do município em cidades.ibge.gov.br).
            </p>
          </div>
        ))}

      {estado.erro && (
        <p id={ID_ERRO} className="mp-form-erro" role="alert">
          {estado.erro}
        </p>
      )}

      <div className="pa-linha">
        <button type="submit" className="pa-btn" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar e voltar ao Mapa"}
        </button>
      </div>

      <p className="pa-nota">
        O que você declara aqui fica visível para quem mais pertencer a esta entidade. Os temas que
        você marca no Mapa continuam só seus — isso não muda.
      </p>
    </form>
  );
}
