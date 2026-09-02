import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

/**
 * Página pública do HUB Bananeiras — com interruptor de oferta.
 *
 * COMO LIGAR E DESLIGAR
 * Variável de ambiente na Vercel:
 *
 *     HUB_OFERTA = ativa      → serve a proposta
 *     HUB_OFERTA = (qualquer  → serve o aviso de suspensão
 *                   outra coisa, ou ausente)
 *
 * Depois de alterar a variável é preciso um Redeploy para ela valer.
 * Settings › Environment Variables › editar › Save, e então
 * Deployments › o último › ⋯ › Redeploy.
 *
 * POR QUE O PADRÃO É SUSPENSA
 * Se a variável sumir, se alguém errar o nome, ou se um ambiente novo for
 * criado sem ela, o resultado é a oferta fechada. O contrário — abrir por
 * omissão — publicaria uma proposta comercial por acidente.
 *
 * POR QUE O HTML NÃO MORA MAIS EM public/
 * Em public/, o arquivo continuaria acessível pelo endereço direto
 * /hub-bananeiras.html, e qualquer pessoa com esse link contornaria a
 * suspensão inteira. Servido daqui, a única porta é esta função.
 */

export const dynamic = "force-dynamic";

const EMAIL = "diretoria.ponte.projetos@gmail.com";

function paginaSuspensa(): string {
  const assunto = encodeURIComponent("Reativar oferta — HUB Bananeiras");
  const corpo = encodeURIComponent(
    "Olá,\n\nGostaria de reativar o acesso à proposta do HUB Bananeiras.\n\n" +
      "Nome:\nInstituição:\n\n"
  );

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Oferta suspensa — HUB Bananeiras | PONTE</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@1,6..72,500;1,6..72,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    min-height:100dvh; background:#070a0d; color:#eceff2;
    font-family:"Plus Jakarta Sans",-apple-system,"Segoe UI",sans-serif;
    display:flex; align-items:center; justify-content:center;
    padding:40px 20px; line-height:1.6;
  }
  .wrap{width:100%; max-width:520px}
  .marca{
    font-family:ui-monospace,"JetBrains Mono",monospace;
    font-size:11px; letter-spacing:.16em; text-transform:uppercase;
    color:#c59b27; margin-bottom:16px;
  }
  h1{
    font-family:"Newsreader",Georgia,serif; font-style:italic; font-weight:600;
    font-size:34px; line-height:1.15; letter-spacing:-.01em;
    margin:0 0 14px; color:#fff;
  }
  p{font-size:15.5px; color:#87a0b4; margin:0 0 16px}
  .card{
    background:#0f151b; border:1px solid #3a4a59; border-radius:10px;
    padding:24px; margin-top:28px;
  }
  .card h2{
    font-size:12px; font-weight:600; letter-spacing:.09em;
    text-transform:uppercase; color:#87a0b4; margin:0 0 12px;
  }
  .btn{
    display:inline-block; margin-top:6px; padding:12px 22px;
    background:#c59b27; color:#070a0d; border-radius:7px;
    font-weight:700; font-size:15px; text-decoration:none;
    transition:background 140ms ease;
  }
  .btn:hover{background:#e4be57}
  .btn:focus-visible{outline:2px solid #e4be57; outline-offset:2px}
  .email{
    display:block; margin-top:14px; font-size:14px; color:#c59b27;
    text-decoration:none; word-break:break-all;
  }
  .email:hover{text-decoration:underline}
  .rodape{
    margin-top:30px; font-size:13px; color:#67849d;
  }
  .rodape a{color:#87a0b4}
  @media(max-width:520px){h1{font-size:27px}}
</style>
</head>
<body>
  <main class="wrap">
    <div class="marca">PONTE &times; HUB BANANEIRAS</div>
    <h1>Esta oferta está suspensa no momento.</h1>
    <p>
      A proposta do HUB Bananeiras não está disponível para consulta pública
      neste momento. Isso não significa que ela deixou de existir — apenas que
      o acesso foi fechado temporariamente.
    </p>

    <div class="card">
      <h2>Para reativar</h2>
      <p style="margin-bottom:18px">
        Escreva para a diretoria da PONTE informando seu nome e instituição.
        Reativamos o acesso e respondemos com o endereço.
      </p>
      <a class="btn" href="mailto:${EMAIL}?subject=${assunto}&amp;body=${corpo}">
        Enviar e-mail para reativar
      </a>
      <a class="email" href="mailto:${EMAIL}">${EMAIL}</a>
    </div>

    <p class="rodape">
      Se você já é instituidor e procura o Workspace,
      <a href="/hub-bananeiras/login">entre por aqui</a>.
      &nbsp;·&nbsp;
      <a href="/">Site da PONTE</a>
    </p>
  </main>
</body>
</html>`;
}

export async function GET() {
  const ativa = (process.env.HUB_OFERTA || "").trim().toLowerCase() === "ativa";

  if (!ativa) {
    return new NextResponse(paginaSuspensa(), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  try {
    const arquivo = path.join(process.cwd(), "src", "conteudo", "hub-bananeiras.html");
    const html = await fs.readFile(arquivo, "utf-8");
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    // Arquivo ausente com a oferta ligada: cai para o aviso de suspensão em
    // vez de estourar 500. Um erro de servidor numa página de proposta é pior
    // do que um aviso — sugere descuido a quem está avaliando uma parceria.
    return new NextResponse(paginaSuspensa(), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
}
