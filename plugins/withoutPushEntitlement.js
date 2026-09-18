const { withEntitlementsPlist } = require('expo/config-plugins')

/**
 * 아이폰에서 원격 푸시 권한을 뗀다.
 *
 * `expo-notifications` 가 `aps-environment` 를 자동으로 붙이는데,
 * **무료 개발자 계정은 이 권한을 못 쓴다.** 그대로 두면 서명이 아예
 * 실패해서 아이폰에 앱을 못 올린다.
 *
 * ```
 * Personal development teams do not support
 * the Push Notifications capability.
 * ```
 *
 * ## 떼도 되는 이유
 *
 * 이 권한은 **바깥 서버가 보내는 알림**(APNs)에만 필요하다. 비행기에는
 * 인터넷이 없으니 애초에 쓸 수 없는 길이다.
 *
 * 우리가 쓰는 것은 **기기가 스스로 띄우는 알림**이다. 새 메시지가 오면
 * 그 자리에서 띄우고, 연결이 끊기면 알리고, 한참 답이 없으면 미리 걸어둔
 * 알림이 뜬다. 전부 이 권한 없이 된다.
 *
 * 그러니 이건 우회가 아니라 **안 쓰는 것을 안 적는 것**이다.
 *
 * (docs/08-build-release.md 5장)
 */
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, mod => {
    delete mod.modResults['aps-environment']
    return mod
  })
}
