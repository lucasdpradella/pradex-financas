# Auditoria de Seguranca do Pradex Financas

Data: 2026-09-12

Escopo: item 10 do backlog do Lucas. Analise somente-leitura do app React/Vite, migrations Supabase, Edge Functions e configuracao Vercel.

## Resumo RLS

| Tabela | Evidencia nas migrations | Status |
|---|---|---|
| `bancos` | `supabase/migrations/2026-08-29_bancos.sql:35` | RLS ligada + policies `user_id = auth.uid()`, sem `USING (true)` |
| `dividas` | `supabase/migrations/2026-08-29_dividas.sql:38` | RLS ligada + policies `user_id = auth.uid()`, sem `USING (true)` |
| `cakto_eventos` | `supabase/migrations/2026-09-05_cakto_webhook.sql:40` | RLS ligada, sem policies, intencional para `service_role` |
| `pendencias_assinatura` | `supabase/migrations/2026-09-05_cakto_webhook.sql:66` | RLS ligada, sem policies |
| `trial_lembretes` | `supabase/migrations/2026-09-07_trial_whatsapp_14d.sql:135` | RLS ligada, sem policies, intencional para `service_role` |
| `fp_perfil`, `Lancamentos`, `cartoes`, `categorias` | acessadas no front em `src/App.jsx:452`, `src/App.jsx:593`, `src/App.jsx:602`, `src/App.jsx:465`; perfil tambem em `src/components/fp/PerfilFP.jsx:96` | Nao ha `enable row level security` nem `create policy` nas migrations versionadas. Se nao existir policy manual no Supabase, e critico. |

## Critico

### 1. `agente_aplicar_acoes` permite escrita em lancamentos de qualquer usuario via RPC

Onde:

- `supabase/migrations/2026-06-10_fix_agente_parcelas_meses.sql:9`
- `supabase/migrations/2026-06-10_fix_agente_parcelas_meses.sql:57`
- `supabase/migrations/2026-06-10_fix_agente_parcelas_meses.sql:99`
- `supabase/migrations/2026-06-10_fix_agente_parcelas_meses.sql:120`

Por que e exploravel:

A funcao e `SECURITY DEFINER` e recebe `p_user_id` do chamador. Ela nao compara `p_user_id` com `auth.uid()` e nao ha `REVOKE/GRANT` restringindo execucao no arquivo. Em Postgres, funcao nova costuma nascer executavel por `PUBLIC`; entao um cliente com anon/auth JWT pode chamar `/rpc/agente_aplicar_acoes` e criar, editar ou deletar `Lancamentos` de outro `user_id`.

Correcao concreta:

Revogar execucao de `public`, `anon` e `authenticated`, conceder so a uma role interna se existir, ou trocar a funcao para usar `v_user_id := auth.uid()` e ignorar/remover `p_user_id`. Se a Edge Function precisa passar usuario pelo telefone, melhor criar RPC privada sem exposicao PostgREST ou mover a escrita para service role dentro da Edge Function.

### 2. RLS ausente nas migrations para tabelas centrais com dados financeiros

Onde:

- `src/App.jsx:593` (`Lancamentos`)
- `src/App.jsx:602` (`cartoes`)
- `src/App.jsx:465` (`categorias`)
- `src/components/fp/PerfilFP.jsx:96` (`fp_perfil`)

Por que e exploravel:

Se o banco de producao depende so dessas migrations, PostgREST fica protegido apenas por filtros no front, que o atacante remove. Isso expoe leitura/escrita cross-user em dados financeiros e perfil. Nao achei policy `USING (true)`; o problema encontrado foi ausencia de policy versionada.

Correcao concreta:

Versionar `alter table ... enable row level security` e policies `for select/insert/update/delete to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())` para `fp_perfil`, `Lancamentos`, `cartoes` e `categorias`. Para `fp_perfil`, preservar o trigger de plano/trial, mas RLS precisa existir tambem.

## Alto

### 3. `agente-pradex` e publico e nao tem rate limit proprio, mas a URL sozinha nao basta para queimar saldo

Onde:

- `supabase/config.toml:1`
- `supabase/functions/agente-pradex/index.ts:448`
- `supabase/functions/agente-pradex/index.ts:228`
- `supabase/functions/agente-pradex/index.ts:233`
- `supabase/functions/agente-pradex/index.ts:494`

Por que e exploravel:

`verify_jwt=false` deixa a funcao publica, mas existe autenticacao por segredo compartilhado: o handler valida `z-api-token` ou `client-token` em tempo constante. Portanto, "qualquer um com a URL" nao passa. O risco real e que nao ha assinatura HMAC, allowlist de IP, nonce nem rate limit por telefone/IP/token. Se o token vazar, o atacante varia `messageId` e telefone de cliente pago/trial e dispara Claude; audio ainda aciona Whisper.

Custo estimado:

O modelo usado e `claude-sonnet-4-5-20250929`, com `max_tokens: 2048`. Pela tabela oficial da Anthropic, Claude Sonnet 4.5 custa US$3/M tokens de entrada e US$15/M tokens de saida; no teto de 2048 tokens de saida, da ate ~US$0,031 so de saida, mais entrada. Whisper custa US$0,006/minuto. Na pratica, texto tipico foi estimado em ~US$0,02-0,06 por requisicao, e audio soma a duracao.

