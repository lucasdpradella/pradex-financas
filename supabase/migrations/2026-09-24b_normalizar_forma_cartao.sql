-- 2026-09-24b — "cartão XP" também é Crédito
--
-- normalizar_forma_pagamento aceitava "cartão" e "crédito", mas "cartão XP"
-- (ou "cartão Santander") voltava cru. O fechamento compara com "Crédito".
-- "cartão de débito" continua Débito e precisa ser testado antes do prefixo.
--
-- A fala do WhatsApp ("no crédito", "cartão XP") não está na linha. Quem lê
-- isso é a edge `agente-pradex` (`prepararAcao`) antes deste RPC. Insert que
-- escapar da edge só ganha a string já gravada em forma_pagamento — daí o
-- backfill abaixo. Rodar de novo não duplica nada.

create or replace function public.normalizar_forma_pagamento(p text)
returns text
language plpgsql
immutable
as $$
declare
  n text := btrim(public.texto_sem_acento(p));
begin
  if p is null or btrim(p) = '' then
    return null;
  end if;
  if n in ('debito', 'debito em conta', 'cartao de debito') or n like 'cartao de debito%' then
    return 'Débito';
  end if;
  if n in ('credito', 'cartao', 'cartao de credito', 'credito parcelado')
     or n like 'credito %'
     or n like 'cartao %' then
    return 'Crédito';
  end if;
  if n = 'pix' then
    return 'PIX';
  end if;
  if n in ('pix/debito', 'pix / debito') then
    return 'PIX/Débito';
  end if;
  if n = 'saldo da conta' then
    return 'Saldo da conta';
  end if;
  if n in ('dinheiro', 'especie') then
    return 'Dinheiro';
  end if;
  if n = 'outros' then
    return 'Outros';
  end if;
  return btrim(p);
end;
$$;

update public."Lancamentos"
   set forma_pagamento = public.normalizar_forma_pagamento(forma_pagamento)
 where forma_pagamento is not null
   and forma_pagamento is distinct from public.normalizar_forma_pagamento(forma_pagamento);
