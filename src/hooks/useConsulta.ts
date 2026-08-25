import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export interface Consulta<T> {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Executa a consulta toda vez que a tela ganha foco.
 *
 * Como o banco e local e single-user, refazer a leitura ao focar e mais barato e
 * muito mais simples do que manter um cache invalidado por eventos: voltar do
 * formulario de lancamento ja atualiza dashboard, lista e graficos sem nenhuma
 * ligacao explicita entre as telas.
 */
export function useConsulta<T>(consultar: () => Promise<T>, deps: unknown[] = []): Consulta<T> {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [gatilho, setGatilho] = useState(0);

  const recarregar = useCallback(() => setGatilho((n) => n + 1), []);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      setCarregando(true);
      consultar()
        .then((resultado) => {
          if (!ativo) return;
          setDados(resultado);
          setErro(null);
        })
        .catch((e: unknown) => {
          if (!ativo) return;
          setErro(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });

      // Evita setState em tela desmontada quando o usuario sai antes da resposta.
      return () => {
        ativo = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gatilho, ...deps]),
  );

  return { dados, carregando, erro, recarregar };
}
