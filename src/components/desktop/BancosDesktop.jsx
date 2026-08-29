import { useMemo, useState } from "react";
import { desktopTheme as t } from "./theme";

// Tela "Bancos" do desktop (Fase C, fatias 1 e 2). Banco é a entidade raiz: o usuário
// cadastra as instituições onde tem conta e pendura o que é de cada uma.
//
// Cartões são leitura (cadastrados na tela de Cartões); dívidas têm CRUD aqui, porque
// é o único lugar do app onde elas existem. Investimentos entram na fatia 3 — só então
// há ativo pra subtrair do passivo e o patrimônio líquido passa a significar algo.
// O gasto do mês vem dos lançamentos já em memória.

// Lista semi-fechada (decisão do Lucas, 29/08): os mais buscados com código COMPE,
// mais "Outro" digitável. Os 8 primeiros são os do print da jornada Nobel; XP e BTG
// entraram porque é o perfil de quem usa o Diagnóstico FP.
const BANCOS_COMUNS = [
  { codigo: "001", nome: "Banco do Brasil" },
  { codigo: "237", nome: "Bradesco" },
  { codigo: "104", nome: "Caixa Econômica" },
  { codigo: "341", nome: "Itaú Unibanco" },
  { codigo: "033", nome: "Santander" },
  { codigo: "260", nome: "Nubank" },
  { codigo: "077", nome: "Banco Inter" },
  { codigo: "336", nome: "Banco C6" },
  { codigo: "102", nome: "XP Investimentos" },
  { codigo: "208", nome: "BTG Pactual" },
];

