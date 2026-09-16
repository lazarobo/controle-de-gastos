import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { paletaClara, paletaEscura, type Cor, type Paleta } from '../utils/tema';

/**
 * Widget de atalho: abre o formulario de lancamento direto da tela inicial.
 *
 * Nao mostra dado nenhum -- e de proposito. Sem dado, ele nunca fica
 * desatualizado, e ataca o que o app promete: registrar em poucos toques.
 *
 * Tres barras no lugar de uma so porque o Android nao abre o teclado por
 * widget: o ganho esta em pular a escolha do tipo, nao em digitar aqui.
 */
export function WidgetAtalho({ cores }: { cores: Paleta }) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        backgroundColor: cores.superficie,
        borderRadius: 20,
        padding: 8,
      }}
    >
      <Botao
        texto="− Gasto"
        cor={cores.despesa}
        // Barra tripla: caminho absoluto, sem host. Sem isso o Android trata
        // "lancamento" como host e o expo-router nao acha a rota.
        uri="controledegastos:///lancamento/novo?tipo=despesa"
        rotulo="Registrar gasto"
      />
      <Botao
        texto="+ Receita"
        cor={cores.receita}
        uri="controledegastos:///lancamento/novo?tipo=receita"
        rotulo="Registrar receita"
      />
      <Botao
        texto="Abrir"
        cor={cores.primaria}
        uri="controledegastos:///"
        rotulo="Abrir o app"
      />
    </FlexWidget>
  );
}

function Botao({
  texto,
  cor,
  uri,
  rotulo,
}: {
  texto: string;
  cor: Cor;
  uri: string;
  rotulo: string;
}) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      accessibilityLabel={rotulo}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: cor,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <TextWidget text={texto} style={{ fontSize: 13, color: '#FFFFFF', fontWeight: '700' }} />
    </FlexWidget>
  );
}

export function widgetAtalhoComTema() {
  return {
    light: <WidgetAtalho cores={paletaClara} />,
    dark: <WidgetAtalho cores={paletaEscura} />,
  };
}
