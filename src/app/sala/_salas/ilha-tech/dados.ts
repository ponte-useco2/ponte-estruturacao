/**
 * Sala da Associação Ilha Tech (reunião de 15/10/2026). Só fatos públicos, cada um com a fonte (decisão do titular,
 * 14/10/2026): nada de leitura da PONTE sobre pessoas, ranking ou juízo. A leitura completa fica no briefing interno.
 *
 * Os números das emendas são um retrato do banco da PONTE (execução 7 das emendas, arquivo do Portal da Transparência de
 * 10/10/2026), tirado em 14/10/2026. São as emendas cujo destino é a Paraíba, de 2024 a 2026, pelos canais que dizem o
 * destino (Pix, saúde fundo a fundo, convênio e pagamento direto), sem somar o mesmo dinheiro duas vezes. O empenhado é o
 * do catálogo do Portal (emendas individuais com destino na PB). Parlamentar é agente público: o nome é o publicado.
 */

export const DADOS_DO_PORTAL = "10/10/2026";
export const PREPARADO_EM = "14/10/2026";
export const DATA_DA_REUNIAO = "2026-10-15";

export interface ParlamentarSala {
  nome: string;
  casa: "Câmara dos Deputados" | "Senado Federal";
  /** 2024 a 2026, R$ */
  pix: number;
  fundos: number;
  conveniosEntes: number;
  osc: number;
  oscs: number;
  /** emendas individuais com destino na PB, R$ */
  empenhado2025: number;
  empenhado2026: number;
  /** ministérios dos instrumentos com OSC (2024 a 2026) */
  ministeriosOsc: string[];
  /** as áreas (função orçamentária) das emendas com finalidade definida, 2024 a 2026, com a fatia de cada uma */
  areas: string;
}

