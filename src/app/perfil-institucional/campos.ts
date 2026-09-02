/**
 * Estrutura do Formulário de Perfil Institucional.
 *
 * O formulário é uma peça de conteúdo, não de lógica: dez blocos de perguntas
 * que os editais e as parcerias com o poder público costumam exigir de uma OSC.
 * Descrevê-lo como dado (e não como JSX espalhado) mantém três coisas em
 * sincronia sem esforço:
 *
 *   1. o que é renderizado na tela;
 *   2. o denominador do "% preenchido" do cabeçalho;
 *   3. o texto gerado por "Copiar respostas" — que é o entregável real, o que
 *      chega por e-mail em diretoria.ponte.projetos@gmail.com.
 *
 * O protótipo derivava (2) e (3) lendo o DOM. Aqui as três leem esta lista,
 * então um campo novo entra num lugar só.
 *
 * Origem: `Formulário de Perfil Institucional.dc.html` (handoff do Claude
 * Design, projeto "Solicitação de documentos OSC"), revisão que passou a usar
 * os componentes do design system do CTLC. Rótulos, ordem, textos de ajuda e
 * placeholders são cópia fiel — não reescrever sem revisão de conteúdo. A
 * revisão trocou a voz de segunda pessoa ("marque o que você tem") pela
 * impessoal ("marcar apenas o que já está em mãos"), conforme a diretriz de
 * voz do design system; manter esse registro ao acrescentar campos.
 */

/**
 * Campo de texto livre.
 *
 * Com `linhas`, vira textarea — e aí o texto de apoio (`ajuda`) fica ACIMA da
 * caixa, dentro do rótulo. Sem `linhas`, é o Input do design system, cujo
 * texto de apoio (`dica`) fica ABAIXO. São dois slots diferentes porque o
 * desenho os posiciona em lugares diferentes; não são sinônimos.
 */
export type Campo = {
  nome: string;
  rotulo: string;
  /** Linha de apoio acima da caixa. Só para textarea. */
  ajuda?: string;
  /** Linha de apoio abaixo da caixa. Só para campo de uma linha. */
  dica?: string;
  placeholder?: string;
  /** Ocupa a linha inteira da grade (`grid-column: 1 / -1`). */
  cheia?: boolean;
  /** Altura mínima em linhas. Presente ⇒ textarea. */
  linhas?: number;
};

/** Caixa de seleção. `descricao` é a segunda linha, menor e em cinza. */
export type Marcador = {
  nome: string;
  rotulo: string;
  descricao?: string;
};

export type Secao =
  | { tipo: "grade"; colunas: 2 | 3; campos: Campo[] }
  | { tipo: "campo"; campo: Campo }
  | {
      tipo: "marcadores";
      colunas: 2 | 3;
      rotulo?: string;
      ajuda?: string;
      /** Filete acima do grupo, separando-o do que veio antes. */
      separador?: boolean;
      itens: Marcador[];
    }
  /** Lista vertical de uma coluna — o checklist de anexos do Bloco 9. */
  | { tipo: "checklist"; itens: Marcador[] }
  /** Caixa com fundo azulado e os aceites do Bloco 10. */
  | { tipo: "declaracoes"; itens: Marcador[] };

export type Bloco = {
  /** "Bloco 1", "Bloco 2"… — sobrescrita do card. */
  indice: string;
  titulo: string;
  /** Parágrafo de abertura do bloco (o `lede` do SectionHeading). */
  lede?: string;
  secoes: Secao[];
};

