import { type DomainError, domainError } from '../shared/DomainError'
import { err, ok, type Result } from '../shared/Result'

/**
 * 여섯 자리 코드.
 *
 * 같은 Wi-Fi 에 다른 사람이 붙어 있어도 우리 둘만 연결되게 한다.
 * **화면에 크게 띄워 상대에게 보여주는 용도**라 읽기 쉬워야 한다.
 * 말을 나눌 수 없는 상황에서 쓰는 것이기 때문이다.
 * (docs/04-transport-spec.md 7장)
 */

/**
 * 쓸 수 있는 글자.
 *
 * 헷갈리는 것을 뺐다. 0과 O, 1과 I와 L 은 화면으로 보여주고
 * 상대가 입력하는 과정에서 반드시 틀린다.
 */
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const CODE_LENGTH = 6

const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`)

declare const brand: unique symbol

export type PairingCode = string & { readonly [brand]: 'PairingCode' }

export function pairingCode(value: string): Result<PairingCode, DomainError> {
  const upper = value.trim().toUpperCase()

  if (upper.length === 0) {
    return err(domainError('empty', '코드를 입력하지 않았다', 'code'))
  }

  if (upper.length !== CODE_LENGTH) {
    return err(
      domainError(
        'invalid-value',
        `코드는 ${CODE_LENGTH}자리다 (지금 ${upper.length}자리)`,
        'code',
      ),
    )
  }

  if (!CODE_PATTERN.test(upper)) {
    return err(domainError('invalid-value', '코드에 쓸 수 없는 글자가 있다', 'code'))
  }

  return ok(upper as PairingCode)
}

/**
 * 무작위 코드를 만든다.
 *
 * 무작위 값을 바깥에서 받는 이유는 테스트에서 같은 값이 나오게 하기 위해서다.
 * 도메인은 난수를 직접 만들지 않는다.
 *
 * @param random 0 이상 1 미만의 값을 주는 것
 */
export function generatePairingCode(random: () => number): PairingCode {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const index = Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length
    code += CODE_ALPHABET[index]
  }
  return code as PairingCode
}

export function sameCode(a: PairingCode, b: PairingCode): boolean {
  return a === b
}

/** 보여줄 때 세 자리씩 끊는다. 읽어주기 쉽다 */
export function formatForDisplay(code: PairingCode): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`
}
