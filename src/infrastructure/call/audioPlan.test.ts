import { describe, expect, it } from 'vitest'
import type { AudioRoute } from '@/application/ports/VoiceLink'
import {
  DUCK_FADE_MS,
  DUCK_TO,
  degradesMusic,
  headphonesJustUnplugged,
  keepsMicrophoneOpen,
  needsReconfigure,
  planForAndroid,
  planForIos,
  UNDUCK_AFTER_MS,
} from './audioPlan'

/**
 * 소리 길 잡기.
 *
 * **이 앱에서 가장 까다로운 부분이다.** "음악을 들으면서 대화한다"는
 * 요구 하나 때문에 있다. 기기 없이는 실제로 들어볼 수 없으니,
 * 적어도 **무엇을 요청하는지**는 여기서 못박아 둔다.
 */

const withHeadphones: AudioRoute = {
  output: 'bluetooth',
  input: 'bluetooth',
  headphonesConnected: true,
}

const withoutHeadphones: AudioRoute = {
  output: 'speaker',
  input: 'built-in',
  headphonesConnected: false,
}

describe('아이폰 소리 설정', () => {
  it('어느 방식이든 음악을 끄지 않는다', () => {
    // mixWithOthers 가 빠지면 통화를 켜는 순간 음악이 멎는다.
    // **이 앱을 만든 이유가 사라진다.**
    for (const mode of ['push-to-talk-brief', 'phone-mic', 'like-a-call'] as const) {
      expect(planForIos(mode).options).toContain('mixWithOthers')
    }
  })

  it('어느 방식이든 이어폰으로 좋은 음질을 내보낸다', () => {
    for (const mode of ['push-to-talk-brief', 'phone-mic', 'like-a-call'] as const) {
      expect(planForIos(mode).options).toContain('allowBluetoothA2DP')
    }
  })

  it('폰에 대고 말하기는 이어폰 마이크를 안 쓴다', () => {
    // **여기가 핵심이다.** allowBluetoothHFP 를 빼면 iOS 가 이어폰
    // 마이크를 후보에서 빼고 폰 마이크를 쓴다. 이어폰이 출력 전용으로
    // 남아 음악 음질이 그대로다.
    expect(planForIos('phone-mic').options).not.toContain('allowBluetoothHFP')
  })

  it('나머지 두 방식은 이어폰 마이크를 쓴다', () => {
    expect(planForIos('push-to-talk-brief').options).toContain('allowBluetoothHFP')
    expect(planForIos('like-a-call').options).toContain('allowBluetoothHFP')
  })

  it('메아리 제거가 켜지는 모드를 쓴다', () => {
    expect(planForIos('like-a-call').mode).toBe('voiceChat')
    expect(planForIos('like-a-call').category).toBe('playAndRecord')
  })
})

describe('안드로이드 소리 설정', () => {
  it('다른 앱 소리를 끄지 않고 줄이기만 한다', () => {
    // GAIN 을 쓰면 음악이 멎는다. TRANSIENT_MAY_DUCK 이어야 한다.
    expect(planForAndroid('push-to-talk-brief').focus).toBe(
      'AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK',
    )
  })

  it('폰에 대고 말하기는 폰 마이크로 못박는다', () => {
    expect(planForAndroid('phone-mic').forceBuiltInMic).toBe(true)
  })

  it('나머지는 기기가 고르게 둔다', () => {
    expect(planForAndroid('push-to-talk-brief').forceBuiltInMic).toBe(false)
    expect(planForAndroid('like-a-call').forceBuiltInMic).toBe(false)
  })
})

describe('방식마다 무엇을 잃나', () => {
  it('말할 때만 잠깐은 마이크를 계속 열지 않는다', () => {
    expect(keepsMicrophoneOpen('push-to-talk-brief')).toBe(false)
  })

  it('나머지 둘은 마이크를 계속 연다', () => {
    expect(keepsMicrophoneOpen('phone-mic')).toBe(true)
    expect(keepsMicrophoneOpen('like-a-call')).toBe(true)
  })

  it('전화처럼만 음악 음질이 통화 내내 떨어진다', () => {
    expect(degradesMusic('like-a-call')).toBe(true)
    // 폰 마이크는 이어폰이 출력 전용이라 그대로다
    expect(degradesMusic('phone-mic')).toBe(false)
    // 말할 때만 잠깐은 그 순간만이다
    expect(degradesMusic('push-to-talk-brief')).toBe(false)
  })
})

describe('이어폰을 뺐다 꼈다 할 때', () => {
  it('빠진 것을 알아챈다', () => {
    // **마이크를 즉시 꺼야 한다.** 스피커로 대화가 새어나간다.
    expect(headphonesJustUnplugged(withHeadphones, withoutHeadphones)).toBe(true)
  })

  it('다시 낀 것은 뺀 것이 아니다', () => {
    expect(headphonesJustUnplugged(withoutHeadphones, withHeadphones)).toBe(false)
  })

  it('처음 알게 된 상태는 뺀 것이 아니다', () => {
    // 아직 몰랐다가 "이어폰 없음"을 처음 읽은 것뿐이다.
    // 여기서 껐다고 알리면 켜지도 않은 마이크를 껐다고 한다.
    expect(headphonesJustUnplugged(null, withoutHeadphones)).toBe(false)
  })

  it('이어폰이 바뀌면 설정을 다시 잡는다', () => {
    const wired: AudioRoute = {
      output: 'wired',
      input: 'wired',
      headphonesConnected: true,
    }

    expect(needsReconfigure(withHeadphones, wired)).toBe(true)
  })

  it('그대로면 다시 잡지 않는다', () => {
    expect(needsReconfigure(withHeadphones, withHeadphones)).toBe(false)
  })

  it('처음에는 무조건 잡는다', () => {
    expect(needsReconfigure(null, withHeadphones)).toBe(true)
  })
})

describe('상대가 말하면 음악을 줄인다', () => {
  it('끄지 않고 줄이기만 한다', () => {
    expect(DUCK_TO).toBeGreaterThan(0)
    expect(DUCK_TO).toBeLessThan(1)
  })

  it('뚝 끊기지 않게 서서히 줄인다', () => {
    expect(DUCK_FADE_MS).toBeGreaterThan(0)
  })

  it('되돌리는 데 뜸을 들인다', () => {
    // 문장 사이 짧은 침묵마다 음악이 오르내리면 더 거슬린다.
    // 줄이는 것보다 되돌리는 쪽이 느려야 한다.
    expect(UNDUCK_AFTER_MS).toBeGreaterThan(DUCK_FADE_MS)
  })
})