const CSS = `
.pdx-bnc { font-family: 'DM Sans', 'Helvetica Neue', sans-serif; display: flex; flex-direction: column; gap: 1rem; }
.pdx-bnc__head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.pdx-bnc__sub { margin: 0; font-size: 0.85rem; color: ${t.textSecondary}; }
.pdx-bnc__form { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 1.25rem 1.35rem; }
.pdx-bnc__formtitle { margin: 0 0 1rem; font-size: 0.75rem; font-weight: 600; color: ${t.textSecondary}; text-transform: uppercase; letter-spacing: 0.07em; }
.pdx-bnc__chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(178px, 1fr)); gap: 0.55rem; }
.pdx-bnc__chip { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.55rem 0.8rem; border: 1px solid ${t.surfaceBorder}; border-radius: 9px; background: ${t.surface}; color: ${t.textPrimary}; font-family: inherit; font-size: 0.85rem; font-weight: 600; text-align: left; cursor: pointer; }
.pdx-bnc__chip:hover:not(:disabled) { border-color: ${t.accent}; }
.pdx-bnc__chip:disabled { opacity: 0.45; cursor: not-allowed; }
.pdx-bnc__chip.is-on { border-color: ${t.accent}; background: ${t.chipBg}; color: ${t.chipText}; }
.pdx-bnc__chipcod { font-size: 0.66rem; font-weight: 500; color: ${t.textSecondary}; font-variant-numeric: tabular-nums; }
.pdx-bnc__chip.is-on .pdx-bnc__chipcod { color: ${t.chipText}; }
.pdx-bnc__outro { margin-top: 0.75rem; display: flex; gap: 0.6rem; flex-wrap: wrap; }
.pdx-bnc__outro input { flex: 1; min-width: 210px; box-sizing: border-box; padding: 0.6rem 0.75rem; border: 1px solid ${t.surfaceBorder}; border-radius: 8px; background: ${t.surface}; color: ${t.textPrimary}; font-family: inherit; font-size: 0.9rem; }
.pdx-bnc__outro input:focus { outline: none; border-color: ${t.accent}; box-shadow: 0 0 0 3px ${t.chipBg}; }
.pdx-bnc__acoesform { display: flex; gap: 0.6rem; margin-top: 1.1rem; }
.pdx-bnc__erro { margin: 0.85rem 0 0; font-size: 0.82rem; color: ${t.gasto}; }
.pdx-bnc__lista { display: flex; flex-direction: column; gap: 0.75rem; }
.pdx-bnc__card { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; overflow: hidden; }
.pdx-bnc__cardtopo { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; }
.pdx-bnc__toggle { display: flex; align-items: center; gap: 0.7rem; flex: 1; min-width: 0; background: none; border: none; padding: 0; font-family: inherit; text-align: left; cursor: pointer; color: ${t.textPrimary}; }
.pdx-bnc__seta { flex-shrink: 0; color: ${t.textSecondary}; transition: transform 0.15s; }
.pdx-bnc__seta.is-open { transform: rotate(90deg); }
.pdx-bnc__nome { margin: 0; font-size: 1rem; font-weight: 700; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdx-bnc__meta { margin: 0.1rem 0 0; font-size: 0.76rem; color: ${t.textSecondary}; }
.pdx-bnc__total { text-align: right; flex-shrink: 0; }
.pdx-bnc__total b { display: block; font-size: 1.05rem; font-weight: 700; color: ${t.textPrimary}; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.pdx-bnc__total span { font-size: 0.68rem; color: ${t.textSecondary}; text-transform: uppercase; letter-spacing: 0.07em; }
.pdx-bnc__acoes { display: flex; gap: 0.5rem; flex-shrink: 0; }
.pdx-bnc__corpo { border-top: 1px solid ${t.surfaceBorder}; padding: 1rem 1.25rem 1.15rem; background: ${t.mainBg}; }
.pdx-bnc__secao { margin: 0 0 0.6rem; font-size: 0.68rem; font-weight: 600; color: ${t.textSecondary}; text-transform: uppercase; letter-spacing: 0.08em; }
.pdx-bnc__item { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding: 0.5rem 0; border-bottom: 1px solid ${t.surfaceBorder}; }
.pdx-bnc__item:last-child { border-bottom: none; }
.pdx-bnc__itemnome { font-size: 0.88rem; color: ${t.textPrimary}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdx-bnc__itemmeta { font-size: 0.74rem; color: ${t.textSecondary}; }
.pdx-bnc__itemval { font-size: 0.88rem; font-weight: 600; color: ${t.textPrimary}; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pdx-bnc__vazio { margin: 0; font-size: 0.85rem; color: ${t.textSecondary}; padding: 0.4rem 0; }
.pdx-bnc__secaotopo { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
.pdx-bnc__divida { border-bottom: 1px solid ${t.surfaceBorder}; padding: 0.55rem 0; }
.pdx-bnc__divida:last-child { border-bottom: none; }
.pdx-bnc__dividatopo { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
.pdx-bnc__dividaval { font-size: 0.9rem; font-weight: 700; color: ${t.gasto}; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pdx-bnc__dividaacoes { display: flex; gap: 0.4rem; margin-top: 0.45rem; }
.pdx-bnc__campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); gap: 0.7rem; }
.pdx-bnc__campo { display: flex; flex-direction: column; gap: 0.28rem; min-width: 0; }
.pdx-bnc__campo label { font-size: 0.72rem; font-weight: 600; color: ${t.textSecondary}; }
.pdx-bnc__campo input, .pdx-bnc__campo select { width: 100%; box-sizing: border-box; padding: 0.5rem 0.65rem; border: 1px solid ${t.surfaceBorder}; border-radius: 8px; background: ${t.surface}; color: ${t.textPrimary}; font-family: inherit; font-size: 0.87rem; }
.pdx-bnc__campo input:focus, .pdx-bnc__campo select:focus { outline: none; border-color: ${t.accent}; box-shadow: 0 0 0 3px ${t.chipBg}; }
.pdx-bnc__formdiv { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 10px; padding: 0.95rem 1.05rem; margin-top: 0.6rem; }
.pdx-bnc__resumo { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.6rem 2rem; background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 1rem 1.25rem; }
.pdx-bnc__resumoitem { display: flex; flex-direction: column; gap: 0.1rem; }
.pdx-bnc__resumoitem span { font-size: 0.68rem; color: ${t.textSecondary}; text-transform: uppercase; letter-spacing: 0.07em; }
.pdx-bnc__resumoitem b { font-size: 1.15rem; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.pdx-bnc__resumonota { margin-left: auto; font-size: 0.78rem; color: ${t.textSecondary}; max-width: 34ch; }
.pdx-bnc__empty { background: ${t.surface}; border: 1px dashed ${t.surfaceBorder}; border-radius: 12px; padding: 2.5rem 1.5rem; text-align: center; color: ${t.textSecondary}; font-size: 0.9rem; }
.pdx-bnc__semvinculo { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 1rem 1.25rem; font-size: 0.85rem; color: ${t.textSecondary}; }
.pdx-bnc__semvinculo b { color: ${t.textPrimary}; font-weight: 600; }
.pdx-btn { padding: 0.5rem 1rem; border-radius: 8px; font-family: inherit; font-size: 0.83rem; font-weight: 600; cursor: pointer; border: 1px solid ${t.surfaceBorder}; background: ${t.surface}; color: ${t.textSecondary}; white-space: nowrap; }
.pdx-btn:hover:not(:disabled) { background: ${t.mainBg}; color: ${t.textPrimary}; }
.pdx-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.pdx-btn--primary { background: ${t.accent}; border-color: ${t.accent}; color: #fff; }
.pdx-btn--primary:hover:not(:disabled) { background: ${t.accentHover}; color: #fff; }
.pdx-btn--danger { color: ${t.gasto}; }
.pdx-btn--danger:hover:not(:disabled) { background: #FEF2F2; color: ${t.gasto}; }
`;

