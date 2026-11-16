// Só tipo: o Node apaga a linha ao rodar o teste, então o atalho "@/" não precisa resolver fora do Next.
import type { Apresentacao, Proposta } from "@/lib/oportunidades/proposta-observatorio";

/**
 * Proposta da PONTE para apreciação (16/11/2026). Objeto, produtos, evidências de conclusão, investimento e prazo vêm
 * da orientação de trabalho da equipe de 16/11/2026 e não mudam aqui sem nova validação.
 *
 * A Associação Ilha Tech é a entidade executora prevista. Não há aprovação institucional prévia dela, e a sala não
 * atribui aprovação nem endosso a ninguém (correção estratégica do titular, 16/11/2026).
 *
 * Nada foi acrescentado aqui: nenhum valor, critério normativo, parceria, resultado técnico ou financiamento. O que não
 * veio na orientação está vazio ou "em elaboração", de propósito.
 *
 * QUEM MUDA O QUÊ
 *   · `versao`: muda a cada alteração de texto ou número (AAAA-MM-DD.n), inclusive de `APRESENTACAO`, abaixo.
 *     Histórico: .1 = incremento 1; .2 = textos da rodada visual; .3 = síntese, entregas e reuso (rodada 5);
 *     .4 = ativos por natureza; .5 = proposta da PONTE para apreciação. Todas de 16/11/2026.
 *   · `composicao`: a equipe preenche linha a linha (atividade, unidade, quantidade, valor unitário em centavos e os
 *     produtos a que serve). Enquanto vazia, a página diz "composição em elaboração".
 *   · `evidencias`: resultado só entra como demonstrado quando chega verificado, com a fonte.
 */
export const PROPOSTA: Proposta = {
  versao: "2026-11-16.5",
  preparadaEm: "2026-11-16",
  titulo: "Observatório de Mobilidade Urbana de João Pessoa",
  autoria: "PONTE Estruturação de Projetos de Impacto",
  executoraPrevista: "Associação Ilha Tech",
  situacao: "para-apreciacao",
  objetoCurto:
    "Pesquisa aplicada e demonstração de inteligência territorial sobre o acesso da população de João Pessoa a " +
    "serviços essenciais, como primeira etapa do Observatório de Mobilidade Urbana.",
  objetoCompleto:
    "Desenvolver e validar, por pesquisa aplicada e experimentação tecnológica, um núcleo demonstrador de análise do " +
    "acesso a serviços essenciais em João Pessoa. O projeto integra e qualifica dados geoespaciais, desenvolve modelo e " +
    "protótipo interativo, investiga em campo as condições de caminhabilidade em territórios selecionados e sistematiza " +
    "metodologia e recomendações para a ampliação do Observatório, com divulgação pública dos resultados.",
  produtos: [
    {
      codigo: "P1",
      nome: "Base territorial e metodologia",
      evidencia: "Relatório metodológico, catálogo de fontes e processamento documentado.",
    },
    {
      codigo: "P2",
      nome: "Demonstrador funcional",
      evidencia: "Protótipo, testes reproduzíveis e demonstração registrada.",
    },
    {
      codigo: "P3",
      nome: "Pesquisa de campo e validação",
      evidencia: "Protocolo, registros de campo e comparação entre estimativas e observações.",
    },
    {
      codigo: "P4",
      nome: "Resultados e plano de ampliação",
      evidencia: "Relatório final, apresentação pública e plano de replicação.",
    },
  ],
  investimentoPretendidoCentavos: 20_000_000, // R$ 200.000,00
  // Em elaboração pela equipe. Vazia de propósito: inventar linha para satisfazer o tipo é o que a restrição 4 proíbe.
  composicao: [],
  prazoMeses: 8,
  evidencias: [],
};

/**
 * Os textos com que a sala se apresenta. Não constam da orientação de 16/11: são redação da PONTE, montada a partir do
 * objeto definido nela.
 *
 *   · cada `trecho` das etapas é cópia LITERAL do objeto completo (o teste confere);
 *   · nenhum texto de apresentação tem algarismo: indicador ou estatística só entra com fonte conferida;
 *   · nenhum texto diz que alguém aprovou, autorizou ou endossou a proposta (o teste confere);
 *   · a expansão e os novos projetos são hipótese, sem compromisso nesta proposta.
 */
