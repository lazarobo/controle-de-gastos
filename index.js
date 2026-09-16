// Entrada do app.
//
// Antes era "expo-router/entry" direto no package.json. O widget precisa
// registrar o tratador FORA do React: o Android chama esse codigo com o app
// fechado, quando nenhuma tela existe. Por isso a entrada passa a ser este
// arquivo, que importa o roteador normalmente e so acrescenta o registro.
import 'expo-router/entry';

import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { tratadorDeWidget } from './src/widgets/tratador';

registerWidgetTaskHandler(tratadorDeWidget);
