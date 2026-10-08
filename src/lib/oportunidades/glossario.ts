/**
 * O glossário do Mapa (B7, 08/10/2026) — puro: os termos, a busca por slug, a ordem alfabética e o endereço de cada um.
 *
 * Os testes com usuários e o teste de 08/10 mostraram jargão sem explicação nas páginas: "vivos", "suspensiva",
 * "paradas há mais de um ano", P90, mediana, tercil, CEBAS, a decisão B do fiscal, CAUC, TCE, PC 33. A sigla TCE tem
 * dois sentidos no Mapa e por isso dois verbetes: a tomada de contas especial (julgada pelo TCU) e o TCE-PB. Cada termo tem
 * duas medidas: a `curta`, que cabe no balão aberto pelo `<Termo>` onde a palavra aparece, e a `explica`, que vai na
 * página `/mapa/glossario`. Toda entrada diz de onde vem (`fonte`): a norma, quando há, ou a base e o critério da PONTE.
 *
 * Regras de redação: frase completa, neutra, sem acusação ("a conferir", nunca "irregular"); a definição normativa
 * segue a norma citada e, na dúvida, diz menos e remete à fonte. Recorte da PONTE (vivo, limbo, porte na PB) é dito
 * como recorte da PONTE, não como situação oficial. Os limites de tamanho e as referências cruzadas (`veja`) são
 * conferidos em `glossario.test.ts`.
 */

export interface EntradaGlossario {
  /** Âncora e chave: só minúsculas, dígitos e hífen. */
  slug: string;
  /** Como o termo aparece no título da entrada. */
  termo: string;
  /** Até 160 caracteres, frase completa: é o que o balão mostra. */
  curta: string;
  /** Até 600 caracteres: o texto da página do glossário. */
  explica: string;
  /** A norma ou a base de onde vem a definição. */
  fonte: string;
  exemplo?: string;
  /** Slugs relacionados ("veja também"). */
  veja: readonly string[];
}

export const TAMANHO_CURTA = 160;
export const TAMANHO_EXPLICA = 600;

