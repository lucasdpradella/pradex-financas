-- 2026-09-19 (d) — METAS: a dificuldade pode ser trocada depois, e os pontos seguem
--
-- Brief: Chave Mestre, Projetos/PRADEX/briefs/2026-09-19_ranking-e-pontuacao-de-metas.md §9
--
-- Eu tinha proposto TRAVAR a dificuldade no primeiro aporte, pra ninguém marcar
-- "fácil" e trocar pra "difícil" na hora de concluir. O Lucas decidiu o contrário:
--
--   "a dificuldade acho que pode ser alterada, a pessoa pode mudar de ideia ou
--    entender melhor com o tempo, sem crise — nesse caso sim vai diminuir ou
--    aumentar os pontos, tudo bem"
--
-- Ele está certo, e por um motivo que a trava ignorava: a pessoa declara a
-- dificuldade no dia em que CRIA a meta, que é exatamente o dia em que ela menos
-- sabe como vai ser. Descobrir no terceiro mês que "moderada" era otimismo é
-- aprendizado, não trapaça — e travar transformaria o aprendizado em erro
-- permanente.
--
-- ============================================================================
-- A distinção que isto cria, e que precisa sobreviver ao ranking
-- ============================================================================
-- "Pontos congelados" passa a significar UMA coisa só, e não duas:
--
--   ✅ CONGELADO contra mudança de RÉGUA (os pesos globais 4/7/10). Se um dia eles
--      mudarem, isso vira temporada nova — nunca reescrita do passado de todo mundo.
--
--   ❌ NÃO congelado contra mudança da DIFICULDADE DAQUELA META. É declaração do
--      dono sobre a própria meta; se ele corrige, os pontos daquela meta corrigem
--      junto.
--
-- A diferença importa: a primeira mexeria no placar de gente que não fez nada; a
-- segunda mexe só no de quem mudou a própria declaração.

create or replace function public.metas_repesa_marcos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  peso integer;
begin
  -- Só quando a dificuldade muda de verdade. Sem esta guarda, todo update em `metas`
  -- (renomear, mudar prazo, arquivar, e o próprio update de progresso_max que a
  -- outra trigger faz) reescreveria a tabela de marcos à toa — e, pior, o update de
  -- progresso_max dispararia esta trigger em cadeia a cada aporte.
  if new.dificuldade is not distinct from old.dificuldade then
    return new;
  end if;

  peso := case new.dificuldade when 'facil' then 4 when 'dificil' then 10 else 7 end;

  update public.meta_marcos mm
     set pontos = (
           mm.marco - case mm.marco when 1 then 0 when 10 then 1 when 25 then 10
                                    when 50 then 25 when 75 then 50 when 90 then 75
                                    else 90 end
         ) * peso
   where mm.meta_id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_metas_repesa on public.metas;
create trigger trg_metas_repesa
  after update of dificuldade on public.metas
  for each row execute function public.metas_repesa_marcos();

-- `after update OF dificuldade`: a coluna no gatilho é a primeira barreira, e o
-- `is not distinct from` lá dentro é a segunda. Postgres dispara `update of` quando
-- a coluna é MENCIONADA no update, mesmo que o valor não mude — e o app manda a meta
-- inteira no PATCH.

-- ============================================================================
-- Conferir depois de rodar
-- ============================================================================
--   -- troca a dificuldade de uma meta e olha os pontos antes/depois:
--   select mm.marco, mm.pontos from public.meta_marcos mm
--     join public.metas m on m.id = mm.meta_id where m.nome = 'Casamento';
--   update public.metas set dificuldade = 'dificil' where nome = 'Casamento';
--   -- (marco 1 deve sair de 7 pra 10)
--
--   select tgname from pg_trigger where tgname = 'trg_metas_repesa';
