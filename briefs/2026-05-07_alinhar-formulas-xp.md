# Brief — Alinhar fórmulas do DiagnosticoFP com a XP (modo Valor Presente)

> **Para o Claude Code:** auto-contido. Leia inteiro antes de tocar em código. Execução end-to-end: edição → validação Node → teste local → commit → push.

**Data:** 2026-05-07
**Projeto:** Pradex Finanças
**Caminho:** `C:\Users\lucas\Documents\pradex-financas\`
**Arquivo a modificar:** `src/components/fp/DiagnosticoFP.jsx`
**Branch:** `main`

---

## 1. Contexto

A fórmula da XP foi decifrada em 2026-05-07 a partir do PDF oficial "Planejamento Financeiro - Lucas D'Angelo Pradella" (conta 2954556, gerado em 07/05/2026). Validação numérica em Node reproduziu os 5 valores oficiais com gap < 0,4%.

**Descobertas-chave:**

1. **A XP só usa modo Valor Presente** (taxa real 4,5%, IPCA = 0). Não usa modo Nominal pra essas contas.
2. **Mistura convenções:** annuity due na acumulação (aporte no início do mês), **ordinária** na retirada (saque no fim do mês).
3. **Sem gradiente, sem renda crescente** — em VP a renda é constante.

O código atual do `DiagnosticoFP.jsx` em modo VP (default desde commit `b8cafba`) está ~97% certo. Faltam **3 ajustes cirúrgicos** pra alinhamento total.

---

## 2. As 3 mudanças

### 2.1. `pvAnuidadeCrescente` — remover `(1+i)` extra

**Função atual (L49-55):**
```javascript
function pvAnuidadeCrescente(PMT_inicial, n_meses, i, g) {
  if (Math.abs(i - g) < 1e-10) {
    return PMT_inicial * n_meses * (1 + i);
  }
  const razao = (1 + g) / (1 + i);
  return PMT_inicial * ((1 - Math.pow(razao, n_meses)) / (i - g)) * (1 + i);
}
```

**Mudança:** remover o `* (1 + i)` final em ambos os caminhos. A XP usa anuidade ordinária na retirada (saque no fim do mês).

**Função após mudança:**
```javascript
function pvAnuidadeCrescente(PMT_inicial, n_meses, i, g) {
  if (Math.abs(i - g) < 1e-10) {
    return PMT_inicial * n_meses;
  }
  const razao = (1 + g) / (1 + i);
  return PMT_inicial * ((1 - Math.pow(razao, n_meses)) / (i - g));
}
```

### 2.2. `pvPerpetuidadeCrescente` — remover `(1+i)` extra

**Função atual (L58-63):**
```javascript
function pvPerpetuidadeCrescente(PMT_inicial, i, g) {
  if (i <= g) {
    throw new Error('Taxa precisa ser maior que inflação para perpetuidade crescente');
  }
  return (PMT_inicial / (i - g)) * (1 + i);
}
```

**Mudança:** remover o `* (1 + i)` final.

**Função após mudança:**
```javascript
function pvPerpetuidadeCrescente(PMT_inicial, i, g) {
  if (i <= g) {
    throw new Error('Taxa precisa ser maior que inflação para perpetuidade crescente');
  }
  return PMT_inicial / (i - g);
}
```

### 2.3. `simular` — fase de retirada com saque ordinário

**Função atual (L97-117):** o loop interno faz `pat = (pat - saqueCorrente) * (1 + i_mes)` na fase de retirada — isso é annuity due (saque no início, depois rende). A XP usa ordinária (rende primeiro, depois saque).

**Mudança:** trocar a ordem de operações **apenas na fase de retirada** (não tocar na fase de acumulação, que continua annuity due).

**Loop interno após mudança:**
```javascript
for (let m = 0; m < 12; m++) {
  if (acumulando) {
    pat = (pat + aporteCorrente) * (1 + i_mes);  // mantém — annuity due
    if (aporteCresceComIpca) aporteCorrente *= (1 + g_mes);
  } else {
    pat = pat * (1 + i_mes) - saqueCorrente;     // MUDOU — ordinária
    if (pat < 0) pat = 0;
    saqueCorrente *= (1 + g_mes);
  }
}
```

---

## 3. Validação numérica esperada (após as 3 mudanças)

Cenário do PDF da XP (idade 32, aposentadoria 65, expectativa 93, VP=R$ 99.514,05, aporte=R$ 11.179,24, renda=R$ 18.000, IPCA+4,5%):

**Modo Valor Presente (default):**
| Métrica | Esperado (XP) | Tolerância |
|---|---|---|
| Patrimônio aos 65 | R$ 10.434.687 | ±0,5% |
| PV Consumo | R$ 3.464.789 | ±0,5% |
| PV Preservação | R$ 4.898.213 | ±0,1% |
| Aporte mín. Consumo | R$ 3.417 | ±0,5% |
| Aporte mín. Preservação | R$ 5.020 | ±0,5% |

Pra rodar validação rápida em Node antes de commitar (não precisa montar React, só replicar as funções):

```bash
cat > /tmp/v.mjs << 'EOF'
const i_mes = Math.pow(1.045, 1/12) - 1;
const VP = 99514.05, PMT = 11179.24, n_acum = 396, n_dist = 336, renda = 18000;

