import { describe, it, expect } from "vitest";
import {
  PLANOS,
  CHECKOUT,
  RECURSOS,
  normalizePlano,
  planoNecessario,
  temAcesso,
  mostraCadeado,
  paywallNoSave,
  podeUsarRecurso,
  mostraPreviaBorrada,
  checkoutPara,
  conteudoUpgrade,
  planoDaUrl,
  PRECO,
  checkoutComEmail,
  ROTULO,
  nivelPlano,
} from "../src/lib/plano";

describe("normalizePlano", () => {
  it("aceita os quatro planos válidos", () => {
    for (const p of PLANOS) expect(normalizePlano(p)).toBe(p);
  });

  // O default fechado é o que impede acesso de graça quando o fetch do perfil falha
  // ou a linha ainda não existe.
  it("cai em none pra valor ausente, nulo ou desconhecido", () => {
    expect(normalizePlano(undefined)).toBe("none");
    expect(normalizePlano(null)).toBe("none");
    expect(normalizePlano("")).toBe("none");
    expect(normalizePlano("premium")).toBe("none");
    expect(normalizePlano("ASSISTENTE")).toBe("none");
  });
});

describe("temAcesso — a matriz de planos", () => {
  // A tabela é a especificação: free tem o core inteiro, paga-se pelo Zap (Essencial)
  // e por FP/Relatórios (Assistente).
  const MATRIZ = {
    none: { whatsapp: false, fp: false, relatorios: false },
    essencial: { whatsapp: true, fp: false, relatorios: false },
    assistente: { whatsapp: true, fp: true, relatorios: true },
    // Casal = nível 3: tudo do Assistente (o que ele vende é o segundo acesso).
    casal: { whatsapp: true, fp: true, relatorios: true },
  };

  for (const [plano, esperado] of Object.entries(MATRIZ)) {
    for (const [recurso, liberado] of Object.entries(esperado)) {
      it(`${plano} ${liberado ? "tem" : "NÃO tem"} ${recurso}`, () => {
        expect(temAcesso(plano, recurso)).toBe(liberado);
      });
    }
  }

  // "Top inclui o meio": é o que dispensa listar recurso por plano.
  it("assistente herda tudo do essencial", () => {
    for (const recurso of Object.keys(RECURSOS)) {
      if (temAcesso("essencial", recurso)) expect(temAcesso("assistente", recurso)).toBe(true);
    }
  });

  it("plano inválido não libera nada", () => {
    for (const recurso of Object.keys(RECURSOS)) {
      expect(temAcesso("premium", recurso)).toBe(false);
      expect(temAcesso(undefined, recurso)).toBe(false);
    }
  });

  // Falha fechada: o catálogo só tem recurso pago, então errar o nome não pode virar
  // liberação de graça.
  it("recurso desconhecido exige o plano mais alto", () => {
    expect(planoNecessario("inexistente")).toBe("assistente");
    expect(temAcesso("none", "inexistente")).toBe(false);
    expect(temAcesso("essencial", "inexistente")).toBe(false);
    expect(temAcesso("assistente", "inexistente")).toBe(true);
  });
});

describe("mostraCadeado", () => {
  it("é o inverso do acesso — o item fica no menu, só que trancado", () => {
    expect(mostraCadeado("none", "whatsapp")).toBe(true);
    expect(mostraCadeado("essencial", "whatsapp")).toBe(false);
    expect(mostraCadeado("essencial", "fp")).toBe(true);
    expect(mostraCadeado("assistente", "fp")).toBe(false);
  });
});

describe("checkoutPara — cada bloqueio manda pro checkout certo", () => {
  it("falta Zap manda pro Essencial", () => {
    expect(checkoutPara("whatsapp")).toBe(CHECKOUT.essencial);
    expect(CHECKOUT.essencial).toContain("a2xpq3u");
  });

  it("falta FP ou Relatórios manda pro Assistente", () => {
    expect(checkoutPara("fp")).toBe(CHECKOUT.assistente);
    expect(checkoutPara("relatorios")).toBe(CHECKOUT.assistente);
    expect(CHECKOUT.assistente).toContain("4pteia8");
  });

  it("os dois checkouts são diferentes", () => {
    expect(CHECKOUT.essencial).not.toBe(CHECKOUT.assistente);
  });
});

