import AppKit
import SwiftUI

@main
struct MusicBridgeApp: App {
    @StateObject private var bridge = BridgeStore()
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup("Music Bridge", id: "main") {
            ContentView().environmentObject(bridge)
                .frame(minWidth: 500, minHeight: 560)
        }
        .windowResizability(.contentSize)
        MenuBarExtra("Music Bridge", systemImage: bridge.paired ? "music.note.house.fill" : "exclamationmark.triangle") {
            BridgeMenu().environmentObject(bridge)
        }
    }
}

private final class AppDelegate: NSObject, NSApplicationDelegate {
    private var activity: NSObjectProtocol?

    func applicationDidFinishLaunching(_ notification: Notification) {
        activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiatedAllowingIdleSystemSleep, .automaticTerminationDisabled], reason: "Mantener Music Bridge sincronizado con el WiiM")
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
}

private struct BridgeMenu: View {
    @EnvironmentObject private var bridge: BridgeStore
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Text(bridge.paired ? "Music Bridge activo" : "Music Bridge sin emparejar")
        Text(bridge.status).lineLimit(2)
        Divider()
        Button("Mostrar Music Bridge") { openWindow(id: "main"); NSApp.activate(ignoringOtherApps: true) }
        Button(bridge.launchAtLogin ? "Desactivar inicio automático" : "Iniciar al iniciar sesión") { bridge.toggleLaunchAtLogin() }
        Divider()
        Button("Salir de Music Bridge") { NSApp.terminate(nil) }
    }
}

private struct ContentView: View {
    @EnvironmentObject private var bridge: BridgeStore

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "music.note.house.fill")
                .font(.system(size: 46)).foregroundStyle(.brown)
            Text("DIGITAL ALBUM COMPANION").font(.caption.weight(.semibold)).tracking(1.5).foregroundStyle(.secondary)
            Text("Music Bridge").font(.system(size: 34, weight: .bold, design: .serif))
            Text("Tu enlace privado entre el WiiM de casa y Music. Encuentra el reproductor automáticamente y sincroniza cambios de álbum.")
                .multilineTextAlignment(.center).foregroundStyle(.secondary).frame(maxWidth: 420)
            if !bridge.paired {
                TextField("PIN de 6 dígitos mostrado en Music", text: $bridge.pin).textFieldStyle(.roundedBorder).frame(maxWidth: 360)
                TextField("Nombre de este puente", text: $bridge.name).textFieldStyle(.roundedBorder).frame(maxWidth: 360)
                Button("EMPAREJAR Y COMENZAR") { bridge.pair() }.buttonStyle(.borderedProminent).tint(.brown)
            } else {
                Button("REINTENTAR DETECCIÓN WiiM") { bridge.retry() }.buttonStyle(.borderedProminent).tint(.brown)
            }
            Text(bridge.status).font(.callout).multilineTextAlignment(.center).frame(maxWidth: 400).padding().background(.quaternary, in: RoundedRectangle(cornerRadius: 10))
            Text("✓ Sin puertos abiertos   ·   ✓ Clave protegida en el llavero   ·   ✓ Solo envía cambios de reproducción")
                .font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
        .padding(32)
    }
}
