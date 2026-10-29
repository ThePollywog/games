import Capacitor
import GameKit

/// Game Center leaderboards for the web app: sign in, submit scores, read entries, show the native UI.
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loadEntries", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise),
    ]

    private var pendingSignIns: [CAPPluginCall] = []
    private var handlerInstalled = false

    private func playerJSON(_ p: GKPlayer) -> [String: Any] {
        ["playerId": p.gamePlayerID, "name": p.displayName]
    }

    /// GameKit calls the handler again whenever auth state changes, so it's installed once
    /// and every waiting call is resolved from it.
    @objc func signIn(_ call: CAPPluginCall) {
        let local = GKLocalPlayer.local
        if local.isAuthenticated {
            call.resolve(["authenticated": true, "player": playerJSON(local)])
            return
        }
        pendingSignIns.append(call)
        if handlerInstalled { return }
        handlerInstalled = true
        DispatchQueue.main.async {
            local.authenticateHandler = { [weak self] vc, error in
                guard let self else { return }
                if let vc {
                    self.bridge?.viewController?.present(vc, animated: true)
                    return
                }
                let calls = self.pendingSignIns
                self.pendingSignIns = []
                for c in calls {
                    if local.isAuthenticated {
                        c.resolve(["authenticated": true, "player": self.playerJSON(local)])
                    } else {
                        c.resolve(["authenticated": false, "error": error?.localizedDescription ?? ""])
                    }
                }
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else { return call.reject("Not signed in to Game Center") }
        guard let ids = call.getArray("leaderboardIds", String.self), !ids.isEmpty,
              let score = call.getInt("score") else { return call.reject("leaderboardIds and score are required") }
        let context = max(0, call.getInt("context") ?? 0)
        GKLeaderboard.submitScore(score, context: context, player: GKLocalPlayer.local, leaderboardIDs: ids) { error in
            if let error { call.reject(error.localizedDescription) } else { call.resolve() }
        }
    }

    /// Top `limit` global entries plus the local player's entry. Recurring leaderboards
    /// resolve to their current occurrence (today's daily, this week's weekly).
    @objc func loadEntries(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else { return call.reject("Not signed in to Game Center") }
        guard let id = call.getString("leaderboardId") else { return call.reject("leaderboardId is required") }
        let limit = min(100, max(1, call.getInt("limit") ?? 50))
        GKLeaderboard.loadLeaderboards(IDs: [id]) { boards, error in
            guard let board = boards?.first else {
                return call.reject(error?.localizedDescription ?? "Unknown leaderboard \(id)")
            }
            board.loadEntries(for: .global, timeScope: .allTime, range: NSRange(location: 1, length: limit)) { me, entries, total, error in
                if let error { return call.reject(error.localizedDescription) }
                let json: (GKLeaderboard.Entry) -> [String: Any] = { e in
                    ["rank": e.rank, "score": e.score, "context": e.context, "playerId": e.player.gamePlayerID, "name": e.player.displayName]
                }
                var result: [String: Any] = ["total": total, "entries": (entries ?? []).map(json)]
                if let me { result["me"] = json(me) }
                call.resolve(result)
            }
        }
    }

    @objc func showLeaderboard(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let vc: GKGameCenterViewController
            if let id = call.getString("leaderboardId") {
                vc = GKGameCenterViewController(leaderboardID: id, playerScope: .global, timeScope: .allTime)
            } else {
                vc = GKGameCenterViewController(state: .leaderboards)
            }
            vc.gameCenterDelegate = self
            self.bridge?.viewController?.present(vc, animated: true)
            call.resolve()
        }
    }

    public func gameCenterViewControllerDidFinish(_ vc: GKGameCenterViewController) {
        vc.dismiss(animated: true)
    }
}
