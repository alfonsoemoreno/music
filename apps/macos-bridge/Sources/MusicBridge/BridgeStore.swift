import Foundation
import ServiceManagement
import SwiftUI

@MainActor
final class BridgeStore: ObservableObject {
    @Published var pin = ""
    @Published var name = "Music Bridge · Mac"
    @Published private(set) var status = "Ingresa el PIN mostrado en Music para comenzar."
    @Published private(set) var paired = false
    @Published private(set) var launchAtLogin = false
    private let configKey = "bridgeConfiguration"
    private var monitor: Task<Void, Never>?

    init() {
        paired = configuration != nil
        launchAtLogin = SMAppService.mainApp.status == .enabled
        if paired { startMonitoring() }
    }

    func toggleLaunchAtLogin() {
        do {
            if launchAtLogin { try SMAppService.mainApp.unregister() }
            else { try SMAppService.mainApp.register() }
            launchAtLogin = SMAppService.mainApp.status == .enabled
        } catch { status = "No se pudo actualizar el inicio automático: \(error.localizedDescription)" }
    }

    deinit { monitor?.cancel() }

    func pair() {
        guard isSixDigitPin(pin) else { status = "Ingresa el PIN de seis dígitos mostrado en Music."; return }
        status = "Vinculando de forma segura…"
        let pin = pin
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Music Bridge · Mac" : name
        Task {
            do {
                let id = try await CloudClient.activate(pin: pin, name: name, installationId: installationId)
                let config = BridgeConfiguration(bridgeId: id, installationId: installationId)
                UserDefaults.standard.set(try JSONEncoder().encode(config), forKey: configKey)
                paired = true
                self.pin = ""
                startMonitoring()
            } catch { status = "No se pudo vincular: \(error.localizedDescription)" }
        }
    }

    func retry() { monitor?.cancel(); startMonitoring() }

    private var installationId: String {
        if let saved = UserDefaults.standard.string(forKey: "installationId") { return saved }
        let created = UUID().uuidString.lowercased(); UserDefaults.standard.set(created, forKey: "installationId"); return created
    }

    private var configuration: BridgeConfiguration? {
        guard let data = UserDefaults.standard.data(forKey: configKey) else { return nil }
        return try? JSONDecoder().decode(BridgeConfiguration.self, from: data)
    }

    private func startMonitoring() {
        guard let config = configuration else { return }
        monitor?.cancel()
        monitor = Task { [weak self] in
            var host: String?
            var fingerprint: String?
            var lastSentAt = Date.distantPast
            var failures = 0
            while !Task.isCancelled {
                if host == nil {
                    if let savedHost = UserDefaults.standard.string(forKey: "lastWiiMHost") {
                        host = savedHost
                        self?.status = "Reconectando al WiiM…"
                    } else {
                        self?.status = "Buscando WiiM en esta red…"
                        host = await WiiMDiscovery.find { message in await MainActor.run { self?.status = message } }
                    }
                    guard host != nil else { self?.status = "No se encontró WiiM; reintentando…"; try? await Task.sleep(for: .seconds(8)); continue }
                    UserDefaults.standard.set(host, forKey: "lastWiiMHost")
                    self?.status = "WiiM encontrado: \(host!)"
                }
                do {
                    let playback = try await WiiMClient(host: host!).nowPlaying()
                    failures = 0
                    if playback.fingerprint != fingerprint || Date().timeIntervalSince(lastSentAt) >= 45 { try await CloudClient.sendPlayback(playback, config: config); fingerprint = playback.fingerprint; lastSentAt = Date() }
                    self?.status = "WiiM conectado · reproducción sincronizada"
                } catch {
                    failures += 1; self?.status = "No se pudo consultar el WiiM; reintentando…"
                    if failures >= 3 { UserDefaults.standard.removeObject(forKey: "lastWiiMHost"); host = nil; failures = 0 }
                }
                try? await Task.sleep(for: .seconds(2))
            }
        }
    }
}
