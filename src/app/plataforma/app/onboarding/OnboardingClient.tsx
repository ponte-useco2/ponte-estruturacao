"use client";

/**
 * Onboarding (wireframe 1e) + primeiro acesso (passo 3 do wireframe 1d).
 *
 * Três passos declarados — perfil, o que você traz, território e setor — e uma
 * tela de boas-vindas que devolve os três caminhos possíveis a partir do perfil
 * escolhido. O perfil 07 (Equipe PONTE) aparece na lista mas não é selecionável:
 * é acesso interno por convite, não autocadastro.
 *
 * `?perfil=` e `?interesse=` chegam do formulário de lead da página pública,
 * que é onde a pessoa já declarou as duas coisas.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessao } from "../_lib/sessao";
import { INTERESSES, PERFIS, perfilDoRotuloPublico, perfilPor } from "../_lib/fixtures";
import type { PerfilId, Sessao } from "../_lib/tipos";
import { Gravador } from "../_componentes/Gravador";
import { Tag } from "../_componentes/primitivos";

const BASE = "/plataforma/app";

const CAMINHOS: Record<PerfilId, { titulo: string; ambiente: string; href: string }[]> = {
  empresa: [
    { titulo: "Ver capital compatível", ambiente: "Descobrir", href: `${BASE}/descobrir` },
    { titulo: "Apresentar meu desafio", ambiente: "Apresentar", href: `${BASE}/apresentar` },
    { titulo: "Entrar em um projeto", ambiente: "Compor", href: `${BASE}/compor` },
  ],
  especialista: [
    { titulo: "Ver chamadas para minha capacidade", ambiente: "Compor", href: `${BASE}/compor` },
    { titulo: "Cadastrar minha capacidade", ambiente: "Apresentar", href: `${BASE}/apresentar` },
    { titulo: "Ver janelas de capital abertas", ambiente: "Descobrir", href: `${BASE}/descobrir` },
  ],
  osc: [
    { titulo: "Apresentar um problema do território", ambiente: "Apresentar", href: `${BASE}/apresentar` },
    { titulo: "Ver linhas para OSC", ambiente: "Descobrir", href: `${BASE}/descobrir` },
    { titulo: "Acompanhar entregas e evidências", ambiente: "Construir", href: `${BASE}/construir` },
  ],
  territorio: [
    { titulo: "Apresentar problema público e ativos", ambiente: "Apresentar", href: `${BASE}/apresentar` },
    { titulo: "Ver janelas para município e consórcio", ambiente: "Descobrir", href: `${BASE}/descobrir` },
    { titulo: "Acompanhar projetos do território", ambiente: "Construir", href: `${BASE}/construir` },
  ],
  ict: [
    { titulo: "Oferecer capacidade científica", ambiente: "Apresentar", href: `${BASE}/apresentar` },
    { titulo: "Ver chamadas de pesquisa e validação", ambiente: "Compor", href: `${BASE}/compor` },
    { titulo: "Ver instrumentos de fomento", ambiente: "Descobrir", href: `${BASE}/descobrir` },
  ],
  capital: [
    { titulo: "Ver projetos em formação", ambiente: "Compor", href: `${BASE}/compor` },
    { titulo: "Acompanhar execução e evidência", ambiente: "Construir", href: `${BASE}/construir` },
    { titulo: "Ver o Grafo de relações", ambiente: "Grafo", href: `${BASE}/grafo` },
  ],
  ponte: [
    { titulo: "Curadoria de PJF", ambiente: "Compor", href: `${BASE}/compor` },
    { titulo: "Acompanhar execução", ambiente: "Construir", href: `${BASE}/construir` },
    { titulo: "Ver o Grafo", ambiente: "Grafo", href: `${BASE}/grafo` },
  ],
};

const SETORES = [
  "Saneamento e meio ambiente",
  "Indústria e manufatura",
  "Saúde",
  "Educação",
  "Agricultura e cadeia produtiva",
  "Infraestrutura urbana",
  "Cultura e economia criativa",
  "Outro",
];

/**
 * O gate espera o `sessionStorage` ser lido antes de montar o formulário, e o
 * formulário nasce já semeado com o que estiver lá. Assim não há efeito
 * sincronizando estado depois da renderização — nem um piscar de campo vazio.
 */
