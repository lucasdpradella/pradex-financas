# Brief — Toggle Nominal / Valor Presente no DiagnosticoFP

> **Para o Claude Code:** este arquivo é auto-contido. Leia inteiro antes de tocar em código. Execução de ponta a ponta: edição → teste local → commit → push. Lucas não revisa diff.

**Data:** 2026-05-07
**Projeto:** Pradex Finanças
**Caminho:** `C:\Users\lucas\Documents\pradex-financas\`
**Arquivo a modificar:** `src/components/fp/DiagnosticoFP.jsx` (único)
**Branch:** `main` (commit direto, padrão do projeto)

---

## 1. Objetivo

Transformar o `MODO_PROJECAO` (hoje constante hardcoded em escopo de módulo) em **toggle interativo de UI** com dois modos:

- **Valor Presente** (novo default) — taxa real 4,50% a.a., inflação 0%, mostra patrimônio em poder de compra de hoje
- **Nominal** — taxa nominal 9,2025% a.a. (`(1+IPCA)*(1+spread)-1`), inflação 4,5%, mostra reais futuros

Ao alternar, **todos os números, premissas exibidas e o gráfico** recalculam imediatamente.

**Por que default = Valor Presente:** decisão de produto registrada no snapshot de 2026-05-01 (Pradex/contexto.md, seção 4) — a XP usa VP como default e o cliente entende melhor sem se assustar com R$ 46M nominais aos 65 anos.

---

## 2. Estado atual do código (referência)

Em `DiagnosticoFP.jsx`, hoje:

```javascript
// Linhas 6-15 — constantes de módulo (não reativas)
const IPCA_ANUAL = 0.045;
const SPREAD_ANUAL = 0.045;
const TAXA_NOMINAL_ANUAL = (1 + IPCA_ANUAL) * (1 + SPREAD_ANUAL) - 1;
const MODO_PROJECAO = 'nominal';
const TAXA_ANUAL = MODO_PROJECAO === 'nominal' ? TAXA_NOMINAL_ANUAL : SPREAD_ANUAL;
const INFLACAO_ANUAL = MODO_PROJECAO === 'nominal' ? IPCA_ANUAL : 0;

const taxaMensal = (taxaAnual) => Math.pow(1 + taxaAnual, 1 / 12) - 1;
const i_mes = taxaMensal(TAXA_ANUAL);
const g_mes = taxaMensal(INFLACAO_ANUAL);
```

A função `calcularProjecoes` (L72-135) consome `i_mes`, `g_mes` e `INFLACAO_ANUAL` direto do escopo de módulo. Os labels nas linhas 304, 314 e 322 já comparam `MODO_PROJECAO === 'nominal'`, mas leem da constante.

As funções puras (`vfAcumulacaoComGradiente`, `pvAnuidadeCrescente`, `pvPerpetuidadeCrescente`, `pmtParaAtingirVF`) **recebem `i` e `g` como parâmetros** — não dependem do escopo de módulo. **Não mexer nelas** (já validadas contra a XP, gap < 0,4%).

---

## 3. Mudanças exatas

### 3.1. Remover do escopo de módulo

Apagar as linhas 9-15 (`MODO_PROJECAO`, `TAXA_ANUAL`, `INFLACAO_ANUAL`, `taxaMensal`, `i_mes`, `g_mes`).

**Manter** no escopo de módulo (continuam constantes verdadeiras):

```javascript
const IPCA_ANUAL = 0.045;
const SPREAD_ANUAL = 0.045;
const TAXA_NOMINAL_ANUAL = (1 + IPCA_ANUAL) * (1 + SPREAD_ANUAL) - 1;

const taxaMensal = (taxaAnual) => Math.pow(1 + taxaAnual, 1 / 12) - 1;
```

### 3.2. Refatorar `calcularProjecoes` para receber taxas via parâmetro

Nova assinatura:

```javascript
function calcularProjecoes({
  patrimonioAtual,
  aportesMensais,
  idadeInicio,
  idadeAposentadoria,
  expectativaVida,
  rendaMensalDesejada,
  i_mes,
  g_mes,
  INFLACAO_ANUAL,
}) {
  // ... corpo idêntico ao atual; apenas remover dependência de escopo de módulo
}
```

Não mexer em mais nada dentro da função — só parametrizar a entrada.

### 3.3. Adicionar estado e derivações dentro do componente `DiagnosticoFP`

Logo após os outros `useState` (depois de L187, `setHoverIdx`):

```javascript
const [modoProjecao, setModoProjecao] = useState('valor_presente');

