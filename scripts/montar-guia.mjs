// Leva o manual do vault para public/guia.html do site.
//
// O manual é a fonte; esta versão do site muda só o que precisa mudar pra viver numa
// URL pública: meta tags de SEO/compartilhamento, imagens apontando pro webp
// otimizado, e o rodapé com os links das outras páginas.
import fs from "node:fs";

const ORIGEM = "C:/Users/lucas/OneDrive/Área de Trabalho/Chave Mestre/Projetos/PRADEX/manual/index.html";
const DESTINO = "C:/Dev/pradex-financas/public/guia.html";

let html = fs.readFileSync(ORIGEM, "utf8");

// 1. Imagens: img/x.png (local, pesado) -> /guia/x.webp (servido, otimizado)
html = html.replace(/src="img\/([a-z]+)\.png"/g, 'src="/guia/$1.webp"');

// 2. Meta tags. O manual local não precisa; a página pública precisa — é ela que o
//    cliente recebe por WhatsApp, e sem og: o link chega sem prévia nenhuma.
const metas = `<meta name="description" content="Manual do Pradex Finanças: como lançar gastos no app e pelo WhatsApp, usar cartões e parcelas, definir teto por categoria, criar metas e entender o score de disciplina. Com print de cada tela." />
<link rel="canonical" href="https://pradex.com.br/guia" />

<meta property="og:type" content="article" />
<meta property="og:site_name" content="Pradex Finanças" />
<meta property="og:title" content="Como usar o Pradex em 10 minutos" />
<meta property="og:description" content="Do primeiro gasto anotado à sua primeira meta batida. Com print de cada tela e onde clicar." />
<meta property="og:url" content="https://pradex.com.br/guia" />
<meta property="og:image" content="https://pradex.com.br/icon-512.png" />
<meta name="twitter:card" content="summary" />
<meta name="theme-color" content="#0C0E14" />
`;
html = html.replace("<title>Manual do Pradex</title>", `<title>Como usar o Pradex — manual completo</title>\n${metas}`);

// 3. Rodapé: no site, as outras páginas existem e devem ser alcançáveis daqui.
html = html.replace(
  /(Feito por Lucas D'Angelo Pradella[\s\S]*?rentabilidade\.)/,
  `$1<br /><br />
  <a href="/">Início</a> ·
  <a href="/sobre">Sobre</a> ·
  <a href="/privacidade">Privacidade</a> ·
  <a href="/excluir-conta">Excluir conta</a>`,
);

// 4. Aviso pra quem for editar: a partir daqui existem DUAS cópias, e elas divergem
//    no dia em que alguém mexer numa só.
html = html.replace(
  "  MANUAL DO PRADEX — v2, 18/09/2026.",
  `  MANUAL DO PRADEX — v2, 18/09/2026. ESTA É A CÓPIA PUBLICADA (pradex.com.br/guia).

  ⚠️ A FONTE é Chave Mestre/Projetos/PRADEX/manual/index.html. Editar aqui e não lá
  faz as duas divergirem — e é a de lá que alguém vai abrir da próxima vez. Mexa na
  fonte e regere esta com scripts/montar-guia.mjs.`,
);

fs.writeFileSync(DESTINO, html, "utf8");
console.log(`guia.html gerado: ${(html.length / 1024).toFixed(0)} KB`);
console.log("imagens apontando pro webp:", (html.match(/\/guia\/[a-z]+\.webp/g) || []).length);
