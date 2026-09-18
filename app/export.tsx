import { router } from 'expo-router'
import { useEffect } from 'react'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { currentContainer } from '@/composition/container'
import {
  ExpoFileSharer,
  ExpoFileStore,
  LocalHasher,
} from '@/infrastructure/archive/ExpoFileStore'
import { Button } from '@/presentation/components/Button'
import { Card } from '@/presentation/components/Card'
import { Text } from '@/presentation/components/Text'
import { useArchiveStore } from '@/presentation/stores/useArchiveStore'
import { useSetupStore } from '@/presentation/stores/useSetupStore'
import { useTheme } from '@/presentation/theme/ThemeProvider'

/**
 * 대화 꺼내기.
 *
 * **아이폰 앱은 7일마다 만료된다.** 다시 깐 뒤 대화를 못 되돌리면
 * 여행의 절반이 사라진다. 그래서 이 화면은 부가 기능이 아니다.
 */
export default function ExportScreen() {
  const theme = useTheme()
  const profile = useSetupStore(s => s.profile)
  const peer = useSetupStore(s => s.peer)
  const archive = useArchiveStore()

  useEffect(() => {
    const container = currentContainer()
    if (container === null || profile === null) return

    archive.attach({
      repository: container.repository,
      files: new ExpoFileStore(),
      sharer: new ExpoFileSharer(),
      hasher: new LocalHasher(),
      me: profile.peerId,
    })
  }, [profile, archive.attach])

  const people = [
    profile !== null
      ? {
          peerId: profile.peerId,
          displayName: profile.displayName,
          character: profile.character,
        }
      : null,
    peer !== null
      ? {
          peerId: peer.peerId,
          displayName: peer.displayName,
          character: peer.character,
        }
      : null,
  ].filter(person => person !== null)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="heading">대화 꺼내두기</Text>
          <Text color="textMuted">
            앱이 사라져도 대화는 남아요. 한 번 누르면 세 가지 형태로 만들어 드릴게요.
          </Text>
        </View>

        <Card>
          <View style={{ gap: theme.spacing.sm }}>
            <Format
              title="되돌릴 수 있는 파일"
              detail="앱을 다시 깐 뒤 이 파일을 넣으면 대화가 그대로 돌아와요."
            />
            <Format
              title="읽는 문서"
              detail="앱 없이 그냥 열어볼 수 있어요. 낙서까지 보여요."
            />
            <Format title="글자만" detail="어디서든 열리는 가장 단순한 형태예요." />
          </View>
        </Card>

        {archive.busy && archive.total > 0 && (
          <Text variant="caption" color="textMuted" align="center">
            {`${archive.done}건 꺼내는 중`}
          </Text>
        )}

        <Button
          label={archive.busy ? '꺼내는 중...' : '대화 꺼내기'}
          onPress={() => void archive.exportAll(people)}
          disabled={archive.busy || people.length === 0}
        />

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="heading">되돌리기</Text>
          <Text color="textMuted">
            꺼내둔 파일을 다시 넣어요. 이미 있는 말은 겹치지 않아요.
          </Text>
          <Button
            label="파일 고르기"
            tone="neutral"
            onPress={() => void archive.importFile()}
            disabled={archive.busy}
          />
        </View>

        {archive.message !== null && (
          <Card raised>
            <Text>{archive.message}</Text>
          </Card>
        )}

        {archive.error !== null && (
          <Card raised>
            <View style={{ gap: theme.spacing.sm }}>
              <Text color="danger">{archive.error}</Text>

              {/*
                **거절만 하면 그 파일이 하나뿐일 때 통째로 잃는다.**
                망가졌다고 알린 다음, 그래도 열겠다면 열어준다.
              */}
              {archive.damagedPath !== null && (
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <Button
                    label="그래도 열기"
                    onPress={() => void archive.importAnyway()}
                  />
                  <Button
                    label="그만두기"
                    tone="neutral"
                    onPress={archive.dismissDamaged}
                  />
                </View>
              )}
            </View>
          </Card>
        )}

        <Button label="닫기" tone="neutral" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  )
}

function Format({ title, detail }: { title: string; detail: string }) {
  const theme = useTheme()

  return (
    <View style={{ gap: 2 }}>
      <Text variant="bodyStrong">{title}</Text>
      <Text variant="caption" color="textMuted">
        {detail}
      </Text>
      <View style={{ height: theme.spacing.xs }} />
    </View>
  )
}
