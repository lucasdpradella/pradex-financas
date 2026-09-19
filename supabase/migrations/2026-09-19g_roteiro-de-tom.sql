-- 2026-09-19 (g) — Roteiro de teste de tom: um modo por dia
--
-- Pedido do Lucas: "eu queria ir testar no dia a dia, coloque cada um dos modos
-- comigo 1 por dia por 3 dias — são 3 modos? se for 4 modos, 4 dias."
--
-- São 4: três TONS (seco, caos, elogio) e mais o "cala", que não é tom e sim
-- silêncio. Ele merece um dia próprio porque o que se testa nele é justamente o que
-- eu decidi sozinho hoje de manhã: que silêncio é sobre BARULHO e não sobre serviço
-- — o lançamento continua sendo registrado e confirmado, só sem comentário. Se ele
-- discordar disso, é no dia do silêncio que vai perceber.
--
-- Ordem, e ela tem razão de ser:
--   20/09  caos     primeiro porque é o que ele quer julgar, e com o dia inteiro pela frente
--   21/09  elogio   o contraste mais forte com o caos, no dia seguinte
--   22/09  cala     o mais quieto, e o que exige menos atenção dele
--   23/09  seco     por último porque é o PADRÃO — a conta termina onde deve ficar
--
-- Tabela e não quatro jobs datados: assim ele vê o roteiro inteiro numa query, muda
-- a ordem com um update, e nada fica agendado no pg_cron pra sempre esperando o dia
-- 20 de setembro do ano que vem.

create table if not exists public.agente_tom_roteiro (
  dia         date primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  tom         text not null check (tom in ('seco', 'caos', 'elogio')),
  -- true = além do tom, entra em silêncio de 24h naquele dia.
  silenciar   boolean not null default false,
  nota        text,
  aplicado_em timestamptz
);

alter table public.agente_tom_roteiro enable row level security;
-- Sem policy: quem lê e escreve é o job (service role). É tabela de operação.

-- ============================================================================
-- A função que o cron chama
-- ============================================================================
-- Idempotente pelo `aplicado_em is null`: rodar duas vezes no mesmo dia não reaplica
-- (e, no caso do silêncio, não renova as 24h sem ele ter pedido).
create or replace function public.aplicar_tom_do_dia()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select * from public.agente_tom_roteiro
     where dia = current_date and aplicado_em is null
  loop
    update public.fp_perfil
       set agente_tom = r.tom,
           -- Sempre limpa o elogio: o roteiro manda, e um elogio de 24h de ontem
           -- sobrepujaria o tom de hoje.
           agente_elogio_ate = case when r.tom = 'elogio' then now() + interval '24 hours' else null end,
           agente_silencio_ate = case when r.silenciar then now() + interval '24 hours' else null end
     where user_id = r.user_id;

    update public.agente_tom_roteiro set aplicado_em = now() where dia = r.dia;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ============================================================================
-- O roteiro do Lucas
-- ============================================================================
insert into public.agente_tom_roteiro (dia, user_id, tom, silenciar, nota)
select d.dia, fp.user_id, d.tom, d.silenciar, d.nota
  from public.fp_perfil fp,
       (values
         ('2026-09-20'::date, 'caos',   false, 'Dia do caos. Lança normal e vê se o sarro soa como você.'),
         ('2026-09-21'::date, 'elogio', false, 'Dia do elogio. O contraste com ontem é o teste.'),
         ('2026-09-22'::date, 'seco',   true,  'Dia do cala. Ele registra e confirma, sem comentar nada.'),
         ('2026-09-23'::date, 'seco',   false, 'Volta ao padrão. Fim do roteiro.')
       ) as d(dia, tom, silenciar, nota)
 where fp.telefone = '5511966298633'
on conflict (dia) do nothing;

-- ============================================================================
-- Conferir
-- ============================================================================
--   select dia, tom, silenciar, aplicado_em, nota from public.agente_tom_roteiro order by dia;
--   select agente_tom, agente_silencio_ate, agente_elogio_ate from public.fp_perfil
--    where telefone = '5511966298633';
--
-- Desistir no meio: delete from public.agente_tom_roteiro where dia > current_date;
