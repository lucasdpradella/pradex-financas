// A cena do hero: a arte da proposta visual aprovada pelo Lucas.
//
// ===== POR QUE É UMA IMAGEM, E NÃO CSS (2026-09-16) =====
//
// A primeira versão deste arquivo desenhava a cena em HTML/CSS: janela do app,
// celular com a conversa, tudo em <div>. Ficou honesto e leve, e ficou PARECIDO — que
// não era o pedido. O Lucas olhou e disse: "quero a imagem igual, não estou vendo
// igual igual a que o codex fez".
//
// E ele tem razão, porque o original não é desenho de interface: é um RENDER. Mesa
// escura com reflexo, plantas desfocadas ao fundo, livros, caneca, notebook e iPhone
// em perspectiva com moldura realista, o polvo em 3D com sombra de contato e luz azul
// volumétrica atrás. CSS desenha retângulos e texto; nada disso sai de CSS. Insistir
// ali era gastar tempo pra entregar "quase".
//
// Então a cena virou o que ela é: uma imagem.
//   origem: Chave Mestre/Projetos/PRADEX/marca/home-proposta-visual.png (1122×1402)
//   recorte: extract 60 516 606 660 — a cena inteira (notebook, caneca, polvo,
//            celular). O corte NÃO pode ir mais pra esquerda: o texto do hero está
//            embutido na arte e vem junto. O resto de "leve." que sobra na borda é
//            apagado pela máscara em gradiente abaixo.
//   saída:   public/hero-cena.webp — 44 KB, contra 1,5 MB do PNG inteiro
//
// O QUE FICA DEVENDO, e precisa de um render novo pra resolver (não de código):
// a tela dentro da arte diz "Olá, Mariana" e "Abril 2025". A persona da conta demo
// virou LEO DEMO, 19 anos, em 15/09, e a data já nasceu velha. Enquanto for arte
// ilustrativa com essa ressalva visível, passa; vira problema no dia em que alguém
// comparar com o app. Ao regerar, pedir a cena SEM o texto do hero embutido.
//
// Se um dia esta imagem precisar ser reconstruída em código (acessibilidade, peso,
// dados vivos), o desenho anterior está no histórico do git — foi apagado por ser
// código morto, não por estar errado.
import React from "react";

export default function HeroMockup() {
  return (
    <div className="pdx-hero-mk">
      <style>{`
        .pdx-hero-mk { position: relative; display: flex; flex-direction: column; align-items: center; }
        /* A luz azul que existe DENTRO do render, estendida pra fora dele: sem isso a
           imagem termina num retângulo seco no meio do fundo chapado da página. */
        .pdx-hero-mk::before {
          content: ""; position: absolute; inset: -12% -10% -6%; z-index: 0; pointer-events: none;
          background: radial-gradient(58% 52% at 52% 42%, rgba(79,70,229,0.34), rgba(12,14,20,0) 72%);
        }
        .pdx-hero-mk__img {
          position: relative; z-index: 1; display: block;
          width: 100%; max-width: 520px; height: auto;
          /* As bordas do recorte se dissolvem no fundo em vez de virar moldura. O
             fundo da arte é o mesmo #0C0E14 da página, então o fade é invisível —
             some só a linha reta do corte. */
          -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 7%, #000 93%, transparent 100%),
                              linear-gradient(to bottom, transparent 0%, #000 5%, #000 95%, transparent 100%);
          -webkit-mask-composite: source-in;
          mask-image: linear-gradient(to right, transparent 0%, #000 7%, #000 93%, transparent 100%),
                      linear-gradient(to bottom, transparent 0%, #000 5%, #000 95%, transparent 100%);
          mask-composite: intersect;
        }
      `}</style>

      {/* alt descritivo e não decorativo: é a única descrição do produto que um leitor
          de tela recebe nesta parte da página. */}
      <img
        className="pdx-hero-mk__img"
        src="/hero-cena.webp"
        width="606"
        height="660"
        alt="O Pradex aberto no computador mostrando gastos por categoria, e no celular uma conversa no WhatsApp em que a pessoa escreve “gastei 50 no mercado” e o app responde que registrou em Alimentação."
        loading="eager"
        decoding="async"
      />
    </div>
  );
}