describe("conteudoUpgrade", () => {
  it("free conhece o plano; quem já paga faz upgrade", () => {
    expect(conteudoUpgrade("none", "whatsapp").cta).toBe("Conhecer o Essencial");
    expect(conteudoUpgrade("none", "fp").cta).toBe("Conhecer o Assistente");
    expect(conteudoUpgrade("essencial", "fp").cta).toBe("Fazer upgrade");
  });

  it("a nota diz de onde a pessoa está saindo", () => {
    expect(conteudoUpgrade("none", "fp").nota).toBe("Disponível no plano Assistente.");
    expect(conteudoUpgrade("essencial", "fp").nota).toMatch(/Essencial.*Assistente/);
  });

  it("o link acompanha o recurso bloqueado, não o plano atual", () => {
    expect(conteudoUpgrade("none", "whatsapp").href).toBe(CHECKOUT.essencial);
    expect(conteudoUpgrade("none", "fp").href).toBe(CHECKOUT.assistente);
  });

  it("o título acompanha o contexto de onde a pessoa bateu no bloqueio", () => {
    expect(conteudoUpgrade("none", "whatsapp").titulo).toMatch(/WhatsApp/);
    expect(conteudoUpgrade("none", "fp").titulo).toMatch(/Planejamento Financeiro/);
  });

  // Relatórios ainda não existe: a copy lidera pelo FP e cita Relatórios como o que vem.
  it("Relatórios não é vendido como pronto", () => {
    const r = conteudoUpgrade("essencial", "relatorios");
    expect(r.titulo).toMatch(/Planejamento Financeiro/);
    expect(r.descricao).toMatch(/em breve/);
    expect(r.href).toBe(CHECKOUT.assistente);
  });

  it("recurso desconhecido não quebra a tela", () => {
    const r = conteudoUpgrade("none", "inexistente");
    expect(r.titulo).toBeTruthy();
    expect(r.href).toBe(CHECKOUT.assistente);
  });
});

// ===== Padrão novo de paywall (2026-09-12) =====

describe("orcamento é recurso do Essencial", () => {
  // O gate é no Essencial e não no Assistente de propósito: o modo caos é do
  // Essencial, e sem teto o assinante não teria o que estourar.
  it("exige essencial, não assistente", () => {
    expect(RECURSOS.orcamento).toBe("essencial");
    expect(planoNecessario("orcamento")).toBe("essencial");
  });

  it("Free não tem, Essencial e Assistente têm", () => {
    expect(temAcesso("none", "orcamento")).toBe(false);
    expect(temAcesso("essencial", "orcamento")).toBe(true);
    expect(temAcesso("assistente", "orcamento")).toBe(true);
  });
});

describe("paywallNoSave", () => {
  it("devolve null quando pode salvar — o caminho feliz não carrega objeto", () => {
    expect(paywallNoSave("essencial", "orcamento")).toBeNull();
    expect(paywallNoSave("assistente", "orcamento")).toBeNull();
    expect(paywallNoSave("assistente", "fp")).toBeNull();
  });

  it("descreve o bloqueio com o plano exigido e o checkout certo", () => {
    const r = paywallNoSave("none", "orcamento");
    expect(r).not.toBeNull();
    expect(r.recurso).toBe("orcamento");
    expect(r.planoAtual).toBe("none");
    expect(r.planoExigido).toBe("essencial");
    expect(r.checkout).toBe(CHECKOUT.essencial);
  });

  // Quem já paga o Essencial e esbarra no FP precisa ver o checkout do Assistente,
  // não o do plano que ele já tem.
  it("aponta pro plano ACIMA, não pro plano atual", () => {
    const r = paywallNoSave("essencial", "fp");
    expect(r.planoExigido).toBe("assistente");
    expect(r.checkout).toBe(CHECKOUT.assistente);
  });

  // Mesma regra do resto do arquivo: errar o nome de um recurso não pode liberar nada.
  it("recurso desconhecido falha fechado", () => {
    const r = paywallNoSave("essencial", "inexistente");
    expect(r).not.toBeNull();
    expect(r.planoExigido).toBe("assistente");
  });

  it("plano inválido é tratado como none", () => {
    const r = paywallNoSave("premium", "orcamento");
    expect(r.planoAtual).toBe("none");
  });
});

