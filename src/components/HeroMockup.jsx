// A cena do hero: a arte da proposta visual, aprovada pelo Lucas.
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
// ===== E POR QUE A ARTE É A SEGUNDA, E NÃO A PRIMEIRA (2026-09-17) =====
//
// A arte de 16/09 era a PÁGINA inteira renderizada: título, botões e a cena, tudo numa
// imagem só. Usar só a cena exigia recorte, e o recorte esbarrava no texto do hero,
// que estava pintado dentro dela — cortar perto trazia "Sua cabeça mais leve." junto,
// duplicado sobre o texto real da página. Por isso o primeiro corte decepava o
// notebook e a caneca, e o Lucas viu na hora: "a imagem ficou na metade".
//
// A correção não era de código. O Codex (que tem o ImageGen) gerou a cena ISOLADA,
// quadrada e com respiro nas bordas, e de quebra corrigiu os dados da tela — a versão
// anterior dizia "Olá, Mariana" e "Abril 2025", com a persona aposentada em 15/09 e
// uma data que já nasceu velha.
//
//   origem:  Chave Mestre/Projetos/PRADEX/marca/2026-09-17_home-cena.png (1600×1600)
//   spec:    briefs/home-visual-conversao.md, seção "Render novo da cena"
//   saída:   public/hero-cena.webp — 1100×1100, 62 KB, SEM recorte nenhum
//
// Se a arte for regerada de novo, vale o mesmo spec: só a cena, quadrada, fundo
// #0C0E14, respiro em volta, nenhum texto de página embutido. É o que permite trocar
// o arquivo sem tocar em uma linha de código.
//
// Se um dia esta imagem precisar virar código (acessibilidade, peso, dados vivos), o
// desenho em CSS está no histórico do git — foi apagado por ser código morto, não por
// estar errado.
import React from "react";

export default function HeroMockup() {
  return (
    <div className="pdx-hero-mk">
      <style>{`
        .pdx-hero-mk { position: relative; display: flex; justify-content: center; }
        /* A luz azul que existe DENTRO do render, estendida pra fora dele: sem isso a
           imagem termina num quadrado seco no meio do fundo chapado da página. */
        .pdx-hero-mk::before {
          content: ""; position: absolute; inset: -8%; z-index: 0; pointer-events: none;
          background: radial-gradient(56% 50% at 52% 40%, rgba(79,70,229,0.30), rgba(12,14,20,0) 72%);
        }
        .pdx-hero-mk__img {
          position: relative; z-index: 1; display: block;
          width: 100%; max-width: 560px; height: auto;
          /* Fade curto só pra dissolver a borda do quadrado no fundo da página. Na
             arte de 16/09 ele precisava ser de 7% pra comer o texto que vinha no
             recorte; agora a cena já vem com respiro, então 3% basta e nenhum objeto
             da cena é tocado. */
          -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 3%, #000 97%, transparent 100%),
                              linear-gradient(to bottom, transparent 0%, #000 3%, #000 97%, transparent 100%);
          -webkit-mask-composite: source-in;
          mask-image: linear-gradient(to right, transparent 0%, #000 3%, #000 97%, transparent 100%),
                      linear-gradient(to bottom, transparent 0%, #000 3%, #000 97%, transparent 100%);
          mask-composite: intersect;
        }
      `}</style>

      {/* alt descritivo e não decorativo: é a única descrição do produto que um leitor
          de tela recebe nesta parte da página. */}
      <img
        className="pdx-hero-mk__img"
        src="/hero-cena.webp"
        width="1100"
        height="1100"
        alt="O Pradex aberto no computador mostrando receitas, despesas e os gastos por categoria, e ao lado um celular com uma conversa no WhatsApp em que a pessoa escreve “gastei R$ 50 no mercado” e o app responde que registrou em Alimentação."
        loading="eager"
        decoding="async"
      />
    </div>
  );
}
