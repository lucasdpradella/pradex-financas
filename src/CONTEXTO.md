# CONTEXTO PRADEX FINANCAS

Base oficial do projeto conectada ao GitHub Desktop.

## Premissa de trabalho
- Trabalhar sempre na pasta oficial `pradex-financas-GITHUB`
- Testar localmente
- Fazer commit no GitHub Desktop
- Fazer `Push origin`
- Tudo que ficar aprovado localmente deve terminar no GitHub

## Links
- App: https://pradex-financas.vercel.app
- GitHub: https://github.com/lucasdpradella/pradex-financas
- Supabase: https://sjvuhqqsjboncwpboclv.supabase.co

## Stack
- React
- Vite
- Supabase
- Vercel

## Estrutura principal atual
- `src/App.jsx`
- `src/supabaseClient.js`
- `src/components/fp/PerfilFP.jsx`
- `src/components/fp/ObjetivosFP.jsx`
- `src/components/fp/RendasDespesasFP.jsx`
- `src/sql/fix_fp_updated_at_trigger.sql`
- `src/CONTEXTO.md`

## O que esta estavel no app principal
- Login e cadastro funcionando
- Lancamentos manuais funcionando
- Parcelamento funcionando
- Recorrencias funcionando
- Dashboard, Historico e Metas funcionando
- Importacao por IA com preview editavel

## Planejamento financeiro - estado atual

### Perfil
- `PerfilFP.jsx` salva e carrega dados pessoais
- Ao salvar perfil, o sistema garante criacao automatica do membro `Titular` se ele ainda nao existir
- Membros da familia carregam ordenados com `Titular` primeiro
- Inclusao, edicao e remocao de membros funcionando

### Objetivos
- `ObjetivosFP.jsx` foi adaptado ao schema real do banco
- A tabela `fp_objetivos` hoje se comporta como um registro principal por usuario
- Aposentadoria fica salva no registro principal
- Objetivos secundarios nao ficam em colunas separadas do banco
- Objetivos secundarios estao serializados dentro de `comentarios` usando bloco `[Outros:...]`
- Isso foi feito porque:
  - existe restricao/indice unico por `user_id`
  - a coluna `outros_objetivos` nao existe no schema atual
- Estado validado pelo usuario: aposentadoria e outros objetivos ficaram corretos

### Rendas e despesas
- `RendasDespesasFP.jsx` foi adaptado ao schema real do banco
- O app nao depende mais de colunas que nao existem como `membro_id`, `ocorrencias` e afins
- Metadados extras ficam serializados em `comentarios`:
  - `[Responsavel:...]`
  - `[Previsao:...]`
  - `[Ocorrencias:...]`
- Cards superiores corretos:
  - `RECEITA DO MES ATUAL`
  - `DESPESA DO MES ATUAL`
- Esses cards puxam dados dos `Lancamentos` reais do mes atual
- O card azul de despesas usa apenas o mes atual, nao total anual
- Contraste visual dos textos de `Rendas`, `Despesas` e do card azul foi ajustado

## Bug importante tratado hoje

### Erro ao editar renda/despesa
Mensagem:
- `record "new" has no field "updated_at"`

Diagnostico:
- O frontend nao envia `updated_at`
- O erro vem de trigger ou funcao no banco Supabase ao executar `PATCH`
- Ou seja, a causa raiz esta no banco, nao no payload do app

Contorno aplicado no app:
- Ao editar uma renda/despesa, o app tenta `PATCH`
- Se vier exatamente o erro de `updated_at`, o app faz fallback:
  - cria um novo registro com `POST`
  - remove o registro antigo com `DELETE`
- Isso desbloqueou a edicao e foi validado pelo usuario

Importante:
- O contorno esta funcionando
- A causa raiz no Supabase ainda nao foi corrigida

## Build e fluxo
- Build local passou apos os ajustes
- Ajuste de fallback da edicao foi commitado e enviado para o GitHub
- Existe SQL helper local para diagnostico/correcao do erro de `updated_at`

## Schema real que se provou sensivel
- `fp_objetivos` nao bate 100% com a expectativa inicial
- `fp_rendas` e `fp_despesas` tambem nao batem 100% com a expectativa inicial
- Antes de adicionar novos campos nessas areas, confirmar schema real no Supabase

## O que ja foi resolvido nos ultimos passos
- Sessao do Supabase sincronizada com o fluxo de login manual do app
- Criacao automatica do `Titular`
- Ordenacao de membros com `Titular` primeiro
- Persistencia de aposentadoria
- Persistencia de objetivos secundarios via `comentarios`
- Cards de `Receita do mes atual` e `Despesa do mes atual`
- Ajuste visual de contraste em `Rendas/Despesas`
- Fallback para edicao de renda/despesa quando o banco falha por `updated_at`

## O que ainda precisa ser feito

### Prioridade alta
1. Corrigir a trigger ou funcao no Supabase que tenta usar `updated_at` em `fp_rendas` e/ou `fp_despesas`
2. Revisar schema real das tabelas FP antes de expandir novas features
3. Fazer uma rodada de validacao completa do fluxo FP:
   - Perfil
   - Membros
   - Objetivos
   - Rendas
   - Despesas
   - Edicao
   - Remocao

### Prioridade media
1. Evoluir modulo de investimentos
2. Evoluir modulo de bens
3. Evoluir modulo de diagnostico

### Prioridade estrategica
1. Preparar a base para producao/App Store
2. Diminuir dependencias de comportamentos implicitos do banco
3. Manter o contexto sempre atualizado para retomada rapida

## Como retomar em outra conversa ou em outro agente
Se precisar retomar com outro agente, informar:
- Pasta oficial: `C:\Users\lucas\OneDrive\Documentos\New project\pradex-financas-main\pradex-financas-GITHUB`
- Stack: React + Vite + Supabase + Vercel
- Modulos FP atuais:
  - `PerfilFP.jsx`
  - `ObjetivosFP.jsx`
  - `RendasDespesasFP.jsx`
- `Objetivos` usa serializacao em `comentarios` para guardar secundarios
- `Rendas/Despesas` usam serializacao em `comentarios` para guardar responsavel/previsao/ocorrencias
- Existe fallback no app para erro de `updated_at` ao editar renda/despesa
- O ideal futuro e corrigir a trigger no Supabase e remover a necessidade desse fallback

## Regra pratica
- Antes de mexer em schema ou logica de persistencia, confirmar o banco real
- Antes de encerrar o dia, atualizar este arquivo
- Antes de considerar algo concluido, garantir:
  - teste local
  - commit
  - push
