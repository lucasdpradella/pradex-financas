-- 2026-09-18 — Apelido de e-mail: a compra num e-mail, a conta em outro
--
-- O PROBLEMA, com nome e hora. O Augusto comprou o Essencial em 16/09 às 17:12 com
-- `augusto.santosalmeida@outlook.com` e criou a conta no app às 19:46 com
-- `guto@innovabr.com.br`. Duas horas e dois e-mails.
--
-- A Cakto e o app são sistemas que não se conhecem: o ÚNICO elo entre uma compra e
-- uma conta é o e-mail. Divergiu, não casa — e a assinatura dele nunca virou acesso.
-- Ficou dois dias pagando sem ter o produto, e ninguém ficou sabendo.
--
-- POR QUE ISTO, E NÃO OUTRA COISA. Havia quatro saídas:
--   1. pedir pro suporte da Cakto trocar o e-mail — depende deles, caso a caso
--   2. trocar o e-mail da CONTA do cliente — muda o login dele, e a escolha é dele
--   3. deixar quebrar e resolver na mão todo mês, agora com aviso
--   4. esta: uma tabela que diz "a compra com este e-mail pertence a esta conta"
--
-- As três primeiras resolvem UM caso. Esta resolve a classe: cadastra uma vez por
-- cliente divergente e o webhook passa a achar sozinho, na renovação e sempre.
-- E não depende da Cakto nem de incomodar o cliente.
--
-- O e-mail pré-preenchido no checkout (PR #81) reduz a chance de isto acontecer, mas
-- não zera: quem paga ANTES de criar conta continua podendo divergir. Por isso as
-- duas coisas existem, e nenhuma substitui a outra.

-- ============================================================================
-- 1. A tabela
-- ============================================================================
create table if not exists public.assinatura_alias (
  -- O e-mail usado NA COMPRA. PK porque um e-mail de compra pertence a uma conta só.
  email_compra text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- Pra daqui a seis meses alguém saber por que esta linha existe.
  nota         text,
  criado_em    timestamptz not null default now()
);

create index if not exists assinatura_alias_user_idx on public.assinatura_alias (user_id);

-- Normaliza na escrita. Sem isto, "Augusto@Outlook.com" e "augusto@outlook.com"
-- viram duas linhas e a busca (que usa lower) só acha uma delas.
create or replace function public.assinatura_alias_normaliza()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.email_compra := lower(btrim(new.email_compra));
  return new;
end;
$$;

drop trigger if exists trg_assinatura_alias_normaliza on public.assinatura_alias;
create trigger trg_assinatura_alias_normaliza
  before insert or update on public.assinatura_alias
  for each row execute function public.assinatura_alias_normaliza();

-- RLS ligada e NENHUMA policy: ninguém lê isto pelo PostgREST. Quem precisa é a Edge
-- Function, que usa service_role e passa por cima da RLS. Uma tabela que liga e-mail
-- de compra a usuário é exatamente o tipo de coisa que não pode vazar.
alter table public.assinatura_alias enable row level security;

-- ============================================================================
-- 2. O lookup passa a olhar o apelido
-- ============================================================================
-- A Edge Function NÃO MUDA: ela já chama `fp_user_id_por_email`. Estendendo aqui, o
-- benefício vale pra qualquer outro consumidor que venha depois.
--
-- ORDEM IMPORTA: conta direta primeiro, apelido só como fallback. Se a pessoa criar
-- uma conta com o e-mail da compra mais tarde, essa conta ganha — um apelido antigo
-- não pode sequestrar um e-mail que virou conta de verdade.
create or replace function public.fp_user_id_por_email(p_email text)
returns uuid
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select coalesce(
    (select u.id from auth.users u
      where lower(u.email) = lower(btrim(p_email)) limit 1),
    (select a.user_id from public.assinatura_alias a
      where a.email_compra = lower(btrim(p_email)) limit 1)
  );
$$;

revoke all on function public.fp_user_id_por_email(text) from public;
revoke all on function public.fp_user_id_por_email(text) from anon;
revoke all on function public.fp_user_id_por_email(text) from authenticated;
grant execute on function public.fp_user_id_por_email(text) to service_role;

-- ============================================================================
-- 3. O caso que originou tudo
-- ============================================================================
insert into public.assinatura_alias (email_compra, user_id, nota)
select
  'augusto.santosalmeida@outlook.com',
  u.id,
  'Comprou o Essencial em 16/09 17:12 com este e-mail e criou a conta às 19:46 com guto@innovabr.com.br. A Cakto não permite editar o e-mail da assinatura pelo painel do produtor (só Detalhes e Cancelar).'
from auth.users u
where lower(u.email) = 'guto@innovabr.com.br'
on conflict (email_compra) do nothing;

-- ============================================================================
-- COMO CADASTRAR UM APELIDO NOVO (quando chegar o aviso "pagou e não liberou")
-- ============================================================================
--   insert into public.assinatura_alias (email_compra, user_id, nota)
--   select 'EMAIL_DA_COMPRA@x.com', u.id, 'por que este apelido existe'
--     from auth.users u
--    where lower(u.email) = 'EMAIL_DA_CONTA_NO_APP@y.com'
--   on conflict (email_compra) do nothing;
--
-- Depois de cadastrar, liberar o plano desta vez continua sendo manual — o apelido
-- só passa a valer da próxima cobrança em diante.
--
-- ============================================================================
-- Conferir depois de rodar
-- ============================================================================
--   -- deve devolver o user_id da conta guto@innovabr.com.br:
--   select public.fp_user_id_por_email('augusto.santosalmeida@outlook.com');
--
--   -- e continua achando quem tem conta direta:
--   select public.fp_user_id_por_email('guto@innovabr.com.br');
--
--   -- os apelidos cadastrados, com o e-mail da conta ao lado:
--   select a.email_compra, u.email as email_da_conta, a.nota
--     from public.assinatura_alias a join auth.users u on u.id = a.user_id;
