import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { widgetAtalhoComTema } from './WidgetAtalho';
import { widgetSaldoComTema } from './WidgetSaldo';
import { lerInstantaneo } from './instantaneo';

/**
 * Chamado pelo Android quando um widget e adicionado, redimensionado ou
 * atualizado -- fora do app, num contexto sem telas nem banco.
 *
 * Os nomes abaixo TEM de bater com os nomes em `app.json`; e por eles que o
 * Android sabe qual widget esta pedindo desenho.
 */
export async function tratadorDeWidget({
  widgetInfo,
  widgetAction,
  renderWidget,
}: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === 'WIDGET_DELETED') return;

  switch (widgetInfo.widgetName) {
    case 'Atalho':
      renderWidget(widgetAtalhoComTema());
      break;

    case 'Saldo':
      // Le o instantaneo gravado pelo app. Se nunca houve um (widget recem
      // adicionado, ou apos reinstalar), o proprio componente mostra o aviso.
      renderWidget(widgetSaldoComTema(lerInstantaneo()));
      break;

    default:
      break;
  }
}
