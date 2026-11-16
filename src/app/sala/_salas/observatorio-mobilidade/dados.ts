// Só tipo: o Node apaga a linha ao rodar o teste, então o atalho "@/" não precisa resolver fora do Next.
import type { Apresentacao, Estimativa, Proposta } from "@/lib/oportunidades/proposta-observatorio";

/**
 * Proposta da PONTE para apreciação (16/11/2026). Objeto, produtos, evidências de conclusão, investimento e prazo vêm
 * da orientação de trabalho da equipe de 16/11/2026 e não mudam aqui sem nova validação.
 *
 * A Associação Ilha Tech é a entidade executora prevista. Não há aprovação institucional prévia dela, e a sala não
 * atribui aprovação nem endosso a ninguém (correção estratégica do titular, 16/11/2026).
 *
 * Nada foi acrescentado aqui: nenhum critério normativo, parceria, resultado técnico ou financiamento. Os valores
 * indicativos (envelopes do demonstrador, projetos e módulos da carteira) vêm da estratégia financeira preliminar da
 * coordenação, de 16/11/2026, como ESTIMATIVA INTERNA: não são cotação, orçamento aprovado nem compromisso financeiro.
 * O que não veio na orientação está vazio ou "em elaboração", de propósito.
 *
 * QUEM MUDA O QUÊ
 *   · `versao`: muda a cada alteração de texto ou número (AAAA-MM-DD.n), inclusive de `APRESENTACAO`, abaixo.
 *     Histórico: .1 = incremento 1; .2 = textos da rodada visual; .3 = síntese, entregas e reuso (rodada 5);
 *     .4 = ativos por natureza; .5 = proposta da PONTE para apreciação; .6 = esquema e carteira macro;
 *     .7 = temas da próxima decisão (demonstrador e programa maior), redação do titular;
 *     .8 = valores indicativos: envelopes do demonstrador e valores e módulos da carteira (estimativa interna);
 *     .9 = módulos pela matriz da coordenação, com entregas mensuráveis e autonomia; cards da carteira enxutos;
 *     .10 = autonomia em relação aos demais módulos, sobre a base do demonstrador; o "a partir de" não é alternativa
 *     ao investimento inaugural.
 *     Todas de 16/11/2026.
 *   · `envelopes`: a distribuição inicial dos R$ 200 mil, da coordenação. Referência para a pesquisa de preços; não
 *     substitui a composição, que continua em elaboração.
 *   · `composicao`: a equipe preenche linha a linha (atividade, unidade, quantidade, valor unitário em centavos e os
 *     produtos a que serve). Enquanto vazia, a página diz "composição em elaboração".
 *   · `evidencias`: resultado só entra como demonstrado quando chega verificado, com a fonte.
 */
/** A natureza dos valores indicativos desta versão: todos vêm da mesma decisão da coordenação. */
const ESTIMATIVA_DA_COORDENACAO: Estimativa = {
  natureza: "estimativa-interna",
  origem: "Estratégia financeira preliminar da coordenação, de 16/11/2026.",
};

