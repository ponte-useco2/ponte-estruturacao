import type { Metadata } from "next";
import Link from "next/link";
import { estilosLegais } from "@/lib/estilos-legais";

export const metadata: Metadata = {
  title: "Política de Privacidade | Ponte Estruturação de Projetos",
  description:
    "Como a Ponte Estruturação de Projetos coleta, usa, armazena e protege dados pessoais nos formulários, nas áreas com cadastro e na medição de audiência do site.",
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
 * Última conferência contra o código: 09/10/2026 (lote 1 da C4b, onda 7:
 * áreas com cadastro, organização declarada e vínculo, itens seguidos e
 * carteira, registro de uso do Mapa, cookies e medição da Vercel, retenção e
 * direitos). O lote 2 (Mapa aberto ao público) só entra com `MAPA_PUBLICO`.
 */
const ATUALIZADO = "9 de outubro de 2026";

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

        <h3>Áreas com cadastro</h3>
        <p>
          O painel de janelas de convênio e as partes do Mapa de Oportunidades
          que pedem cadastro exigem autenticação e aprovação da PONTE. Ao pedir
          acesso, guardamos os dados que vêm da sua conta Google (descritos
          abaixo), a data do pedido, a decisão da PONTE sobre ele e a data do
          seu último acesso.
        </p>
        <p>
          <strong>Registro de uso.</strong> Depois que seu acesso é aprovado,
          registramos <strong>quando você usou e o que fez</strong>. Cada
          registro guarda o código da sua conta, o seu e-mail, o tipo do que foi
          feito, a data e a hora e um detalhe curto. No Mapa, entram as páginas
          do Brasil, dos estados, dos municípios e das entidades, a lista de
          organizações de um município, os relatórios, os laudos de
          instrumento, o glossário e a carteira, além do que você passou a
          seguir ou deixou de seguir. O detalhe diz qual página foi aberta — a
          UF, o código IBGE do município, o CNPJ da entidade ou o número do
          instrumento —, a aba e o seu nível de acesso; na carteira, quantos
          itens e avisos não lidos ela tinha. No painel de janelas, entram a
          entrada no painel, os filtros aplicados e os programas que você
          consultou no Transferegov. Os administradores da PONTE consultam esse
          registro identificado por e-mail.
        </p>
        <p>
          <strong>Sobre as buscas.</strong> Na busca do Mapa, guardamos só a
          forma do que foi digitado — texto, CNPJ ou número —, a UF e se a busca
          levou direto a uma página, nunca o que foi digitado; quando ela leva
          direto a uma página, a visita a essa página é registrada como as
          demais. Na lista de organizações de um município, guardamos só se
          houve filtro por nome, nunca o nome. No painel de janelas, guardamos o
          texto da busca, limitado a 120 caracteres.
        </p>
        <p>
          Quando o acesso é feito por conta Google, recebemos do Google apenas{" "}
          <strong>nome, endereço de e-mail e foto de perfil</strong>. Não temos
          acesso à sua senha, aos seus contatos, ao seu e-mail nem a qualquer
          outro dado da sua conta.
        </p>
        <p>
          <strong>Finalidade:</strong> controlar quem acessa a área com
          cadastro, manter trilha de auditoria, entender quais temas interessam
          a quem usa as ferramentas e medir o interesse pelo Mapa como serviço
          — se quem usa volta sem ser lembrado, que tarefas repete, que análises
          abre —, o que orienta o que a PONTE desenvolve e a avaliação de uma
          oferta do Mapa por assinatura. <strong>Base legal:</strong>{" "}
          consentimento (art. 7º, I) para o cadastro, e legítimo interesse (art.
          7º, IX) no controle de acesso e na segurança da área com cadastro.
        </p>

        <h3>Organização que você declara</h3>
        <p>
          No Mapa, você pode declarar a organização em nome da qual atua.
          Pedimos o tipo (prefeitura, organização da sociedade civil, empresa,
          universidade e outros) e o nome; a UF, o município e o CNPJ são
          opcionais. Guardamos também quem fez o cadastro, quando, e o papel de
          cada pessoa na organização. O tipo e a UF servem para mostrar as
          janelas que a organização pode pleitear. Se outras pessoas forem
          vinculadas à mesma organização, elas também veem o que foi
          declarado; os temas que você marca continuam só seus.
        </p>
        <p>
          <strong>Confirmação do vínculo.</strong> Como a declaração é feita por
          você, a PONTE confere se a organização é de fato a prefeitura do
          município ou a titular do CNPJ informado antes de abrir a visão de
          cliente: a página do próprio município ou da própria entidade, com os
          laudos dos seus instrumentos. Guardamos o município ou o CNPJ
          confirmado, a data e qual administrador da PONTE confirmou. Se o
          município ou o CNPJ do cadastro mudar, a confirmação deixa de valer.
        </p>
        <p>
          <strong>Finalidade:</strong> mostrar as janelas que combinam com a
          organização e, com o vínculo confirmado, abrir a visão de cliente.{" "}
          <strong>Base legal:</strong> consentimento (art. 7º, I): declarar a
          organização é opcional, e o Mapa funciona sem isso.
        </p>

        <h3>Itens que você segue, carteira e avisos</h3>
        <p>
          No Mapa, você pode seguir janelas de convênio, convênios, propostas,
          municípios e entidades. Guardamos, ligada à sua conta, a lista do que
          você segue e o último retrato de cada item, feito com dados públicos
          (situação, valores, prazos, contagens), para comparar com o dado
          novo. Quando algo muda, geramos um aviso só para você, que aparece na
          carteira e na página de avisos; guardamos também quais avisos você
          leu e quais arquivou. No site, só você vê a sua lista. Esses avisos
          ficam dentro do site: não mandamos e-mail sobre eles.
        </p>
        <p>
          <strong>Finalidade:</strong> mostrar o que mudou no que você segue.{" "}
          <strong>Base legal:</strong> consentimento (art. 7º, I), o do
          cadastro. Deixar de seguir tira o item da sua lista.
        </p>

        <h3>Central de avisos do Mapa de Oportunidades</h3>
        <p>
          Na plataforma, a central de avisos mostra o que mudou nas janelas de
          convênio desde a sua última visita. Para isso guardamos, ligado à sua
          conta, <strong>quais avisos você recebeu, quais leu e quais arquivou</strong>.
        </p>
        <p>
          Se quiser, você pode marcar na própria central{" "}
          <strong>o que prefere acompanhar</strong> — temas, órgãos ou o tipo de
          instituição que pode se candidatar. Usamos essas escolhas só para
          destacar as janelas que combinam com elas. Nada vem marcado, e sem
          escolha sua nada é guardado.
        </p>
        <p>
          <strong>O que não fazemos.</strong> Não deduzimos seus interesses do
          que você abre, filtra ou busca: vale só o que você marcou. Não usamos
          suas escolhas para lhe oferecer serviços. A PONTE pode contar quantas
          pessoas acompanham cada assunto, sem identificar ninguém e só a partir
          de um número mínimo de pessoas, para decidir o que priorizar.
        </p>
        <p>
          <strong>Finalidade:</strong> mostrar o que mudou e destacar o que
          combina com as suas escolhas. <strong>Base legal:</strong>{" "}
          consentimento (art. 7º, I) — o do cadastro, para os avisos; e o que
          você dá ao marcar uma preferência, que se revoga desmarcando.{" "}
          <strong>Guarda:</strong> enquanto sua conta existir. Desmarcar apaga a
          escolha; pedir a exclusão apaga avisos, escolhas e histórico de uso.
        </p>

        <h3>O que não coletamos</h3>
        <p>
          {/* [REVISÃO JURÍDICA: Marco Civil da Internet (Lei 12.965/2014), art. 15 — a PONTE precisa guardar
               registros de acesso (data, hora e IP) por 6 meses? Ver C4b, seção 2.6. Se a resposta for guardar,
               esta frase muda, e a do aviso do `entrar` também.] */}
          No registro de uso, não gravamos endereço IP nem identificação do seu
          aparelho ou navegador. O endereço IP pode constar dos registros
          técnicos dos operadores — a hospedagem (Vercel) e o serviço de
          autenticação (Supabase), na tabela abaixo —, que servem à operação e
          à segurança desses serviços. Nos formulários, ele serve de chave a
          uma contagem que impede envios em série, mantida só na memória
          temporária do servidor e não gravada em banco de dados nem em log.
          Não usamos ferramentas de publicidade, rastreamento entre sites ou
          perfilamento comportamental para fins de marketing. Não vendemos nem
          cedemos dados a terceiros para fins comerciais.
        </p>

        <h2>Cookies e medição</h2>
        <p>
          Usamos apenas cookies necessários ao funcionamento das áreas com
          cadastro. Os de sessão são criados pelo serviço de autenticação
          (Supabase) a partir do momento em que você clica em “Entrar com
          Google”, para manter você conectado, e deixam de valer quando você
          sai. Quem declara uma organização no Mapa recebe também um cookie que
          guarda qual organização está ativa: ele traz só um código interno, dura
          até um ano e, sem a sua sessão, não dá acesso a nada.
        </p>
        {/* [CONFERIR NO PAINEL DA VERCEL: Analytics ativo?] O texto abaixo diz "pode medir" para continuar
             verdadeiro nos dois casos: o componente `<Medicao />` está no layout raiz, mas só há medição se o
             Web Analytics estiver ativo no projeto. Conferir também, na documentação vigente da Vercel, que a
             ferramenta não usa cookies nem grava identificador no navegador. */}
        <p>
          O site pode medir a audiência de forma agregada — quantas vezes cada
          página é aberta — com a ferramenta de medição da Vercel (Web
          Analytics), que, segundo a Vercel, não usa cookies. O componente do
          site que aciona essa medição não grava nada no seu navegador. Nas
          páginas do Mapa de Oportunidades e do painel de janelas, o endereço
          chega à medição sem a parte final, onde ficam buscas, filtros e abas.
          Não há cookies de publicidade, de redes sociais nem de rastreamento
          entre sites.
        </p>
        <p>
          Por isso não pedimos consentimento para cookies: os que usamos são
          necessários ao serviço que você pediu, e a medição não depende de
          cookie. Se um dia usarmos cookie que não seja necessário, pediremos
          seu consentimento antes.
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
              <td>
                Hospedagem do site, registros técnicos de acesso e, quando
                ativa, medição agregada de audiência, sem cookies
              </td>
              <td>
                {/* [CONFERIR NO PAINEL DA VERCEL: região das funções (Project › Settings › Functions). O
                     `vercel.json` não fixa região. Se for São Paulo, trocar por "Brasil (funções) e Estados
                     Unidos (medição e registros)".] */}
                Estados Unidos
              </td>
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
          {/* [REVISÃO JURÍDICA: inciso e instrumento (C4b, achado 5 e seção 3.8). O texto cita o art. 33, VIII
               (consentimento específico e em destaque), mas descreve o IX (necessária à execução de contrato ou
               de procedimentos preliminares, art. 7º, V). Considerar a Resolução CD/ANPD nº 19/2024
               (cláusulas-padrão contratuais) e se os contratos dos operadores as incorporam. O texto fica como
               está até o parecer.] */}
          Como se vê acima, os dados são armazenados e processados{" "}
          <strong>fora do Brasil</strong>. A transferência ocorre com base no
          art. 33, VIII, da LGPD — necessária para a execução de procedimentos
          preliminares e para a prestação do serviço que você solicitou — e nas
          cláusulas contratuais dos próprios operadores. Se isso for
          inaceitável para você, não preencha os formulários e nos escreva
          diretamente por e-mail.
        </p>

        <h2>Por quanto tempo guardamos</h2>
        <ul>
          <li>
            <strong>Contato e projetos:</strong> enquanto durar a relação e pelo
            prazo necessário ao cumprimento de obrigações legais e à defesa em
            eventual processo.
          </li>
          <li>
            <strong>
              Cadastro, organização declarada, itens seguidos, avisos,
              preferências e registro de uso da área com cadastro:
            </strong>{" "}
            não há prazo automático de apagamento; esses dados ficam enquanto
            sua conta existir. A exceção são os avisos sobre itens seguidos,
            apagados quando completam 400 dias. A exclusão, a seu pedido, apaga
            todos esses dados, inclusive o histórico de uso; a organização
            declarada só é apagada se ninguém mais pertencer a ela.
          </li>
        </ul>
        <p>
          Você pode pedir a exclusão a qualquer momento, e ela é feita salvo
          quando a lei exigir a guarda.
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
          <li>revogação do consentimento;</li>
          <li>
            oposição a tratamento feito sem o seu consentimento, quando houver
            descumprimento da LGPD.
          </li>
        </ul>
        <p>
          {/* [REVISÃO JURÍDICA: encarregado (C4b, seção 2.5). Indicar o encarregado, ou registrar a dispensa
               de agente de tratamento de pequeno porte (Resolução CD/ANPD nº 2/2022), que exige um canal de
               comunicação com o titular. Até o parecer, o parágrafo só indica o e-mail.] */}
          Escreva para{" "}
          <a href="mailto:diretoria.ponte.projetos@gmail.com">
            diretoria.ponte.projetos@gmail.com
          </a>{" "}
          identificando-se e dizendo o que deseja. Respondemos no menor prazo
          possível e, em qualquer caso, dentro do prazo legal. Você também pode
          peticionar à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>

        <h2>Segurança</h2>
        <p>
          As áreas com cadastro têm controle de acesso no servidor, e o banco de
          dados aplica regras linha a linha: uma pessoa conectada só alcança os
          próprios registros e os da organização a que pertence. Os dados de
          outras pessoas e o registro de uso só são lidos pelo servidor do site.
          Nenhuma medida elimina completamente o risco, e se ocorrer incidente
          com risco relevante aos titulares, comunicaremos os afetados e a
          Autoridade Nacional de Proteção de Dados.
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

        <Link className="lg-voltar" href="/">
          ← Voltar ao site
        </Link>
      </div>

      <style>{estilosLegais}</style>
    </div>
  );
}