export function OnboardingClient() {
  const { sessao, carregada, salvar } = useSessao();
  const params = useSearchParams();

  const perfilDaUrl = perfilDoRotuloPublico(params.get("perfil"));
  const interesseDaUrl = params.get("interesse") ?? "";

  if (!carregada) {
    return (
      <div className="pa-pagina-estreita">
        <p className="pa-mono">Carregando sessão do protótipo…</p>
      </div>
    );
  }

  return (
    <Passos
      salvar={salvar}
      perfilInicial={perfilDaUrl ?? sessao?.perfil ?? "empresa"}
      interesseInicial={interesseDaUrl || (sessao?.interesse ?? "")}
      nomeInicial={sessao?.nome ?? ""}
      territorioInicial={sessao?.territorio ?? ""}
      setorInicial={sessao?.setor ?? ""}
    />
  );
}

interface PassosProps {
  salvar: (parcial: Partial<Sessao>) => void;
  perfilInicial: PerfilId;
  interesseInicial: string;
  nomeInicial: string;
  territorioInicial: string;
  setorInicial: string;
}

function Passos({
  salvar,
  perfilInicial,
  interesseInicial,
  nomeInicial,
  territorioInicial,
  setorInicial,
}: PassosProps) {
  const router = useRouter();

  const [passo, setPasso] = useState(1);
  const [perfil, setPerfil] = useState<PerfilId>(perfilInicial);
  const [interesse, setInteresse] = useState(interesseInicial);
  const [nome, setNome] = useState(nomeInicial);
  const [territorio, setTerritorio] = useState(territorioInicial);
  const [setor, setSetor] = useState(setorInicial);

  const escolhido = useMemo(() => perfilPor(perfil), [perfil]);
  const caminhos = CAMINHOS[perfil];

  function concluir() {
    salvar({ perfil, interesse, nome, territorio, setor, concluido: true });
    setPasso(4);
  }

  return (
    <div className="pa-pagina-estreita">
      {passo <= 3 && (
        <div className="pa-cartao pa-pilha-larga">
          <div>
            <p className="pa-kicker">Onboarding · passo {passo} de 3</p>
            {passo === 1 && (
              <>
                <h1 className="pa-titulo">Onde você entra nessa infraestrutura?</h1>
                <p>A PONTE não oferece a mesma relação para todos os atores.</p>
              </>
            )}
            {passo === 2 && (
              <>
                <h1 className="pa-titulo">O que você traz?</h1>
                <p>
                  Isso define quais chamadas e quais janelas de capital aparecem primeiro pra você.
                </p>
              </>
            )}
            {passo === 3 && (
              <>
                <h1 className="pa-titulo">Território e setor</h1>
                <p>Onde você atua. Serve para ordenar oportunidades e projetos por proximidade.</p>
              </>
            )}
          </div>

          {passo === 1 && (
            <>
              <div className="pa-grade pa-grade-2">
                {PERFIS.map((p) =>
                  p.porConvite ? (
                    <div key={p.id} className="pa-tracejado pa-perfil-convite">
                      <span className="pa-mono">{p.numero}</span>
                      <div>
                        <strong>{p.nome}</strong>
                        <span className="pa-mono">{p.resumo}</span>
                      </div>
                      <Tag tom="proto">Convite</Tag>
                    </div>
                  ) : (
                    <button
                      key={p.id}
                      type="button"
                      className={`pa-perfil-opcao${perfil === p.id ? " pa-ativo" : ""}`}
                      aria-pressed={perfil === p.id}
                      onClick={() => setPerfil(p.id)}
                    >
                      <span className="pa-mono">{p.numero}</span>
                      <strong>{p.nome}</strong>
                      <span className="pa-mono">{p.resumo}</span>
                    </button>
                  ),
                )}
              </div>

              <div className="pa-tracejado pa-pilha">
                <span className="pa-mono">Passos seguintes</span>
                <div className="pa-linha">
                  <Tag>2 · O que você traz</Tag>
                  <Tag>3 · Território e setor</Tag>
                </div>
              </div>
            </>
          )}

          {passo === 2 && (
            <>
              <div className="pa-campo">
                <label htmlFor="ob-interesse">Principal interesse</label>
                <select
                  id="ob-interesse"
                  className="pa-select"
                  value={interesse}
                  onChange={(e) => setInteresse(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {INTERESSES.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </div>

              <div className="pa-campo">
                <label htmlFor="ob-nome">Como quer ser chamado (opcional)</label>
                <input
                  id="ob-nome"
                  className="pa-input"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Primeiro nome ou nome da organização"
                  autoComplete="off"
                />
              </div>

              <div className="pa-cartao-plano">
                <Gravador rotulo="Conte em uma frase o que você traz" />
              </div>
            </>
          )}

          {passo === 3 && (
            <>
              <div className="pa-campo">
                <label htmlFor="ob-territorio">Território de atuação</label>
                <input
                  id="ob-territorio"
                  className="pa-input"
                  value={territorio}
                  onChange={(e) => setTerritorio(e.target.value)}
                  placeholder="Município / UF"
                  autoComplete="off"
                />
              </div>

              <div className="pa-campo">
                <label htmlFor="ob-setor">Setor principal</label>
                <select
                  id="ob-setor"
                  className="pa-select"
                  value={setor}
                  onChange={(e) => setSetor(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {SETORES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>

              <p className="pa-nota">
                Nada disso vai para servidor. Fica na sessão deste navegador e some quando a aba
                fecha. O cadastro real de interesse continua sendo o formulário da{" "}
                <Link href="/plataforma#participacao">apresentação pública</Link>.
              </p>
            </>
          )}

          <div className="pa-linha">
            {passo > 1 && (
              <button type="button" className="pa-btn" onClick={() => setPasso((p) => p - 1)}>
                Voltar
              </button>
            )}
            {passo < 3 ? (
              <button
                type="button"
                className="pa-btn pa-btn-primario"
                onClick={() => setPasso((p) => p + 1)}
              >
                Continuar
              </button>
            ) : (
              <button type="button" className="pa-btn pa-btn-primario" onClick={concluir}>
                Entrar no app
              </button>
            )}
            <div className="pa-espaco" />
            <Link href="/plataforma" className="pa-mono">
              Sair
            </Link>
          </div>

          {passo === 1 && (
            <p className="pa-nota">
              O perfil escolhido define o painel, o vocabulário e quais chamadas aparecem. O perfil
              07 entra por convite, não por autocadastro.
            </p>
          )}
        </div>
      )}

      {passo === 4 && (
        <div className="pa-cartao pa-pilha-larga">
          <div>
            <p className="pa-kicker">Primeiro acesso</p>
            <h1 className="pa-titulo">
              {nome ? `Bem-vindo, ${nome}.` : "Bem-vindo."} Vamos entender o que você traz.
            </h1>
          </div>

          <div className="pa-tracejado pa-pilha">
            <span className="pa-mono">Seu perfil declarado</span>
            <div className="pa-linha">
              <Tag tom="forte">{escolhido.nome}</Tag>
              {territorio && <Tag>{territorio}</Tag>}
              {setor && <Tag>{setor}</Tag>}
            </div>
            {interesse && <span className="pa-mono">Interesse: {interesse}</span>}
          </div>

          <div className="pa-pilha">
            {caminhos.map((c) => (
              <Link key={c.href} href={c.href} className="pa-caminho">
                <span>{c.titulo}</span>
                <span className="pa-mono">{c.ambiente}</span>
              </Link>
            ))}
          </div>

          <div className="pa-cartao-plano">
            <Gravador rotulo="Prefere falar? Conte por áudio o que você precisa" />
          </div>

          <div className="pa-linha">
            <button
              type="button"
              className="pa-btn pa-btn-primario"
              onClick={() => router.push(BASE)}
            >
              Continuar para o painel
            </button>
            <button type="button" className="pa-btn" onClick={() => setPasso(1)}>
              Trocar perfil
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