export const PARLAMENTARES: ParlamentarSala[] = [
  { nome: "Aguinaldo Ribeiro", casa: "Câmara dos Deputados", pix: 50_696_700, fundos: 60_634_215, conveniosEntes: 0, osc: 1_066_718, oscs: 4,
    empenhado2025: 36_325_985, empenhado2026: 37_970_500, ministeriosOsc: ["Agricultura", "Cultura", "Direitos Humanos", "Saúde"],
    areas: "Saúde 92%, Assistência social 6%, Agricultura 1%" },
  { nome: "Cabo Gilberto Silva", casa: "Câmara dos Deputados", pix: 36_829_089, fundos: 37_788_465, conveniosEntes: 0, osc: 19_596_627, oscs: 8,
    empenhado2025: 36_072_969, empenhado2026: 21_770_662, ministeriosOsc: ["Esporte", "Saúde"],
    areas: "Saúde 80%, Desporto e lazer 9%, Assistência social 6%" },
  { nome: "Damião Feliciano", casa: "Câmara dos Deputados", pix: 53_469_824, fundos: 53_364_061, conveniosEntes: 2_667_090, osc: 465_734, oscs: 4,
    empenhado2025: 36_840_187, empenhado2026: 29_387_437, ministeriosOsc: ["Cultura", "Saúde"],
    areas: "Saúde 96%, Cultura 1%, Segurança pública 1%" },
  { nome: "Daniella Ribeiro", casa: "Senado Federal", pix: 48_787_582, fundos: 107_787_618, conveniosEntes: 8_733_222, osc: 5_991_784, oscs: 7,
    empenhado2025: 60_672_194, empenhado2026: 58_505_229, ministeriosOsc: ["Cultura", "Esporte", "Saúde"],
    areas: "Saúde 65%, Urbanismo 12%, Assistência social 12%" },
  { nome: "Efraim Filho", casa: "Senado Federal", pix: 69_836_286, fundos: 97_075_131, conveniosEntes: 1_915_727, osc: 9_348_733, oscs: 9,
    empenhado2025: 68_179_252, empenhado2026: 51_976_163, ministeriosOsc: ["Comunicações", "Cultura", "Empreendedorismo", "Esporte", "Saúde"],
    areas: "Saúde 79%, Urbanismo 8%, Assistência social 7%" },
  { nome: "Gervásio Maia", casa: "Câmara dos Deputados", pix: 56_358_522, fundos: 54_936_617, conveniosEntes: 1_314_647, osc: 414_592, oscs: 1,
    empenhado2025: 37_163_897, empenhado2026: 28_527_215, ministeriosOsc: ["Saúde"],
    areas: "Saúde 100%" },
  { nome: "Hugo Motta", casa: "Câmara dos Deputados", pix: 56_638_194, fundos: 56_803_513, conveniosEntes: 0, osc: 178_672, oscs: 2,
    empenhado2025: 36_080_663, empenhado2026: 39_539_892, ministeriosOsc: ["Saúde"],
    areas: "Saúde 99%, Educação 1%" },
  { nome: "Luiz Couto", casa: "Câmara dos Deputados", pix: 5_376_500, fundos: 39_493_470, conveniosEntes: 2_499_712, osc: 13_518_982, oscs: 30,
    empenhado2025: 36_051_934, empenhado2026: 23_174_492,
    ministeriosOsc: ["Comunicações", "Cultura", "Desenvolvimento Agrário", "Desenvolvimento Social", "Direitos Humanos", "Esporte", "Saúde"],
    areas: "Saúde 60%, Educação 16%, Organização agrária 13%" },
  { nome: "Mersinho Lucena", casa: "Câmara dos Deputados", pix: 22_109_205, fundos: 72_580_237, conveniosEntes: 4_061_012, osc: 766_107, oscs: 3,
    empenhado2025: 35_871_342, empenhado2026: 33_952_497, ministeriosOsc: ["Cultura", "Saúde"],
    areas: "Saúde 60%, Assistência social 34%, Urbanismo 4%" },
  { nome: "Murilo Galdino", casa: "Câmara dos Deputados", pix: 44_064_259, fundos: 52_565_269, conveniosEntes: 7_318_701, osc: 2_410_500, oscs: 4,
    empenhado2025: 36_960_912, empenhado2026: 28_902_688, ministeriosOsc: ["Agricultura", "Esporte", "Saúde", "Turismo"],
    areas: "Saúde 84%, Assistência social 10%, Agricultura 3%" },
  { nome: "Romero Rodrigues", casa: "Câmara dos Deputados", pix: 47_456_000, fundos: 63_630_620, conveniosEntes: 300_000, osc: 2_799_262, oscs: 4,
    empenhado2025: 37_275_985, empenhado2026: 39_967_993, ministeriosOsc: ["Ciência e Tecnologia", "Desenvolvimento Agrário", "Saúde"],
    areas: "Saúde 90%, Assistência social 8%, Ciência e Tecnologia 1%" },
  { nome: "Ruy Carneiro", casa: "Câmara dos Deputados", pix: 25_374_830, fundos: 51_693_352, conveniosEntes: 2_828_995, osc: 13_552_725, oscs: 18,
    empenhado2025: 37_272_956, empenhado2026: 26_803_441, ministeriosOsc: ["Agricultura", "Cultura", "Desenvolvimento Social", "Esporte", "Saúde"],
    areas: "Saúde 68%, Assistência social 23%, Agricultura 3%" },
  { nome: "Veneziano Vital do Rêgo", casa: "Senado Federal", pix: 85_163_975, fundos: 106_723_044, conveniosEntes: 1_900_000, osc: 1_589_106, oscs: 6,
    empenhado2025: 67_592_912, empenhado2026: 64_358_599, ministeriosOsc: ["Empreendedorismo", "Saúde"],
    areas: "Saúde 85%, Assistência social 7%, Gestão ambiental 4%" },
  { nome: "Wellington Roberto", casa: "Câmara dos Deputados", pix: 35_619_500, fundos: 61_668_994, conveniosEntes: 1_170_000, osc: 10_208_020, oscs: 5,
    empenhado2025: 37_154_840, empenhado2026: 37_244_837, ministeriosOsc: ["Agricultura", "Esporte", "Saúde"],
    areas: "Saúde 72%, Assistência social 13%, Agricultura 9%" },
  { nome: "Wilson Santiago", casa: "Câmara dos Deputados", pix: 53_906_225, fundos: 57_242_478, conveniosEntes: 294_000, osc: 500_000, oscs: 1,
    empenhado2025: 37_275_913, empenhado2026: 38_118_204, ministeriosOsc: ["Saúde"],
    areas: "Saúde 96%, Assistência social 3%, Desporto e lazer 1%" },
];

