# Copy — paywall do Pradex

Padrão: a tela fica aberta. O paywall aparece na intenção (salvar, destampar, ativar). Convite, não catraca. Sem palavrão. Sem fazer a pessoa se sentir pobre ou burra.

Planos: Free (dashboard, lançar, histórico, cartões, bancos, categorias — ilimitado) · Essencial R$ 29,90/mês (agente no WhatsApp + orçamento por categoria) · Assistente (Planejamento Financeiro + Relatórios).

> ⚠️ **Correção aplicada em 2026-09-12 (Claude Code):** o rascunho original trazia **R$ 9,90** nas 7 ocorrências. O preço real do Essencial é **R$ 29,90** — é o que as mensagens do agente em produção usam (`supabase/functions/trial-lembretes/index.ts:43,47`). Corrigido antes de qualquer copy chegar na tela.

---

## 1. Orçamento

Free monta o teto e tenta salvar.

**Variação A — seco**
- Título: Teto salvo no Essencial
- Corpo: Você definiu o limite. Pra ele valer no mês — e o agente te avisar nos 90% — é o Essencial.
- Botão: Assinar Essencial · R$ 29,90/mês
- Secundário: agora não

**Variação B — caos leve**
- Título: Limite sem plano não segura
- Corpo: Anotar o teto e não acompanhar é lista na gaveta. Essencial guarda e cobra quando passa.
- Botão: Quero o Essencial, R$ 29,90
- Secundário: agora não

**Variação C — convite**
- Título: Quer que eu cubra isso?
- Corpo: O teto está pronto. Se salvar, eu passo a contar. Isso é Essencial, R$ 29,90 por mês.
- Botão: Salvar no Essencial
- Secundário: agora não

---

## 2. Planejamento Financeiro

Free ou Essencial vê o gráfico borrado. A legenda diz o que é, sem entregar o número.

**Variação A — seco**
- Legenda no borrado: Seu ano, se este mês se repetir. A dobra é o ponto em que o ritmo atual não segura a meta.
- Título: O gráfico é o Assistente
- Corpo: Você está vendo a curva. Número, cenário e ajuste saem no Assistente.
- Botão: Ver no Assistente
- Secundário: agora não

**Variação B — caos leve**
- Legenda no borrado: A faixa mais clara é o furo — onde o que você planejou não cobre o que você prometeu pra você.
- Título: Curiosidade não paga a meta
- Corpo: O borrado é proposital. Assistente mostra o número e deixa você mexer no cenário.
- Botão: Abrir o Assistente
- Secundário: agora não

**Variação C — convite**
- Legenda no borrado: Cada coluna é um mês. A mais alta não é vitória: é o mês em que entra mais do que sai, se nada mudar.
- Título: Isso tem nome: cenário
- Corpo: Relatórios e planejamento ficam no Assistente. O gráfico já está aí. Falta destampar.
- Botão: Destampar no Assistente
- Secundário: agora não

---

## 3. Agente no WhatsApp

Free tenta ativar / conectar / mandar o primeiro comando.

**Variação A — seco**
- Título: O agente é o Essencial
- Corpo: Você lança aqui à vontade. No Zap eu cobro teto, padrão e meta. Isso é Essencial.
- Botão: Ativar no Essencial · R$ 29,90/mês
- Secundário: agora não

**Variação B — caos leve**
- Título: Aqui eu anoto. Lá eu cobro.
- Corpo: No app você lança sozinho. No WhatsApp eu falo quando passa de 90% — no tom que você escolher.
- Botão: Quero o agente, R$ 29,90
- Secundário: agora não

**Variação C — convite**
- Título: Zap não é recado de graça
- Corpo: Registrar no app é Free. Ter alguém no bolso te cutucando no dia é Essencial.
- Botão: Assinar Essencial
- Secundário: agora não

---

## 4. A mensagem da recompensa

Uma vez na vida: disciplina 80 → 14 dias de trial + 20% no primeiro mês.

**(a) Aviso no app, quando bate 80**
- Título: Disciplina 80. Vale uma vez.
- Corpo: 14 dias pra testar e 20% no primeiro mês. Sem segunda chance, sem acumular, sem passar adiante.
- Botão: Usar agora
- Secundário: depois

**(b) Mensagem no WhatsApp**
`Bateu 80 de disciplina. Uma vez na vida: 14 dias pra testar e 20% no primeiro mês. Se deixar passar, passou.`

**(c) Já usou o prêmio e tenta de novo**
- Título: Esse já foi.
- Corpo: Uma vez na vida quer dizer uma. O plano segue no preço cheio.
- Botão: Ver planos
- Secundário: agora não

---

## 5. Erros a evitar

1. `Desbloqueie agora!!!`
   Grito de catraca. O Pradex não implora. Quem fala assim já perdeu o tom.

2. `Você não pode usar isso.`
   Faz a pessoa se sentir pequena. A tela está aberta de propósito: ela pode mexer. O não é no salvar, não na existência.

3. `Por menos que um café por dia.`
   Bajula e rebaixa o preço. R$ 29,90 se explica sozinho. Café é desculpa de infoproduto.

4. `Os usuários Pro economizam R$ 3.200 por ano.`
   Inventa patrimônio, compara com os outros e gamifica valor. Quebra a tese do produto.

5. `Última chance. Oferta acaba hoje.`
   Urgência falsa. A recompensa de 80 é uma vez na vida — isso já é o limite. Mentir relógio queima confiança no agente.
