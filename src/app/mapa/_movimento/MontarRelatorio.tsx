"use client";

/**
 * Montar o relatório (onda 16, M4, 27/10/2026): em todo relatório do Mapa, "Completo" ou "Escolher seções". As seções
 * desmarcadas saem da tela com uma animação curta e saem também do papel; as marcadas voltam no lugar. A escolha vai
 * para o endereço (`?secoes=`, `relatorio-parcial.ts`), e o link do relatório parcial pode ser enviado.
 *
 * As seções são as do próprio relatório, lidas da página: cada `section.mp-radar-secao` de primeiro nível com o `h2`
 * dela (o mesmo `Secao` que os relatórios já usam). Assim nenhum relatório precisa repetir a lista, e seção nova entra
 * sozinha. O painel de escolha usa o Framer Motion (pílula que desliza entre "Completo" e "Escolher", lista em
 * cascata, contagem que troca); a saída das seções, que são do servidor, usa a animação nativa do navegador.
 */
import { AnimatePresence, m } from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MOLA, atrasoDaCascata } from "@/lib/oportunidades/molas";
import { PARAMETRO_SECOES, enderecoComSecoes, gravarSecoes, lerSecoes, nomeDoRelatorio } from "@/lib/oportunidades/relatorio-parcial";
import { Movimento } from "./Movimento";

interface SecaoDoRelatorio {
  id: string;
  titulo: string;
}

const FORA = "data-mp-fora";

/** As seções de primeiro nível do relatório que contém o painel. */
function lerSecoesDaPagina(painel: HTMLElement): { lista: SecaoDoRelatorio[]; elementos: Map<string, HTMLElement> } {
  const raiz = painel.closest(".mp-laudo") ?? document.querySelector("main");
  const elementos = new Map<string, HTMLElement>();
  const lista: SecaoDoRelatorio[] = [];
  raiz?.querySelectorAll<HTMLElement>("section.mp-radar-secao").forEach((s) => {
    if (s.parentElement?.closest("section.mp-radar-secao")) return;
    const h2 = s.querySelector<HTMLElement>(":scope > h2[id]");
    if (!h2 || elementos.has(h2.id)) return;
    elementos.set(h2.id, s);
    lista.push({ id: h2.id, titulo: (h2.textContent ?? "").trim() || h2.id });
  });
  return { lista, elementos };
}

const semMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Tira ou devolve a seção, com uma animação curta (opacidade e um leve recuo); com movimento reduzido, direto. */
function mostrar(el: HTMLElement, visivel: boolean) {
  const fora = el.hasAttribute(FORA);
  if (visivel === !fora) return;
  if (semMovimento()) {
    el.toggleAttribute(FORA, !visivel);
    return;
  }
  if (visivel) {
    el.removeAttribute(FORA);
    el.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
  } else {
    el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-6px)" }], { duration: 160, easing: "ease-in" }).finished.then(
      () => el.setAttribute(FORA, ""),
      () => el.setAttribute(FORA, ""),
    );
  }
}

export function MontarRelatorio() {
  const painel = useRef<HTMLDivElement>(null);
  const elementos = useRef(new Map<string, HTMLElement>());
  const [secoes, setSecoes] = useState<SecaoDoRelatorio[]>([]);
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const [escolhendo, setEscolhendo] = useState(false);
  const grupo = useId();
  const todas = useMemo(() => secoes.map((s) => s.id), [secoes]);
  const completo = escolhidas.size === todas.length;

  // Lê as seções da página e a escolha do endereço, uma vez.
  useEffect(() => {
    if (!painel.current) return;
    const { lista, elementos: els } = lerSecoesDaPagina(painel.current);
    elementos.current = els;
    const ids = lista.map((s) => s.id);
    const iniciais = lerSecoes(new URLSearchParams(window.location.search).get(PARAMETRO_SECOES), ids);
    setSecoes(lista);
    setEscolhidas(iniciais);
    setEscolhendo(iniciais.size < ids.length);
  }, []);

  // Aplica a escolha nas seções e no endereço.
  useEffect(() => {
    if (!secoes.length) return;
    for (const [id, el] of elementos.current) mostrar(el, escolhidas.has(id));
    const novo = enderecoComSecoes(window.location.pathname + window.location.search + window.location.hash, gravarSecoes(escolhidas, todas));
    if (novo !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, "", novo);
  }, [escolhidas, secoes, todas]);

  if (!secoes.length) return <div ref={painel} hidden />;

  const alternar = (id: string) =>
    setEscolhidas((atual) => {
      const nova = new Set(atual);
      // Ao menos uma seção: relatório vazio não existe (a última fica marcada).
      if (nova.has(id) && nova.size > 1) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  const nome = nomeDoRelatorio(escolhidas.size, todas.length);

  return (
    <Movimento recursos="completo">
      <div ref={painel} className="mp-montar mp-nao-imprimir" role="group" aria-label="Montar o relatório">
        <div className="mp-montar-modo">
          {[
            { id: "completo", rotulo: "Completo", ativo: !escolhendo, acao: () => (setEscolhendo(false), setEscolhidas(new Set(todas))) },
            { id: "escolher", rotulo: "Escolher seções", ativo: escolhendo, acao: () => setEscolhendo(true) },
          ].map((b) => (
            <button key={b.id} type="button" className="mp-montar-botao" aria-pressed={b.ativo} onClick={b.acao}>
              {b.ativo && <m.span layoutId={`mp-montar-pilula-${grupo}`} className="mp-montar-pilula" transition={MOLA.firme} aria-hidden="true" />}
              <span className="mp-montar-rotulo">{b.rotulo}</span>
            </button>
          ))}
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={nome}
              className="pa-mono mp-montar-nome"
              role="status"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {nome}
            </m.span>
          </AnimatePresence>
        </div>
        <AnimatePresence initial={false}>
          {escolhendo && (
            <m.div
              key="lista"
              className="mp-montar-lista"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={MOLA.suave}
            >
              <ul>
                {secoes.map((s, i) => (
                  <m.li key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...MOLA.suave, delay: atrasoDaCascata(i, 0.03) }}>
                    <label>
                      <input type="checkbox" checked={escolhidas.has(s.id)} onChange={() => alternar(s.id)} />
                      {s.titulo}
                    </label>
                  </m.li>
                ))}
              </ul>
              <p className="mp-montar-atalhos">
                <button type="button" className="pa-btn pa-btn-pequeno" onClick={() => setEscolhidas(new Set(todas))}>
                  Marcar todas
                </button>
                <button type="button" className="pa-btn pa-btn-pequeno" onClick={() => setEscolhidas(new Set(todas.slice(0, 1)))}>
                  Deixar só a primeira
                </button>
                {!completo && <span className="pa-mono mp-montar-dica">O endereço desta página já guarda a escolha: copie para enviar.</span>}
              </p>
            </m.div>
          )}
        </AnimatePresence>
      </div>
      {!completo && (
        <p className="mp-so-imprimir pa-nota">
          {nome}: {secoes.filter((s) => escolhidas.has(s.id)).map((s) => s.titulo).join("; ")}.
        </p>
      )}
    </Movimento>
  );
}
