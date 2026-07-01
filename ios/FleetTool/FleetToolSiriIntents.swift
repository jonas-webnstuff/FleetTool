import Foundation
import UIKit
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

  private func makeDeepLink() -> URL? {
    var components = URLComponents()
    components.scheme = "fleettool"
    components.host = "siri"
    components.path = "/move"

    let trimmedId = itemId?.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedName = itemName?.trimmingCharacters(in: .whitespacesAndNewlines)

    if let id = trimmedId, !id.isEmpty {
      components.queryItems = [URLQueryItem(name: "itemId", value: id)]
      return components.url
    }

    if let name = trimmedName, !name.isEmpty {
      components.queryItems = [URLQueryItem(name: "itemName", value: name)]
      return components.url
    }

    return nil
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard FleetToolIntentFlags.nativeSiriEnabled else {
      return .result(dialog: "Native Siri move intent is disabled in this build.")
    }

    let hasId = !(itemId?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
    let hasName = !(itemName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)

    guard hasId || hasName else {
      return .result(dialog: "Specify a tool id or tool name.")
    }

    guard let deepLink = makeDeepLink() else {
      return .result(dialog: "Could not create a valid FleetTool link.")
    }

    await MainActor.run {
      UIApplication.shared.open(deepLink, options: [:], completionHandler: nil)
    }

    return .result(dialog: "Opening FleetTool. Confirm move in app.")
  }
}

@available(iOS 16.0, *)
struct FleetToolShortcutsProvider: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: FleetToolMoveToolIntent(),
      phrases: [
        "Move tool in \(.applicationName)",
        "Move a tool with \(.applicationName)",
      ],
      shortTitle: "Move Tool",
      systemImageName: "arrow.left.arrow.right"
    )
  }
}