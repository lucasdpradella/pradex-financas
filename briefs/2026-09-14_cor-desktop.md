# Varredura de cor no desktop - Pradex

Data: 2026-09-14

Escopo: usos de `#0C0E14`, `#151821`, `#1E2330`, `#2C3344` como fundo/borda e `#F1F2F4`, `#8B93A1`, `#5C6570` como texto em superficies que aparecem no desktop claro.

Referencia correta: `ScoreDisciplina.jsx` e `UpgradePlano.jsx` ramificam por `isDesktop`. O bloco de Planejamento em `src/App.jsx:2409` ja injeta `--surface`, `--surface2`, `--card-bg`, `--input-bg`, `--border`, `--text-primary`, `--text-secondary`, `--text-muted`.

## Resumo

- Arquivos com cor escura ainda visivel no desktop: 7 arquivos.
- Linhas diretamente problemáticas listadas: 86 linhas.
- Arquivos ja aceitaveis neste recorte: `src/components/fp/ObjetivosFP.jsx` usa `var(...)` nos pontos encontrados; `src/components/fp/RendasDespesasFP.jsx` tem apenas comentarios com os hex buscados; `src/components/ScoreDisciplina.jsx` e `src/components/UpgradePlano.jsx` estao no padrao correto.
- Escuro proposital/não atacar: telas pre-auth/loading em `src/App.jsx:1350` e `src/App.jsx:1353` parecem ser tela de entrada/splash, fora do canvas logado desktop; blocos `pdx-hide-desktop` e `{!isDesktop}` sao mobile-only.

## A) Ja tem `isDesktop` ou esta dentro de container com variaveis

### 1. Subabas do Planejamento ainda estao hardcoded escuras

- Tela/rota: Planejamento Financeiro desktop, todas as abas.
- Onde: `src/App.jsx:2429` - fundo da barra `#0C0E14` e borda `#1E2330`.
- Onde: `src/App.jsx:2444` - aba ativa com fundo `#1E2330`.
- Onde: `src/App.jsx:2445` - texto ativo `#F1F2F4` e inativo `#5C6570`.
- Por que aparece no desktop: o wrapper em `src/App.jsx:2409` ja tem variaveis claras, mas este bloco ignora as variaveis e fixa a paleta mobile.
- Conserto: trocar por `background: "var(--surface2)"`, `border: "1px solid var(--border)"`, ativo `var(--surface)`/`var(--text-primary)`, inativo `var(--text-muted)`.
- Custo: 1 arquivo, 3 linhas.

### 2. Perfil FP e a aba mais preta do Planejamento

- Tela/rota: Planejamento Financeiro > Perfil, desktop.
- Onde: `src/components/fp/PerfilFP.jsx:48` - `inputStyle` com fundo `#0C0E14`.
- Onde: `src/components/fp/PerfilFP.jsx:49` - `inputStyle` com borda `#1E2330`.
- Onde: `src/components/fp/PerfilFP.jsx:52` - `inputStyle` com texto `#F1F2F4`.
- Onde: `src/components/fp/PerfilFP.jsx:62` - `labelStyle` com texto `#8B93A1`.
- Onde: `src/components/fp/PerfilFP.jsx:376` - loading com texto `#5C6570`.
- Onde: `src/components/fp/PerfilFP.jsx:383` - card Dados Pessoais com fundo `#151821` e borda `#1E2330`.
- Onde: `src/components/fp/PerfilFP.jsx:384` - titulo de secao com texto `#8B93A1`.
- Onde: `src/components/fp/PerfilFP.jsx:448` - select com texto `#F1F2F4`/placeholder `#5C6570`.
- Onde: `src/components/fp/PerfilFP.jsx:464` - select com texto `#F1F2F4`/placeholder `#5C6570`.
- Onde: `src/components/fp/PerfilFP.jsx:522` - card Membros com fundo `#151821` e borda `#1E2330`.
- Onde: `src/components/fp/PerfilFP.jsx:524` - titulo de secao com texto `#8B93A1`.
- Onde: `src/components/fp/PerfilFP.jsx:549` - formulario de membro com fundo `#0C0E14` e borda `#1E2330`.
- Onde: `src/components/fp/PerfilFP.jsx:607` - vazio com texto `#5C6570`.
- Onde: `src/components/fp/PerfilFP.jsx:615` - card de membro com fundo `#0C0E14`.
- Onde: `src/components/fp/PerfilFP.jsx:619` - card de membro com borda `#1E2330`.
- Onde: `src/components/fp/PerfilFP.jsx:679` - botao Cancelar edicao com borda `#1E2330`.
- Onde: `src/components/fp/PerfilFP.jsx:682` - botao Cancelar edicao com texto `#8B93A1`.
- Onde: `src/components/fp/PerfilFP.jsx:695` - nome do membro com texto `#F1F2F4`.
- Onde: `src/components/fp/PerfilFP.jsx:696` - metadados do membro com texto `#8B93A1`.
- Onde: `src/components/fp/PerfilFP.jsx:706` - botao Editar com borda `#1E2330`.
- Onde: `src/components/fp/PerfilFP.jsx:722` - botao remover com texto `#5C6570`.
- Por que aparece no desktop: `PerfilFP` esta dentro do wrapper com variaveis, mas usa hex fixo e nao consome `var(--*)`.
- Conserto: trocar `inputStyle`, `labelStyle`, cards, textos e botoes por `var(--input-bg)`, `var(--border)`, `var(--surface)`, `var(--surface2)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`.
- Custo: 1 arquivo, 21 linhas.

