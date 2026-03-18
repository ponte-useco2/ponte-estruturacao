"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import nodemailer from "nodemailer";

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

    // 3. Send Emails via Nodemailer
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: `${payload.email_contato}, diretoria.ponte.projetos@gmail.com`,
        subject: `Novo Cadastro FINEP: ${payload.razao_social}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #4F46E5;">Confirmação de Envio - Formulário FINEP</h2>
            <p>Olá,</p>
            <p>Os dados para a subvenção FINEP da empresa <strong>${payload.razao_social}</strong> foram recebidos com sucesso.</p>
            <br/>
            <h3>Resumo das Informações:</h3>
            <ul>
              <li><strong>CNPJ:</strong> ${payload.cnpj}</li>
              <li><strong>Email de Contato:</strong> ${payload.email_contato}</li>
              <li><strong>Responsável:</strong> ${payload.responsavel_contato}</li>
              <li><strong>Data de Levantamento:</strong> ${payload.data_levantamento || "Não informada"}</li>
              <li><strong>Consultor Ponte:</strong> ${payload.consultor_ponte || "Não informado"}</li>
            </ul>
            <br/>
            <p>Atenciosamente,<br/><strong>Equipe Ponte Estruturação</strong></p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
    } else {
      console.warn("Nodemailer: Credentials not found in .env.local (EMAIL_USER, EMAIL_PASS). Emails visually skipped.");
    }

    return { success: true };
  } catch (err: unknown) {
    console.error("Erro inesperado no submit do FINEP:", err);
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
