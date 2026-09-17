// Mascote OFICIAL do Pradex — escolhido pelo PRADELLA em 2026-09-15.
//
// Cópia fiel de `Chave Mestre/Projetos/PRADEX/marca/2026-09-15_mascote-polvo_OFICIAL.svg`.
// Inline e não <img> de propósito: escala sem borrar de 28px (logo do header) a 160px
// (hero), não custa request e acompanha `currentColor` se um dia precisar.
//
// ⚠️ A FONTE DA VERDADE É O SVG NO VAULT. Se o desenho mudar lá, atualize aqui — não
// o contrário. Os v5/v6/v7 foram descartados por motivos que estão documentados no
// arquivo original (tentáculo lendo como dente, sobrancelha de vilão, olho fofo demais
// pra app de finanças). O render 3D que apareceu na proposta visual da home é uma
// interpretação; a identidade é este vetor.
//
// `ids` únicos por instância: dois <svg> na mesma página com o mesmo id de gradiente
// fazem o segundo herdar o primeiro no Safari.
import React, { useId } from "react";

export default function MascotePradex({ size = 64, style }) {
  const uid = useId().replace(/:/g, "");
  const pele = `pele-${uid}`;
  const olho = `olho-${uid}`;

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={style} role="img" aria-label="Mascote do Pradex">
      <defs>
        <linearGradient id={pele} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8189F7" /><stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient id={olho} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#67E8F9" /><stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>

      {/* Tentáculos primeiro, pra ficarem atrás do manto. */}
      <g fill="#5B54E8">
        <path d="M56 120 C34 128 24 146 30 160 C34 170 46 172 52 164 C57 157 50 152 45 156 C41 159 40 153 44 148 C50 140 60 136 66 136 Z" />
        <path d="M144 120 C166 128 176 146 170 160 C166 170 154 172 148 164 C143 157 150 152 155 156 C159 159 160 153 156 148 C150 140 140 136 134 136 Z" />
        <path d="M74 134 C70 150 72 164 80 172 C86 178 94 174 93 166 C92 158 84 158 84 150 C84 144 86 138 88 134 Z" />
        <path d="M126 134 C130 150 128 164 120 172 C114 178 106 174 107 166 C108 158 116 158 116 150 C116 144 114 138 112 134 Z" />
        <path d="M100 136 C94 150 94 164 100 176 C106 164 106 150 100 136 Z" />
      </g>

      <path fill={`url(#${pele})`} d="M100 16 C146 16 174 48 174 90 C174 118 158 138 132 144 C122 146 110 147 100 147 C90 147 78 146 68 144 C42 138 26 118 26 90 C26 48 54 16 100 16 Z" />
      <path fill="#3F37C9" opacity=".20" d="M100 16 C54 16 26 48 26 90 C26 118 42 138 68 144 C78 146 90 147 100 147 Z" />

      {/* Sobrancelhas assimétricas: a esquerda desce (ceticismo), a direita sobe. É
          isso que faz o sorriso de canto funcionar. */}
      <path fill="#332B9E" opacity=".62" d="M50 84 L92 96 L92 87 L50 73 Z" />
      <path fill="#332B9E" opacity=".62" d="M150 72 L110 92 L110 83 L150 63 Z" />

      <path fill={`url(#${olho})`} d="M52 92 L88 102 L84 119 L53 113 Z" />
      <path fill={`url(#${olho})`} d="M148 84 L114 100 L118 117 L148 106 Z" />

      <path fill="none" stroke="#2A2270" strokeWidth="7" strokeLinecap="round"
        d="M70 131 C86 137 104 139 118 136 C129 133 136 127 139 120" />
    </svg>
  );
}
