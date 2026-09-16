import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { paletaClara, paletaEscura, type Paleta } from '../utils/tema';
import { formatarMoeda } from '../utils/money';
import type { InstantaneoSaldo } from './instantaneo';

/**
 * Widget de saldo. Nao usa o TemaContexto: o widget roda fora do app, sem
 * React context nem hooks de tema -- por isso a paleta entra como parametro e
 * a biblioteca recebe as duas versoes (clara e escura) de uma vez.
 */
export function WidgetSaldo({
  instantaneo,
  cores,
}: {
  instantaneo: InstantaneoSaldo | null;
  cores: Paleta;
}) {
  const positivo = (instantaneo?.resultado ?? 0) >= 0;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Abrir o Controle de Gastos"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: cores.superficie,
        borderRadius: 20,
        padding: 16,
      }}
    >
      <TextWidget
        text="SALDO TOTAL"
        style={{ fontSize: 11, color: cores.textoFraco, fontWeight: '600' }}
      />

      {instantaneo ? (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
          <TextWidget
            text={formatarMoeda(instantaneo.saldoTotal)}
            style={{
              fontSize: 26,
              color: instantaneo.saldoTotal < 0 ? cores.despesa : cores.texto,
              fontWeight: '700',
            }}
          />
          <TextWidget
            text={`Mês: ${positivo ? '+' : ''}${formatarMoeda(instantaneo.resultado)}`}
            style={{
              fontSize: 13,
              color: positivo ? cores.receita : cores.despesa,
              marginTop: 2,
            }}
          />
          <TextWidget
            text={`atualizado ${formatarQuando(instantaneo.atualizadoEm)}`}
            style={{ fontSize: 10, color: cores.textoFraco, marginTop: 6 }}
          />
        </FlexWidget>
      ) : (
        <TextWidget
          text="Abra o app para carregar"
          style={{ fontSize: 14, color: cores.textoFraco, marginTop: 4 }}
        />
      )}
    </FlexWidget>
  );
}

/** As duas variantes de uma vez: o Android escolhe conforme o tema do sistema. */
export function widgetSaldoComTema(instantaneo: InstantaneoSaldo | null) {
  return {
    light: <WidgetSaldo instantaneo={instantaneo} cores={paletaClara} />,
    dark: <WidgetSaldo instantaneo={instantaneo} cores={paletaEscura} />,
  };
}

/** "hoje 14:32" / "ontem" / "12/09" — curto, cabe no widget. */
function formatarQuando(iso: string): string {
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return '—';

  const agora = new Date();
  const mesmoDia =
    quando.getFullYear() === agora.getFullYear() &&
    quando.getMonth() === agora.getMonth() &&
    quando.getDate() === agora.getDate();

  const hh = String(quando.getHours()).padStart(2, '0');
  const mm = String(quando.getMinutes()).padStart(2, '0');
  if (mesmoDia) return `hoje ${hh}:${mm}`;

  const dia = String(quando.getDate()).padStart(2, '0');
  const mes = String(quando.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}`;
}
