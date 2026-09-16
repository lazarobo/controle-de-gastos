import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { widgetSaldoComTema } from './WidgetSaldo';
import { gravarInstantaneo, type InstantaneoSaldo } from './instantaneo';

/**
 * Grava o instantaneo e repinta o widget. Chamado pelo Inicio sempre que os
 * numeros sao carregados -- ou seja, o widget acompanha o app sem precisar de
 * tarefa em segundo plano.
 *
 * Nunca lanca: widget e enfeite, nao pode derrubar a tela principal.
 */
export async function atualizarWidgetSaldo(saldoTotal: number, resultado: number): Promise<void> {
  if (Platform.OS !== 'android') return;

  const dados: InstantaneoSaldo = {
    saldoTotal,
    resultado,
    atualizadoEm: new Date().toISOString(),
  };

  gravarInstantaneo(dados);

  try {
    await requestWidgetUpdate({
      widgetName: 'Saldo',
      renderWidget: () => widgetSaldoComTema(dados),
      // Sem widget na tela inicial nao ha nada a fazer -- e nao e erro.
      widgetNotFound: () => {},
    });
  } catch {
    // Aparelho sem suporte ou lancador que nao aceita widget.
  }
}
