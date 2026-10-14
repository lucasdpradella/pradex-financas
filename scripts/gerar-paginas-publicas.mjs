// Gera as páginas públicas estáticas de GEO/SEO em public/:
//   /precos, /perguntas-frequentes, /controle-de-gastos-pelo-whatsapp
//
// Por que HTML puro: o app é renderizado no navegador, e crawler de busca/IA
// (OAI-SearchBot, Googlebot sem JS) vê #root vazio. Estas páginas entregam o texto no
// HTML cru, com JSON-LD (SoftwareApplication, Organization, FAQPage).
//
// Preços e dias de trial saem de src/lib/plano.js — a mesma fonte do app. Mudou o
// preço lá? Rode `node scripts/gerar-paginas-publicas.mjs` e commite o HTML.
// tests/paginas-publicas.test.js falha se o HTML divergir de plano.js.
//
// Posicionamento: organização/controle de gastos. Não citar investimento, assessoria,
// recomendação financeira nem corretora/empresa de investimentos (política de anúncio).
// Não escreva comentário HTML no template: ele vai pro código-fonte público.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PRECO, DIAS_TRIAL } from "../src/lib/plano.js";
import { redesPreenchidas, ROTULO_REDE } from "../src/lib/redes.js";

const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));
const css = `    :root { color-scheme: dark; }
    body { background: #0C0E14; color: #F1F2F4; font-family: 'DM Sans', 'Helvetica Neue', system-ui, sans-serif; margin: 0; padding: 1.5rem 1.25rem 3rem; -webkit-font-smoothing: antialiased; }
    main { max-width: 760px; margin: 0 auto; }
    .topo { max-width: 760px; margin: 0 auto 2.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .topo .logo { font-size: 1rem; font-weight: 700; letter-spacing: 0.04em; color: #F1F2F4; text-decoration: none; }
    .topo nav a { font-size: 0.85rem; color: #8B93A1; text-decoration: none; margin-right: 1.1rem; }
    .topo nav a:last-child { margin-right: 0; }
    .topo nav a[aria-current="page"] { color: #F1F2F4; }
    .marca { font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; color: #8B93A1; margin: 0 0 0.5rem; }
    h1 { font-size: 1.85rem; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 0.75rem; line-height: 1.2; }
    .lead { font-size: 1rem; color: #8B93A1; line-height: 1.6; margin: 0 0 2.25rem; }
    h2 { font-size: 1.1rem; font-weight: 600; margin: 2.25rem 0 0.6rem; }
    h3 { font-size: 0.98rem; font-weight: 600; margin: 1.6rem 0 0.4rem; }
    p, li, td, th { font-size: 0.92rem; color: #C9CFDA; line-height: 1.65; }
    ul { padding-left: 1.15rem; }
    li { margin-bottom: 0.4rem; }
    a { color: #6366F1; }
    strong { color: #F1F2F4; }
    .exemplo { display: inline-block; background: #151821; border: 1px solid #2C3344; border-radius: 10px 10px 10px 2px; padding: 0.35rem 0.75rem; margin: 0.2rem 0.35rem 0.2rem 0; font-size: 0.88rem; color: #F1F2F4; }
    .caixa { border: 1px solid #2C3344; border-radius: 12px; padding: 0.4rem 1.1rem 0.8rem; background: #151821; margin: 1.25rem 0; }
    .planos { display: grid; gap: 1rem; grid-template-columns: 1fr; margin: 1.5rem 0; }
    @media (min-width: 720px) { .planos { grid-template-columns: repeat(3, 1fr); } }
    .plano { background: #151821; border: 1px solid #1E2330; border-radius: 16px; padding: 1.25rem 1.2rem; }
    .plano.destaque { border-color: #6366F1; box-shadow: 0 0 0 1px rgba(99,102,241,0.35), 0 18px 50px rgba(79,70,229,0.18); }
    .plano h2 { margin: 0 0 0.3rem; font-size: 1.15rem; }
    .plano .preco { font-size: 1.8rem; font-weight: 700; letter-spacing: -0.03em; color: #F1F2F4; margin: 0 0 0.25rem; }
    .plano .preco small { font-size: 0.9rem; font-weight: 600; color: #8B93A1; }
    .plano .linha { margin: 0 0 0.9rem; color: #8B93A1; font-size: 0.85rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid #1E2330; vertical-align: top; }
    th { color: #8B93A1; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .cta { display: inline-block; margin-top: 1.5rem; background: #6366F1; color: #fff; text-decoration: none; font-weight: 700; padding: 0.85rem 1.5rem; border-radius: 10px; }
    footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid #1E2330; font-size: 0.8rem; color: #8B93A1; line-height: 1.9; }
    footer a { margin-right: 1rem; color: #8B93A1; }
`;
const BASE = "https://pradex.com.br";
const num = (s) => s.replace("R$", "").trim().replace(".", "").replace(",", ".");
const ORG = {
  "@context": "https://schema.org", "@type": "Organization", "@id": `${BASE}/#organizacao`,
  name: "Pradex Finanças", alternateName: "PRADEX", url: `${BASE}/`, logo: `${BASE}/icon-512.png`,
  email: "pradex.financas@gmail.com",
  // Instagram/TikTok oficiais: preencher em src/lib/redes.js (vazio até o Lucas mandar os @).
  sameAs: redesPreenchidas().map(([, url]) => url),
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "pradex.financas@gmail.com", availableLanguage: ["pt-BR", "en"] },
};
const APP = {
  "@context": "https://schema.org", "@type": "SoftwareApplication", "@id": `${BASE}/#app`,
  name: "Pradex Finanças", applicationCategory: "FinanceApplication", applicationSubCategory: "Controle de gastos e orçamento pessoal",
  operatingSystem: "Web, WhatsApp", inLanguage: "pt-BR", url: `${BASE}/`,
  description: "App de organização e controle de gastos pessoais: registre gastos e receitas no app ou por mensagem no WhatsApp (texto ou áudio), acompanhe cartões, faturas, parcelas, teto por categoria e caixinhas de metas.",
  publisher: { "@id": `${BASE}/#organizacao` },
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "BRL", url: `${BASE}/precos` },
    { "@type": "Offer", name: "Essencial", price: num(PRECO.essencial), priceCurrency: "BRL", url: `${BASE}/precos`,
      priceSpecification: { "@type": "UnitPriceSpecification", price: num(PRECO.essencial), priceCurrency: "BRL", unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } } },
    { "@type": "Offer", name: "Assistente", price: num(PRECO.assistente), priceCurrency: "BRL", url: `${BASE}/precos`,
      priceSpecification: { "@type": "UnitPriceSpecification", price: num(PRECO.assistente), priceCurrency: "BRL", unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } } },
  ],
};
const ld = (o) => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2).replace(/^/gm, "  ")}\n  </script>`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const NAV = [["/precos", "Preços"], ["/controle-de-gastos-pelo-whatsapp", "Pelo WhatsApp"], ["/perguntas-frequentes", "Perguntas frequentes"]];
function page({ path, title, desc, ogTitle, jsonld, body }) {
  const url = `${BASE}${path}`;
  const nav = NAV.map(([h, t]) => `<a href="${h}"${h === path ? ' aria-current="page"' : ""}>${t}</a>`).join("\n      ");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${url}" />
  <meta name="theme-color" content="#0C0E14" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Pradex Finanças" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:title" content="${esc(ogTitle || title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${BASE}/icon-512.png" />
  <meta name="twitter:card" content="summary" />

  <link rel="icon" href="/icon-192.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" />

  <style>
${css}  </style>

${jsonld.map(ld).join("\n")}
</head>
<body>
  <header class="topo">
    <a class="logo" href="/">PRADEX</a>
    <nav aria-label="Páginas">
      ${nav}
    </nav>
  </header>
<main>
${body.trim()}

  <footer>
    <a href="/">Início</a>
    <a href="/precos">Preços</a>
    <a href="/controle-de-gastos-pelo-whatsapp">Controle de gastos pelo WhatsApp</a>
    <a href="/perguntas-frequentes">Perguntas frequentes</a>
    <a href="/guia">Guia de uso</a>
    <a href="/sobre">Sobre</a>
    <a href="/privacidade">Privacidade</a>
    <a href="/excluir-conta">Excluir conta</a>${redesPreenchidas().map(([rede, url]) => `\n    <a href="${url}" rel="me noopener">${ROTULO_REDE[rede]}</a>`).join("")}<br />
    Pradex Finanças — app de organização e controle de gastos pessoais. pradex.com.br
  </footer>
</main>
</body>
</html>
`;
}

