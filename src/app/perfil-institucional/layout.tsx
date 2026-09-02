import { Poppins } from "next/font/google";

/**
 * Poppins entra só neste segmento de rota.
 *
 * É a tipografia do design system do CTLC, e o formulário foi desenhado nela.
 * O resto do site roda em Inter + Plus Jakarta (carregadas no layout raiz);
 * carregar uma terceira família globalmente penalizaria todas as páginas por
 * causa de uma. Aqui o `next/font` serve os arquivos do próprio domínio —
 * o design system apontava para a CDN da Fontsource, que traria um terceiro
 * host para o caminho crítico e um ponto extra de falha.
 */
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function PerfilInstitucionalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className={poppins.variable}>{children}</div>;
}
