"use client";

/**
 * A tela da sala do Pablo: Atenção, Carteira, Ficha do objeto, Reuniões e decisões, Histórico. Hierarquia, textos e
 * estados vazios do protótipo da sessão de Grafos (`Grafos/SITE-02-sala-pablo/prototipo/sala-pablo.html`), uma função
 * por ato. Cada ato chama `executarAto` (servidor → função `sala_*` do banco); a página volta com os dados novos.
 * Texto de outra pessoa entra sempre como texto do React, nunca como HTML.
 */
import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type FormEvent, type ReactNode } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  A_CLASSIFICAR,
  ABERTOS,
  ACEITA_ARQUIVO,
  MELHORIA_ESTADOS,
  TIPOS_ARQUIVO,
  linkValido,
  problemaNoArquivo,
  tamanhoBR,
  DECISORES,
  ESTADOS,
  FASES,
  PRIORIDADES,
  QUEM_AGE,
  autorDe,
  botoesDoEstado,
  dataBR,
  linhas,
  nomeObjeto,
  ordemDemanda,
  problemaNoTexto,
  proximaSexta,
  quandoBR,
  venceu,
  type Ato,
  type DadosSala,
  type Decisao,
  type Demanda,
  type Envio,
  type EstadoMelhoria,
  type Evento,
  type Melhoria,
  type Membro,
  type Objeto,
  type Prioridade,
  type QuemAge,
} from "@/lib/oportunidades/sala-escrita";
import { apagarArquivo, executarAto, linkDoArquivo, prepararArquivo } from "./acoes";

type Aba = "atencao" | "carteira" | "reunioes" | "historico";
interface Rota {
  aba: Aba;
  ficha: string | null;
}

function rotaDoHash(hash: string): Rota {
  const h = hash.replace("#", "");
  if (/^PB-\d+$/.test(h)) return { aba: "carteira", ficha: h };
  return { aba: (["atencao", "carteira", "reunioes", "historico"] as Aba[]).includes(h as Aba) ? (h as Aba) : "atencao", ficha: null };
}

function assinarHash(avisar: () => void): () => void {
  const ir = () => {
    avisar();
    window.scrollTo({ top: 0 });
  };
  window.addEventListener("hashchange", ir);
  return () => window.removeEventListener("hashchange", ir);
}

// ------------------------------------------------------------------ modal

interface ModalAberto {
  titulo: string;
  rotulo?: string;
  corpo: ReactNode;
  /** Devolve a mensagem de erro, ou null quando deu certo. */
  enviar: (fd: FormData) => Promise<string | null>;
}

function Modal({ m, fechar }: { m: ModalAberto; fechar: () => void }) {
  const [erro, setErro] = useState("");
  const [enviando, iniciar] = useTransition();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [fechar]);
  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro("");
    const fd = new FormData(e.currentTarget);
    iniciar(async () => {
      const r = await m.enviar(fd);
      if (r) setErro(r);
      else fechar();
    });
  }
  return (
    <div className="spb-modal-fundo" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="spb-modal" role="dialog" aria-modal="true" aria-label={m.titulo}>
        <h2>{m.titulo}</h2>
        <form onSubmit={aoEnviar}>
          {m.corpo}
          <p className="spb-erro" role="alert">
            {erro}
          </p>
          <div className="spb-acoes">
            <button type="submit" className="spb-pri" disabled={enviando}>
              {enviando ? "Salvando…" : (m.rotulo ?? "Salvar")}
            </button>
            <button type="button" onClick={fechar}>
              Voltar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <label className="spb-campo">
      {rotulo}
      {dica ? <span className="spb-dica">{dica}</span> : null}
      {children}
    </label>
  );
}

function Opcoes({ lista }: { lista: [string, string][] }) {
  return (
    <>
      {lista.map(([v, t]) => (
        <option key={v} value={v}>
          {t}
        </option>
      ))}
    </>
  );
}

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const dat = (fd: FormData, k: string) => (txt(fd, k) || null);

/** Confere os textos antes de mandar (a guarda é o banco); devolve a primeira recusa. */
function conferir(...c: [string, string, number, boolean?][]): string | null {
  for (const [v, r, max, obr] of c) {
    const p = problemaNoTexto(v, r, max, obr);
    if (p) return p;
  }
  return null;
}

async function mandar(ato: Ato): Promise<string | null> {
  const r = await executarAto(ato);
  return r.ok ? null : r.erro;
}

// ------------------------------------------------------------------ pedido de melhoria (adendo 1)

const CLASSE_MELHORIA: Record<EstadoMelhoria, string> = {
  recebida: "spb-recebida",
  em_analise: "spb-validacao",
  feita: "spb-concluida",
  nao_sera_feita: "spb-cancelada",
};

