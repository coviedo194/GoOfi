import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components'
import { WeekView } from './components/WeekView'
import { useThemePreference } from './hooks/useThemePreference'
import './App.css'

/**
 * App principal de GoOfi
 * 
 * FluentProvider proporciona el tema (claro/oscuro) y sus tokens CSS
 * (var(--colorNeutral...)) a todos los componentes y estilos propios.
 */
function App() {
  const { preference, setPreference, isDark } = useThemePreference()

  return (
    <FluentProvider theme={isDark ? webDarkTheme : webLightTheme}>
      <WeekView
        themePreference={preference}
        isDarkTheme={isDark}
        onThemePreferenceChange={setPreference}
      />
    </FluentProvider>
  )
}

export default App
