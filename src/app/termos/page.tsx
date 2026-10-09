import type { Metadata } from "next";
import Link from "next/link";
import { estilosLegais } from "@/lib/estilos-legais";

export const metadata: Metadata = {
  title: "Termos de Uso | Ponte Estruturação de Projetos",
  description:
    "Condições de uso do site da Ponte Estruturação de Projetos, das áreas reservadas e dos painéis de dados públicos.",
  alternates: { canonical: "https://ponteprojetos.com.br/termos" },
};

/**
 * Termos de Uso.
 *
 * Cobre o uso do site, não a prestação de serviço — esta é contratada à parte,
 * por instrumento próprio. A distinção é deliberada: misturar as duas coisas
 * faria um texto de site parecer contrato, e um contrato parecer aviso de
 * rodapé.
 *
 * A seção sobre os dados do Transferegov existe porque o painel de
 * oportunidades exibe dado público reprocessado, e quem decide com base nele
 * precisa saber o que é fonte e o que é leitura nossa.
 *
 * 09/10/2026 (onda 7, lote 1 da C4b): "a conferir" não é irregularidade, com a
 * mesma definição do verbete "Ponto a conferir" do glossário do Mapa
 * (`lib/oportunidades/glossario.ts`). Os ajustes da seção 5 da C4b (título com
 * o Mapa e a parte pública) são do lote 2 e só entram com `MAPA_PUBLICO`.
 */
const ATUALIZADO = "9 de outubro de 2026";

export default function TermosPage() {
  return (
    <div className="lg-root">
      <div className="lg-wrap">
        <div className="lg-marca">PONTE ESTRUTURAÇÃO DE PROJETOS</div>
        <h1>Termos de Uso</h1>
        <p className="lg-atualizado">Atualizados em {ATUALIZADO}</p>

        <p>
          Estes termos valem para o uso deste site. A contratação de serviços da
          Ponte é feita por instrumento próprio, e nada aqui substitui ou altera
          o que estiver acordado nele.
        </p>

        <h2>Quem opera este site</h2>
        <p>
          <strong>PONTE Estruturação de Projetos de Impacto</strong>, CNPJ
          64.318.188/0001-01. Contato:{" "}
          <a href="mailto:diretoria.ponte.projetos@gmail.com">
            diretoria.ponte.projetos@gmail.com
          </a>
          .
        </p>

        <h2>O que este site é</h2>
        <p>
          Um canal de apresentação institucional, contato e disponibilização de
          ferramentas de apoio à estruturação e à captação de recursos para
          projetos. Algumas áreas são públicas; outras exigem autenticação e
          aprovação prévia.
        </p>

        <h2>Uso das áreas reservadas</h2>
        <p>
          O acesso a área reservada é pessoal e intransferível. Ao receber
          acesso, você concorda em:
        </p>
        <ul>
          <li>não compartilhar suas credenciais com terceiros;</li>
          <li>
            não tentar contornar controles de acesso, nem acessar dados de
            outros usuários;
          </li>
          <li>
            não extrair o conteúdo de forma automatizada para redistribuição;
          </li>
          <li>
            comunicar imediatamente qualquer uso indevido da sua conta de que
            tomar conhecimento.
          </li>
        </ul>
        <p>
          O acesso é concedido por decisão da Ponte e pode ser suspenso ou
          revogado a qualquer momento, especialmente em caso de
          descumprimento destas condições.
        </p>

        <h2>Sobre os dados exibidos nos painéis</h2>
        <p>
          Alguns painéis apresentam informações originadas de bases públicas
          oficiais, em especial o Transferegov (Governo Federal). A respeito
          delas:
        </p>
        <ul>
          <li>
            <strong>A fonte é pública e a Ponte não a controla.</strong> Erros,
            omissões, atrasos ou mudanças na base de origem se refletem no
            painel.
          </li>
          <li>
            <strong>Exibimos a data da última coleta.</strong> Quando a origem
            está desatualizada, o painel avisa. Ausência de novidade pode
            significar coleta parada na origem, não ausência de fato.
          </li>
          <li>
            <strong>A leitura editorial é nossa.</strong> Classificações de
            aderência, agrupamentos e destaques são interpretação da Ponte, não
            informação oficial.
          </li>
          <li>
            <strong>“A conferir” não é irregularidade.</strong> O Mapa de
            Oportunidades lê as fontes públicas de forma automática e marca
            como “a conferir” o que foge do esperado — um prazo vencido, um
            dado que não bate entre duas bases. O ponto pede conferência no
            documento de origem: não é acusação, nem conclusão da Ponte, nem
            prova de irregularidade, e não substitui certidão, parecer do
            concedente, decisão de tribunal de contas ou orientação jurídica.
          </li>
          <li>
            <strong>Nada ali é aconselhamento.</strong> Decisões de submissão,
            prazo e elegibilidade devem ser confirmadas no edital e nos canais
            oficiais do concedente.
          </li>
        </ul>

        <h2>Propriedade intelectual</h2>
        <p>
          Textos, identidade visual, metodologias, código e materiais deste site
          pertencem à Ponte, salvo quando indicado de outra forma. Dados
          públicos de origem governamental permanecem públicos; o que é nosso é
          a curadoria, a organização e a apresentação.
        </p>
        <p>
          Você pode citar e compartilhar o conteúdo com atribuição. Reprodução
          integral, uso comercial ou criação de serviço derivado dependem de
          autorização prévia por escrito.
        </p>

        <h2>Disponibilidade</h2>
        <p>
          O site é oferecido no estado em que se encontra. Não há garantia de
          disponibilidade ininterrupta: pode haver manutenção, indisponibilidade
          de terceiros dos quais dependemos, ou descontinuação de páginas e
          ferramentas. Ofertas e materiais publicados podem ser retirados a
          qualquer momento.
        </p>

        <h2>Limitação de responsabilidade</h2>
        <p>
          A Ponte não responde por decisões tomadas com base no conteúdo
          informativo deste site, nem por perdas decorrentes de indisponibilidade
          ou de erro em dados de origem pública. Esta limitação não afeta
          obrigações assumidas em contrato de prestação de serviços, que se
          regem pelo respectivo instrumento.
        </p>

        <h2>Privacidade</h2>
        <p>
          O tratamento de dados pessoais está descrito na{" "}
          <a href="/privacidade">Política de Privacidade</a>, que integra estes
          termos.
        </p>

        <h2>Mudanças</h2>
        <p>
          Estes termos podem ser atualizados. A data no topo indica a última
          alteração; o uso continuado do site após a mudança significa
          concordância com a versão vigente.
        </p>

        <h2>Lei aplicável e foro</h2>
        <p>
          Aplica-se a legislação brasileira. Fica eleito o foro da comarca de
          João Pessoa/PB para dirimir controvérsias, salvo hipótese legal de
          foro diverso, em especial as regras de proteção ao consumidor.
        </p>

        <p className="lg-nota">
          Este texto descreve as condições de uso do site na data indicada. Ele
          não substitui a avaliação de um advogado sobre o seu caso concreto.
        </p>

        <Link className="lg-voltar" href="/">
          ← Voltar ao site
        </Link>
      </div>

      <style>{estilosLegais}</style>
    </div>
  );
}
