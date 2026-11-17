import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { urlFicha } from "@/lib/oportunidades/emendas-recorte";

export const metadata: Metadata = { title: "Abrir uma emenda pelo código", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * O formulário "Abrir uma emenda pelo código" do início (GET, sem JavaScript): 12 dígitos, com ou sem espaços, vão
 * direto para a ficha; outra coisa volta com a explicação.
 */
export default async function AbrirEmenda({ searchParams }: Props) {
  const sp = await searchParams;
  const bruto = (Array.isArray(sp.codigo) ? sp.codigo[0] : sp.codigo) ?? "";
  const digitos = bruto.replace(/\D/g, "");
  if (digitos.length === 12) redirect(urlFicha(digitos, null));
  return (
    <section className="envolve pilha" style={{ paddingTop: 32, paddingBottom: 48, gap: 16 }}>
      <h1 className="disp titulo-tela">Abrir uma emenda pelo código</h1>
      <form action="/emendas/emenda" method="get" className="pilha" style={{ gap: 8, maxWidth: 560 }}>
        <label htmlFor="campo-codigo" className="t18" style={{ fontWeight: 700 }}>
          Código da emenda
        </label>
        <div className="linha-flex" style={{ gap: 12 }}>
          <input
            id="campo-codigo"
            name="codigo"
            className="campo t16 mono"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={bruto.slice(0, 40)}
            placeholder="2024 5007 0002"
            aria-describedby="msg-codigo"
            aria-invalid={bruto ? true : undefined}
            style={{ flex: "1 1 260px", width: "auto", minHeight: 48 }}
          />
          <button className="btn btn-pri t16" type="submit">
            Abrir a emenda
          </button>
        </div>
        <p id="msg-codigo" className="t14" role="status" style={{ fontWeight: 600 }}>
          O código da emenda tem 12 dígitos: ano, autoria e número.
        </p>
      </form>
      <p className="t14">
        <Link prefetch={false} href="/emendas">
          Voltar ao início
        </Link>
      </p>
    </section>
  );
}