const pow = (b,e) => Math.pow(b,e);
const VF_atual = VP*pow(1+i_mes,n_acum) + PMT*((pow(1+i_mes,n_acum)-1)/i_mes)*(1+i_mes);
const PV_cons = renda*(1-pow(1+i_mes,-n_dist))/i_mes;            // SEM (1+i)
const PV_pres = renda/i_mes;                                       // SEM (1+i)
const fator_acum = ((pow(1+i_mes,n_acum)-1)/i_mes)*(1+i_mes);
const ap_cons = (PV_cons - VP*pow(1+i_mes,n_acum))/fator_acum;
const ap_pres = (PV_pres - VP*pow(1+i_mes,n_acum))/fator_acum;
console.log(`VF Atual:    ${VF_atual.toFixed(0)} (esp 10.434.687)`);
console.log(`PV Consumo:  ${PV_cons.toFixed(0)} (esp 3.464.789)`);
console.log(`PV Preserv:  ${PV_pres.toFixed(0)} (esp 4.898.213)`);
console.log(`Ap Consumo:  ${ap_cons.toFixed(0)} (esp 3.417)`);
console.log(`Ap Preserv:  ${ap_pres.toFixed(0)} (esp 5.020)`);
EOF
node /tmp/v.mjs
```

**Modo Nominal:** pode mudar (pq as fórmulas alteradas afetam os dois modos), mas como a XP não usa Nominal, não há benchmark. Documentar o que aparece após a mudança e seguir.

---

## 4. Validação visual

```bash
cd C:\Users\lucas\Documents\pradex-financas
npm run dev
```

Abrir `localhost:5173` → FP → Diagnóstico:
- Modo VP (default): verificar que com dados próximos do cenário do PDF (VP ~100k, aporte ~11k, renda 18k) os 3 cards mostram números consistentes com o PDF da XP
- Toggle pra Nominal e voltar pra VP: garantir que recálculo funciona sem erro

---

## 5. Commit e push

```bash
cd C:\Users\lucas\Documents\pradex-financas
git add src/components/fp/DiagnosticoFP.jsx
git commit -m "fix(fp): alinhar fórmulas pvAnuidade/pvPerpetuidade/simular com XP (modo VP, anuidade ordinária na retirada)"
git push
```

---

## 6. Reportar ao Lucas

1. Hash do commit
2. Resultado da validação Node (5 métricas, gaps vs XP)
3. Confirmação de push em `origin/main`
4. Qualquer comportamento inesperado no modo Nominal após a mudança (gaps esperados, mas registrar)
