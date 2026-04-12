# CONTEXTO PRADEX FINANÇAS

App de planejamento financeiro para assessor de investimentos e clientes.

## Links
- App: https://pradex-financas.vercel.app
- GitHub: https://github.com/lucasdpradella/pradex-financas
- Supabase: https://sjvuhqqsjboncwpboclv.supabase.co

## Stack
React + Vite + Supabase + Vercel

## Credenciais Supabase (públicas)
- SUPABASE_URL: https://sjvuhqqsjboncwpboclv.supabase.co
- SUPABASE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnVocXFzamJvbmN3cGJvY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTM1NzEsImV4cCI6MjA5MTI2OTU3MX0.qpOXjpyJ29Hr9kvee3uxNS1LmJNUEZqDtMCCEpaHjsE

## Estrutura de arquivos
```
pradex-financas/
├── public/
│   ├── manifest.json
│   ├── sw.js
│   ├── icon-192.png
│   └── icon-512.png
├── src/
│   ├── App.jsx
│   └── main.jsx
├── index.html        ← tem Chart.js importado via CDN
├── package.json
└── vite.config.js
```

## Supabase — tabelas

### Lancamentos
- id, descricao, valor, tipo, categoria, data_lancamento, user_id
- forma_pagamento, cartao_id
- poderia_ter_evitado (boolean) — botão do arrependimento
- recorrente (boolean) — gasto mensal recorrente
- parcela_atual (integer), total_parcelas (integer), parcela_grupo_id (uuid) — compras parceladas

### cartoes
- id, user_id, nome, bandeira, dia_fechamento, dia_vencimento, created_at

### profiles
- id (uuid, ref auth.users), nome, role (super_admin | assessor | cliente)
- assessor_id (uuid, ref profiles), codigo_convite
- RLS ativo — usuário lê só o próprio perfil

### orcamentos
- id, user_id, categoria, valor_limite, mes, ano, created_at
- RLS ativo — criado mas ainda não usado no app

### lancamentos_rascunho (A CRIAR)
- lançamentos vindos do WhatsApp, pendentes de confirmação no app

## Edge Functions (Supabase)
- `claude-proxy` — proxy para API do Claude (Anthropic)
- ANTHROPIC_API_KEY nos Secrets do Supabase

## O que está pronto no app

### Autenticação
- Login/cadastro por email e senha (Supabase Auth)
- Multi-tenant: 3 níveis — Super Admin (Lucas), Assessor, Cliente
- Role exibido no topo do app (👑 Admin, 👔 Assessor)
- Link de convite parametrizado por assessor (a implementar)

### Lançamentos
- Lançamentos manuais com forma de pagamento e cartão
- Compras parceladas — cria automaticamente nos meses futuros com badge 1/10x
- Toggle recorrente 🔁 — gasto que se repete todo mês
- Botão do Arrependimento 😬 — marca gastos evitáveis
- Edição de lançamentos (clica no lançamento, abre modal)
- Importação por IA — cola texto/WhatsApp e a IA organiza

### Dashboard
- Cards: receitas, gastos, saldo
- Card do Botão do Arrependimento com impacto financeiro real
  - Gasto único: valor × (1,009)^12
  - Recorrente: 12 aportes com juros compostos
  - Parcelado: parcelas restantes com juros
- Gastos por categoria (barras coloridas)
- Faturas por cartão
- Últimos lançamentos

### Histórico Mensal 📅
- Navegação ← → entre meses
- Resumo do mês (receitas, gastos, saldo)
- Gastos por categoria do mês
- Lista completa de lançamentos do mês
- Parcelas futuras aparecem automaticamente no mês correto

### Simulador de Futuro 🎯
- Campos: patrimônio atual, aporte mensal, meta, rentabilidade anual
- Gráfico de linha com Chart.js (60 meses / 5 anos)
- 3 linhas: com aportes (azul), só rendimento (cinza), meta (amarelo tracejado)
- Cards com projeção em 1, 3 e 5 anos com % da meta
- Aviso de quando atinge a meta

### Cartões 💳
- Cadastro com nome, bandeira, dia fechamento e vencimento
- Faturas calculadas automaticamente

### Importação IA ✨
- Cola texto livre e a IA extrai os lançamentos
- Preview antes de confirmar

### PWA
- Instalável no celular
- manifest.json e sw.js configurados
- Service Worker: network-first (sem cache) para evitar tela branca após deploys
- ícone aparecendo corretamente

## Próximos passos (Caixa de Ideias)
1. **Integração WhatsApp** — cliente manda áudio/texto no WhatsApp, IA transcreve e salva como rascunho no Pradex. Cliente confirma no app. Aguardando chip/número dedicado para API oficial Meta.
2. **PASSO FP XP** — módulo completo de planejamento financeiro: premissas, objetivos, patrimônio, projeção longa, PDF estilo XP
3. **Simulador de Futuro** — já feito, mas pode evoluir com mais cenários
4. **Orçamento por categoria** — tabela criada no Supabase, não implementado no app ainda
5. **Fechamento de mês** — histórico mensal já feito via filtro por data
6. **Botão do Arrependimento** — feito, pode evoluir com análise da IA
7. **Flag "poderia ter evitado"** — feito
8. **Link de convite parametrizado** — assessor tem link único para onboarding de clientes

## Problemas conhecidos / observações técnicas
- Sempre que iniciar nova sessão de código, pedir o App.jsx atual pelo GitHub (Raw) para evitar edições parciais que quebram o build
- Build falha com "Unexpected }" quando edições parciais desalinham chaves JSX
- Chart.js importado via CDN no index.html (necessário para o simulador)
- Componente `GraficoSimulador` é um componente separado no topo do App.jsx (antes do export default)
