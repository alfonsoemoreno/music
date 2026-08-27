import Darwin
import Foundation

enum WiiMDiscovery {
    static func find(report: @escaping @Sendable (String) async -> Void) async -> String? {
        await report("Buscando WiiM por SSDP…")
        if let host = await discoverSSDP() { return host }
        guard let local = localIPv4Address() else {
            await report("No hay una interfaz Wi‑Fi/Ethernet IPv4 activa.")
            return nil
        }
        await report("SSDP no respondió; revisando la red local…")
        let hosts = subnetHosts(near: local)
        return await withTaskGroup(of: String?.self, returning: String?.self) { group in
            var iterator = hosts.makeIterator()
            for _ in 0..<24 { if let host = iterator.next() { group.addTask { await isWiiM(host) ? host : nil } } }
            while let result = await group.next() {
                if let result { group.cancelAll(); return result }
                if let host = iterator.next() { group.addTask { await isWiiM(host) ? host : nil } }
            }
            return nil
        }
    }

    private static func isWiiM(_ host: String) async -> Bool {
        let client = WiiMClient(host: host)
        return (try? await client.nowPlaying()) != nil
    }

    private static func discoverSSDP() async -> String? {
        let socket = Darwin.socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP)
        guard socket >= 0 else { return nil }
        defer { Darwin.close(socket) }
        var timeout = timeval(tv_sec: 3, tv_usec: 0)
        setsockopt(socket, SOL_SOCKET, SO_RCVTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
        let search = "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n"
        var destination = sockaddr_in()
        destination.sin_family = sa_family_t(AF_INET)
        destination.sin_port = in_port_t(1900).bigEndian
        _ = "239.255.255.250".withCString { inet_pton(AF_INET, $0, &destination.sin_addr) }
        let sent = search.utf8CString
        withUnsafePointer(to: &destination) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { address in
                _ = sent.withUnsafeBytes { sendto(socket, $0.baseAddress, $0.count - 1, 0, address, socklen_t(MemoryLayout<sockaddr_in>.size)) }
            }
        }
        var buffer = [UInt8](repeating: 0, count: 4096)
        while true {
            let count = recv(socket, &buffer, buffer.count - 1, 0)
            guard count > 0 else { return nil }
            let response = String(decoding: buffer.prefix(Int(count)), as: UTF8.self)
            guard let line = response.split(whereSeparator: { $0.isNewline }).first(where: { $0.lowercased().hasPrefix("location:") }),
                  let url = URL(string: String(line.dropFirst("location:".count).trimmingCharacters(in: CharacterSet.whitespaces))),
                  let host = url.host else { continue }
            // SSDP announces many devices; confirm the local WiiM endpoint before use.
            if await isWiiM(host) { return host }
        }
    }

    private static func localIPv4Address() -> UInt32? {
        var interfaces: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&interfaces) == 0, let first = interfaces else { return nil }
        defer { freeifaddrs(interfaces) }
        var current: UnsafeMutablePointer<ifaddrs>? = first
        while let interface = current {
            defer { current = interface.pointee.ifa_next }
            guard let rawAddress = interface.pointee.ifa_addr,
                  rawAddress.pointee.sa_family == UInt8(AF_INET),
                  (interface.pointee.ifa_flags & UInt32(IFF_LOOPBACK)) == 0 else { continue }
            let address = rawAddress.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { $0.pointee.sin_addr.s_addr }
            let host = UInt32(bigEndian: address)
            if host >> 24 == 10 || host >> 24 == 192 || host >> 24 == 172 { return host }
        }
        return nil
    }

    private static func subnetHosts(near address: UInt32) -> [String] {
        let base = address & 0xffffff00
        return (1...254).map { suffix in
            let value = base | UInt32(suffix)
            return "\(value >> 24).\((value >> 16) & 255).\((value >> 8) & 255).\(value & 255)"
        }.filter { $0 != "\(address >> 24).\((address >> 16) & 255).\((address >> 8) & 255).\(address & 255)" }
    }
}
