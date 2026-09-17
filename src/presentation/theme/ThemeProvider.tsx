import Storage from 'expo-sqlite/kv-store'
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useColorScheme } from 'react-native'
import { type Theme, type ThemeMode, type ThemePreference, themeFor } from './tokens'

const STORAGE_KEY = 'theme-preference'

interface ThemeContextValue {
  readonly theme: Theme
  /** 사용자가 고른 값. 기기 설정을 따라가는 중이면 'system' */
  readonly preference: ThemePreference
  setPreference: (next: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [preference, setPreferenceState] = useState<ThemePreference>('system')

  // 고른 값을 기기에서 되살린다. 읽는 동안에는 기기 설정을 따라간다.
  useEffect(() => {
    let cancelled = false
    void Storage.getItem(STORAGE_KEY).then(stored => {
      if (!cancelled && isPreference(stored)) setPreferenceState(stored)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    // 저장이 실패해도 화면은 이미 바뀌었다. 다음에 켤 때 기억을 못 할 뿐이다.
    void Storage.setItem(STORAGE_KEY, next)
  }, [])

  const mode: ThemeMode =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference

  const value = useMemo(
    () => ({ theme: themeFor(mode), preference, setPreference }),
    [mode, preference, setPreference],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme(): Theme {
  const context = use(ThemeContext)
  if (context === null) {
    throw new Error('useTheme 은 ThemeProvider 안에서만 쓸 수 있다')
  }
  return context.theme
}

/** 설정 화면에서 밝기 모드를 고를 때 쓴다 */
export function useThemePreference(): {
  preference: ThemePreference
  setPreference: (next: ThemePreference) => void
} {
  const context = use(ThemeContext)
  if (context === null) {
    throw new Error('useThemePreference 는 ThemeProvider 안에서만 쓸 수 있다')
  }
  return { preference: context.preference, setPreference: context.setPreference }
}
