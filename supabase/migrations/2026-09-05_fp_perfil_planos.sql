-- 2026-09-05 — Planos de assinatura (none / essencial / assistente)
--
-- Brief: Projetos/PRADEX/briefs/2026-09-05_saas-planos-webhook-paywall.md (Fase 0)
-- Sai do boolean único (`acesso_pago`) sem quebrar o gate atual do front.
--
-- Fonte da verdade passa a ser `plano`. `acesso_pago` continua existindo, mas vira
-- coluna DERIVADA: um trigger reescreve `acesso_pago = (plano = 'assistente')` em
-- todo insert/update. Note que é só 'assistente', não 'plano <> none': hoje
-- `acesso_pago` libera exatamente WhatsApp + Diagnóstico FP (App.jsx:2000 e 2065),
-- que o Essencial não compra. O front segue funcionando sem tocar em nenhuma linha
-- de JS nesta fase; quem passa a ler `plano` é a Fase 2 (paywall).
--
-- Efeito colateral conhecido até a Fase 2: pra quem está no Essencial o app fica
-- igual ao free — o que ele compra a mais só aparece quando o paywall entrar.
--
-- ATENÇÃO — muda o runbook de 2026-08-15: `update fp_perfil set acesso_pago = true`
-- virou no-op (o trigger sobrescreve). Liberação manual agora é via `plano` — SQL de
-- emergência no fim deste arquivo.
--
-- Nada aqui é destrutivo: colunas novas com default, backfill preserva quem já paga.

-- ============================================================================
-- 1. Colunas
-- ============================================================================
alter table public.fp_perfil
  add column if not exists plano text not null default 'none';

-- Constraint nomeada e recriável (o `check` inline do `add column if not exists`
-- ganharia nome automático e não seria idempotente numa segunda passada).
alter table public.fp_perfil
  drop constraint if exists fp_perfil_plano_check;
alter table public.fp_perfil
  add constraint fp_perfil_plano_check
  check (plano in ('none', 'essencial', 'assistente'));

-- Até quando a assinatura está paga. Informativo nesta fase: quem revoga acesso é o
-- webhook da Cakto gravando plano='none' (Fase 1), não o relógio — trigger só dispara
-- em escrita, então derivar acesso de plano_ate deixaria linha vencida com acesso vivo.
alter table public.fp_perfil
  add column if not exists plano_ate timestamptz;

-- ============================================================================
-- 2. Backfill — quem já tinha acesso pago comprou o pacote completo (WhatsApp + FP),
--    que é exatamente o 'assistente'.
-- ============================================================================
update public.fp_perfil
   set plano = 'assistente'
 where acesso_pago
   and plano = 'none';

-- ============================================================================
-- 3. Trigger: sincroniza acesso_pago e barra auto-promoção pelo cliente
-- ============================================================================
-- O front faz PATCH/POST em fp_perfil com o token do próprio usuário (PerfilFP.jsx,
-- signup em App.jsx). Sem guarda, qualquer usuário mandaria plano='assistente' pelo
-- PostgREST e se liberaria sozinho — o mesmo furo que acesso_pago já tinha.
--
-- Roles: PostgREST entra como 'anon'/'authenticated'; a Edge Function do webhook usa
-- service_role; o SQL Editor roda como postgres. Só os dois primeiros são barrados.
-- A função é SECURITY INVOKER de propósito: sob SECURITY DEFINER, current_user viraria
-- o dono da função e a guarda nunca dispararia.
create or replace function public.fp_perfil_sync_plano()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') then
    -- Reverte em silêncio em vez de dar erro: o app nunca manda essas colunas, então
    -- levantar exceção só quebraria o cadastro se algum payload mudar sem querer.
    if tg_op = 'INSERT' then
      new.plano := 'none';
      new.plano_ate := null;
    else
      new.plano := old.plano;
      new.plano_ate := old.plano_ate;
    end if;
  end if;

  new.acesso_pago := (new.plano = 'assistente');
  return new;
end;
$$;

drop trigger if exists trg_fp_perfil_sync_plano on public.fp_perfil;
create trigger trg_fp_perfil_sync_plano
  before insert or update on public.fp_perfil
  for each row execute function public.fp_perfil_sync_plano();

-- ============================================================================
-- Runbook
-- ============================================================================
-- Liberar na mão (emergência / cliente que pagou fora da Cakto) — o telefone é o
-- identificador que o app grava normalizado. Escolha o plano certo: 'assistente'
-- liga WhatsApp + FP, 'essencial' não liga nada disso:
--
--   update public.fp_perfil set plano = 'assistente', plano_ate = now() + interval '30 days'
--    where telefone = '5511999998888';
--
-- Por e-mail, pra conta antiga sem telefone:
--
--   update public.fp_perfil set plano = 'essencial', plano_ate = now() + interval '30 days'
--    where user_id = (select id from auth.users where email = 'cliente@exemplo.com');
--
-- Revogar:
--
--   update public.fp_perfil set plano = 'none', plano_ate = null where telefone = '5511999998888';
--
-- Conferir (acesso_pago aparece só pra provar que o trigger sincronizou):
--
--   select user_id, nome, telefone, plano, plano_ate, acesso_pago
--     from public.fp_perfil where plano <> 'none' order by plano_ate nulls last;
