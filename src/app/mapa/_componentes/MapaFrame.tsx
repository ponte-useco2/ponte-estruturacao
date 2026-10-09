import type { ReactNode } from "react";
import Link from "next/link";
import { ContaMenu, ContaPublica } from "./ContaMenu";
import { MapaNav } from "./MapaNav";
import { lerContexto } from "@/lib/oportunidades/organizacao.server";
import { contarNaoLidas } from "@/lib/oportunidades/notificacoes.server";
import { somaNaoLidos } from "@/lib/oportunidades/favoritos";
import { contarAvisosItensNaoLidos } from "@/lib/oportunidades/favoritos.server";
import { NOTA_DA_IMPRESSAO_PUBLICA, convitePublico, type SessaoPublica } from "@/lib/oportunidades/publico";
import { ehAdministrador } from "@/lib/supabase-auth";
import { AbrirAoImprimir } from "./AbrirAoImprimir";
import { EsperaDoMapa } from "./Carregando";
import { LinkMapa } from "./LinkMapa";
import "./pular.css";

/** A versão pública não tem conta: nem organização ativa, nem avisos para contar (C4a). */
const SEM_CONTA: [Awaited<ReturnType<typeof lerContexto>>, null, null] = [{ ativa: null, todas: [] }, null, null];

/**
 * O convite do topo de cada página aberta ao público (C4a, 09/10/2026): o que o cadastro abre ali e a porta para ele.
 * Mora na página, e não na moldura, porque a moldura não renderiza de novo na navegação dentro do Mapa e o convite muda
 * de página para página. `mp-mural` encosta a página que vem depois (mapa.css).
 *
 * Um `aside` só por página, com nome próprio (auditoria R1, 4.1). O botão tem 44 px de alvo, o mínimo do Mapa no
 * celular (`pa-btn-pequeno` tem 32). Na impressão o convite sai e fica uma linha dizendo que a página é a versão
 * pública (C5 da revisão R3: o Ctrl+P não se impede, mas o papel não pode passar pelo relatório completo).
 */
export function ConvitePublico({ sessao, caminho, acao }: { sessao: SessaoPublica; caminho: string; acao: string }) {
  const c = convitePublico(sessao, caminho, acao);
  return (
    <div className="pa-pagina mp-mural">
      <aside className="pa-cartao pa-cartao-plano mp-convite mp-nao-imprimir" aria-label="Versão pública do Mapa: o que o cadastro abre">
        <p>{c.texto}</p>
        <span className="pa-espaco" />
        <LinkMapa href={c.href} className="pa-btn" style={{ minHeight: 44 }}>
          {c.rotulo}
        </LinkMapa>
      </aside>
      <p className="mp-so-imprimir pa-nota">{NOTA_DA_IMPRESSAO_PUBLICA}</p>
    </div>
  );
}

/**
 * Moldura do Mapa de Oportunidades — o produto, não o protótipo.
 *
 * O Mapa nasceu como aba dentro de `/plataforma/app`, cuja moldura imprime
 * "Protótipo · Dados de projeto são ilustrativos · sem login real · sessão
 * apagada ao fechar a aba". Sobre o Mapa as três afirmações eram falsas: ele é
 * a única superfície com login real, RLS, dado oficial e cron. A faixa saiu
 * junto com o que a sustentava — `SessaoProvider` e o perfil de fixtures, o FAB
 * de voz e o `Conversa`, que responde com texto roteirizado.
 *
 * É componente de SERVIDOR. Desde 12/09/2026 o Mapa tem duas telas — Janelas
 * e Avisos —, e as abas dependem do caminho; por isso só elas (`MapaNav`) e o
 * menu de conta são cliente.
 *
 * C4a (09/10/2026): com a chave `MAPA_PUBLICO` ligada, a moldura também serve a versão pública (`publico`, no lugar
 * de `email` e `nome`): "Entrar" no lugar do menu da conta, só as abas de nível 0 e nenhuma leitura de banco ligada à
 * sessão. Com a chave desligada, o layout nunca passa `publico`, e a moldura é a de antes.
 *
 * Onda 8, C (09/10/2026), três peças da moldura, porque ela fica montada entre as páginas:
 * - `data-publico` em `.mp-root` só na versão pública (N13 da auditoria R1): o esqueleto do `loading.tsx` sabe o nível
 *   sem ler a sessão e desenha só as abas do público (esqueleto.css). Sem a chave, o atributo não existe;
 * - `EsperaDoMapa` (N22): a região de status única, que os links pendentes e os esqueletos alimentam (`Carregando.tsx`);
 * - `AbrirAoImprimir` (N21): os grupos fechados abrem antes de imprimir, também no Firefox e no Safari.
 */