const TAXA_ANUAL = modoProjecao === 'nominal' ? TAXA_NOMINAL_ANUAL : SPREAD_ANUAL;
const INFLACAO_ANUAL = modoProjecao === 'nominal' ? IPCA_ANUAL : 0;
const i_mes = taxaMensal(TAXA_ANUAL);
const g_mes = taxaMensal(INFLACAO_ANUAL);
```

Passar `i_mes`, `g_mes`, `INFLACAO_ANUAL` na chamada de `calcularProjecoes` (atualmente L255).

### 3.4. Atualizar labels que dependiam da constante

Trocar `MODO_PROJECAO === 'nominal'` por `modoProjecao === 'nominal'` nas linhas 314 e 322 (descrição/premissas). A linha 304 (descrição com `TAXA_ANUAL`) continua funcionando porque `TAXA_ANUAL` agora é variável local do componente.

### 3.5. Adicionar UI do toggle

**Local:** dentro do `topRow` (atual L289-292), à esquerda do botão "Visualizar por: Ano".

**Justificativa de UX:** o modo de projeção é premissa global que afeta todos os números, então fica no header do diagnóstico junto dos outros controles globais. Segmented control de 2 opções (estética alinhada com o `filterButton` existente).

**Markup:**

```jsx
<div style={styles.topRow}>
  <p style={styles.topTitle}>Diagnostico do planejamento</p>
  <div style={styles.topControls}>
    <div style={styles.toggleGroup} role="group" aria-label="Modo de projeção">
      <button
        type="button"
        onClick={() => setModoProjecao('valor_presente')}
        style={{
          ...styles.toggleButton,
          ...(modoProjecao === 'valor_presente' ? styles.toggleButtonActive : {}),
        }}
      >
        Valor Presente
      </button>
      <button
        type="button"
        onClick={() => setModoProjecao('nominal')}
        style={{
          ...styles.toggleButton,
          ...(modoProjecao === 'nominal' ? styles.toggleButtonActive : {}),
        }}
      >
        Nominal
      </button>
    </div>
    <button style={styles.filterButton}>Visualizar por: Ano</button>
  </div>
</div>
```

**Estilos a adicionar** no objeto `styles` (no fim do arquivo):

```javascript
topControls: { display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" },
toggleGroup: { display: "inline-flex", borderRadius: "999px", background: "#111111", padding: "3px" },
toggleButton: {
  border: "none",
  background: "transparent",
  color: "#9CA3AF",
  padding: "0.45rem 0.85rem",
  fontSize: "0.78rem",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  borderRadius: "999px",
  transition: "background 0.15s, color 0.15s",
},
toggleButtonActive: { background: "#FFFFFF", color: "#111111" },
```

---

## 4. Não fazer (fora de escopo)

- Não mexer nas funções matemáticas (`vfAcumulacaoComGradiente`, `pvAnuidadeCrescente`, `pvPerpetuidadeCrescente`, `pmtParaAtingirVF`) — já validadas, gap < 0,4% vs XP
- Não persistir o modo em `localStorage` (snapshot pede só estado local)
- Não mexer em "Outros Objetivos" — pendência separada
- Não remover o arquivo legado `src/sql/fix_fp_updated_at_trigger.sql` — pendência separada
- Não tocar nos outros componentes FP (`PerfilFP.jsx`, `ObjetivosFP.jsx`, etc.)

---

## 5. Validação

### 5.1. Build

```bash
cd C:\Users\lucas\Documents\pradex-financas
npm run dev
```

Servidor sobe em `localhost:5173` sem erro de compilação.

### 5.2. Validação numérica (cenário-padrão Lucas)

Cenário: idade 30, aposentadoria 65, expectativa 90, patrimônio R$ 500k, aporte R$ 8k, renda desejada R$ 15k, IPCA=4,5%, spread=4,5%.

**Modo Valor Presente (default ao abrir):**
- Patrimônio aos 65 (card "Planejamento atual"): **≈ R$ 10,3M – R$ 10,4M**
- Premissa "Retorno esperado": `4,50% real`
- Premissa "Inflação considerada": `0% (valor presente)`
- Premissa "Rentabilidade total": `4,50% a.a.`

**Modo Nominal (após clicar no toggle):**
- Patrimônio aos 65: **≈ R$ 46,7M – R$ 46,8M**
- Premissa "Retorno esperado": `IPCA + 4,50%`
- Premissa "Inflação considerada": `4,50% a.a.`
- Premissa "Rentabilidade total": `9,20% a.a.`

Se algum desses números desviar mais de 1% do esperado, há regressão — investigar antes de commitar.

### 5.3. Validação visual

- Toggle aparece à esquerda do "Visualizar por: Ano", dentro de pílula preta com botão ativo branco
- Clicar em "Nominal" → todos os 3 cards de cenário, descrição, premissas e curvas do gráfico recalculam
- Clicar em "Valor Presente" → volta ao default
- Tooltip continua funcional nos dois modos
- yMax do eixo Y se ajusta automaticamente (lógica já existente em L258-259)
- Hard reload (Ctrl+Shift+R) volta ao default Valor Presente

---

## 6. Commit

Padrão do projeto: 1 commit limpo, sem branch.

```bash
cd C:\Users\lucas\Documents\pradex-financas
git add src/components/fp/DiagnosticoFP.jsx
git commit -m "feat(fp): toggle Nominal/Valor Presente no DiagnosticoFP, default VP"
git push
```

Confirmar `git status` limpo no fim.

---

## 7. Após o commit

Reportar ao Lucas (via Cowork chat se disponível, ou apenas como saída final):

1. Hash do commit
2. Confirmação de push para `origin/main`
3. Resultado dos números validados (Valor Presente e Nominal)
4. Qualquer comportamento inesperado durante teste local
