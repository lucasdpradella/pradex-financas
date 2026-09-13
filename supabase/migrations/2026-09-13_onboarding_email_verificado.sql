-- 2026-09-13 — Onboarding do WhatsApp passa a exigir posse do e-mail
--
-- Achado 4 da auditoria de 2026-09-12 (briefs/2026-09-12_auditoria-seguranca.md).
--
-- O FURO. Até aqui, SABER o e-mail bastava pra vincular um WhatsApp a uma conta.
-- Se existisse conta sem `telefone` preenchido — conta antiga, ou cadastro que parou
-- no meio — qualquer um que soubesse o endereço respondia o desafio no próprio
-- WhatsApp e ligava o número dele àquela conta. Não promovia plano, mas passava a
-- usar o agente por ela e a ver os lançamentos nas respostas.
--
-- O CONSERTO. O agente manda um código de 6 dígitos pro e-mail (OTP do Supabase Auth,
-- sem serviço novo) e só vincula depois de conferir. Esta coluna guarda quando isso
-- aconteceu, e a etapa de LGPD recusa avançar sem ela.
--
-- ⚠️ Esta migration acompanha o código da Edge Function. Aplicar as duas juntas: sem
-- a coluna, o `setOnboardingState` do estado "aguardando_codigo" falha e ninguém
-- consegue mais vincular WhatsApp nenhum.

alter table public.agente_onboarding_estado
  add column if not exists email_verificado_em timestamptz;

comment on column public.agente_onboarding_estado.email_verificado_em is
  'Quando o dono do e-mail provou posse pelo código OTP. Nulo = não verificado; a etapa de LGPD recusa avançar sem isto.';

-- ============================================================================
-- Limpeza dos estados em trânsito
-- ============================================================================
-- Quem estava no meio do onboarding antigo está no estado "aguardando_lgpd" SEM
-- verificação — exatamente a situação que o guard novo recusa. Em vez de deixar essa
-- gente travada numa mensagem de erro, o estado é apagado e ela recomeça do e-mail.
-- É uma mensagem a mais pra pouca gente, contra um vínculo sem prova pra sempre.
delete from public.agente_onboarding_estado
 where estado_atual = 'aguardando_lgpd'
   and email_verificado_em is null;

-- ============================================================================
-- Conferir
-- ============================================================================
--   select telefone, estado_atual, email_candidato, email_verificado_em, tentativas
--     from public.agente_onboarding_estado order by updated_at desc;
