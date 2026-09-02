import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { clienteServidor, visitanteAtual, ehAdministrador } from "@/lib/supabase-auth";
import { estilosEntrada } from "../estilos-entrada";
import { LinhaAcesso } from "./LinhaAcesso";

export const metadata: Metadata = {
  title: "Acessos — Oportunidades | Ponte",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface Acesso {
  id: string;
  email: string;
  nome: string | null;
  status: string;
  solicitado_em: string;
  ultimo_acesso: string | null;
}

interface Uso {
  email: string;
  entradas: number;
  eventos: number;
  ultimo: string;
}

function dbr(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function AdminPage() {
  const v = await visitanteAtual();
  if (!v) redirect("/oportunidades/entrar?next=/oportunidades/admin");
  // Não-administrador não vê que esta página existe: vai para o painel comum.
  if (!ehAdministrador(v.email)) redirect("/oportunidades");

  const db = clienteServidor();

  const { data: acessos } = await db
    .from("oport_acesso")
    .select("id, email, nome, status, solicitado_em, ultimo_acesso")
    .order("status", { ascending: true })
    .order("solicitado_em", { ascending: false })
    .limit(300);

  const { data: eventos } = await db
    .from("oport_evento")
    .select("email, tipo, criado_em")
    .order("criado_em", { ascending: false })
    .limit(2000);

  // Agregação em memória: com poucas centenas de pessoas isto é mais simples
  // e mais barato que uma view, e evita mais um objeto para manter no banco.
  const porPessoa = new Map<string, Uso>();
  for (const e of (eventos || []) as { email: string; tipo: string; criado_em: string }[]) {
    const atual = porPessoa.get(e.email) || {
      email: e.email,
      entradas: 0,
      eventos: 0,
      ultimo: e.criado_em,
    };
    atual.eventos += 1;
    if (e.tipo === "entrada") atual.entradas += 1;
    if (e.criado_em > atual.ultimo) atual.ultimo = e.criado_em;
    porPessoa.set(e.email, atual);
  }

  const lista = (acessos || []) as Acesso[];
  const pendentes = lista.filter((a) => a.status === "pendente");
  const aprovados = lista.filter((a) => a.status === "aprovado");
  const bloqueados = lista.filter((a) => a.status === "bloqueado");
  const uso = [...porPessoa.values()].sort((a, b) => b.eventos - a.eventos);

  return (
    <div className="op-adm-root">
      <div className="op-adm-wrap">
        <div className="op-entrar-marca">PONTE · ACESSOS AO RADAR</div>
        <h1 className="op-entrar-titulo">
          {pendentes.length > 0
            ? `${pendentes.length} ${pendentes.length === 1 ? "pessoa espera" : "pessoas esperam"} liberação.`
            : "Nenhum pedido esperando."}
        </h1>
        <p className="op-entrar-sub">
          {aprovados.length} com acesso · {bloqueados.length} bloqueados
        </p>

        {pendentes.length > 0 && (
          <section>
            <h2 className="op-adm-h2">Esperando decisão</h2>
            <table className="op-adm-tab">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Pediu em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendentes.map((a) => (
                  <LinhaAcesso
                    key={a.id}
                    id={a.id}
                    email={a.email}
                    nome={a.nome}
                    quando={dbr(a.solicitado_em)}
                    status={a.status}
                  />
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section>
          <h2 className="op-adm-h2">Com acesso</h2>
          {aprovados.length === 0 ? (
            <p className="op-entrar-nota">Ninguém liberado ainda.</p>
          ) : (
            <table className="op-adm-tab">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Último acesso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {aprovados.map((a) => (
                  <LinhaAcesso
                    key={a.id}
                    id={a.id}
                    email={a.email}
                    nome={a.nome}
                    quando={dbr(a.ultimo_acesso)}
                    status={a.status}
                  />
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="op-adm-h2">Uso do painel</h2>
          <p className="op-entrar-nota" style={{ marginTop: 0, marginBottom: 14 }}>
            Contagem sobre os últimos 2.000 eventos registrados.
          </p>
          {uso.length === 0 ? (
            <p className="op-entrar-nota">Nenhuma atividade registrada ainda.</p>
          ) : (
            <table className="op-adm-tab">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Entradas</th>
                  <th>Ações</th>
                  <th>Última</th>
                </tr>
              </thead>
              <tbody>
                {uso.map((u) => (
                  <tr key={u.email}>
                    <td className="op-adm-email">{u.email}</td>
                    <td className="op-adm-num">{u.entradas}</td>
                    <td className="op-adm-num">{u.eventos}</td>
                    <td className="op-adm-num">{dbr(u.ultimo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {bloqueados.length > 0 && (
          <section>
            <h2 className="op-adm-h2">Bloqueados</h2>
            <table className="op-adm-tab">
              <tbody>
                {bloqueados.map((a) => (
                  <LinhaAcesso
                    key={a.id}
                    id={a.id}
                    email={a.email}
                    nome={a.nome}
                    quando={dbr(a.solicitado_em)}
                    status={a.status}
                  />
                ))}
              </tbody>
            </table>
          </section>
        )}

        <a className="op-entrar-voltar" href="/oportunidades">
          ← Painel de oportunidades
        </a>
      </div>

      <style>{estilosEntrada}</style>
      <style>{`
        .op-adm-root {
          min-height: 100dvh; background: var(--op-bg, #FCFCFB);
          color: var(--op-ink, #2E2C27); padding: 44px 20px 80px;
          font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
        }
        .op-adm-wrap { max-width: 860px; margin: 0 auto; }
        .op-adm-h2 {
          font-size: 11.5px; font-weight: 600; letter-spacing: .09em;
          text-transform: uppercase; color: var(--op-ink, #2E2C27);
          margin: 40px 0 14px;
        }
        .op-adm-tab { width: 100%; border-collapse: collapse; font-size: 14px; }
        .op-adm-tab th {
          text-align: left; font-size: 10.5px; letter-spacing: .07em;
          text-transform: uppercase; color: #B4B3A8; font-weight: 600;
          padding: 0 10px 8px 0; border-bottom: 1px solid #E4E3DC;
        }
        .op-adm-tab td {
          padding: 12px 10px 12px 0; border-bottom: 1px solid #E4E3DC;
          vertical-align: middle;
        }
        .op-adm-email { color: var(--op-ink, #2E2C27); font-weight: 600; }
        .op-adm-nome { display: block; font-size: 12.5px; color: #6B6A63; font-weight: 400; }
        .op-adm-num { font-variant-numeric: tabular-nums; color: #6B6A63; white-space: nowrap; }
        .op-adm-acoes { text-align: right; white-space: nowrap; }
        .op-adm-btn {
          font: inherit; font-size: 12.5px; font-weight: 600;
          padding: 6px 12px; margin-left: 6px; border-radius: 6px;
          border: 1px solid #D6D5CC; background: #fff; color: #2E2C27;
          cursor: pointer;
        }
        .op-adm-btn:hover:not(:disabled) { background: #F7F7F4; }
        .op-adm-btn:disabled { opacity: .5; cursor: not-allowed; }
        .op-adm-btn.sim { border-color: #5C7A5C; color: #40593F; }
        .op-adm-btn.nao { border-color: #C6613F; color: #A44C2E; }
        @media (max-width: 620px) {
          .op-adm-tab, .op-adm-tab tbody, .op-adm-tab tr, .op-adm-tab td { display: block; }
          .op-adm-tab thead { display: none; }
          .op-adm-tab td { border: none; padding: 3px 0; }
          .op-adm-tab tr { border-bottom: 1px solid #E4E3DC; padding: 14px 0; }
          .op-adm-acoes { text-align: left; margin-top: 8px; }
          .op-adm-btn { margin: 0 6px 0 0; }
        }
      `}</style>
    </div>
  );
}