export const BLOCOS: Bloco[] = [
  {
    indice: "Bloco 1",
    titulo: "Identificação da instituição",
    secoes: [
      {
        tipo: "grade",
        colunas: 2,
        campos: [
          {
            nome: "razao_social",
            rotulo: "Razão social (nome completo no CNPJ)",
            placeholder: "Associação ...",
            cheia: true,
          },
          { nome: "sigla", rotulo: "Nome fantasia ou sigla", placeholder: "Opcional" },
          { nome: "cnpj", rotulo: "CNPJ", placeholder: "00.000.000/0001-00" },
          { nome: "fundacao", rotulo: "Data de fundação", placeholder: "00/00/0000" },
          {
            nome: "natureza",
            rotulo: "Natureza jurídica",
            placeholder: "Associação privada, fundação, cooperativa...",
          },
          {
            nome: "endereco",
            rotulo: "Endereço completo da sede",
            placeholder: "Rua, nº, bairro, município/UF, CEP",
            cheia: true,
          },
          { nome: "telefone", rotulo: "Telefone / WhatsApp", placeholder: "(00) 00000-0000" },
          { nome: "email", rotulo: "E-mail institucional", placeholder: "contato@..." },
          {
            nome: "redes",
            rotulo: "Site e redes sociais",
            dica: "Opcional — ajuda a comprovar a atuação",
            cheia: true,
          },
        ],
      },
      {
        tipo: "marcadores",
        colunas: 2,
        separador: true,
        rotulo: "Inscrições, títulos e registros que a instituição possui",
        ajuda: "São certificados que alguns editais exigem. Marcar apenas o que já está em mãos.",
        itens: [
          { nome: "reg_estadual", rotulo: "Inscrição estadual ativa" },
          { nome: "reg_municipal", rotulo: "Inscrição municipal ativa" },
          { nome: "reg_cebas", rotulo: "CEBAS — certificação de entidade beneficente" },
          { nome: "reg_cneas", rotulo: "CNEAS — cadastro nacional de entidades do SUAS" },
          { nome: "reg_utilidade", rotulo: "Utilidade pública municipal, estadual ou federal" },
          { nome: "reg_conselho", rotulo: "Inscrição em conselho de políticas públicas" },
        ],
      },
    ],
  },

  {
    indice: "Bloco 2",
    titulo: "Representante legal e diretoria",
    lede: "Representante legal é a pessoa que o estatuto autoriza a assinar em nome da instituição — normalmente a Presidência.",
    secoes: [
      {
        tipo: "grade",
        colunas: 2,
        campos: [
          { nome: "rep_nome", rotulo: "Nome completo" },
          { nome: "rep_cargo", rotulo: "Cargo", placeholder: "Presidente" },
          { nome: "rep_cpf", rotulo: "CPF" },
          { nome: "rep_rg", rotulo: "RG / órgão emissor" },
          { nome: "rep_estado_civil", rotulo: "Estado civil" },
          { nome: "rep_profissao", rotulo: "Profissão" },
          { nome: "rep_endereco", rotulo: "Endereço residencial", cheia: true },
          { nome: "rep_telefone", rotulo: "Telefone" },
          { nome: "rep_mandato", rotulo: "Vigência do mandato", placeholder: "2025 – 2029" },
        ],
      },
      {
        tipo: "campo",
        campo: {
          nome: "diretoria",
          rotulo: "Relação nominal da Diretoria e do Conselho Fiscal em exercício",
          ajuda: "Uma pessoa por linha: nome — cargo — CPF.",
          linhas: 5,
        },
      },
    ],
  },

  {
    indice: "Bloco 3",
    titulo: "Capacidade operacional",
    lede: "O que a instituição tem hoje para executar um projeto: equipe, espaço e equipamento. Editais avaliam esse conjunto antes do orçamento.",
    secoes: [
      {
        tipo: "grade",
        colunas: 3,
        campos: [
          { nome: "eq_clt", rotulo: "Pessoas contratadas (CLT)", placeholder: "0" },
          { nome: "eq_pj", rotulo: "Prestadores de serviço", placeholder: "0" },
          { nome: "eq_vol", rotulo: "Voluntários ativos", placeholder: "0" },
        ],
      },
      {
        tipo: "campo",
        campo: {
          nome: "eq_perfis",
          rotulo: "Perfis técnicos da equipe",
          ajuda:
            "Ex.: 1 assistente social, 2 educadores, 1 técnico agrícola, 1 contador terceirizado.",
          linhas: 3,
        },
      },
      {
        tipo: "grade",
        colunas: 2,
        campos: [
          {
            nome: "sede_situacao",
            rotulo: "Sede — situação do imóvel",
            placeholder: "Própria, alugada, cedida por...",
          },
          {
            nome: "sede_area",
            rotulo: "Área e ambientes disponíveis",
            placeholder: "Ex.: 200 m², 2 salas, cozinha",
          },
          { nome: "veiculos", rotulo: "Veículos", placeholder: "Ex.: 1 caminhonete 2018, 1 moto" },
          {
            nome: "equipamentos",
            rotulo: "Equipamentos relevantes",
            placeholder: "Computadores, projetor, ferramentas...",
          },
          {
            nome: "territorio",
            rotulo: "Municípios e comunidades onde a instituição atua",
            cheia: true,
          },
        ],
      },
    ],
  },

  {
    indice: "Bloco 4",
    titulo: "Situação financeira",
    lede: "Se for mais prático, estas respostas podem ser encaminhadas ao contador da instituição — são dados que ele já tem.",
    secoes: [
      {
        tipo: "grade",
        colunas: 3,
        campos: [
          { nome: "rec_2023", rotulo: "Receita total 2023", placeholder: "R$" },
          { nome: "rec_2024", rotulo: "Receita total 2024", placeholder: "R$" },
          { nome: "rec_2025", rotulo: "Receita total 2025", placeholder: "R$" },
        ],
      },
      {
        tipo: "campo",
        campo: {
          nome: "fontes_receita",
          rotulo: "De onde vêm os recursos hoje",
          ajuda:
            "Ex.: convênio municipal, doações de pessoas físicas, venda de produtos, emenda parlamentar, mensalidade de associados.",
          linhas: 3,
        },
      },
      {
        tipo: "campo",
        campo: {
          nome: "sustentabilidade",
          rotulo: "Como a instituição pretende se sustentar nos próximos anos",
          linhas: 3,
        },
      },
      {
        tipo: "grade",
        colunas: 2,
        campos: [
          { nome: "contador", rotulo: "Nome e contato do contador" },
          {
            nome: "conta",
            rotulo: "Banco, agência e conta da instituição",
            placeholder: "Conta em nome do CNPJ",
          },
        ],
      },
      {
        tipo: "marcadores",
        colunas: 2,
        separador: true,
        rotulo: "Certidões válidas nesta data",
        itens: [
          { nome: "cert_federal", rotulo: "Federal — Receita Federal e PGFN" },
          { nome: "cert_estadual", rotulo: "Estadual — Secretaria da Fazenda" },
          { nome: "cert_municipal", rotulo: "Municipal — Prefeitura da sede" },
          { nome: "cert_cndt", rotulo: "Trabalhista — CNDT, emitida pelo TST" },
          { nome: "cert_fgts", rotulo: "FGTS — CRF, emitido pela Caixa" },
          // Antes `cert_tcu`. A revisão do desenho renomeou o campo; rascunho
          // salvo com o nome antigo perde só esta marcação.
          { nome: "cert_cepim", rotulo: "Sem registro no CEPIM ou no CADIN" },
        ],
      },
    ],
  },

  {
    indice: "Bloco 5",
    titulo: "Experiência e portfólio",
    lede: "Projetos já executados são a principal prova de que a instituição consegue entregar. Listar do mais recente para o mais antigo.",
    secoes: [
      {
        tipo: "campo",
        campo: {
          nome: "projetos",
          rotulo: "Projetos executados",
          ajuda:
            "Um por linha: nome — período — local — valor — financiador ou parceiro — resultado principal.",
          linhas: 7,
        },
      },
      {
        tipo: "campo",
        campo: {
          nome: "atestados",
          rotulo: "Atestados de capacidade técnica disponíveis",
          ajuda:
            "Documento em que um contratante anterior confirma, por escrito, o serviço executado. Informar quem emitiu e sobre qual projeto.",
          linhas: 3,
        },
      },
      {
        tipo: "campo",
        campo: {
          nome: "publicacoes",
          rotulo: "Notícias, publicações e reconhecimentos",
          linhas: 2,
        },
      },
    ],
  },

  {
    indice: "Bloco 6",
    titulo: "Convênios e parcerias com o poder público",
    lede: "Histórico de recursos públicos já recebidos: termo de fomento, termo de colaboração, convênio, emenda parlamentar ou contrato. Inclui parcerias encerradas.",
    secoes: [
      {
        tipo: "campo",
        campo: {
          nome: "convenios",
          rotulo: "Parcerias públicas já firmadas",
          ajuda:
            "Uma por linha: órgão — tipo de instrumento — nº — vigência — valor — situação da prestação de contas.",
          linhas: 6,
        },
      },
      {
        tipo: "marcadores",
        colunas: 2,
        itens: [
          { nome: "conv_ok", rotulo: "Todas as prestações de contas foram aprovadas" },
          { nome: "conv_pendente", rotulo: "Há prestação de contas em análise ou pendente" },
          { nome: "conv_nenhum", rotulo: "A instituição nunca firmou parceria com o poder público" },
          { nome: "conv_sancao", rotulo: "Existe sanção, glosa ou processo em curso" },
        ],
      },
      {
        tipo: "campo",
        campo: {
          nome: "conv_obs",
          rotulo: "Observações sobre pendências, se houver",
          linhas: 2,
        },
      },
    ],
  },

  {
    indice: "Bloco 7",
    titulo: "Perfil para o rastreamento de editais",
    lede: "É com este bloco que os editais publicados são filtrados, de modo que a instituição seja avisada apenas sobre o que lhe serve.",
    secoes: [
      { tipo: "campo", campo: { nome: "missao", rotulo: "Missão da instituição", linhas: 2 } },
      {
        tipo: "campo",
        campo: {
          nome: "objetivos",
          rotulo: "Objetivos previstos no estatuto",
          ajuda:
            "O artigo do estatuto pode ser copiado. Um edital só aceita a instituição se a finalidade dele constar do estatuto.",
          linhas: 4,
        },
      },
      {
        tipo: "campo",
        campo: {
          nome: "publico",
          rotulo: "Público beneficiário",
          ajuda: "Quem é atendido, faixa etária e quantidade aproximada por ano.",
          linhas: 3,
        },
      },
      {
        tipo: "marcadores",
        colunas: 3,
        rotulo: "Áreas temáticas de interesse para captação",
        itens: [
          { nome: "area_socio", rotulo: "Socioassistencial" },
          { nome: "area_ambiental", rotulo: "Ambiental e clima" },
          { nome: "area_agro", rotulo: "Agroecologia e ATER" },
          { nome: "area_cultura", rotulo: "Cultura" },
          { nome: "area_comunicacao", rotulo: "Comunicação" },
          { nome: "area_educacao", rotulo: "Educação" },
          { nome: "area_saude", rotulo: "Saúde" },
          { nome: "area_esporte", rotulo: "Esporte" },
          { nome: "area_direitos", rotulo: "Direitos humanos" },
        ],
      },
      {
        tipo: "grade",
        colunas: 2,
        campos: [
          {
            nome: "faixa_valor",
            rotulo: "Faixa de valor que a instituição consegue executar",
            placeholder: "Ex.: até R$ 300 mil por projeto",
          },
          {
            nome: "abrangencia",
            rotulo: "Abrangência pretendida",
            placeholder: "Municipal, regional, estadual, nacional",
          },
        ],
      },
      {
        tipo: "campo",
        campo: {
          nome: "ideias",
          rotulo: "Ideias ou necessidades que a instituição gostaria de transformar em projeto",
          linhas: 3,
        },
      },
    ],
  },

  {
    indice: "Bloco 8",
    titulo: "Contrapartida disponível",
    lede: "Contrapartida é o que a instituição coloca no projeto por conta própria, sem receber do edital — pessoas, espaço, veículo, equipamento ou serviço. Muitos editais exigem, e ela quase nunca precisa ser dinheiro.",
    secoes: [
      {
        tipo: "marcadores",
        colunas: 2,
        itens: [
          { nome: "cp_pessoal", rotulo: "Horas de trabalho da equipe própria" },
          { nome: "cp_sede", rotulo: "Uso da sede e dos ambientes" },
          { nome: "cp_veiculo", rotulo: "Veículos e combustível" },
          { nome: "cp_equip", rotulo: "Equipamentos e ferramentas" },
          { nome: "cp_servico", rotulo: "Serviços administrativos e contábeis" },
          { nome: "cp_financeiro", rotulo: "Recurso financeiro próprio" },
        ],
      },
      {
        tipo: "grade",
        colunas: 2,
        campos: [
          {
            nome: "cp_valor",
            rotulo: "Estimativa de valor total da contrapartida",
            placeholder: "R$ — valor aproximado por projeto",
          },
          {
            nome: "cp_detalhe",
            rotulo: "Detalhamento",
            placeholder: "Ex.: 1 técnico 20h/mês + caminhonete",
          },
        ],
      },
    ],
  },

  {
    indice: "Bloco 9",
    titulo: "Checklist de anexos",
    lede: "Marcar o que já está sendo enviado em PDF. O que faltar não impede o envio deste formulário.",
    secoes: [
      {
        tipo: "checklist",
        itens: [
          { nome: "ax_cnpj", rotulo: "Cartão CNPJ atualizado" },
          {
            nome: "ax_estatuto",
            rotulo: "Estatuto social registrado em cartório",
            descricao: "Com todas as alterações posteriores",
          },
          { nome: "ax_inteiro_teor", rotulo: "Certidão de inteiro teor do estatuto vigente" },
          { nome: "ax_ata", rotulo: "Ata de eleição e posse da Diretoria em exercício" },
          {
            nome: "ax_docs_rep",
            rotulo: "RG, CPF e comprovante de residência do representante legal",
          },
          {
            nome: "ax_certidoes",
            rotulo: "Certidões de regularidade",
            descricao: "Federal, estadual, municipal, CNDT e FGTS",
          },
          {
            nome: "ax_balanco",
            rotulo: "Balanço patrimonial, DRE e notas explicativas dos 3 últimos exercícios",
          },
          {
            nome: "ax_atestados",
            rotulo: "Atestados de capacidade técnica e contratos anteriores",
          },
          { nome: "ax_comprovante_sede", rotulo: "Comprovante de endereço da sede" },
          {
            nome: "ax_registros",
            rotulo: "Registros e certificações",
            descricao: "CEBAS, CNEAS, conselhos, utilidade pública",
          },
        ],
      },
    ],
  },

  {
    indice: "Bloco 10",
    titulo: "Ponto focal e encerramento",
    secoes: [
      {
        tipo: "grade",
        colunas: 2,
        campos: [
          {
            nome: "focal_nome",
            rotulo: "Ponto focal para tratar do dossiê",
            placeholder: "Nome e função",
          },
          { nome: "focal_contato", rotulo: "Telefone e e-mail do ponto focal" },
        ],
      },
      {
        tipo: "declaracoes",
        itens: [
          {
            nome: "dec_veracidade",
            rotulo: "Declaração de veracidade",
            descricao:
              "O representante legal declara que as informações prestadas neste formulário são verdadeiras e que os documentos anexados correspondem aos originais em poder da instituição.",
          },
          {
            nome: "dec_lgpd",
            rotulo: "Tratamento de dados — LGPD, Lei nº 13.709/2018",
            descricao:
              "A instituição autoriza a Ponte Estruturação de Projetos a tratar os dados pessoais e institucionais informados exclusivamente para a montagem do dossiê, a prospecção de editais e a submissão de propostas em seu nome, podendo compartilhá-los com órgãos financiadores quando o edital exigir. A autorização pode ser revogada a qualquer momento por e-mail.",
          },
        ],
      },
      {
        tipo: "grade",
        colunas: 2,
        campos: [
          {
            nome: "assin_local",
            rotulo: "Local e data",
            placeholder: "Município/UF, 00/00/0000",
          },
          {
            nome: "assin_nome",
            rotulo: "Assinatura do representante legal",
            dica: "Assinar na versão impressa ou por certificado digital",
          },
        ],
      },
    ],
  },
];