const ENTRADAS = [
  {
    slug: "cauc",
    termo: "CAUC",
    curta: "Extrato do Tesouro Nacional que mostra se o ente cumpre exigências para receber transferência voluntária, como estar em dia com a União.",
    explica:
      "O CAUC (Serviço Auxiliar de Informações para Transferências Voluntárias) junta informações de vários cadastros: dívidas com a União, entrega de relatórios fiscais, aplicação mínima em saúde e educação, entre outras. Pendência no CAUC pode impedir nova transferência voluntária, mas as ações de educação, saúde e assistência social ficam fora dessa suspensão. O extrato é informativo e mostra a posição do dia; a comprovação exigida pela norma é conferida pelo concedente.",
    fonte: "Tesouro Nacional (STN); LRF, art. 25, §§ 1º e 3º",
    veja: ["transferencia-voluntaria", "lrf", "decisoes-fiscais", "siconfi", "cepim"],
  },
  {
    slug: "cebas",
    termo: "CEBAS",
    curta: "Certificação de Entidade Beneficente de Assistência Social, concedida pelo ministério da área: saúde, educação ou assistência social.",
    explica:
      "Regida pela Lei Complementar 187/2021, a certificação reconhece a entidade como beneficente e é requisito para a imunidade das contribuições para a seguridade social. É concedida pelo Ministério da Saúde, pelo MEC ou pelo MDS, conforme a área de atuação principal, e tem prazo de validade. No Mapa, \"tem CEBAS\" é o que consta nas planilhas de certificação reunidas pelo Mapa das OSC, que podem estar desatualizadas: confirme no ministério.",
    fonte: "Lei Complementar 187/2021",
    veja: ["osc", "mapa-das-osc"],
  },
  {
    slug: "condicao-suspensiva",
    termo: "Condição suspensiva",
    curta: "Cláusula que permite assinar o instrumento antes de tudo estar pronto; o dinheiro só é liberado depois que as pendências forem resolvidas.",
    explica:
      "Quando faltam, por exemplo, o projeto básico ou o termo de referência, a licença ambiental ou a comprovação de que a área é do ente, o instrumento pode ser assinado com condição suspensiva. Enquanto ela vale, não há liberação de recursos. O convenente tem o prazo fixado no instrumento para entregar o que falta; se não entregar, ou se o concedente não aceitar, o instrumento pode ser extinto. A retirada da suspensiva é o ato do concedente que dá a condição por cumprida.",
    fonte: "Decreto 11.531/2023; Portaria Conjunta MGI/MF/CGU 33/2023",
    exemplo: "Convênio de pavimentação assinado sem o projeto aceito: a primeira parcela só sai depois que o concedente aceita o projeto e retira a suspensiva.",
    veja: ["convenio", "em-execucao", "desembolso", "pc-33"],
  },
  {
    slug: "contrapartida",
    termo: "Contrapartida",
    curta: "Parte do valor do instrumento que o próprio convenente aplica, além do repasse federal.",
    explica:
      "Para estados e municípios, os limites de contrapartida em convênios e contratos de repasse são fixados a cada ano na Lei de Diretrizes Orçamentárias (LDO) da União, em faixas definidas por ela. A LRF exige que a contrapartida esteja prevista no orçamento de quem recebe. Programas e emendas podem ter regras próprias; o programa diz o percentual.",
    fonte: "LRF (LC 101/2000), art. 25, § 1º, IV, \"d\"; LDO da União de cada ano",
    veja: ["valor-global", "lrf", "transferencia-voluntaria"],
  },
  {
    slug: "cepim",
    termo: "CEPIM",
    curta: "Cadastro da CGU com as entidades privadas sem fins lucrativos impedidas de firmar novos convênios e parcerias com a União.",
    explica:
      "O Cadastro de Entidades Privadas sem Fins Lucrativos Impedidas é mantido pela Controladoria-Geral da União e publicado no Portal da Transparência. A entidade entra nele por motivos ligados a parcerias federais anteriores, como contas não prestadas ou rejeitadas, e sai quando a situação é resolvida. Vale para OSC; para estados e municípios, o extrato equivalente é o CAUC. É um registro a conferir, não uma condenação.",
    fonte: "Controladoria-Geral da União (Portal da Transparência)",
    veja: ["osc", "cauc", "prestacao-de-contas"],
  },
  {
    slug: "convenente",
    termo: "Convenente",
    curta: "Quem assina o convênio com a União e executa o objeto: o estado, o município, o consórcio ou a entidade que fez a proposta.",
    explica:
      "Antes da assinatura, quem pede é o proponente; assinado o instrumento, ele passa a ser o convenente (no contrato de repasse, o contratado). Cabe a ele licitar, contratar, pagar os fornecedores pela conta do instrumento, cumprir o plano de trabalho e prestar contas ao concedente.",
    fonte: "Decreto 11.531/2023, art. 2º",
    veja: ["proponente", "convenio", "prestacao-de-contas"],
  },
  {
    slug: "convenio",
    termo: "Convênio e instrumento",
    curta: "Instrumento é o termo assinado que formaliza um repasse da União. O convênio é o mais comum; o contrato de repasse passa por um banco público.",
    explica:
      "Convênio: acordo entre a União e um estado, município, consórcio público ou, nos casos previstos, entidade privada sem fins lucrativos, para executar programa, projeto ou atividade de interesse comum, em mútua cooperação. Contrato de repasse: o mesmo tipo de acordo, operado por instituição financeira oficial (como a Caixa), que atua como mandatária da União. Com OSC, a Lei 13.019/2014 prevê termo de colaboração, termo de fomento e acordo de cooperação. No Mapa, \"instrumento\" cobre todos os que aparecem no Transferegov.",
    fonte: "Decreto 11.531/2023, art. 2º; Lei 13.019/2014",
    veja: ["proposta", "proponente", "instrumento-vivo", "pc-33"],
  },
  {
    slug: "decisoes-fiscais",
    termo: "Decisões fiscais A, B e C",
    curta: "As três perguntas do painel fiscal: (A) as declarações estão em dia? (B) pode receber transferência voluntária? (C) pode contratar operação de crédito?",
    explica:
      "Em vez de uma nota única, o painel fiscal da PONTE responde a três decisões, cada uma com verificações, evidência e base legal. A: entregas ao Siconfi e declarações. B: requisitos para receber transferência voluntária (LRF, art. 25, e CAUC). C: limites e condições para operação de crédito (LRF, art. 32, e Resoluções 40 e 43/2001 do Senado). Cada decisão aparece sem bloqueio, com alertas, bloqueada ou em aberto (quando falta dado). O painel não substitui certidão, STN, Tribunal de Contas nem o concedente.",
    fonte: "LRF, arts. 25 e 32; Resoluções do Senado Federal 40/2001 e 43/2001; critério da PONTE",
    veja: ["lrf", "cauc", "siconfi", "transferencia-voluntaria"],
  },
  {
    slug: "desembolso",
    termo: "Desembolso",
    curta: "Dinheiro que o concedente de fato liberou para a conta do instrumento. É diferente do valor global, que é o total previsto.",
    explica:
      "O repasse sai em parcelas, conforme o cronograma de desembolso do plano de trabalho e o andamento da execução. \"Desembolsado\" soma o que já foi liberado; a diferença para o valor de repasse é o que ainda falta liberar. O pagamento aos fornecedores sai depois, da conta do instrumento, e é outro registro.",
    fonte: "Transferegov/SICONV (desembolsos)",
    exemplo: "Repasse de R$ 1 milhão com R$ 400 mil desembolsados: faltam R$ 600 mil por liberar.",
    veja: ["valor-global", "em-execucao"],
  },
  {
    slug: "em-execucao",
    termo: "Em execução",
    curta: "Situação do instrumento assinado cujo objeto está sendo realizado: licitar, contratar, receber as parcelas e pagar os fornecedores.",
    explica:
      "Depois da assinatura e, quando houver, da retirada da condição suspensiva, o convenente recebe as parcelas na conta específica do instrumento e executa o plano de trabalho dentro da vigência. Pode haver termo aditivo para mudar prazo ou valor. Terminado o prazo ou o objeto, o instrumento passa para a prestação de contas. \"Em execução\" é o nome da situação no Transferegov.",
    fonte: "Transferegov/SICONV (situação do instrumento)",
    veja: ["instrumento-vivo", "desembolso", "prestacao-de-contas"],
  },
  {
    slug: "emenda-parlamentar",
    termo: "Emenda parlamentar",
    curta: "Indicação de deputado, senador, bancada ou comissão que destina parte do orçamento federal a um ente ou entidade.",
    explica:
      "As emendas individuais e as de bancada estadual têm execução obrigatória, salvo impedimento de ordem técnica. A emenda pode ser executada por convênio ou contrato de repasse (com proposta no Transferegov), por transferência especial (o \"Pix\") ou fundo a fundo, entre outras formas. Ter a emenda indicada não garante o recurso: a proposta ou o plano de ação ainda precisa ser cadastrado, analisado e não ter impedimento técnico.",
    fonte: "Constituição Federal, arts. 166 e 166-A",
    veja: ["pix", "fundo-a-fundo", "proposta"],
  },
  {
    slug: "fundo-a-fundo",
    termo: "Fundo a fundo",
    curta: "Repasse de um fundo federal direto para o fundo do estado ou do município, sem convênio. No Mapa, só o registrado no Transferegov, sem o SUS e o SUAS.",
    explica:
      "O dinheiro sai de um fundo nacional, como o Fundo Nacional de Saúde ou o Fundo Nacional de Assistência Social, para o fundo correspondente do ente, pelos critérios da lei de cada política; na saúde, de forma regular e automática. Emendas parlamentares também podem ser pagas assim. No Mapa, \"fundo a fundo\" são os planos de ação dessa modalidade registrados no Transferegov, com o repasse por ano. Os repasses do SUS (pelo FNS) e do SUAS (pelo FNAS) correm fora do Transferegov e não estão nesses números.",
    fonte: "Lei 8.142/1990, art. 3º (saúde); Lei 8.742/1993, art. 30 (assistência social); Transferegov",
    veja: ["pix", "transferencia-voluntaria", "emenda-parlamentar"],
  },
  {
    slug: "instrumento-vivo",
    termo: "Instrumento vivo",
    curta: "Convênio ou contrato de repasse que ainda não terminou: está em execução, em alguma etapa da prestação de contas ou em tomada de contas especial.",
    explica:
      "É um recorte da PONTE sobre a situação registrada no Transferegov. Vivo é o instrumento em execução; em prestação de contas (aguardando, enviada, em análise, em complementação, rejeitada ou na situação \"Inadimplente\"); ou com tomada de contas especial (TCE). Os encerrados, como os de contas aprovadas, os rescindidos e os anulados, não entram. Fora da Paraíba a base guarda só os vivos; por isso as comparações entre UFs e com o Brasil usam só eles.",
    fonte: "Transferegov/SICONV (situação do instrumento); critério da PONTE",
    veja: ["em-execucao", "prestacao-de-contas", "tomada-de-contas-especial"],
  },
  {
    slug: "janela",
    termo: "Janela (programa aberto)",
    curta: "Período em que um programa do Transferegov aceita propostas. Fora dele, não dá para cadastrar proposta naquele programa.",
    explica:
      "Cada órgão concedente disponibiliza seus programas no Transferegov com data de início e de fim para receber propostas e diz quem pode participar (estados, municípios, consórcios, OSC) e com que tipo de recurso: voluntário, de emenda parlamentar ou específico de um beneficiário. O Mapa chama de janela cada programa com prazo aberto e avisa quando uma janela abre, muda ou fecha.",
    fonte: "Transferegov (programas disponibilizados pelos concedentes)",
    veja: ["proposta", "transferegov", "emenda-parlamentar"],
  },
  {
    slug: "limbo",
    termo: "Limbo (proposta parada)",
    curta: "Proposta enviada que segue com o concedente, sem primeira análise registrada e sem nenhum movimento há mais de um ano.",
    explica:
      "É um recorte da PONTE, não uma situação oficial do Transferegov. A proposta continua formalmente em andamento, mas não teve análise nem evento registrado nos últimos 365 dias. No funil das propostas, aparece como \"paradas há mais de um ano\", dentro das em andamento (não é somada de novo). Parada não quer dizer recusada: vale perguntar ao concedente se o programa ainda tem recurso e se a proposta será analisada.",
    fonte: "Transferegov/SICONV (histórico da proposta); critério da PONTE",
    veja: ["proposta", "mediana"],
  },
  {
    slug: "lrf",
    termo: "LRF (Lei de Responsabilidade Fiscal)",
    curta: "A Lei Complementar 101/2000, que fixa regras de gasto, dívida e transparência para a União, os estados e os municípios.",
    explica:
      "Define, entre outros, o limite da despesa com pessoal (54% da receita corrente líquida para o Executivo municipal), os limites de dívida e de operações de crédito e os relatórios periódicos (RREO e RGF). No art. 25 estão os requisitos para receber transferência voluntária: dotação específica, estar em dia com o ente que transfere, cumprir os mínimos de saúde e educação e os limites fiscais, e prever a contrapartida no orçamento.",
    fonte: "Lei Complementar 101/2000",
    veja: ["transferencia-voluntaria", "cauc", "decisoes-fiscais", "siconfi"],
  },
  {
    slug: "macrorregiao",
    termo: "Macrorregião",
    curta: "As cinco grandes regiões do Brasil definidas pelo IBGE: Norte, Nordeste, Centro-Oeste, Sudeste e Sul.",
    explica:
      "Cada UF pertence a uma macrorregião; a Paraíba fica no Nordeste. No mapa do Brasil, a cor de cada UF é a da sua macrorregião, só para orientar a leitura: a cor não indica desempenho.",
    fonte: "IBGE (Grandes Regiões do Brasil)",
    veja: ["regiao-intermediaria", "regiao-imediata"],
  },
  {
    slug: "mapa-das-osc",
    termo: "Mapa das OSC",
    curta: "Plataforma do Ipea com o cadastro das organizações da sociedade civil do Brasil, montado a partir do CNPJ e de outras bases públicas.",
    explica:
      "O Mapa das Organizações da Sociedade Civil, do Instituto de Pesquisa Econômica Aplicada (Ipea), reúne dados da Receita Federal, de ministérios e de outras fontes. A PONTE lê o arquivo mensal de divulgação, e a versão lida aparece nas páginas. O Mapa de Oportunidades não mostra endereço, dirigentes nem contatos. Os números podem diferir dos do site do Ipea, que aplica filtros próprios.",
    fonte: "Mapa das OSC (Ipea)",
    veja: ["osc", "osc-ativa", "natureza-juridica", "cebas"],
  },
  {
    slug: "mediana",
    termo: "Mediana",
    curta: "O valor do meio: metade dos casos fica abaixo dele e metade acima. Ao contrário da média, não é puxada por um caso extremo.",
    explica:
      "Para o tempo das etapas, a mediana diz quanto leva um caso típico. No Mapa, as medianas de tempo usam as etapas que terminaram nos últimos 36 meses; a comparação com o Brasil só é feita com pelo menos 10 medições, e a etapa é marcada como lenta a partir de 1,5 vez a mediana do país.",
    fonte: "Estatística descritiva; cálculo da PONTE sobre o Transferegov",
    exemplo: "Cinco propostas levaram 10, 20, 30, 40 e 400 dias: a mediana é 30 dias; a média seria 100.",
    veja: ["p90", "tercil"],
  },
  {
    slug: "natureza-juridica",
    termo: "Natureza jurídica",
    curta: "Código do CNPJ que diz que tipo de pessoa jurídica é a entidade: associação, fundação, organização religiosa, órgão público, empresa e outros.",
    explica:
      "A tabela de naturezas jurídicas é da Comissão Nacional de Classificação (Concla, coordenada pelo IBGE) e aparece no comprovante do CNPJ, com quatro dígitos. O Mapa das OSC usa a natureza para dizer o que conta como OSC; o Mapa de Oportunidades a usa para agrupar as organizações de cada município.",
    fonte: "Tabela de Natureza Jurídica (Concla/IBGE); Receita Federal",
    exemplo: "399-9: associação privada; 306-9: fundação privada; 322-0: organização religiosa.",
    veja: ["osc", "mapa-das-osc"],
  },
  {
    slug: "osc",
    termo: "OSC (organização da sociedade civil)",
    curta: "Entidade privada sem fins lucrativos que não distribui resultados, certas cooperativas sociais e organizações religiosas com atividade de interesse público.",
    explica:
      "A definição é da Lei 13.019/2014, o Marco Regulatório das Organizações da Sociedade Civil (MROSC). Entram as associações e fundações privadas que aplicam todo o resultado no seu objetivo social; as cooperativas sociais e as demais listadas na lei; e as organizações religiosas em atividades de interesse público e de cunho social distintas das exclusivamente religiosas. A parceria com o poder público usa termo de colaboração, termo de fomento ou acordo de cooperação.",
    fonte: "Lei 13.019/2014, art. 2º, I",
    veja: ["osc-ativa", "natureza-juridica", "mapa-das-osc", "cebas"],
  },
  {
    slug: "osc-ativa",
    termo: "OSC ativa, inapta, suspensa ou baixada",
    curta: "Situações do CNPJ no cadastro da Receita Federal. O Mapa lista as ativas; inapta, suspensa e baixada são outras situações, a conferir.",
    explica:
      "A situação vem do cadastro do CNPJ na Receita Federal, pelo Mapa das OSC. Inapta costuma indicar falta de entrega de declarações obrigatórias; baixada é o CNPJ encerrado; suspensa é outra situação do cadastro. Não é juízo sobre o trabalho da organização, e a situação pode ser regularizada. No Mapa, a lista do município traz só as ativas (e não removidas pelo Ipea); as demais aparecem só como número.",
    fonte: "Receita Federal (situação cadastral do CNPJ), via Mapa das OSC (Ipea)",
    veja: ["osc", "mapa-das-osc"],
  },
  {
    slug: "p90",
    termo: "P90 (9 em cada 10 até)",
    curta: "O percentil 90: 9 em cada 10 casos ficam até esse valor. Mostra quanto pode demorar um caso lento, deixando de fora os mais extremos.",
    explica:
      "Se o P90 de uma etapa é 300 dias, 90% das etapas medidas terminaram em até 300 dias e 10% levaram mais. Junto com a mediana, ajuda a planejar: a mediana diz o caso típico; o P90, uma folga prudente. Nas tabelas do Mapa a coluna aparece como \"9 em cada 10 até\".",
    fonte: "Estatística descritiva; cálculo da PONTE sobre o Transferegov",
    veja: ["mediana"],
  },
  {
    slug: "pix",
    termo: "Pix (transferência especial)",
    curta: "Apelido da transferência especial: emenda individual paga direto ao estado ou município, sem convênio, para o ente aplicar.",
    explica:
      "Criada pela Emenda Constitucional 105/2019 (art. 166-A da Constituição). O recurso vai direto ao ente, sem convênio, e passa a pertencer a ele na transferência. Não pode pagar pessoal e encargos nem dívida, e pelo menos 70% das transferências especiais devem ir para despesas de capital (investimento). O ente registra no Transferegov o plano de ação e depois o relatório de gestão. No Mapa, \"planos pagos\" são os planos de ação com pagamento registrado.",
    fonte: "Constituição Federal, art. 166-A (EC 105/2019)",
    veja: ["emenda-parlamentar", "fundo-a-fundo"],
  },
  {
    slug: "pc-33",
    termo: "Portaria Conjunta 33/2023 (PC 33)",
    curta: "Norma do MGI, do Ministério da Fazenda e da CGU que detalha as regras dos convênios e contratos de repasse da União, da proposta às contas.",
    explica:
      "A Portaria Conjunta MGI/MF/CGU 33/2023 regulamenta o Decreto 11.531/2023 e ocupou o lugar da Portaria Interministerial 424/2016. Trata de proposta, plano de trabalho, condição suspensiva, execução, acompanhamento e prestação de contas. Instrumentos assinados antes dela seguem, em regra, a norma da época; por isso o laudo do Mapa diz qual regime vale para cada convênio.",
    fonte: "Portaria Conjunta MGI/MF/CGU 33/2023; Decreto 11.531/2023",
    veja: ["convenio", "condicao-suspensiva", "prestacao-de-contas"],
  },
  {
    slug: "prestacao-de-contas",
    termo: "Prestação de contas",
    curta: "Etapa em que quem recebeu o recurso demonstra que cumpriu o objeto e aplicou bem o dinheiro; o concedente analisa e decide.",
    explica:
      "Ao fim da vigência, o convenente registra no Transferegov a prestação de contas final, com a execução física e financeira e a devolução do saldo, quando houver, no prazo da norma. O concedente analisa e aprova, aprova com ressalvas ou rejeita. Se as contas não forem apresentadas ou forem rejeitadas e o problema não for resolvido, pode ser instaurada tomada de contas especial. No Mapa, \"prestando contas\" reúne as situações em que essa etapa está em curso.",
    fonte: "Decreto 11.531/2023; Portaria Conjunta MGI/MF/CGU 33/2023",
    veja: ["em-execucao", "tomada-de-contas-especial", "instrumento-vivo"],
  },
  {
    slug: "proponente",
    termo: "Proponente, concedente e convenente",
    curta: "Proponente é quem pede; concedente, o órgão federal que repassa o recurso; convenente, quem assina o instrumento e executa o objeto.",
    explica:
      "Na proposta, quem pede é o proponente: estado, município, consórcio público ou entidade privada sem fins lucrativos. Assinado o instrumento, ele passa a ser o convenente (no contrato de repasse, o contratado). O concedente é o ministério ou órgão federal responsável pelo programa; no contrato de repasse, uma instituição financeira oficial, como a Caixa, atua como mandatária. No Mapa, \"quem recebe\" agrupa os proponentes pelo CNPJ.",
    fonte: "Decreto 11.531/2023, art. 2º; Transferegov",
    veja: ["proposta", "convenio", "convenente"],
  },
  {
    slug: "proposta",
    termo: "Proposta",
    curta: "Pedido que o proponente cadastra no Transferegov para disputar um programa. Se for aprovada e assinada, vira instrumento.",
    explica:
      "A proposta descreve o objeto, o valor pedido, a contrapartida e, depois, o plano de trabalho. O órgão concedente analisa, pode pedir ajustes, aprova ou recusa. Só com a assinatura ela vira convênio ou contrato de repasse, com número próprio. No Mapa, o funil das propostas mostra, por ano de envio, quantas foram assinadas, reprovadas ou impedidas e quantas seguem em andamento.",
    fonte: "Transferegov/SICONV; Portaria Conjunta MGI/MF/CGU 33/2023",
    veja: ["janela", "limbo", "convenio", "proponente"],
  },
  {
    slug: "rcl",
    termo: "RCL (receita corrente líquida)",
    curta: "Soma das receitas correntes do ente em 12 meses, menos as deduções da LRF. É a base dos limites de pessoal, dívida e operações de crédito.",
    explica:
      "Definida no art. 2º, IV, da LRF: receitas tributárias, de contribuições, patrimoniais, de serviços, transferências correntes e outras receitas correntes, menos as deduções da lei, apuradas no mês e nos onze anteriores. No RGF, os limites usam a RCL ajustada, depois de deduções que a Constituição manda fazer em certos repasses de emendas parlamentares. \"Pessoal / RCL ajustada\" é a despesa total com pessoal dividida por ela; para o Executivo municipal, o limite é 54%.",
    fonte: "LRF, arts. 2º, IV, e 20, III, \"b\"; Manual de Demonstrativos Fiscais (STN)",
    exemplo: "Despesa com pessoal de R$ 50 milhões sobre RCL ajustada de R$ 100 milhões: 50%, abaixo do limite de 54%, mas acima do alerta (90% do limite, 48,6%).",
    veja: ["lrf", "siconfi", "decisoes-fiscais"],
  },
  {
    slug: "regic",
    termo: "REGIC (Regiões de Influência das Cidades)",
    curta: "Estudo do IBGE que classifica as cidades pela influência sobre as vizinhas: metrópole, capital regional, centro sub-regional, centro de zona e centro local.",
    explica:
      "Mostra para onde a população de cada município vai em busca de comércio, serviços, saúde, educação e gestão pública. O Mapa usa a edição de 2018. Na página do município aparece a posição na hierarquia urbana; o município que só integra um arranjo populacional recebe a classificação do arranjo.",
    fonte: "IBGE, Regiões de Influência das Cidades (REGIC 2018)",
    veja: ["regiao-imediata", "regiao-intermediaria"],
  },
  {
    slug: "regiao-imediata",
    termo: "Região imediata (IBGE)",
    curta: "Grupo de municípios vizinhos em torno de uma cidade que atende o dia a dia: compras, emprego, saúde e educação básicas.",
    explica:
      "Faz parte da divisão regional do IBGE de 2017, que substituiu as antigas microrregiões. A Paraíba tem 15 regiões imediatas. No Mapa, os municípios da PB aparecem agrupados por região imediata, e os indicadores do município são comparados com a mediana da sua região.",
    fonte: "IBGE, Divisão Regional do Brasil em Regiões Geográficas Imediatas e Regiões Geográficas Intermediárias (2017)",
    veja: ["regiao-intermediaria", "tercil", "macrorregiao"],
  },
  {
    slug: "regiao-intermediaria",
    termo: "Região intermediária (IBGE)",
    curta: "Grupo de regiões imediatas em torno de uma cidade que oferece serviços mais raros, como hospitais de maior complexidade e universidades.",
    explica:
      "Também da divisão regional do IBGE de 2017, ocupa mais ou menos o lugar das antigas mesorregiões. A Paraíba tem 4: João Pessoa, Campina Grande, Patos e Sousa-Cajazeiras. No mapa da UF, a cor de cada município é a da sua região intermediária: a cor indica a região, não um resultado bom ou ruim.",
    fonte: "IBGE, Divisão Regional do Brasil em Regiões Geográficas Imediatas e Regiões Geográficas Intermediárias (2017)",
    veja: ["regiao-imediata", "macrorregiao"],
  },
  {
    slug: "siconfi",
    termo: "Siconfi",
    curta: "Sistema do Tesouro Nacional em que estados e municípios entregam seus relatórios e declarações contábeis e fiscais.",
    explica:
      "Lá ficam o RREO (Relatório Resumido da Execução Orçamentária), o RGF (Relatório de Gestão Fiscal), a DCA (Declaração de Contas Anuais) e a MSC (Matriz de Saldos Contábeis). Pela LRF, quem não entrega as contas anuais no prazo fica impedido de receber transferências voluntárias e de contratar operações de crédito até regularizar. O painel fiscal do Mapa lê o Siconfi para a decisão A e para os limites da LRF.",
    fonte: "Tesouro Nacional (Siconfi); LRF, art. 51, § 2º",
    veja: ["lrf", "cauc", "decisoes-fiscais"],
  },
  {
    slug: "tce-pb",
    termo: "TCE-PB (Tribunal de Contas do Estado da Paraíba)",
    curta: "Tribunal que fiscaliza as contas do governo da Paraíba e das prefeituras paraibanas. Não é a tomada de contas especial, que também se abrevia TCE.",
    explica:
      "Cuida do dinheiro estadual e municipal: emite parecer prévio sobre as contas anuais dos prefeitos, que a Câmara Municipal julga, e julga as contas dos gestores. Recurso federal com dano a apurar segue outro caminho, a tomada de contas especial, julgada pelo TCU. O Mapa usa dados publicados pelo TCE-PB, como despesas e folha de pessoal, no painel fiscal e nos painéis do administrador.",
    fonte: "Constituição Federal, arts. 31 e 75; dados abertos do TCE-PB",
    veja: ["tomada-de-contas-especial", "decisoes-fiscais"],
  },
  {
    slug: "tomada-de-contas-especial",
    termo: "Tomada de contas especial (cobrança julgada pelo TCU)",
    curta: "Processo para apurar dano ao dinheiro federal, identificar os responsáveis e quantificar o valor a ressarcir, quando outras medidas não resolveram.",
    explica:
      "Também abreviada TCE, mas não é o Tribunal de Contas do Estado. O órgão concedente deve instaurá-la, por exemplo, quando as contas não são prestadas, quando não se comprova a boa aplicação do recurso ou quando há dano ao erário, depois de esgotadas as medidas administrativas. Instaurar não é condenar: a tomada de contas apura os fatos e segue para julgamento do TCU. No Mapa, instrumento com tomada de contas especial conta como vivo.",
    fonte: "Lei 8.443/1992, art. 8º; Instrução Normativa TCU 71/2012",
    veja: ["prestacao-de-contas", "instrumento-vivo", "tce-pb"],
  },
  {
    slug: "tercil",
    termo: "Tercil e porte na PB",
    curta: "Tercil divide uma lista em três partes iguais. O porte na PB separa os 223 municípios em três terços pela população: pequeno, médio e grande.",
    explica:
      "Os municípios são ordenados pela população do Censo do IBGE; o terço com menos habitantes é o porte pequeno, o do meio é o médio e o terço com mais habitantes é o grande. É uma régua só da Paraíba, para comparar municípios parecidos. Não é a classificação de porte do IBGE nem a de outras políticas, como a da assistência social.",
    fonte: "IBGE (Censo); critério da PONTE",
    exemplo: "Com 223 municípios, cada terço tem cerca de 74.",
    veja: ["mediana", "regiao-imediata"],
  },
  {
    slug: "transferegov",
    termo: "Transferegov (antigo SICONV)",
    curta: "Plataforma do governo federal onde se cadastram e acompanham as transferências da União: programas, propostas, convênios, Pix e fundo a fundo.",
    explica:
      "O sistema de convênios nasceu como SICONV, passou pela Plataforma +Brasil e hoje faz parte do Transferegov.br; os dados abertos ainda usam o nome antigo. É a fonte principal do Mapa: programas abertos, propostas, instrumentos, desembolsos, pagamentos e prestação de contas. A PONTE lê os arquivos abertos publicados pelo próprio Transferegov; \"Transferegov até\" diz a data do arquivo lido.",
    fonte: "Transferegov.br (Ministério da Gestão e da Inovação em Serviços Públicos)",
    veja: ["janela", "proposta", "convenio"],
  },
  {
    slug: "transferencia-voluntaria",
    termo: "Transferência voluntária",
    curta: "Repasse a outro ente da Federação, por cooperação, auxílio ou assistência financeira, que não decorre de obrigação da Constituição, de lei ou do SUS.",
    explica:
      "É o caso típico do convênio e do contrato de repasse com estados e municípios. Para receber, o ente precisa cumprir os requisitos do art. 25 da LRF, como estar em dia com a União e com os limites fiscais, parte deles conferida pelo CAUC. Repasses obrigatórios, como o FPM ou o fundo a fundo da saúde, não são transferências voluntárias.",
    fonte: "LRF, art. 25",
    veja: ["convenio", "lrf", "cauc", "fundo-a-fundo"],
  },
  {
    slug: "valor-global",
    termo: "Valor global",
    curta: "Valor total do instrumento: o repasse da União somado à contrapartida do convenente, como está no termo e nos aditivos.",
    explica:
      "Pode mudar com termo aditivo. Somar o valor global de vários instrumentos mostra o tamanho da carteira, não o dinheiro já liberado nem o já pago: para isso, veja o desembolso. Nas tabelas do Mapa, \"valor global\" segue o valor registrado no Transferegov.",
    fonte: "Transferegov/SICONV",
    exemplo: "Repasse de R$ 950 mil + contrapartida de R$ 50 mil = valor global de R$ 1 milhão.",
    veja: ["contrapartida", "desembolso"],
  },
] as const satisfies readonly EntradaGlossario[];