const mesCorrente = () => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
};

const DIVIDA_VAZIA = { descricao: "", saldo_devedor: "", valor_parcela: "", parcelas_restantes: "", taxa_juros_mensal: "", banco_id: "" };

// Formulário de dívida — usado dentro do card do banco e no bloco "sem instituição".
// O seletor de banco fica sempre visível pra dar como mover uma dívida de lugar.
function FormDivida({ valor, bancos, salvando, erro, onCampo, onSalvar, onCancelar, ehEdicao }) {
  return (
    <div className="pdx-bnc__formdiv">
      <div className="pdx-bnc__campos">
        <div className="pdx-bnc__campo" style={{ gridColumn: "1 / -1" }}>
          <label>Descrição</label>
          <input type="text" placeholder="Ex.: Financiamento do carro" value={valor.descricao}
            onChange={(e) => onCampo("descricao", e.target.value)} autoFocus />
        </div>
        <div className="pdx-bnc__campo">
          <label>Saldo devedor</label>
          <input type="text" inputMode="decimal" placeholder="0,00" value={valor.saldo_devedor}
            onChange={(e) => onCampo("saldo_devedor", e.target.value)} />
        </div>
        <div className="pdx-bnc__campo">
          <label>Parcela mensal</label>
          <input type="text" inputMode="decimal" placeholder="opcional" value={valor.valor_parcela}
            onChange={(e) => onCampo("valor_parcela", e.target.value)} />
        </div>
        <div className="pdx-bnc__campo">
          <label>Parcelas restantes</label>
          <input type="number" min="0" placeholder="opcional" value={valor.parcelas_restantes}
            onChange={(e) => onCampo("parcelas_restantes", e.target.value)} />
        </div>
        <div className="pdx-bnc__campo">
          <label>Juros ao mês (%)</label>
          <input type="text" inputMode="decimal" placeholder="opcional" value={valor.taxa_juros_mensal}
            onChange={(e) => onCampo("taxa_juros_mensal", e.target.value)} />
        </div>
        <div className="pdx-bnc__campo">
          <label>Banco</label>
          <select value={valor.banco_id} onChange={(e) => onCampo("banco_id", e.target.value)}>
            <option value="">Sem banco</option>
            {bancos.map((b) => <option key={b.id} value={String(b.id)}>{b.nome}</option>)}
          </select>
        </div>
      </div>
      {erro && <p className="pdx-bnc__erro">{erro}</p>}
      <div className="pdx-bnc__acoesform">
        <button className="pdx-btn pdx-btn--primary" onClick={onSalvar} disabled={salvando}>
          {salvando ? "Salvando..." : ehEdicao ? "Salvar alterações" : "Adicionar dívida"}
        </button>
        <button className="pdx-btn" onClick={onCancelar} disabled={salvando}>Cancelar</button>
      </div>
    </div>
  );
}

