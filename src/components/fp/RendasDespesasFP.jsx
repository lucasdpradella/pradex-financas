import { useEffect, useState } from "react";
import { syncSupabaseSession } from "../../supabaseClient";

const SUPABASE_URL = "https://sjvuhqqsjboncwpboclv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnVocXFzamJvbmN3cGJvY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTM1NzEsImV4cCI6MjA5MTI2OTU3MX0.qpOXjpyJ29Hr9kvee3uxNS1LmJNUEZqDtMCCEpaHjsE";

const sbApi = (token) => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${token || SUPABASE_KEY}`,
});

const CATEGORIAS_RENDA = [
  "Rendimento",
  "Aluguel",
  "Pensao",
  "Renda variavel",
  "Pro-labore",
  "Dividendos",
  "Aposentadoria/Previdencia",
  "Outras rendas",
];

const CATEGORIAS_DESPESA = [
  "Todas as despesas",
  "Moradia",
  "Alimentacao",
  "Transporte",
  "Educacao",
  "Saude",
  "Lazer",
  "Vestuario",
  "Seguros",
  "Financiamentos",
  "Outras despesas",
];

const FREQUENCIAS = ["Mensal", "Quinzenal", "Semanal", "Anual", "Unica"];
const PREVISOES_TERMINO = ["Sem previsao", "Apos algumas ocorrencias", "Ao se aposentar"];
const MESES = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 80 }, (_, i) => ANO_ATUAL - 5 + i);

function formatBRL(value) {
  if (value === null || value === undefined || value === "") return "";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBRL(value) {
  if (!value) return 0;
  const normalized = String(value).replace(/[R$\s.]/g, "").replace(",", ".");
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function dateToMonthYear(dateStr) {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T00:00:00`);
  return `${MESES[date.getMonth()]}/${date.getFullYear()}`;
}

function monthYearToDate(mes, ano) {
  if (!mes || !ano) return null;
  const mesIndex = MESES.indexOf(mes);
  if (mesIndex === -1) return null;
  return `${ano}-${String(mesIndex + 1).padStart(2, "0")}-01`;
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function ordenarMembros(lista = []) {
  return [...lista].sort((a, b) => {
    if (a.parentesco === "Titular") return -1;
    if (b.parentesco === "Titular") return 1;
    return (a.nome || "").localeCompare(b.nome || "");
  });
}

function parseMeta(comentarios = "") {
  const text = String(comentarios || "");
  const extract = (key) => {
    const match = text.match(new RegExp(`\\[${key}:([^\\]]+)\\]`, "i"));
    return match ? match[1].trim() : "";
  };
  const cleaned = text.replace(/\[[^\]]+:[^\]]+\]\s*/g, "").trim();
  return {
    responsavel: extract("Responsavel"),
    previsao: extract("Previsao"),
    ocorrencias: extract("Ocorrencias"),
    texto: cleaned,
  };
}

function buildComentarios({ responsavel = "", previsao = "", ocorrencias = "", texto = "" }) {
  const parts = [];
  if (responsavel) parts.push(`[Responsavel:${responsavel}]`);
  if (previsao) parts.push(`[Previsao:${previsao}]`);
  if (ocorrencias) parts.push(`[Ocorrencias:${ocorrencias}]`);
  if (texto) parts.push(texto.trim());
  return parts.join(" ").trim() || null;
}

