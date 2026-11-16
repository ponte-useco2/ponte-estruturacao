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
 *     .4 = ativos por natureza; .5 = proposta da PONTE para apreciação; .6 = esquema e carteira macro;
 *     .7 = temas da próxima decisão (demonstrador e programa maior), redação do titular.
 *     Todas de 16/11/2026.
 *   · `composicao`: a equipe preenche linha a linha (atividade, unidade, quantidade, valor unitário em centavos e os
 *     produtos a que serve). Enquanto vazia, a página diz "composição em elaboração".
 *   · `evidencias`: resultado só entra como demonstrado quando chega verificado, com a fonte.
 */
export const PROPOSTA: Proposta = {
  versao: "2026-11-16.7",
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
 *   · a expansão, os novos projetos e a carteira são hipótese, sem orçamento, financiamento ou apoio presumido;
 *   · os componentes de cada projeto da carteira são ativos que o demonstrador entrega (o teste confere);
 *   · nenhum texto cita pessoa nem lhe atribui compromisso.
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
  // O esquema metodológico é CONCEITUAL: relaciona as quatro camadas sem fingir geografia de João Pessoa.
  esquema: {
    camadas: [
      { id: "territorio", rotulo: "Territórios", texto: "De onde as pessoas partem: os territórios selecionados para a pesquisa.", produtos: ["P1"] },
      { id: "caminhos", rotulo: "Caminhos", texto: "Os trajetos possíveis até os serviços, estimados pelo modelo.", produtos: ["P2"] },
      { id: "servicos", rotulo: "Serviços essenciais", texto: "Os destinos que a análise considera.", produtos: ["P1", "P2"] },
      { id: "barreiras", rotulo: "Barreiras possíveis", texto: "O que pode dificultar o caminho a pé: só a pesquisa de campo vai identificá-las.", produtos: ["P3"] },
    ],
    ressalva: "Esquema conceitual: não representa o território, os caminhos nem os serviços reais de João Pessoa.",
  },
  // A carteira macro (titular, 16/11/2026). Seis hipóteses de expansão: o problema é a pergunta que a cidade precisa
  // responder; a capacidade e as dependências vêm das frentes do programa nos materiais de trabalho da equipe.
  carteira: {
    abertura:
      "O primeiro investimento constrói a capacidade. Os próximos ampliam o que João Pessoa poderá compreender e avaliar.",
    projetos: [
      {
        nome: "Acessibilidade territorial ampliada",
        problema: "Quais partes da cidade têm mais dificuldade de chegar a serviços essenciais, e quais serviços ficam mais longe de quem precisa deles?",
        capacidade: "Estender a análise do acesso a hospitais, escolas, empregos e outros serviços, em mais territórios e por modo de deslocamento, para identificar desigualdades territoriais.",
        componentes: ["Catálogo de fontes", "Processamento documentado", "Protótipo", "Relatório metodológico"],
        dependencias: ["Dados atualizados sobre a localização e a oferta dos serviços.", "Bases de deslocamento por modo, com permissão de uso."],
      },
      {
        nome: "Mobilidade ativa e caminhabilidade",
        problema: "Onde caminhar até os serviços é difícil ou inseguro, e o que precisaria mudar no trajeto?",
        capacidade: "Levar a pesquisa de campo sobre caminhabilidade a novos territórios, com o mesmo protocolo, incluindo calçadas, travessias e rotas acessíveis.",
        componentes: ["Protocolo", "Registros de campo", "Comparação entre estimativas e observações"],
        dependencias: ["Equipe e logística de campo nos novos territórios.", "Participação dos moradores na pesquisa."],
      },
      {
        nome: "Transporte coletivo e integração modal",
        problema: "Como o transporte coletivo se conecta aos caminhos a pé até os serviços, e onde a integração entre os modos falha?",
        capacidade: "Analisar viagens, confiabilidade e atendimento do transporte coletivo e a integração entre os modos, para apoiar a melhoria do serviço.",
        componentes: ["Catálogo de fontes", "Processamento documentado", "Protótipo"],
        dependencias: ["Dados de itinerários, horários e operação do transporte coletivo.", "Cooperação com os responsáveis pela operação para o acesso aos dados."],
      },
      {
        nome: "Segurança viária",
        problema: "Onde os riscos no trânsito se concentram nos caminhos que as pessoas usam, e quais intervenções deveriam vir primeiro?",
        capacidade: "Acompanhar sinistros e condições de risco nos trajetos, para fundamentar a priorização de intervenções.",
        componentes: ["Catálogo de fontes", "Processamento documentado", "Registros de campo"],
        dependencias: ["Registros de sinistros de trânsito, com permissão de uso e proteção dos dados pessoais.", "Critérios de priorização definidos com os órgãos responsáveis."],
      },
      {
        nome: "Avaliação de intervenções e investimentos",
        problema: "As intervenções e os investimentos em mobilidade melhoram o acesso das pessoas, e como comparar alternativas antes de decidir?",
        capacidade: "Relacionar investimentos, entregas e indicadores aos efeitos no território, e comparar alternativas antes do investimento.",
        componentes: ["Relatório metodológico", "Processamento documentado", "Comparação entre estimativas e observações"],
        dependencias: ["Informações sobre intervenções e investimentos executados e previstos.", "Indicadores acompanhados ao longo do tempo."],
      },
      {
        nome: "Mobilidade sustentável e resiliência urbana",
        problema: "Como tornar os deslocamentos mais sustentáveis e a rede urbana mais preparada para interrupções e eventos extremos?",
        capacidade: "Avaliar a participação dos modos sustentáveis e a vulnerabilidade da rede a interrupções, para orientar o planejamento.",
        componentes: ["Catálogo de fontes", "Protótipo", "Plano de replicação"],
        dependencias: ["Dados ambientais e de ocorrências que afetam a circulação.", "Integração com o planejamento urbano e ambiental do município."],
      },
    ],
    // Só na página: a folha resume o primeiro investimento e não leva a carteira.
    fonte:
      "Projetos candidatos da carteira: elaborados pela PONTE a partir das frentes do programa discutidas nos materiais " +
      "de trabalho da equipe, de 16/11/2026.",
  },
  // O encerramento: uma decisão possível, sem atribuir compromisso a ninguém. Os dois temas são redação do titular
  // (16/11/2026): "potenciais fontes de financiamento" é menção, não recurso assegurado; "R$ 200 mil" é o valor
  // da própria proposta.
  proximaDecisao: {
    texto:
      "A próxima decisão possível é levar esta etapa inicial ao enquadramento e à composição financeira, e escolher " +
      "quais projetos da carteira merecem estudo.",
    temas: [
      {
        rotulo: "Demonstrador",
        texto:
          "Aprofundar o enquadramento, a composição financeira e as condições de execução da etapa inicial de " +
          "R$ 200 mil.",
      },
      {
        rotulo: "Programa maior",
        texto:
          "Selecionar os projetos prioritários da carteira, avaliar suas dependências e identificar instrumentos e " +
          "potenciais fontes de financiamento, sem pressupor compromissos já assumidos.",
      },
    ],
  },
  fontes: [
    "Objeto, produtos, evidências de conclusão, investimento e prazo: orientação de trabalho da equipe do Observatório " +
      "de Mobilidade Urbana, de 16/11/2026.",
    "Textos de apresentação (síntese, problema público, solução, entregas, reuso e continuidade): elaborados pela " +
      "PONTE a partir desse objeto.",
  ],
};
