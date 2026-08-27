import Foundation

enum MusicCloud {
    static let url = URL(string: "https://musicwiim.vercel.app")!
}

struct BridgeConfiguration: Codable {
    let bridgeId: String
    let installationId: String
}

struct Playback: Equatable {
    let fingerprint: String
    let body: Data
}

enum BridgeError: LocalizedError {
    case invalidPin
    case invalidResponse
    case wiimNotFound

    var errorDescription: String? {
        switch self {
        case .invalidPin: "Ingresa el PIN de seis dígitos mostrado en Music."
        case .invalidResponse: "El servidor devolvió una respuesta inesperada."
        case .wiimNotFound: "No se encontró un WiiM en esta red Wi‑Fi."
        }
    }
}
