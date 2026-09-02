import type { Metadata } from "next";
import { estilosLegais } from "@/lib/estilos-legais";

export const metadata: Metadata = {
  title: "Política de Privacidade | Ponte Estruturação de Projetos",
  description:
    "Como a Ponte Estruturação de Projetos coleta, usa, armazena e protege dados pessoais nos formulários e áreas reservadas do site.",
  alternates: { canonical: "https://ponteprojetos.com.br/privacidade" },
};

/**
 * Política de Privacidade.
 *
 * Escrita a partir do que o código realmente faz — cada formulário, cada
 * destino, cada terceiro envolvido —, não de modelo genérico. Se algum fluxo
 * mudar, esta página muda junto: uma política que descreve um sistema que não
 * existe mais é pior do que nenhuma, porque vicia o consentimento de quem a
 * leu antes de entregar o dado.
 *
 * Última conferência contra o código: 02/09/2026.
 */
const ATUALIZADO = "2 de setembro de 2026";

export default function PrivacidadePage() {
  return (
    <div className="lg-root">
      <div className="lg-wrap">
        <div className="lg-marca">PONTE ESTRUTURAÇÃO DE PROJETOS</div>
        <h1>Política de Privacidade</h1>
        <p className="lg-atualizado">Atualizada em {ATUALIZADO}</p>

        <p>
          Esta política descreve o que acontece com os dados que você informa
          neste site. Ela foi escrita a partir do funcionamento real do sistema,
          e não de um modelo genérico — cada item abaixo corresponde a um fluxo
          que existe no código.
        </p>

        <h2>Quem é o controlador</h2>
        <p>
          <strong>PONTE Estruturação de Projetos de Impacto</strong>, inscrita
          no CNPJ sob o nº 64.318.188/0001-01. Contato para assuntos de
          privacidade e para o exercício de direitos:{" "}
          <a href="mailto:diretoria.ponte.projetos@gmail.com">
            diretoria.ponte.projetos@gmail.com
          </a>
          .
        </p>

        <h2>O que coletamos, e por quê</h2>

        <h3>Formulários de contato e diagnóstico</h3>
        <p>
          Quando você preenche um dos formulários do site — diagnóstico inicial,
          consultoria FINEP, REURB ou cadastro na plataforma — coletamos os
          dados que você digita: normalmente nome, e-mail, telefone ou WhatsApp,
          organização e uma descrição do seu projeto ou necessidade.
        </p>
        <p>
          <strong>Finalidade:</strong> responder ao seu contato, avaliar
          aderência do projeto às linhas de fomento que acompanhamos e manter
          histórico do atendimento. <strong>Base legal:</strong> execução de
          procedimentos preliminares a contrato, a seu pedido (art. 7º, V, da
          LGPD).
        </p>

        <h3>Áreas reservadas</h3>
        <p>
          Algumas áreas do site exigem autenticação. Nelas, além dos dados de
          acesso, registramos <strong>quando você entrou e o que fez</strong> —
          quais filtros aplicou, quais itens abriu, quais buscas realizou.
        </p>
        <p>
          Quando o acesso é feito por conta Google, recebemos do Google apenas{" "}
          <strong>nome, endereço de e-mail e foto de perfil</strong>. Não temos
          acesso à sua senha, aos seus contatos, ao seu e-mail nem a qualquer
          outro dado da sua conta.
        </p>
        <p>
          <strong>Finalidade:</strong> controlar quem acessa área restrita,
          manter trilha de auditoria e entender quais temas interessam a quem
          usa as ferramentas. <strong>Base legal:</strong> consentimento (art.
          7º, I) para o cadastro, e legítimo interesse (art. 7º, IX) no controle
          de acesso e na segurança da área reservada.
        </p>

        <h3>O que não coletamos</h3>
        <p>
          Não registramos endereço IP nem identificação de dispositivo no uso das
          áreas reservadas. Não usamos ferramentas de publicidade, rastreamento
          entre sites ou perfilamento comportamental para fins de marketing. Não
          vendemos nem cedemos dados a terceiros para fins comerciais.
        </p>

        <h2>Cookies</h2>
        <p>
          Usamos apenas cookies necessários ao funcionamento: os que mantêm sua
          sessão nas áreas reservadas. São cookies{" "}
          <code>httpOnly</code> — não podem ser lidos por scripts da página — e
          expiram automaticamente. Não há cookies de publicidade nem de
          analytics de terceiros.
        </p>

        <h2>Com quem os dados são compartilhados</h2>
        <p>
          Trabalhamos com prestadores que atuam como operadores, tratando dados
          por nossa conta e sob nossas instruções:
        </p>
        <table className="lg-tabela">
          <thead>
            <tr>
              <th>Operador</th>
              <th>Função</th>
              <th>Onde</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Supabase</strong></td>
              <td>Banco de dados e autenticação</td>
              <td>Estados Unidos (Oregon)</td>
            </tr>
            <tr>
              <td><strong>Vercel</strong></td>
              <td>Hospedagem do site</td>
              <td>Estados Unidos</td>
            </tr>
            <tr>
              <td><strong>Google</strong></td>
              <td>Envio de e-mail e login por conta Google</td>
              <td>Estados Unidos</td>
            </tr>
          </tbody>
        </table>

        <h3>Transferência internacional</h3>
        <p>
          Como se vê acima, os dados são armazenados e processados{" "}
          <strong>fora do Brasil</strong>. A transferência ocorre com base no
          art. 33, VIII, da LGPD — necessária para a execução de procedimentos
          preliminares e para a prestação do serviço que você solicitou — e nas
          cláusulas contratuais dos próprios operadores. Se isso for
          inaceitável para você, não preencha os formulários e nos escreva
          diretamente por e-mail.
        </p>

        <h2>Por quanto tempo guardamos</h2>
        <p>
          Dados de contato e de projetos permanecem enquanto durar a relação e
          pelo prazo necessário ao cumprimento de obrigações legais e à defesa
          em eventual processo. Registros de uso das áreas reservadas são
          mantidos para fins de auditoria. Você pode pedir a exclusão a qualquer
          momento, e ela é feita salvo quando a lei exigir a guarda.
        </p>

        <h2>Seus direitos</h2>
        <p>Nos termos do art. 18 da LGPD, você pode solicitar:</p>
        <ul>
          <li>confirmação de que tratamos dados seus, e acesso a eles;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
          <li>portabilidade a outro fornecedor;</li>
          <li>
            eliminação dos dados tratados com base no seu consentimento;
          </li>
          <li>informação sobre com quem compartilhamos seus dados;</li>
          <li>revogação do consentimento.</li>
        </ul>
        <p>
          Escreva para{" "}
          <a href="mailto:diretoria.ponte.projetos@gmail.com">
            diretoria.ponte.projetos@gmail.com
          </a>{" "}
          identificando-se e dizendo o que deseja. Respondemos no menor prazo
          possível e, em qualquer caso, dentro do prazo legal.
        </p>

        <h2>Segurança</h2>
        <p>
          As áreas reservadas usam sessão em cookie <code>httpOnly</code> e
          controle de acesso no servidor. O banco de dados aplica regras que
          impedem leitura direta pelo navegador: todo acesso passa pelo servidor
          do site. Nenhuma medida elimina completamente o risco, e se ocorrer
          incidente com risco relevante aos titulares, comunicaremos os
          afetados e a Autoridade Nacional de Proteção de Dados.
        </p>

        <h2>Menores de idade</h2>
        <p>
          Os serviços deste site destinam-se a organizações e profissionais.
          Não coletamos intencionalmente dados de crianças ou adolescentes. Se
          souber que isso ocorreu, escreva-nos e faremos a eliminação.
        </p>

        <h2>Mudanças nesta política</h2>
        <p>
          Quando o funcionamento do site mudar de forma que afete o tratamento
          de dados, esta página é atualizada junto e a data no topo é alterada.
          Recomendamos consultá-la antes de enviar informações.
        </p>

        <p className="lg-nota">
          Este texto descreve o funcionamento real do site na data indicada. Ele
          não substitui a avaliação de um advogado sobre o seu caso concreto.
        </p>

        <a className="lg-voltar" href="/">
          ← Voltar ao site
        </a>
      </div>

      <style>{estilosLegais}</style>
    </div>
  );
}
