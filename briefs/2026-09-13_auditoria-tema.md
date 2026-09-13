# Auditoria de tema — fronteira escuro/claro

Data: 2026-09-13
Repo: `C:\Dev\pradex-financas`

Dois temas convivem na mesma árvore. Mobile e Planejamento usam `src/theme.js` (escuro). Shell `>=1024px` usa `src/components/desktop/theme.js` (claro). Cor absoluta atravessa a fronteira e inverte o sentido.

Tokens escuro: `#0C0E14` `#151821` `#1E2330` `#2C3344` `#F1F2F4` `#8B93A1` `#5C6570`
Tokens claro: `#F1F3F9` `#FFFFFF` `#fafafa` `#111827`

Contraste aproximado (WCAG, fundo sólido):

| Par | Razão | Corte (~3:1) |
|---|---|---|
| `#F1F2F4` sobre `#FFFFFF` / `#F1F3F9` | ~1.1:1 | ILEGÍVEL |
| `#E8E8E8` sobre `#FFFFFF` / `#F1F3F9` | ~1.2:1 | ILEGÍVEL (primo do token de texto) |
| `#8B93A1` sobre `#FFFFFF` / `#F1F3F9` / `#F2F4F8` | ~3.0:1 | ILEGÍVEL em 12px |
| `#5C6570` sobre `#FFFFFF` / `#F2F4F8` | ~5.9:1 | só feio (lê, mas é token do outro tema) |
| `#111827` sobre `#151821` / `#0C0E14` | ~1.1:1 | ILEGÍVEL |
| card `#151821` no canvas `#F1F3F9` | — | só feio (o retângulo preto) |

---

## 1. Inventário de fronteira

`OS DOIS` = o arquivo ramifica com `isDesktop` (ou equivalente). Esses são os perigosos se a ramificação for incompleta. Arquivos ESCURO/CLARO rígidos que **montam nos dois canvas** estão marcados — é a mesma armadilha, sem flag.

### `src/App.jsx` — **OS DOIS** (o pior arquivo)

Shell: `1341–1343` troca o canvas (`desktopTheme.mainBg` vs `#0C0E14`).
Fatias claras (só desktop): dashboard `1624`, cartões `1653`, categorias `1667`, bancos `1682`, histórico `2133`, relatórios `2289`.
Fatias escuras (só mobile, `pdx-hide-desktop` ou `!isDesktop`): header `1528`, cards `1565`, nav `1596`, dashboard mobile `1732`, histórico mobile `2147`.
Fatias escuras **sem gate**, caem no notebook claro:

| Trecho | Linha | O que pinta |
|---|---|---|
| Auth / loading | `1285–1334` | ESCURO (ok: tela cheia própria) |
| Modal editar / compra | `1398–1525` | ESCURO overlay (ok interno; ilha no desktop) |
| Banner WhatsApp | `1540–1562` | ESCURO sobre o canvas ativo |
| Orçamento | `1702–1728` | monta `OrcamentoCategoria` nos dois |
| Lançar | `1920–` | card `#151821` nos dois (`TopBar` manda pra cá) |
| Relatórios sem plano | `2281–2287` | `PreviaBorrada` + `UpgradePlano` |
| FP sem plano | `2299–2308` | idem |
| FP com plano (abas + filhos) | `2311–2371` | chrome escuro + filhos mistos |

`offBorda`/`offTexto` em `263–264` ramificam hex mas os dois lados ainda são tokens **escuros**. No desktop o form de lançar é card escuro, então não é o bug do branco — é dívida: o flag não escolhe tema, escolhe contraste dentro do escuro.

### `src/components/desktop/` — **CLARO** (exceto o que não pinta)

| Arquivo | Fundo |
|---|---|
| `theme.js` | CLARO (fonte). Comentário L1–2 já avisa: só `>=1024px`. |
| `useIsDesktop.js` | não pinta |
| `SidebarDesktop.jsx` | CLARO-shell (indigo, não o canvas `#F1F3F9`) |
| `TopBar.jsx` | CLARO |
| `DashboardDesktop.jsx` | CLARO |
| `CartoesDesktop.jsx` | CLARO |
| `CategoriasDesktop.jsx` | CLARO |
| `BancosDesktop.jsx` | CLARO |
| `TabelaLancamentos.jsx` | CLARO |
| `RelatoriosDesktop.jsx` | CLARO (`89` o `#fff` é print) |