Correcao concreta:

Adicionar rate limit server-side por telefone e IP, exigir assinatura HMAC/timestamp se a Z-API permitir, rejeitar `audioUrl` fora de dominios esperados e criar alarme por volume/tokens.

### 4. Onboarding do WhatsApp pode vincular conta por conhecimento de e-mail se `telefone` estiver vazio

Onde:

- `supabase/functions/agente-pradex/index.ts:387`
- `supabase/functions/agente-pradex/index.ts:390`
- `supabase/functions/agente-pradex/index.ts:398`

Por que e exploravel:

Se houver conta antiga ou bugada sem telefone, quem souber o e-mail recebe o desafio no proprio WhatsApp e consegue ligar o numero a conta. Nao promove plano, mas pode usar o agente se a conta ja tiver plano/trial.

Correcao concreta:

Exigir confirmacao pelo usuario logado no app, codigo enviado por e-mail, ou token one-time gerado no painel autenticado.

## Medio

### 5. `cakto-webhook` nao permite promocao sem segredo, mas o fallback `secret` no corpo e mais fraco que HMAC

Onde:

- `supabase/config.toml:4`
- `supabase/functions/cakto-webhook/index.ts:73`
- `supabase/functions/cakto-webhook/index.ts:116`
- `supabase/functions/cakto-webhook/index.ts:128`
- `supabase/functions/cakto-webhook/index.ts:316`
- `supabase/functions/cakto-webhook/index.ts:277`
- `supabase/functions/cakto-webhook/index.ts:327`
- `supabase/migrations/2026-09-05_cakto_webhook.sql:82`

Por que e exploravel:

A comparacao do segredo e em tempo constante. Sem `CAKTO_WEBHOOK_SECRET`, nao da para forjar evento e virar `assistente`. Se o e-mail nao existe, grava pendencia; se existe auth user sem `fp_perfil`, tambem vira pendencia. Duplicidade de e-mail em `auth.users` nao deveria existir, mas a RPC usa `limit 1`.

O ponto medio e o fallback de autenticacao pelo campo `secret` no corpo. Ele funciona como segredo compartilhado simples; se o segredo vazar em log/payload ou for copiado para lugar indevido, qualquer atacante consegue montar evento valido sem precisar produzir HMAC com timestamp.

Correcao concreta:

Aceitar so HMAC com timestamp, remover fallback de `secret` no corpo quando a Cakto estiver configurada com assinatura, e registrar/rejeitar caso `fp_user_id_por_email` encontre mais de um usuario.

## Baixo

### 6. Faltam headers de seguranca no Vercel

Onde:

- `vercel.json:1`

Por que e exploravel:

Sem CSP, HSTS, `X-Frame-Options` e headers auxiliares, a aplicacao fica com defesa menor contra clickjacking, downgrade/HTTP acidental, MIME sniffing e impacto de XSS. Nao e o maior risco porque o app e SPA e nao achei segredo no front alem da anon key publica, mas e uma melhoria barata.

Correcao concreta:

Bloco pronto para colar em `vercel.json`:

```json
{
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://sjvuhqqsjboncwpboclv.supabase.co https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://pay.cakto.com.br; upgrade-insecure-requests" }
      ]
    }
  ]
}
```

## Trigger `fp_perfil_sync_plano`

O trigger segura PATCH/INSERT direto de `anon/authenticated`: em insert zera `plano`, `plano_ate`, `trial_inicio` e `trial_ate`; em update restaura `old.*`.

Onde:

- `supabase/migrations/2026-09-11_drop_acesso_pago.sql:32`
- `supabase/migrations/2026-09-11_drop_acesso_pago.sql:35`
- `supabase/migrations/2026-09-11_drop_acesso_pago.sql:41`

Conclusao:

`SECURITY INVOKER` e necessario e, para PostgREST direto, basta. O bypass real seria uma RPC `SECURITY DEFINER` exposta que escrevesse `fp_perfil` com campos controlados pelo usuario; nesta auditoria nao encontrei uma assim. `fp_iniciar_trial` e `SECURITY DEFINER`, mas usa `auth.uid()` e nao aceita data/plano do cliente.

Onde:

- `supabase/migrations/2026-09-07_trial_whatsapp_14d.sql:76`
- `supabase/migrations/2026-09-07_trial_whatsapp_14d.sql:83`
- `supabase/migrations/2026-09-07_trial_whatsapp_14d.sql:105`

## Segredos

Nao achei segredo real hardcoded em `src/`, `supabase/functions/` ou historico filtrado. O anon key aparece em `src/supabaseClient.js:4` e e publico por design.

Evidencias:

- `.env:1` tem `VITE_SUPABASE_URL`.
- `.env:2` tem placeholder de `VITE_SUPABASE_ANON_KEY`.
- `.gitignore:3` ignora `.env`.
- `src/supabaseClient.js:4` tem anon key publica.

## Fontes de preco

- Anthropic Claude pricing: https://platform.claude.com/docs/en/about-claude/pricing
- OpenAI Whisper pricing: https://developers.openai.com/api/docs/models/whisper-1