/** Os slugs conhecidos: o `<Termo>` só aceita estes, e um slug errado vira erro de compilação. */
export type SlugTermo = (typeof ENTRADAS)[number]["slug"];

export const GLOSSARIO: readonly EntradaGlossario[] = ENTRADAS;

const POR_SLUG: ReadonlyMap<string, EntradaGlossario> = new Map(GLOSSARIO.map((t) => [t.slug, t]));

export function termoPorSlug(slug: string): EntradaGlossario | undefined {
  return POR_SLUG.get(slug);
}

/** O `id` da entrada na página do glossário. */
export const ancoraTermo = (slug: string) => `termo-${slug}`;

export const urlTermo = (slug: string) => `/mapa/glossario#${ancoraTermo(slug)}`;

/** "Órgão" → "Orgao": a ordem e a letra do grupo não dependem de acento. */
export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** A chave de ordenação: sem acento e em minúsculas. */
export const chaveDeOrdem = (termo: string) => semAcento(termo).toLocaleLowerCase("pt-BR");

/** A letra do grupo na página: "Água" → "A". */
export const letraDe = (termo: string) => semAcento(termo.trim()).charAt(0).toLocaleUpperCase("pt-BR");

const COLADOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/** Qualquer lista com `termo`, em ordem alfabética do português, sem considerar acento. */
export function ordenarTermos<T extends { termo: string }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => COLADOR.compare(chaveDeOrdem(a.termo), chaveDeOrdem(b.termo)));
}

export function termosEmOrdem(): EntradaGlossario[] {
  return ordenarTermos(GLOSSARIO);
}

/** Os termos agrupados pela letra inicial, na ordem alfabética: a estrutura da página do glossário. */
export function termosPorLetra(): { letra: string; termos: EntradaGlossario[] }[] {
  const grupos: { letra: string; termos: EntradaGlossario[] }[] = [];
  for (const t of termosEmOrdem()) {
    const letra = letraDe(t.termo);
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.letra === letra) ultimo.termos.push(t);
    else grupos.push({ letra, termos: [t] });
  }
  return grupos;
}