Nenhum hex do tema escuro como texto/borda nestes arquivos. Fronteira respeitada.

### `src/components/fp/` — misturam canvas do pai

Nenhum lê `isDesktop`. Herdam o canvas de `App.jsx` (`#0C0E14` no celular, `#F1F3F9` no notebook) e pintam superfície própria.

| Arquivo | Fundo que o arquivo pinta | Risco |
|---|---|---|
| `RendasDespesasFP.jsx` | **CLARO** (ilha branca, comentário `552–563`) | título `#E8E8E8` herda o canvas do pai |
| `DiagnosticoFP.jsx` | **OS DOIS no mesmo arquivo** (board escuro `505` + ScenarioCard branco `170` + chart `#F2F4F8` `529`) | a migração quebrou exatamente aqui |
| `PerfilFP.jsx` | ESCURO rígido | ilha preta no notebook |
| `ObjetivosFP.jsx` | ESCURO rígido (`var(--card-bg, #151821)` — a CSS var **não existe** no repo) | idem |
| `BensFP.jsx` | ESCURO rígido (`var(--surface, #151821)`, var inexistente) | idem |
| `InvestimentosFP.jsx` | ESCURO rígido (mesmo padrão) | idem |

### Demais em `src/components/`

| Arquivo | Fundo | Monta em |
|---|---|---|
| `ScoreDisciplina.jsx` | **OS DOIS** (`57–59`, `TEMA_ESCURO`/`TEMA_CLARO`) | os dois, **tratado** |
| `OrcamentoCategoria.jsx` | ESCURO rígido (`16–18`) | os dois (`App.jsx` `1702`) |
| `PreviaBorrada.jsx` | ESCURO rígido (`19–21`) | os dois (`2284`, `2305`) |
| `UpgradePlano.jsx` | ESCURO rígido (`70–71`) | os dois |
| `FabWhatsapp.jsx` | neutro (`#25D366`) | os dois; não é tema |

`ScoreDisciplina` é o único componente compartilhado que já faz a coisa certa. Copiar esse padrão.

---

## 2–3. Violações

Só texto ou borda de um tema sobre fundo do outro. Superfície invertida (card preto no claro / card branco no escuro) entra quando é o sintoma que o PRADELLA descreveu.

### A. Token escuro como TEXTO/BORDA sobre fundo claro — **ILEGÍVEL**

**`UpgradePlano.jsx`** — o card `#6366F112` no desktop cai sobre `#F1F3F9` e vira lilás-quase-branco.

- `70` título `color: "#F1F2F4"` → ~1.1:1 **ILEGÍVEL**
- `71` corpo `color: "#8B93A1"` → ~3.0:1 **ILEGÍVEL**

Chamado em `App.jsx` `1807`, `2285`, `2308`. No mobile o canvas é `#0C0E14` e esses hex lêem. No notebook some.

**`App.jsx` `1543–1544`** — banner “Complete seu cadastro”, mesmo `#6366F112`, **sem** `pdx-hide-desktop`.

- `1543` `#F1F2F4` **ILEGÍVEL** no desktop
- `1544` `#8B93A1` **ILEGÍVEL** no desktop

**`RendasDespesasFP.jsx`** — ilha clara restaurada em 13/09, mas dois títulos ainda são texto-de-escuro.

- `622` `sectionTitulo` `#E8E8E8` — no mobile cai em `#0C0E14` (lê). No desktop cai em `#F1F3F9` → **ILEGÍVEL**
- `852` `cardLancTitulo` `#E8E8E8` sobre `cardLancamentos` `843` (`rgba(33,150,243,0.06)` ≈ branco) → **ILEGÍVEL nos dois viewports**

**`DiagnosticoFP.jsx`**

- `265` loading/vazio `color: "#8B93A1"` sem fundo próprio: no desktop sobre `#F1F3F9` → **ILEGÍVEL**
- `522` `infoIcon` `border: #8B93A1` + `color: #C9CFDA` sobre ScenarioCard `#FFFFFF` (`170`) → ícone **ILEGÍVEL**
- `545` não é esta: `legendNote` senta no board `#151821`, contraste ok

### B. Token escuro como TEXTO/BORDA sobre fundo claro — **só feio**

