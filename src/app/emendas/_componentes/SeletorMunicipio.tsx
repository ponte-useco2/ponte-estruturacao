"use client";

/**
 * O seletor de município do início (versão 2): combobox com lista (setas, Enter, Esc; quantos achados, anunciado). É um
 * formulário GET para `/emendas/municipios` (o seletor de período fica fora dele, porque tem o próprio formulário, e o
 * botão aponta para ele pelo atributo `form`) (que leva à tela do município): sem JavaScript, o nome digitado vai no campo
 * `nome` e o servidor acha o município; com JavaScript, a escolha também vai no `municipio` (IBGE) e o endereço do
 * início passa a mostrar o município escolhido (o mapa destaca e diz quanto chegou lá).
 */
import { useRouter } from "next/navigation";
import {
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function SeletorMunicipio({
  municipios,
  inicial,
  periodo,
  children,
}: {
  municipios: { ibge: string; nome: string }[];
  inicial: { ibge: string; nome: string } | null;
  periodo: string;
  /** O seletor de período (do servidor), entre o campo e o botão. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const id = useId();
  const [consulta, setConsulta] = useState(inicial?.nome ?? "");
  const [escolhido, setEscolhido] = useState(inicial);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const q = semAcento(consulta);
  const achados = useMemo(() => {
    if (!q || (escolhido && q === semAcento(escolhido.nome))) return [];
    return municipios
      .filter((m) => semAcento(m.nome).includes(q))
      .sort(
        (a, b) =>
          (semAcento(a.nome).startsWith(q) ? 0 : 1) -
            (semAcento(b.nome).startsWith(q) ? 0 : 1) ||
          a.nome.localeCompare(b.nome, "pt-BR"),
      )
      .slice(0, 8);
  }, [q, municipios, escolhido]);
  const mostrar =
    aberto && !!q && !(escolhido && q === semAcento(escolhido.nome));
  const idLista = `${id}-lista`;
  const idOpcao = (i: number) => `${id}-op-${i}`;

  const escolher = (m: { ibge: string; nome: string }) => {
    setEscolhido(m);
    setConsulta(m.nome);
    setAberto(false);
    setAtivo(-1);
    router.replace(`/emendas?periodo=${periodo}&municipio=${m.ibge}`, {
      scroll: false,
    });
  };
  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberto(true);
      setAtivo((a) => Math.min(achados.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      const alvo = achados[ativo] ?? (achados.length === 1 ? achados[0] : null);
      if (mostrar && alvo) {
        e.preventDefault();
        escolher(alvo);
      }
    } else if (e.key === "Escape") {
      setAberto(false);
      setAtivo(-1);
    }
  };
  const status = mostrar
    ? achados.length
      ? `${achados.length} ${achados.length === 1 ? "município encontrado" : "municípios encontrados"}`
      : "Nenhum município com esse nome"
    : "";

  return (
    <div className="pilha" style={{ gap: 16 }}>
      <form
        id={`${id}-form`}
        action="/emendas/municipios"
        method="get"
        className="pilha"
        style={{ gap: 16 }}
      >
        <label
          htmlFor={`${id}-campo`}
          className="disp t28"
          style={{
            fontWeight: 720,
            lineHeight: 1.15,
            fontVariationSettings: "'wdth' 88",
          }}
        >
          Quais recursos chegaram ao seu município?
        </label>
        <div style={{ position: "relative" }}>
          <input
            id={`${id}-campo`}
            name="nome"
            className="campo t18"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={mostrar}
            aria-controls={idLista}
            aria-activedescendant={
              mostrar && ativo >= 0 ? idOpcao(ativo) : undefined
            }
            autoComplete="off"
            placeholder="Nome do município"
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value);
              setAberto(true);
              setAtivo(-1);
              if (
                escolhido &&
                semAcento(e.target.value) !== semAcento(escolhido.nome)
              )
                setEscolhido(null);
            }}
            onKeyDown={aoTeclar}
            onBlur={() => window.setTimeout(() => setAberto(false), 150)}
          />
          {mostrar ? (
            <ul
              id={idLista}
              role="listbox"
              aria-label="Municípios"
              className="lista-combo t16"
            >
              {achados.length ? (
                achados.map((m, i) => (
                  <li
                    key={m.ibge}
                    id={idOpcao(i)}
                    role="option"
                    aria-selected={i === ativo}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      escolher(m);
                    }}
                  >
                    {m.nome}
                  </li>
                ))
              ) : (
                <li
                  id={idOpcao(0)}
                  role="option"
                  aria-selected={false}
                  aria-disabled="true"
                >
                  Nenhum município com esse nome
                </li>
              )}
            </ul>
          ) : null}
        </div>
        <span className="sr" role="status" aria-live="polite">
          {status}
        </span>
        <input type="hidden" name="municipio" value={escolhido?.ibge ?? ""} />
        <input type="hidden" name="periodo" value={periodo} />
      </form>
      {children}
      <div>
        <button className="btn btn-pri t18" type="submit" form={`${id}-form`}>
          Ver {escolhido?.nome ?? "o município"}
        </button>
      </div>
    </div>
  );
}
