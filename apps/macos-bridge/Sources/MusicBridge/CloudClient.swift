import Foundation

enum CloudClient {
    static func activate(pin: String, name: String, installationId: String) async throws -> String {
        guard isSixDigitPin(pin) else { throw BridgeError.invalidPin }
        let payload: [String: String] = [
            "enrollmentCode": pin,
            "installationId": installationId,
            "name": name,
            "publicKey": try KeychainSigner.shared.publicKey()
        ]
        let data = try JSONSerialization.data(withJSONObject: payload)
        var request = URLRequest(url: MusicCloud.url.appending(path: "api/bridges/activate"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = data
        let (response, http) = try await URLSession.shared.data(for: request)
        guard let result = http as? HTTPURLResponse, (200...299).contains(result.statusCode),
              let object = try JSONSerialization.jsonObject(with: response) as? [String: Any],
              let bridgeId = object["bridgeId"] as? String else { throw BridgeError.invalidResponse }
        return bridgeId
    }

    static func sendPlayback(_ playback: Playback, config: BridgeConfiguration) async throws {
        let timestamp = String(Int(Date().timeIntervalSince1970 * 1_000))
        let nonce = UUID().uuidString.lowercased()
        let body = String(decoding: playback.body, as: UTF8.self)
        let signature = try KeychainSigner.shared.sign("\(timestamp).\(nonce).\(body)")
        var request = URLRequest(url: MusicCloud.url.appending(path: "api/bridges/playback"))
        request.httpMethod = "POST"
        request.httpBody = playback.body
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(config.bridgeId, forHTTPHeaderField: "x-music-bridge-id")
        request.setValue(timestamp, forHTTPHeaderField: "x-music-timestamp")
        request.setValue(nonce, forHTTPHeaderField: "x-music-nonce")
        request.setValue(signature, forHTTPHeaderField: "x-music-signature")
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { throw BridgeError.invalidResponse }
    }
}

func isSixDigitPin(_ value: String) -> Bool {
    value.count == 6 && value.allSatisfy(\.isNumber)
}
