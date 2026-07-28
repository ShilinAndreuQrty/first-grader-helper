import {
  AdaptivityProvider,
  AppRoot,
  ConfigProvider,
  Panel,
  PanelHeader,
  Placeholder,
  View,
} from '@vkontakte/vkui'

const APP_NAME = import.meta.env.VITE_APP_NAME || 'ИПМКН Старт'

export function App() {
  return (
    <ConfigProvider>
      <AdaptivityProvider>
        <AppRoot>
          <View activePanel="home">
            <Panel id="home">
              <PanelHeader>{APP_NAME}</PanelHeader>
              <Placeholder title="Рабочая среда готова">
                Проект тьюторского сообщества ИПМКН ТулГУ
              </Placeholder>
            </Panel>
          </View>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  )
}
