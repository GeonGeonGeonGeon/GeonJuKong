import UserNotifications

@objc(AppBadgePlugin)
public class AppBadgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppBadgePlugin"
    public let jsName = "AppBadge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]

    @objc func set(_ call: CAPPluginCall) {
        let count = max(0, call.getInt("count") ?? 0)
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            if count > 0 && settings.authorizationStatus == .notDetermined {
                center.requestAuthorization(options: [.badge]) { granted, error in
                    if let error = error { call.reject(error.localizedDescription); return }
                    if granted { self.update(count, call: call) } else { call.resolve() }
                }
            } else {
                self.update(count, call: call)
            }
        }
    }

    private func update(_ count: Int, call: CAPPluginCall) {
        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(count) { error in
                if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
            }
        } else {
            DispatchQueue.main.async {
                UIApplication.shared.applicationIconBadgeNumber = count
                call.resolve()
            }
        }
    }
}