### 3. Diagnostico FP ainda tem board/grafico escuro

- Tela/rota: Planejamento Financeiro > Diagnostico, desktop.
- Onde: `src/components/fp/DiagnosticoFP.jsx:186` - cards de cenario com fundo `#1E2330`/`#151821` e borda `#2C3344`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:291` - loading/vazio com texto `#8B93A1`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:448` - texto SVG `#8B93A1`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:455` - texto SVG `#0C0E14`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:478` - linha SVG `#8B93A1`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:484` - linha SVG `#8B93A1`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:489` - curva SVG `#8B93A1`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:490` - curva SVG `#0C0E14`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:497` - marcador SVG com fill `#1E2330`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:535` - legenda com dot `#0C0E14`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:536` - legenda com dot `#8B93A1`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:537` - legenda com dot `#1E2330`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:555` - grupo de toggle com fundo `#0C0E14`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:559` - texto de toggle `#8B93A1`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:568` - toggle ativo com texto `#0C0E14`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:569` - botao filtro com fundo `#0C0E14`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:572` - board com fundo `#151821` e borda `#1E2330`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:576` - titulo de status com texto `#F1F2F4`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:577` - separador `#1E2330`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:578` - descricao com texto `#8B93A1`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:581` - label de premissa com texto `#8B93A1`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:582` - valor de premissa com texto `#F1F2F4`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:584` - card de cenario com borda `#1E2330`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:588` - titulo de cenario com texto `#F1F2F4`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:589` - icone info com borda/texto `#8B93A1`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:591` - label de metrica com texto `#8B93A1`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:592` - valor de metrica com texto `#F1F2F4`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:596` - botao reset com texto `#0C0E14`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:599` - eixo SVG `#5C6570`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:601` - tooltip com fundo `#0C0E14`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:606` - mini track com fundo `#151821`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:609` - fill do mini track com `#2C3344`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:611` - item de legenda com texto `#5C6570`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:613` - nota de legenda com texto `#8B93A1`.
- Onde: `src/components/fp/DiagnosticoFP.jsx:614` - info da legenda com borda `#8B93A1`.
- Por que aparece no desktop: esta dentro do wrapper com variaveis, mas grande parte do grafico e dos estilos finais ignora `var(--*)`.
- Conserto: manter cores semanticas das curvas se fizerem sentido, mas separar tokens de superficie/texto/eixo por canvas. Para SVG, usar constantes derivadas de CSS vars ou prop `isDesktop` local.
- Custo: 1 arquivo, 35 linhas.

### 4. Bens FP tem superficies parcialmente corrigidas, mas texto e inputs ainda escuros

