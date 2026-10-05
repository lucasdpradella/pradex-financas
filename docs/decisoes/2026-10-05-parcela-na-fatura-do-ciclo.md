# 2026-10-05 — parcela cai na fatura em que o banco cobra

A fatura "pelo fechamento" usava a `data_lancamento` da linha. Parcela gravada na data da compra (ex.: Vortech 2/2 em 19/08) ficava fora do ciclo 02/09–01/10 do cartão que fecha dia 1 e vence dia 12, e a fatura com vencimento 12/10 perdia esse valor. Muita linha antiga também só tem "2/2" ou "15/15" no texto, com `parcela_atual` / `total_parcelas` vazios.

## Modelo

Continua **uma linha por parcela** (`parcela_atual`, `total_parcelas`, `parcela_grupo_id`). O app e o RPC `agente_aplicar_acoes` já criam as N linhas. Não houve migration.

## O que mudou

- A parcela 1 cai no ciclo que contém a data da compra (`cicloQueContem`). A parcela k cai k−1 ciclos depois, pelo dia de fechamento do cartão (`cicloDaParcela`). Compra no dia do fechamento fica na fatura que fecha nesse dia.
- Linhas com a mesma data (ou uma linha só) tratam essa data como a **data da compra**, mesmo se o texto disser 2/2. Linhas já espalhadas mês a mês usam a data da menor parcela como a data em que ela é cobrada — não desloca de novo.
- Texto `n/m` no fim da descrição preenche o índice só na leitura, quando o campo está vazio. Não grava e não corrige o histórico. Não casa data (`19/08`, `02/10/2026`) nem faixa (`14/15`).
- Parcela que ainda não tem linha é projetada só em ciclo que **ainda não fechou**, na fatura pelo fechamento e em "Parcelas que ainda vêm" (próximos 3 meses, formato `5/6x`). Fatura já fechada não ganha valor inventado.
- Lançamento novo no app grava a data dentro do ciclo de cobrança. O agente passa a preencher `parcelado` e `total_parcelas` quando a fala traz "10x", "em 10 vezes" ou "parcela 2 de 6", se o modelo esquecer. O RPC segue criando as linhas e os campos.

## O que não mudou

- **Fatura do cartão no mês** ("por data da compra", outubro na home) continua pela `data_lancamento` gravada. Débito, receitas, gasto e metas não se mexem. A 2/2 datada em 19/08 segue em agosto nessa visão, até um acerto de dados à parte.
- A face "Pelo fechamento" / "Quando você paga" continua atrás de `FATURA_PELO_FECHAMENTO = false` (decisão de 03/10). O cálculo (`listarFaturas`) já inclui a parcela no ciclo certo quando a face ligar.
- `editar_compra_parcelada` e o `INSERT` do agente ainda somam meses no calendário. A visão pelo fechamento não depende disso quando a parcela 1 existe.

## Exemplo

Compra em 19/08/2026, cartão fecha dia 1 e vence dia 12, parcela 2/2 — mesmo com a linha datada em 19/08:

- ciclo 02/09–01/10
- vencimento 12/10/2026
