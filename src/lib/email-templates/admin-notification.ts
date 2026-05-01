/**
 * Template do email de notificação enviado ao admin (diretoria@ponteprojetos)
 * SEMPRE que um novo lead chega via formulário do site.
 *
 * Tom: direto, "operacional". Foco em mostrar TODOS os dados do lead de forma
 * scannable + atalhos pra ação imediata (WhatsApp, Email, Resumo do projeto).
 */

interface LeadField {
  label: string;
  value: string | null | undefined;
}

interface AdminNotificationInput {
  /** Identificador do formulário (ex: "Centelha 3 PB", "Diagnóstico Geral"). */
  formLabel: string;
  /** Nome do lead — usado no subject. */
  nome: string;
  /** Email do lead — pra botão "Responder por email". */
  email?: string | null;
  /** WhatsApp do lead — pra botão "Falar no WhatsApp" (formato: +55 83 99999-9999 ou só números). */
  whatsapp?: string | null;
  /** Lista ordenada de campos pra exibir na tabela do email. */
  campos: LeadField[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeWhatsapp(raw: string): string {
  // Mantém apenas dígitos
  const digits = raw.replace(/\D/g, "");
  // Se já começar com 55 e tiver 12-13 dígitos, é o formato do wa.me
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  // Se tiver 10-11 dígitos (DDD + número), prefixa 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

export function renderAdminNotificationEmail(input: AdminNotificationInput) {
  const subject = `[Ponte][Lead] ${input.formLabel} — ${input.nome}`;

  // Filtra campos vazios pra deixar o email enxuto
  const camposPreenchidos = input.campos.filter(
    (c) => c.value !== null && c.value !== undefined && String(c.value).trim() !== ""
  );

  // === TEXT version ===
  const textCampos = camposPreenchidos
    .map((c) => `${c.label}: ${c.value}`)
    .join("\n");

  let textActions = "";
  if (input.whatsapp) {
    const wa = normalizeWhatsapp(input.whatsapp);
    textActions += `\n\nWhatsApp direto: https://wa.me/${wa}`;
  }
  if (input.email) {
    textActions += `\nResponder por email: mailto:${input.email}`;
  }

  const text = `Novo lead recebido pelo site (${input.formLabel}):

${textCampos}${textActions}

—
Notificação automática do Ponte Projetos.
`;

  // === HTML version ===
  const linhasHtml = camposPreenchidos
    .map(
      (c) => `
        <tr>
          <td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#475569;font-size:13px;width:140px;vertical-align:top;border-bottom:1px solid #e2e8f0;">
            ${escapeHtml(c.label)}
          </td>
          <td style="padding:8px 12px;color:#0f172a;font-size:14px;border-bottom:1px solid #e2e8f0;word-break:break-word;">
            ${escapeHtml(String(c.value))}
          </td>
        </tr>`
    )
    .join("");

  let actionButtonsHtml = "";
  if (input.whatsapp || input.email) {
    const buttons: string[] = [];
    if (input.whatsapp) {
      const wa = normalizeWhatsapp(input.whatsapp);
      buttons.push(`
        <a href="https://wa.me/${wa}"
           style="display:inline-block;background:#22c55e;color:#ffffff;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;margin-right:8px;margin-bottom:8px;">
          💬 Falar no WhatsApp
        </a>`);
    }
    if (input.email) {
      buttons.push(`
        <a href="mailto:${escapeHtml(input.email)}"
           style="display:inline-block;background:#0f172a;color:#ffffff;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;margin-right:8px;margin-bottom:8px;">
          ✉️ Responder por email
        </a>`);
    }
    actionButtonsHtml = `
      <tr>
        <td style="padding:16px 24px 8px;">
          ${buttons.join("")}
        </td>
      </tr>`;
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(15,23,42,0.06);">

          <!-- HEADER -->
          <tr>
            <td style="padding:20px 24px;background:#059669;color:#ffffff;">
              <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;margin-bottom:4px;">
                Novo lead — ${escapeHtml(input.formLabel)}
              </div>
              <div style="font-size:20px;font-weight:700;">
                ${escapeHtml(input.nome)}
              </div>
            </td>
          </tr>

          <!-- BOTÕES DE AÇÃO -->
          ${actionButtonsHtml}

          <!-- TABELA DE DADOS -->
          <tr>
            <td style="padding:8px 24px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                ${linhasHtml}
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;">
              Notificação automática · Ponte Projetos · ${new Date().toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}
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