// ===================== PREÇOS =====================
const precos = page({
  path: "/precos",
  title: "Preços do Pradex — Free, Essencial e Assistente",
  ogTitle: "Pradex Finanças — planos e preços",
  desc: `Planos do Pradex Finanças: Free (R$ 0, lançamentos ilimitados), Essencial (${PRECO.essencial}/mês, lançamento de gastos pelo WhatsApp e teto por categoria) e Assistente (${PRECO.assistente}/mês). Teste de ${DIAS_TRIAL} dias do WhatsApp sem cartão.`,
  jsonld: [ORG, APP],
  body: `
  <p class="marca">Pradex Finanças · Preços</p>
  <h1>Planos e preços do Pradex</h1>
  <p class="lead">
    Registrar, organizar e acompanhar os seus gastos é grátis, sem limite de lançamentos e sem prazo.
    Os planos pagos acrescentam o lançamento pelo WhatsApp e outras ferramentas. Mensal, cancela quando quiser.
  </p>

  <div class="planos">
    <section class="plano">
      <h2>Free</h2>
      <p class="preco">R$ 0</p>
      <p class="linha">Para começar a se organizar</p>
      <ul>
        <li>Gastos e receitas ilimitados</li>
        <li>Cartões de crédito, faturas e compras parceladas</li>
        <li>Histórico mês a mês e dashboard</li>
        <li>Score de disciplina</li>
        <li>1 caixinha de meta</li>
      </ul>
    </section>
    <section class="plano destaque">
      <h2>Essencial</h2>
      <p class="preco">${PRECO.essencial}<small>/mês</small></p>
      <p class="linha">Para o dia a dia</p>
      <ul>
        <li>Tudo do Free</li>
        <li>Lançar gastos pelo WhatsApp, por texto ou áudio</li>
        <li>Teto de gasto por categoria</li>
        <li>Caixinhas de meta ilimitadas</li>
      </ul>
    </section>
    <section class="plano">
      <h2>Assistente</h2>
      <p class="preco">${PRECO.assistente}<small>/mês</small></p>
      <p class="linha">Para enxergar o quadro completo</p>
      <ul>
        <li>Tudo do Essencial</li>
        <li>Projeções do seu dinheiro: perfil, rendas e objetivos, com diagnóstico do orçamento</li>
        <li>Relatórios (em breve, no mesmo plano)</li>
      </ul>
    </section>
  </div>

  <h2>Teste grátis de ${DIAS_TRIAL} dias</h2>
  <p>
    Quem está no Free pode testar o lançamento pelo WhatsApp e o teto por categoria por ${DIAS_TRIAL} dias,
    sem cartão e sem cobrança automática. O teste começa quando você toca em "Testar ${DIAS_TRIAL} dias grátis"
    dentro do app. Terminado o teste, o app continua funcionando no Free.
  </p>

  <h2>Perguntas rápidas sobre preço</h2>
  <h3>Preciso de cartão para criar conta?</h3>
  <p>Não. A conta é criada com nome, e-mail, senha, data de nascimento e WhatsApp, e o plano Free não tem cobrança.</p>
  <h3>O que acontece se eu cancelar?</h3>
  <p>Seus lançamentos continuam na sua conta. Saem só os recursos pagos, e o app volta para o Free.</p>
  <h3>Como é feito o pagamento?</h3>
  <p>A assinatura é mensal e processada pela Cakto, plataforma de pagamentos. O Pradex não guarda dados de cartão.</p>
  <h3>O Pradex se conecta ao meu banco?</h3>
  <p>Não. Ele não pede senha de banco, não acessa conta bancária e não lê cartão. Você registra o que quiser, do jeito que quiser.</p>

  <p>Mais dúvidas em <a href="/perguntas-frequentes">perguntas frequentes</a>.</p>
  <a class="cta" href="/">Começar grátis</a>
`,
});

