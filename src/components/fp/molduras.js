// Geometria compartilhada dos cards do Planejamento Financeiro.
//
// POR QUE ISTO EXISTE. Cada aba de fp/ nasceu em sessão diferente e inventou a
// própria moldura. Antes deste arquivo, o mesmo papel visual aparecia assim:
//
//   Perfil         raio 16, padding 24        (painel de formulário)
//   Objetivos      raio 12, padding 24×20     (painel de formulário)
//   Investimentos  raio 10, padding 14×18     (linha) + 16×20 (resumo)
//   Bens           raio 10, padding 14×18     (linha) + 16×20 (resumo)
//
// Trocar de aba mudava a geometria da tela inteira. É o "cards desenquadrados de
// tamanho" que o PRADELLA apontou três vezes. O conserto anterior arrumou uma aba
// de cada vez, e a próxima aba escrita do zero repetia o problema — por isso agora
// o vocabulário mora num lugar só.
//
// AQUI SÓ TEM GEOMETRIA: raio, padding, box-sizing, grade. Nenhuma cor. Cor é
// decidida por canvas (as var(--surface)/var(--border) que o App injeta) e a aba
// Rendas é uma ilha CLARA de propósito — se este arquivo tivesse cor, usá-lo lá
// quebraria a ilha. Ver o aviso no topo de RendasDespesasFP.jsx.

// Painel de seção: envolve um formulário ou um bloco inteiro.
//
// O padding horizontal é 16 e não 24 de propósito. O shell mobile já dá 24px de
// gutter de cada lado num viewport de 390px; somando 24 do painel, o conteúdo
// começava a 48px da borda — 25% da largura da tela viravam margem.
export const PAINEL = {
  borderRadius: 12,
  padding: "18px 16px",
  boxSizing: "border-box",
  width: "100%",
};

// Linha da lista e card de resumo: o mesmo retângulo, porque fazem o mesmo papel.
// Antes o resumo era 16×20 e a linha 14×18 — diferença invisível no código e
// visível na tela, que é a pior combinação.
export const CARTAO = {
  borderRadius: 10,
  padding: "14px 18px",
  boxSizing: "border-box",
};

// Card aninhado DENTRO de um painel (um membro da família, um objetivo). Padding
// menor porque ele já herda o do painel; o raio é o mesmo pra não criar um
// terceiro arredondamento na mesma tela.
export const CARTAO_INTERNO = {
  borderRadius: 10,
  padding: "12px 14px",
  boxSizing: "border-box",
};

// Grade dos cards de resumo.
//
// A esticada que aparecia no celular era do FLEXBOX, não da grade: com
// `flex: 1` + `flexWrap`, o card sozinho da última linha cresce até a largura
// toda e fica do tamanho de dois. Em grade isso não acontece — item de última
// linha ocupa UMA célula, do tamanho das outras. Só trocar flex por grid já
// resolve.
//
// `auto-fit` e não `auto-fill` porque o número de cards é variável (só entra a
// categoria com saldo). Os dois se comportam igual quando há mais cards que
// colunas; a diferença é o contrário, quando sobram colunas: auto-fill mantém
// as vazias e dois cards ficam espremidos à esquerda de um desktop largo,
// enquanto auto-fit colapsa as vazias e eles dividem a linha inteira.
export const gradeResumo = (min = 170, gap = 12) => ({
  display: "grid",
  gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
  gap,
});

// Card de resumo: um pouco mais alto e menos apertado nas laterais que a linha
// de lista, porque aqui dentro mora um número grande. O padding lateral menor
// (16 em vez de 18) devolve 4px de miolo, que num card de ~180px conta.
export const CARTAO_RESUMO = {
  borderRadius: 10,
  padding: "16px 16px",
  boxSizing: "border-box",
  // Sem isto, o card não encolhe abaixo do número e vaza pra fora da coluna.
  minWidth: 0,
  overflow: "hidden",
};

// O número dentro do card de resumo.
//
// Era 20-22px. "R$ 1.234.567,89" nesse tamanho pede ~160px e o miolo do card no
// celular tem ~150 — o valor vazava. Pior: em grade `1fr 1fr` (a aba Rendas), o
// mínimo AUTO da coluna faz a COLUNA crescer pra caber o texto, e aí a linha
// inteira do resumo passa da largura do container e fica mais larga que os
// cards de lista logo abaixo. Era isso que aparecia como "o quadrado indo além
// dos retângulos de baixo".
//
// 17px cabe um valor na casa dos milhões com folga, nos dois canvas.
export const VALOR_RESUMO = {
  fontSize: 17,
  fontWeight: 700,
  lineHeight: 1.35,
  fontVariantNumeric: "tabular-nums",
  // Rede de segurança: se um dia entrar um número maior que tudo, ele quebra
  // dentro do card em vez de furar a lateral.
  overflowWrap: "anywhere",
};

// Linha com conteúdo à esquerda e valor à direita.
//
// `minWidth: 0` no lado esquerdo não é detalhe: um filho flex tem min-width auto
// por padrão e se recusa a encolher abaixo do próprio conteúdo. Sem isso, um
// título longo empurra o valor pra fora do card no celular em vez de truncar.
export const LINHA = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

export const LINHA_ESQUERDA = { flex: 1, minWidth: 0, overflow: "hidden" };

export const LINHA_DIREITA = {
  textAlign: "right",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 4,
  flexShrink: 0,
};

// Abas internas de uma aba (os tipos de bem, por exemplo).
//
// Era `width: fit-content` num flex: com 4 rótulos ("Participações" é longo) a
// linha pedia ~360px e o miolo do celular tem ~342. Estourava a lateral. Em
// grade com minmax, vira 2×2 no celular e uma linha só no desktop, sem
// breakpoint e sem espremer texto.
export const ABAS_INTERNAS = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 4,
  width: "100%",
  padding: 4,
  borderRadius: 10,
  boxSizing: "border-box",
};