/** Para onde foram as emendas da bancada a OSC na PB, 2024 a 2026 (resumo fixo: 12 linhas). */
export const MINISTERIOS_OSC: { orgao: string; instrumentos: number; oscs: number; parlamentares: number; valor: number }[] = [
  { orgao: "Saúde", instrumentos: 63, oscs: 11, parlamentares: 15, valor: 43_784_011 },
  { orgao: "Agricultura e Pecuária", instrumentos: 13, oscs: 5, parlamentares: 4, valor: 11_288_100 },
  { orgao: "Esporte", instrumentos: 17, oscs: 11, parlamentares: 7, valor: 11_134_000 },
  { orgao: "Desenvolvimento Agrário e Agricultura Familiar", instrumentos: 9, oscs: 7, parlamentares: 2, valor: 4_750_000 },
  { orgao: "Cultura", instrumentos: 23, oscs: 13, parlamentares: 7, valor: 3_509_944 },
  { orgao: "Pagamento direto, sem convênio no SICONV", instrumentos: 5, oscs: 1, parlamentares: 2, valor: 2_685_717 },
  { orgao: "Empreendedorismo, Microempresa e Empresa de Pequeno Porte", instrumentos: 3, oscs: 2, parlamentares: 2, valor: 1_500_000 },
  { orgao: "Direitos Humanos e Cidadania", instrumentos: 6, oscs: 6, parlamentares: 2, valor: 1_170_000 },
  { orgao: "Comunicações", instrumentos: 3, oscs: 2, parlamentares: 2, valor: 1_000_000 },
  { orgao: "Desenvolvimento e Assistência Social", instrumentos: 5, oscs: 4, parlamentares: 2, valor: 950_000 },
  { orgao: "Ciência, Tecnologia e Inovação", instrumentos: 1, oscs: 1, parlamentares: 1, valor: 435_790 },
  { orgao: "Turismo", instrumentos: 1, oscs: 1, parlamentares: 1, valor: 200_000 },
];

export interface Fonte {
  rotulo: string;
  url: string;
}

