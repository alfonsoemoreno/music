import Foundation

final class WiiMClient: NSObject, URLSessionDelegate, @unchecked Sendable {
    private let host: String
    private lazy var localSession: URLSession = URLSession(configuration: .ephemeral, delegate: self, delegateQueue: nil)

    init(host: String) { self.host = host }

    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping @Sendable (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        // WiiM uses a device-local certificate. Trust exceptions are restricted to a
        // literal private LAN address; every cloud request uses normal validation.
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              isPrivateIPv4(host), let trust = challenge.protectionSpace.serverTrust else {
            completionHandler(.performDefaultHandling, nil); return
        }
        completionHandler(.useCredential, URLCredential(trust: trust))
    }

    func nowPlaying() async throws -> Playback {
        let status = try await command("getStatusEx")
        let device = status["device"] as? [String: Any] ?? status
        let playerResponse = try? await command("getPlayerStatus")
        let player = (playerResponse?["player"] as? [String: Any]) ?? playerResponse ?? (status["player"] as? [String: Any]) ?? status
        let metadataResponse = try? await command("getMetaInfo")
        let metadata = (metadataResponse?["metaData"] as? [String: Any]) ?? metadataResponse
        func text(_ source: [String: Any]?, _ name: String) -> String? { decode(source?[name] as? String) }
        let artist = text(metadata, "artist") ?? text(player, "Artist") ?? text(player, "artist") ?? "Unknown artist"
        let title = text(metadata, "title") ?? text(player, "Title") ?? text(player, "title") ?? "Unknown track"
        let album = text(metadata, "album") ?? text(player, "Album") ?? text(player, "album")
        let vendor = text(player, "vendor") ?? "WiiM"
        let stateValue = text(player, "status") ?? ""
        let state = ["play", "playing"].contains(stateValue) ? "playing" : (["pause", "paused"].contains(stateValue) ? "paused" : "stopped")
        let duration = (player["totlen"] as? NSNumber)?.intValue ?? 0
        var body: [String: Any] = [
            "agentVersion": "macos-bridge-0.1.0",
            "deviceId": (device["uuid"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? host,
            "playbackProvider": vendor.lowercased().replacingOccurrences(of: "[^a-z0-9]+", with: "", options: .regularExpression),
            "source": vendor,
            "artist": ["name": artist],
            "track": ["title": title, "durationMs": duration],
            "playback": ["state": state]
        ]
        if let album, !album.isEmpty {
            var albumBody: [String: Any] = ["title": album]
            if let artwork = metadata?["albumArtURI"] as? String, artwork.hasPrefix("https://") { albumBody["artworkUrl"] = artwork }
            body["album"] = albumBody
        }
        let json = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        return Playback(fingerprint: [vendor, artist, album ?? "", title, state].joined(separator: "|").lowercased(), body: json)
    }

    private func command(_ name: String) async throws -> [String: Any] {
        for candidate in ["https", "http"] {
            guard var components = URLComponents(string: "\(candidate)://\(host)/httpapi.asp") else { continue }
            components.queryItems = [URLQueryItem(name: "command", value: name)]
            guard let url = components.url else { continue }
            if let (data, response) = try? await localSession.data(from: url), let http = response as? HTTPURLResponse,
               (200...299).contains(http.statusCode), let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                return json
            }
        }
        throw BridgeError.wiimNotFound
    }
}

private func decode(_ value: String?) -> String? {
    guard let value, !value.isEmpty else { return nil }
    let compact = value.replacingOccurrences(of: "\\s", with: "", options: .regularExpression)
    let result: String
    if compact.count.isMultiple(of: 2), compact.range(of: "^[0-9a-fA-F]+$", options: .regularExpression) != nil,
       let data = Data(hex: compact), let decoded = String(data: data, encoding: .utf8) { result = decoded } else { result = value }
    return result.replacingOccurrences(of: "&apos;", with: "'").replacingOccurrences(of: "&#39;", with: "'").replacingOccurrences(of: "&quot;", with: "\"").replacingOccurrences(of: "&amp;", with: "&")
}

private func isPrivateIPv4(_ host: String) -> Bool {
    let parts = host.split(separator: ".").compactMap { Int($0) }
    guard parts.count == 4 else { return false }
    return parts[0] == 10 || (parts[0] == 172 && (16...31).contains(parts[1])) || (parts[0] == 192 && parts[1] == 168)
}

private extension Data { init?(hex: String) { var result = Data(); var index = hex.startIndex; while index < hex.endIndex { let next = hex.index(index, offsetBy: 2); guard let byte = UInt8(hex[index..<next], radix: 16) else { return nil }; result.append(byte); index = next }; self = result } }
