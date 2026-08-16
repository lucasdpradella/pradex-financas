-- 2026-08-15 — Gate de acesso pago (Pradex 1:1 / Pradex 360)
--
-- Um flag só, reusado pelos dois gates do front: agente WhatsApp e Diagnóstico FP.
-- Default false = ninguém tem acesso até o Lucas liberar manualmente.
-- Não há webhook de pagamento nesta rodada: liberação é UPDATE na mão (ver abaixo).

alter table public.fp_perfil
  add column if not exists acesso_pago boolean not null default false;

-- Liberar um cliente (o telefone é obrigatório no cadastro, então é o identificador
-- mais confiável; use o formato normalizado que o app grava, ex.: '5511999998888'):
--
--   update public.fp_perfil set acesso_pago = true where telefone = '5511999998888';
--
-- Alternativa por e-mail, pra contas antigas sem telefone:
--
--   update public.fp_perfil set acesso_pago = true
--   where user_id = (select id from auth.users where email = 'cliente@exemplo.com');
--
-- Revogar: mesma coisa com acesso_pago = false.
-- Conferir quem tem acesso hoje:
--
--   select user_id, nome, telefone, acesso_pago from public.fp_perfil where acesso_pago;
