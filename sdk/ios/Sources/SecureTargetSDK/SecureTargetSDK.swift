import Foundation
#if canImport(UIKit)
import UIKit
#endif

public struct SecureTargetConfig {
    public let apiKey: String
    public let companyId: String
    public let endpoint: URL

    public init(apiKey: String, companyId: String, endpoint: URL) {
        self.apiKey = apiKey
        self.companyId = companyId
        self.endpoint = endpoint
    }
}

/// Device snapshot sent **once** to `POST /v1/session/bootstrap`; later requests only send `x-session-id`.
public struct SecureTargetDeviceDetails: Encodable {
    public let platform = "ios"
    public var osVersion: String?
    public var model: String?
    public var locale: String?
    public var timezone: String?
    public var appVersion: String?
    public var sdkVersion: String?

    public init(
        osVersion: String? = nil,
        model: String? = nil,
        locale: String? = nil,
        timezone: String? = nil,
        appVersion: String? = nil,
        sdkVersion: String? = "0.2.0"
    ) {
        self.osVersion = osVersion
        self.model = model
        self.locale = locale
        self.timezone = timezone
        self.appVersion = appVersion
        self.sdkVersion = sdkVersion
    }

    public static func captureDefault() -> SecureTargetDeviceDetails {
        let tz = TimeZone.current.identifier
        let loc = Locale.current.identifier
        var model: String?
        #if canImport(UIKit)
        model = UIDevice.current.model
        let os = "\(UIDevice.current.systemName) \(UIDevice.current.systemVersion)"
        return SecureTargetDeviceDetails(osVersion: os, model: model, locale: loc, timezone: tz)
        #else
        return SecureTargetDeviceDetails(locale: loc, timezone: tz)
        #endif
    }
}

private struct BootstrapBody: Encodable {
    let occurredAt: String
    let device: SecureTargetDeviceDetails
}

private struct BootstrapResponse: Decodable {
    let sessionId: String
}

public enum SecureTargetError: Error {
    case missingSession
    case http(Int, String)
    case decode
}

public final class SecureTargetSDK {
    private let config: SecureTargetConfig
    private let storageKey = "securetarget_session_id"
    private var sessionId: String?
    private let urlSession: URLSession

    public init(config: SecureTargetConfig, urlSession: URLSession = .shared) {
        self.config = config
        self.urlSession = urlSession
        if let s = UserDefaults.standard.string(forKey: storageKey) {
            self.sessionId = s
        }
    }

    /// Deprecated: ingest `token` is always the bootstrap `sessionId` on every `/v1/record` call.
    @available(*, deprecated, message: "Record token is the bootstrap sessionId; this method has no effect.")
    public func setLoginToken(_ token: String) {}

    /// Removes stored session so the next call bootstraps again.
    public func clearSession() {
        sessionId = nil
        UserDefaults.standard.removeObject(forKey: storageKey)
    }

    /// Sends device details once; stores opaque `sessionId` for `x-session-id` on later requests.
    public func bootstrapSession(device: SecureTargetDeviceDetails = .captureDefault()) async throws {
        if sessionId != nil { return }
        let url = config.endpoint.appendingPathComponent("/v1/session/bootstrap")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(config.apiKey, forHTTPHeaderField: "x-api-key")
        let body = BootstrapBody(occurredAt: ISO8601DateFormatter().string(from: Date()), device: device)
        req.httpBody = try JSONEncoder().encode(body)
        let (data, res) = try await urlSession.data(for: req)
        guard let http = res as? HTTPURLResponse else { throw SecureTargetError.http(-1, "no response") }
        guard (200 ... 299).contains(http.statusCode) else {
            throw SecureTargetError.http(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
        let decoded = try JSONDecoder().decode(BootstrapResponse.self, from: data)
        sessionId = decoded.sessionId
        UserDefaults.standard.set(decoded.sessionId, forKey: storageKey)
    }

    private func requireSessionId() async throws -> String {
        try await bootstrapSession()
        guard let sid = sessionId else { throw SecureTargetError.missingSession }
        return sid
    }

    private func jsonHeaders() -> [String: String] {
        var h = ["Content-Type": "application/json", "x-api-key": config.apiKey]
        if let sid = sessionId {
            h["x-session-id"] = sid
        }
        return h
    }

    private func post(path: String, body: [String: Any]) async throws {
        try await bootstrapSession()
        guard sessionId != nil else { throw SecureTargetError.missingSession }
        let url = config.endpoint.appendingPathComponent(path)
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        jsonHeaders().forEach { req.setValue($0.value, forHTTPHeaderField: $0.key) }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, res) = try await urlSession.data(for: req)
        guard let http = res as? HTTPURLResponse, (200 ... 299).contains(http.statusCode) else {
            throw SecureTargetError.http(-1, path)
        }
    }

    public func trackRecord(eventId: String, occurredAt: String, campaignId: String? = nil) async throws {
        let sid = try await requireSessionId()
        var body: [String: Any] = [
            "actionType": "record",
            "eventId": eventId,
            "companyId": config.companyId,
            "occurredAt": occurredAt,
            "token": sid
        ]
        if let c = campaignId { body["campaignId"] = c }
        try await post(path: "/v1/record", body: body)
    }

    /// `token` on the wire is the bootstrap **sessionId** (same identifier as `x-session-id`).
    public func trackLogin(eventId: String, occurredAt: String) async throws {
        let sid = try await requireSessionId()
        let body: [String: Any] = [
            "actionType": "login",
            "eventId": eventId,
            "companyId": config.companyId,
            "occurredAt": occurredAt,
            "token": sid
        ]
        try await post(path: "/v1/record", body: body)
    }

    public func trackConversion(eventId: String, occurredAt: String, conversionName: String, value: Double? = nil) async throws {
        let sid = try await requireSessionId()
        var body: [String: Any] = [
            "actionType": "conversion",
            "eventId": eventId,
            "companyId": config.companyId,
            "occurredAt": occurredAt,
            "token": sid,
            "conversionName": conversionName
        ]
        if let v = value { body["value"] = v }
        try await post(path: "/v1/record", body: body)
    }
}
