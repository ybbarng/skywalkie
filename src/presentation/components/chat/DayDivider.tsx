import { View } from 'react-native'
import { useTheme } from '../../theme/ThemeProvider'
import { Text } from '../Text'

/** 날짜가 바뀌는 자리에 넣는다. 긴 비행에서는 자정을 넘긴다 */
export function DayDivider({ date }: { date: Date }) {
  const theme = useTheme()

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        marginVertical: theme.spacing.lg,
      }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
      <Text variant="caption" color="textFaint">
        {formatDay(date)}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
    </View>
  )
}

function formatDay(date: Date): string {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${days[date.getDay()]}요일`
}
