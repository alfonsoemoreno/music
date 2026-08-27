import CryptoKit
import Foundation
import Security

/// Keeps the signing key in the user's Keychain. Its private half never leaves the Mac.
// Security/Keychain calls are thread-safe and this class has no mutable stored
// state. The annotation documents that its singleton is safe across tasks.
final class KeychainSigner: @unchecked Sendable {
    static let shared = KeychainSigner()
    private let tag = "app.digitalalbum.musicbridge.signing-key".data(using: .utf8)!
    private let service = "app.digitalalbum.musicbridge"

    private init() {}

    private func key() throws -> P256.Signing.PrivateKey {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "p256",
            kSecReturnData as String: true
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecSuccess, let data = item as? Data {
            return try P256.Signing.PrivateKey(rawRepresentation: data)
        }
        if status != errSecItemNotFound { throw NSError(domain: NSOSStatusErrorDomain, code: Int(status)) }

        let generated = P256.Signing.PrivateKey()
        let add: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "p256",
            kSecValueData as String: generated.rawRepresentation,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let addStatus = SecItemAdd(add as CFDictionary, nil)
        guard addStatus == errSecSuccess else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(addStatus)) }
        return generated
    }

    func publicKey() throws -> String {
        try key().publicKey.derRepresentation.base64EncodedString()
    }

    func sign(_ message: String) throws -> String {
        let signature = try key().signature(for: Data(message.utf8))
        return signature.derRepresentation.base64EncodedString()
    }
}
