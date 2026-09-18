import type { CharacterId } from '@/domain/peer/Character'

/**
 * 상대를 아직 모를 때 무엇을 보여줄 것인가.
 *
 * **한 번도 안 이어졌으면 상대가 누구인지 알 길이 없다.** 이름도
 * 캐릭터도 인사(`hello`)를 주고받아야 알게 된다. 그전에 아무 캐릭터나
 * 골라 그리면 화면이 거짓말을 한다. 여자친구가 고른 적 없는 얼굴을
 * 보고 "쟤가 저걸 골랐구나" 하게 된다.
 *
 * 그래서 모를 때는 **모른다고 그린다.** 얼굴 없는 그림자다.
 *
 * 한 번 이어지고 나면 저장해두므로, 다음부터는 앱을 켜자마자 진짜
 * 얼굴이 뜬다. 거짓말을 하는 건 첫 연결 전 딱 한 번뿐이다.
 */

export interface KnownPeer {
  readonly displayName: string
  readonly character: CharacterId
}

/** 모르면 `null`. `Character` 가 물음표 그림자를 그린다 */
export function peerFace(peer: KnownPeer | null | undefined): CharacterId | null {
  return peer?.character ?? null
}

/**
 * 상대를 뭐라고 부를까.
 *
 * 두 가지가 있다.
 *
 *   · **상대가 고른 이름** — 인사(`hello`)를 주고받아야 안다
 *   · **내가 부르는 별명** — 첫 실행 안내에서 내가 적어둔다. "여자친구"
 *
 * 이어지기 전에는 별명을 쓴다. **누구를 기다리는지는 알고 있다.**
 * 모르는 건 그 사람이 뭘 골랐는지지 누구인지가 아니다.
 *
 * 이어지고 나면 상대가 고른 이름이 앞선다. 본인이 그렇게 불리고 싶어
 * 적은 것이기 때문이다.
 *
 * 둘 다 없으면 `null`. 문구를 짓는 쪽(`copy/connecting.ts`)이 그때
 * "상대가" 처럼 조사까지 맞춰 쓴다.
 */
export function peerName(
  peer: KnownPeer | null | undefined,
  nickname?: string | null,
): string | null {
  const chosen = peer?.displayName ?? ''
  if (chosen.length > 0) return chosen

  const called = nickname ?? ''
  return called.length > 0 ? called : null
}

/**
 * 한 줄에 그냥 박아 넣을 이름.
 *
 * 이름 자리를 비워두면 줄이 흔들린다. 무엇이 올 자리인지는 알려주되
 * 없는 이름을 지어내지 않는다.
 */
export function peerLabel(
  peer: KnownPeer | null | undefined,
  nickname?: string | null,
): string {
  return peerName(peer, nickname) ?? '상대'
}
