import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { readNetwork } from '@/composition/services'

/**
 * 지금 우리 망에 붙어 있나를 지켜본다.
 *
 * **핫스팟이 꺼진 것을 알아채기 위해 만든다.**
 *
 * 떨어져 앉으면 서로 말할 수 없다. 내가 실수로 핫스팟을 껐거나
 * 비행기 모드 때문에 꺼졌을 때, 상대는 왜 끊겼는지 알 방법이 없다.
 * 그래서 **각자의 앱이 스스로 알아채고 알려줘야 한다.**
 *
 *   · 여는 쪽: 내 핫스팟이 꺼졌다 → "다시 켜주세요" 라고 알린다
 *   · 붙는 쪽: 상대 Wi-Fi 에서 나왔다 → "상대가 잠시 끈 것 같아요"
 */
export interface NetworkWatch {
  /** 사설망(핫스팟)에 붙어 있나. 아직 모르면 null */
  readonly onPrivateNetwork: boolean | null
  /** 내가 그 망의 주인인가. 핫스팟을 켠 쪽이면 참 */
  readonly isGateway: boolean
  readonly address: string | null
}

const CHECK_INTERVAL_MS = 5000

export function useNetworkWatch(enabled = true): NetworkWatch {
  const [watch, setWatch] = useState<NetworkWatch>({
    onPrivateNetwork: null,
    isGateway: false,
    address: null,
  })

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function check(): Promise<void> {
      const snapshot = await readNetwork()
      if (cancelled) return

      if (!snapshot.ok) {
        // 주소를 못 읽었다. 망에서 나왔다는 뜻이다.
        setWatch({ onPrivateNetwork: false, isGateway: false, address: null })
        return
      }

      setWatch({
        onPrivateNetwork: snapshot.value.onPrivateNetwork,
        isGateway: snapshot.value.role === 'host',
        address: snapshot.value.self.text,
      })
    }

    void check()
    const timer = setInterval(() => void check(), CHECK_INTERVAL_MS)

    // 앱이 앞으로 돌아오면 바로 확인한다.
    // 설정에서 핫스팟을 켜고 돌아온 순간이 그렇다.
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') void check()
    })

    return () => {
      cancelled = true
      clearInterval(timer)
      subscription.remove()
    }
  }, [enabled])

  return watch
}