- Tela/rota: Planejamento Financeiro > Bens, desktop.
- Onde: `src/components/fp/BensFP.jsx:580` - loading com texto `#8B93A1`.
- Onde: `src/components/fp/BensFP.jsx:581` - vazio usa texto `#5C6570`; fundo/borda ja via `var(...)`.
- Onde: `src/components/fp/BensFP.jsx:584` - label de resumo com texto `#8B93A1`.
- Onde: `src/components/fp/BensFP.jsx:585` - valor de resumo com texto `#F1F2F4`.
- Onde: `src/components/fp/BensFP.jsx:587` - tabs com texto `#8B93A1`.
- Onde: `src/components/fp/BensFP.jsx:588` - tab ativa com texto `#F1F2F4`; fundo ja via `var(...)`.
- Onde: `src/components/fp/BensFP.jsx:592` - titulo do card com texto `#F1F2F4`.
- Onde: `src/components/fp/BensFP.jsx:593` - subtitulo do card com texto `#8B93A1`.
- Onde: `src/components/fp/BensFP.jsx:600` - label de formulario com texto `#8B93A1`.
- Onde: `src/components/fp/BensFP.jsx:601` - input com fundo `#0C0E14` e texto `#F1F2F4`; borda ja via `var(...)`.
- Onde: `src/components/fp/BensFP.jsx:603` - checkbox label com texto `#8B93A1`.
- Onde: `src/components/fp/BensFP.jsx:607` - titulo de modal com texto `#F1F2F4`.
- Onde: `src/components/fp/BensFP.jsx:608` - fechar modal com texto `#8B93A1`.
- Onde: `src/components/fp/BensFP.jsx:613` - cancelar modal com texto `#8B93A1`.
- Por que aparece no desktop: fundos principais ja dependem de `var(--surface)`, entao ficam claros; os textos fixos claros somem sobre os cards brancos e os inputs continuam pretos.
- Conserto: trocar textos por `var(--text-primary/secondary/muted)` e input por `var(--input-bg)`.
- Custo: 1 arquivo, 14 linhas.

### 5. Investimentos FP tem o mesmo padrao de Bens

- Tela/rota: Planejamento Financeiro > Investimentos, desktop.
- Onde: `src/components/fp/InvestimentosFP.jsx:225` - total por tipo com texto `#F1F2F4`.
- Onde: `src/components/fp/InvestimentosFP.jsx:285` - loading com texto `#8B93A1`.
- Onde: `src/components/fp/InvestimentosFP.jsx:286` - vazio com texto `#5C6570`; fundo/borda ja via `var(...)`.
- Onde: `src/components/fp/InvestimentosFP.jsx:289` - label de resumo com texto `#8B93A1`.
- Onde: `src/components/fp/InvestimentosFP.jsx:291` - percentual com texto `#5C6570`.
- Onde: `src/components/fp/InvestimentosFP.jsx:295` - titulo de grupo com texto `#8B93A1`.
- Onde: `src/components/fp/InvestimentosFP.jsx:296` - total de grupo com texto `#F1F2F4`.
- Onde: `src/components/fp/InvestimentosFP.jsx:299` - titulo do card com texto `#F1F2F4`.
- Onde: `src/components/fp/InvestimentosFP.jsx:300` - subtitulo do card com texto `#8B93A1`.
- Onde: `src/components/fp/InvestimentosFP.jsx:308` - titulo de modal com texto `#F1F2F4`.
- Onde: `src/components/fp/InvestimentosFP.jsx:309` - fechar modal com texto `#8B93A1`.
- Onde: `src/components/fp/InvestimentosFP.jsx:313` - label de formulario com texto `#8B93A1`.
- Onde: `src/components/fp/InvestimentosFP.jsx:314` - input com fundo `#0C0E14` e texto `#F1F2F4`; borda ja via `var(...)`.
- Onde: `src/components/fp/InvestimentosFP.jsx:315` - select com fundo `#0C0E14` e texto `#F1F2F4`; borda ja via `var(...)`.
- Onde: `src/components/fp/InvestimentosFP.jsx:318` - cancelar modal com texto `#8B93A1`.
- Por que aparece no desktop: cards podem virar brancos via `var(--surface)`, mas texto e inputs continuam paleta mobile.
- Conserto: mesmo de `BensFP`: substituir textos por `var(--text-*)` e campos por `var(--input-bg)`.
- Custo: 1 arquivo, 15 linhas.

### 6. Modal global de editar lancamento/compra abre escuro no desktop

