import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * true quando o usuario ligou "Remover animacoes" no Android. Todo componente
 * animado do app consulta isto e pula direto para o estado final: para quem
 * sente enjoo com movimento, animacao decorativa nao e detalhe, e barreira.
 *
 * Reage a mudanca em tempo real -- alterar a configuracao com o app aberto
 * vale na hora, sem reiniciar.
 */
export function useMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = useState(false);

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((valor) => {
        if (vivo) setReduzido(valor);
      })
      .catch(() => {
        // Sem a informacao, anima normalmente.
      });
    const assinatura = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzido);
    return () => {
      vivo = false;
      assinatura.remove();
    };
  }, []);

  return reduzido;
}
