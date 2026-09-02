"use client";

/**
 * Formulário de Perfil Institucional — dossiê da OSC.
 *
 * O que a página é: um formulário longo que a instituição preenche por conta
 * própria, no navegador dela. NÃO há envio para servidor — de propósito. As
 * respostas ficam em localStorage enquanto o preenchimento acontece (é comum
 * levar dias e passar pelo contador), e o encerramento é manual: "Copiar
 * respostas" gera o texto que a pessoa cola no e-mail para
 * diretoria.ponte.projetos@gmail.com, junto com os PDFs.
 *
 * Consequência importante: dados sensíveis (CPF, RG, conta bancária) nunca
 * trafegam por aqui. Se um dia entrar envio direto, isso deixa de valer e o
 * texto da declaração LGPD no Bloco 10 precisa ser revisto junto.
 *
 * A estrutura das perguntas está em campos.ts; a aparência, em estilos.ts.
 * Este arquivo é a máquina (estado, progresso, cópia, impressão, limpeza) mais
 * os controles que reproduzem os componentes do design system do CTLC — Card,
 * SectionHeading, Input, Checkbox e Button. Eles são reconstruídos aqui, e não
 * importados do bundle do handoff, por dois motivos: o bundle é um arquivo de
 * protótipo que se registra num escopo global e não passa por build; e o Icon
 * dele busca SVG do unpkg em tempo de execução, o que colocaria uma CDN de
 * terceiro no caminho crítico de uma página que pede CPF.
 */

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  BLOCOS,
  ENTRADAS,
  TOTAL_CAMPOS,
  type Campo,
  type Marcador,
  type Secao,
} from "./campos";
import { definir, inscrever, limparTudo, snapshot, snapshotServidor } from "./rascunho";
import { BotaoEnviar } from "./BotaoEnviar";
import { montarTexto } from "./texto";
import { estilos } from "./estilos";

const EMAIL = "diretoria.ponte.projetos@gmail.com";

// ===================== textarea que cresce com o texto =====================

/**
 * `rows` define a altura mínima (é o que o desenho especifica por campo), mas
 * uma textarea de altura fixa esconde o excesso — e some com ele na impressão,
 * que é uma das duas saídas anunciadas no topo da página. Então ela cresce.
 */
function ajustarAltura(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto"; // volta à altura natural de `rows`
  const borda = el.offsetHeight - el.clientHeight;
  el.style.height = `${Math.max(el.offsetHeight, el.scrollHeight + borda)}px`;
}

