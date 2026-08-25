import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { GraficoPizza } from '../../src/components/GraficoPizza';
import { SeletorMes } from '../../src/components/SeletorMes';
import { Cartao, Carregando, Chips, Titulo, Vazio } from '../../src/components/ui';
import { useConsulta } from '../../src/hooks/useConsulta';
import * as lancamentosRepo from '../../src/repos/lancamentos';
import { mesAtual, type Mes } from '../../src/utils/date';
import { cores, espaco } from '../../src/utils/tema';
import type { TipoMovimento } from '../../src/types';

export default function Relatorios() {
  const [mes, setMes] = useState<Mes>(mesAtual);
  const [tipo, setTipo] = useState<TipoMovimento>('despesa');

  const { dados, carregando } = useConsulta(
    () => lancamentosRepo.totaisPorCategoria(mes, tipo),
    [mes.ano, mes.mes, tipo],
  );

  return (
    <ScrollView style={e.tela} contentContainerStyle={e.conteudo}>
      <SeletorMes mes={mes} onChange={setMes} />

      <Chips
        itens={[
          { valor: 'despesa', rotulo: 'Despesas', cor: cores.despesa },
          { valor: 'receita', rotulo: 'Receitas', cor: cores.receita },
        ]}
        valor={tipo}
        onChange={(v) => setTipo(v as TipoMovimento)}
      />

      <Cartao>
        <Titulo>
          {tipo === 'despesa' ? 'Onde o dinheiro foi' : 'De onde o dinheiro veio'}
        </Titulo>
        {carregando && !dados ? (
          <Carregando />
        ) : !dados?.length ? (
          <Vazio
            titulo={`Nenhuma ${tipo} neste mês`}
            detalhe="O gráfico aparece assim que houver lançamentos."
          />
        ) : (
          <View style={e.grafico}>
            <GraficoPizza dados={dados} />
          </View>
        )}
      </Cartao>
    </ScrollView>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: espaco.xl },
  grafico: { marginTop: espaco.md },
});