describe("mostraPreviaBorrada", () => {
  it("borra pra quem não tem acesso e libera pra quem tem", () => {
    expect(mostraPreviaBorrada("none", "fp")).toBe(true);
    expect(mostraPreviaBorrada("essencial", "fp")).toBe(true);
    expect(mostraPreviaBorrada("assistente", "fp")).toBe(false);
  });
});

// ===== Trial libera o orçamento (2026-09-13) =====

describe("podeUsarRecurso — trial", () => {
  const ativo = { trial_inicio: "2026-09-01T00:00:00Z", trial_ate: "2030-01-01T00:00:00Z" };
  const expirado = { trial_inicio: "2026-01-01T00:00:00Z", trial_ate: "2026-01-15T00:00:00Z" };

  it("trial ativo libera whatsapp E orçamento pra quem está no Free", () => {
    expect(podeUsarRecurso("none", "whatsapp", ativo)).toBe(true);
    expect(podeUsarRecurso("none", "orcamento", ativo)).toBe(true);
  });

  // O limite da regra: trial de 14 dias é o Essencial inteiro, não o Assistente.
  it("trial NÃO libera Planejamento nem Relatórios", () => {
    expect(podeUsarRecurso("none", "fp", ativo)).toBe(false);
    expect(podeUsarRecurso("none", "relatorios", ativo)).toBe(false);
  });

  it("trial expirado não libera nada", () => {
    expect(podeUsarRecurso("none", "orcamento", expirado)).toBe(false);
    expect(podeUsarRecurso("none", "whatsapp", expirado)).toBe(false);
  });

  it("sem trial cai no plano puro", () => {
    expect(podeUsarRecurso("none", "orcamento", null)).toBe(false);
    expect(podeUsarRecurso("essencial", "orcamento", null)).toBe(true);
    expect(podeUsarRecurso("assistente", "fp", null)).toBe(true);
  });

  // Recurso desconhecido não pode virar liberação de graça nem pelo trial.
  it("recurso desconhecido falha fechado mesmo com trial ativo", () => {
    expect(podeUsarRecurso("essencial", "inexistente", ativo)).toBe(false);
  });
});

describe("paywallNoSave respeita o trial", () => {
  const ativo = { trial_inicio: "2026-09-01T00:00:00Z", trial_ate: "2030-01-01T00:00:00Z" };

  it("quem está no trial salva teto sem ver paywall", () => {
    expect(paywallNoSave("none", "orcamento", ativo)).toBeNull();
  });

  it("sem trial passado, o Free segue bloqueado", () => {
    expect(paywallNoSave("none", "orcamento")).not.toBeNull();
  });

  it("trial não abre o Planejamento", () => {
    expect(paywallNoSave("none", "fp", ativo)).not.toBeNull();
  });
});

// ===== Oferta de pagamento no primeiro contato (2026-09-16) =====
//
// O Lucas mandou o link pra um amigo que ele ja tinha convencido e descobriu que o app
// nao tinha caminho nenhum pra essa pessoa pagar: o card do trial tinha um botao so.
describe("segunda saida do card de trial", () => {
  const nuncaTestou = { trial_inicio: null, trial_ate: null };

  it("quem pode testar recebe TAMBEM o link de assinar", () => {
    const c = conteudoUpgrade("none", "whatsapp", { trial: nuncaTestou });
    expect(c.modo).toBe("trial");
    expect(c.hrefSecundario).toBe(CHECKOUT.essencial);
    expect(c.ctaSecundario).toContain(PRECO.essencial);
  });

  it("o teste continua sendo a acao principal", () => {
    const c = conteudoUpgrade("none", "whatsapp", { trial: nuncaTestou });
    expect(c.cta).toMatch(/Testar/);
  });

  // Fora do modo trial o card ja é checkout: um segundo link pro mesmo lugar seria
  // ruido, e o componente so renderiza o secundario quando ha acao de trial.
  it("quem nao pode testar nao ganha link duplicado", () => {
    expect(conteudoUpgrade("none", "fp").ctaSecundario).toBeUndefined();
    expect(conteudoUpgrade("essencial", "fp").ctaSecundario).toBeUndefined();
  });
});

