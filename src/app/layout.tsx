import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ponte | Estruturação de Projetos",
  description: "Transformamos projetos complexos em propostas financiáveis, aprováveis e executáveis.",
  openGraph: {
    title: "Ponte | Estruturação de Projetos",
    description: "Transformamos projetos complexos em propostas financiáveis, aprováveis e executáveis.",
    url: "https://ponteprojetos.com.br", // URL assumida, pode ser ajustada via variável de ambiente depois
    siteName: "Ponte",
    images: [
      {
        url: "/og-image.jpg", // Imagem genérica sugerida para a pasta public
        width: 1200,
        height: 630,
        alt: "Ponte Estruturação de Projetos",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ponte | Estruturação de Projetos",
    description: "Transformamos projetos complexos em propostas financiáveis, aprováveis e executáveis.",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body
        className={`${inter.variable} ${plusJakartaSans.variable} antialiased text-slate-900 bg-white font-sans`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
