-- 2026-09-19 (b) — METAS: repesagem da dificuldade
--
-- Brief: Chave Mestre, Projetos/PRADEX/briefs/2026-09-19_ranking-e-pontuacao-de-metas.md
--
-- O Lucas olhou os pesos da migration de hoje mais cedo (2/3/4, razão 2×) e achou a
-- meta fácil generosa demais. Deu a âncora pronta:
--
--   "quem chega a 100% da fácil equivale a 40% da difícil"
--
-- Isso fixa a razão difícil/fácil em 2,5 — e não em 2. Pesos novos 4 / 7 / 10
-- (proporção 1 : 1,75 : 2,5), escolhidos inteiros pra os pontos continuarem fechando
-- sem arredondamento:
--
--   fácil inteira    = 100 × 4  =  400
--   40% de uma difícil = 40 × 10 =  400   ✅ a âncora
--   moderada inteira = 100 × 7  =  700
--   difícil inteira  = 100 × 10 = 1000
--
-- Cada marco continua valendo o INCREMENTO que representa (1, 9, 15, 25, 25, 15, 10),
-- e os sete somam 100 × peso em qualquer dificuldade.
--
-- ⚠️ ESTA MIGRATION REESCREVE PONTOS JÁ GRAVADOS — e é a única vez que isso pode
-- acontecer. `meta_marcos.pontos` é congelado de propósito (a dificuldade é editável;
-- recalcular na leitura faria o placar mudar no passado). A exceção se justifica
-- porque a régua mudou hoje, poucas horas depois de nascer, ainda sem ranking no ar e
-- com dois marcos gravados na base inteira. Depois que o placar existir, mudança de
-- peso vira temporada nova, não reescrita.

-- ============================================================================
-- 1. A trigger, com a régua nova
-- ============================================================================
create or replace function public.metas_marca_conclusao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  alvo_meta  bigint := coalesce(new.meta_id, old.meta_id);
  acumulado  numeric;
  alvo       numeric;
  dono       uuid;
  dific      text;
  peso       integer;
  progresso  numeric;
  pct        numeric;
  m          smallint;
  anterior   smallint;
  marcos     smallint[] := array[1, 10, 25, 50, 75, 90, 100];
begin
  if alvo_meta is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(case when l.tipo = 'gasto' then l.valor else -l.valor end), 0)
    into acumulado
    from public."Lancamentos" l
   where l.meta_id = alvo_meta;

  select m2.valor_alvo, m2.user_id, m2.dificuldade
    into alvo, dono, dific
    from public.metas m2
   where m2.id = alvo_meta;

  if alvo is null or alvo <= 0 then
    return coalesce(new, old);
  end if;

  -- 4 / 7 / 10 — ver o cabeçalho. Mantido inteiro pra não arredondar ponto nenhum.
  peso := case dific when 'facil' then 4 when 'dificil' then 10 else 7 end;

  progresso := acumulado / alvo;
  pct := progresso * 100;

  if acumulado >= alvo then
    update public.metas set concluida_em = now()
     where id = alvo_meta and concluida_em is null;
  end if;

  update public.metas
     set progresso_max = greatest(progresso_max, progresso)
   where id = alvo_meta;

  foreach m in array marcos loop
    if (m = 1 and acumulado > 0) or (m > 1 and pct >= m) then
      anterior := case m when 1 then 0 when 10 then 1 when 25 then 10 when 50 then 25
                         when 75 then 50 when 90 then 75 else 90 end;

      insert into public.meta_marcos (meta_id, user_id, marco, pontos)
      values (alvo_meta, dono, m, (m - anterior) * peso)
      on conflict (meta_id, marco) do nothing;
    end if;
  end loop;

  update public.metas
     set marco_max = coalesce((select max(mm.marco) from public.meta_marcos mm where mm.meta_id = alvo_meta), 0)
   where id = alvo_meta;

  return coalesce(new, old);
end;
$$;

-- ============================================================================
-- 2. Os marcos já gravados, na régua nova
-- ============================================================================
-- Sem isto, os marcos de hoje de manhã ficariam na régua velha e o mesmo marco
-- valeria diferente dependendo do dia em que caiu.
update public.meta_marcos mm
   set pontos = (
         mm.marco - case mm.marco when 1 then 0 when 10 then 1 when 25 then 10
                                  when 50 then 25 when 75 then 50 when 90 then 75
                                  else 90 end
       ) * (case m.dificuldade when 'facil' then 4 when 'dificil' then 10 else 7 end)
  from public.metas m
 where m.id = mm.meta_id;

-- ============================================================================
-- Conferir depois de rodar
-- ============================================================================
--   select m.nome, m.dificuldade, mm.marco, mm.pontos
--     from public.meta_marcos mm join public.metas m on m.id = mm.meta_id
--    order by m.nome, mm.marco;
--
--   -- a âncora do Lucas, em SQL: as duas linhas têm que dar 400
--   select 100 * 4 as facil_inteira, 40 * 10 as quarenta_pct_da_dificil;