describe("planoDaUrl", () => {
  it("le os dois planos vendaveis", () => {
    expect(planoDaUrl("?plano=essencial")).toBe("essencial");
    expect(planoDaUrl("?plano=assistente")).toBe("assistente");
  });

  it("acha o parametro no meio da querystring e ignora caixa", () => {
    expect(planoDaUrl("?utm_source=zap&plano=ESSENCIAL&x=1")).toBe("essencial");
  });

  it("lixo, vazio e ausente caem em null", () => {
    for (const v of ["", "?", "?plano=", "?plano=premium", "?planos=essencial", null, undefined]) {
      expect(planoDaUrl(v)).toBeNull();
    }
  });

  // 'none' passa em PLANOS mas nao e plano vendavel: convite pra ele e ruido.
  it("'none' nao e convite", () => {
    expect(planoDaUrl("?plano=none")).toBeNull();
  });
});

// ===== E-mail pré-preenchido no checkout (2026-09-18) =====
//
// O Augusto comprou com um e-mail e criou a conta com outro, 2h depois. Como o
// webhook casa compra com conta PELO E-MAIL, a assinatura dele não virou acesso e ele
// passou dois dias pagando sem ter o produto.
describe("checkoutComEmail", () => {
  it("acrescenta o e-mail na URL limpa", () => {
    expect(checkoutComEmail("https://pay.cakto.com.br/abc", "a@b.com"))
      .toBe("https://pay.cakto.com.br/abc?email=a%40b.com");
  });

  it("usa & quando a URL ja tem querystring", () => {
    expect(checkoutComEmail("https://pay.cakto.com.br/abc?utm=x", "a@b.com"))
      .toBe("https://pay.cakto.com.br/abc?utm=x&email=a%40b.com");
  });

  it("escapa o que precisa ser escapado", () => {
    expect(checkoutComEmail("https://x.com/c", "no+me@ex.com.br"))
      .toContain("email=no%2Bme%40ex.com.br");
  });

  // Sem e-mail a URL volta intacta: `?email=` vazio so sujaria o link e o analytics.
  it("sem e-mail, devolve a URL como estava", () => {
    for (const v of ["", "   ", null, undefined]) {
      expect(checkoutComEmail("https://pay.cakto.com.br/abc", v)).toBe("https://pay.cakto.com.br/abc");
    }
  });

  it("sem URL nao inventa link", () => {
    expect(checkoutComEmail(null, "a@b.com")).toBeNull();
    expect(checkoutComEmail(undefined, "a@b.com")).toBeUndefined();
  });

  it("aceita os dois checkouts reais", () => {
    expect(checkoutComEmail(CHECKOUT.essencial, "x@y.com")).toContain("a2xpq3u?email=");
    expect(checkoutComEmail(CHECKOUT.assistente, "x@y.com")).toContain("4pteia8?email=");
  });
});

describe("plano Casal", () => {
  it("é o nível 3, acima do Assistente", () => {
    expect(PLANOS).toContain("casal");
    expect(nivelPlano("casal")).toBe(3);
    expect(nivelPlano("casal")).toBeGreaterThan(nivelPlano("assistente"));
    expect(nivelPlano("desconhecido")).toBe(0);
  });

  it("herda tudo do Assistente", () => {
    for (const recurso of Object.keys(RECURSOS)) {
      if (temAcesso("assistente", recurso)) expect(temAcesso("casal", recurso)).toBe(true);
    }
    expect(temAcesso("casal", "inexistente")).toBe(true);
  });

  it("tem rótulo e preço", () => {
    expect(ROTULO.casal).toBe("Casal");
    expect(PRECO.casal).toBe("R$ 249,00");
  });

  it("não aparece paywall pra quem está no Casal", () => {
    for (const recurso of Object.keys(RECURSOS)) expect(paywallNoSave("casal", recurso)).toBeNull();
  });

  // Enquanto a oferta não existir na Cakto, CHECKOUT.casal é null e o convite por URL
  // não pode aparecer (seria um botão sem destino).
  it("checkout do Casal é a oferta 344ridx_1135957 e o convite por URL funciona", () => {
    expect(CHECKOUT.casal).toBe("https://pay.cakto.com.br/344ridx_1135957");
    expect(planoDaUrl("?plano=casal")).toBe("casal");
    expect(planoDaUrl("?plano=CASAL")).toBe("casal");
  });
});