// ===================== FAQ =====================
const FAQ = [
  ["O que é o Pradex?",
   `O Pradex Finanças é um app de organização e controle de gastos pessoais. Você registra gastos e receitas no app ou mandando mensagem no WhatsApp, e acompanha para onde o dinheiro vai: por categoria, por cartão, por mês. Funciona no navegador do celular e do computador, e pode ser instalado na tela inicial como app.`],
  ["Como funciona o registro de gastos pelo WhatsApp?",
   `Você cadastra o seu número de WhatsApp na conta e manda a mensagem para o número do Pradex (<a href="https://wa.me/5511924568633">wa.me/5511924568633</a>) do jeito que falaria com alguém: "gastei 50 no almoço no crédito Nubank", "uber 23 no pix", "recebi 1800 de salário". Pode ser texto ou áudio. O agente identifica valor, categoria e forma de pagamento e grava o lançamento na sua conta, que aparece no app na mesma hora. Se ficar em dúvida (por exemplo, qual cartão), ele pergunta antes de gravar. O WhatsApp faz parte do plano Essencial e pode ser testado por ${DIAS_TRIAL} dias grátis.`],
  ["Qual a diferença entre gasto no crédito e no débito?",
   `Débito, PIX e dinheiro saem do saldo do mês na hora. Gasto no crédito vai para a fatura do cartão escolhido. Quando você paga a fatura, o Pradex não conta esse pagamento como gasto novo: as compras já foram contadas quando você as fez, então o mês não fica em dobro.`],
  ["O Pradex separa as faturas por cartão?",
   `Sim. Você cadastra cada cartão com o dia de fechamento e o dia de vencimento, e cada compra no crédito é ligada ao cartão certo. A tela inicial mostra a fatura aberta de cada cartão. Compras feitas depois do fechamento caem na fatura seguinte, e compras parceladas aparecem já distribuídas pelos próximos meses, com a indicação da parcela (1/10, 2/10...).`],
  ["Como funcionam as metas (caixinhas)?",
   `Uma caixinha é um objetivo de quanto você quer juntar, com prazo opcional, como "Viagem: R$ 5.000". Toda vez que guardar dinheiro, você registra em "Guardei"; se precisar tirar, registra em "Tirei". O valor guardado sai do saldo do mês, mas não conta como gasto: aparece numa linha própria. No Free você tem 1 caixinha ativa; no Essencial, quantas quiser. O Pradex não movimenta dinheiro nem consulta banco: a caixinha é o seu registro.`],
  ["Dá para um casal usar o mesmo controle?",
   `Sim. No Pradex os lançamentos ficam num "livro", e um livro pode ter duas pessoas: as duas veem e registram nos mesmos gastos, cartões e metas, cada uma com o próprio login. Hoje o vínculo do casal no mesmo livro é feito pelo suporte, a pedido: escreva para <a href="mailto:pradex.financas@gmail.com">pradex.financas@gmail.com</a>.`],
  ["Quais moedas e idiomas o Pradex aceita?",
   `Cada livro pode usar real (BRL), dólar americano (USD) ou coroa dinamarquesa (DKK), e o app pode ficar em português ou inglês. Os valores aparecem na moeda escolhida; o Pradex não faz conversão de câmbio.`],
  ["Onde ficam meus dados? É seguro?",
   `Os dados ficam na sua conta, num banco de dados em servidor, não no navegador: trocar de celular ou limpar o histórico não apaga nada. O acesso é isolado por usuário no próprio banco (Row Level Security), e tudo trafega por conexão criptografada (HTTPS). O Pradex não pede senha de banco e não vende nem compartilha seus dados para publicidade. Os detalhes, incluindo os serviços usados para operar o app, estão na <a href="/privacidade">Política de Privacidade</a>.`],
  ["Posso apagar minha conta e meus dados?",
   `Sim, a qualquer momento e sem falar com ninguém, pela página <a href="/excluir-conta">Excluir conta</a>. Pedidos de acesso, correção ou portabilidade dos dados (LGPD) podem ser feitos pelo e-mail indicado na Política de Privacidade.`],
  ["Como cancelo a assinatura?",
   `A assinatura é mensal e pode ser cancelada quando você quiser. Ao cancelar, seus lançamentos continuam na conta; saem apenas os recursos pagos, e o app volta para o plano Free. Veja os <a href="/precos">preços e planos</a>.`],
  ["Preciso conectar minha conta bancária?",
   `Não. O Pradex não tem integração bancária, não pede senha de banco e não lê cartão. Os lançamentos são registrados por você, no app ou pelo WhatsApp.`],
];
const strip = (h) => h.replace(/<[^>]+>/g, "");
const FAQLD = {
  "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: strip(a) } })),
};
const faq = page({
  path: "/perguntas-frequentes",
  title: "Perguntas frequentes — Pradex Finanças",
  ogTitle: "Pradex Finanças — perguntas frequentes",
  desc: "Como registrar gastos pelo WhatsApp, crédito x débito, faturas por cartão, caixinhas de metas, uso em casal, moedas, segurança dos dados e cancelamento no Pradex Finanças.",
  jsonld: [ORG, FAQLD],
  body: `
  <p class="marca">Pradex Finanças · Perguntas frequentes</p>
  <h1>Perguntas frequentes</h1>
  <p class="lead">O que as pessoas mais perguntam sobre o Pradex, app de controle de gastos com registro pelo WhatsApp.</p>
${FAQ.map(([q, a]) => `
  <h2>${q}</h2>
  <p>${a}</p>`).join("\n")}

  <p style="margin-top:2rem">Tem outra dúvida? Escreva para <a href="mailto:pradex.financas@gmail.com">pradex.financas@gmail.com</a>.</p>
  <a class="cta" href="/">Começar grátis</a>
`,
});

