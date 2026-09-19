-- 2026-09-19 (e) — RANKING de metas
--
-- Brief: Chave Mestre, Projetos/PRADEX/briefs/2026-09-19_ranking-e-pontuacao-de-metas.md
--
-- Decisões do Lucas (19/09): ranking **geral** (entre amigos convidados fica pra
-- depois) e **tudo grátis** — "pro cara colocar mais de 1 meta ele vai pro Essencial",
-- ou seja, o paywall já está no limite de metas e cobrar de novo pelo ranking seria
-- cobrar duas vezes pelo mesmo comportamento.
--
-- ============================================================================
-- O VETO QUE ESTE ARQUIVO PRECISA RESPEITAR
-- ============================================================================
-- briefs/2026-09-12_modo-caos-copy.md, na lista do que nunca fazer:
--
--   "90% do pessoal segura. Você não." — Compara com os outros. O Pradex é o Lucas
--   na orelha, não um feed. Comparação social em dinheiro é o jeito mais rápido de
--   o cliente odiar o produto.
--
-- O ranking só existe porque é o contrário disso em três eixos, e os três estão
-- implementados aqui, não só no discurso:
--
--   1. CONQUISTA, não estrago — soma marco de meta, nunca gasto.
--   2. OPT-IN — quem não escolheu um apelido não aparece. `apelido is null` é o
--      estado inicial de todo mundo, então ninguém entra sem ter pedido.
--   3. EM PONTOS, nunca em reais — a RPC não devolve valor de meta, valor guardado,
--      nome da meta nem e-mail. Só apelido, pontos e quantas metas fechou.
--
-- Se qualquer um dos três cair, o veto de 12/09 volta a valer.

-- ============================================================================
-- 1. Apelido — a porta de entrada, fechada por padrão
-- ============================================================================
-- NÃO reusa `fp_perfil.nome`: aquele é o nome REAL, veio do Planejamento Financeiro,
-- e publicá-lo num placar seria expor gente que preencheu um cadastro financeiro.
alter table public.fp_perfil add column if not exists apelido text;

comment on column public.fp_perfil.apelido is
  'Como a pessoa aparece no ranking de metas. NULL = fora do ranking (padrão). Nunca usar fp_perfil.nome pra isso: aquele é nome real.';

-- Dois "Lucas" no placar viram confusão sobre quem é quem.
create unique index if not exists fp_perfil_apelido_idx on public.fp_perfil (lower(apelido))
  where apelido is not null;

-- ============================================================================
-- 2. A RPC
-- ============================================================================
-- SECURITY DEFINER porque precisa ler marcos e apelidos de OUTRAS pessoas — as
-- policies de `metas`, `meta_marcos` e `fp_perfil` continuam fechadas em
-- `user_id = auth.uid()`, exatamente como a migration de 16/09 antecipou que seria.
--
-- É a única porta pra esse dado, e ela devolve o mínimo: apelido, pontos, contagem.
create or replace function public.ranking_metas(p_limite int default 20)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  eu uuid := auth.uid();
  resultado jsonb;
begin
  return (
    with validas as (
      -- A REGRA DAS DUAS DATAS (decisão do Lucas, 19/09). Não é antifraude — ele
      -- decidiu não policiar, e "se fraudarem pra postar, é bom pro marketing".
      --
      -- É sobre o número significar algo: se desse pra criar uma meta de R$ 50
      -- "difícil" e concluir em um minuto, o topo do placar viraria lixo numa semana
      -- e ninguém honesto ia querer aparecer nele — morreria de irrelevância, não de
      -- fraude. Quem está juntando de verdade passa por isto sem perceber; quem está
      -- fabricando precisa voltar amanhã.
      --
      -- Só 'gasto': resgatar não é aportar, e duas retiradas não podem virar
      -- "duas datas".
      select m.id, m.user_id
        from public.metas m
       where (
         select count(distinct l.data_lancamento)
           from public."Lancamentos" l
          where l.meta_id = m.id and l.tipo = 'gasto'
       ) >= 2
    ),
    pontos as (
      select v.user_id,
             sum(mm.pontos)::int as pontos,
             count(*) filter (where mm.marco = 100)::int as concluidas
        from validas v
        join public.meta_marcos mm on mm.meta_id = v.id
       group by v.user_id
    ),
    -- A classificação acontece SÓ entre quem tem apelido. Rankear todo mundo e
    -- depois filtrar deixaria buracos na numeração (1, 3, 7...) causados por gente
    -- invisível — e a pessoa no "3º lugar" não teria como saber por que pulou o 2º.
    no_placar as (
      select p.user_id, p.pontos, p.concluidas, fp.apelido,
             rank() over (order by p.pontos desc)::int as posicao
        from pontos p
        join public.fp_perfil fp on fp.user_id = p.user_id
       where fp.apelido is not null
    )
    select jsonb_build_object(
      'top', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'apelido',    t.apelido,
                 'pontos',     t.pontos,
                 'concluidas', t.concluidas,
                 'posicao',    t.posicao,
                 'sou_eu',     t.user_id = eu
               ) order by t.posicao, t.apelido)
          from (select * from no_placar order by posicao, apelido limit p_limite) t
      ), '[]'::jsonb),
      -- Os próprios números saem MESMO SEM APELIDO: quem ainda não entrou precisa
      -- ver o que já tem, senão o convite pra entrar é um convite às cegas.
      -- `posicao` vem null nesse caso — não existe posição fora do placar.
      'eu', coalesce((
        select jsonb_build_object(
                 'pontos',     p.pontos,
                 'concluidas', p.concluidas,
                 'apelido',    (select fp.apelido from public.fp_perfil fp where fp.user_id = eu),
                 'posicao',    (select np.posicao from no_placar np where np.user_id = eu)
               )
          from pontos p where p.user_id = eu
      ), jsonb_build_object(
                 'pontos', 0, 'concluidas', 0,
                 'apelido', (select fp.apelido from public.fp_perfil fp where fp.user_id = eu),
                 'posicao', null)),
      'total', (select count(*) from no_placar)
    )
  );
end;
$$;

revoke all on function public.ranking_metas(int) from public;
grant execute on function public.ranking_metas(int) to authenticated;

-- ============================================================================
-- Conferir depois de rodar
-- ============================================================================
--   select public.ranking_metas(20);   -- roda como postgres: 'eu' vem zerado, o
--                                      -- 'top' é o que importa aqui
--   select column_name from information_schema.columns
--    where table_name='fp_perfil' and column_name='apelido';
