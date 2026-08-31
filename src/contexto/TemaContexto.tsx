import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance } from 'react-native';

import * as preferenciasRepo from '../repos/preferencias';
import { paletaClara, paletaEscura, type Paleta } from '../utils/tema';

export type ModoTema = 'claro' | 'escuro' | 'sistema';

const CHAVE_PREFERENCIA = 'tema';

interface TemaContextoValor {
  cores: Paleta;
  /** true quando o tema EFETIVO (já resolvendo 'sistema') é o escuro. */
  escuro: boolean;
  /** O que o usuário escolheu — pode ser 'sistema', diferente de `escuro`. */
  modo: ModoTema;
  definirModo: (modo: ModoTema) => void;
}

const TemaContexto = createContext<TemaContextoValor | null>(null);

/**
 * Fica em volta do app inteiro (app/_layout.tsx). Resolve 'sistema' contra o
 * Appearance do SO e reage a mudança de tema do Android em tempo real —
 * sem isso, escurecer o celular à noite não escureceria o app já aberto.
 *
 * A preferência persiste no SQLite (tabela `preferencias`, migration 2) em vez
 * de AsyncStorage: evita uma dependência nativa nova só para guardar uma
 * string, e o app já abre o banco de qualquer forma.
 */
export function TemaProvider({ children }: { children: ReactNode }) {
  const [modo, setModo] = useState<ModoTema>('sistema');
  const [esquemaSistema, setEsquemaSistema] = useState(Appearance.getColorScheme());

  useEffect(() => {
    preferenciasRepo
      .obter(CHAVE_PREFERENCIA)
      .then((salvo) => {
        if (salvo === 'claro' || salvo === 'escuro' || salvo === 'sistema') {
          setModo(salvo);
        }
      })
      .catch(() => {
        // Sem preferência salva ainda (primeira execução): fica em 'sistema'.
      });
  }, []);

  useEffect(() => {
    const assinatura = Appearance.addChangeListener(({ colorScheme }) => {
      setEsquemaSistema(colorScheme);
    });
    return () => assinatura.remove();
  }, []);

  function definirModo(novo: ModoTema) {
    setModo(novo);
    preferenciasRepo.definir(CHAVE_PREFERENCIA, novo).catch(() => {
      // Falha ao persistir não deve travar a troca visual; tenta de novo na próxima.
    });
  }

  const escuro = modo === 'sistema' ? esquemaSistema === 'dark' : modo === 'escuro';
  const cores = escuro ? paletaEscura : paletaClara;

  const valor = useMemo(
    () => ({ cores, escuro, modo, definirModo }),
    [cores, escuro, modo],
  );

  return <TemaContexto.Provider value={valor}>{children}</TemaContexto.Provider>;
}

export function useTema(): TemaContextoValor {
  const ctx = useContext(TemaContexto);
  if (!ctx) throw new Error('useTema() precisa estar dentro de <TemaProvider>.');
  return ctx;
}