- Tela/rota: Historico/Lancamentos desktop; `TabelaLancamentos` chama `onEdit={handleEdit}` em `src/App.jsx:2235`.
- Onde: `src/App.jsx:249` - `inputStyle` global com fundo `#0C0E14`, borda `#1E2330`, texto `#F1F2F4`.
- Onde: `src/App.jsx:1465` - modal editar com fundo `#151821` e borda `#1E2330`.
- Onde: `src/App.jsx:1467` - titulo do modal com texto `#8B93A1`.
- Onde: `src/App.jsx:1468` - fechar modal com texto `#5C6570`.
- Onde: `src/App.jsx:1470` - segmentado tipo receita/gasto com fundo `#0C0E14`.
- Onde: `src/App.jsx:1472` - opcao inativa com texto `#5C6570`.
- Onde: `src/App.jsx:1477` - select categoria com texto `#F1F2F4`/placeholder `#5C6570`.
- Onde: `src/App.jsx:1481` - select forma de pagamento com texto `#F1F2F4`/placeholder `#5C6570`.
- Onde: `src/App.jsx:1486` - select cartao com texto `#F1F2F4`/placeholder `#5C6570`.
- Onde: `src/App.jsx:1494` - botao parcelado com borda `#1E2330` e texto inativo `#5C6570`.
- Onde: `src/App.jsx:1506` - label total de parcelas com texto `#8B93A1`.
- Onde: `src/App.jsx:1511` - ajuda de parcelas com texto `#8B93A1`.
- Onde: `src/App.jsx:1521` - botao recorrente com borda `#1E2330` e texto inativo `#5C6570`.
- Onde: `src/App.jsx:1526` - botao evitavel com borda `#1E2330` e texto inativo `#5C6570`.
- Onde: `src/App.jsx:1541` - cancelar com borda `#1E2330` e texto `#8B93A1`.
- Onde: `src/App.jsx:1555` - modal compra parcelada com fundo `#151821` e borda `#1E2330`.
- Onde: `src/App.jsx:1557` - titulo compra com texto `#8B93A1`.
- Onde: `src/App.jsx:1558` - fechar compra com texto `#5C6570`.
- Onde: `src/App.jsx:1560` - titulo compra com texto `#F1F2F4`.
- Onde: `src/App.jsx:1561` - resumo compra com texto `#8B93A1`.
- Onde: `src/App.jsx:1566` - lista de parcelas com fundo `#0C0E14` e borda `#1E2330`.
- Onde: `src/App.jsx:1570` - separador de parcela `#151821`.
- Onde: `src/App.jsx:1571` - parcela atual com texto `#8B93A1`.
- Onde: `src/App.jsx:1572` - data da parcela com texto `#8B93A1`.
- Onde: `src/App.jsx:1573` - status pendente com fundo `#1E2330` e texto `#8B93A1`.
- Onde: `src/App.jsx:1574` - valor da parcela com texto `#F1F2F4`.
- Por que aparece no desktop: o modal e global, fora dos componentes desktop, e nao ramifica por `isDesktop`. No desktop vira bottom-sheet mobile escura por cima do app claro.
- Conserto: criar `modalTheme = isDesktop ? desktopTheme : darkTheme` ou tokens locais; no desktop centralizar/clarear modal e reutilizar inputs claros.
- Custo: 1 arquivo, 27 linhas.

## B) Nao tem como saber o canvas hoje; precisa receber prop ou token primeiro

### 7. OrcamentoCategoria e 100% tema escuro no desktop

- Tela/rota: Orcamento/Teto por categoria desktop, aberto via menu ou botao do Score.
- Onde: `src/App.jsx:1782` - componente e renderizado sem `isDesktop`.
- Onde: `src/components/OrcamentoCategoria.jsx:17` - constantes `bg`, `borda`, `fundo` fixam `#151821`, `#1E2330`, `#0C0E14`.
- Onde: `src/components/OrcamentoCategoria.jsx:18` - constantes `texto`, `medio`, `fraco` fixam `#F1F2F4`, `#8B93A1`, `#5C6570`.
- Por que aparece no desktop: a tela de orcamento nao esta dentro do wrapper de variaveis do Planejamento e o componente nao recebe `isDesktop`.
- Conserto: passar `isDesktop` em `src/App.jsx:1782` e escolher tema claro/escuro dentro do componente; alternativa melhor: envolver a tela de orcamento com os mesmos CSS vars e trocar `COR.*` por `var(--*)`.
- Custo: 2 arquivos, cerca de 20 usos internos alem das 2 linhas de constantes.