// ===================== WHATSAPP =====================
const zap = page({
  path: "/controle-de-gastos-pelo-whatsapp",
  title: "Controle de gastos pelo WhatsApp — Pradex Finanças",
  ogTitle: "Controle de gastos pelo WhatsApp com o Pradex",
  desc: `Anote gastos mandando mensagem no WhatsApp: "gastei 50 no almoço no crédito". O Pradex registra valor, categoria, cartão e fatura automaticamente, por texto ou áudio. Teste ${DIAS_TRIAL} dias grátis.`,
  jsonld: [ORG, APP],
  body: `
  <p class="marca">Pradex Finanças · Controle de gastos pelo WhatsApp</p>
  <h1>Controle de gastos pelo WhatsApp: mandou a mensagem, está anotado.</h1>
  <p class="lead">
    O difícil de controlar gastos em planilha ou app é lembrar de abrir. Com o Pradex você anota o gasto
    onde já conversa o dia inteiro: no WhatsApp. Uma mensagem, por texto ou áudio, e o
    lançamento cai na sua conta já categorizado.
  </p>

  <h2>Exemplos de mensagens</h2>
  <p>
    <span class="exemplo">gastei 50 no almoço no crédito Nubank</span>
    <span class="exemplo">mercado 230 no débito</span>
    <span class="exemplo">uber 23 no pix</span>
    <span class="exemplo">tênis 600 em 3x no cartão</span>
    <span class="exemplo">recebi 1800 de salário</span>
    <span class="exemplo">paguei a fatura do cartão</span>
  </p>

  <table>
    <tr><th>Você manda</th><th>O Pradex registra</th></tr>
    <tr><td>"gastei 50 no almoço no crédito Nubank"</td><td>Gasto de R$ 50, categoria Alimentação, crédito no cartão Nubank, na fatura certa conforme o dia de fechamento</td></tr>
    <tr><td>"mercado 230 no débito"</td><td>Gasto de R$ 230 no débito, que sai do saldo do mês na hora</td></tr>
    <tr><td>"recebi 1800 de salário"</td><td>Receita de R$ 1.800</td></tr>
    <tr><td>"paguei a fatura do cartão"</td><td>Pagamento de fatura, que abate a fatura sem contar as compras de novo</td></tr>
  </table>

  <h2>Como funciona</h2>
  <ul>
    <li><strong>Crie a conta grátis</strong> em pradex.com.br e informe o seu WhatsApp. É por esse número que o agente reconhece você.</li>
    <li><strong>Mande a mensagem</strong> para <a href="https://wa.me/5511924568633">wa.me/5511924568633</a>, escrita ou falada, do jeito que você falaria com alguém.</li>
    <li><strong>O agente entende</strong> valor, categoria, forma de pagamento (crédito, débito, PIX ou dinheiro) e qual cartão. Se ficar em dúvida, pergunta antes de gravar.</li>
    <li><strong>Aparece no app na mesma hora</strong>: é o mesmo lançamento, não uma cópia. Errou a categoria? Edite no app ou responda ao agente.</li>
  </ul>

  <h2>O que você acompanha no app</h2>
  <ul>
    <li><strong>Para onde o dinheiro foi</strong>, por categoria e por mês.</li>
    <li><strong>Fatura de cada cartão</strong>, com as compras parceladas dos próximos meses já projetadas.</li>
    <li><strong>Teto por categoria</strong>: você define o limite e vê quanto já usou antes do fim do mês.</li>
    <li><strong>Caixinhas de metas</strong> para o que você quer juntar.</li>
    <li><strong>Score de disciplina</strong>, que pontua o hábito de registrar e de cumprir o próprio teto, nunca o tamanho da renda.</li>
  </ul>

  <div class="caixa">
    <h2 style="margin-top:0.8rem">Quanto custa</h2>
    <p>
      Registrar pelo app é grátis, sem limite de lançamentos. O registro pelo WhatsApp faz parte do plano
      Essencial, ${PRECO.essencial} por mês, e pode ser testado por ${DIAS_TRIAL} dias sem cartão e sem cobrança automática.
      Veja <a href="/precos">todos os planos</a>.
    </p>
  </div>

  <h2>Privacidade</h2>
  <p>
    O Pradex não se conecta ao seu banco e não pede senha de banco. Os lançamentos ficam na sua conta, com
    acesso isolado por usuário, e as mensagens enviadas ao número do Pradex são usadas só para registrar os
    seus lançamentos. Detalhes na <a href="/privacidade">Política de Privacidade</a>.
  </p>

  <p>Mais dúvidas em <a href="/perguntas-frequentes">perguntas frequentes</a> ou no <a href="/guia">guia de uso</a>.</p>
  <a class="cta" href="/">Começar grátis</a>
`,
});

fs.writeFileSync(PUBLIC + "precos.html", precos);
fs.writeFileSync(PUBLIC + "perguntas-frequentes.html", faq);
fs.writeFileSync(PUBLIC + "controle-de-gastos-pelo-whatsapp.html", zap);
console.log("ok");
