# Handoff 2026-09-28 → 2026-10-03: home "mês fechado", metas, incidente do agente

> Para Claude/Codex/Grok retomarem sem contexto. Horários em BRT (UTC-3).
> Fonte detalhada no vault: `Chave Mestre/Conversas/2026-09-28.md`, `Conversas/2026-10-03.md`, `Projetos/PRADEX/contexto.md`.

## Estado do `main` em 2026-10-03
| Commit | O quê |
|---|---|
| `b7b4f49` | PR #100: agente só grava "Pagamento fatura" com intenção explícita na fala (agente v46) |
| `a9512b5` | PR #101: Home volta pro "mês fechado" (Fatura do cartão / Débito / Receitas), tendência 6 meses vai pra Relatórios |
| `a0dcb08` | PR #102: metas, editar + "Excluir caixinha" (= arquivar) + migration de sync do `preencher_livro_id` |

Front no ar pela Vercel (deploy de `a0dcb08` verde). Nenhuma edge function mudou nos PRs #101/#102.

## 1. Incidente: agente-pradex fora do ar (27/09 20:18 → 29/09 ~07:55)
- **Causa:** acabou o crédito da Anthropic. Todas as chamadas ao LLM falhavam, para todos os usuários. O Lucas colocou US$ 5 e o agente voltou.
- **Bug que escondeu o incidente:** falha do LLM é gravada como `sucesso`/`done` em `agente_logs` e `agente_msgs_processadas`. Nada alertou.
- **Pendente:**
  - [ ] PR de log de erro real + retry + alerta (não aberto)
  - [ ] Relançar as mensagens de 27–29/09 que não viraram lançamento (a mensagem ficou como "processada", então precisa de reprocessamento manual/consulta)
  - [ ] Ativar recarga automática de crédito na Anthropic (sugestão)
  - [ ] Modelo `claude-sonnet-4-5-20250929`: aposentadoria anunciada "não antes de 2026-09-29". Planejar migração de modelo.

## 2. Agente WhatsApp sem memória de conversa
- Cada mensagem é tratada isolada. Proposta (NÃO implementada):
  - memória curta: últimos 4–6 turnos dentro de 10–15 min;
  - estado de "pergunta pendente" (o agente perguntou X, a próxima mensagem responde X);
  - prompt caching pra baratear.
- **Bug relacionado:** o agente diz "Lancei" e em seguida pergunta qual cartão. Ou lança, ou pergunta antes.

## 3. Home: decisão "mês fechado" (PR #101)
- A home voltou para o **mês fechado por `data_lancamento` (mês inteiro)**:
  - **Fatura do cartão:** por cartão (`cartaoPorCartao` + `faturaPorDataDaCompra`), compras do mês pela data da compra.
  - **Débito do mês:** débito + PIX + dinheiro, **sem** pagamento de fatura e **sem** aporte de meta (`meta_id`).
  - **Receitas do mês.**
- **Removidos da home:** Entrou/Saiu/Diferença, "Nas contas agora", "Compromissos próximos 3 meses" (mobile e desktop) e a tendência de 6 meses.
- **Tendência 6 meses:** foi para **Relatórios (desktop)**, painel "Tendência 6 meses · mês fechado". Calculada por `tendenciaMeses()` em `src/lib/fechamento.js`, que usa o mesmo `calcularFechamento`, então bate com a home. Relatórios existe só no desktop e é do **plano Assistente** (`temAcesso(plano,"fp")`); sem o plano aparece a prévia borrada + upgrade. A trava não foi mexida.
- **Card da fatura é um carrossel:** a 2ª face "Pelo fechamento" (fatura pelo ciclo do cartão) está atrás da flag `FATURA_PELO_FECHAMENTO = false` e é um **PR futuro**. Bolinhas/abas só aparecem quando a 2ª face existir. O Lucas ainda está decidindo onde a visão por competência vai morar (ver `briefs/2026-09-24_caixa-vs-competencia.md` no vault).
- `saldo_atual` e a trigger `sync_saldo_pagamento_fatura` continuam no banco, mas a home não usa.

## 4. Metas: editar / excluir (PR #102)
- **Sintoma:** usuário criou uma meta errada e não conseguia editar nem excluir.
- **Causa raiz:**
  1. A UI (componente `MetasCaixinhas`, o mesmo no mobile e no desktop) não tinha editar nem excluir. O prop `onArquivar` existia mas nunca era ligado.
  2. No banco, um DELETE real falha: `Lancamentos_meta_id_fkey ON DELETE SET NULL` + CHECK `lancamentos_abate_saldo_so_em_aporte` (`abate_saldo OR meta_id IS NOT NULL OR categoria='Pagamento fatura'`). Aporte de "dinheiro já guardado" (`abate_saldo=false`) não pode ficar sem meta, então dá erro 23514. Caso real: meta id 3 (criada 28/09 15:46).
  3. A RLS de `metas` está correta (`sou_membro_do_livro`).
- **Decisão do Lucas (03/10):** um botão só, **"Excluir caixinha"**, que por baixo **arquiva** (`arquivada=true`). Some da lista pra sempre, libera o nome (índice único só entre ativas) e mantém aportes, histórico e pontos; o fluxo do mês não muda. **Exclusão real só via suporte** (SQL manual: apagar os aportes antes da meta). Confirmação: _"Excluir a caixinha "X"? Ela some da sua lista. Seus registros continuam no histórico."_
- **Editar:** nome, valor alvo, prazo e onde está guardado, validando nome repetido.
- **`preencher_livro_id`:** hotfix aplicado direto em prod em 28/09 (o acesso a `new.criado_por` ficou aninhado dentro de `if tg_table_name = 'Lancamentos'`; a versão antiga quebrava INSERT em bancos/cartoes/metas). Agora está no repo como `supabase/migrations/2026-10-03_preencher_livro_id_sync_prod.sql`. Foi **aplicada em prod em 03/10** depois de conferir que a definição era idêntica (md5 do `pg_get_functiondef` igual antes e depois: `e08ad26b…`): no-op.

## 5. Itens de 28/09
- PR #100 (merge `b7b4f49`): intenção explícita pra "Pagamento fatura" no agente, v46.
- Import da Solange: lançamentos ids 1307–1490.
- Augusto: bancos + dívida cadastrados.
- Detalhes: `Chave Mestre/Conversas/2026-09-28.md`.

## 6. Pendências abertas
- [ ] **PR #99 plano casal**, aguardando merge → aplicar a migration → deploy das functions (`cakto-webhook agente-pradex agente-cutucada trial-lembretes`) → `plano='casal'` para a Steffani e o Rodrigo
- [ ] PR de log de erro + retry + alerta do agente
- [ ] PR de memória curta do agente (+ corrigir "Lancei" seguido de pergunta)
- [ ] Relançar as mensagens perdidas de 27–29/09
- [ ] 2ª face da fatura ("Pelo fechamento") + bolinhas
- [ ] Bug dos compromissos (projeção de parcelas), se a seção voltar a existir
- [ ] Migração do modelo `claude-sonnet-4-5-20250929`
