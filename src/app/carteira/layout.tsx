import { Poppins } from "next/font/google";

/**
 * A Poppins é a tipografia do design system CTLC, e não é usada em nenhuma
 * outra superfície do site — carregá-la no layout raiz custaria a fonte
 * inteira em toda página institucional para servir uma rota só.
 *
 * O `next/font` gera `--font-poppins`, que o @theme static do globals.css
 * consome como `--font-ct-sans`. A variável precisa estar num elemento que
 * envolva a tela; por isso o wrapper existe.
 */
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function CarteiraLayout({ children }: { children: React.ReactNode }) {
  return <div className={poppins.variable}>{children}</div>;
}
