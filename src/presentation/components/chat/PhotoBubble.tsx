import { Image, Pressable, View } from 'react-native'
import type { PhotoContent } from '@/domain/message/MessageContent'
import { useTheme } from '../../theme/ThemeProvider'
import { Text } from '../Text'
import { fitWithin, MAX_PHOTO_WIDTH } from './photoLayout'

/**
 * 사진 말풍선.
 *
 * ## 기다리는 동안에도 볼 것을 준다
 *
 * 사진은 조각으로 나뉘어 오느라 몇 초에서 몇십 초가 걸린다. 그동안
 * 빈 네모를 보여주면 **뭔가 잘못된 줄 안다.** 그래서 메시지와 같이 온
 * 흐릿한 미리보기를 먼저 깔고 그 위에 진행률을 얹는다.
 *
 * 비율을 그대로 지킨다. 찌그러진 사진은 다시 볼 마음이 안 든다.
 *
 * (docs/05-messaging-spec.md 사진 항목 · T22)
 */

interface PhotoBubbleProps {
  content: PhotoContent
  /** 다 받았으면 그 자리. 아직이면 null */
  localPath: string | null
  /** 받는 중이면 0~1. 다 받았거나 아직 시작 전이면 null */
  progress: number | null
  onPress?: () => void
}

export function PhotoBubble({ content, localPath, progress, onPress }: PhotoBubbleProps) {
  const theme = useTheme()
  const size = fitWithin(content.width, content.height, MAX_PHOTO_WIDTH)

  const source =
    localPath !== null
      ? { uri: localPath }
      : content.preview !== undefined
        ? { uri: `data:image/jpeg;base64,${content.preview}` }
        : null

  return (
    <Pressable
      onPress={localPath === null ? undefined : onPress}
      accessibilityRole={localPath === null ? undefined : 'imagebutton'}
      accessibilityLabel={content.caption ?? '사진'}
    >
      <View
        style={{
          width: size.width,
          height: size.height,
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
          backgroundColor: theme.colors.surfaceRaised,
        }}
      >
        {source !== null && (
          <Image
            source={source}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            // 미리보기는 32픽셀짜리다. 늘려 놓으면 저절로 흐릿해진다.
            blurRadius={localPath === null ? 2 : 0}
          />
        )}

        {localPath === null && (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              top: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: theme.colors.bg,
                borderRadius: theme.radius.pill,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: 4,
                opacity: 0.85,
              }}
            >
              <Text variant="caption" color="textMuted">
                {progress === null
                  ? '사진을 기다리는 중'
                  : `${Math.round(progress * 100)}%`}
              </Text>
            </View>
          </View>
        )}
      </View>

      {content.caption !== undefined && (
        <Text
          variant="caption"
          style={{ marginTop: theme.spacing.xs, maxWidth: size.width }}
        >
          {content.caption}
        </Text>
      )}
    </Pressable>
  )
}
