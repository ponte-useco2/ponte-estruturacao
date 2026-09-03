"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { renderAdminNotificationEmail } from "@/lib/email-templates/admin-notification";
import { ENTRADAS, TOTAL_CAMPOS } from "./campos";
import { consumir, origemDoPedido } from "@/lib/freio";
import { montarTexto } from "./texto";
import type { Respostas } from "./rascunho";

/**
 * Recebimento do Perfil Institucional.
 *
 * O formulário nasceu sem servidor: preenchia, copiava e a instituição mandava
 * por e-mail. Agora envia — e isso muda a natureza da página. Ela deixa de ser
 * um instrumento que roda no navegador da instituição e passa a ser um sistema
 * que recebe e guarda dossiê com CPF, RG e conta bancária.
 *
 * Duas consequências foram tratadas junto, e não podem ser desfeitas sem
 * revisitar a outra:
 *
 *  1. O texto do bloco 10 (declaração LGPD) já autoriza a Ponte a tratar os
 *     dados. Continua verdadeiro. Mas a chamada do topo da página dizia que as
 *     respostas ficavam "neste navegador" — o que passou a ser meia verdade e
 *     foi corrigido.
 *
 *  2. O e-mail de aviso NÃO leva o dossiê. Leva razão social, CNPJ e horário.
 *     Mandar CPF e conta bancária por e-mail espalharia o dado por servidores,
 *     celulares e backups fora do seu controle, para ganhar conveniência de
 *     leitura. O dossiê fica num lugar só, e você vai lá quando precisar.
 */

const ADMIN_EMAIL = process.env.EMAIL_USER || "diretoria.ponte.projetos@gmail.com";

export interface EnvioResult {
  ok: boolean;
  erro?: string;
}

/**
 * Freio simples. A memória é por instância serverless, então não é limite
 * global — encarece o caso comum, não garante nada. Aqui basta: o formulário
 * tem quase cem campos, não é alvo de flood automatizado.
 */
const ultimoEnvio = new Map<string, number>();
const INTERVALO_MS = 30_000;

/**
 * Campos aceitos — derivados de ENTRADAS, que é a definição do formulário.
 *
 * A versão anterior gravava `respostas` INTEIRO, como veio. Sendo esta uma
 * action pública, isso era um depósito de JSON arbitrário aberto na internet:
 * com o `bodySizeLimit` do Next, cada requisição podia empurrar megabytes de
 * conteúdo qualquer para dentro de uma tabela que guarda CPF, RG e conta
 * bancária.
 *
 * Agora só entra o que o formulário define. Campo novo em campos.ts entra
 * sozinho aqui; campo inventado pelo cliente é descartado em silêncio.
 */
const CAMPOS_ACEITOS = new Set<string>(ENTRADAS.map((e) => e.nome));

/** Teto por campo de texto. O maior campo real do formulário não chega perto. */
const TAMANHO_CAMPO = 5000;

function filtrarRespostas(respostas: Respostas): Respostas {
  const limpo: Respostas = {};
  for (const [chave, valor] of Object.entries(respostas)) {
    if (!CAMPOS_ACEITOS.has(chave)) continue;
    if (typeof valor === "string") limpo[chave] = valor.slice(0, TAMANHO_CAMPO);
    else if (typeof valor === "boolean") limpo[chave] = valor;
    // Qualquer outro tipo (objeto, array, número) não existe no formulário e
    // não entra no banco.
  }
  return limpo;
}

function soDigitos(v: unknown): string {
  return typeof v === "string" ? v.replace(/\D/g, "") : "";
}

function texto(respostas: Respostas, nome: string): string {
  const v = respostas[nome];
  return typeof v === "string" ? v.trim() : "";
}

export async function enviarPerfil(respostas: Respostas): Promise<EnvioResult> {
  if (!respostas || typeof respostas !== "object") {
    return { ok: false, erro: "Nada para enviar." };
  }

  // Freio por origem, além do freio por CNPJ mais abaixo. O de CNPJ sozinho
  // não segura nada: bastava variar o CNPJ a cada requisição.
  const origem = await origemDoPedido("perfil");
  if (!consumir(origem, { limite: 4, janelaMs: 10 * 60 * 1000 })) {
    return { ok: false, erro: "Muitos envios em sequência. Aguarde alguns minutos e tente de novo." };
  }

  const razaoSocial = texto(respostas, "razao_social");
  const cnpj = texto(respostas, "cnpj");
  const emailContato = texto(respostas, "email");

  // Identificação mínima. Sem isso o registro chega e não dá para saber de
  // quem é — e um dossiê anônimo com CPF dentro é pior que nenhum dossiê.
  if (!razaoSocial) {
    return { ok: false, erro: "Preencha ao menos a razão social antes de enviar." };
  }

  // Consentimento. A declaração do bloco 10 é o que autoriza a Ponte a tratar
  // estes dados; sem ela marcada, não há base legal para guardar nada.
  if (respostas["dec_lgpd"] !== true) {
    return {
      ok: false,
      erro:
        "Marque a autorização de tratamento de dados (bloco 10) antes de enviar. " +
        "Sem ela não podemos guardar as informações.",
    };
  }

  const chave = soDigitos(cnpj) || razaoSocial.toLowerCase();
  const agora = Date.now();
  const anterior = ultimoEnvio.get(chave);
  if (anterior && agora - anterior < INTERVALO_MS) {
    return { ok: false, erro: "Envio já registrado. Aguarde um instante antes de reenviar." };
  }

  const preenchidos = ENTRADAS.filter((e) => {
    const v = respostas[e.nome];
    return e.chave === "marca" ? v === true : typeof v === "string" && v.trim() !== "";
  }).length;

  const respostasFiltradas = filtrarRespostas(respostas);
  const corpo = montarTexto(respostasFiltradas);

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("perfil_institucional").insert({
    razao_social: razaoSocial,
    cnpj: cnpj || null,
    email_contato: emailContato || null,
    respostas: respostasFiltradas,
    texto: corpo,
    campos_preenchidos: preenchidos,
    total_campos: TOTAL_CAMPOS,
  });

  // Falha ao gravar é falha do envio. Dizer "recebemos" sem ter recebido faria
  // a instituição apagar o rascunho dela achando que acabou.
  if (error) {
    console.error("perfil_institucional insert:", error.message);
    return {
      ok: false,
      erro: "Não conseguimos registrar o envio. Use 'Copiar respostas' e nos mande por e-mail.",
    };
  }

  ultimoEnvio.set(chave, agora);

  // Aviso à diretoria. Falha aqui NÃO invalida o envio: o dossiê já está
  // guardado, e derrubar a confirmação por causa do e-mail faria a instituição
  // preencher tudo de novo à toa.
  try {
    const { subject, html, text } = renderAdminNotificationEmail({
      formLabel: "Perfil Institucional",
      nome: razaoSocial,
      email: emailContato || null,
      campos: [
        { label: "Organização", value: razaoSocial },
        { label: "CNPJ", value: cnpj || "não informado" },
        { label: "E-mail de contato", value: emailContato || "não informado" },
        { label: "Preenchimento", value: `${preenchidos} de ${TOTAL_CAMPOS} campos` },
        {
          label: "Onde ler",
          value:
            "Supabase › Table Editor › perfil_institucional. O dossiê não vai " +
            "por e-mail: contém CPF, RG e dados bancários.",
        },
      ],
    });
    await sendEmail({
      to: ADMIN_EMAIL,
      subject,
      html,
      text,
      fromName: "Ponte — Perfil Institucional",
    });
  } catch (e) {
    console.error("aviso de perfil institucional:", e);
  }

  return { ok: true };
}
