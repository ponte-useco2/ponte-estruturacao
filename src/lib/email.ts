/**
 * Cliente de email via SMTP do Gmail (App Password).
 *
 * Variáveis necessárias:
 *   EMAIL_USER   — endereço gmail (ex: diretoria.ponte.projetos@gmail.com)
 *   EMAIL_PASS   — App Password do Gmail (NÃO a senha real)
 *
 * Para gerar App Password no Gmail:
 *   https://myaccount.google.com/apppasswords
 */

import nodemailer from "nodemailer";

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error(
      "EMAIL_USER ou EMAIL_PASS não configurados. Verifique .env.local e Vercel Env Vars."
    );
  }
  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
  return cachedTransporter;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Nome do remetente exibido no destinatário (ex: "Equipe Ponte Projetos") */
  fromName?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: input.fromName
        ? `"${input.fromName}" <${EMAIL_USER}>`
        : EMAIL_USER,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("[email] Falha ao enviar:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
