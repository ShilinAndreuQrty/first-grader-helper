import '@vkontakte/vkui/dist/vkui.css'
import './styles.css'
import './admin.css'

import { AdminApp } from './AdminApp'
import { bootstrapApplication } from './bootstrap'
import { appColorScheme, applyAppTheme } from './theme'

applyAppTheme(appColorScheme)
void bootstrapApplication(<AdminApp />)
