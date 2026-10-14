# 2026-10-04 — GEO: páginas públicas estáticas e fim dos comentários no código-fonte

## O que mudou
- Páginas novas em HTML puro (sem JS), geradas por `scripts/gerar-paginas-publicas.mjs`:
  `/precos`, `/perguntas-frequentes`, `/controle-de-gastos-pelo-whatsapp`.
  JSON-LD: SoftwareApplication (FinanceApplication, ofertas com preço real), Organization, FAQPage.
- Preços saem de `src/lib/plano.js` (`PRECO`, `DIAS_TRIAL`). `tests/paginas-publicas.test.js`
  quebra se o HTML divergir ou se aparecer preço que não existe em `plano.js`.
- Plano Casal (PR #99) NÃO entrou: não está na main nem no site. Quando for mergeado,
  acrescentar no gerador e no teste.
- `robots.txt` libera explicitamente OAI-SearchBot, GPTBot, ChatGPT-User, Googlebot e Bingbot;
  `sitemap.xml` com as rotas novas; `vercel.json` com rewrites explícitos;
  `navigateFallbackDenylist` do service worker com as rotas novas (sem isso o SW serve o app no lugar do HTML).
- Links pras páginas novas no rodapé/nav da Landing, no conteúdo sem-JS do `index.html`, na `/sobre` e na `/guia`.

## Comentários removidos do HTML público
`index.html`, `public/sobre.html` e `public/guia.html` tinham comentários HTML que qualquer um (e
qualquer crawler) lia no "ver código-fonte" — inclusive o relato de que a IA de busca do Google
descreveu o Pradex como "projeto de portfólio". O contexto que eles guardavam fica aqui:

- **Meta tags / conteúdo sem JS do `index.html`**: o app vive atrás do login; crawler não faz login
  nem executa JS, então vê `#root` vazio. O bloco dentro de `#root` é substituído pelo React ao montar
  (usuário não vê), e precisa ficar em sincronia com `components/Landing.jsx` quando a promessa mudar.
- **Fonte DM Sans**: o app pede DM Sans mas a fonte nunca era carregada; o `<link>` do Google Fonts
  usa os pesos 400/500/600/700, os que o código usa.
- **Estilo do `<body>`**: evita fundo branco em overscroll no iOS; acima de 1024px o fundo é claro
  (mesmo valor de `desktopTheme.mainBg`) pra não piscar escuro antes do React montar.
- **`/guia`**: a fonte é o manual no vault; regere com `scripts/montar-guia.mjs`, que agora remove
  os comentários HTML antes de gravar `public/guia.html`.

Regra: nota interna vai em comentário de JS/JSX (some no build) ou em `docs/`, nunca em comentário HTML.

## Adendo (aprovado pelo Lucas em 04/10/2026)
- O site público não liga o Pradex a "assessor de investimentos", Nobel/Nobel Capital ou XP:
  removido da home (Landing e conteúdo sem JS do `index.html`), `/sobre` (texto, meta e JSON-LD:
  sem `jobTitle`/`worksFor`), `/guia` (rodapé; `montar-guia.mjs` troca e falha se sobrar) e manifest do PWA.
  O aviso "não faz recomendação de investimento" virou "organização e controle de gastos: não
  movimenta dinheiro e não acessa conta bancária".
- Público: "planejamento de aposentadoria"/"Planejamento Financeiro" → "Projeções do seu dinheiro".
  Relatórios aparecem como "(em breve)". O nome do menu dentro do app (Planejamento) não mudou.
- Redes: `src/lib/redes.js` (vazio). Preenchido, aparece no rodapé da Landing e das páginas
  geradas e no `sameAs` do Organization (rode `node scripts/gerar-paginas-publicas.mjs`).
  A `/sobre` tem `"sameAs": []` à mão — atualizar junto.
- Não mexido: `/privacidade` e `/excluir-conta` (documentos legais, ainda dizem "planejamento
  financeiro" e listam "investimentos" entre os dados coletados).
