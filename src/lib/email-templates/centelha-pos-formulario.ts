/**
 * Template do email automático enviado 1h após preenchimento do
 * formulário de pré-diagnóstico Centelha 3 PB.
 *
 * Tom: direto, profissional, sem urgência forçada.
 * Inclui:
 *   - Saudação personalizada com primeiro nome
 *   - Resumo do que foi preenchido
 *   - CTA primário: contratar Etapa 1 com cupom WS (-20%)
 *   - CTA secundário: link wa.me com mensagem pré-pronta
 *   - Disclaimer compliance
 */

interface CentelhaPosFormularioInput {
  nome: string;
  nomeProjeto?: string | null;
  area?: string | null;
  estagio?: string | null;
  /** Cupom de afiliado padrão a aplicar no checkout (default: WS) */
  cupom?: string;
  /** Tracking de afiliado (ex: "marcio") — propagado pra URL do checkout */
  ref?: string | null;
}

const PONTE_WHATSAPP = "5583996428315";
const PONTE_EMAIL = "diretoria.ponte.projetos@gmail.com";
const SITE_URL = "https://ponteprojetos.com.br";
const CHECKOUT_URL_BASE = `${SITE_URL}/centelha-3-pb/checkout`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderCentelhaPosFormularioEmail(
  input: CentelhaPosFormularioInput
) {
  const cupom = input.cupom ?? "WS";
  const refSuffix = input.ref
    ? `&ref=${encodeURIComponent(input.ref)}`
    : "";
  const checkoutUrl = `${CHECKOUT_URL_BASE}?cupom=${encodeURIComponent(
    cupom
  )}${refSuffix}`;

  const primeiroNome =
    input.nome.trim().split(/\s+/)[0] || "tudo certo";

  const projeto = input.nomeProjeto || "sua ideia";
  const area = input.area ? ` (${input.area})` : "";

  const subject = `${primeiroNome}, recebemos sua proposta — próximos passos pro Centelha 3 PB`;

  // Mensagem pré-pronta pro WhatsApp
  const waMessage = encodeURIComponent(
    `Olá! Sou ${input.nome}, preenchi o pré-diagnóstico do Centelha 3 PB sobre o projeto "${projeto}"${area} e gostaria de conversar sobre os próximos passos.`
  );
  const whatsappUrl = `https://wa.me/${PONTE_WHATSAPP}?text=${waMessage}`;

  const text = `Olá, ${primeiroNome}!

Recebemos sua proposta sobre ${projeto}${area}. Boa ideia, e bem encaixada na linha de inovação do Centelha 3 PB.

Nossa equipe vai analisar a aderência e entrar em contato pelo WhatsApp em até 24h úteis com o pré-diagnóstico inicial.

Enquanto isso, se quiser adiantar a estruturação técnica (a Etapa 1 leva 2 a 3 semanas — você não vai querer começar na última hora antes do prazo de 25/05/2026), pode contratar agora com 20% de desconto:

  Etapa 1 — Estruturação Técnica
  De R$ 2.700 por R$ 2.160 (cupom ${cupom})
  ${checkoutUrl}

Ou prefere conversar antes? Me chama no WhatsApp:
  ${whatsappUrl}

Qualquer dúvida, basta responder este email.

—
Equipe Ponte Projetos
Ponte Estruturação de Projetos de Impacto Inova Simples (I.S.)
CNPJ 64.318.188/0001-01 · ${PONTE_EMAIL}

A contratação não garante aprovação. A aprovação depende exclusivamente
das regras do edital, da avaliação da banca e da conformidade documental.
Serviço independente, sem vínculo institucional com FAPESQ, Finep, CNPq,
Fundação CERTI ou Programa Centelha.
`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;color:#0f172a;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">

          <!-- HEADER -->
          <tr>
            <td style="padding:32px 32px 16px;">
              <div style="font-size:14px;color:#059669;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px;">
                PONTE PROJETOS
              </div>
              <div style="font-size:14px;color:#64748b;">
                Centelha 3 PB · Pré-diagnóstico recebido
              </div>
            </td>
          </tr>

          <!-- CORPO -->
          <tr>
            <td style="padding:8px 32px 16px;">
              <h1 style="font-size:24px;font-weight:700;color:#0f172a;margin:0 0 16px;line-height:1.2;">
                Olá, ${escapeHtml(primeiroNome)}!
              </h1>
              <p style="font-size:16px;color:#334155;margin:0 0 16px;">
                Recebemos sua proposta sobre <strong>${escapeHtml(projeto)}</strong>${escapeHtml(area)}.
                Boa ideia, e bem encaixada na linha de inovação do Centelha 3 PB.
              </p>
              <p style="font-size:16px;color:#334155;margin:0 0 16px;">
                Nossa equipe vai analisar a aderência e entrar em contato pelo
                WhatsApp em até <strong>24h úteis</strong> com o pré-diagnóstico inicial.
              </p>
            </td>
          </tr>

          <!-- DESTAQUE: ANTECIPAR ESTRUTURAÇÃO -->
          <tr>
            <td style="padding:8px 32px 24px;">
              <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:20px;">
                <p style="font-size:15px;color:#064e3b;margin:0 0 12px;">
                  <strong>Quer adiantar a estruturação?</strong>
                </p>
                <p style="font-size:14px;color:#065f46;margin:0 0 16px;">
                  A Etapa 1 leva 2 a 3 semanas — você não vai querer começar na
                  última hora antes do prazo de submissão (25/05/2026).
                  Como você preencheu o pré-diagnóstico, separei um <strong>cupom
                  de 20% de desconto</strong> pra agilizar:
                </p>
                <div style="margin-bottom:12px;">
                  <span style="text-decoration:line-through;color:#9ca3af;font-size:14px;">R$ 2.700,00</span>
                  <span style="font-size:24px;font-weight:800;color:#047857;margin-left:8px;">R$ 2.160,00</span>
                  <span style="font-size:13px;color:#065f46;margin-left:8px;">com cupom <code style="background:#d1fae5;padding:2px 6px;border-radius:4px;font-family:monospace;">${escapeHtml(cupom)}</code></span>
                </div>
                <a href="${escapeHtml(checkoutUrl)}"
                   style="display:inline-block;background:#059669;color:#ffffff;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:600;text-decoration:none;">
                  Contratar Etapa 1 — R$ 2.160 →
                </a>
              </div>
            </td>
          </tr>

          <!-- WHATSAPP -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="font-size:15px;color:#334155;margin:0 0 12px;">
                <strong>Prefere conversar antes?</strong> Me chama no WhatsApp:
              </p>
              <a href="${escapeHtml(whatsappUrl)}"
                 style="display:inline-block;background:#ffffff;color:#0f172a;padding:12px 20px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;">
                💬 Falar agora no WhatsApp
              </a>
            </td>
          </tr>

          <!-- FOOTER LIGHT -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="font-size:14px;color:#64748b;margin:0;">
                Qualquer dúvida, basta responder este email.
              </p>
              <p style="font-size:14px;color:#0f172a;margin:8px 0 0;font-weight:600;">
                — Equipe Ponte Projetos
              </p>
            </td>
          </tr>

          <!-- COMPLIANCE FOOTER -->
          <tr>
            <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="font-size:11px;color:#64748b;line-height:1.5;margin:0 0 8px;">
                <strong>Ponte Estruturação de Projetos de Impacto Inova Simples (I.S.)</strong><br>
                CNPJ 64.318.188/0001-01 · R. Cassimiro de Abreu, 56, Sala 5 — Brisamar, João Pessoa/PB<br>
                <a href="mailto:${PONTE_EMAIL}" style="color:#059669;">${PONTE_EMAIL}</a>
              </p>
              <p style="font-size:10px;color:#94a3b8;line-height:1.5;margin:0;">
                A contratação não garante aprovação. A aprovação depende exclusivamente
                das regras do edital, da avaliação da banca e da conformidade documental.
                Serviço independente, sem vínculo institucional com FAPESQ, Finep, CNPq,
                Fundação CERTI ou Programa Centelha.
              </p>
            </td>
          </tr>

        </table>

        <!-- DISCLAIMER FORA DO CARD -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin-top:16px;">
          <tr>
            <td align="center" style="padding:0 16px;">
              <p style="font-size:11px;color:#94a3b8;margin:0;">
                Você recebeu este email porque preencheu o pré-diagnóstico
                em ${SITE_URL}/centelha-3-pb
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