function AreaTexto({
  campo,
  valor,
  aoMudar,
}: {
  campo: Campo;
  valor: string;
  aoMudar: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // useLayoutEffect: ajusta antes da pintura, senão a altura restaurada do
  // localStorage aparece por um quadro no tamanho errado.
  useLayoutEffect(() => ajustarAltura(ref.current), [valor]);

  // Largura muda ⇒ quebra de linha muda ⇒ altura muda. Vale sobretudo no
  // giro de tela do celular.
  useEffect(() => {
    const aoRedimensionar = () => ajustarAltura(ref.current);
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  return (
    <textarea
      ref={ref}
      id={campo.nome}
      name={campo.nome}
      rows={campo.linhas}
      placeholder={campo.placeholder}
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
    />
  );
}

// ============================== primitivas ==============================

/** Sobrescrita, título, filete e lede — o SectionHeading do design system. */
function Cabecalho({
  sobrescrita,
  titulo,
  lede,
  nivel = 2,
}: {
  sobrescrita: string;
  titulo: string;
  lede?: string;
  nivel?: 1 | 2;
}) {
  const Titulo = nivel === 1 ? "h1" : "h2";
  return (
    <header className="pfi-cabecalho">
      <span className="pfi-sobrescrita">{sobrescrita}</span>
      <Titulo className="pfi-cabecalho-titulo">{titulo}</Titulo>
      <span className="pfi-regua" />
      {lede ? <p className="pfi-lede">{lede}</p> : null}
    </header>
  );
}

function CampoTexto({
  campo,
  valor,
  aoMudar,
}: {
  campo: Campo;
  valor: string;
  aoMudar: (v: string) => void;
}) {
  const classe = `pfi-campo${campo.cheia ? " pfi-cheia" : ""}`;

  // Textarea: o rótulo envolve a caixa, e o texto de apoio vem antes dela.
  if (campo.linhas) {
    return (
      <label className={classe}>
        <span className="pfi-rotulo">{campo.rotulo}</span>
        {campo.ajuda ? <span className="pfi-ajuda">{campo.ajuda}</span> : null}
        <AreaTexto campo={campo} valor={valor} aoMudar={aoMudar} />
      </label>
    );
  }

  // Campo de uma linha: rótulo, caixa de altura fixa e dica embaixo. O rótulo
  // é irmão do input (não o envolve), então a associação é por id.
  return (
    <div className={classe}>
      <label className="pfi-rotulo" htmlFor={campo.nome}>
        {campo.rotulo}
      </label>
      <div className="pfi-caixa">
        <input
          id={campo.nome}
          name={campo.nome}
          type="text"
          placeholder={campo.placeholder}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
        />
      </div>
      {campo.dica ? <span className="pfi-dica">{campo.dica}</span> : null}
    </div>
  );
}

/** Tique da caixa marcada. Desenho do ícone `check` do Lucide, inline. */
function Tique() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CaixaMarcacao({
  item,
  marcado,
  aoMudar,
}: {
  item: Marcador;
  marcado: boolean;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <label className={`pfi-marca-item${item.descricao ? " pfi-com-descricao" : ""}`}>
      <input
        type="checkbox"
        name={item.nome}
        checked={marcado}
        onChange={(e) => aoMudar(e.target.checked)}
      />
      <span className="pfi-marca-caixa">{marcado ? <Tique /> : null}</span>
      <span className="pfi-marca-texto">
        <span className="pfi-marca-rotulo">{item.rotulo}</span>
        {item.descricao ? <span className="pfi-marca-descricao">{item.descricao}</span> : null}
      </span>
    </label>
  );
}

// ============================== a página ==============================

export function FormularioPerfil() {
  const respostas = useSyncExternalStore(inscrever, snapshot, snapshotServidor);
  const [rotuloCopia, setRotuloCopia] = useState("Copiar respostas");

  const texto = (nome: string) => {
    const v = respostas[nome];
    return typeof v === "string" ? v : "";
  };
  const marcado = (nome: string) => respostas[nome] === true;

  const preenchidos = ENTRADAS.filter((e) =>
    e.chave === "marca" ? marcado(e.nome) : texto(e.nome).trim() !== "",
  ).length;
  const pct = TOTAL_CAMPOS ? Math.round((preenchidos / TOTAL_CAMPOS) * 100) : 0;

  const copiar = async () => {
    const conteudo = montarTexto(respostas);
    const avisar = (rotulo: string) => {
      setRotuloCopia(rotulo);
      window.setTimeout(() => setRotuloCopia("Copiar respostas"), 1800);
    };
    try {
      await navigator.clipboard.writeText(conteudo);
      avisar("Copiado");
    } catch {
      // A Clipboard API exige contexto seguro e, em alguns navegadores,
      // permissão. Sem ela, resta o caminho antigo — e, se ele também
      // falhar, dizer que falhou em vez de mentir "Copiado".
      if (copiarPelaSelecao(conteudo)) avisar("Copiado");
      else avisar("Não foi possível copiar");
    }
  };

  const limpar = () => {
    if (!window.confirm("Apagar todas as respostas preenchidas neste navegador?")) return;
    limparTudo();
  };

  return (
    <div className="pfi-root">
      <style>{estilos}</style>

      <div className="pfi-topo pfi-noprint">
        <div className="pfi-topo-interno">
          <Link href="/" className="pfi-marca">
            Ponte<span>.</span>
          </Link>
          <span className="pfi-topo-titulo">Formulário de Perfil Institucional</span>
          <span className="pfi-pct">{pct}% preenchido</span>
          <div className="pfi-topo-acoes">
            <button
              type="button"
              className="pfi-btn pfi-btn-contorno"
              onClick={() => window.print()}
            >
              Imprimir / PDF
            </button>
            <button type="button" className="pfi-btn pfi-btn-primario" onClick={copiar}>
              {rotuloCopia}
            </button>
          </div>
        </div>
        <div
          className="pfi-trilho"
          role="progressbar"
          aria-label="Progresso do preenchimento"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="pfi-barra" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <form className="pfi-corpo" onSubmit={(e) => e.preventDefault()}>
        <div className="pfi-abertura">
          <Cabecalho
            nivel={1}
            sobrescrita="Dossiê institucional"
            titulo="Formulário de Perfil Institucional"
            lede="Este formulário reúne as informações que os editais e as parcerias com o poder público costumam exigir da organização. Preencha o que souber; o que faltar pode ser completado depois. As respostas ficam salvas neste navegador enquanto o preenchimento avança e só chegam à Ponte quando você usa o botão Enviar, no fim da página. Ao enviar, os dados passam a ser tratados pela Ponte conforme a autorização do bloco 10."
          />
          <p className="pfi-nota">
            Em caso de dúvida sobre qualquer campo, escreva “não sei” — o item será tratado na
            conversa seguinte.
          </p>
        </div>

        {BLOCOS.map((bloco) => (
          <section className="pfi-card" key={bloco.indice}>
            <div className="pfi-card-corpo">
              <Cabecalho sobrescrita={bloco.indice} titulo={bloco.titulo} lede={bloco.lede} />
              {bloco.secoes.map((secao, i) => (
                <SecaoBloco
                  key={i}
                  secao={secao}
                  texto={texto}
                  marcado={marcado}
                  definir={definir}
                />
              ))}
            </div>
          </section>
        ))}

        <footer className="pfi-rodape">
          <p>
            Ao terminar, use <strong>Enviar para a Ponte</strong> — as respostas chegam
            direto a nós. Os anexos em PDF continuam indo por e-mail para{" "}
            <strong>{EMAIL}</strong>. Se preferir revisar antes de enviar,{" "}
            <strong>Copiar respostas</strong> gera o texto completo.
          </p>
          <BotaoEnviar respostas={respostas} />
          <button type="button" className="pfi-btn pfi-btn-fantasma pfi-noprint" onClick={limpar}>
            Limpar formulário
          </button>
        </footer>
      </form>
    </div>
  );
}

function SecaoBloco({
  secao,
  texto,
  marcado,
  definir,
}: {
  secao: Secao;
  texto: (nome: string) => string;
  marcado: (nome: string) => boolean;
  definir: (nome: string, valor: string | boolean) => void;
}) {
  const caixa = (item: Marcador) => (
    <CaixaMarcacao
      key={item.nome}
      item={item}
      marcado={marcado(item.nome)}
      aoMudar={(v) => definir(item.nome, v)}
    />
  );

  switch (secao.tipo) {
    case "grade":
      return (
        <div className={`pfi-grade pfi-grade-${secao.colunas}`}>
          {secao.campos.map((campo) => (
            <CampoTexto
              key={campo.nome}
              campo={campo}
              valor={texto(campo.nome)}
              aoMudar={(v) => definir(campo.nome, v)}
            />
          ))}
        </div>
      );

    case "campo":
      return (
        <CampoTexto
          campo={secao.campo}
          valor={texto(secao.campo.nome)}
          aoMudar={(v) => definir(secao.campo.nome, v)}
        />
      );

    case "marcadores":
      return (
        <div className={`pfi-marcadores${secao.separador ? " pfi-marcadores-separador" : ""}`}>
          {secao.rotulo ? <span className="pfi-grupo-rotulo">{secao.rotulo}</span> : null}
          {secao.ajuda ? <span className="pfi-ajuda">{secao.ajuda}</span> : null}
          <div className={`pfi-marcadores-grade pfi-grade-${secao.colunas}`}>
            {secao.itens.map(caixa)}
          </div>
        </div>
      );

    case "checklist":
      return <div className="pfi-checklist">{secao.itens.map(caixa)}</div>;

    case "declaracoes":
      return <div className="pfi-declaracoes">{secao.itens.map(caixa)}</div>;
  }
}

/**
 * Cópia pelo caminho antigo: textarea fora da tela + execCommand. Depreciado,
 * mas é o único que funciona onde a Clipboard API não está disponível — http
 * na rede local, por exemplo. Retorna se deu certo.
 */
function copiarPelaSelecao(conteudo: string): boolean {
  try {
    const area = document.createElement("textarea");
    area.value = conteudo;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
