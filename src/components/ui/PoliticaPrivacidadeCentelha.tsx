"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface PoliticaPrivacidadeCentelhaProps {
  onClose: () => void;
}

/**
 * Modal de Política de Privacidade para a landing /centelha-3-pb.
 *
 * Usa <dialog> nativo HTML5 — foco-trap, ESC e click fora são gratuitos.
 * Estilizado com Tailwind (paleta slate+emerald do site da Ponte).
 */
export function PoliticaPrivacidadeCentelha({
  onClose,
}: PoliticaPrivacidadeCentelhaProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
    const handleNativeClose = () => onClose();
    dialog.addEventListener("close", handleNativeClose);
    return () => dialog.removeEventListener("close", handleNativeClose);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  };

  const requestClose = () => dialogRef.current?.close();

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-labelledby="centelha-privacy-title"
      className="w-[min(720px,95vw)] max-h-[90vh] p-0 border-0 rounded-2xl shadow-2xl bg-white text-slate-900 overflow-hidden backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-slate-200 bg-white">
          <h2
            id="centelha-privacy-title"
            className="text-lg md:text-xl font-bold text-slate-900 m-0"
          >
            Política de Privacidade
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Fechar política de privacidade"
            className="bg-transparent border-0 cursor-pointer p-2 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <article className="px-6 md:px-8 py-6 overflow-y-auto flex-1 text-[0.95rem] leading-relaxed text-slate-600 space-y-3">
          <p className="text-xs text-slate-400 italic mb-5">
            Última atualização: 30 de abril de 2026
          </p>

          <p>
            Esta Política de Privacidade descreve como a{" "}
            <strong className="text-slate-900">
              Ponte Estruturação de Projetos de Impacto Inova Simples (I.S.)
            </strong>{" "}
            coleta, utiliza, armazena e protege os dados pessoais fornecidos
            por meio do formulário de pré-diagnóstico do Programa Centelha 3
            PB, em conformidade com a Lei Geral de Proteção de Dados Pessoais
            (Lei nº 13.709/2018 – LGPD).
          </p>

          <h3 className="text-base font-bold text-slate-900 mt-6 mb-2">
            1. Quem somos (Controlador dos dados)
          </h3>
          <p>
            <strong className="text-slate-900">Razão social:</strong> Ponte
            Estruturação de Projetos de Impacto Inova Simples (I.S.)
            <br />
            <strong className="text-slate-900">CNPJ:</strong> 64.318.188/0001-01
            <br />
            <strong className="text-slate-900">Natureza jurídica:</strong>{" "}
            Empresa Simples de Inovação (ESI)
            <br />
            <strong className="text-slate-900">Endereço:</strong> R. Cassimiro
            de Abreu, 56, Sala 5 — Caixa Postal 54, Brisamar, João Pessoa/PB,
            CEP 58.033-330
            <br />
            <strong className="text-slate-900">Telefones:</strong> (83)
            9642-8315 / (21) 7636-8961
          </p>
          <p>
            Somos uma empresa de consultoria estratégica em estruturação de
            projetos de inovação e captação de recursos. Atuamos de forma
            independente, sem vínculo institucional com FAPESQ, Finep, CNPq,
            Fundação CERTI ou Programa Centelha.
          </p>
          <p>
            <strong className="text-slate-900">
              Contato do Encarregado pelo Tratamento de Dados (DPO):
            </strong>{" "}
            <a
              href="mailto:diretoria.ponte.projetos@gmail.com"
              className="text-emerald-700 underline"
            >
              diretoria.ponte.projetos@gmail.com
            </a>
          </p>

          <h3 className="text-base font-bold text-slate-900 mt-6 mb-2">
            2. Quais dados coletamos
          </h3>
          <p>Por meio do formulário de pré-diagnóstico, coletamos:</p>
          <ul className="list-disc pl-8 space-y-1.5">
            <li>Nome completo do proponente</li>
            <li>E-mail de contato</li>
            <li>Telefone/WhatsApp</li>
            <li>Município (PB) e situação relativa a CNPJ</li>
            <li>Nome e descrição do projeto ou ideia</li>
            <li>Área de atuação e estágio da solução</li>
            <li>Descrição do problema endereçado</li>
            <li>Link opcional para resumo, pitch ou vídeo</li>
            <li>Histórico em editais Centelha anteriores</li>
            <li>Indicação de interesse em análise de aderência</li>
          </ul>
          <p>
            Não coletamos dados sensíveis (origem racial, opinião política,
            religião, saúde, biometria, etc.) e não utilizamos cookies de
            rastreamento neste site.
          </p>

          <h3 className="text-base font-bold text-slate-900 mt-6 mb-2">
            3. Por que coletamos
          </h3>
          <p>Os dados são tratados exclusivamente para:</p>
          <ul className="list-disc pl-8 space-y-1.5">
            <li>
              <strong className="text-slate-900">
                Avaliação preliminar de aderência
              </strong>{" "}
              da ideia ao edital Centelha 3 PB (finalidade principal);
            </li>
            <li>
              <strong className="text-slate-900">Contato comercial</strong>{" "}
              para apresentar o resultado do pré-diagnóstico e, se for o caso,
              propor uma estruturação técnica;
            </li>
            <li>
              <strong className="text-slate-900">
                Atendimento a obrigações legais
              </strong>{" "}
              de registro e prestação de contas, quando aplicável.
            </li>
          </ul>

          <h3 className="text-base font-bold text-slate-900 mt-6 mb-2">
            4. Base legal
          </h3>
          <p>
            O tratamento é realizado com base nas seguintes hipóteses do art. 7º
            da LGPD:
          </p>
          <ul className="list-disc pl-8 space-y-1.5">
            <li>
              <strong className="text-slate-900">Consentimento</strong> do
              titular (art. 7º, I), manifestado no ato do envio do formulário;
            </li>
            <li>
              <strong className="text-slate-900">
                Procedimentos preliminares à execução de contrato
              </strong>{" "}
              de prestação de serviços (art. 7º, V), quando o titular demonstra
              interesse em contratar a consultoria.
            </li>
          </ul>

          <h3 className="text-base font-bold text-slate-900 mt-6 mb-2">
            5. Como armazenamos e protegemos
          </h3>
          <p>
            Os dados são armazenados em banco de dados gerenciado pelo{" "}
            <strong className="text-slate-900">Supabase</strong> (operador), com
            criptografia em trânsito (TLS) e em repouso. O acesso é restrito à
            equipe de diretoria da Ponte, mediante autenticação. Aplicamos
            políticas técnicas de segurança (Row Level Security, chaves de
            acesso segregadas) para impedir leitura ou modificação não
            autorizadas.
          </p>

          <h3 className="text-base font-bold text-slate-900 mt-6 mb-2">
            6. Compartilhamento com terceiros
          </h3>
          <p>
            <strong className="text-slate-900">
              Não vendemos nem cedemos dados
            </strong>{" "}
            a terceiros para fins comerciais. Compartilhamentos ocorrem apenas
            com:
          </p>
          <ul className="list-disc pl-8 space-y-1.5">
            <li>
              <strong className="text-slate-900">
                Sub-processadores essenciais
              </strong>{" "}
              à operação (Supabase, para armazenamento; provedor de e-mail;
              provedor de hospedagem) — todos vinculados a contratos com
              cláusulas de confidencialidade;
            </li>
            <li>
              <strong className="text-slate-900">Autoridades públicas</strong>,
              quando obrigatório por força de lei ou ordem judicial.
            </li>
          </ul>

          <h3 className="text-base font-bold text-slate-900 mt-6 mb-2">
            7. Por quanto tempo guardamos
          </h3>
          <p>
            Os dados são mantidos pelo prazo necessário ao atendimento das
            finalidades acima e às obrigações legais aplicáveis (em geral, até
            5 anos a partir do último contato), salvo solicitação anterior do
            titular para exclusão, observado o disposto no art. 16 da LGPD.
          </p>

          <h3 className="text-base font-bold text-slate-900 mt-6 mb-2">
            8. Seus direitos
          </h3>
          <p>
            Como titular dos dados, você tem direito, nos termos do art. 18 da
            LGPD, a:
          </p>
          <ul className="list-disc pl-8 space-y-1.5">
            <li>Confirmar a existência de tratamento dos seus dados;</li>
            <li>Acessar os dados que mantemos sobre você;</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
            <li>
              Solicitar a anonimização, bloqueio ou eliminação de dados
              desnecessários, excessivos ou tratados em desconformidade com a
              LGPD;
            </li>
            <li>Solicitar a portabilidade dos dados;</li>
            <li>Obter informação sobre uso compartilhado;</li>
            <li>Revogar o consentimento a qualquer momento.</li>
          </ul>
          <p>
            Para exercer qualquer um desses direitos, envie um e-mail para{" "}
            <a
              href="mailto:diretoria.ponte.projetos@gmail.com"
              className="text-emerald-700 underline"
            >
              diretoria.ponte.projetos@gmail.com
            </a>
            . Responderemos em até 15 dias.
          </p>

          <h3 className="text-base font-bold text-slate-900 mt-6 mb-2">
            9. Cookies e tecnologias de rastreamento
          </h3>
          <p>
            Este site{" "}
            <strong className="text-slate-900">
              não utiliza cookies de rastreamento, pixels publicitários ou
              ferramentas de analytics
            </strong>
            . Eventuais cookies estritamente técnicos usados pelo provedor de
            hospedagem têm finalidade exclusiva de funcionamento do site.
          </p>

          <h3 className="text-base font-bold text-slate-900 mt-6 mb-2">
            10. Atualizações desta política
          </h3>
          <p>
            Podemos atualizar esta política periodicamente. A data da última
            atualização está indicada no topo deste documento. Mudanças
            relevantes serão comunicadas por e-mail aos titulares cujos dados
            estiverem sob tratamento ativo.
          </p>

          <h3 className="text-base font-bold text-slate-900 mt-6 mb-2">
            11. Reclamações
          </h3>
          <p>
            Em caso de discordância com nossas práticas de tratamento, você
            pode reclamar diretamente ao DPO no e-mail acima ou à{" "}
            <strong className="text-slate-900">
              Autoridade Nacional de Proteção de Dados (ANPD)
            </strong>{" "}
            em{" "}
            <a
              href="https://www.gov.br/anpd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 underline"
            >
              gov.br/anpd
            </a>
            .
          </p>
        </article>

        <footer className="px-6 md:px-8 py-4 border-t border-slate-200 flex justify-end bg-white">
          <button
            type="button"
            onClick={requestClose}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 font-semibold transition-colors"
          >
            Entendi
          </button>
        </footer>
      </div>
    </dialog>
  );
}