### 8. PreviaBorrada fica preta no paywall desktop de FP/Relatorios

- Tela/rota: Relatorios bloqueado no desktop e Planejamento bloqueado no desktop.
- Onde: `src/App.jsx:2381` - `PreviaBorrada recurso="relatorios"` sem `isDesktop`.
- Onde: `src/App.jsx:2402` - `PreviaBorrada recurso="fp"` sem `isDesktop`.
- Onde: `src/components/PreviaBorrada.jsx:20` - constantes `bg`/`borda` fixam `#151821`/`#1E2330`.
- Onde: `src/components/PreviaBorrada.jsx:21` - constantes de texto fixam `#F1F2F4`/`#8B93A1`/`#5C6570`.
- Onde: `src/components/PreviaBorrada.jsx:63` - card usa `COR.bg` e `COR.borda`.
- Onde: `src/components/PreviaBorrada.jsx:86` - overlay usa gradiente preto proposital para legibilidade sobre blur.
- Por que aparece no desktop: `UpgradePlano` ja recebe `isDesktop`, mas a previa ao lado nao recebe e continua mobile-dark.
- Conserto: passar `isDesktop` nas duas chamadas e criar tema claro para o card borrado. Manter o gradiente escuro em `src/components/PreviaBorrada.jsx:86` pode fazer sentido se o texto continuar sobre a imagem borrada; o fundo/borda do card externo nao precisa ser preto.
- Custo: 2 arquivos, 6 linhas principais.

## Blocos escuros que fazem sentido ou nao entram na conta

- `src/App.jsx:1350` e `src/App.jsx:1353`: loading/login/cadastro pre-auth usam visual escuro. Pode ser escolha de marca; nao e o canvas desktop logado descrito no problema.
- `src/App.jsx:1593`, `src/App.jsx:1630`, `src/App.jsx:1661`, `src/App.jsx:1803` e blocos seguintes do dashboard mobile: tem classe `pdx-hide-desktop` ou condicao `!isDesktop`; nao aparecem no desktop.
- `src/components/fp/ObjetivosFP.jsx:325`, `src/components/fp/ObjetivosFP.jsx:326`, `src/components/fp/ObjetivosFP.jsx:343`, `src/components/fp/ObjetivosFP.jsx:344`, `src/components/fp/ObjetivosFP.jsx:358`, `src/components/fp/ObjetivosFP.jsx:360`, `src/components/fp/ObjetivosFP.jsx:361`, `src/components/fp/ObjetivosFP.jsx:364`, `src/components/fp/ObjetivosFP.jsx:370`: os hex sao fallbacks de `var(...)`; dentro do wrapper de Planejamento no desktop resolvem para tokens claros, entao nao sao o problema atual.
- `src/components/fp/RendasDespesasFP.jsx:555` e `src/components/fp/RendasDespesasFP.jsx:556`: ocorrencias estao em comentario explicando exatamente o problema; sem acao.
- `src/components/ScoreDisciplina.jsx:38` e `src/components/ScoreDisciplina.jsx:129`: o componente ja escolhe `TEMA_CLARO`/`TEMA_ESCURO` por `isDesktop`; o `#0C0E14` do botao-premio e contraste proposital sobre verde, nao fundo de card desktop.

## Ordem de ataque

1. Subabas do Planejamento - mais visivel e aparece em todas as abas de FP; 1 arquivo, 3 linhas.
2. `PerfilFP` - primeira aba do Planejamento e maior contraste visual errado; 1 arquivo, 21 linhas.
3. `DiagnosticoFP` - aba inteira ainda parece produto escuro, inclusive grafico; 1 arquivo, 35 linhas.
4. `OrcamentoCategoria` - tela de teto e fluxo vendido pelo Score; precisa prop/token antes; 2 arquivos, cerca de 20 linhas de uso.
5. `BensFP` + `InvestimentosFP` - aparecem menos que Perfil, mas ficam com textos claros em cards claros e campos pretos; 2 arquivos, 29 linhas.
6. Modal global de editar lancamento/compra - muito visto por quem usa Historico no desktop, mas so aparece apos clique; 1 arquivo, 27 linhas.
7. `PreviaBorrada` - so aparece para usuario bloqueado/sem plano em FP ou Relatorios; 2 arquivos, 6 linhas principais.

