# Varredura de riscos de runtime - Pradex Financas

Data: 2026-09-13

Escopo revisado: `src/App.jsx` e componentes em `src/components/`, com foco em TDZ no render, ordem de hooks, dependencias perigosas em hooks, acesso a propriedades possivelmente indefinidas e outros erros que passam no build mas quebram ao abrir a pagina.

## Resultado geral

Nao achei outro achado critico/alto do mesmo tipo do incidente do `mesDashboard`: nenhum outro `const`/`let` foi lido antes da propria declaracao em JSX, inicializador de `useState` ou array de dependencias avaliado durante o render; tambem nao achei hook condicional/apos retorno condicional que derrube o React ao abrir a pagina.

## Medio

### Estado de orcamento congela o primeiro valor recebido

- Onde: `src/components/OrcamentoCategoria.jsx:55`
- Onde: `src/components/OrcamentoCategoria.jsx:61`
- Onde: `src/App.jsx:1713`
- Onde: `src/App.jsx:228`
- Onde: `src/App.jsx:640`
- O que quebra: `OrcamentoCategoria` deriva `inicial` de `tetos` com `useMemo`, mas usa esse objeto apenas como valor inicial de `useState(inicial)`. Como o inicializador de `useState` so roda no primeiro mount, mudancas posteriores em `tetos` nao atualizam `valores`.
- Quando quebra: quando a tela de orcamento monta antes da busca terminar, ou quando `mesDashboard` muda e `fetchOrcamentos` atualiza `orcamentos` enquanto o componente continua montado. A tela pode mostrar campos vazios/desatualizados e um salvamento posterior pode sobrescrever dados corretos com valores stale.
- Por que e exploravel: nao e exploravel como seguranca nem causa tela branca; e um bug de runtime/estado que passa no build e aparece so em fluxo real de uso com dados assincronos.
- Correcao concreta: sincronizar o estado local quando `inicial` mudar, por exemplo `useEffect(() => setValores(inicial), [inicial])`, ou desmontar/remontar o componente com uma `key` baseada em mes/ano, ou renderizar os inputs diretamente a partir de `tetos` enquanto os dados carregam.

## Sem achado real

- TDZ no render: os casos encontrados de leitura antes da declaracao em `src/App.jsx:313`, `src/App.jsx:326`, `src/App.jsx:457` e `src/components/fp/PerfilFP.jsx:249` ficam dentro de callbacks/funcoes assincronas que so executam depois do render ou por acao do usuario; portanto nao disparam temporal dead zone durante a avaliacao do JSX ou do array de dependencias.
- Ordem de hooks: nao encontrei `useState`, `useEffect`, `useMemo`, `useCallback` ou hooks customizados chamados dentro de `if`, loop, ternario, callback ou depois de retorno condicional no escopo de componente.
- Dependencias instaveis em effects: nao encontrei dependencia inline do tipo objeto/array/funcao recriada a cada render causando loop obvio de `useEffect` nos arquivos revisados.
- Propriedade de `undefined` no render: os pontos com dados carregados por fetch revisados usam guardas, valores padrao ou recebem arrays inicializados pelo `App`. Alguns componentes assumem props como arrays, mas no desenho atual o `App` passa `[]` como estado inicial, entao nao considerei isso achado real.

