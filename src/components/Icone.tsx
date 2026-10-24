import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

/**
 * Icones de traco desenhados a mao em SVG (grade 24x24, traco 2).
 *
 * Substituem os glifos de texto (◉ ≡ ◑ ▲ ⚙) que cada Android desenhava com
 * uma fonte diferente -- alguns como emoji colorido, outros desalinhados da
 * linha de base. SVG fica igual em todo aparelho e pega a cor do tema. Nada
 * de pacote de icones: seria mais uma dependencia para a coleta de versoes
 * incoerentes do SDK 57 (ver PLANO.md).
 */
export type NomeIcone =
  | 'inicio'
  | 'lista'
  | 'relatorio'
  | 'investir'
  | 'ajustes'
  | 'olho'
  | 'olhoFechado'
  | 'sol'
  | 'lua'
  | 'mais'
  | 'transferir'
  | 'relogio'
  | 'entrada'
  | 'saida'
  | 'calendario'
  | 'pincel';

export function Icone({
  nome,
  cor,
  tamanho = 22,
  espessura = 2,
}: {
  nome: NomeIcone;
  cor: string;
  tamanho?: number;
  espessura?: number;
}) {
  const traco = {
    stroke: cor,
    strokeWidth: espessura,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      {desenho(nome, traco)}
    </Svg>
  );
}

type Traco = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
  fill: string;
};

function desenho(nome: NomeIcone, t: Traco) {
  switch (nome) {
    case 'inicio':
      return (
        <>
          <Path {...t} d="M3 10.5 12 3l9 7.5" />
          <Path {...t} d="M5 9v11h14V9" />
          <Path {...t} d="M10 20v-6h4v6" />
        </>
      );
    case 'lista':
      return (
        <>
          <Line {...t} x1="9" y1="6" x2="20" y2="6" />
          <Line {...t} x1="9" y1="12" x2="20" y2="12" />
          <Line {...t} x1="9" y1="18" x2="20" y2="18" />
          <Circle {...t} cx="4.5" cy="6" r="1" />
          <Circle {...t} cx="4.5" cy="12" r="1" />
          <Circle {...t} cx="4.5" cy="18" r="1" />
        </>
      );
    case 'relatorio':
      return (
        <>
          <Path {...t} d="M21 12a9 9 0 1 1-9-9" />
          <Path {...t} d="M12 3a9 9 0 0 1 9 9h-9z" />
        </>
      );
    case 'investir':
      return (
        <>
          <Polyline {...t} points="3 17 9 11 13 15 21 7" />
          <Polyline {...t} points="15 7 21 7 21 13" />
        </>
      );
    case 'ajustes':
      return (
        <>
          {/* Linhas interrompidas no botao: sem preenchimento, nao depende do fundo. */}
          <Path {...t} d="M4 7h2.5M11.5 7H20M4 17h8.5M17.5 17H20" />
          <Circle {...t} cx="9" cy="7" r="2.5" />
          <Circle {...t} cx="15" cy="17" r="2.5" />
        </>
      );
    case 'olho':
      return (
        <>
          <Path {...t} d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <Circle {...t} cx="12" cy="12" r="3" />
        </>
      );
    case 'olhoFechado':
      return (
        <>
          <Path {...t} d="M2 12s3.6-7 10-7c2 0 3.7.7 5.1 1.6M22 12s-3.6 7-10 7c-2 0-3.7-.7-5.1-1.6" />
          <Line {...t} x1="3" y1="3" x2="21" y2="21" />
        </>
      );
    case 'sol':
      return (
        <>
          <Circle {...t} cx="12" cy="12" r="4" />
          <Path
            {...t}
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          />
        </>
      );
    case 'lua':
      return <Path {...t} d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />;
    case 'mais':
      return (
        <>
          <Line {...t} x1="12" y1="5" x2="12" y2="19" />
          <Line {...t} x1="5" y1="12" x2="19" y2="12" />
        </>
      );
    case 'transferir':
      return (
        <>
          <Polyline {...t} points="16 3 20 7 16 11" />
          <Line {...t} x1="20" y1="7" x2="4" y2="7" />
          <Polyline {...t} points="8 21 4 17 8 13" />
          <Line {...t} x1="4" y1="17" x2="20" y2="17" />
        </>
      );
    case 'relogio':
      return (
        <>
          <Circle {...t} cx="12" cy="12" r="9" />
          <Polyline {...t} points="12 7 12 12 15.5 14" />
        </>
      );
    case 'entrada':
      return (
        <>
          <Line {...t} x1="17" y1="7" x2="7" y2="17" />
          <Polyline {...t} points="16 17 7 17 7 8" />
        </>
      );
    case 'saida':
      return (
        <>
          <Line {...t} x1="7" y1="17" x2="17" y2="7" />
          <Polyline {...t} points="8 7 17 7 17 16" />
        </>
      );
    case 'calendario':
      return (
        <>
          <Rect {...t} x="3" y="5" width="18" height="16" rx="2" />
          <Line {...t} x1="3" y1="10" x2="21" y2="10" />
          <Line {...t} x1="8" y1="3" x2="8" y2="7" />
          <Line {...t} x1="16" y1="3" x2="16" y2="7" />
        </>
      );
    case 'pincel':
      return (
        <>
          <Path {...t} d="M18.4 2.6a2 2 0 0 1 2.9 2.9L11 15.8 8.2 13z" />
          <Path {...t} d="M8.2 13C5 13 4 15.5 4 17.5 4 19 3 20 2 20.5c1.5 1 4 1.5 6 .5s3-3 3-5.2" />
        </>
      );
  }
}
