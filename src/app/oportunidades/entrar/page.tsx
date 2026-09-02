import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BotaoGoogle } from "./BotaoGoogle";
import { visitanteAtual, authConfigurada } from "@/lib/supabase-auth";
import { estilosEntrada } from "../estilos-entrada";

export const metadata: Metadata = {
  title: "Entrar — Oportunidades | Ponte",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const { erro, next } = await searchParams;

  // Quem já está dentro não precisa ver isto de novo.
  if (authConfigurada()) {
    const v = await visitanteAtual();
    if (v?.status === "aprovado") redirect("/oportunidades");
    if (v) redirect("/oportunidades/aguardando");
  }

  const mensagens: Record<string, string> = {
    config: "A entrada ainda não foi configurada neste servidor. Avise a PONTE.",
    google: "O Google não concluiu a autenticação. Tente novamente.",
    sessao: "Não consegui criar sua sessão. Tente novamente.",
  };

  return (
    <div className="op-entrar-root">
      <div className="op-entrar-wrap">
        <div className="op-entrar-marca">PONTE · RADAR DE OPORTUNIDADES</div>
        <h1 className="op-entrar-titulo">Janelas abertas de convênio</h1>
        <p className="op-entrar-sub">
          Programas do Transferegov que ainda aceitam proposta ou emenda, com
          prazo, quem pode se candidatar e quantos concorrentes já entraram.
          Atualizado diariamente.
        </p>

        <div className="op-entrar-card">
          {erro && mensagens[erro] && (
            <div role="alert" className="op-entrar-erro">
              {mensagens[erro]}
            </div>
          )}

          <Suspense fallback={<div style={{ height: 46 }} />}>
            <BotaoGoogle proximo={next} />
          </Suspense>

          <p className="op-entrar-nota">
            O acesso é gratuito e passa por aprovação. Ao entrar pela primeira
            vez, seu pedido fica registrado e a diretoria libera em seguida —
            você recebe um aviso quando isso acontecer.
          </p>
        </div>

        {/*
          Aviso de privacidade.

          Não é formalidade: o cadastro é aberto a desconhecidos e o painel
          registra o que cada pessoa faz. Quem entra tem direito de saber
          disso ANTES de entrar, não depois — art. 9º da LGPD. Um aviso
          escondido em rodapé, ou escrito depois do consentimento, vicia o
          consentimento inteiro.
        */}
        <details className="op-entrar-lgpd">
          <summary>O que registramos sobre você</summary>
          <p>
            <strong>Dados coletados.</strong> Do seu perfil Google: nome,
            e-mail e foto. Do seu uso do painel: quando você entra, quais
            filtros aplica, quais oportunidades abre, quais links segue e o
            que busca.
          </p>
          <p>
            <strong>Por que.</strong> Para controlar quem tem acesso a uma área
            reservada, e para entender quais linhas de fomento interessam a
            quem usa o painel — o que orienta o que a PONTE prioriza.
          </p>
          <p>
            <strong>O que não coletamos.</strong> Endereço IP e identificação
            de aparelho não são registrados.
          </p>
          <p>
            <strong>Base legal.</strong> Consentimento do titular (art. 7º, I,
            LGPD), manifestado ao entrar; e legítimo interesse no controle de
            acesso à área reservada (art. 7º, IX).
          </p>
          <p>
            <strong>Controlador.</strong> PONTE Estruturação de Projetos de
            Impacto, CNPJ 64.318.188/0001-01.
          </p>
          <p>
            <strong>Seus direitos.</strong> Você pode pedir confirmação,
            acesso, correção, portabilidade ou exclusão dos seus dados a
            qualquer momento por{" "}
            <a href="mailto:diretoria.ponte.projetos@gmail.com">
              diretoria.ponte.projetos@gmail.com
            </a>
            . A exclusão apaga também seu histórico de uso.
          </p>
        </details>

        <a className="op-entrar-voltar" href="/">
          ← Site da PONTE
        </a>
      </div>

      <style>{estilosEntrada}</style>
    </div>
  );
}