export async function MapaFrame(
  props: { children: ReactNode } & (
    | { email: string; nome: string | null; publico?: undefined }
    | { publico: SessaoPublica; email?: undefined; nome?: undefined }
  ),
) {
  const { children } = props;
  const conta = props.publico === undefined ? { email: props.email, nome: props.nome } : null;
  const publico = props.publico ?? null;
  // A moldura lê o contexto de organização porque é ela que mostra qual está
  // ativa e oferece a troca. A página lê de novo, para saber se convida a
  // declarar: são duas responsabilidades distintas, e a leitura é barata.
  // O número da aba Avisos soma as duas filas: o que mudou no catálogo e o que mudou nos itens seguidos.
  const [{ ativa, todas }, naoLidasCatalogo, naoLidasItens] = conta
    ? await Promise.all([lerContexto(), contarNaoLidas(), contarAvisosItensNaoLidos()])
    : SEM_CONTA;
  const naoLidas = somaNaoLidos(naoLidasCatalogo, naoLidasItens);

  return (
    // `pa-root` é a raiz do design system: declara os alias de token e o reset.
    // `mp-root` ajusta o que é desta moldura — ver mapa.css.
    <div className="pa-root mp-root" data-publico={publico ? "sim" : undefined}>
      {/* Onda 8, C (N22): o contexto não desenha caixa; a região de status única fica no fim, depois do rodapé. */}
      <EsperaDoMapa>
        <AbrirAoImprimir />
        {/* B12 (08/10/2026; A15 da auditoria B1+B2): o primeiro Tab da página. São até 13 paradas no cabeçalho antes do
            conteúdo (11 abas para o administrador). Âncora da própria página, não rota: <a> simples, sem LinkMapa. */}
        <a href="#conteudo" className="mp-pular">
          Pular para o conteúdo
        </a>
        <header className="pa-top">
          <div className="pa-top-inner">
            <Link prefetch={false} href="/mapa" className="pa-marca">
              <span className="pa-marca-selo" aria-hidden="true">
                P
              </span>
              <span className="pa-marca-nome">
                PONTE <strong>Mapa de Oportunidades</strong>
              </span>
            </Link>

            <div className="pa-espaco" />

            {conta ? (
              <ContaMenu email={conta.email} nome={conta.nome} organizacoes={todas} ativa={ativa} />
            ) : (
              publico && <ContaPublica sessao={publico} />
            )}
          </div>

          <MapaNav
            naoLidas={naoLidas}
            admin={conta ? ehAdministrador(conta.email) : false}
            municipio={ativa?.tipo === "municipio" && Boolean(ativa.municipioIbge)}
            meuIbge={ativa?.tipo === "municipio" ? ativa.municipioIbge : null}
            organizacao={!!ativa && ativa.tipo !== "municipio" && Boolean(ativa.cnpj)}
            minhaEntidade={ativa && ativa.tipo !== "municipio" ? ativa.cnpj : null}
            publico={publico !== null}
          />
        </header>

        {/* `tabIndex={-1}`: o salto do "Pular para o conteúdo" leva também o foco, e o próximo Tab segue daqui. */}
        <main id="conteudo" tabIndex={-1} className="pa-main">
          {children}
        </main>

        <footer className="mp-rodape">
          <div className="mp-rodape-inner">
            <p className="pa-mono">{conta ? "Acesso restrito" : "Versão pública"} · fontes oficiais de fomento</p>
            <div className="pa-espaco" />
            {/* O glossário (B7) explica os termos que as páginas marcam; no menu não coube (onda 1 de UX, 08/10/2026).
                C4a: aberto também na versão pública (sem dado nenhum; ver `publico.ts`). */}
            <LinkMapa href="/mapa/glossario">Glossário</LinkMapa>
            <Link prefetch={false} href="/privacidade">Privacidade</Link>
            <Link prefetch={false} href="/termos">Termos</Link>
          </div>
        </footer>
      </EsperaDoMapa>
    </div>
  );
}