export const PROPOSTA: Proposta = {
  versao: "2026-11-16.10",
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
  // Envelopes da coordenação (16/11/2026). A soma fecha com o investimento ao centavo (o teste confere).
  envelopes: {
    estimativa: ESTIMATIVA_DA_COORDENACAO,
    itens: [
      { rotulo: "Dados e base territorial", centavos: 3_000_000 },
      { rotulo: "Modelagem de acessibilidade", centavos: 4_800_000 },
      { rotulo: "Pesquisa empírica", centavos: 3_400_000 },
      { rotulo: "Protótipo tecnológico", centavos: 3_800_000 },
      { rotulo: "Avaliação e testes", centavos: 2_000_000 },
      { rotulo: "Documentação e transferência", centavos: 1_800_000 },
      { rotulo: "Coordenação e gestão", centavos: 1_200_000 },
    ],
  },
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
 *   · a expansão, os novos projetos e a carteira são hipótese, sem financiamento ou apoio presumido; os valores da
 *     carteira são estimativa interna, no campo próprio, e nunca aparecem no texto;
 *   · os títulos e as entregas dos módulos são redação provisória da PONTE, tirada da capacidade de cada projeto (a
 *     coordenação definiu os valores, não os títulos): validar antes do envio;
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
  // responder; a capacidade e as dependências vêm das frentes do programa nos materiais de trabalho da equipe. Os
  // valores, os títulos e a ordem dos módulos são da matriz da coordenação (revisão da entrega 13, 16/11/2026). As
  // entregas e a autonomia de cada módulo são redação da PONTE: o dependente diz de qual módulo anterior depende, e
  // só o potencialmente autônomo pode ser porta de entrada (o teste confere).
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
        totalIndicativoCentavos: 32_000_000, // R$ 320.000,00
        estimativa: ESTIMATIVA_DA_COORDENACAO,
        modulos: [
          {
            titulo: "Novos territórios",
            centavos: 7_000_000,
            autonomia: "potencialmente-autonomo",
            dependeDe: [],
            entregas: [
              "Base territorial estendida aos novos territórios definidos no plano de trabalho, com o processamento documentado.",
              "Análise do acesso aos serviços essenciais da etapa inicial em cada novo território, com o método da etapa inicial.",
              "Testes reproduzíveis atualizados para a base estendida.",
            ],
          },
          {
            titulo: "Novos serviços",
            centavos: 10_000_000,
            autonomia: "potencialmente-autonomo",
            dependeDe: [],
            entregas: [
              "Catálogo de fontes ampliado com a localização e a oferta de cada novo serviço essencial, com o período, a cobertura e as lacunas de cada fonte.",
              "Análise do acesso a cada novo serviço nos territórios da etapa inicial, com o mesmo método.",
              "Relatório metodológico atualizado com as escolhas feitas para cada novo serviço.",
            ],
          },
          {
            titulo: "Painéis de equidade",
            centavos: 15_000_000,
            autonomia: "dependente",
            dependeDe: ["Novos territórios", "Novos serviços"],
            entregas: [
              "Indicadores de equidade do acesso, com ficha técnica de cada indicador.",
              "Painéis no protótipo que comparam o acesso entre territórios e entre serviços, e por modo de deslocamento onde houver base de deslocamento com permissão de uso.",
              "Relatório sobre as desigualdades territoriais do acesso, com o método e os limites da análise.",
            ],
          },
        ],
      },
      {
        nome: "Mobilidade ativa e caminhabilidade",
        problema: "Onde caminhar até os serviços é difícil ou inseguro, e o que precisaria mudar no trajeto?",
        capacidade: "Levar a pesquisa de campo sobre caminhabilidade a novos territórios, com o mesmo protocolo, incluindo calçadas, travessias e rotas acessíveis.",
        componentes: ["Protocolo", "Registros de campo", "Comparação entre estimativas e observações"],
        dependencias: ["Equipe e logística de campo nos novos territórios.", "Participação dos moradores na pesquisa."],
        totalIndicativoCentavos: 30_000_000, // R$ 300.000,00
        estimativa: ESTIMATIVA_DA_COORDENACAO,
        modulos: [
          {
            titulo: "Inventário territorial",
            centavos: 6_000_000,
            autonomia: "potencialmente-autonomo",
            dependeDe: [],
            entregas: [
              "Inventário georreferenciado de calçadas, travessias e rampas nos territórios definidos no plano de trabalho, com ficha por trecho.",
              "Método de levantamento documentado, para repetir o inventário em outros territórios.",
            ],
          },
          {
            titulo: "Auditoria ampliada",
            centavos: 10_000_000,
            autonomia: "dependente",
            dependeDe: ["Inventário territorial"],
            entregas: [
              "Protocolo de auditoria revisto para incluir calçadas, travessias e rotas acessíveis.",
              "Auditoria de campo dos trechos inventariados, com registros comparáveis aos da etapa inicial.",
              "Comparação, trecho a trecho, entre o inventário e as condições observadas na auditoria.",
            ],
          },
          {
            titulo: "Priorização de melhorias",
            centavos: 14_000_000,
            autonomia: "dependente",
            dependeDe: ["Auditoria ampliada"],
            entregas: [
              "Critérios de priorização documentados, com o peso e a justificativa de cada critério.",
              "Lista priorizada de melhorias nos trechos auditados, com a justificativa de cada posição.",
              "Recomendações para os trajetos até os serviços, com as rotas acessíveis indicadas.",
            ],
          },
        ],
      },
      {
        nome: "Transporte coletivo e integração modal",
        problema: "Como o transporte coletivo se conecta aos caminhos a pé até os serviços, e onde a integração entre os modos falha?",
        capacidade: "Analisar viagens, confiabilidade e atendimento do transporte coletivo e a integração entre os modos, para apoiar a melhoria do serviço.",
        componentes: ["Catálogo de fontes", "Processamento documentado", "Protótipo"],
        dependencias: ["Dados de itinerários, horários e operação do transporte coletivo.", "Cooperação com os responsáveis pela operação para o acesso aos dados."],
        totalIndicativoCentavos: 47_000_000, // R$ 470.000,00
        estimativa: ESTIMATIVA_DA_COORDENACAO,
        modulos: [
          {
            titulo: "Diagnóstico de dados operacionais",
            centavos: 9_000_000,
            autonomia: "potencialmente-autonomo",
            dependeDe: [],
            entregas: [
              "Inventário dos dados operacionais do transporte coletivo (itinerários, horários, posição dos veículos e bilhetagem), com a situação de cada fonte: acesso, formato, período, cobertura e lacunas.",
              "Integração à base territorial dos dados operacionais que forem disponibilizados, com o processamento documentado.",
              "Relatório de diagnóstico com as condições de uso de cada fonte e o que falta para as análises seguintes.",
            ],
          },
          {
            titulo: "Acessibilidade multimodal",
            centavos: 16_000_000,
            autonomia: "dependente",
            dependeDe: ["Diagnóstico de dados operacionais"],
            entregas: [
              "Análise do acesso aos serviços essenciais combinando caminhada e transporte coletivo, com o método da etapa inicial.",
              "Mapa dos pontos de integração entre os modos, com os critérios usados para avaliar cada ponto.",
              "Painel no protótipo com o acesso por combinação de modos, com testes reproduzíveis.",
            ],
          },
          {
            titulo: "Monitoramento de confiabilidade",
            centavos: 22_000_000,
            autonomia: "dependente",
            dependeDe: ["Diagnóstico de dados operacionais"],
            entregas: [
              "Indicadores de confiabilidade do serviço, como o cumprimento de horários e a regularidade, com ficha técnica de cada indicador e calculados só com os dados que o diagnóstico confirmar.",
              "Rotina de atualização documentada, para recalcular os indicadores a cada nova série de dados.",
              "Painel de acompanhamento da confiabilidade no protótipo, com testes reproduzíveis.",
            ],
          },
        ],
      },
      {
        nome: "Segurança viária",
        problema: "Onde os riscos no trânsito se concentram nos caminhos que as pessoas usam, e quais intervenções deveriam vir primeiro?",
        capacidade: "Acompanhar sinistros e condições de risco nos trajetos, para fundamentar a priorização de intervenções.",
        componentes: ["Catálogo de fontes", "Processamento documentado", "Registros de campo"],
        dependencias: ["Registros de sinistros de trânsito, com permissão de uso e proteção dos dados pessoais.", "Critérios de priorização definidos com os órgãos responsáveis."],
        totalIndicativoCentavos: 32_000_000, // R$ 320.000,00
        estimativa: ESTIMATIVA_DA_COORDENACAO,
        modulos: [
          {
            titulo: "Base de sinistros",
            centavos: 7_000_000,
            autonomia: "potencialmente-autonomo",
            dependeDe: [],
            entregas: [
              "Registros de sinistros de trânsito integrados à base territorial, com proteção dos dados pessoais e o processamento documentado.",
              "Ficha de cada fonte de registros, com o período, a cobertura, a permissão de uso e as lacunas.",
            ],
          },
          {
            titulo: "Análise de risco",
            centavos: 11_000_000,
            autonomia: "dependente",
            dependeDe: ["Base de sinistros"],
            entregas: [
              "Análise da concentração de sinistros e das condições de risco nos caminhos até os serviços essenciais, com o método documentado.",
              "Indicadores de risco por trecho, com ficha técnica de cada indicador e testes reproduzíveis.",
            ],
          },
          {
            titulo: "Painel e priorização",
            centavos: 14_000_000,
            autonomia: "dependente",
            dependeDe: ["Análise de risco"],
            entregas: [
              "Painel de acompanhamento no protótipo, com os indicadores de risco por trecho.",
              "Proposta de critérios de priorização, documentada para discussão com os órgãos responsáveis.",
              "Lista priorizada de trechos para intervenção, com a justificativa de cada posição.",
            ],
          },
        ],
      },
      {
        nome: "Avaliação de intervenções e investimentos",
        problema: "As intervenções e os investimentos em mobilidade melhoram o acesso das pessoas, e como comparar alternativas antes de decidir?",
        capacidade: "Relacionar investimentos, entregas e indicadores aos efeitos no território, e comparar alternativas antes do investimento.",
        componentes: ["Relatório metodológico", "Processamento documentado", "Comparação entre estimativas e observações"],
        dependencias: ["Informações sobre intervenções e investimentos executados e previstos.", "Indicadores acompanhados ao longo do tempo."],
        totalIndicativoCentavos: 41_000_000, // R$ 410.000,00
        estimativa: ESTIMATIVA_DA_COORDENACAO,
        modulos: [
          {
            titulo: "Inventário e indicadores",
            centavos: 8_000_000,
            autonomia: "potencialmente-autonomo",
            dependeDe: [],
            entregas: [
              "Inventário das intervenções e dos investimentos em mobilidade, executados e previstos, com a fonte e a data de cada registro.",
              "Conjunto de indicadores de acompanhamento, com ficha técnica de cada indicador.",
              "Linha de base dos indicadores nos territórios analisados, com a data de referência.",
            ],
          },
          {
            titulo: "Simulação de cenários antes de intervenções",
            centavos: 16_000_000,
            autonomia: "dependente",
            dependeDe: ["Inventário e indicadores"],
            entregas: [
              "Método de simulação documentado, para comparar alternativas de intervenção antes do investimento.",
              "Simulação dos cenários das intervenções previstas no inventário, a partir da linha de base, com testes reproduzíveis.",
              "Relatório comparativo das alternativas, com as premissas e os limites de cada cenário.",
            ],
          },
          {
            titulo: "Avaliação de resultados observados",
            centavos: 17_000_000,
            autonomia: "dependente",
            dependeDe: ["Inventário e indicadores"],
            entregas: [
              "Comparação entre a linha de base e os indicadores medidos depois das intervenções executadas, nos territórios em que houver medição.",
              "Relatório de avaliação com o método, os limites da comparação e o que não pode ser atribuído às intervenções.",
            ],
          },
        ],
      },
      {
        nome: "Mobilidade sustentável e resiliência urbana",
        problema: "Como tornar os deslocamentos mais sustentáveis e a rede urbana mais preparada para interrupções e eventos extremos?",
        capacidade: "Avaliar a participação dos modos sustentáveis e a vulnerabilidade da rede a interrupções, para orientar o planejamento.",
        componentes: ["Catálogo de fontes", "Protótipo", "Plano de replicação"],
        dependencias: ["Dados ambientais e de ocorrências que afetam a circulação.", "Integração com o planejamento urbano e ambiental do município."],
        totalIndicativoCentavos: 35_000_000, // R$ 350.000,00
        estimativa: ESTIMATIVA_DA_COORDENACAO,
        modulos: [
          {
            titulo: "Dados e indicadores ambientais",
            centavos: 7_000_000,
            autonomia: "potencialmente-autonomo",
            dependeDe: [],
            entregas: [
              "Catálogo das fontes de dados ambientais e de ocorrências que afetam a circulação, com o período, a cobertura e as lacunas de cada fonte.",
              "Indicadores ambientais com ficha técnica, integrados à base territorial, com o processamento documentado.",
            ],
          },
          {
            titulo: "Modelagem de emissões",
            centavos: 13_000_000,
            autonomia: "dependente",
            dependeDe: ["Dados e indicadores ambientais"],
            entregas: [
              "Modelo de estimativa das emissões dos deslocamentos por modo, a partir das bases de deslocamento que houver com permissão de uso, com o método, as premissas e testes reproduzíveis.",
              "Comparação entre cenários de participação dos modos sustentáveis nos deslocamentos até os serviços.",
            ],
          },
          {
            titulo: "Vulnerabilidade e resiliência",
            centavos: 15_000_000,
            autonomia: "dependente",
            dependeDe: ["Dados e indicadores ambientais"],
            entregas: [
              "Identificação dos trechos da rede mais expostos a interrupções e eventos extremos, com os critérios documentados.",
              "Recomendações para o planejamento urbano e ambiental, a partir da análise de exposição da rede.",
            ],
          },
        ],
      },
    ],
    // Os totais como a coordenação os definiu (16/11/2026); a página mostra as somas dos módulos, e o teste confere.
    totalIndicativoCentavos: 217_000_000, // R$ 2,17 milhões
    programaIndicativoCentavos: 237_000_000, // R$ 2,37 milhões, com o demonstrador
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
