import type { ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
 *
 * ## 여기서 레이아웃 움직임을 쓰지 않는다
 *
 * `reanimated` 의 `entering`/`exiting` 을 **`Modal` 안에서 쓰면 안 된다.**
 * 그려지는 자리와 눌리는 자리가 어긋나서, 눈에 보이는 단추를 눌러도
 * 아무 일이 없다. 설명을 열면 닫을 수가 없어 거기서 갇힌다.
 *
 * 기기에서 잰 값이다. 움직임을 걷어내자 같은 단추의 터치 자리가
 * `540,1866` 에서 `540,2087` 로 바뀌었다. **220 픽셀이 어긋나 있었다.**
 *
 * 움직임 없이 누르면 통과해서 **손가락만 걸린다.** 눌러보는 흉내로는
 * 안 잡히고, `adb` 로 눌러도 안 잡힌다. 2 픽셀만 움직이면 재현된다.
 *
 * 그래서 움직임은 **운영체제에 맡긴다.** `animationType="fade"` 는
 * 네이티브가 해주는 것이라 터치와 어긋나지 않는다. 덜 멋지지만
 * 반드시 눌린다.
 */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}>
        {/*
          바깥을 누르면 닫힌다.

          **시트 위를 덮으면 안 된다.** 전에는 화면 전체를 덮어두고
          시트를 그 위에 얹었는데, 손가락으로 누르면 배경이 먼저
          가로채서 **시트 안의 단추가 하나도 안 먹었다.** 설명을 열면
          닫을 수가 없어 거기서 갇혔다.

          (기기에서 누르는 흉내로는 안 잡힌다. 합성 터치는 움직임이
          없어서 그냥 통과한다. 손가락만 걸린다.)

          그래서 덮지 않고 **남는 자리만 차지한다.** `flex: 1` 이 시트를
          뺀 위쪽 빈 곳을 채운다. 겹치는 데가 없으니 가로챌 일도 없다.
        */}
        <Pressable style={styles.above} onPress={onClose} accessibilityLabel="닫기" />

        <View
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
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  /** 시트 위쪽 빈 자리. **시트와 겹치지 않는다** */
  above: { flex: 1 },
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