export const APRESENTACAO: Apresentacao = {
  estado: "redacao-provisoria",
  // O que os R$ 200 mil financiam. Cada linha sai do objeto completo e das evidências de aceite; nada no passado.
  sintese: [
    {
      verbo: "Desenvolver",
      texto:
        "uma base territorial integrada e um modelo de análise do acesso a serviços essenciais, com protótipo interativo.",
      produtos: ["P1", "P2"],
    },
    {
      verbo: "Testar em campo",
      texto: "as estimativas do modelo nas condições de caminhabilidade de territórios selecionados.",
      produtos: ["P3"],
    },
    {
      verbo: "Validar e publicar",
      texto:
        "a comparação entre estimativas e observações, com a metodologia, as recomendações e o plano de ampliação.",
      produtos: ["P3", "P4"],
    },
  ],
  problema: {
    pergunta: "Como a população de João Pessoa alcança os serviços essenciais?",
    necessidade:
      "Para orientar decisões sobre a cidade, essa resposta precisa ser verificável: construída com dados " +
      "documentados, conferida em campo e divulgada publicamente.",
  },
  solucao:
    "Um núcleo demonstrador de análise do acesso a serviços essenciais, como primeira etapa do Observatório de " +
    "Mobilidade Urbana.",
  etapas: [
    {
      produto: "P1",
      rotulo: "Dados",
      trecho: "integra e qualifica dados geoespaciais",
      entrega: "Base territorial integrada e qualificada, com a metodologia de análise e o processamento documentados.",
    },
    {
      produto: "P2",
      rotulo: "Modelos",
      trecho: "desenvolve modelo e protótipo interativo",
      entrega: "Modelo de análise do acesso e protótipo interativo em funcionamento, com testes reproduzíveis.",
    },
    {
      produto: "P3",
      rotulo: "Validação",
      trecho: "investiga em campo as condições de caminhabilidade em territórios selecionados",
      entrega: "Pesquisa de campo em territórios selecionados, que confronta as estimativas do modelo com observações.",
    },
    {
      produto: "P4",
      rotulo: "Resultados",
      trecho:
        "sistematiza metodologia e recomendações para a ampliação do Observatório, com divulgação pública dos resultados",
      entrega: "Relatório final com resultados, recomendações e plano de ampliação do Observatório, apresentado publicamente.",
    },
  ],
  // Conduzida pela coordenação em outra sessão; a evidência técnica é dela. Nada entra como demonstrado até chegar
  // verificada, com a fonte (correção de escopo do titular, 16/11/2026).
  provaPreliminar: {
    estado: "nao-recebida",
    descricao: "Investigação preliminar de acessibilidade em João Pessoa.",
    conferencia:
      "Seus resultados técnicos não são apresentados nesta versão: entram como comprovados só quando verificados, com " +
      "a fonte.",
  },
  // O que fica para o Observatório, por natureza (titular, 16/11/2026). Cada ativo consta, com as mesmas palavras, da
  // evidência de conclusão do produto: são entregas previstas, não resultados já produzidos. O "uso" diz a finalidade.
  reuso: [
    { tipo: "tecnologico", ativo: "Catálogo de fontes", produto: "P1", uso: "Ponto de partida para incorporar novos dados, serviços e territórios." },
    { tipo: "tecnologico", ativo: "Processamento documentado", produto: "P1", uso: "Para refazer a análise quando os dados forem atualizados." },
    { tipo: "tecnologico", ativo: "Protótipo", produto: "P2", uso: "Base técnica para novas análises, a ampliar conforme o plano de ampliação." },
    { tipo: "tecnologico", ativo: "Testes reproduzíveis", produto: "P2", uso: "Para conferir o protótipo a cada mudança de dado ou de cálculo." },
    { tipo: "metodologico", ativo: "Relatório metodológico", produto: "P1", uso: "Para aplicar o mesmo método a outros serviços essenciais e territórios." },
    { tipo: "metodologico", ativo: "Protocolo", produto: "P3", uso: "Para repetir a pesquisa de campo em outros territórios, com o mesmo método." },
    { tipo: "metodologico", ativo: "Plano de replicação", produto: "P4", uso: "Roteiro das etapas seguintes do Observatório." },
    { tipo: "registro", ativo: "Registros de campo", produto: "P3", uso: "Primeira série de observações, para comparar com medições futuras." },
    { tipo: "registro", ativo: "Comparação entre estimativas e observações", produto: "P3", uso: "Referência para avaliar o modelo quando houver novos dados." },
    { tipo: "registro", ativo: "Demonstração registrada", produto: "P2", uso: "Registro do funcionamento do protótipo, para comparar com versões futuras." },
  ],
  novosProjetos:
    "As capacidades desta etapa poderão sustentar novos projetos e novos financiamentos para o Observatório. Eles não " +
    "fazem parte desta proposta: serão desenhados a partir do plano de ampliação e replicação do quarto produto.",
  expansao:
    "A ampliação do Observatório além desta etapa, orientada pelo plano de ampliação e replicação do quarto produto.",
  // A sala termina num convite para a conversa, nos termos em que o titular a define.
  conversa: [
    "A viabilização desta etapa inicial: enquadramento da proposta e composição financeira.",
    "O desenho do programa maior: novos projetos, capacidades e fontes de financiamento.",
  ],
  fontes: [
    "Objeto, produtos, evidências de conclusão, investimento e prazo: orientação de trabalho da equipe do Observatório " +
      "de Mobilidade Urbana, de 16/11/2026.",
    "Textos de apresentação (síntese, problema público, solução, entregas, reuso e continuidade): elaborados pela " +
      "PONTE a partir desse objeto.",
  ],
};
