# Revisao de UI - Planejamento Financeiro

Escopo: `src/components/fp/BensFP.jsx`, `src/components/fp/InvestimentosFP.jsx`, `src/components/fp/ObjetivosFP.jsx`, `src/components/fp/PerfilFP.jsx`.

Contexto visual: os componentes renderizam dentro do canvas mobile escuro `#0C0E14` e do desktop claro `#F1F3F9`. O principal problema restante e que estes arquivos ainda misturam tokens/fallbacks escuros e estilos hardcoded, sem uma adaptacao real para o desktop claro.

## Alto

### 1. Componentes de FP continuam com paleta escura dentro do desktop claro

- Onde: `src/components/fp/BensFP.jsx:583`
- Onde: `src/components/fp/BensFP.jsx:590`
- Onde: `src/components/fp/BensFP.jsx:601`
- Onde: `src/components/fp/InvestimentosFP.jsx:288`
- Onde: `src/components/fp/InvestimentosFP.jsx:297`
- Onde: `src/components/fp/InvestimentosFP.jsx:314`
- Onde: `src/components/fp/ObjetivosFP.jsx:325`
- Onde: `src/components/fp/ObjetivosFP.jsx:360`
- Onde: `src/components/fp/PerfilFP.jsx:383`
- Onde: `src/components/fp/PerfilFP.jsx:522`
- Onde: `src/components/fp/PerfilFP.jsx:549`
- Onde: `src/components/fp/PerfilFP.jsx:615`
- O que quebra visualmente: cards, listas e inputs usam `#151821`, `#0C0E14`, `#1E2330`, ou `var(..., fallback escuro)`. Como o shell desktop e claro, a area de planejamento vira uma ilha escura/desenquadrada dentro de `#F1F3F9`.
- Quando aparece: sempre que qualquer uma destas abas abre no desktop. No mobile escuro a paleta faz sentido; no desktop claro fica fora da direcao visual.
- Correcao concreta: criar tokens de FP por canvas, por exemplo `--fp-surface`, `--fp-surface-2`, `--fp-border`, `--fp-input-bg`, `--fp-text`, `--fp-muted`, definidos no wrapper por `isDesktop`, e substituir os hex hardcoded. No desktop usar `#FFFFFF`, `#F8FAFC`, `#E4E7F0`, `#111827`, `#6B7280`; no mobile manter os escuros atuais.

### 2. Textos claros estao acoplados a cards escuros e vao sumir quando a superficie virar branca

- Onde: `src/components/fp/BensFP.jsx:585`
- Onde: `src/components/fp/BensFP.jsx:592`
- Onde: `src/components/fp/InvestimentosFP.jsx:225`
- Onde: `src/components/fp/InvestimentosFP.jsx:296`
- Onde: `src/components/fp/InvestimentosFP.jsx:299`
- Onde: `src/components/fp/ObjetivosFP.jsx:343`
- Onde: `src/components/fp/PerfilFP.jsx:52`
- Onde: `src/components/fp/PerfilFP.jsx:448`
- Onde: `src/components/fp/PerfilFP.jsx:464`
- Onde: `src/components/fp/PerfilFP.jsx:695`
- O que quebra visualmente: `BensFP`, `InvestimentosFP` e `PerfilFP` fixam texto principal em `#F1F2F4`/branco. `ObjetivosFP` esta melhor por usar `var(--text-primary, ...)`, mas sem token definido ainda cai no fallback escuro.
- Quando aparece: hoje o problema aparece como cards escuros no desktop. Se a primeira correcao trocar so o fundo dos cards para branco, estes textos ficam quase invisiveis.
- Correcao concreta: trocar todos os textos por tokens semanticos (`--fp-text`, `--fp-muted`, `--fp-accent`) junto da troca de superficie. Nao corrigir fundo isoladamente.

## Medio

### 3. Enquadramento mobile fica apertado por padding duplicado e conteudo em linha

