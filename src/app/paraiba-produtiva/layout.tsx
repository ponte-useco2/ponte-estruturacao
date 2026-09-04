import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./estilos.css";

/**
 * Paraíba Produtiva — tipografia própria.
 *
 * Instrument Serif, Instrument Sans e JetBrains Mono não aparecem em nenhuma
 * outra superfície do site. Carregá-las no layout raiz cobraria as três
 * famílias em toda página institucional para servir uma rota só — o mesmo
 * raciocínio da Poppins em /carteira.
 *
 * O `next/font` gera um nome de família interno; os estilos da página apontam
 * para `--pp-serif`, `--pp-sans` e `--pp-mono`, definidos aqui a partir das
 * variáveis que ele expõe. O wrapper existe porque as variáveis precisam estar
 * num elemento que envolva a tela inteira.
 */
const serif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});

const sans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export default function ParaibaProdutivaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${serif.variable} ${sans.variable} ${mono.variable} pp-fontes`}>
      {children}
    </div>
  );
}
