/**
 * O glossário do Mapa (B7, 08/10/2026): todos os termos em ordem alfabética, agrupados pela letra inicial, cada um com
 * a explicação, o exemplo quando há, a fonte e os "veja também". Cada entrada tem a âncora `termo-<slug>`: é para lá
 * que leva o "Ver no glossário" do balão do `<Termo>`, e a entrada de destino fica marcada (`:target`).
 *
 * Os links internos são âncoras da própria página (`<a href="#...">`), não navegação do Next.
 */
import { ancoraTermo, termoPorSlug, termosPorLetra, type EntradaGlossario } from "@/lib/oportunidades/glossario";
import "../_componentes/termo.css";

const ancoraLetra = (letra: string) => `letra-${letra.toLowerCase()}`;

export function GlossarioConteudo() {
  const grupos = termosPorLetra();
  const total = grupos.reduce((s, g) => s + g.termos.length, 0);
  return (
    <div className="pa-pagina mp-radar mp-glossario">
      <div className="pa-pilha mp-radar-cabeca">
        <p className="pa-kicker">Mapa de Oportunidades</p>
        <h1 className="pa-titulo">Glossário</h1>
        <p className="pa-sub">
          Os {total} termos que aparecem no Mapa, em linguagem simples, com a norma ou a base de onde vêm. Nas páginas, a palavra com sublinhado
          pontilhado abre a explicação curta; aqui está a explicação inteira.
        </p>
      </div>

      <nav aria-label="Letras do glossário" className="mp-glossario-letras">
        {grupos.map((g) => (
          <a key={g.letra} href={`#${ancoraLetra(g.letra)}`} className="pa-chip">
            {g.letra}
          </a>
        ))}
      </nav>

      {grupos.map((g) => (
        <section key={g.letra} id={ancoraLetra(g.letra)} aria-labelledby={`${ancoraLetra(g.letra)}-titulo`} className="mp-radar-secao mp-glossario-letra">
          <h2 id={`${ancoraLetra(g.letra)}-titulo`} className="mp-radar-h2">
            {g.letra}
          </h2>
          <div className="mp-glossario-lista">
            {g.termos.map((t) => {
              const veja = t.veja.map((s) => termoPorSlug(s)).filter((x): x is EntradaGlossario => x !== undefined);
              return (
                <article key={t.slug} id={ancoraTermo(t.slug)} aria-labelledby={`${ancoraTermo(t.slug)}-nome`} className="pa-cartao mp-glossario-termo">
                  <h3 id={`${ancoraTermo(t.slug)}-nome`} className="mp-glossario-nome">
                    {t.termo}
                  </h3>
                  <p className="mp-glossario-curta">{t.curta}</p>
                  <p>{t.explica}</p>
                  {t.exemplo && (
                    <p>
                      <strong>Exemplo:</strong> {t.exemplo}
                    </p>
                  )}
                  <p className="mp-glossario-meta">
                    <strong>Fonte:</strong> {t.fonte}
                  </p>
                  {veja.length > 0 && (
                    <p className="mp-glossario-meta">
                      <strong>Veja também:</strong>{" "}
                      {veja.map((v, i) => (
                        <span key={v.slug}>
                          {i > 0 && "; "}
                          <a href={`#${ancoraTermo(v.slug)}`}>{v.termo}</a>
                        </span>
                      ))}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <p className="pa-nota">
        O glossário explica os termos como o Mapa os usa; não substitui a norma. Onde o termo é um recorte da PONTE (instrumento vivo, proposta
        parada, porte na PB), a entrada diz isso. Na dúvida sobre um caso concreto, vale a norma citada e a palavra do concedente.
      </p>
    </div>
  );
}