export default function BancosDesktop({
  bancos, cartoes, dividas = [], lancamentos, formatBRL, normalizeText,
  onCriar, onRenomear, onExcluir,
  onCriarDivida, onAtualizarDivida, onExcluirDivida,
}) {
  // Uma dívida em edição/criação por vez: a chave é o id da dívida, ou
  // `nova-<bancoId>` quando é cadastro dentro daquele card.
  const [dividaAberta, setDividaAberta] = useState(null);
  const [formDivida, setFormDivida] = useState(DIVIDA_VAZIA);
  const [salvandoDivida, setSalvandoDivida] = useState(false);
  const [erroDivida, setErroDivida] = useState("");
  const [confirmarDivida, setConfirmarDivida] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [escolha, setEscolha] = useState(null); // código COMPE ou "outro"
  const [nomeLivre, setNomeLivre] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");

  const [expandido, setExpandido] = useState({});
  const [editandoId, setEditandoId] = useState(null);
  const [rascunho, setRascunho] = useState("");
  const [confirmarId, setConfirmarId] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erroLinha, setErroLinha] = useState({});

  const setErro = (id, msg) => setErroLinha(prev => ({ ...prev, [id]: msg }));
  const limparErro = (id) => setErroLinha(prev => { const p = { ...prev }; delete p[id]; return p; });

  // Gasto do mês corrente por cartão — agregação client-side, nenhuma query nova.
  const gastoPorCartao = useMemo(() => {
    const mes = mesCorrente();
    const mapa = {};
    for (const l of lancamentos) {
      if (l.tipo !== "gasto" || !l.cartao_id) continue;
      if (!l.data_lancamento?.startsWith(mes)) continue;
      mapa[l.cartao_id] = (mapa[l.cartao_id] || 0) + Number(l.valor || 0);
    }
    return mapa;
  }, [lancamentos]);

  const cartoesDoBanco = (bancoId) => cartoes.filter(c => Number(c.banco_id) === Number(bancoId));
  const dividasDoBanco = (bancoId) => dividas.filter(d => Number(d.banco_id) === Number(bancoId));
  const semBanco = cartoes.filter(c => !c.banco_id);
  const dividasSemBanco = dividas.filter(d => !d.banco_id);
  const totalPassivos = dividas.reduce((s, d) => s + Number(d.saldo_devedor || 0), 0);

  const abrirNovaDivida = (bancoId) => {
    setDividaAberta(`nova-${bancoId ?? "sem"}`);
    setFormDivida({ ...DIVIDA_VAZIA, banco_id: bancoId != null ? String(bancoId) : "" });
    setErroDivida(""); setConfirmarDivida(null);
  };

  const abrirEdicaoDivida = (d) => {
    setDividaAberta(d.id);
    setFormDivida({
      descricao: d.descricao || "",
      saldo_devedor: d.saldo_devedor != null ? String(d.saldo_devedor) : "",
      valor_parcela: d.valor_parcela != null ? String(d.valor_parcela) : "",
      parcelas_restantes: d.parcelas_restantes != null ? String(d.parcelas_restantes) : "",
      taxa_juros_mensal: d.taxa_juros_mensal != null ? String(d.taxa_juros_mensal) : "",
      banco_id: d.banco_id != null ? String(d.banco_id) : "",
    });
    setErroDivida(""); setConfirmarDivida(null);
  };

  const fecharDivida = () => { setDividaAberta(null); setFormDivida(DIVIDA_VAZIA); setErroDivida(""); };

  const salvarDivida = async () => {
    setSalvandoDivida(true); setErroDivida("");
    const ehEdicao = typeof dividaAberta === "number";
    const res = ehEdicao ? await onAtualizarDivida(dividaAberta, formDivida) : await onCriarDivida(formDivida);
    setSalvandoDivida(false);
    if (!res?.ok) { setErroDivida(res?.erro || "Não foi possível salvar."); return; }
    fecharDivida();
  };

  const removerDivida = async (id) => {
    setSalvandoDivida(true); setErroDivida("");
    const res = await onExcluirDivida(id);
    setSalvandoDivida(false);
    // Mantém a confirmação aberta quando falha: é onde a mensagem de erro aparece.
    if (!res?.ok) { setErroDivida(res?.erro || "Não foi possível excluir."); return; }
    setConfirmarDivida(null);
  };

  // Uma dívida sempre mostra saldo; parcela, prazo e juros são opcionais.
  const metaDivida = (d) => [
    d.valor_parcela ? `${formatBRL(d.valor_parcela)}/mês` : null,
    d.parcelas_restantes ? `${d.parcelas_restantes}x restantes` : null,
    d.taxa_juros_mensal ? `${String(d.taxa_juros_mensal).replace(".", ",")}% a.m.` : null,
  ].filter(Boolean).join(" · ");

  const listaDividas = (lista) => lista.map((d) => (
    <div className="pdx-bnc__divida" key={d.id}>
      {dividaAberta === d.id ? (
        <FormDivida
          valor={formDivida} bancos={bancos} salvando={salvandoDivida} erro={erroDivida} ehEdicao
          onCampo={(k, v) => { setFormDivida(f => ({ ...f, [k]: v })); setErroDivida(""); }}
          onSalvar={salvarDivida} onCancelar={fecharDivida}
        />
      ) : (
        <>
          <div className="pdx-bnc__dividatopo">
            <div style={{ minWidth: 0 }}>
              <p className="pdx-bnc__itemnome" style={{ margin: 0 }}>{normalizeText(d.descricao)}</p>
              <p className="pdx-bnc__itemmeta" style={{ margin: 0 }}>{metaDivida(d) || "só saldo informado"}</p>
            </div>
            <span className="pdx-bnc__dividaval">{formatBRL(d.saldo_devedor)}</span>
          </div>
          <div className="pdx-bnc__dividaacoes">
            {confirmarDivida === d.id ? (
              <>
                <button className="pdx-btn pdx-btn--danger" onClick={() => removerDivida(d.id)} disabled={salvandoDivida}>
                  {salvandoDivida ? "..." : "Confirmar exclusão"}
                </button>
                <button className="pdx-btn" onClick={() => setConfirmarDivida(null)} disabled={salvandoDivida}>Cancelar</button>
              </>
            ) : (
              <>
                <button className="pdx-btn" onClick={() => abrirEdicaoDivida(d)}>Editar</button>
                <button className="pdx-btn pdx-btn--danger" onClick={() => { setErroDivida(""); setDividaAberta(null); setConfirmarDivida(d.id); }}>Excluir</button>
              </>
            )}
          </div>
          {confirmarDivida === d.id && erroDivida && <p className="pdx-bnc__erro">{erroDivida}</p>}
        </>
      )}
    </div>
  ));

  const jaCadastrado = (nome) => bancos.some(b => b.nome.toLowerCase() === nome.trim().toLowerCase());

  const abrirNovo = () => { setAberto(true); setEscolha(null); setNomeLivre(""); setErroForm(""); };
  const fecharNovo = () => { setAberto(false); setEscolha(null); setNomeLivre(""); setErroForm(""); };

  const salvarNovo = async () => {
    const comum = BANCOS_COMUNS.find(b => b.codigo === escolha);
    const nome = comum ? comum.nome : nomeLivre.trim();
    const codigo = comum ? comum.codigo : null;
    if (!nome) { setErroForm("Escolha um banco da lista ou digite o nome."); return; }
    setSalvando(true); setErroForm("");
    const res = await onCriar(nome, codigo);
    setSalvando(false);
    if (!res?.ok) { setErroForm(res?.erro || "Não foi possível cadastrar."); return; }
    fecharNovo();
  };

  const salvarNome = async (banco) => {
    setOcupado(true); limparErro(banco.id);
    const res = await onRenomear(banco, rascunho);
    setOcupado(false);
    if (!res?.ok) { setErro(banco.id, res?.erro || "Não foi possível renomear."); return; }
    setEditandoId(null); setRascunho("");
  };

  const excluir = async (banco) => {
    setOcupado(true); limparErro(banco.id);
    const res = await onExcluir(banco.id);
    setOcupado(false);
    setConfirmarId(null);
    if (!res?.ok) setErro(banco.id, res?.erro || "Não foi possível excluir.");
  };

  return (
    <div className="pdx-bnc">
      <style>{CSS}</style>

      <div className="pdx-bnc__head">
        <p className="pdx-bnc__sub">
          {bancos.length === 0
            ? "Cadastre as instituições onde você tem conta."
            : `${bancos.length} ${bancos.length === 1 ? "instituição cadastrada" : "instituições cadastradas"} · gasto do mês corrente`}
        </p>
        <div className="pdx-bnc__acoes">
          {!dividaAberta && <button className="pdx-btn" onClick={() => abrirNovaDivida(null)}>Nova dívida</button>}
          {!aberto && <button className="pdx-btn pdx-btn--primary" onClick={abrirNovo}>Novo banco</button>}
        </div>
      </div>

      {aberto && (
        <div className="pdx-bnc__form">
          <p className="pdx-bnc__formtitle">Instituições mais usadas</p>
          <div className="pdx-bnc__chips">
            {BANCOS_COMUNS.map(({ codigo, nome }) => {
              const usado = jaCadastrado(nome);
              return (
                <button
                  key={codigo}
                  className={`pdx-bnc__chip${escolha === codigo ? " is-on" : ""}`}
                  onClick={() => { setEscolha(codigo); setErroForm(""); }}
                  disabled={usado}
                  title={usado ? "Já cadastrado" : undefined}
                  aria-pressed={escolha === codigo}
                >
                  <span className="pdx-bnc__chipcod">[{codigo}]{usado ? " · já cadastrado" : ""}</span>
                  {nome}
                </button>
              );
            })}
            <button
              className={`pdx-bnc__chip${escolha === "outro" ? " is-on" : ""}`}
              onClick={() => { setEscolha("outro"); setErroForm(""); }}
              aria-pressed={escolha === "outro"}
            >
              <span className="pdx-bnc__chipcod">sem código</span>
              Outro banco
            </button>
          </div>

          {escolha === "outro" && (
            <div className="pdx-bnc__outro">
              <input
                type="text" placeholder="Nome da instituição" value={nomeLivre} autoFocus
                onChange={(e) => { setNomeLivre(e.target.value); setErroForm(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && nomeLivre.trim() && !salvando) salvarNovo(); }}
              />
            </div>
          )}

          {erroForm && <p className="pdx-bnc__erro">{erroForm}</p>}

          <div className="pdx-bnc__acoesform">
            <button className="pdx-btn pdx-btn--primary" onClick={salvarNovo} disabled={salvando || !escolha}>
              {salvando ? "Cadastrando..." : "Cadastrar banco"}
            </button>
            <button className="pdx-btn" onClick={fecharNovo} disabled={salvando}>Cancelar</button>
          </div>
        </div>
      )}

      {bancos.length === 0 && !aberto ? (
        <div className="pdx-bnc__empty">
          Cadastre um banco para agrupar os cartões e as dívidas de cada instituição.
        </div>
      ) : (
        <div className="pdx-bnc__lista">
          {bancos.map((banco) => {
            const doBanco = cartoesDoBanco(banco.id);
            const dividasBanco = dividasDoBanco(banco.id);
            const devido = dividasBanco.reduce((s, d) => s + Number(d.saldo_devedor || 0), 0);
            const total = doBanco.reduce((s, c) => s + (gastoPorCartao[c.id] || 0), 0);
            const aberta = !!expandido[banco.id];
            const emEdicao = editandoId === banco.id;
            return (
              <div className="pdx-bnc__card" key={banco.id}>
                <div className="pdx-bnc__cardtopo">
                  {emEdicao ? (
                    <div className="pdx-bnc__outro" style={{ margin: 0, flex: 1 }}>
                      <input
                        type="text" value={rascunho} autoFocus
                        onChange={(e) => { setRascunho(e.target.value); limparErro(banco.id); }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") { setEditandoId(null); setRascunho(""); }
                          if (e.key === "Enter" && rascunho.trim() && !ocupado) salvarNome(banco);
                        }}
                      />
                      <button className="pdx-btn pdx-btn--primary" onClick={() => salvarNome(banco)} disabled={ocupado || !rascunho.trim()}>
                        {ocupado ? "Salvando..." : "Salvar"}
                      </button>
                      <button className="pdx-btn" onClick={() => { setEditandoId(null); setRascunho(""); }} disabled={ocupado}>Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="pdx-bnc__toggle"
                        onClick={() => setExpandido(prev => ({ ...prev, [banco.id]: !prev[banco.id] }))}
                        aria-expanded={aberta}
                      >
                        <svg className={`pdx-bnc__seta${aberta ? " is-open" : ""}`} viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <span style={{ minWidth: 0 }}>
                          <p className="pdx-bnc__nome">{normalizeText(banco.nome)}</p>
                          <p className="pdx-bnc__meta">
                            {banco.codigo_compe ? `[${banco.codigo_compe}] · ` : ""}
                            {doBanco.length === 0 ? "nenhum cartão" : `${doBanco.length} ${doBanco.length === 1 ? "cartão" : "cartões"}`}
                            {dividasBanco.length > 0 && ` · ${dividasBanco.length} ${dividasBanco.length === 1 ? "dívida" : "dívidas"}`}
                          </p>
                        </span>
                      </button>
                      <div className="pdx-bnc__total">
                        {devido > 0 ? (
                          <>
                            <b style={{ color: t.gasto }}>{formatBRL(devido)}</b>
                            <span>devido</span>
                          </>
                        ) : (
                          <>
                            <b>{formatBRL(total)}</b>
                            <span>no mês</span>
                          </>
                        )}
                      </div>
                      <div className="pdx-bnc__acoes">
                        {confirmarId === banco.id ? (
                          <>
                            <button className="pdx-btn pdx-btn--danger" onClick={() => excluir(banco)} disabled={ocupado}>
                              {ocupado ? "..." : "Confirmar exclusão"}
                            </button>
                            <button className="pdx-btn" onClick={() => setConfirmarId(null)} disabled={ocupado}>Cancelar</button>
                          </>
                        ) : (
                          <>
                            <button
                              className="pdx-btn"
                              onClick={() => { limparErro(banco.id); setConfirmarId(null); setEditandoId(banco.id); setRascunho(banco.nome); }}
                              disabled={ocupado}
                            >
                              Editar
                            </button>
                            <button
                              className="pdx-btn pdx-btn--danger"
                              onClick={() => { limparErro(banco.id); setEditandoId(null); setConfirmarId(banco.id); }}
                              disabled={ocupado}
                            >
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {confirmarId === banco.id && doBanco.length > 0 && (
                  <div className="pdx-bnc__corpo">
                    <p className="pdx-bnc__vazio">
                      {doBanco.length} {doBanco.length === 1 ? "cartão continua existindo" : "cartões continuam existindo"}, só deixam de estar vinculados a este banco.
                    </p>
                  </div>
                )}
                {erroLinha[banco.id] && (
                  <div className="pdx-bnc__corpo"><p className="pdx-bnc__erro" style={{ margin: 0 }}>{erroLinha[banco.id]}</p></div>
                )}

                {aberta && !emEdicao && (
                  <div className="pdx-bnc__corpo">
                    <p className="pdx-bnc__secao">Cartões</p>
                    {doBanco.length === 0 ? (
                      <p className="pdx-bnc__vazio">Nenhum cartão vinculado. Vincule na tela de Cartões.</p>
                    ) : doBanco.map((c) => (
                      <div className="pdx-bnc__item" key={c.id}>
                        <div style={{ minWidth: 0 }}>
                          <p className="pdx-bnc__itemnome" style={{ margin: 0 }}>{normalizeText(c.nome)}</p>
                          <p className="pdx-bnc__itemmeta" style={{ margin: 0 }}>
                            {[normalizeText(c.bandeira) || null, c.dia_vencimento ? `Vence dia ${c.dia_vencimento}` : null]
                              .filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        <span className="pdx-bnc__itemval">{formatBRL(gastoPorCartao[c.id] || 0)}</span>
                      </div>
                    ))}

                    <div className="pdx-bnc__secaotopo" style={{ marginTop: "1.1rem" }}>
                      <p className="pdx-bnc__secao" style={{ margin: 0 }}>
                        Dívidas{devido > 0 ? ` · ${formatBRL(devido)}` : ""}
                      </p>
                      {dividaAberta !== `nova-${banco.id}` && (
                        <button className="pdx-btn" onClick={() => abrirNovaDivida(banco.id)}>Nova dívida</button>
                      )}
                    </div>
                    {dividasBanco.length === 0 && dividaAberta !== `nova-${banco.id}` ? (
                      <p className="pdx-bnc__vazio">Nenhuma dívida nesta instituição.</p>
                    ) : listaDividas(dividasBanco)}
                    {dividaAberta === `nova-${banco.id}` && (
                      <FormDivida
                        valor={formDivida} bancos={bancos} salvando={salvandoDivida} erro={erroDivida}
                        onCampo={(k, v) => { setFormDivida(f => ({ ...f, [k]: v })); setErroDivida(""); }}
                        onSalvar={salvarDivida} onCancelar={fecharDivida}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(dividasSemBanco.length > 0 || dividaAberta === "nova-sem") && (
        <div className="pdx-bnc__semvinculo">
          <div className="pdx-bnc__secaotopo">
            <p className="pdx-bnc__secao" style={{ margin: 0 }}>Dívidas sem instituição</p>
            {dividaAberta !== "nova-sem" && (
              <button className="pdx-btn" onClick={() => abrirNovaDivida(null)}>Nova dívida</button>
            )}
          </div>
          {listaDividas(dividasSemBanco)}
          {dividaAberta === "nova-sem" && (
            <FormDivida
              valor={formDivida} bancos={bancos} salvando={salvandoDivida} erro={erroDivida}
              onCampo={(k, v) => { setFormDivida(f => ({ ...f, [k]: v })); setErroDivida(""); }}
              onSalvar={salvarDivida} onCancelar={fecharDivida}
            />
          )}
        </div>
      )}

      {totalPassivos > 0 && (
        <div className="pdx-bnc__resumo">
          <div className="pdx-bnc__resumoitem">
            <span>Total devido</span>
            <b style={{ color: t.gasto }}>{formatBRL(totalPassivos)}</b>
          </div>
          <div className="pdx-bnc__resumoitem">
            <span>Dívidas ativas</span>
            <b style={{ color: t.textPrimary }}>{dividas.length}</b>
          </div>
          <p className="pdx-bnc__resumonota">
            Só o lado dos passivos. O patrimônio líquido aparece quando os investimentos
            passarem a ser somados por instituição.
          </p>
        </div>
      )}

      {semBanco.length > 0 && (
        <div className="pdx-bnc__semvinculo">
          <b>{semBanco.length} {semBanco.length === 1 ? "cartão ainda não tem banco" : "cartões ainda não têm banco"}:</b>{" "}
          {semBanco.map(c => normalizeText(c.nome)).join(", ")}. Vincule na tela de Cartões.
        </div>
      )}
    </div>
  );
}
