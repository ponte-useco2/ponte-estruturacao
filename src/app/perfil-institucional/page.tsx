import type { Metadata } from "next";
import { FormularioPerfil } from "./FormularioPerfil";

/**
 * `noindex`: a página é um instrumento de trabalho, enviada por link direto à
 * instituição que já está em conversa com a Ponte. Não é peça de captação, e
 * um formulário que pede CPF, RG e conta bancária não tem por que aparecer em
 * busca. Para torná-la pública, basta remover o bloco `robots`.
 */
export const metadata: Metadata = {
  title: "Formulário de Perfil Institucional | Ponte",
  description:
    "Dossiê institucional da organização: identificação, capacidade operacional, situação financeira, experiência e checklist de anexos exigidos por editais e parcerias com o poder público.",
  robots: { index: false, follow: false },
};

export default function PerfilInstitucionalPage() {
  return <FormularioPerfil />;
}
