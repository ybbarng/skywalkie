import Constants from 'expo-constants'
import { StyleSheet, Text, useColorScheme, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

/**
 * 뼈대가 서 있는지 확인하는 화면. T12 에서 첫 실행 안내로 바뀐다.
 */
export default function Index() {
  const isDark = useColorScheme() === 'dark'
  const version = Constants.expoConfig?.version ?? '0.0.0'

  return (
    <SafeAreaView style={[styles.screen, isDark ? styles.dark : styles.light]}>
      <View style={styles.center}>
        <Text style={[styles.title, isDark ? styles.textDark : styles.textLight]}>
          Skywalkie
        </Text>
        <Text style={[styles.subtitle, isDark ? styles.mutedDark : styles.mutedLight]}>
          비행기에서 둘만의 통신망
        </Text>
        <Text style={[styles.version, isDark ? styles.mutedDark : styles.mutedLight]}>
          v{version} · 뼈대 세우는 중
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  dark: { backgroundColor: '#0B1020' },
  light: { backgroundColor: '#F6F8FC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 34, fontWeight: '700' },
  subtitle: { fontSize: 16 },
  version: { fontSize: 13, marginTop: 24 },
  textDark: { color: '#E8ECF5' },
  textLight: { color: '#121826' },
  mutedDark: { color: '#8B95AD' },
  mutedLight: { color: '#5D6A85' },
})
