import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import * as preferenciasRepo from '../repos/preferencias';
import { formatarMoedaOculta } from '../utils/money';

/**
 * O "olhinho" dos apps de banco: esconde todo valor em dinheiro da tela, para
 * dar para abrir o app no onibus sem mostrar o saldo para o vizinho.
 *
 * Fica guardado (tabela `preferencias`): se voce escondeu, continua escondido
 * na proxima abertura. Esconder e uma decisao sobre o ambiente em que voce usa
 * o app, nao sobre aquela sessao.
 */
export const CHAVE_VALORES_OCULTOS = 'valores_ocultos';

interface PrivacidadeContextoValor {
  ocultos: boolean;
  alternar: () => void;
}

const PrivacidadeContexto = createContext<PrivacidadeContextoValor | null>(null);

export function PrivacidadeProvider({ children }: { children: ReactNode }) {
  const [ocultos, setOcultos] = useState(false);

  useEffect(() => {
    let vivo = true;
    preferenciasRepo
      .obter(CHAVE_VALORES_OCULTOS)
      .then((salvo) => {
        if (vivo && salvo === '1') setOcultos(true);
      })
      .catch(() => {
        // Sem preferencia salva: comeca visivel.
      });
    return () => {
      vivo = false;
    };
  }, []);

  function alternar() {
    setOcultos((anterior) => {
      const novo = !anterior;
      preferenciasRepo.definir(CHAVE_VALORES_OCULTOS, novo ? '1' : '0').catch(() => {
        // Falhar ao gravar nao pode impedir a troca na tela.
      });
      return novo;
    });
  }

  const valor = useMemo(() => ({ ocultos, alternar }), [ocultos]);

  return <PrivacidadeContexto.Provider value={valor}>{children}</PrivacidadeContexto.Provider>;
}

export function usePrivacidade(): PrivacidadeContextoValor {
  const ctx = useContext(PrivacidadeContexto);
  if (!ctx) throw new Error('usePrivacidade() precisa estar dentro de <PrivacidadeProvider>.');
  return ctx;
}

/**
 * Formata dinheiro respeitando o olhinho.
 *
 * Devolve uma funcao com a MESMA assinatura de formatarMoeda de proposito: nas
 * telas, basta trocar o import por `const formatarMoeda = useMoeda();` e
 * nenhuma das chamadas muda. Menos lugar para esquecer de esconder um valor.
 */
export function useMoeda(): (centavos: number) => string {
  const { ocultos } = usePrivacidade();
  return useMemo(
    () => (centavos: number) => formatarMoedaOculta(centavos, ocultos),
    [ocultos],
  );
}
