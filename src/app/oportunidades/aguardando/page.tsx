import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { visitanteAtual } from "@/lib/supabase-auth";
import { estilosEntrada } from "../estilos-entrada";
import { SairBotao } from "./SairBotao";

export const metadata: Metadata = {
  title: "Acesso em análise — Oportunidades | Ponte",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AguardandoPage() {
  const v = await visitanteAtual();
  if (!v) redirect("/oportunidades/entrar");
  if (v.status === "aprovado") redirect("/oportunidades");

  const bloqueado = v.status === "bloqueado";

  return (
    <div className="op-entrar-root">
      <div className="op-entrar-wrap">
        <div className="op-entrar-marca">PONTE · RADAR DE OPORTUNIDADES</div>

        <h1 className="op-entrar-titulo">
          {bloqueado ? "Acesso não liberado." : "Seu pedido está com a diretoria."}
        </h1>

        <p className="op-entrar-sub">
          {bloqueado ? (
            <>
              Este cadastro não foi aprovado para o painel. Se você acredita que
              houve engano, escreva para a diretoria.
            </>
          ) : (
            <>
              Recebemos sua solicitação com o e-mail <strong>{v.email}</strong>.
              A liberação é manual e costuma sair no mesmo dia útil.
            </>
          )}
        </p>

        <div className="op-entrar-card">
          {!bloqueado && (
            <ol className="op-espera-passos">
              <li className="feito">Você entrou com o Google</li>
              <li className="feito">Seu pedido foi registrado</li>
              <li>A diretoria libera o acesso</li>
              <li>Você recebe um e-mail e o painel abre</li>
            </ol>
          )}

          <p className="op-entrar-nota">
            Dúvidas ou urgência:{" "}
            <a href="mailto:diretoria.ponte.projetos@gmail.com">
              diretoria.ponte.projetos@gmail.com
            </a>
          </p>
        </div>

        {/*
          O botão de sair importa mais do que parece: sem ele, quem entrou com
          a conta Google errada fica preso nesta tela para sempre, porque o
          Google reautentica sozinho e a pessoa nunca escolhe outra conta.
        */}
        <SairBotao />

        <a className="op-entrar-voltar" href="/">
          ← Site da PONTE
        </a>
      </div>

      <style>{estilosEntrada}</style>
    </div>
  );
}
