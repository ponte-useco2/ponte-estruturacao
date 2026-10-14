import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { acessoValido, nomeDoCookie, salaPorSlug, senhaDaSala, type DefinicaoSala } from "@/lib/oportunidades/sala";
import { hojeEmBrasilia } from "@/lib/oportunidades/sala-programas";
import { lerProgramasParaOsc } from "@/lib/oportunidades/sala.server";
import { ConteudoIlhaTech } from "../_salas/ilha-tech/Conteudo";

/**
 * A porta da sala: sem a variável da senha, fechada; sem o cookie certo, o formulário; com ele, o conteúdo. A senha nunca
 * vem no endereço: o formulário manda por POST para `entrar`, que devolve o cookie e volta aqui.
 */
export default async function SalaPage({
  params,
  searchParams,
}: {
  params: Promise<{ sala: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sala = salaPorSlug((await params).sala);
  if (!sala) notFound();

  const senha = senhaDaSala(sala, process.env);
  if (!senha) return <SalaFechada />;

  const valor = (await cookies()).get(nomeDoCookie(sala))?.value;
  if (!acessoValido(valor, sala, senha)) {
    const erro = (await searchParams).erro;
    return <FormularioSenha sala={sala} erro={typeof erro === "string" ? erro : undefined} />;
  }

  const hoje = hojeEmBrasilia();
  const leitura = await lerProgramasParaOsc("PB", hoje);
  return <ConteudoIlhaTech hoje={hoje} leitura={leitura} />;
}

function SalaFechada() {
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <div className="pa-pilha sl-porta">
        <p className="pa-kicker">Sala de trabalho</p>
        <h1 className="pa-titulo">Esta sala está fechada</h1>
        <p>Fale com a PONTE para combinar um novo acesso.</p>
      </div>
    </div>
  );
}

const ERROS: Record<string, string> = {
  senha: "A senha não confere. Confira com quem enviou o convite.",
  muitas: "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
};

function FormularioSenha({ sala, erro }: { sala: DefinicaoSala; erro?: string }) {
  const mensagem = erro ? ERROS[erro] : undefined;
  return (
    <div className="pa-pagina pa-pagina-estreita">
      <form method="post" action={`/sala/${sala.slug}/entrar`} className="pa-pilha sl-porta">
        <p className="pa-kicker">Sala de trabalho · acesso por convite</p>
        <h1 className="pa-titulo">Entrar na sala</h1>
        <p>Esta sala foi preparada pela PONTE para uma reunião. Digite a senha que veio com o convite.</p>
        <label htmlFor="sl-senha" className="pa-mono">
          Senha da sala
        </label>
        <input
          id="sl-senha"
          name="senha"
          type="password"
          required
          autoComplete="off"
          autoFocus
          className="pa-input"
          aria-describedby={mensagem ? "sl-erro" : undefined}
          aria-invalid={mensagem ? true : undefined}
        />
        {mensagem && (
          <p id="sl-erro" role="alert" className="pa-ressalva">
            {mensagem}
          </p>
        )}
        <button type="submit" className="pa-btn">
          Entrar
        </button>
      </form>
    </div>
  );
}
