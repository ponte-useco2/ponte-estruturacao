"use client";

/**
 * O esquema metodológico (16/11/2026): como o núcleo relaciona territórios, caminhos, serviços essenciais e barreiras
 * possíveis de caminhabilidade. É EXPRESSAMENTE CONCEITUAL — formas abstratas, sem coordenada, sem bairro, sem dado de
 * João Pessoa — e diz isso em texto, junto do desenho.
 *
 * A informação essencial está sempre visível: as quatro camadas, cada uma com a sua explicação. A interação só destaca
 * uma camada no desenho (as outras esmaecem), por clique ou teclado, com `aria-pressed`. Sem animação automática; a
 * transição de 200 ms só existe para quem não pediu menos movimento (`observatorio.css`).
 *
 * Os textos vêm por parâmetro, de `dados.ts`: este arquivo não escreve conteúdo.
 */
import { useState } from "react";
import type { CamadaDoEsquema } from "@/lib/oportunidades/proposta-observatorio";

type Id = CamadaDoEsquema["id"];

export function Esquema({ camadas, ressalva }: { camadas: CamadaDoEsquema[]; ressalva: string }) {
  const [foco, setFoco] = useState<Id | null>(null);
  const numero = (id: Id) => camadas.findIndex((c) => c.id === id) + 1;

  return (
    <div className="ob-esquema" data-foco={foco ?? undefined}>
      <figure className="ob-esq-figura">
        <svg
          className="ob-esq-svg"
          viewBox="0 0 640 360"
          role="img"
          aria-labelledby="ob-esq-titulo ob-esq-desc"
          focusable="false"
        >
          <title id="ob-esq-titulo">Esquema conceitual do núcleo demonstrador</title>
          <desc id="ob-esq-desc">{camadas.map((c) => `${c.rotulo}: ${c.texto}`).join(" ")}</desc>
          <defs>
            <pattern id="ob-esq-hachura" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" className="ob-esq-hachura-linha" />
            </pattern>
          </defs>

          {/* 1. territórios: duas áreas abstratas de onde as pessoas partem */}
          <g className="ob-esq-g ob-esq-territorio">
            <rect x="34" y="56" width="150" height="104" className="ob-esq-area" />
            <rect x="54" y="200" width="130" height="108" className="ob-esq-area" />
            <circle cx="150" cy="96" r="6" className="ob-esq-origem" />
            <circle cx="110" cy="136" r="6" className="ob-esq-origem" />
            <circle cx="150" cy="250" r="6" className="ob-esq-origem" />
          </g>

          {/* 2. caminhos: trajetos estimados até os serviços */}
          <g className="ob-esq-g ob-esq-caminhos">
            <polyline points="150,96 300,96 300,76 520,76" className="ob-esq-caminho" />
            <polyline points="110,136 260,136 260,180 520,180" className="ob-esq-caminho" />
            <polyline points="150,250 330,250 330,284 520,284" className="ob-esq-caminho" />
            <polyline points="260,180 400,180 400,284" className="ob-esq-caminho ob-esq-caminho-alternativo" />
          </g>

          {/* 3. serviços essenciais: os destinos */}
          <g className="ob-esq-g ob-esq-servicos">
            <rect x="520" y="58" width="36" height="36" className="ob-esq-servico" />
            <rect x="520" y="162" width="36" height="36" className="ob-esq-servico" />
            <rect x="520" y="266" width="36" height="36" className="ob-esq-servico" />
          </g>

          {/* 4. barreiras possíveis: o que pode interromper o caminho a pé — a conferir em campo */}
          <g className="ob-esq-g ob-esq-barreiras">
            <line x1="410" y1="166" x2="410" y2="194" className="ob-esq-barreira" />
            <line x1="420" y1="166" x2="420" y2="194" className="ob-esq-barreira" />
            <line x1="360" y1="270" x2="360" y2="298" className="ob-esq-barreira" />
          </g>

          {/* os números ligam o desenho à legenda */}
          {(
            [
              ["territorio", 70, 40],
              ["caminhos", 300, 60],
              ["servicos", 538, 40],
              ["barreiras", 415, 150],
            ] as [Id, number, number][]
          ).map(([id, x, y]) => (
            <g key={id} className={`ob-esq-g ob-esq-${id}`}>
              <circle cx={x} cy={y} r="13" className="ob-esq-marca" />
              <text x={x} y={y + 5} textAnchor="middle" className="ob-esq-marca-num">
                {numero(id)}
              </text>
            </g>
          ))}
        </svg>
        <figcaption className="ob-esq-ressalva">{ressalva}</figcaption>
      </figure>

      <ol className="ob-esq-legenda">
        {camadas.map((c, i) => (
          <li key={c.id}>
            <button
              type="button"
              className="ob-esq-botao"
              aria-pressed={foco === c.id}
              onClick={() => setFoco((atual) => (atual === c.id ? null : c.id))}
            >
              <span className="ob-esq-num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="ob-esq-texto">
                <strong>{c.rotulo}</strong>
                <span>{c.texto}</span>
                <span className="ob-esq-produtos">{c.produtos.join(" · ")}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
