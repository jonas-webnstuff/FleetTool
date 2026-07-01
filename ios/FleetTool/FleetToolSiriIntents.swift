import Foundation

@available(iOS 16.0, *)
import AppIntents

@available(iOS 16.0, *)
enum FleetToolIntentFlags {
  static var nativeSiriEnabled: Bool {
    Bundle.main.object(forInfoDictionaryKey: "FT_ENABLE_NATIVE_SIRI_INTENTS") as? Bool ?? false
  }
}

@available(iOS 16.0, *)
struct FleetToolMoveToolIntent: AppIntent {
  static let title: LocalizedStringResource = "Move Tool"
  static let description = IntentDescription("Open FleetTool move flow for a specific tool.")
  static let openAppWhenRun = true

  @Parameter(title: "Tool ID")
  var itemId: String?

  @Parameter(title: "Tool Name")
  var itemName: String?

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard FleetToolIntentFlags.nativeSiriEnabled else {
      return .result(dialog: "Native Siri move intent is disabled in this build.")
    }

    let hasId = !(itemId?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
    let hasName = !(itemName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)

    guard hasId || hasName else {
      return .result(dialog: "Specify a tool id or tool name.")
    }

    // Phase B skeleton: deep-link execution from native intent is intentionally deferred.
    return .result(dialog: "Opening FleetTool. Confirm move in app.")
  }
}

@available(iOS 16.0, *)
struct FleetToolShortcutsProvider: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    [
      AppShortcut(
        intent: FleetToolMoveToolIntent(),
        phrases: [
          "Move tool in \(.applicationName)",
          "Move a tool with \(.applicationName)",
        ],
        shortTitle: "Move Tool",
        systemImageName: "arrow.left.arrow.right"
      ),
    ]
  }
}