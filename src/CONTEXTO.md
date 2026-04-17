# CONTEXTO PRADEX FINANCAS

App de planejamento financeiro para assessor de investimentos e clientes.

## Links
- App: https://pradex-financas.vercel.app
- GitHub: https://github.com/lucasdpradella/pradex-financas
- Supabase: https://sjvuhqqsjboncwpboclv.supabase.co

## Stack
- React
- Vite
- Supabase
- Vercel

## Credenciais Supabase (publicas)
- SUPABASE_URL: https://sjvuhqqsjboncwpboclv.supabase.co
- SUPABASE_KEY: anon key publica usada pelo app

## Estrutura de arquivos
```text
pradex-financas/
|-- public/
|   |-- manifest.json
|   |-- icon-192.png
|   `-- icon-512.png
|-- src/
|   |-- App.jsx
|   |-- CONTEXTO.md
|   `-- main.jsx
|-- .editorconfig
|-- .gitattributes
|-- .gitignore
|-- index.html
|-- package.json
`-- vite.config.js
```

## Supabase - tabelas

### Lancamentos
- id, descricao, valor, tipo, categoria, data_lancamento, user_id
- forma_pagamento, cartao_id
- poderia_ter_evitado (boolean)
- recorrente (boolean)
- parcela_atual (integer), total_parcelas (integer), parcela_grupo_id (uuid)
- recorrente_grupo_id (uuid)

### cartoes
- id, user_id, nome, bandeira, dia_fechamento, dia_vencimento, created_at

### profiles
- id (uuid, ref auth.users), nome, role (super_admin | assessor | cliente)
- assessor_id (uuid, ref profiles), codigo_convite

### orcamentos
- id, user_id, categoria, valor_limite, mes, ano, created_at

### lancamentos_rascunho
- id, descricao, valor, tipo, categoria, forma_pagamento, data_lancamento, texto_original, status

## Edge Functions (Supabase)
- `claude-proxy` como proxy para API do Claude

## O que esta pronto no app

### Autenticacao
- Login e cadastro por email e senha
- Leitura de role do usuario
- Fluxo multi-tenant por perfil

### Lancamentos
- Lancamentos manuais
- Compras parceladas com criacao automatica das parcelas futuras
- Gastos recorrentes agrupados por serie
- Edicao e exclusao de lancamentos
- Marcacao de gasto evitavel

### Dashboard
- Resumo do mes
- Separacao entre debito e cartao
- Gastos por categoria
- Faturas por cartao
- Projecao de proximas parcelas

### Historico
- Navegacao por mes
- Resumo mensal
- Lista de lancamentos do periodo

### Metas
- Simulador de patrimonio
- Grafico com Chart.js carregado por CDN no `index.html`

### Importacao por IA
- Texto livre para preview de lancamentos
- Confirmacao manual antes de salvar

## Blindagem aplicada
- `index.html` sem registro de service worker
- `src/main.jsx` sem registro de service worker
- `public/sw.js` removido da base oficial para evitar cache antigo
- `.gitignore` configurado para ignorar `node_modules`, `dist`, `.vite` e logs
- `App.jsx` com `normalizeText()` para reduzir impacto de textos mojibake vindos do banco

## Proximos passos
1. Integracao de rascunhos via WhatsApp
2. Orcamento por categoria
3. Evoluir o simulador com mais cenarios
4. Refino visual do app

## Observacoes tecnicas
- Sempre editar a pasta oficial conectada ao GitHub Desktop
- Validar com build antes de subir mudancas maiores
- Chart.js continua importado via CDN no `index.html`
- `GraficoSimulador` fica no topo do `App.jsx`, antes do `export default`
