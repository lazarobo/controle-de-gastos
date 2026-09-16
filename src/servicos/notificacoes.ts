import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import * as lancamentosRepo from '../repos/lancamentos';
import * as preferenciasRepo from '../repos/preferencias';
import { hojeISO, isoParaData, lerHora } from '../utils/date';
import { proximosLembretesBackup, proximosLembretesDiarios, type Hora } from '../utils/lembretes';

/**
 * Lembretes locais. Nenhum servidor, nenhum push: sao alarmes agendados no
 * proprio aparelho, entao o "100% offline" (RNF01) continua valendo.
 *
 * A regra de QUANDO tocar vive em src/utils/lembretes.ts, sem dependencia
 * nativa, para poder ser testada pelo `npm run verify`. Aqui fica so a conversa
 * com o sistema operacional.
 */

export const CHAVE_DIARIO_ATIVO = 'lembrete_diario_ativo';
export const CHAVE_DIARIO_HORA = 'lembrete_diario_hora';
export const CHAVE_BACKUP_ATIVO = 'lembrete_backup_ativo';
export const CHAVE_ULTIMO_BACKUP = 'ultimo_backup_em';

export const HORA_PADRAO = '20:00';
const CANAL = 'lembretes';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function configurarCanal() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL, {
    name: 'Lembretes',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Pede a permissao. Chamada quando o usuario LIGA o lembrete, nunca na
 * abertura do app: pedir permissao para algo que a pessoa ainda nao escolheu
 * usar e o caminho mais curto para ela negar para sempre.
 */
export async function garantirPermissao(): Promise<boolean> {
  await configurarCanal();
  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return true;
  if (!atual.canAskAgain) return false;
  const pedida = await Notifications.requestPermissionsAsync();
  return pedida.granted;
}

export async function temPermissao(): Promise<boolean> {
  const atual = await Notifications.getPermissionsAsync();
  return atual.granted;
}

async function agendar(titulo: string, corpo: string, data: Date) {
  await Notifications.scheduleNotificationAsync({
    content: { title: titulo, body: corpo, sound: false },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: data,
      channelId: CANAL,
    },
  });
}

/**
 * Cancela tudo e reagenda a partir do estado de agora. Roda a cada abertura do
 * app -- e e isso que faz o lembrete diario ser esperto sem tarefa em segundo
 * plano: se voce ja lancou hoje, a janela inteira anda para frente.
 *
 * Nunca lanca excecao: lembrete quebrado nao pode impedir o app de abrir.
 */
export async function sincronizarLembretes(): Promise<void> {
  try {
    const [diario, horaTexto, backup, ultimoBackup] = await Promise.all([
      preferenciasRepo.obter(CHAVE_DIARIO_ATIVO),
      preferenciasRepo.obter(CHAVE_DIARIO_HORA),
      preferenciasRepo.obter(CHAVE_BACKUP_ATIVO),
      preferenciasRepo.obter(CHAVE_ULTIMO_BACKUP),
    ]);

    const diarioAtivo = diario === '1';
    const backupAtivo = backup === '1';

    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!diarioAtivo && !backupAtivo) return;

    // Sem permissao nao adianta agendar -- e nao pedimos aqui.
    if (!(await temPermissao())) return;
    await configurarCanal();

    const hora: Hora = lerHora(horaTexto ?? HORA_PADRAO) ?? { hora: 20, minuto: 0 };
    const agora = new Date();

    if (diarioAtivo) {
      const jaLancouHoje = (await lancamentosRepo.contarNoDia(hojeISO())) > 0;
      for (const data of proximosLembretesDiarios(agora, hora, jaLancouHoje)) {
        await agendar(
          'Lançou os gastos de hoje?',
          'Um minuto agora evita a tarde inteira tentando lembrar depois.',
          data,
        );
      }
    }

    if (backupAtivo) {
      const base = ultimoBackup ? isoParaData(ultimoBackup) : null;
      for (const data of proximosLembretesBackup(agora, base, hora)) {
        await agendar(
          'Hora de fazer backup',
          'Desinstalar o app apaga tudo. Ajustes › Backup › Exportar.',
          data,
        );
      }
    }
  } catch {
    // Aparelho sem suporte, permissao revogada no meio, etc.
  }
}

/** Chamado depois de um backup bem-sucedido, para a contagem recomecar. */
export async function registrarBackupFeito(): Promise<void> {
  await preferenciasRepo.definir(CHAVE_ULTIMO_BACKUP, hojeISO());
}
