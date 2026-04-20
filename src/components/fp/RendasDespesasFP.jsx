import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

const SUPABASE_URL = "https://sjvuhqqsjboncwpboclv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnVocXFzamJvbmN3cGJvY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTM1NzEsImV4cCI6MjA5MTI2OTU3MX0.qpOXjpyJ29Hr9kvee3uxNS1LmJNUEZqDtMCCEpaHjsE";

const sbApi = (token) => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${token || SUPABASE_KEY}`,
});

// ─── Constantes ──────────────────────────────────────────────────────────────

const CATEGORIAS_RENDA = [
  "Rendimento",
  "Aluguel",
  "Pensão",
  "Renda variável",
  "Pró-labore",
  "Dividendos",
  "Aposentadoria/Previdência",
  "Outras rendas",
];

const CATEGORIAS_DESPESA = [
  "Todas as despesas",
  "Moradia",
  "Alimentação",
  "Transporte",
  "Educação",
  "Saúde",
  "Lazer",
  "Vestuário",
  "Seguros",
  "Financiamentos",
  "Outras despesas",
];

const FREQUENCIAS = ["Mensal", "Quinzenal", "Semanal", "Anual", "Única"];

const PREVISOES_TERMINO = [
  "Sem previsão",
  "Após algumas ocorrências",
  "Ao se aposentar",
];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBRL(value) {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseBRL(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[R$\s.]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function dateToMonthYear(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
}

function monthYearToDate(mes, ano) {
  if (!mes || !ano) return null;
  const mesIdx = MESES.indexOf(mes);
  if (mesIdx === -1) return null;
  return `${ano}-${String(mesIdx + 1).padStart(2, "0")}-01`;
}

const anoAtual = new Date().getFullYear();
const ANOS = Array.from({ length: 80 }, (_, i) => anoAtual - 5 + i);

// ─── Modal de adicionar/editar ────────────────────────────────────────────────

function Modal({ tipo, membros, item, onClose, onSaved, userId, token, valorInicial }) {
  const isRenda = tipo === "renda";
  const titulo = item ? `Editar ${tipo}` : `Adicionar ${tipo}`;

  const membrosOrdenados = [...membros].sort((a, b) => {
    if (a.parentesco === "Titular") return -1;
    if (b.parentesco === "Titular") return 1;
    return 0;
  });

  const [form, setForm] = useState({
    membro_id: item?.membro_id || (membrosOrdenados[0]?.id ?? ""),
    categoria: item?.categoria || (isRenda ? CATEGORIAS_RENDA[0] : CATEGORIAS_DESPESA[0]),
    descricao: item?.descricao || "",
    valor_bruto: item?.valor_bruto ? formatBRL(item.valor_bruto) : (valorInicial ? formatBRL(valorInicial) : ""),
    imposto_percent: item?.imposto_percent ?? 0,
    frequencia: item?.frequencia || "Mensal",
    data_inicio_mes: item?.data_inicio ? MESES[new Date(item.data_inicio + "T00:00:00").getMonth()] : MESES[new Date().getMonth()],
    data_inicio_ano: item?.data_inicio ? String(new Date(item.data_inicio + "T00:00:00").getFullYear()) : String(anoAtual),
    data_fim_mes: item?.data_fim ? MESES[new Date(item.data_fim + "T00:00:00").getMonth()] : "",
    data_fim_ano: item?.data_fim ? String(new Date(item.data_fim + "T00:00:00").getFullYear()) : "",
    previsao_termino: item?.previsao_termino || "Sem previsão",
    ocorrencias: item?.ocorrencias || "",
    comentarios: item?.comentarios || "",
    tributavel_compensavel: item?.tributavel_compensavel || false,
  });

  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const valorBrutoNum = parseBRL(form.valor_bruto);
  const valorLiquido = isRenda
    ? valorBrutoNum * (1 - Number(form.imposto_percent) / 100)
    : null;

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSalvar() {
    setErro("");
    if (!form.descricao.trim()) return setErro("Informe a descrição.");
    if (!form.valor_bruto) return setErro("Informe o valor.");
    if (!form.data_inicio_mes || !form.data_inicio_ano) return setErro("Informe a data de início.");

    setSaving(true);

    const payload = {
      user_id: userId,
      membro_id: form.membro_id || null,
      categoria: form.categoria,
      descricao: form.descricao.trim(),
      valor_bruto: valorBrutoNum,
      frequencia: form.frequencia,
      data_inicio: monthYearToDate(form.data_inicio_mes, form.data_inicio_ano),
      data_fim: form.data_fim_mes && form.data_fim_ano
        ? monthYearToDate(form.data_fim_mes, form.data_fim_ano)
        : null,
      previsao_termino: form.previsao_termino,
      ocorrencias: form.previsao_termino === "Após algumas ocorrências"
        ? Number(form.ocorrencias) || null
        : null,
      comentarios: form.comentarios.trim() || null,
    };

    if (isRenda) {
      payload.imposto_percent = Number(form.imposto_percent) || 0;
      payload.tributavel_compensavel = form.tributavel_compensavel;
    }

    const tabela = isRenda ? "fp_rendas" : "fp_despesas";
    try {
      if (item) {
        await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${item.id}`, {
          method: "PATCH",
          headers: { ...sbApi(token), "Prefer": "return=representation" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/${tabela}`, {
          method: "POST",
          headers: { ...sbApi(token), "Prefer": "return=representation" },
          body: JSON.stringify(payload),
        });
      }
      onSaved();
    } catch (e) {
      setErro("Erro ao salvar. Tente novamente.");
    }
    setSaving(false);
  }

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <span style={styles.modalTitulo}>{titulo}</span>
          <button style={styles.btnFechar} onClick={onClose}>×</button>
        </div>

        <div style={styles.modalBody}>
          {/* Responsável */}
          <div style={styles.campo}>
            <label style={styles.label}>Selecione o responsável *</label>
            <select
              style={styles.select}
              value={form.membro_id}
              onChange={(e) => set("membro_id", e.target.value)}
            >
              {membrosOrdenados.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>

          <div style={styles.tagFamiliar}>Renda/Despesa familiares ℹ️</div>

          {/* Categoria */}
          <div style={styles.campo}>
            <label style={styles.label}>
              Selecione categoria da {tipo} *
            </label>
            <select
              style={styles.select}
              value={form.categoria}
              onChange={(e) => set("categoria", e.target.value)}
            >
              {(isRenda ? CATEGORIAS_RENDA : CATEGORIAS_DESPESA).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Descrição */}
          <div style={styles.campo}>
            <label style={styles.label}>Descrição *</label>
            <input
              style={styles.input}
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder={isRenda ? "Ex: Salário principal" : "Ex: Conta de luz"}
            />
          </div>

          {/* Valor bruto */}
          <div style={styles.campo}>
            <label style={styles.label}>Valor bruto (R$) *</label>
            <input
              style={styles.input}
              value={form.valor_bruto}
              onChange={(e) => set("valor_bruto", e.target.value)}
              onBlur={() => {
                const num = parseBRL(form.valor_bruto);
                if (num > 0) set("valor_bruto", formatBRL(num));
              }}
              placeholder="R$ 0,00"
            />
          </div>

          {/* Imposto + Valor líquido (só renda) */}
          {isRenda && (
            <>
              <div style={styles.campo}>
                <label style={styles.label}>Imposto (%) *</label>
                <input
                  style={styles.input}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.imposto_percent}
                  onChange={(e) => set("imposto_percent", e.target.value)}
                />
              </div>
              <div style={styles.campo}>
                <label style={styles.label}>Valor líquido (R$) *</label>
                <input
                  style={{ ...styles.input, background: "#f5f5f5", color: "#888" }}
                  value={valorLiquido !== null ? formatBRL(valorLiquido) : ""}
                  readOnly
                />
              </div>
            </>
          )}

          {/* Frequência */}
          <div style={styles.campo}>
            <label style={styles.label}>Frequência *</label>
            <select
              style={styles.select}
              value={form.frequencia}
              onChange={(e) => set("frequencia", e.target.value)}
            >
              {FREQUENCIAS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Datas */}
          <div style={styles.duasColunas}>
            <div style={styles.campo}>
              <label style={styles.label}>Data início *</label>
              <div style={styles.dateRow}>
                <select
                  style={styles.selectSmall}
                  value={form.data_inicio_mes}
                  onChange={(e) => set("data_inicio_mes", e.target.value)}
                >
                  {MESES.map((m) => <option key={m}>{m}</option>)}
                </select>
                <select
                  style={styles.selectSmall}
                  value={form.data_inicio_ano}
                  onChange={(e) => set("data_inicio_ano", e.target.value)}
                >
                  {ANOS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div style={styles.campo}>
              <label style={styles.label}>Data de fim</label>
              <div style={styles.dateRow}>
                <select
                  style={styles.selectSmall}
                  value={form.data_fim_mes}
                  onChange={(e) => set("data_fim_mes", e.target.value)}
                >
                  <option value="">-</option>
                  {MESES.map((m) => <option key={m}>{m}</option>)}
                </select>
                <select
                  style={styles.selectSmall}
                  value={form.data_fim_ano}
                  onChange={(e) => set("data_fim_ano", e.target.value)}
                >
                  <option value="">-</option>
                  {ANOS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Previsão de término */}
          <div style={styles.campo}>
            <label style={{ ...styles.label, marginBottom: 8 }}>Previsão de término</label>
            {PREVISOES_TERMINO.map((p) => (
              <label key={p} style={styles.radioLabel}>
                <input
                  type="radio"
                  name="previsao"
                  value={p}
                  checked={form.previsao_termino === p}
                  onChange={() => set("previsao_termino", p)}
                  style={{ marginRight: 8 }}
                />
                {p}
              </label>
            ))}
          </div>

          {/* Ocorrências */}
          {form.previsao_termino === "Após algumas ocorrências" && (
            <div style={styles.campo}>
              <label style={styles.label}>Ocorrências *</label>
              <input
                style={styles.input}
                type="number"
                min="1"
                value={form.ocorrencias}
                onChange={(e) => set("ocorrencias", e.target.value)}
                placeholder="Ex: 340"
              />
            </div>
          )}

          {/* Comentários */}
          <div style={styles.campo}>
            <label style={styles.label}>Comentários</label>
            <textarea
              style={{ ...styles.input, minHeight: 72, resize: "vertical" }}
              value={form.comentarios}
              onChange={(e) => set("comentarios", e.target.value)}
              placeholder="Observações opcionais"
            />
          </div>

          {/* Tributável (só renda) */}
          {isRenda && (
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={form.tributavel_compensavel}
                onChange={(e) => set("tributavel_compensavel", e.target.checked)}
                style={{ marginRight: 8 }}
              />
              Receita bruta tributável compensável
              <span style={styles.linkSaiba}> Saiba mais</span>
            </label>
          )}

          {erro && <div style={styles.erro}>{erro}</div>}
        </div>

        {/* Footer */}
        <div style={styles.modalFooter}>
          <button style={styles.btnCancelar} onClick={onClose}>Cancelar</button>
          <button
            style={{
              ...styles.btnAdicionar,
              opacity: saving ? 0.7 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
            onClick={handleSalvar}
            disabled={saving}
          >
            {saving ? "Salvando..." : item ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card de item na lista ────────────────────────────────────────────────────

function ItemCard({ item, tipo, membros, onEdit, onDelete }) {
  const isRenda = tipo === "renda";
  const membro = membros.find((m) => m.id === item.membro_id);

  return (
    <div style={styles.card}>
      <div style={styles.cardLeft}>
        <div style={styles.cardTitulo}>{item.descricao}</div>
        <div style={styles.cardSub}>
          {item.categoria}
          {membro ? ` · ${membro.nome}` : ""}
          {" · "}
          {item.frequencia}
        </div>
        {item.data_inicio && (
          <div style={styles.cardDatas}>
            {dateToMonthYear(item.data_inicio)}
            {item.data_fim ? ` → ${dateToMonthYear(item.data_fim)}` : " → sem previsão"}
          </div>
        )}
      </div>
      <div style={styles.cardRight}>
        <div style={styles.cardValor}>
          {formatBRL(isRenda ? (item.valor_liquido ?? item.valor_bruto) : item.valor_bruto)}
        </div>
        {isRenda && item.imposto_percent > 0 && (
          <div style={styles.cardImposto}>bruto: {formatBRL(item.valor_bruto)}</div>
        )}
        <div style={styles.cardAcoes}>
          <button style={styles.btnAcao} onClick={() => onEdit(item)} title="Editar">✏️</button>
          <button style={styles.btnAcao} onClick={() => onDelete(item.id)} title="Remover">🗑️</button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RendasDespesasFP({ session }) {
  const [membros, setMembros] = useState([]);
  const [rendas, setRendas] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(null); // { tipo: "renda"|"despesa", item: null|{...}, valorInicial?: number }
  const [totalLancamentos, setTotalLancamentos] = useState(null);

  const userId = session?.user?.id;
  const token = session?.token;

  useEffect(() => {
    if (session?.token) {
      supabase.auth.setSession({ access_token: session.token, refresh_token: "" });
    }
  }, []);

  async function carregar() {
    console.log("[rendas] user_id:", session?.user?.id);
    if (!userId) return;
    setLoading(true);
    try {
      const [resM, resR, resD] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/fp_membros?user_id=eq.${userId}&order=nome.asc`, { headers: sbApi(token) }),
        fetch(`${SUPABASE_URL}/rest/v1/fp_rendas?user_id=eq.${userId}&order=created_at.asc`, { headers: sbApi(token) }),
        fetch(`${SUPABASE_URL}/rest/v1/fp_despesas?user_id=eq.${userId}&order=created_at.asc`, { headers: sbApi(token) }),
      ]);
      const [m, r, d] = await Promise.all([resM.json(), resR.json(), resD.json()]);
      setMembros(Array.isArray(m) ? m : []);
      setRendas(Array.isArray(r) ? r : []);
      setDespesas(Array.isArray(d) ? d : []);

      // Tenta buscar total de despesas recorrentes nos lançamentos
      try {
        const resLanc = await fetch(
          `${SUPABASE_URL}/rest/v1/lancamentos?user_id=eq.${userId}&tipo=eq.despesa&recorrente=eq.true&select=valor`,
          { headers: sbApi(token) }
        );
        const lancRec = await resLanc.json();
        if (Array.isArray(lancRec) && lancRec.length > 0) {
          setTotalLancamentos(lancRec.reduce((s, l) => s + Number(l.valor || 0), 0));
        } else {
          // Fallback: média dos últimos 3 meses
          const tresMesesAtras = new Date();
          tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
          const dataStr = tresMesesAtras.toISOString().split("T")[0];
          const resLanc2 = await fetch(
            `${SUPABASE_URL}/rest/v1/lancamentos?user_id=eq.${userId}&tipo=eq.despesa&data=gte.${dataStr}&select=valor,data`,
            { headers: sbApi(token) }
          );
          const lancAll = await resLanc2.json();
          if (Array.isArray(lancAll) && lancAll.length > 0) {
            const byMonth = {};
            lancAll.forEach((l) => {
              const key = (l.data || "").slice(0, 7);
              if (key) byMonth[key] = (byMonth[key] || 0) + Number(l.valor || 0);
            });
            const vals = Object.values(byMonth);
            if (vals.length > 0) {
              setTotalLancamentos(vals.reduce((s, v) => s + v, 0) / vals.length);
            }
          }
        }
      } catch (_) {}
    } catch (e) {}
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [userId]);

  async function handleDelete(tipo, id) {
    if (!window.confirm(`Remover este ${tipo}?`)) return;
    const tabela = tipo === "renda" ? "fp_rendas" : "fp_despesas";
    await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${id}`, {
      method: "DELETE",
      headers: sbApi(token),
    });
    carregar();
  }

  const totalRendas = rendas.reduce((s, r) => s + Number(r.valor_liquido ?? r.valor_bruto), 0);
  const totalDespesas = despesas.reduce((s, d) => s + Number(d.valor_bruto), 0);
  const saldo = totalRendas - totalDespesas;

  if (loading) {
    return <div style={styles.loading}>Carregando...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Resumo */}
      <div style={styles.resumoRow}>
        <div style={{ ...styles.resumoCard, borderColor: "#4caf50" }}>
          <div style={styles.resumoLabel}>Total de Rendas</div>
          <div style={{ ...styles.resumoValor, color: "#4caf50" }}>{formatBRL(totalRendas)}</div>
        </div>
        <div style={{ ...styles.resumoCard, borderColor: "#f44336" }}>
          <div style={styles.resumoLabel}>Total de Despesas</div>
          <div style={{ ...styles.resumoValor, color: "#f44336" }}>{formatBRL(totalDespesas)}</div>
        </div>
        <div style={{ ...styles.resumoCard, borderColor: saldo >= 0 ? "#2196f3" : "#ff9800" }}>
          <div style={styles.resumoLabel}>Saldo Mensal</div>
          <div style={{ ...styles.resumoValor, color: saldo >= 0 ? "#2196f3" : "#ff9800" }}>
            {formatBRL(saldo)}
          </div>
        </div>
      </div>

      {/* Aviso sem membros */}
      {membros.length === 0 && (
        <div style={styles.aviso}>
          ⚠️ Nenhum membro cadastrado. Cadastre os membros da família na aba <strong>Perfil</strong> antes de adicionar rendas e despesas.
        </div>
      )}

      {/* RENDAS */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitulo}>Rendas</h2>
          <button
            style={styles.btnAdicionar}
            onClick={() => setModal({ tipo: "renda", item: null })}
            disabled={membros.length === 0}
          >
            + Adicionar renda
          </button>
        </div>

        {rendas.length === 0 ? (
          <div style={styles.vazio}>Nenhuma renda cadastrada.</div>
        ) : (
          rendas.map((r) => (
            <ItemCard
              key={r.id}
              item={r}
              tipo="renda"
              membros={membros}
              onEdit={(item) => setModal({ tipo: "renda", item })}
              onDelete={(id) => handleDelete("renda", id)}
            />
          ))
        )}
      </section>

      {/* DESPESAS */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitulo}>Despesas</h2>
          <button
            style={styles.btnAdicionar}
            onClick={() => setModal({ tipo: "despesa", item: null })}
            disabled={membros.length === 0}
          >
            + Adicionar despesa
          </button>
        </div>

        {totalLancamentos !== null && totalLancamentos > 0 && (
          <div style={styles.cardLancamentos}>
            <div>
              <div style={styles.cardLancTitulo}>📊 Despesas nos Lançamentos</div>
              <div style={styles.cardLancSub}>
                Total mensal estimado com base nos lançamentos cadastrados
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={styles.cardLancValor}>{formatBRL(totalLancamentos)}</div>
              <button
                style={styles.btnUsarTotal}
                onClick={() => setModal({ tipo: "despesa", item: null, valorInicial: totalLancamentos })}
                disabled={membros.length === 0}
              >
                Usar como despesa total
              </button>
            </div>
          </div>
        )}

        {despesas.length === 0 ? (
          <div style={styles.vazio}>Nenhuma despesa cadastrada.</div>
        ) : (
          despesas.map((d) => (
            <ItemCard
              key={d.id}
              item={d}
              tipo="despesa"
              membros={membros}
              onEdit={(item) => setModal({ tipo: "despesa", item })}
              onDelete={(id) => handleDelete("despesa", id)}
            />
          ))
        )}
      </section>

      {/* Modal */}
      {modal && (
        <Modal
          tipo={modal.tipo}
          membros={membros}
          item={modal.item}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); carregar(); }}
          userId={userId}
          token={token}
          valorInicial={modal.valorInicial}
        />
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = {
  container: {
    padding: "24px",
    maxWidth: 820,
    margin: "0 auto",
    fontFamily: "sans-serif",
  },
  loading: {
    padding: 40,
    textAlign: "center",
    color: "#888",
  },
  aviso: {
    background: "#fff8e1",
    border: "1px solid #ffe082",
    borderRadius: 8,
    padding: "12px 16px",
    marginBottom: 24,
    fontSize: 14,
    color: "#5d4037",
  },
  resumoRow: {
    display: "flex",
    gap: 16,
    marginBottom: 32,
    flexWrap: "wrap",
  },
  resumoCard: {
    flex: 1,
    minWidth: 180,
    background: "#fff",
    border: "2px solid",
    borderRadius: 10,
    padding: "16px 20px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
  },
  resumoLabel: {
    fontSize: 12,
    color: "#888",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resumoValor: {
    fontSize: 22,
    fontWeight: 700,
  },
  section: {
    marginBottom: 40,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitulo: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
    color: "#1a1a1a",
  },
  vazio: {
    padding: "24px 0",
    color: "#aaa",
    fontSize: 14,
    textAlign: "center",
    background: "#fafafa",
    borderRadius: 8,
    border: "1px dashed #e0e0e0",
  },
  card: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    background: "#fff",
    border: "1px solid #e8e8e8",
    borderRadius: 10,
    padding: "14px 18px",
    marginBottom: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  cardLeft: {
    flex: 1,
  },
  cardTitulo: {
    fontWeight: 600,
    fontSize: 15,
    color: "#1a1a1a",
    marginBottom: 3,
  },
  cardSub: {
    fontSize: 12,
    color: "#777",
    marginBottom: 3,
  },
  cardDatas: {
    fontSize: 12,
    color: "#aaa",
  },
  cardRight: {
    textAlign: "right",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  cardValor: {
    fontWeight: 700,
    fontSize: 16,
    color: "#1a1a1a",
  },
  cardImposto: {
    fontSize: 11,
    color: "#aaa",
  },
  cardAcoes: {
    display: "flex",
    gap: 6,
    marginTop: 4,
  },
  btnAcao: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 15,
    padding: "2px 4px",
    borderRadius: 4,
    lineHeight: 1,
  },
  // Modal
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    width: "100%",
    maxWidth: 520,
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px 16px",
    borderBottom: "1px solid #f0f0f0",
  },
  modalTitulo: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1a1a1a",
    textTransform: "capitalize",
  },
  btnFechar: {
    background: "none",
    border: "none",
    fontSize: 24,
    cursor: "pointer",
    color: "#888",
    lineHeight: 1,
    padding: 0,
  },
  modalBody: {
    overflowY: "auto",
    padding: "16px 24px",
    flex: 1,
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    padding: "16px 24px",
    borderTop: "1px solid #f0f0f0",
  },
  campo: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 12,
    color: "#888",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "none",
    borderBottom: "1.5px solid #ddd",
    borderRadius: 0,
    fontSize: 15,
    color: "#1a1a1a",
    background: "#fafafa",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    border: "none",
    borderBottom: "1.5px solid #ddd",
    background: "#fafafa",
    fontSize: 15,
    color: "#1a1a1a",
    outline: "none",
    cursor: "pointer",
    appearance: "none",
    boxSizing: "border-box",
  },
  duasColunas: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 16,
  },
  dateRow: {
    display: "flex",
    gap: 8,
  },
  selectSmall: {
    flex: 1,
    padding: "8px 10px",
    border: "none",
    borderBottom: "1.5px solid #ddd",
    background: "#fafafa",
    fontSize: 13,
    color: "#1a1a1a",
    outline: "none",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  tagFamiliar: {
    fontSize: 12,
    color: "#888",
    marginBottom: 14,
  },
  radioLabel: {
    display: "flex",
    alignItems: "center",
    fontSize: 14,
    color: "#333",
    marginBottom: 8,
    cursor: "pointer",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    fontSize: 13,
    color: "#333",
    marginTop: 4,
    cursor: "pointer",
  },
  linkSaiba: {
    color: "#1976d2",
    fontSize: 12,
    marginLeft: 4,
    textDecoration: "underline",
    cursor: "pointer",
  },
  erro: {
    background: "#ffebee",
    color: "#c62828",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
    marginTop: 8,
  },
  btnAdicionar: {
    background: "#f5c800",
    color: "#1a1a1a",
    border: "none",
    borderRadius: 6,
    padding: "10px 20px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  btnCancelar: {
    background: "none",
    border: "none",
    color: "#555",
    fontSize: 14,
    cursor: "pointer",
    padding: "10px 16px",
  },
  cardLancamentos: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    background: "rgba(33,150,243,0.06)",
    border: "1px solid rgba(33,150,243,0.25)",
    borderRadius: 10,
    padding: "14px 18px",
    marginBottom: 16,
  },
  cardLancTitulo: {
    fontWeight: 700,
    fontSize: 14,
    color: "#1a1a1a",
    marginBottom: 3,
  },
  cardLancSub: {
    fontSize: 12,
    color: "#777",
  },
  cardLancValor: {
    fontWeight: 700,
    fontSize: 18,
    color: "#f44336",
    marginBottom: 6,
  },
  btnUsarTotal: {
    background: "transparent",
    border: "1px solid #1976d2",
    color: "#1976d2",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
