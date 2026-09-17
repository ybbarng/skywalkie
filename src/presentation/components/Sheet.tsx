import type { ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useTheme } from '../theme/ThemeProvider'
import { Icon } from './Icon'
import { Text } from './Text'

interface SheetProps {
  visible: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/**
 * 아래에서 올라오는 것.
 *
 * 설명, 연결 상태 자세히 보기, 고르기 화면에 쓴다.
 * 화면을 완전히 덮지 않아서 "잠깐 보고 닫는 것"이라는 느낌을 준다.
 */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        entering={reducedMotion ? undefined : FadeIn.duration(theme.duration.theme)}
        exiting={reducedMotion ? undefined : FadeOut.duration(theme.duration.theme)}
        style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
      >
        {/* 바깥을 누르면 닫힌다 */}
        <Pressable
          style={styles.backdropTouch}
          onPress={onClose}
          accessibilityLabel="닫기"
        />

        <Animated.View
          entering={
            reducedMotion ? undefined : SlideInDown.duration(theme.duration.screen)
          }
          exiting={
            reducedMotion ? undefined : SlideOutDown.duration(theme.duration.theme)
          }
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surfaceRaised,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              paddingBottom: insets.bottom + theme.spacing.xl,
              paddingHorizontal: theme.spacing.xl,
              paddingTop: theme.spacing.lg,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />

          {title !== undefined && (
            <View style={[styles.header, { marginBottom: theme.spacing.md }]}>
              <Text variant="heading">{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <Icon name="close" size={22} color="textMuted" />
              </Pressable>
            </View>
          )}

          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  backdropTouch: StyleSheet.absoluteFill,
  sheet: { width: '100%' },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})
