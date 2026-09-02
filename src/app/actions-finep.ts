"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { renderAdminNotificationEmail } from "@/lib/email-templates/admin-notification";

/**
 * Destinatário fixo, resolvido no servidor. Nunca vem do formulário.
 */
const ADMIN_EMAIL = process.env.EMAIL_USER || "diretoria.ponte.projetos@gmail.com";

export async function submitFinepForm(formData: FormData) {
  try {
    const supabase = createServerSupabaseClient();

    // Extracting data from FormData
    const payloadString = formData.get("data") as string;
    if (!payloadString) {
      return { success: false, error: "Nenhum dado enviado." };
    }

    const payload = JSON.parse(payloadString);
    const fileEntries = Array.from(formData.entries()).filter(([key]) => key.startsWith("file_"));
    const uploadedFiles: any[] = [];
    // 1. Upload files
    for (const [key, value] of fileEntries) {
      if (value instanceof File && value.size > 0) {
        const fileExt = value.name.split('.').pop();
        const fileName = `${payload.cnpj?.replace(/[^0-9]/g, '') || 'sem-cnpj'}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('finep_attachments')
          .upload(filePath, value);

        if (uploadError) {
          console.error("Erro no upload do arquivo:", uploadError);
          // Podemos decidir se continuamos ou falhamos tudo. Vamos continuar e avisar.
        } else if (uploadData) {
          uploadedFiles.push({
            originalName: value.name,
            path: uploadData.path,
            url: supabase.storage.from('finep_attachments').getPublicUrl(uploadData.path).data.publicUrl
          });
        }
      }
    }

    // 2. Insert into database
    const formDataToSave = {
      razao_social: payload.razao_social,
      cnpj: payload.cnpj,
      responsavel_contato: payload.responsavel_contato,
      data_levantamento: payload.data_levantamento || null,
      consultor_ponte: payload.consultor_ponte,

      elegivel_brasil: payload.q1 === 'sim',
      elegivel_fins_lucrativos: payload.q2 === 'sim',
      elegivel_nao_mei_ei_esi: payload.q3 === 'sim',
      elegivel_fora_lista_exclusao: payload.q4 === 'sim',
      regiao_projeto: payload.regiao_projeto,
      pd_no_brasil: payload.q6 === 'sim',

      rob_2025: payload.rob_2025 ? parseFloat(payload.rob_2025) : null,
      porte_empresa: payload.porte_empresa,
      pertence_grupo_economico: payload.q8 === 'sim',
      capacidade_aporte_proprio: payload.q9 === 'sim',

      rob_maior_100k: payload.q13 === 'sim',
      apoio_finep: payload.q14 === 'sim',
      apoio_sudene_sudeco_sudam: payload.q15 === 'sim',
      concluiu_sebrae: payload.q16 === 'sim',
      selecionada_aceleracao: payload.q17 === 'sim',

      possui_estatuto: payload.q18 === 'sim',
      possui_balanco_2025: payload.q20 === 'sim',
      possui_dre_2025: payload.q21 === 'sim',
      produzira_video: payload.q23 === 'sim',
      cadastro_finep_aprovado: payload.q24 === 'sim',

      certidoes_regularidade: payload.certidoes || {},
      unica_proposta: payload.q34 === 'sim',
      adimplente_finep: payload.q35 === 'sim',

      descricao_inovacao: payload.descricao_inovacao,
      missoes_nib: payload.missoes || [],
      trl_atual: payload.trl_atual,
      trl_final: payload.trl_final,
      merito_indicadores: payload.merito || {},

      valor_total_estimado: payload.v_total ? parseFloat(payload.v_total) : null,
      valor_solicitado_finep: payload.v_finep ? parseFloat(payload.v_finep) : null,
      financiamento_contrapartida: payload.q51 === 'nao', // 'nao' quer dizer que precisa de financiamento
      itens_despesa: payload.itens_despesa || [],

      diagnostico_status: payload.diagnostico_status,
      diagnostico_pendencias: payload.diagnostico_pendencias || [],

      arquivos_anexos: uploadedFiles,
      observacoes: payload.observacoes || {}
    };

    const { error: dbError } = await supabase
      .from("finep_subvencao_forms")
      .insert([formDataToSave]);

    if (dbError) {
      console.error("Erro ao salvar formulário na tabela:", dbError);
      return { success: false, error: dbError.message };
    }

    // 3. Notificação à diretoria — pelo mesmo caminho de todos os outros envios.
    //
    // Três mudanças em relação à versão anterior, e nenhuma delas é cosmética:
    //
    //   a) Passa por `sendEmail` em vez de instanciar o próprio transporter.
    //      Um transporte paralelo fura qualquer contador, reserva ou circuit
    //      breaker construído sobre `lib/email.ts` (ver SEC-001).
    //
    //   b) O destinatário é fixo. Antes incluía `payload.email_contato`, um
    //      endereço digitado no formulário público sem verificação de posse:
    //      qualquer visitante fazia o servidor enviar mensagem, em nome do
    //      domínio, para quem quisesse. A confirmação automática ao contato
    //      fica suspensa até existir verificação de posse — a equipe responde
    //      pelo botão do e-mail de notificação, que já traz o endereço.
    //
    //   c) Falha de e-mail não invalida o cadastro. Os dados já foram gravados;
    //      devolver erro aqui perderia um formulário legítimo por um problema
    //      de SMTP.
    //
    // O template escapa os valores; a versão anterior interpolava o payload
    // direto no HTML.
    try {
      const { subject, html, text } = renderAdminNotificationEmail({
        formLabel: "FINEP Subvenção — Diagnóstico",
        nome: payload.razao_social || "Empresa não informada",
        email: payload.email_contato,
        campos: [
          { label: "Razão social", value: payload.razao_social },
          { label: "CNPJ", value: payload.cnpj },
          { label: "Responsável", value: payload.responsavel_contato },
          { label: "E-mail de contato", value: payload.email_contato },
          { label: "Porte", value: payload.porte_empresa },
          { label: "Região do projeto", value: payload.regiao_projeto },
          { label: "TRL", value: payload.trl_atual ? `${payload.trl_atual} → ${payload.trl_final || "?"}` : null },
          { label: "Valor solicitado", value: payload.v_finep },
          { label: "Diagnóstico", value: payload.diagnostico_status },
          { label: "Data de levantamento", value: payload.data_levantamento },
          { label: "Consultor Ponte", value: payload.consultor_ponte },
          { label: "Anexos", value: uploadedFiles.length ? `${uploadedFiles.length} arquivo(s)` : null },
        ],
      });

      await sendEmail({
        to: ADMIN_EMAIL,
        subject,
        html,
        text,
        fromName: "Ponte — FINEP Subvenção",
      });
    } catch (notifyErr) {
      console.error("[actions-finep] falha ao notificar a diretoria:", notifyErr);
    }

    return { success: true };
  } catch (err: unknown) {
    console.error("Erro inesperado no submit do FINEP:", err);
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