- Onde: `src/components/fp/BensFP.jsx:579`
- Onde: `src/components/fp/InvestimentosFP.jsx:284`
- Onde: `src/components/fp/ObjetivosFP.jsx:195`
- Onde: `src/components/fp/BensFP.jsx:590`
- Onde: `src/components/fp/InvestimentosFP.jsx:297`
- O que quebra visualmente: `BensFP` e `InvestimentosFP` adicionam `padding: 24px` dentro de um shell mobile que ja tem padding lateral. Em 390px, a largura util fica pequena e os cards em `display: flex` com valor/acoes a direita comprimem titulo, subtitulo e moeda.
- Quando aparece: mobile, especialmente com nomes longos de bem/instituicao, valores grandes ou comentarios longos.
- Correcao concreta: no mobile reduzir o padding interno destes containers para `0` ou `8px`; nos cards, adicionar `gap`, `minWidth: 0` no lado esquerdo, `overflowWrap: "anywhere"` em titulos/subtitulos e permitir `flexWrap` ou layout em coluna abaixo de largura pequena.

### 4. Grids 2 colunas fixas no Perfil nao quebram no mobile

- Onde: `src/components/fp/PerfilFP.jsx:397`
- Onde: `src/components/fp/PerfilFP.jsx:442`
- Onde: `src/components/fp/PerfilFP.jsx:550`
- Onde: `src/components/fp/PerfilFP.jsx:624`
- O que quebra visualmente: os grids usam `gridTemplateColumns: "1fr 1fr"` sem `auto-fit`/media query. Campos de data, selects e labels longos ficam apertados em telas estreitas.
- Quando aparece: mobile 390px e menor, principalmente nos blocos de membros da familia e regime de uniao.
- Correcao concreta: trocar por `repeat(auto-fit, minmax(200px, 1fr))` ou por uma regra `isDesktop ? "1fr 1fr" : "1fr"`. O padrao de `BensFP`/`ObjetivosFP` com `minmax(200px, 1fr)` e melhor.

### 5. Botoes primarios e secundarios nao seguem o mesmo papel visual entre abas

- Onde: `src/components/fp/BensFP.jsx:612`
- Onde: `src/components/fp/InvestimentosFP.jsx:317`
- Onde: `src/components/fp/ObjetivosFP.jsx:388`
- Onde: `src/components/fp/ObjetivosFP.jsx:391`
- Onde: `src/components/fp/ObjetivosFP.jsx:401`
- Onde: `src/components/fp/PerfilFP.jsx:499`
- Onde: `src/components/fp/PerfilFP.jsx:587`
- O que quebra visualmente: o mesmo papel de acao principal varia entre botao pequeno de modal/header (`9px 18px`, 13px), botao de rodape alinhado a direita (`10px 20px`, 14px) e botao full-width (`0.85rem`, 0.95rem). O usuario percebe cada aba como um produto diferente.
- Quando aparece: sempre, ao alternar entre Perfil, Objetivos, Investimentos e Bens.
- Correcao concreta: extrair estilos comuns de `btnPrimary`, `btnSecondary`, `btnDangerGhost`, `input`, `card`, `sectionCard` para um helper/tokens de FP. Depois aplicar variacoes por contexto: `fullWidth` so para formularios mobile, nao como estilo base da tela.

## Baixo

### 6. Escala tipografica e espacamentos tem muitos valores avulsos

