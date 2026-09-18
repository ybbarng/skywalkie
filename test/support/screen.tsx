import type { ReactElement } from 'react'
import { act, create, type ReactTestInstance } from 'react-test-renderer'

/**
 * 화면을 글자로 확인한다.
 *
 * `@testing-library/react-native` 은 진짜 `react-native` 내부를 끌어오는데
 * 그게 Flow 로 적혀 있어 vitest 가 못 읽는다. 그래서 얇게 직접 만든다.
 *
 * **여기서 보는 것은 생김새가 아니라 뼈대다.** 무엇이 눌리는가, 잠겼는가,
 * 누르면 무슨 일이 일어나는가. 색과 여백은 눈으로 봐야 한다.
 *
 * (docs/09-testing.md)
 */

export interface Screen {
  /** 이 글자를 담고 있는 가장 안쪽 것 */
  text(value: string): ReactTestInstance
  /** 있나 없나만 본다 */
  hasText(value: string): boolean
  /** 이 글자가 적힌 누를 수 있는 것. 없으면 던진다 */
  pressable(label: string): ReactTestInstance
  /** 누른다. 잠겨 있으면 던진다 */
  press(label: string): Promise<void>
  /** 잠겨 있나 */
  disabled(label: string): boolean
  /** 안내 글자로 입력 칸을 찾아 글을 넣는다 */
  type(placeholder: string, value: string): Promise<void>
  /** 화면에 있는 모든 글자. 무엇이 보이는지 확인할 때 */
  allText(): string[]
  root: ReactTestInstance
}

export async function show(element: ReactElement): Promise<Screen> {
  let renderer: ReturnType<typeof create> | null = null

  await act(async () => {
    renderer = create(element)
  })

  const tree = renderer as unknown as ReturnType<typeof create>
  const root = tree.root

  const collect = (node: ReactTestInstance): string[] => {
    const out: string[] = []
    for (const child of node.children) {
      if (typeof child === 'string') out.push(child)
      else out.push(...collect(child))
    }
    return out
  }

  const textOf = (node: ReactTestInstance): string => collect(node).join('')

  const findText = (value: string): ReactTestInstance | null => {
    const holders = root.findAll(
      node => typeof node.type === 'string' && textOf(node).includes(value),
      { deep: true },
    )
    // 가장 안쪽 것이 곧 그 글자를 쓴 것이다
    return holders.length === 0 ? null : (holders[holders.length - 1] ?? null)
  }

  /**
   * 그 글자를 품은 **누를 수 있는 조상**을 찾는다.
   *
   * 버튼은 보통 `Pressable` 안에 `Text` 가 들어 있는 모양이라, 글자만
   * 찾아서는 누를 수 없다.
   */
  const findPressable = (label: string): ReactTestInstance | null => {
    const pressables = root.findAll(
      node =>
        typeof node.props?.onPress === 'function' ||
        node.props?.accessibilityRole === 'button',
      { deep: true },
    )

    const matching = pressables.filter(node => textOf(node).includes(label))
    // 가장 안쪽 것. 바깥 것은 화면 전체를 감싸고 있을 수 있다
    return matching.length === 0 ? null : (matching[matching.length - 1] ?? null)
  }

  const isDisabled = (node: ReactTestInstance): boolean =>
    node.props?.disabled === true ||
    node.props?.accessibilityState?.disabled === true ||
    node.props?.onPress === undefined

  return {
    root,

    text(value) {
      const found = findText(value)
      if (found === null) {
        throw new Error(
          `화면에 "${value}" 가 없다. 보이는 글자: ${collect(root).join(' · ')}`,
        )
      }
      return found
    },

    hasText(value) {
      return findText(value) !== null
    },

    pressable(label) {
      const found = findPressable(label)
      if (found === null) {
        throw new Error(`"${label}" 을 누를 수 없다. 그런 것이 화면에 없다`)
      }
      return found
    },

    disabled(label) {
      const found = findPressable(label)
      if (found === null) return true
      return isDisabled(found)
    },

    async press(label) {
      const found = findPressable(label)
      if (found === null) {
        throw new Error(`"${label}" 을 누를 수 없다. 그런 것이 화면에 없다`)
      }
      if (isDisabled(found)) {
        throw new Error(`"${label}" 이 잠겨 있어서 안 눌린다`)
      }

      await act(async () => {
        found.props.onPress()
      })
    },

    async type(placeholder, value) {
      const input = root.findAll(node => node.props?.placeholder === placeholder, {
        deep: true,
      })[0]

      if (input === undefined) {
        throw new Error(`"${placeholder}" 라고 적힌 입력 칸이 없다`)
      }

      await act(async () => {
        input.props.onChangeText(value)
      })
    },

    allText() {
      return collect(root)
    },
  }
}
