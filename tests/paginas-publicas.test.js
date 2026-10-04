// Páginas públicas em HTML puro (GEO/SEO). Crawler de IA (OAI-SearchBot) e o Google
// nem sempre executam JS, então o texto tem que estar no HTML cru — e tem que bater
// com o que o app cobra de verdade.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PRECO, DIAS_TRIAL } from "../src/lib/plano.js";
import { REDES } from "../src/lib/redes.js";

const raiz = path.resolve(__dirname, "..");
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), "utf8");

const PAGINAS = {
  "/precos": "public/precos.html",
  "/perguntas-frequentes": "public/perguntas-frequentes.html",
  "/controle-de-gastos-pelo-whatsapp": "public/controle-de-gastos-pelo-whatsapp.html",
};

const jsonLd = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

// Posicionamento: organização/controle de gastos. Nada que soe como assessoria ou
// planejamento de investimento (política de anúncio de serviços financeiros).
const PROIBIDO = [/nobel/i, /\bXP\b/, /investiment/i, /assessor/i, /recomenda/i, /rentabilidade/i, /portf[oó]lio/i];

describe("páginas públicas estáticas", () => {
  for (const [rota, arquivo] of Object.entries(PAGINAS)) {
    describe(rota, () => {
      const html = ler(arquivo);

      it("tem title, description, canonical e Open Graph próprios", () => {
        expect(html).toMatch(/<title>[^<]{10,}<\/title>/);
        expect(html).toMatch(/<meta name="description" content="[^"]{50,}"/);
        expect(html).toContain(`<link rel="canonical" href="https://pradex.com.br${rota}" />`);
        expect(html).toContain(`<meta property="og:url" content="https://pradex.com.br${rota}" />`);
        expect(html).toMatch(/<meta property="og:title"/);
      });

      it("não tem comentário HTML nem termo fora do posicionamento", () => {
        expect(html).not.toContain("<!--");
        for (const re of PROIBIDO) expect(html).not.toMatch(re);
      });

      it("JSON-LD válido com Organization", () => {
        const blocos = jsonLd(html);
        expect(blocos.some((b) => b["@type"] === "Organization")).toBe(true);
      });

      it("tem texto real no HTML (não depende de JS)", () => {
        expect(html).toMatch(/<h1>[^<]{10,}<\/h1>/);
        expect(html).not.toContain('<div id="root">');
      });
    });
  }

  it("/precos lista os preços de lib/plano.js (e só eles)", () => {
    const html = ler(PAGINAS["/precos"]);
    expect(html).toContain(PRECO.essencial);
    expect(html).toContain(PRECO.assistente);
    expect(html).toContain("R$ 0");
    expect(html).toContain(`${DIAS_TRIAL} dias`);
    const precosNaPagina = new Set(html.match(/R\$ \d+(?:,\d{2})?/g));
    const conhecidos = new Set(["R$ 0", PRECO.essencial, PRECO.assistente]);
    for (const p of precosNaPagina) expect(conhecidos.has(p)).toBe(true);

    const app = jsonLd(html).find((b) => b["@type"] === "SoftwareApplication");
    expect(app.applicationCategory).toBe("FinanceApplication");
    const preco = (s) => s.replace("R$", "").trim().replace(",", ".");
    expect(app.offers.map((o) => o.price)).toEqual(["0", preco(PRECO.essencial), preco(PRECO.assistente)]);
  });

  it("/perguntas-frequentes tem FAQPage com as mesmas perguntas do HTML", () => {
    const html = ler(PAGINAS["/perguntas-frequentes"]);
    const faq = jsonLd(html).find((b) => b["@type"] === "FAQPage");
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(8);
    for (const q of faq.mainEntity) expect(html).toContain(`<h2>${q.name}</h2>`);
  });

  it("index.html e sobre.html não expõem notas internas", () => {
    for (const arq of ["index.html", "public/sobre.html", "public/guia.html"]) {
      const html = ler(arq);
      expect(html).not.toContain("<!--");
      expect(html).not.toMatch(/portf[oó]lio/i);
    }
  });

  it("sitemap e robots cobrem as rotas novas", () => {
    const sitemap = ler("public/sitemap.xml");
    const robots = ler("public/robots.txt");
    for (const rota of Object.keys(PAGINAS)) expect(sitemap).toContain(`<loc>https://pradex.com.br${rota}</loc>`);
    expect(robots).toContain("Sitemap: https://pradex.com.br/sitemap.xml");
    expect(robots).not.toMatch(/^Disallow: \/\s*$/m);
    for (const bot of ["OAI-SearchBot", "GPTBot", "Googlebot"]) expect(robots).toContain(`User-agent: ${bot}`);
  });

  it("vercel.json reescreve as rotas pro HTML estático", () => {
    const vercel = JSON.parse(ler("vercel.json"));
    for (const [rota, arquivo] of Object.entries(PAGINAS)) {
      expect(vercel.rewrites).toContainEqual({ source: rota, destination: arquivo.replace("public", "") });
    }
  });

  // Decisão do Lucas (04/10/2026): o site público não liga o Pradex ao emprego dele.
  // XP como exemplo de cartão também fica fora das páginas públicas.
  describe("site público sem vínculo com assessoria/Nobel/XP", () => {
    const VINCULO = [/nobel/i, /assessor/i, /\bXP\b/, /planejamento de aposentadoria/i, /planejamento financeiro/i];
    const PUBLICOS = [
      "index.html",
      "public/sobre.html",
      "public/guia.html",
      "src/components/Landing.jsx",
      ...Object.values(PAGINAS),
    ];
    for (const arq of PUBLICOS) {
      it(arq, () => {
        let conteudo = ler(arq);
        // Comentário de JSX/JS some no build; o que importa é o que vai pra tela.
        if (arq.endsWith(".jsx")) conteudo = conteudo.replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
        for (const re of VINCULO) expect(conteudo).not.toMatch(re);
      });
    }

    it("JSON-LD da /sobre não tem worksFor/jobTitle", () => {
      const blocos = jsonLd(ler("public/sobre.html"));
      const texto = JSON.stringify(blocos);
      expect(texto).not.toMatch(/worksFor|jobTitle/);
    });
  });

  it("sameAs do Organization vem de lib/redes.js (sem handle inventado)", () => {
    const esperados = Object.values(REDES).filter(Boolean);
    for (const arquivo of Object.values(PAGINAS)) {
      const org = jsonLd(ler(arquivo)).find((b) => b["@type"] === "Organization");
      expect(org.sameAs).toEqual(esperados);
    }
  });
});