/** O pé de toda tela: pedir melhoria nesta página e ver os pedidos dela, com a resposta da PONTE. */
function BlocoMelhoria({
  pagina,
  rotulo,
  melhorias,
  autor,
  ehPonte,
  responder,
}: {
  pagina: string;
  rotulo: string;
  melhorias: Melhoria[];
  autor: (m: Melhoria) => string;
  ehPonte: boolean;
  responder: (m: Melhoria) => void;
}) {
  const [msg, setMsg] = useState("");
  const [enviando, iniciar] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const lista = melhorias.filter((m) => m.pagina === pagina);
  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const texto = String(new FormData(e.currentTarget).get("melhoria") ?? "").trim();
    const p = problemaNoTexto(texto, "o pedido", 2000, true);
    if (p) {
      setMsg(p);
      return;
    }
    iniciar(async () => {
      const r = await executarAto({ ato: "pedir_melhoria", pagina, texto });
      if (r.ok) {
        form.current?.reset();
        setMsg("Pedido registrado. A PONTE responde aqui mesmo.");
      } else setMsg(r.erro);
    });
  }
  return (
    <section className="spb-melhoria" aria-label="Pedir melhoria nesta página">
      <form ref={form} onSubmit={enviar}>
        <label className="spb-campo">
          Pedir melhoria nesta página ({rotulo})
          <span className="spb-dica">Pedidos sobre a sala em si: o que falta, o que confunde, o que mudar. Demandas dos projetos vão em Nova demanda.</span>
          <textarea name="melhoria" maxLength={2000} placeholder="O que mudaria nesta página? Ex.: mostrar o prazo do órgão na carteira." />
        </label>
        <div className="spb-acoes">
          <button type="submit" className="spb-pri" disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar pedido"}
          </button>
        </div>
        <p className="spb-dica" role="status">
          {msg}
        </p>
      </form>
      {lista.length ? (
        <div className="spb-lista">
          {lista.map((m) => (
            <article key={m.id} className="spb-item">
              <div className="spb-item-topo">
                <span className="spb-item-titulo">{m.texto}</span>
                <span className={`spb-pill ${CLASSE_MELHORIA[m.estado]}`}>{MELHORIA_ESTADOS[m.estado] ?? m.estado}</span>
              </div>
              <div className="spb-meta">
                <span>
                  {autor(m)} · {quandoBR(m.criado_em)}
                </span>
              </div>
              {m.resposta ? (
                <div>
                  <b>Resposta da PONTE: </b>
                  {m.resposta}
                </div>
              ) : null}
              {ehPonte ? (
                <div className="spb-acoes">
                  <button type="button" className="spb-leve" onClick={() => responder(m)}>
                    Responder
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

async function sha256(f: File): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ------------------------------------------------------------------ tela

export function SalaPablo({ dados, eu, hoje, arquivos }: { dados: DadosSala; eu: Membro; hoje: string; arquivos: boolean }) {
  // A âncora (#carteira, #PB-01…) é a rota, como no protótipo; no servidor, Atenção.
  const rota = rotaDoHash(useSyncExternalStore(assinarHash, () => window.location.hash, () => ""));
  const [modal, setModal] = useState<ModalAberto | null>(null);
  const [aviso, setAviso] = useState("");
  const [filtroFase, setFiltroFase] = useState("");
  const [filtroOrg, setFiltroOrg] = useState("");
  const [, iniciar] = useTransition();


  const { objetos, demandas, decisoes, reunioes, eventos, membros, melhorias, envios } = dados;
  const ehPonte = eu.papel === "ponte";
  const porOrdem = objetos.slice().sort((a, b) => a.ordem - b.ordem);
  const fechar = () => setModal(null);
  const autor = (r: Parameters<typeof autorDe>[0]) => autorDe(r, membros, eu.user_id);
  const opcoesObjetos = (classificar: boolean): [string, string][] => [
    ...(classificar ? ([[A_CLASSIFICAR, "A classificar"]] as [string, string][]) : []),
    ...porOrdem.map((o) => [o.id, `${o.id} · ${o.nome}`] as [string, string]),
  ];
  const nome = (id: string | null | undefined) => nomeObjeto(objetos, id);
  const sexta = proximaSexta(hoje);

  // ---------------------------------------------------------------- atos sobre demandas
  function novaDemanda(objetoPadrao?: string) {
    setModal({
      titulo: "Nova demanda",
      rotulo: "Registrar",
      corpo: (
        <>
          <Campo rotulo="O que precisa acontecer">
            <input name="titulo" required maxLength={300} />
          </Campo>
          <Campo rotulo="Detalhe" dica="opcional">
            <textarea name="descricao" maxLength={4000} />
          </Campo>
          <Campo rotulo="Objeto">
            <select name="objeto" defaultValue={objetoPadrao ?? A_CLASSIFICAR}>
              <Opcoes lista={opcoesObjetos(true)} />
            </select>
          </Campo>
          <div className="spb-duas">
            <Campo rotulo="Prioridade solicitada">
              <select name="prioridade" defaultValue="normal">
                <Opcoes lista={Object.entries(PRIORIDADES)} />
              </select>
            </Campo>
            <Campo rotulo="Data desejada" dica="opcional; não é data combinada">
              <input type="date" name="data_desejada" />
            </Campo>
          </div>
          <Campo rotulo="Documento ou referência" dica="opcional: nome do arquivo ou onde está">
            <input name="referencia" maxLength={300} />
          </Campo>
        </>
      ),
      enviar: async (fd) =>
        conferir([txt(fd, "titulo"), "o que precisa acontecer", 300, true], [txt(fd, "descricao"), "o detalhe", 4000], [txt(fd, "referencia"), "a referência", 300]) ??
        mandar({
          ato: "registrar",
          titulo: txt(fd, "titulo"),
          descricao: txt(fd, "descricao"),
          objeto: txt(fd, "objeto"),
          prioridade: txt(fd, "prioridade") as Prioridade,
          data_desejada: dat(fd, "data_desejada"),
          referencia: txt(fd, "referencia"),
        }),
    });
  }

  function combinar(d: Demanda) {
    setModal({
      titulo: "Combinar a entrega",
      rotulo: "Combinar",
      corpo: (
        <>
          <p className="spb-lead">{d.titulo}</p>
          <div className="spb-duas">
            <Campo rotulo="Quem faz">
              <select name="responsavel" defaultValue={d.responsavel ?? "PONTE"}>
                <Opcoes lista={QUEM_AGE.map((x) => [x, x])} />
              </select>
            </Campo>
            <Campo rotulo="Data combinada" dica="deixe em branco para 'data a combinar'">
              <input type="date" name="data_combinada" defaultValue={d.data_combinada ?? ""} />
            </Campo>
          </div>
          <Campo rotulo="Como saberemos que terminou" dica="a evidência que permite concluir">
            <textarea name="criterio" defaultValue={d.criterio} maxLength={1000} />
          </Campo>
        </>
      ),
      enviar: async (fd) =>
        conferir([txt(fd, "criterio"), "o critério de conclusão", 1000]) ??
        mandar({ ato: "combinar", id: d.id, versao: d.atualizado_em, responsavel: txt(fd, "responsavel") as QuemAge, data_combinada: dat(fd, "data_combinada"), criterio: txt(fd, "criterio") }),
    });
  }

  function iniciarDemanda(d: Demanda) {
    iniciar(async () => {
      const e = await mandar({ ato: "iniciar", id: d.id, versao: d.atualizado_em });
      setAviso(e ?? "");
    });
  }

  function entregar(d: Demanda) {
    setModal({
      titulo: "Entregar para validação",
      rotulo: "Entregar",
      corpo: (
        <>
          <p className="spb-lead">{d.titulo}</p>
          <Campo rotulo="O que foi entregue" dica="versão, arquivo, onde está">
            <textarea name="descricao" required maxLength={2000} />
          </Campo>
          <Campo rotulo="Versão" dica="ex.: v1, 30/10">
            <input name="versao" maxLength={80} />
          </Campo>
        </>
      ),
      enviar: async (fd) =>
        conferir([txt(fd, "descricao"), "o que foi entregue", 2000, true], [txt(fd, "versao"), "a versão", 80]) ??
        mandar({ ato: "entregar", id: d.id, versao: d.atualizado_em, descricao: txt(fd, "descricao"), versao_entrega: txt(fd, "versao") }),
    });
  }

  function validar(d: Demanda) {
    setModal({
      titulo: "Validar a entrega",
      rotulo: "Registrar",
      corpo: (
        <>
          <p className="spb-lead">{d.titulo}</p>
          {d.entrega ? (
            <p>
              <b>Entregue: </b>
              {d.entrega.descricao}
              {d.entrega.versao ? ` (${d.entrega.versao})` : ""}
            </p>
          ) : null}
          <p className="spb-dica">Validar aqui registra o aceite operacional. Não substitui assinatura, protocolo ou exigência do financiador.</p>
          <Campo rotulo="Resultado">
            <select name="resultado" defaultValue="aprovar">
              <Opcoes
                lista={[
                  ["aprovar", "Aprovo a entrega"],
                  ["ajuste", "Peço ajuste"],
                ]}
              />
            </select>
          </Campo>
          <Campo rotulo="Comentário" dica="obrigatório para pedir ajuste">
            <textarea name="comentario" maxLength={2000} />
          </Campo>
        </>
      ),
      enviar: async (fd) => {
        const resultado = txt(fd, "resultado") === "ajuste" ? "ajuste" : "aprovar";
        return (
          conferir([txt(fd, "comentario"), resultado === "ajuste" ? "o que precisa ser ajustado" : "o comentário", 2000, resultado === "ajuste"]) ??
          mandar({ ato: "validar", id: d.id, versao: d.atualizado_em, resultado, comentario: txt(fd, "comentario") })
        );
      },
    });
  }

  function reverData(d: Demanda) {
    setModal({
      titulo: "Rever a data combinada",
      rotulo: "Registrar",
      corpo: (
        <>
          <p className="spb-lead">{d.titulo}</p>
          <p>
            Data combinada hoje: <b>{d.data_combinada ? dataBR(d.data_combinada) : "a combinar"}</b>
          </p>
          <Campo rotulo="Nova data" dica="em branco volta para 'a combinar'">
            <input type="date" name="data_combinada" />
          </Campo>
          <Campo rotulo="Motivo" dica="obrigatório; fica no histórico">
            <textarea name="motivo" required maxLength={1000} />
          </Campo>
        </>
      ),
      enviar: async (fd) =>
        conferir([txt(fd, "motivo"), "o motivo", 1000, true]) ?? mandar({ ato: "rever_data", id: d.id, versao: d.atualizado_em, nova: dat(fd, "data_combinada"), motivo: txt(fd, "motivo") }),
    });
  }

  function dependencia(d: Demanda) {
    const dp = d.dependencia;
    setModal({
      titulo: "Registrar dependência",
      corpo: (
        <>
          <p className="spb-lead">{d.titulo}</p>
          <div className="spb-duas">
            <Campo rotulo="Depende de">
              <select name="de" defaultValue={dp?.de ?? "Terceiro"}>
                <Opcoes lista={QUEM_AGE.map((x) => [x, x])} />
              </select>
            </Campo>
            <Campo rotulo="Quem é" dica="ex.: FAPESQ, SECULT, contador">
              <input name="quem" defaultValue={dp?.quem ?? ""} maxLength={120} />
            </Campo>
          </div>
          <div className="spb-duas">
            <Campo rotulo="Quem acompanha">
              <select name="acompanha" defaultValue={dp?.acompanha ?? "PONTE"}>
                <Opcoes
                  lista={[
                    ["PONTE", "PONTE"],
                    ["Pablo", "Pablo"],
                  ]}
                />
              </select>
            </Campo>
            <Campo rotulo="Próximo contato">
              <input type="date" name="proximo_contato" defaultValue={dp?.proximo_contato ?? ""} />
            </Campo>
          </div>
          <Campo rotulo="Último contato">
            <input type="date" name="ultimo_contato" defaultValue={dp?.ultimo_contato ?? ""} />
          </Campo>
          <label className="spb-marcar">
            <input type="checkbox" name="limpar" /> Não depende mais de ninguém
          </label>
        </>
      ),
      enviar: async (fd) => {
        const limpar = fd.get("limpar") !== null;
        if (!limpar) {
          const p = conferir([txt(fd, "quem"), "quem é", 120]);
          if (p) return p;
        }
        return mandar({
          ato: "dependencia",
          id: d.id,
          versao: d.atualizado_em,
          dependencia: limpar
            ? null
            : {
                de: txt(fd, "de") as QuemAge,
                quem: txt(fd, "quem"),
                acompanha: txt(fd, "acompanha") === "Pablo" ? "Pablo" : "PONTE",
                proximo_contato: dat(fd, "proximo_contato"),
                ultimo_contato: dat(fd, "ultimo_contato"),
              },
        });
      },
    });
  }

  function classificar(d: Demanda) {
    setModal({
      titulo: "Classificar ou priorizar",
      corpo: (
        <>
          <Campo rotulo="O que precisa acontecer">
            <input name="titulo" required maxLength={300} defaultValue={d.titulo} />
          </Campo>
          <Campo rotulo="Objeto">
            <select name="objeto" defaultValue={d.objeto || A_CLASSIFICAR}>
              <Opcoes lista={opcoesObjetos(true)} />
            </select>
          </Campo>
          <div className="spb-duas">
            <Campo rotulo="Prioridade solicitada">
              <select name="prioridade" defaultValue={d.prioridade}>
                <Opcoes lista={Object.entries(PRIORIDADES)} />
              </select>
            </Campo>
            <Campo rotulo="Data desejada">
              <input type="date" name="data_desejada" defaultValue={d.data_desejada ?? ""} />
            </Campo>
          </div>
          <p className="spb-dica">Mudar a prioridade não muda a data combinada. Para mudar a data, use &quot;Rever data&quot;.</p>
        </>
      ),
      enviar: async (fd) =>
        conferir([txt(fd, "titulo"), "o que precisa acontecer", 300, true]) ??
        mandar({
          ato: "classificar",
          id: d.id,
          versao: d.atualizado_em,
          titulo: txt(fd, "titulo"),
          objeto: txt(fd, "objeto"),
          prioridade: txt(fd, "prioridade") as Prioridade,
          data_desejada: dat(fd, "data_desejada"),
        }),
    });
  }

  function cancelar(d: Demanda) {
    setModal({
      titulo: "Cancelar a demanda",
      rotulo: "Cancelar demanda",
      corpo: (
        <>
          <p className="spb-lead">{d.titulo}</p>
          <Campo rotulo="Motivo" dica="obrigatório; fica no histórico">
            <textarea name="motivo" required maxLength={1000} />
          </Campo>
        </>
      ),
      enviar: async (fd) => conferir([txt(fd, "motivo"), "o motivo", 1000, true]) ?? mandar({ ato: "cancelar", id: d.id, versao: d.atualizado_em, motivo: txt(fd, "motivo") }),
    });
  }

  // ---------------------------------------------------------------- decisões, reuniões, objetos
  function novaDecisao(objetoPadrao?: string) {
    setModal({
      titulo: "Nova decisão a tomar",
      rotulo: "Registrar",
      corpo: (
        <>
          <Campo rotulo="Questão">
            <input name="questao" required maxLength={300} />
          </Campo>
          <Campo rotulo="Alternativas" dica="uma por linha">
            <textarea name="alternativas" />
          </Campo>
          <div className="spb-duas">
            <Campo rotulo="Quem decide">
              <select name="decisor" defaultValue="Pablo">
                <Opcoes lista={DECISORES.map((x) => [x, x])} />
              </select>
            </Campo>
            <Campo rotulo="Objeto">
              <select name="objeto" defaultValue={objetoPadrao ?? A_CLASSIFICAR}>
                <Opcoes lista={opcoesObjetos(true)} />
              </select>
            </Campo>
          </div>
        </>
      ),
      enviar: async (fd) => {
        const alternativas = linhas(txt(fd, "alternativas"));
        return (
          conferir([txt(fd, "questao"), "a questão", 300, true], ...alternativas.map((a) => [a, "as alternativas", 300] as [string, string, number])) ??
          mandar({ ato: "abrir_decisao", questao: txt(fd, "questao"), alternativas, decisor: txt(fd, "decisor"), objeto: txt(fd, "objeto") })
        );
      },
    });
  }

  function decidir(q: Decisao) {
    const ops: [string, string][] = [...q.alternativas.map((a) => [a, a] as [string, string]), ["__outra", "Outra (escrever abaixo)"]];
    setModal({
      titulo: "Registrar a decisão",
      rotulo: "Registrar decisão",
      corpo: (
        <>
          <p className="spb-lead">{q.questao}</p>
          <Campo rotulo="Decisão">
            <select name="escolha" defaultValue={ops[0][0]}>
              <Opcoes lista={ops} />
            </select>
          </Campo>
          <Campo rotulo="Texto da decisão" dica="obrigatório se escolher 'Outra'">
            <textarea name="texto" maxLength={1000} />
          </Campo>
          <Campo rotulo="Efeito nas entregas" dica="o que muda por causa da decisão">
            <textarea name="efeito" maxLength={1000} />
          </Campo>
        </>
      ),
      enviar: async (fd) => {
        const escolha = txt(fd, "escolha");
        const texto = txt(fd, "texto");
        if (escolha === "__outra" && !texto) return "Escreva a decisão.";
        const decisao = escolha === "__outra" ? texto : texto ? `${escolha} — ${texto}` : escolha;
        return conferir([decisao, "a decisão", 1000, true], [txt(fd, "efeito"), "o efeito", 1000]) ?? mandar({ ato: "decidir", id: q.id, decisao, efeito: txt(fd, "efeito") });
      },
    });
  }

  function editarReuniao(data: string) {
    const r = reunioes.find((x) => x.data === data);
    const juntar = (a?: string[]) => (a ?? []).join("\n");
    setModal({
      titulo: `Reunião de ${dataBR(data)}`,
      corpo: (
        <>
          <Campo rotulo="Pauta" dica="um item por linha">
            <textarea name="pauta" defaultValue={juntar(r?.pauta)} />
          </Campo>
          <Campo rotulo="Trabalho escolhido para a manhã" dica="um item por linha">
            <textarea name="manha" defaultValue={juntar(r?.trabalho_da_manha)} />
          </Campo>
          <Campo rotulo="Decisões tomadas" dica="um item por linha">
            <textarea name="decisoes" defaultValue={juntar(r?.decisoes_tomadas)} />
          </Campo>
          <Campo rotulo="Compromissos da semana seguinte" dica="quem faz o quê até quando; um por linha">
            <textarea name="compromissos" defaultValue={juntar(r?.compromissos)} />
          </Campo>
          <Campo rotulo="Notas">
            <textarea name="notas" defaultValue={r?.notas ?? ""} maxLength={4000} />
          </Campo>
        </>
      ),
      enviar: async (fd) => {
        const l = { pauta: linhas(txt(fd, "pauta")), manha: linhas(txt(fd, "manha")), decisoes: linhas(txt(fd, "decisoes")), compromissos: linhas(txt(fd, "compromissos")) };
        const itens = [...l.pauta, ...l.manha, ...l.decisoes, ...l.compromissos].map((x) => [x, "cada item", 300] as [string, string, number]);
        return (
          conferir(...itens, [txt(fd, "notas"), "as notas", 4000]) ??
          mandar({
            ato: "salvar_reuniao",
            data,
            versao: r?.atualizado_em ?? null,
            pauta: l.pauta,
            trabalho_da_manha: l.manha,
            decisoes_tomadas: l.decisoes,
            compromissos: l.compromissos,
            notas: txt(fd, "notas"),
          })
        );
      },
    });
  }

  function moverObjeto(o: Objeto, direcao: -1 | 1) {
    iniciar(async () => {
      const e = await mandar({ ato: "mover_objeto", id: o.id, direcao });
      setAviso(e ? `A ordem não mudou: ${e}` : "");
    });
  }

  function editarObjeto(o: Objeto) {
    setModal({
      titulo: `Atualizar ${o.id}`,
      corpo: (
        <>
          <Campo rotulo="Fase">
            <select name="fase" defaultValue={o.fase ?? "A confirmar"}>
              <Opcoes lista={FASES.map((x) => [x, x])} />
            </select>
          </Campo>
          <Campo rotulo="Resumo da situação" dica="o que se sabe hoje, em duas ou três frases">
            <textarea name="resumo" defaultValue={o.resumo ?? ""} maxLength={2000} />
          </Campo>
        </>
      ),
      enviar: async (fd) =>
        conferir([txt(fd, "resumo"), "o resumo", 2000]) ?? mandar({ ato: "atualizar_objeto", id: o.id, versao: o.atualizado_em, fase: txt(fd, "fase"), resumo: txt(fd, "resumo") }),
    });
  }

  // ---------------------------------------------------------------- adendo 1: projeto novo, melhoria, links e arquivos
  function novoProjeto() {
    setModal({
      titulo: "Novo projeto na carteira",
      rotulo: "Cadastrar",
      corpo: (
        <>
          <Campo rotulo="Nome do projeto">
            <input name="nome" required maxLength={160} />
          </Campo>
          <div className="spb-duas">
            <Campo rotulo="Organização" dica="em nome de quem o trabalho acontece">
              <input name="organizacao" maxLength={120} />
            </Campo>
            <Campo rotulo="Fase">
              <select name="fase" defaultValue="A confirmar">
                <Opcoes lista={FASES.filter((f) => f !== "Encerrado").map((x) => [x, x])} />
              </select>
            </Campo>
          </div>
          <Campo rotulo="Instrumento ou edital" dica="opcional: termo, edital, contrato">
            <input name="instrumento" maxLength={200} />
          </Campo>
          <div className="spb-duas">
            <Campo rotulo="Papel de Pablo" dica="opcional">
              <input name="papel_pablo" maxLength={160} />
            </Campo>
            <Campo rotulo="Papel da PONTE" dica="opcional; a PONTE confirma">
              <input name="papel_ponte" maxLength={160} />
            </Campo>
          </div>
          <Campo rotulo="Resumo" dica="o que é e onde está, em duas ou três frases">
            <textarea name="resumo" maxLength={2000} />
          </Campo>
          <Campo rotulo="Nome anterior" dica="opcional, se o projeto já teve outro nome">
            <input name="anterior" maxLength={160} />
          </Campo>
        </>
      ),
      enviar: async (fd) => {
        const nome = txt(fd, "nome");
        if (objetos.some((o) => o.nome.trim().toLowerCase() === nome.toLowerCase())) return "Já existe um projeto com esse nome na carteira.";
        return (
          conferir(
            [nome, "o nome do projeto", 160, true],
            [txt(fd, "organizacao"), "a organização", 120],
            [txt(fd, "instrumento"), "o instrumento", 200],
            [txt(fd, "papel_pablo"), "o papel de Pablo", 160],
            [txt(fd, "papel_ponte"), "o papel da PONTE", 160],
            [txt(fd, "resumo"), "o resumo", 2000],
            [txt(fd, "anterior"), "o nome anterior", 160],
          ) ??
          mandar({
            ato: "cadastrar_objeto",
            nome,
            organizacao: txt(fd, "organizacao"),
            fase: txt(fd, "fase"),
            instrumento: txt(fd, "instrumento"),
            papel_pablo: txt(fd, "papel_pablo"),
            papel_ponte: txt(fd, "papel_ponte"),
            resumo: txt(fd, "resumo"),
            nome_anterior: txt(fd, "anterior"),
          })
        );
      },
    });
  }

  function responderMelhoria(m: Melhoria) {
    setModal({
      titulo: "Responder ao pedido de melhoria",
      rotulo: "Registrar",
      corpo: (
        <>
          <p className="spb-lead">{m.texto}</p>
          <Campo rotulo="Situação">
            <select name="estado" defaultValue={m.estado}>
              <Opcoes lista={Object.entries(MELHORIA_ESTADOS)} />
            </select>
          </Campo>
          <Campo rotulo="Resposta" dica="o que foi feito, quando, ou por que não">
            <textarea name="resposta" defaultValue={m.resposta} maxLength={2000} />
          </Campo>
        </>
      ),
      enviar: async (fd) =>
        conferir([txt(fd, "resposta"), "a resposta", 2000]) ??
        mandar({ ato: "responder_melhoria", id: m.id, estado: txt(fd, "estado") as EstadoMelhoria, resposta: txt(fd, "resposta") }),
    });
  }

  const melhoria = (pagina: string, rotulo: string) => (
    <BlocoMelhoria key={pagina} pagina={pagina} rotulo={rotulo} melhorias={melhorias} autor={autor} ehPonte={ehPonte} responder={responderMelhoria} />
  );

  function enviarLink(o: Objeto) {
    setModal({
      titulo: `Enviar link · ${o.id}`,
      rotulo: "Enviar",
      corpo: (
        <>
          <Campo rotulo="Endereço" dica="começa com https://">
            <input type="url" name="url" required maxLength={2000} />
          </Campo>
          <Campo rotulo="Título" dica="o que é">
            <input name="titulo" required maxLength={200} />
          </Campo>
          <Campo rotulo="Nota" dica="opcional: para que serve, qual versão">
            <textarea name="nota" maxLength={2000} />
          </Campo>
        </>
      ),
      enviar: async (fd) => {
        const url = txt(fd, "url");
        if (!linkValido(url)) return "Só links que começam com https:// ou http://.";
        return (
          conferir([url, "o endereço", 2000, true], [txt(fd, "titulo"), "o título", 200, true], [txt(fd, "nota"), "a nota", 2000]) ??
          mandar({ ato: "enviar_link", objeto: o.id, url, titulo: txt(fd, "titulo"), nota: txt(fd, "nota") })
        );
      },
    });
  }

  function enviarArquivo(o: Objeto) {
    setModal({
      titulo: `Enviar arquivo · ${o.id}`,
      rotulo: "Enviar",
      corpo: (
        <>
          <Campo rotulo="Arquivo" dica="PDF, imagem (PNG, JPEG, WEBP), DOCX, XLSX, CSV ou TXT, até 25 MB.">
            <input type="file" name="arquivo" required accept={ACEITA_ARQUIVO} />
          </Campo>
          <p className="spb-aviso">
            Não envie documento pessoal (RG, CNH, comprovante de residência). O arquivo fica guardado só para os membros da sala e não abre
            pré-visualização.
          </p>
          <Campo rotulo="Título" dica="o que é">
            <input name="titulo" required maxLength={200} />
          </Campo>
          <Campo rotulo="Nota" dica="opcional: versão, se está assinado, para quê">
            <textarea name="nota" maxLength={2000} />
          </Campo>
          <label className="spb-marcar">
            <input type="checkbox" name="confirmo" required /> Confirmo que o arquivo não é documento pessoal
          </label>
        </>
      ),
      enviar: async (fd) => {
        const f = fd.get("arquivo");
        if (!(f instanceof File) || !f.name) return "Escolha um arquivo.";
        if (fd.get("confirmo") === null) return "Confirme que o arquivo não é documento pessoal.";
        const p =
          problemaNoArquivo(f.name, f.size) ??
          conferir([f.name, "o nome do arquivo", 200, true], [txt(fd, "titulo"), "o título", 200, true], [txt(fd, "nota"), "a nota", 2000]);
        if (p) return p;
        const preparo = await prepararArquivo(o.id, f.name, f.size);
        if (!preparo.ok) return preparo.erro;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !anon) return "O envio de arquivos está indisponível agora.";
        const { error } = await createBrowserClient(url, anon)
          .storage.from("salas")
          .uploadToSignedUrl(preparo.caminho, preparo.token, f, { contentType: preparo.tipo });
        if (error) return "Não foi possível enviar o arquivo. Tente de novo.";
        return mandar({
          ato: "registrar_arquivo",
          objeto: o.id,
          id: preparo.id,
          caminho: preparo.caminho,
          titulo: txt(fd, "titulo"),
          nota: txt(fd, "nota"),
          nome: f.name,
          sha256: await sha256(f),
        });
      },
    });
  }

  function retirarEnvio(e: Envio) {
    setModal({
      titulo: "Retirar da ficha",
      rotulo: "Retirar",
      corpo: (
        <>
          <p className="spb-lead">{e.titulo}</p>
          <p className="spb-dica">
            {e.tipo === "arquivo"
              ? "O registro fica no histórico. O arquivo deixa de aparecer; apagar os bytes só pela PONTE, quando houver motivo (dado pessoal enviado por engano)."
              : "O registro fica no histórico; o link deixa de aparecer na ficha."}
          </p>
          <Campo rotulo="Motivo" dica="obrigatório">
            <textarea name="motivo" required maxLength={1000} />
          </Campo>
          {ehPonte && e.tipo === "arquivo" ? (
            <label className="spb-marcar">
              <input type="checkbox" name="apagar" /> Apagar também o arquivo (não tem volta)
            </label>
          ) : null}
        </>
      ),
      enviar: async (fd) => {
        const motivo = txt(fd, "motivo");
        const p = conferir([motivo, "o motivo", 1000, true]);
        if (p) return p;
        const r = await mandar({ ato: "retirar_envio", id: e.id, motivo });
        if (r || fd.get("apagar") === null) return r;
        const a = await apagarArquivo(e.id, motivo);
        return a.ok ? null : `Retirado da ficha, mas o arquivo não foi apagado: ${a.erro}`;
      },
    });
  }

  function apagarBytes(e: Envio) {
    setModal({
      titulo: "Apagar o arquivo",
      rotulo: "Apagar",
      corpo: (
        <>
          <p className="spb-lead">{e.titulo}</p>
          <p className="spb-dica">Apaga os bytes do armazenamento. Não tem volta; o registro e o motivo ficam no histórico.</p>
          <Campo rotulo="Motivo" dica="obrigatório">
            <textarea name="motivo" required maxLength={1000} />
          </Campo>
        </>
      ),
      enviar: async (fd) => {
        const motivo = txt(fd, "motivo");
        const p = conferir([motivo, "o motivo", 1000, true]);
        if (p) return p;
        const a = await apagarArquivo(e.id, motivo);
        return a.ok ? null : a.erro;
      },
    });
  }

  function baixar(e: Envio) {
    iniciar(async () => {
      const r = await linkDoArquivo(e.id);
      if (r.ok) window.location.assign(r.url);
      else setAviso(r.erro);
    });
  }

  function blocoEnvios(o: Objeto) {
    const ativos = envios.filter((e) => e.objeto === o.id && e.estado === "ativo");
    const guardados = ehPonte ? envios.filter((e) => e.objeto === o.id && e.estado === "retirado" && e.tipo === "arquivo" && !e.arquivo_apagado) : [];
    return (
      <div className="spb-bloco">
        <div className="spb-cab">
          <h2>Links e arquivos enviados</h2>
          <div className="spb-acoes">
            <button type="button" onClick={() => enviarLink(o)}>
              Enviar link
            </button>
            {arquivos ? (
              <button type="button" onClick={() => enviarArquivo(o)}>
                Enviar arquivo
              </button>
            ) : null}
          </div>
        </div>
        {ativos.length ? (
          <div className="spb-lista">
            {ativos.map((e) => (
              <article key={e.id} className="spb-item">
                <div className="spb-item-topo">
                  {e.tipo === "link" && e.url ? (
                    <a className="spb-item-titulo" href={e.url} target="_blank" rel="noopener noreferrer nofollow">
                      {e.titulo}
                    </a>
                  ) : (
                    <span className="spb-item-titulo">{e.titulo}</span>
                  )}
                  <span className="spb-pill spb-fase">{e.tipo === "link" ? "Link" : (TIPOS_ARQUIVO[e.tipo_conteudo ?? ""]?.rotulo ?? "Arquivo")}</span>
                </div>
                <div className="spb-meta">
                  <span>
                    {autor(e)} · {quandoBR(e.criado_em)}
                  </span>
                  {e.tipo === "arquivo" ? (
                    <span>
                      {e.nome_arquivo} · {tamanhoBR(e.tamanho)}
                    </span>
                  ) : (
                    <span>{e.url}</span>
                  )}
                </div>
                {e.nota ? <div>{e.nota}</div> : null}
                <div className="spb-acoes">
                  {e.tipo === "arquivo" ? (
                    <button type="button" className="spb-leve" onClick={() => baixar(e)}>
                      Baixar
                    </button>
                  ) : null}
                  <button type="button" className="spb-leve" onClick={() => retirarEnvio(e)}>
                    Retirar
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          vazio("Nada enviado ainda. Envie o link de uma pasta, um termo assinado ou um comprovante.")
        )}
        {guardados.length ? (
          <details>
            <summary className="spb-meta">Arquivos retirados que ainda estão guardados ({guardados.length}); só a PONTE vê</summary>
            <div className="spb-lista">
              {guardados.map((e) => (
                <article key={e.id} className="spb-item">
                  <span className="spb-item-titulo">{e.titulo}</span>
                  <div className="spb-meta">
                    <span>Retirado: {e.retirado_motivo}</span>
                  </div>
                  <div className="spb-acoes">
                    <button type="button" className="spb-leve" onClick={() => apagarBytes(e)}>
                      Apagar o arquivo
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    );
  }

  // ---------------------------------------------------------------- componentes
  const ROTULO: Record<string, [string, string?]> = {
    combinar: ["Combinar", "spb-pri"],
    classificar: ["Classificar"],
    iniciar: ["Iniciar"],
    entregar: ["Entregar"],
    validar: ["Validar", "spb-pri"],
    rever_data: ["Rever data", "spb-leve"],
    dependencia: ["Dependência", "spb-leve"],
    prioridade: ["Prioridade", "spb-leve"],
    cancelar: ["Cancelar", "spb-leve"],
  };
  const ACAO: Record<string, (d: Demanda) => void> = {
    combinar,
    classificar,
    iniciar: iniciarDemanda,
    entregar,
    validar,
    rever_data: reverData,
    dependencia,
    prioridade: classificar,
    cancelar,
  };

  function cartaoDemanda(d: Demanda, mostrarObjeto: boolean) {
    const dp = d.dependencia;
    const passou = venceu(d, hoje);
    const botoes = botoesDoEstado(d.estado);
    return (
      <article key={d.id} className="spb-item">
        <div className="spb-item-topo">
          <span className="spb-item-titulo">{d.titulo}</span>
          <span className={`spb-pill spb-${d.estado}`}>{ESTADOS[d.estado] ?? d.estado}</span>
        </div>
        {d.descricao ? <div>{d.descricao}</div> : null}
        <div className="spb-meta">
          {mostrarObjeto ? (
            <span>
              <a href={`#${d.objeto && d.objeto !== A_CLASSIFICAR ? d.objeto : "carteira"}`}>{nome(d.objeto)}</a>
            </span>
          ) : null}
          <span>
            Quem faz: <b>{d.responsavel ?? "responsável a definir"}</b>
          </span>
          <span className={passou ? "spb-alerta" : undefined}>
            Data combinada: <b>{d.data_combinada ? dataBR(d.data_combinada) : "data a combinar"}</b>
            {passou ? " (passou)" : ""}
          </span>
          {d.data_desejada ? <span>Desejada: {dataBR(d.data_desejada)}</span> : null}
          {d.prioridade !== "normal" ? (
            <span>
              Prioridade: <b>{PRIORIDADES[d.prioridade]}</b>
            </span>
          ) : null}
        </div>
        {dp ? (
          <div className="spb-meta">
            <span>
              Depende de <b>{dp.quem || dp.de}</b>
            </span>
            <span>
              acompanha <b>{dp.acompanha}</b>
            </span>
            <span className={dp.proximo_contato ? undefined : "spb-alerta"}>{dp.proximo_contato ? `próximo contato ${dataBR(dp.proximo_contato)}` : "sem próximo contato"}</span>
          </div>
        ) : null}
        {d.criterio ? (
          <div className="spb-meta">
            <span>Conclui quando: {d.criterio}</span>
          </div>
        ) : null}
        {d.estado === "validacao" && d.entrega ? (
          <div className="spb-meta">
            <span>
              Entregue: <b>{d.entrega.descricao}</b>
              {d.entrega.versao ? ` · ${d.entrega.versao}` : ""}
            </span>
          </div>
        ) : null}
        {d.validacao?.resultado === "ajuste" && d.estado === "andamento" ? (
          <div className="spb-meta">
            <span className="spb-alerta">Ajuste pedido:</span> {d.validacao.comentario}
          </div>
        ) : null}
        {d.estado === "cancelada" && d.motivo_cancelamento ? (
          <div className="spb-meta">
            <span>Motivo do cancelamento: {d.motivo_cancelamento}</span>
          </div>
        ) : null}
        {botoes.length ? (
          <div className="spb-acoes">
            {botoes.map((b) => (
              <button key={b} type="button" className={ROTULO[b][1]} onClick={() => ACAO[b](d)}>
                {ROTULO[b][0]}
              </button>
            ))}
          </div>
        ) : null}
      </article>
    );
  }

  function cartaoDecisao(q: Decisao) {
    return (
      <article key={q.id} className="spb-item">
        <div className="spb-item-topo">
          <span className="spb-item-titulo">{q.questao}</span>
          <span className={`spb-pill ${q.estado === "aberta" ? "spb-validacao" : "spb-concluida"}`}>{q.estado === "aberta" ? "Aberta" : "Decidida"}</span>
        </div>
        <div className="spb-meta">
          <span>
            <a href={`#${q.objeto && q.objeto !== A_CLASSIFICAR ? q.objeto : "carteira"}`}>{nome(q.objeto)}</a>
          </span>
          <span>
            Quem decide: <b>{q.decisor}</b>
          </span>
        </div>
        {q.alternativas.length && q.estado === "aberta" ? (
          <ul>
            {q.alternativas.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        ) : null}
        {q.estado === "decidida" ? (
          <div>
            <b>Decisão: </b>
            {q.decisao}
            {q.efeito ? <div className="spb-meta">Efeito: {q.efeito}</div> : null}
            <div className="spb-meta">
              {q.decidido_rotulo ?? autorDe({ quem: q.decidido_por }, membros, eu.user_id)}
              {q.decidido_em ? `, ${quandoBR(q.decidido_em)}` : ""}
            </div>
          </div>
        ) : (
          <div className="spb-acoes">
            <button type="button" className="spb-pri" onClick={() => decidir(q)}>
              Registrar decisão
            </button>
          </div>
        )}
      </article>
    );
  }

  const vazio = (texto: string) => <div className="spb-vazio">{texto}</div>;

  function tituloDoAlvo(alvo: string): string {
    const [c, id] = alvo.split("/");
    if (c === "demandas") return demandas.find((x) => x.id === id)?.titulo ?? id;
    if (c === "decisoes") return decisoes.find((x) => x.id === id)?.questao ?? id;
    if (c === "reunioes") return `reunião de ${dataBR(id)}`;
    if (c === "envios") return envios.find((x) => x.id === id)?.titulo ?? id;
    if (c === "melhorias") return "pedido de melhoria";
    return id;
  }

  function linhaEvento(e: Evento) {
    return (
      <div key={e.id}>
        <time dateTime={e.quando}>{quandoBR(e.quando)}</time> · {autor(e)} {e.tipo}
        {e.motivo ? ` — ${e.motivo}` : ""}
        {!e.alvo.startsWith("objetos/") ? ` (${tituloDoAlvo(e.alvo)})` : e.objeto ? ` (${e.objeto})` : ""}
      </div>
    );
  }

  // ---------------------------------------------------------------- vistas
  function atencao() {
    const aDecidir = decisoes.filter((q) => q.estado === "aberta" && /Pablo/.test(q.decisor));
    const aValidar = demandas.filter((d) => d.estado === "validacao");
    const agir = demandas.filter((d) => ["recebida", "combinada", "andamento"].includes(d.estado)).sort(ordemDemanda);
    const deps = demandas
      .filter((d) => ABERTOS.includes(d.estado) && d.dependencia)
      .sort((a, b) => (a.dependencia?.proximo_contato ?? "0000").localeCompare(b.dependencia?.proximo_contato ?? "0000"));
    const r = reunioes.find((x) => x.data === sexta);
    return (
      <div>
        <div className="spb-cab">
          <div>
            <p className="spb-eyebrow">O que precisa da sua atenção</p>
            <h1>Atenção</h1>
          </div>
          <div className="spb-acoes">
            <button type="button" className="spb-pri" onClick={() => novaDemanda()}>
              Nova demanda
            </button>
            <button type="button" onClick={() => novaDecisao()}>
              Nova decisão
            </button>
          </div>
        </div>
        <p className="spb-lead">
          Uma demanda sem data fica com data a combinar; sem responsável aceito, com responsável a definir. Nada aqui é calculado a partir do histórico de
          conversas.
        </p>
        <div className="spb-grade3">
          <section>
            <h2>Preciso decidir</h2>
            <p className="spb-meta">Escolhas e entregas aguardando Pablo.</p>
            {aDecidir.length || aValidar.length ? (
              <>
                {aDecidir.map((q) => (
                  cartaoDecisao(q)
                ))}
                {aValidar.map((d) => (
                  cartaoDemanda(d, true)
                ))}
              </>
            ) : (
              vazio("Nenhuma decisão ou validação aguardando Pablo.")
            )}
          </section>
          <section>
            <h2>Precisamos agir</h2>
            <p className="spb-meta">Próxima ação, quem faz e a data combinada.</p>
            {agir.length ? agir.map((d) => cartaoDemanda(d, true)) : vazio("Nenhuma ação aberta. Registre a primeira demanda.")}
          </section>
          <section>
            <h2>Nossa sexta</h2>
            <div className="spb-sexta">
              <div className="spb-cab">
                <h3>Sexta, {dataBR(sexta)}</h3>
                <button type="button" onClick={() => editarReuniao(sexta)}>
                  {r ? "Editar" : "Abrir a pauta"}
                </button>
              </div>
              {r?.pauta.length ? (
                <ol>
                  {r.pauta.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ol>
              ) : (
                <p className="spb-meta">Roteiro: pedidos sem classificação, decisões que bloqueiam, validações, trabalho da manhã, compromissos e reprogramações.</p>
              )}
              {r?.trabalho_da_manha.length ? (
                <div>
                  <b>Trabalho da manhã</b>
                  <ul>
                    {r.trabalho_da_manha.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <h3>Dependências</h3>
            {deps.length ? (
              deps.map((d) => (
                <article key={d.id} className="spb-item">
                  <span className="spb-item-titulo">{d.titulo}</span>
                  <div className="spb-meta">
                    <span>
                      De <b>{d.dependencia?.quem || d.dependencia?.de}</b>
                    </span>
                    <span>
                      acompanha <b>{d.dependencia?.acompanha}</b>
                    </span>
                    <span className={d.dependencia?.proximo_contato ? undefined : "spb-alerta"}>
                      {d.dependencia?.proximo_contato ? `próximo contato ${dataBR(d.dependencia.proximo_contato)}` : "sem próximo contato"}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              vazio("Nenhuma dependência registrada.")
            )}
          </section>
        </div>
        {melhoria("atencao", "Atenção")}
      </div>
    );
  }

  function proximaAcao(o: Objeto): Demanda | null {
    return demandas.filter((d) => d.objeto === o.id && ABERTOS.includes(d.estado)).sort(ordemDemanda)[0] ?? null;
  }

  function carteira() {
    const fases = [...new Set(objetos.map((o) => o.fase).filter(Boolean))] as string[];
    const orgs = [...new Set(objetos.map((o) => o.organizacao).filter(Boolean))] as string[];
    const lista = porOrdem.filter((o) => (!filtroFase || o.fase === filtroFase) && (!filtroOrg || o.organizacao === filtroOrg));
    const sem = demandas.filter((d) => (!d.objeto || d.objeto === A_CLASSIFICAR) && ABERTOS.includes(d.estado));
    return (
      <div>
        <div className="spb-cab">
          <div>
            <p className="spb-eyebrow">{objetos.length} objetos na carteira</p>
            <h1>Carteira</h1>
          </div>
          <div className="spb-filtros">
            <button type="button" className="spb-pri" onClick={novoProjeto}>
              Novo projeto
            </button>
            <select aria-label="Filtrar por fase" value={filtroFase} onChange={(e) => setFiltroFase(e.target.value)}>
              <option value="">Todas as fases</option>
              <Opcoes lista={fases.map((f) => [f, f])} />
            </select>
            <select aria-label="Filtrar por organização" value={filtroOrg} onChange={(e) => setFiltroOrg(e.target.value)}>
              <option value="">Todas as organizações</option>
              <Opcoes lista={orgs.map((f) => [f, f])} />
            </select>
          </div>
        </div>
        <p className="spb-lead">A ordem é a prioridade de Pablo. Mudar a ordem não muda prazo, responsável nem aceite de nenhuma tarefa.</p>
        <div className="spb-lista spb-espaco">
          {lista.length ? (
            lista.map((o) => {
              const pa = proximaAcao(o);
              return (
                <article key={o.id} className="spb-obj">
                  <div className="spb-obj-cab">
                    <div className="spb-obj-nome">
                      <span className="spb-ordem" aria-label="posição na prioridade">
                        {o.ordem}
                      </span>
                      <div>
                        <div className="spb-obj-id">{o.id}</div>
                        <h2>
                          <a href={`#${o.id}`}>{o.nome}</a>
                        </h2>
                        {o.nomes_anteriores?.length ? <div className="spb-meta">Antes: {o.nomes_anteriores.join(", ")}</div> : null}
                      </div>
                    </div>
                    <div className="spb-acoes">
                      <span className="spb-pill spb-fase">{o.fase || "a confirmar"}</span>
                      <button type="button" className="spb-leve" aria-label={`Subir ${o.nome}`} onClick={() => moverObjeto(o, -1)}>
                        ↑
                      </button>
                      <button type="button" className="spb-leve" aria-label={`Descer ${o.nome}`} onClick={() => moverObjeto(o, 1)}>
                        ↓
                      </button>
                    </div>
                  </div>
                  <div className="spb-meta">
                    <span>
                      <b>{o.organizacao || "organização a confirmar"}</b>
                    </span>
                    {o.papel_pablo ? <span>Pablo: {o.papel_pablo}</span> : null}
                    {o.papel_ponte ? <span>PONTE: {o.papel_ponte}</span> : null}
                  </div>
                  {pa ? (
                    <div className="spb-meta">
                      <span>
                        Próxima ação: <b>{pa.titulo}</b>
                      </span>
                      <span>quem faz: {pa.responsavel ?? "responsável a definir"}</span>
                      <span className={venceu(pa, hoje) ? "spb-alerta" : undefined}>{pa.data_combinada ? dataBR(pa.data_combinada) : "data a combinar"}</span>
                    </div>
                  ) : (
                    <div className="spb-meta">
                      <span className="spb-alerta">Próxima ação a definir</span>
                    </div>
                  )}
                  <div className="spb-meta">
                    <span>Última atualização confirmada: {o.atualizado_por ? quandoBR(o.atualizado_em) : o.confirmado_em ? dataBR(o.confirmado_em) : quandoBR(o.atualizado_em)}</span>
                  </div>
                </article>
              );
            })
          ) : (
            vazio("Nenhum objeto com esse filtro.")
          )}
        </div>
        {sem.length ? (
          <div className="spb-bloco">
            <h2>A classificar</h2>
            <div className="spb-lista">
              {sem.map((d) => (
                cartaoDemanda(d, false)
              ))}
            </div>
          </div>
        ) : null}
        {melhoria("carteira", "Carteira")}
      </div>
    );
  }

  function ficha(id: string) {
    const o = objetos.find((x) => x.id === id);
    if (!o) return vazio("Objeto não encontrado. Volte à carteira.");
    const dem = demandas.filter((d) => d.objeto === o.id);
    const abertas = dem.filter((d) => ABERTOS.includes(d.estado)).sort(ordemDemanda);
    const fechadas = dem.filter((d) => !ABERTOS.includes(d.estado));
    const dec = decisoes.filter((q) => q.objeto === o.id);
    const evs = eventos.filter((e) => e.objeto === o.id).slice(0, 40);
    const p = o.papeis ?? {};
    const papeis = (
      [
        ["Proponente / titular", p.proponente],
        ["Contratante", p.contratante],
        ["Executor", p.executor],
        ["Financiador / órgão", p.financiador],
        ["Papel de Pablo", o.papel_pablo],
        ["Papel da PONTE", o.papel_ponte],
        ["Instrumento", o.instrumento],
      ] as [string, string | undefined][]
    ).filter((x) => x[1]);
    return (
      <div>
        <p className="spb-eyebrow">
          <a href="#carteira">Carteira</a> · {o.id}
        </p>
        <div className="spb-cab">
          <h1>{o.nome}</h1>
          <div className="spb-acoes">
            <span className="spb-pill spb-fase">{o.fase || "a confirmar"}</span>
            <button type="button" onClick={() => editarObjeto(o)}>
              Atualizar situação
            </button>
            <button type="button" className="spb-pri" onClick={() => novaDemanda(o.id)}>
              Nova demanda
            </button>
          </div>
        </div>
        {o.resumo ? <p className="spb-lead">{o.resumo}</p> : null}
        <div className="spb-ficha-grade">
          <section>
            <h2>Partes e papéis</h2>
            {papeis.length ? (
              <dl className="spb-papeis">
                {papeis.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              vazio("Papéis a confirmar no instrumento.")
            )}
            {o.nomes_anteriores?.length ? <p className="spb-meta">Nomes anteriores: {o.nomes_anteriores.join(", ")}</p> : null}
            {o.identidade ? <p className="spb-meta">Identidade do projeto: {o.identidade}</p> : null}
          </section>
          <section>
            <h2>Documentos</h2>
            {o.documentos?.length ? (
              <div className="spb-lista">
                {o.documentos.map((d, i) => (
                  <div key={i} className="spb-item">
                    <div className="spb-item-topo">
                      <span className="spb-item-titulo">{d.titulo}</span>
                      {d.estado ? <span className="spb-pill spb-fase">{d.estado}</span> : null}
                    </div>
                    {d.onde ? <div className="spb-meta">{d.onde}</div> : null}
                    {d.nota ? <div className="spb-meta">{d.nota}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              vazio("Documentos associados caso a caso.")
            )}
            {o.relacoes?.length ? (
              <div>
                <h3>Relações</h3>
                <ul>
                  {o.relacoes.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
        {blocoEnvios(o)}
        <div className="spb-bloco">
          <div className="spb-cab">
            <h2>Demandas abertas</h2>
            <span className="spb-meta">{abertas.length}</span>
          </div>
          {abertas.length ? (
            <div className="spb-lista">
              {abertas.map((d) => (
                cartaoDemanda(d, false)
              ))}
            </div>
          ) : (
            vazio("Nenhuma demanda aberta. Próxima ação a definir.")
          )}
        </div>
        <div className="spb-bloco">
          <div className="spb-cab">
            <h2>Decisões</h2>
            <button type="button" onClick={() => novaDecisao(o.id)}>
              Nova decisão
            </button>
          </div>
          {dec.length ? (
            <div className="spb-lista">
              {dec.map((q) => (
                cartaoDecisao(q)
              ))}
            </div>
          ) : (
            vazio("Nenhuma decisão registrada.")
          )}
        </div>
        {fechadas.length ? (
          <div className="spb-bloco">
            <h2>Concluídas e canceladas</h2>
            <div className="spb-lista">
              {fechadas.map((d) => (
                cartaoDemanda(d, false)
              ))}
            </div>
          </div>
        ) : null}
        <div className="spb-bloco">
          <h2>Histórico do objeto</h2>
          {evs.length ? (
            <div className="spb-hist">
              {evs.map((e) => (
                linhaEvento(e)
              ))}
            </div>
          ) : (
            vazio("Sem mudanças registradas ainda.")
          )}
        </div>
        {o.fonte ? <p className="spb-meta spb-espaco">Fonte do estado inicial: {o.fonte}</p> : null}
        {melhoria(o.id, o.id)}
      </div>
    );
  }

  function vistaReunioes() {
    return (
      <div>
        <div className="spb-cab">
          <div>
            <p className="spb-eyebrow">Manhã de sexta: reunião e produção</p>
            <h1>Reuniões e decisões</h1>
          </div>
          <button type="button" className="spb-pri" onClick={() => editarReuniao(sexta)}>
            Pauta de {dataBR(sexta)}
          </button>
        </div>
        <p className="spb-lead">Cada reunião termina com o que cada um fará, o que depende de terceiros e o que ficou para depois.</p>
        <div className="spb-lista spb-espaco">
          {reunioes.length ? (
            reunioes.map((r) => (
              <article key={r.data} className="spb-obj">
                <div className="spb-obj-cab">
                  <h2>Sexta, {dataBR(r.data)}</h2>
                  <button type="button" onClick={() => editarReuniao(r.data)}>
                    Editar
                  </button>
                </div>
                {(
                  [
                    ["Pauta", r.pauta],
                    ["Trabalho da manhã", r.trabalho_da_manha],
                    ["Decisões tomadas", r.decisoes_tomadas],
                    ["Compromissos", r.compromissos],
                  ] as [string, string[]][]
                )
                  .filter((x) => x[1].length)
                  .map(([t, a]) => (
                    <div key={t}>
                      <h3>{t}</h3>
                      <ul>
                        {a.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                {r.notas ? <p>{r.notas}</p> : null}
              </article>
            ))
          ) : (
            vazio("Nenhuma reunião registrada. Abra a pauta da próxima sexta.")
          )}
        </div>
        <div className="spb-bloco">
          <h2>Decisões</h2>
          {decisoes.length ? (
            <div className="spb-lista">
              {decisoes
                .slice()
                .sort((a, b) => (a.estado === "aberta" ? 0 : 1) - (b.estado === "aberta" ? 0 : 1))
                .map((q) => (
                  cartaoDecisao(q)
                ))}
            </div>
          ) : (
            vazio("Nenhuma decisão registrada.")
          )}
        </div>
        {melhoria("reunioes", "Reuniões")}
      </div>
    );
  }

  function historico() {
    return (
      <div>
        <p className="spb-eyebrow">Tudo o que mudou, com autoria e data</p>
        <h1>Histórico</h1>
        <p className="spb-lead">A página só acrescenta linhas ao histórico; nenhuma é editada.</p>
        <div className="spb-hist spb-espaco">{eventos.length ? eventos.map((e) => linhaEvento(e)) : vazio("Sem mudanças registradas ainda.")}</div>
        {melhoria("historico", "Histórico")}
      </div>
    );
  }

  const ABAS: [Aba, string][] = [
    ["atencao", "Atenção"],
    ["carteira", "Carteira"],
    ["reunioes", "Reuniões"],
    ["historico", "Histórico"],
  ];

  return (
    <div className="spb-root">
      <div className="spb-barra">
        <div className="spb-marca">
          Parceria com Pablo
          <small>Você: {eu.nome}</small>
        </div>
        <nav className="spb-abas" aria-label="Seções da sala">
          {ABAS.map(([a, t]) => (
            <a key={a} href={`#${a}`} aria-current={rota.aba === a && !rota.ficha ? "page" : rota.aba === a ? "true" : undefined}>
              {t}
            </a>
          ))}
        </nav>
      </div>
      {aviso ? (
        <div className="spb-aviso" role="status">
          {aviso}
        </div>
      ) : null}
      {rota.ficha ? ficha(rota.ficha) : rota.aba === "carteira" ? carteira() : rota.aba === "reunioes" ? vistaReunioes() : rota.aba === "historico" ? historico() : atencao()}
      {modal ? <Modal m={modal} fechar={fechar} /> : null}
    </div>
  );
}