function Modal({ tipo, membros, item, onClose, onSaved, userId, token, valorInicial }) {
  const isRenda = tipo === "renda";
  const membrosOrdenados = ordenarMembros(membros);
  const meta = parseMeta(item?.comentarios);

  const [form, setForm] = useState({
    responsavel: meta.responsavel || membrosOrdenados[0]?.nome || "",
    categoria: item?.categoria || (isRenda ? CATEGORIAS_RENDA[0] : CATEGORIAS_DESPESA[0]),
    descricao: item?.descricao || "",
    valor_bruto: item?.valor_bruto ? formatBRL(item.valor_bruto) : (valorInicial ? formatBRL(valorInicial) : ""),
    frequencia: item?.frequencia || "Mensal",
    data_inicio_mes: item?.data_inicio ? MESES[new Date(`${item.data_inicio}T00:00:00`).getMonth()] : MESES[new Date().getMonth()],
    data_inicio_ano: item?.data_inicio ? String(new Date(`${item.data_inicio}T00:00:00`).getFullYear()) : String(ANO_ATUAL),
    data_fim_mes: item?.data_fim ? MESES[new Date(`${item.data_fim}T00:00:00`).getMonth()] : "",
    data_fim_ano: item?.data_fim ? String(new Date(`${item.data_fim}T00:00:00`).getFullYear()) : "",
    previsao_termino: meta.previsao || "Sem previsao",
    ocorrencias: meta.ocorrencias || "",
    comentarios: meta.texto || "",
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSalvar() {
    setErro("");
    if (!form.descricao.trim()) return setErro("Informe a descricao.");
    if (!form.valor_bruto) return setErro("Informe o valor.");
    if (!form.data_inicio_mes || !form.data_inicio_ano) return setErro("Informe a data de inicio.");

    setSaving(true);

    const payload = {
      user_id: userId,
      categoria: form.categoria,
      descricao: form.descricao.trim(),
      valor_bruto: parseBRL(form.valor_bruto),
      frequencia: form.frequencia,
      data_inicio: monthYearToDate(form.data_inicio_mes, form.data_inicio_ano),
      data_fim: form.data_fim_mes && form.data_fim_ano ? monthYearToDate(form.data_fim_mes, form.data_fim_ano) : null,
      comentarios: buildComentarios({
        responsavel: form.responsavel,
        previsao: form.previsao_termino,
        ocorrencias: form.previsao_termino === "Apos algumas ocorrencias" ? form.ocorrencias : "",
        texto: form.comentarios,
      }),
    };

    try {
      const endpoint = `${SUPABASE_URL}/rest/v1/${isRenda ? "fp_rendas" : "fp_despesas"}`;
      const res = await fetch(
        item ? `${endpoint}?id=eq.${item.id}` : endpoint,
        {
          method: item ? "PATCH" : "POST",
          headers: { ...sbApi(token), Prefer: "return=representation" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        const updatedAtTriggerError =
          item &&
          typeof data?.message === "string" &&
          data.message.includes('record "new" has no field "updated_at"');

        if (updatedAtTriggerError) {
          const createRes = await fetch(endpoint, {
            method: "POST",
            headers: { ...sbApi(token), Prefer: "return=representation" },
            body: JSON.stringify(payload),
          });
          const createData = await createRes.json();

          if (!createRes.ok) {
            setErro(createData?.message || "Erro ao atualizar. Revise os campos e tente novamente.");
            setSaving(false);
            return;
          }

          const deleteRes = await fetch(`${endpoint}?id=eq.${item.id}`, {
            method: "DELETE",
            headers: sbApi(token),
          });

          if (!deleteRes.ok) {
            setErro("A edicao foi recriada, mas o registro antigo nao foi removido. Atualize a tela e remova o antigo.");
            setSaving(false);
            return;
          }

          onSaved();
          setSaving(false);
          return;
        }

        setErro(data?.message || "Erro ao salvar. Revise os campos e tente novamente.");
        setSaving(false);
        return;
      }
      onSaved();
    } catch (error) {
      setErro("Erro ao salvar. Tente novamente.");
    }

    setSaving(false);
  }

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitulo}>{item ? `Editar ${tipo}` : `Adicionar ${tipo}`}</span>
          <button style={styles.btnFechar} onClick={onClose}>×</button>
        </div>

        <div style={styles.modalBody}>
          <div style={styles.campo}>
            <label style={styles.label}>Selecione o responsavel *</label>
            <select style={styles.select} value={form.responsavel} onChange={(e) => setField("responsavel", e.target.value)}>
              {membrosOrdenados.map((membro) => (
                <option key={membro.id} value={membro.nome}>{membro.nome}</option>
              ))}
            </select>
          </div>

          <div style={styles.tagFamiliar}>Renda/Despesa familiares</div>

          <div style={styles.campo}>
            <label style={styles.label}>Categoria *</label>
            <select style={styles.select} value={form.categoria} onChange={(e) => setField("categoria", e.target.value)}>
              {(isRenda ? CATEGORIAS_RENDA : CATEGORIAS_DESPESA).map((categoria) => (
                <option key={categoria}>{categoria}</option>
              ))}
            </select>
          </div>

          <div style={styles.campo}>
            <label style={styles.label}>Descricao *</label>
            <input
              style={styles.input}
              value={form.descricao}
              onChange={(e) => setField("descricao", e.target.value)}
              placeholder={isRenda ? "Ex: Salario principal" : "Ex: Conta de luz"}
            />
          </div>

          <div style={styles.campo}>
            <label style={styles.label}>Valor bruto (R$) *</label>
            <input
              style={styles.input}
              value={form.valor_bruto}
              onChange={(e) => setField("valor_bruto", e.target.value)}
              onBlur={() => {
                const valor = parseBRL(form.valor_bruto);
                if (valor > 0) setField("valor_bruto", formatBRL(valor));
              }}
              placeholder="R$ 0,00"
            />
          </div>

          <div style={styles.campo}>
            <label style={styles.label}>Frequencia *</label>
            <select style={styles.select} value={form.frequencia} onChange={(e) => setField("frequencia", e.target.value)}>
              {FREQUENCIAS.map((frequencia) => (
                <option key={frequencia}>{frequencia}</option>
              ))}
            </select>
          </div>

          <div style={styles.duasColunas}>
            <div style={styles.campo}>
              <label style={styles.label}>Data inicio *</label>
              <div style={styles.dateRow}>
                <select style={styles.selectSmall} value={form.data_inicio_mes} onChange={(e) => setField("data_inicio_mes", e.target.value)}>
                  {MESES.map((mes) => <option key={mes}>{mes}</option>)}
                </select>
                <select style={styles.selectSmall} value={form.data_inicio_ano} onChange={(e) => setField("data_inicio_ano", e.target.value)}>
                  {ANOS.map((ano) => <option key={ano}>{ano}</option>)}
                </select>
              </div>
            </div>
            <div style={styles.campo}>
              <label style={styles.label}>Data fim</label>
              <div style={styles.dateRow}>
                <select style={styles.selectSmall} value={form.data_fim_mes} onChange={(e) => setField("data_fim_mes", e.target.value)}>
                  <option value="">-</option>
                  {MESES.map((mes) => <option key={mes}>{mes}</option>)}
                </select>
                <select style={styles.selectSmall} value={form.data_fim_ano} onChange={(e) => setField("data_fim_ano", e.target.value)}>
                  <option value="">-</option>
                  {ANOS.map((ano) => <option key={ano}>{ano}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={styles.campo}>
            <label style={{ ...styles.label, marginBottom: 8 }}>Previsao de termino</label>
            {PREVISOES_TERMINO.map((previsao) => (
              <label key={previsao} style={styles.radioLabel}>
                <input
                  type="radio"
                  name={`previsao-${tipo}`}
                  value={previsao}
                  checked={form.previsao_termino === previsao}
                  onChange={() => setField("previsao_termino", previsao)}
                  style={{ marginRight: 8 }}
                />
                {previsao}
              </label>
            ))}
          </div>

          {form.previsao_termino === "Apos algumas ocorrencias" && (
            <div style={styles.campo}>
              <label style={styles.label}>Ocorrencias</label>
              <input
                style={styles.input}
                type="number"
                min="1"
                value={form.ocorrencias}
                onChange={(e) => setField("ocorrencias", e.target.value)}
                placeholder="Ex: 12"
              />
            </div>
          )}

          <div style={styles.campo}>
            <label style={styles.label}>Comentarios</label>
            <textarea
              style={{ ...styles.input, minHeight: 72, resize: "vertical" }}
              value={form.comentarios}
              onChange={(e) => setField("comentarios", e.target.value)}
              placeholder="Observacoes opcionais"
            />
          </div>

          {erro && <div style={styles.erro}>{erro}</div>}
        </div>

        <div style={styles.modalFooter}>
          <button style={styles.btnCancelar} onClick={onClose}>Cancelar</button>
          <button style={{ ...styles.btnAdicionar, opacity: saving ? 0.7 : 1 }} onClick={handleSalvar} disabled={saving}>
            {saving ? "Salvando..." : item ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ item, tipo, onEdit, onDelete }) {
  const meta = parseMeta(item.comentarios);
  return (
    <div style={styles.card}>
      <div style={styles.cardLeft}>
        <div style={styles.cardTitulo}>{item.descricao}</div>
        <div style={styles.cardSub}>
          {item.categoria}
          {meta.responsavel ? ` · ${meta.responsavel}` : ""}
          {item.frequencia ? ` · ${item.frequencia}` : ""}
        </div>
        {item.data_inicio && (
          <div style={styles.cardDatas}>
            {dateToMonthYear(item.data_inicio)}
            {item.data_fim ? ` -> ${dateToMonthYear(item.data_fim)}` : ""}
          </div>
        )}
      </div>
      <div style={styles.cardRight}>
        <div style={styles.cardValor}>{formatBRL(item.valor_bruto)}</div>
        <div style={styles.cardAcoes}>
          <button style={styles.btnAcao} onClick={() => onEdit(item)}>Editar</button>
          <button style={styles.btnAcao} onClick={() => onDelete(item.id)}>Remover</button>
        </div>
      </div>
    </div>
  );
}

export default function RendasDespesasFP({ session }) {
  const [membros, setMembros] = useState([]);
  const [rendas, setRendas] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resumoLancamentos, setResumoLancamentos] = useState({ receitasMesAtual: 0, despesasMesAtual: 0 });
  const [totalLancamentos, setTotalLancamentos] = useState(0);
  const [modal, setModal] = useState(null);

  const userId = session?.user?.id;
  const token = session?.token;

  async function carregar() {
    if (!userId) return;
    setLoading(true);
    try {
      const [resM, resR, resD, resLancReceitas, resLancDespesas] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/fp_membros?user_id=eq.${userId}&order=nome.asc`, { headers: sbApi(token) }),
        fetch(`${SUPABASE_URL}/rest/v1/fp_rendas?user_id=eq.${userId}&order=created_at.asc`, { headers: sbApi(token) }),
        fetch(`${SUPABASE_URL}/rest/v1/fp_despesas?user_id=eq.${userId}&order=created_at.asc`, { headers: sbApi(token) }),
        fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?user_id=eq.${userId}&tipo=eq.receita&select=valor,data_lancamento`, { headers: sbApi(token) }),
        fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?user_id=eq.${userId}&tipo=eq.gasto&select=valor,data_lancamento`, { headers: sbApi(token) }),
      ]);

      const [membrosData, rendasData, despesasData, receitasLanc, despesasLanc] = await Promise.all([
        resM.json(),
        resR.json(),
        resD.json(),
        resLancReceitas.json(),
        resLancDespesas.json(),
      ]);

      setMembros(Array.isArray(membrosData) ? ordenarMembros(membrosData) : []);
      setRendas(Array.isArray(rendasData) ? rendasData : []);
      setDespesas(Array.isArray(despesasData) ? despesasData : []);

      const mesAtual = getMonthKey(new Date());
      const receitasPorMes = {};

      if (Array.isArray(receitasLanc)) {
        receitasLanc.forEach((lancamento) => {
          const key = (lancamento.data_lancamento || "").slice(0, 7);
          if (key) receitasPorMes[key] = (receitasPorMes[key] || 0) + Number(lancamento.valor || 0);
        });
      }

      const receitasMesAtual = receitasPorMes[mesAtual] || 0;
      const despesasMesAtual = Array.isArray(despesasLanc)
        ? despesasLanc
            .filter((lancamento) => (lancamento.data_lancamento || "").startsWith(mesAtual))
            .reduce((sum, lancamento) => sum + Number(lancamento.valor || 0), 0)
        : 0;

      setResumoLancamentos({ receitasMesAtual, despesasMesAtual });
      setTotalLancamentos(despesasMesAtual);
    } catch (error) {
      console.error("[fp_rendas_despesas] Erro ao carregar:", error);
    }
    setLoading(false);
  }

  useEffect(() => {
    const init = async () => {
      if (!session?.token) return;
      await syncSupabaseSession(session.token);
      await carregar();
    };
    init();
  }, [session?.token]);

  async function handleDelete(tipo, id) {
    if (!window.confirm(`Remover este ${tipo}?`)) return;
    await fetch(`${SUPABASE_URL}/rest/v1/${tipo === "renda" ? "fp_rendas" : "fp_despesas"}?id=eq.${id}`, {
      method: "DELETE",
      headers: sbApi(token),
    });
    carregar();
  }

  if (loading) return <div style={styles.loading}>Carregando...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.resumoRow}>
        <div style={{ ...styles.resumoCard, borderColor: "#4caf50" }}>
          <div style={styles.resumoLabel}>RECEITA DO MES ATUAL</div>
          <div style={{ ...styles.resumoValor, color: "#4caf50" }}>{formatBRL(resumoLancamentos.receitasMesAtual)}</div>
        </div>
        <div style={{ ...styles.resumoCard, borderColor: "#f44336" }}>
          <div style={styles.resumoLabel}>DESPESA DO MES ATUAL</div>
          <div style={{ ...styles.resumoValor, color: "#f44336" }}>{formatBRL(resumoLancamentos.despesasMesAtual)}</div>
        </div>
      </div>

      {membros.length === 0 && (
        <div style={styles.aviso}>
          Nenhum membro cadastrado. Cadastre os membros da familia na aba Perfil antes de adicionar rendas e despesas.
        </div>
      )}

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitulo}>Rendas</h2>
          <button style={styles.btnAdicionar} onClick={() => setModal({ tipo: "renda", item: null })} disabled={membros.length === 0}>
            + Adicionar renda
          </button>
        </div>
        {rendas.length === 0 ? (
          <div style={styles.vazio}>Nenhuma renda cadastrada.</div>
        ) : (
          rendas.map((item) => (
            <ItemCard key={item.id} item={item} tipo="renda" onEdit={(selected) => setModal({ tipo: "renda", item: selected })} onDelete={(id) => handleDelete("renda", id)} />
          ))
        )}
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitulo}>Despesas</h2>
          <button style={styles.btnAdicionar} onClick={() => setModal({ tipo: "despesa", item: null })} disabled={membros.length === 0}>
            + Adicionar despesa
          </button>
        </div>

        {totalLancamentos > 0 && (
          <div style={styles.cardLancamentos}>
            <div>
              <div style={styles.cardLancTitulo}>Despesas do mes nos lancamentos</div>
              <div style={styles.cardLancSub}>Total do mes atual com base nos lancamentos reais</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={styles.cardLancValor}>{formatBRL(totalLancamentos)}</div>
              <button style={styles.btnUsarTotal} onClick={() => setModal({ tipo: "despesa", item: null, valorInicial: totalLancamentos })} disabled={membros.length === 0}>
                Usar como despesa total
              </button>
            </div>
          </div>
        )}

        {despesas.length === 0 ? (
          <div style={styles.vazio}>Nenhuma despesa cadastrada.</div>
        ) : (
          despesas.map((item) => (
            <ItemCard key={item.id} item={item} tipo="despesa" onEdit={(selected) => setModal({ tipo: "despesa", item: selected })} onDelete={(id) => handleDelete("despesa", id)} />
          ))
        )}
      </section>

      {modal && (
        <Modal
          tipo={modal.tipo}
          membros={membros}
          item={modal.item}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            carregar();
          }}
          userId={userId}
          token={token}
          valorInicial={modal.valorInicial}
        />
      )}
    </div>
  );
}

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
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 32,
  },
  resumoCard: {
    background: "#fff",
    border: "2px solid",
    borderRadius: 10,
    padding: "16px 20px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
  },
  resumoLabel: {
    fontSize: 12,
    color: "#777",
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
    color: "#E8E8E8",
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
  cardAcoes: {
    display: "flex",
    gap: 6,
    marginTop: 4,
  },
  btnAcao: {
    background: "none",
    border: "1px solid #d9d9d9",
    cursor: "pointer",
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 6,
    lineHeight: 1.2,
  },
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
    color: "#E8E8E8",
    marginBottom: 3,
  },
  cardLancSub: {
    fontSize: 12,
    color: "#C8D3E2",
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
    color: "#8EC5FF",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