**`DiagnosticoFP.jsx` ScenarioCard** (`168–187`, fundo `170` `#FFFFFF`/`#EFEFEF`):

- `524` `metricLabel` `#5C6570` sobre branco → ~5.9:1, lê, token errado
- `517` `scenarioCard.border: #1E2330` — default morto; `170` sobrescreve com `#E5E7EB`. Armadilha: quem apagar o override volta a borda escura no card branco (some no destacado, pesada no normal)
- `383` bolinha `#8B93A1` no card branco — visível, só feio
- `413` eixo tracejado `#8B93A1` sobre chart `#F2F4F8` (`529`) → ~3:1, linha some
- `531` `axisText` `#5C6570` sobre `#F2F4F8` → lê, token errado
- `543` `legendItem` `#5C6570` sobre legend `#F2F4F8` (`542`) → lê, token errado
- `470–472` dots `#0C0E14` / `#8B93A1` / `#1E2330` na legend clara — visível

`metricValue` `525` `#111827` sobre o card branco está **certo** (é token claro). Não mexer.

### C. Superfície invertida — o “card preto no notebook”

Não é texto ilegível: o miolo do card escuro contrasta consigo. O erro é o retângulo no canvas errado.

| Onde | Linha | O que se vê no desktop |
|---|---|---|
| `OrcamentoCategoria.jsx` | `16–18`, cards `100` | bloco `#151821` em `#F1F3F9` |
| `PreviaBorrada.jsx` | `19–21`, `63` | idem (paywall de FP/Relatórios) |
| `App.jsx` lançar | `1922` | form escuro que o TopBar abre |
| `App.jsx` abas FP | `2316–2332` | strip `#0C0E14` no canvas claro |
| `PerfilFP.jsx` | `383`, `522` | cards escuros |
| `ObjetivosFP.jsx` | `325` | fallback `#151821` (CSS var nunca setada) |
| `BensFP.jsx` | `583`, `590` | idem |
| `InvestimentosFP.jsx` | `288`, `297` | idem |
| `DiagnosticoFP.jsx` | `505` `board` | painel escuro; os ScenarioCards brancos (`170`) dentro dele são a ilha-na-ilha |

Inverso no mobile: `RendasDespesasFP.jsx` `591–637` cards `#fff` / `#fafafa` no canvas `#0C0E14`. Interno (`#1a1a1a` sobre `#fff`) lê. É a ilha clara consciente (`552–563`). O que quebra é o título `622` quando o *pai* vira claro.

### D. Inverso: token claro como TEXTO/BORDA sobre fundo escuro

Nenhum `#111827` / `#F1F3F9` / `#fafafa` / `#FFFFFF` usado como texto corrido sobre `#0C0E14`/`#151821` neste giro.

O que existe e está certo:

- `DiagnosticoFP.jsx` `503` `#FFFFFF` no toggle ativo sobre track `#0C0E14`
- `DiagnosticoFP.jsx` `525` `#111827` sobre card `#FFFFFF` (ilha clara)
- `ScoreDisciplina.jsx` `39–48` — no desktop troca para `desktopTheme.textPrimary`

Não repetir a migração de paleta em `RendasDespesasFP` nem no ScenarioCard: `#F1F2F4` no lugar de `#111827` / `#1a1a1a` é exatamente o que apagou o texto em 11/09.

---

## 4. Regra prática (colar em `desktop/theme.js` e em `src/theme.js`)

Hex não tem significado fora do canvas. `#F1F2F4` é texto só sobre `#0C0E14`/`#151821`; sobre branco some (~1.1:1).
Arquivo em `components/desktop/` só importa `desktopTheme`. Arquivo em `components/fp/` e o mobile só importam `src/theme.js`.
Componente montado nos dois canvas (hoje: Score, Upgrade, Orçamento, Prévia, FP inteiro) ramifica superfície **e** texto, como `ScoreDisciplina.jsx` `57–59`. Sem ramo, é bug.
Ilha consciente (card branco no escuro, ou o contrário) declara a paleta local no topo do arquivo e **não** recebe a migração do outro tema — ver `RendasDespesasFP.jsx` `552–563`.
Antes de trocar um cinza: escrever o par `texto/borda × fundo` e recusar abaixo de 3:1. `isDesktop` não é licença pra empurrar token escuro “mais fraco”; é troca de tema.
