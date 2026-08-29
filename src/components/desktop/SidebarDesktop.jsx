import { desktopTheme as t, SIDEBAR_WIDTH } from "./theme";

// Ícones outline (estilo Tabler/Lucide) inline — sem dependência nova.
const Icon = ({ name }) => {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
    lancamentos: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3.5" y1="6" x2="3.51" y2="6" /><line x1="3.5" y1="12" x2="3.51" y2="12" /><line x1="3.5" y1="18" x2="3.51" y2="18" /></>,
    cartoes: <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>,
    categorias: <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></>,
    fp: <><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>,
    relatorios: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

// Mapeia cada item da sidebar pro estado `tela` do App (fonte da verdade única).
const ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard", tela: "dashboard", activeFor: ["dashboard"] },
  { key: "lancamentos", label: "Lançamentos", icon: "lancamentos", tela: "historico", activeFor: ["historico", "lancamentos"] },
  { key: "cartoes", label: "Cartões", icon: "cartoes", tela: "cartoes", activeFor: ["cartoes"] },
  { key: "categorias", label: "Categorias", icon: "categorias", tela: "categorias", activeFor: ["categorias"] },
  { key: "fp", label: "Diagnóstico FP", icon: "fp", tela: "fp", activeFor: ["fp"], gatePago: true },
  { key: "relatorios", label: "Relatórios", icon: "relatorios", disabled: true },
];

const CSS = `
.pdx-sb { position: fixed; top: 0; left: 0; bottom: 0; width: ${SIDEBAR_WIDTH}px; background: ${t.sidebarBg}; color: ${t.sidebarText}; display: flex; flex-direction: column; font-family: 'DM Sans', 'Helvetica Neue', sans-serif; z-index: 40; }
.pdx-sb__logo { display: flex; align-items: center; gap: 0.55rem; padding: 1.4rem 1.25rem 1.1rem; color: ${t.sidebarLogo}; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.01em; }
.pdx-sb__logo span { width: 26px; height: 26px; border-radius: 8px; background: rgba(255,255,255,0.16); display: flex; align-items: center; justify-content: center; font-size: 0.9rem; }
.pdx-sb__nav { flex: 1; padding: 0.5rem 0.75rem; overflow-y: auto; }
.pdx-sb__item { display: flex; align-items: center; gap: 0.7rem; width: 100%; box-sizing: border-box; padding: 0.6rem 0.75rem; margin-bottom: 0.15rem; border: none; border-radius: 9px; background: transparent; color: ${t.sidebarText}; font-size: 0.9rem; font-weight: 500; font-family: inherit; cursor: pointer; text-align: left; transition: background 0.15s, color 0.15s; }
.pdx-sb__item:hover:not(:disabled) { background: rgba(255,255,255,0.10); color: #fff; }
.pdx-sb__item.is-active { background: ${t.sidebarActiveBg}; color: ${t.sidebarActiveText}; font-weight: 600; }
.pdx-sb__item:disabled { opacity: 0.5; cursor: default; }
.pdx-sb__item .pdx-sb__soon { margin-left: auto; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; }
.pdx-sb__user { display: flex; align-items: center; gap: 0.6rem; padding: 0.9rem 1rem; border-top: 1px solid rgba(255,255,255,0.14); }
.pdx-sb__avatar { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,0.18); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0; }
.pdx-sb__uinfo { flex: 1; min-width: 0; }
.pdx-sb__uinfo p { margin: 0; }
.pdx-sb__uname { font-size: 0.82rem; color: #fff; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdx-sb__urole { font-size: 0.7rem; color: ${t.sidebarText}; }
.pdx-sb__logout { background: none; border: none; color: ${t.sidebarText}; cursor: pointer; padding: 0.3rem; border-radius: 6px; display: flex; }
.pdx-sb__logout:hover { color: #fff; background: rgba(255,255,255,0.12); }
`;

function iniciais(email) {
  if (!email) return "P";
  const nome = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  const partes = nome.split(/\s+/);
  return ((partes[0]?.[0] || "") + (partes[1]?.[0] || "")).toUpperCase() || "P";
}

export default function SidebarDesktop({ tela, setTela, userEmail, userRole, onLogout, acessoPago = false }) {
  const roleLabel = userRole === "super_admin" ? "Admin" : userRole === "assessor" ? "Assessor" : "Usuário";
  // Itens marcados com gatePago só existem no menu pra quem tem acesso pago.
  const itens = ITEMS.filter((item) => !item.gatePago || acessoPago);
  return (
    <aside className="pdx-sb">
      <style>{CSS}</style>
      <div className="pdx-sb__logo"><span>P</span>Pradex</div>
      <nav className="pdx-sb__nav">
        {itens.map((item) => {
          const active = item.activeFor?.includes(tela);
          return (
            <button
              key={item.key}
              className={`pdx-sb__item${active ? " is-active" : ""}`}
              disabled={item.disabled}
              onClick={() => !item.disabled && setTela(item.tela)}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
              {item.disabled && <span className="pdx-sb__soon">em breve</span>}
            </button>
          );
        })}
      </nav>
      <div className="pdx-sb__user">
        <div className="pdx-sb__avatar">{iniciais(userEmail)}</div>
        <div className="pdx-sb__uinfo">
          <p className="pdx-sb__uname">{userEmail || "Pradex"}</p>
          <p className="pdx-sb__urole">{roleLabel}</p>
        </div>
        <button className="pdx-sb__logout" onClick={onLogout} title="Sair" aria-label="Sair">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