/** Uma entrada por campo respondível, na ordem em que aparece na tela. */
export type Entrada = {
  /** `texto` conta como preenchido quando não está em branco; `marca`, quando marcado. */
  chave: "texto" | "marca";
  bloco: string;
  nome: string;
  rotulo: string;
};

/**
 * Achata BLOCOS numa lista linear. É o que alimenta o contador de progresso e
 * o texto do "Copiar respostas" — ambos precisam da ordem visual, não da
 * árvore. Calculado uma vez, no carregamento do módulo.
 *
 * O rótulo de um marcador entra sem a `descricao`: no desenho ela é a segunda
 * linha explicativa, não parte do nome do item, e o protótipo também copia só
 * a primeira linha.
 */
export const ENTRADAS: Entrada[] = BLOCOS.flatMap((bloco) =>
  bloco.secoes.flatMap((secao): Entrada[] => {
    const marca = (m: Marcador): Entrada => ({
      chave: "marca",
      bloco: bloco.titulo,
      nome: m.nome,
      rotulo: m.rotulo,
    });
    const texto = (c: Campo): Entrada => ({
      chave: "texto",
      bloco: bloco.titulo,
      nome: c.nome,
      rotulo: c.rotulo,
    });

    switch (secao.tipo) {
      case "grade":
        return secao.campos.map(texto);
      case "campo":
        return [texto(secao.campo)];
      case "marcadores":
      case "checklist":
      case "declaracoes":
        return secao.itens.map(marca);
    }
  }),
);

/** Total de campos — denominador do "% preenchido". */
export const TOTAL_CAMPOS = ENTRADAS.length;