- Onde: `src/components/fp/BensFP.jsx:584`
- Onde: `src/components/fp/BensFP.jsx:587`
- Onde: `src/components/fp/BensFP.jsx:608`
- Onde: `src/components/fp/InvestimentosFP.jsx:290`
- Onde: `src/components/fp/ObjetivosFP.jsx:343`
- Onde: `src/components/fp/PerfilFP.jsx:61`
- Onde: `src/components/fp/PerfilFP.jsx:537`
- Onde: `src/components/fp/PerfilFP.jsx:558`
- Onde: `src/components/fp/PerfilFP.jsx:724`
- O que quebra visualmente: contagem de `fontSize` distintos por arquivo: `BensFP` 7 valores (`11`, `12`, `13`, `14`, `16`, `20`, `22`); `InvestimentosFP` 6 (`11`, `12`, `13`, `14`, `16`, `22`); `ObjetivosFP` 5 (`11`, `12`, `13`, `14`, `18`); `PerfilFP` 9 (`0.68rem`, `0.75rem`, `0.78rem`, `0.82rem`, `0.84rem`, `0.85rem`, `0.9rem`, `0.95rem`, `1.1rem`).
- Quando aparece: sempre, mas fica mais evidente na troca de abas: titulos, labels, botoes e textos auxiliares pulam de tamanho sem hierarquia clara.
- Correcao concreta: padronizar em uma escala curta: label `11px/0.7rem`, texto auxiliar `12px`, corpo `14px`, botao `14px`, subtitulo/card `13px`, titulo `18px`, valor grande `20px` ou `22px`, evitando `0.78rem`, `0.82rem`, `0.84rem`, `0.85rem` espalhados.

### 7. Muted muito escuro some no mobile escuro

- Onde: `src/components/fp/BensFP.jsx:581`
- Onde: `src/components/fp/InvestimentosFP.jsx:286`
- Onde: `src/components/fp/InvestimentosFP.jsx:291`
- Onde: `src/components/fp/PerfilFP.jsx:376`
- Onde: `src/components/fp/PerfilFP.jsx:607`
- Onde: `src/components/fp/PerfilFP.jsx:722`
- O que quebra visualmente: `#5C6570` e usado em textos pequenos/estado vazio e icone de remover sobre fundos escuros. Em tamanho pequeno, fica apagado demais.
- Quando aparece: mobile escuro e cards internos escuros; no desktop claro a cor e aceitavel, mas a mesma cor nao serve bem para os dois fundos.
- Correcao concreta: separar `--fp-muted` por tema: no escuro usar algo mais claro como `#8B93A1` para texto pequeno; reservar `#5C6570` para desabilitado/decorativo. No desktop, usar `#6B7280`.

## Arquivo a arquivo

- `src/components/fp/BensFP.jsx`: nao esta ok. Layout e consistente internamente, mas carrega paleta escura no desktop, padding mobile alto e card flex sem quebra.
- `src/components/fp/InvestimentosFP.jsx`: nao esta ok. E parecido com `BensFP`, com os mesmos problemas de paleta, padding e card em linha; um pouco mais limpo por nao ter abas internas.
- `src/components/fp/ObjetivosFP.jsx`: parcialmente ok. Tem melhor uso de `var(--text-primary)`/`var(--card-bg)`, grid responsivo e menos tamanhos de fonte, mas ainda depende de fallbacks escuros e nao recebe tokens do desktop.
- `src/components/fp/PerfilFP.jsx`: nao esta ok. E o mais desalinhado: muitos inline styles hardcoded, grids 2 colunas fixas, maior dispersao tipografica e botoes com padroes diferentes.

## O que eu consertaria primeiro em 30 minutos

1. Definir tokens de tema de FP no wrapper da tela para mobile e desktop, e trocar os hex principais dos quatro arquivos por esses tokens. Isso resolve o maior impacto reclamado: cards/fundos/inputs com cor estranha no desktop claro.
2. Em seguida, ajustar `PerfilFP` para grid responsivo (`1fr` no mobile ou `auto-fit`) e reduzir padding interno de `BensFP`/`InvestimentosFP` no mobile. Isso melhora enquadramento sem mexer em regra de negocio.
3. Se sobrar tempo, extrair um mini preset compartilhado de `input`, `card`, `btnPrimary` e `btnSecondary` para os quatro arquivos. Isso reduz a sensacao de telas avulsas e evita regressao visual na proxima migracao de paleta.

