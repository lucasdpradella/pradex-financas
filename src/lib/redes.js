// Perfis oficiais do PRADEX nas redes. Fonte única pro rodapé da Landing, pro rodapé
// das páginas públicas e pro `sameAs` do JSON-LD Organization
// (scripts/gerar-paginas-publicas.mjs).
//
// ⚠️ VAZIO DE PROPÓSITO até o Lucas mandar os @ oficiais. Não inventar handle: link
// errado em sameAs ensina buscador/IA a associar o Pradex a um perfil de outra pessoa.
// Preencha com a URL completa, ex.: "https://www.instagram.com/<handle>/".
export const REDES = {
  instagram: null,
  tiktok: null,
};

export const ROTULO_REDE = { instagram: "Instagram", tiktok: "TikTok" };

// Só as preenchidas, na ordem acima.
export const redesPreenchidas = () =>
  Object.entries(REDES).filter(([, url]) => typeof url === "string" && url.startsWith("https://"));
