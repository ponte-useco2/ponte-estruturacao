"use client";

import { useActionState, useState } from "react";
import { UFS, agentesPorGrupo, type TipoAgente } from "@/lib/oportunidades/organizacao";
import { cadastrarOrganizacao, type ResultadoConta } from "./acoes";

const INICIAL: ResultadoConta = { ok: true };

/**
 * Declaração da entidade.
 *
 * O tipo vem primeiro e ocupa a maior parte da tela porque é o único campo que
 * muda o que o Mapa mostra: ele é o portão de elegibilidade do catálogo. Nome,
 * UF, município e CNPJ são ficha — úteis, mas não decidem nada hoje.
 *
 * Os doze aparecem agrupados e com exemplos. Ninguém se reconhece em
 * "consorcio_publico"; todo mundo reconhece "consórcio intermunicipal".
 */
export function OrganizacaoForm() {
  const [estado, acao, pendente] = useActionState(cadastrarOrganizacao, INICIAL);
  const [tipo, setTipo] = useState<TipoAgente | "">("");

  // Município só faz sentido para ente municipal. Para os demais, pedir código
  // do IBGE é pedir dado que a pessoa não tem e que não vamos usar.
  const pedeMunicipio = tipo === "municipio" || tipo === "consorcio_publico";

  return (
    <form action={acao} className="pa-pilha-larga">
      <fieldset className="pa-fieldset">
        <legend className="pa-mono">Que tipo de agente é a entidade</legend>
        <p className="pa-sub">
          É o que decide quais janelas ela pode pleitear. Um edital aberto só a município não
          aparece para uma OSC, e vice-versa.
        </p>

        <div className="mp-tipos">
          {agentesPorGrupo().map((g) => (
            <div key={g.grupo} className="mp-tipo-grupo">
              <p className="pa-mono">{g.rotulo}</p>
              {g.agentes.map((a) => (
                <label key={a.id} className="pa-check mp-tipo">
                  <input
                    type="radio"
                    name="tipo"
                    value={a.id}
                    checked={tipo === a.id}
                    onChange={() => setTipo(a.id)}
                    required
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
        />
      </div>

      <div className="mp-ficha">
        <div className="pa-campo">
          <label htmlFor="org-uf">UF</label>
          <select id="org-uf" name="uf" className="pa-select" defaultValue="">
            <option value="">Não informar</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        {pedeMunicipio && (
          <div className="pa-campo">
            <label htmlFor="org-municipio">Código do IBGE</label>
            <input
              id="org-municipio"
              name="municipio_ibge"
              className="pa-input"
              inputMode="numeric"
              pattern="[0-9]{7}"
              maxLength={7}
              placeholder="7 dígitos"
            />
          </div>
        )}

        <div className="pa-campo">
          <label htmlFor="org-cnpj">CNPJ</label>
          <input
            id="org-cnpj"
            name="cnpj"
            className="pa-input"
            inputMode="numeric"
            maxLength={18}
            placeholder="Opcional"
          />
        </div>
      </div>

      {estado.erro && (
        <p className="pa-ressalva" role="alert">
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