export const F = {
  portaria: { rotulo: "Portaria Conjunta MPO/MGI/SRI-PR nº 2, de 15/01/2026", url: "https://www.gov.br/transferegov/pt-br/legislacao/portarias/portaria-conjunta-mpo-mgi-sri-pr-no-2-de-15-de-janeiro-de-2026" },
  c32: { rotulo: "Transferegov, Comunicado nº 32/2026 (cronograma 4/2026, finalidade definida)", url: "https://www.gov.br/transferegov/pt-br/comunicados/comunicados-gerais/2026/comunicado-no-32-2026-cronograma-4-2026-execucao-das-emendas-individuais-com-finalidade-definida-rp6-orcamento-2026-apos-superacao-dos-impedimentos-de-ordem-tecnica" },
  c33: { rotulo: "Transferegov, Comunicado nº 33/2026 (transferências especiais, 2º ciclo)", url: "https://www.gov.br/transferegov/pt-br/comunicados/comunicados-gerais/2026/comunicado-no-33-2026-2o-cronograma_emendas-individuais-rp6_transferencia-especial-orcamento-2026-2o-ciclo" },
  c22: { rotulo: "Transferegov, Comunicado nº 22/2026 (eleições 2026)", url: "https://www.gov.br/transferegov/pt-br/comunicados/comunicados-gerais/2026/comunicado-22-2026-eleicoes-2026-interpretacao-do-art-95-da-lei-no-15-321-de-2025-observancia-ao-art-73-inciso-vi-a-da-lei-no-9-504-de-1997-parecer-no-00605-2026-conjur-mgi-cgu-agu" },
  c10: { rotulo: "Transferegov, Comunicado nº 10/2026 (minutas de termo de fomento atualizadas)", url: "https://www.gov.br/transferegov/pt-br/comunicados/comunicados-gerais/2026/comunicado-no-10-2026-2013-publicacao-minuta-padronizada-de-termo-de-colaboracao-e-termo-de-fomento-2013-atualizadas" },
  comunicados: { rotulo: "Transferegov, comunicados gerais de 2026", url: "https://www.gov.br/transferegov/pt-br/comunicados/comunicados-gerais/2026" },
  portal: { rotulo: "Portal da Transparência, emendas parlamentares (dados abertos)", url: "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares" },
  mapaOsc: { rotulo: "Mapa das Organizações da Sociedade Civil (Ipea)", url: "https://mapaosc.ipea.gov.br" },
  mrosc: { rotulo: "Lei nº 13.019/2014 (MROSC)", url: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l13019.htm" },
  eleicoes: { rotulo: "Lei nº 9.504/1997, art. 73", url: "https://www.planalto.gov.br/ccivil_03/leis/l9504.htm" },
  cmo: { rotulo: "Congresso Nacional, CMO: quadro de tramitação dos PLN de 2026", url: "https://www.congressonacional.leg.br/comissoes-mistas/cmo/quadro-de-tramitacao/-/quadro/PLN/2026" },
  cnmLoa2026: { rotulo: "CNM: prazo de emendas à LOA 2026 (24/10 a 13/11/2025)", url: "https://cnm.org.br/comunicacao/noticias/prazo-para-apresentacao-de-emendas-na-loa-2026-vai-de-24-de-outubro-a-13-de-novembro" },
  ploa2027: { rotulo: "Imprensa: PLOA 2027 reserva R$ 44,8 bi para emendas individuais e de bancada", url: "https://www.regionalidades.com.br/noticia/orcamento-de-2027-reserva-r-44-8-bilhoes-para-emendas-impositivas" },
  memp2: { rotulo: "MEMP, Edital de Chamamento Público nº 2/2026", url: "https://www.gov.br/memp/pt-br/acesso-a-informacao/editais/edital-fomento/edital_de_chamamento_publico_n__2_2026.pdf" },
  memp4: { rotulo: "MEMP, Edital de Chamamento Público nº 4/2026", url: "https://www.gov.br/memp/pt-br/acesso-a-informacao/editais/edital-04-2026/edital_de_chamamento_publico_n__4_2026.pdf" },
  mcomCrc: { rotulo: "MCom, programa Computadores para Inclusão", url: "https://www.gov.br/mcom/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/computadores-para-inclusao-1" },
  transferegov: { rotulo: "Transferegov.br (programas e cadastro de proponente)", url: "https://www.gov.br/transferegov/pt-br" },
  apiPb: { rotulo: "Governo da Paraíba, API de dados abertos: execução das emendas, listagem das emendas e notas de empenho", url: "https://api.dados.pb.gov.br/swagger/" },
  painelJp: { rotulo: "Prefeitura de João Pessoa, painel das emendas impositivas e portal da transparência (execução das emendas)", url: "https://transparenciaemendas.joaopessoa.pb.gov.br/" },
  saplJp: { rotulo: "Câmara Municipal de João Pessoa, SAPL (emendas impositivas à LOA)", url: "https://sapl.joaopessoa.pb.leg.br/" },
} satisfies Record<string, Fonte>;

/** Marcos do calendário, com a fonte de cada um. `ate` = fim do prazo (AAAA-MM-DD). */
export interface Marco {
  de?: string;
  ate: string;
  titulo: string;
  texto: string;
  vale: "osc" | "entes" | "todos";
  fonte: Fonte;
}

export const MARCOS: Marco[] = [
  { ate: "2026-10-16", titulo: "Ministérios publicam os programas do cronograma 4/2026", vale: "osc", fonte: F.c32,
    texto: "Emendas individuais com finalidade definida, depois da superação dos impedimentos técnicos. É a modalidade em que a OSC entra, por termo de fomento." },
  { de: "2026-10-17", ate: "2026-11-02", titulo: "Envio de propostas e planos de trabalho", vale: "osc", fonte: F.c32,
    texto: "Só para quem já foi indicado por um parlamentar no SIOP." },
  { ate: "2026-10-26", titulo: "Transferências especiais (Pix), 2º ciclo: beneficiários divulgados", vale: "entes", fonte: F.c33,
    texto: "Vale só para municípios e estados; o plano de trabalho vai até 05/11 e os impedimentos saem até 23/11." },
  { de: "2026-11-03", ate: "2026-12-18", titulo: "Análise, complementação e aprovação dos planos", vale: "osc", fonte: F.c32,
    texto: "Plano com impedimento técnico não superado até 31/12 desobriga a assinatura." },
  { de: "2026-11-04", ate: "2026-11-09", titulo: "Última abertura do SIOP para remanejamento em 2026", vale: "todos", fonte: F.c32,
    texto: "Alcança só os impedimentos técnicos identificados até esse período. Depois dela, o ministério que receber o recurso define um cronograma próprio." },
  { ate: "2026-12-31", titulo: "Data-limite para assinar termos com recurso de 2026", vale: "todos", fonte: F.c32,
    texto: "Convênios, contratos de repasse e termos de fomento e de colaboração do orçamento de 2026." },
];

/** Requisitos para uma OSC assinar com a União, e a situação da associação conhecida em 14/10/2026. */
export interface Requisito {
  item: string;
  base: string;
  situacao: string;
  estado: "cumprido" | "a-fazer" | "a-confirmar";
  fonte: Fonte;
}

export const REQUISITOS: Requisito[] = [
  { item: "Pelo menos 3 anos de CNPJ ativo", base: "Portaria Conjunta nº 2/2026, art. 4-A, I; MROSC, art. 33, V, a", fonte: F.portaria,
    situacao: "Cumprido em 05/10/2026 (CNPJ aberto em 05/10/2023, ativo no Mapa das OSC).", estado: "cumprido" },
  { item: "Cadastro de proponente no Transferegov", base: "Proposta e plano de trabalho são enviados pela plataforma", fonte: F.transferegov,
    situacao: "Nenhuma proposta da associação no Transferegov até 14/10/2026. Confirmar o cadastro.", estado: "a-confirmar" },
  { item: "Capacidade técnica, gerencial e operacional comprovada", base: "Portaria Conjunta nº 2/2026, art. 4-A, II; MROSC, art. 33, V, b e c", fonte: F.portaria,
    situacao: "Reunir relatórios de atividades, registros, atestados e parcerias desde 2023.", estado: "a-fazer" },
  { item: "Sem prestação de contas rejeitada", base: "Portaria Conjunta nº 2/2026, art. 4-A, III", fonte: F.portaria,
    situacao: "Sem parceria federal anterior registrada.", estado: "cumprido" },
  { item: "Página na internet com os valores recebidos de emendas", base: "Portaria Conjunta nº 2/2026, art. 9, §§ 6º e 7º; MROSC, art. 11", fonte: F.portaria,
    situacao: "Preparar a página de transparência antes da primeira parceria.", estado: "a-fazer" },
  { item: "Estatuto com as cláusulas do MROSC", base: "MROSC, art. 33 (finalidade pública, destino do patrimônio, escrituração)", fonte: F.mrosc,
    situacao: "Conferir o estatuto registrado em cartório.", estado: "a-confirmar" },
  { item: "Documentos e certidões", base: "MROSC, art. 34", fonte: F.mrosc,
    situacao: "Certidões de regularidade, ata da diretoria em exercício e relação dos dirigentes.", estado: "a-fazer" },
  { item: "Declaração de ausência de impedimentos", base: "MROSC, art. 39 (inclusive o inciso III, sobre dirigentes)", fonte: F.mrosc,
    situacao: "A associação declara, conforme o modelo do concedente.", estado: "a-fazer" },
  { item: "Ano eleitoral", base: "Lei nº 9.504/1997, art. 73, §§ 10 e 11", fonte: F.eleicoes,
    situacao: "Programa social não pode ser executado por entidade nominalmente vinculada a candidato.", estado: "a-confirmar" },
  { item: "Minutas de termo de fomento atualizadas (ADPF 854)", base: "Transferegov, Comunicado nº 10/2026", fonte: F.c10,
    situacao: "Conhecer as cláusulas de rastreabilidade e transparência antes de assinar.", estado: "a-fazer" },
];

/** Os quatro ministérios citados pela associação: o que os dados públicos mostram (14/10/2026). */
export const MINISTERIOS_CITADOS: { nome: string; emendasOsc: string; programas: string; fontes: Fonte[] }[] = [
  { nome: "Empreendedorismo, Microempresa e Empresa de Pequeno Porte (MEMP)",
    emendasOsc: "R$ 1,5 mi a 2 OSCs na PB em 2024–2026, em 3 instrumentos, de emendas de Efraim Filho e Veneziano Vital do Rêgo.",
    programas: "Edital nº 2/2026 (inclusão socioprodutiva, cooperativismo e microempreendedorismo): inscrições de 20/02 a 23/03/2026, encerradas; a 1ª convocação das selecionadas fica no Transferegov até 30/10/2026. Edital nº 4/2026 (ambiente de negócios e inovação, seleção de uma OSC), publicado em 27/02/2026.",
    fontes: [F.memp2, F.memp4] },
  { nome: "Comunicações (MCom)",
    emendasOsc: "R$ 1,0 mi a 2 OSCs na PB em 2024–2026, em 3 instrumentos, de emendas de Efraim Filho e Luiz Couto.",
    programas: "Computadores para Inclusão: os Centros de Recondicionamento de Computadores (CRC) aceitam entidade privada sem fins lucrativos, selecionada por chamamento público. Edital de 2026 não localizado até 14/10/2026.",
    fontes: [F.mcomCrc] },
  { nome: "Portos e Aeroportos (MPor)",
    emendasOsc: "Nenhuma emenda da bancada da PB a OSC em 2024–2026.",
    programas: "Os programas abertos no Transferegov em 14/10/2026 são para governos estaduais (aviação regional).",
    fontes: [F.transferegov] },
  { nome: "Transportes (MT)",
    emendasOsc: "Nenhuma emenda da bancada da PB a OSC em 2024–2026.",
    programas: "Nenhum programa aberto a OSC no Transferegov em 14/10/2026.",
    fontes: [F.transferegov] },
];
