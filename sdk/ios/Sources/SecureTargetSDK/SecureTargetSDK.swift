import Foundation
#if canImport(UIKit)
import UIKit
import AdSupport
import AppTrackingTransparency
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

public struct SecureTargetUtmParams: Encodable {
    public var source: String?
    public var medium: String?
    public var campaign: String?
    public var term: String?
    public var content: String?
}

public struct SecureTargetDeviceDetails: Encodable {
    public let platform = "ios"
    public var osVersion: String?
    public var model: String?
    public var locale: String?
    public var timezone: String?
    public var appVersion: String?
    public var sdkVersion: String?
    public var advertisingId: String?
    public var vendorId: String?
    public var installReferrer: String?
    public var deepLinkUrl: String?
    public var utm: SecureTargetUtmParams?

    public init(
        osVersion: String? = nil,
        model: String? = nil,
        locale: String? = nil,
        timezone: String? = nil,
        appVersion: String? = nil,
        sdkVersion: String? = "0.3.0",
        advertisingId: String? = nil,
        vendorId: String? = nil,
        installReferrer: String? = nil,
        deepLinkUrl: String? = nil,
        utm: SecureTargetUtmParams? = nil
    ) {
        self.osVersion = osVersion
        self.model = model
        self.locale = locale
        self.timezone = timezone
        self.appVersion = appVersion
        self.sdkVersion = sdkVersion
        self.advertisingId = advertisingId
        self.vendorId = vendorId
        self.installReferrer = installReferrer
        self.deepLinkUrl = deepLinkUrl
        self.utm = utm
    }

    public static func captureDefault(deepLinkUrl: String? = nil) -> SecureTargetDeviceDetails {
        let tz = TimeZone.current.identifier
        let loc = Locale.current.identifier
        var vendorId: String?
        var advertisingId: String?
        #if canImport(UIKit)
        vendorId = UIDevice.current.identifierForVendor?.uuidString
        if #available(iOS 14, *) {
            if ATTrackingManager.trackingAuthorizationStatus == .authorized {
                advertisingId = ASIdentifierManager.shared().advertisingIdentifier.uuidString
            }
        } else {
            if ASIdentifierManager.shared().isAdvertisingTrackingEnabled {
                advertisingId = ASIdentifierManager.shared().advertisingIdentifier.uuidString
            }
        }
        let os = "\(UIDevice.current.systemName) \(UIDevice.current.systemVersion)"
        return SecureTargetDeviceDetails(
            osVersion: os,
            model: UIDevice.current.model,
            locale: loc,
            timezone: tz,
            vendorId: vendorId,
            advertisingId: advertisingId,
            deepLinkUrl: deepLinkUrl
        )
        #else
        return SecureTargetDeviceDetails(locale: loc, timezone: tz, deepLinkUrl: deepLinkUrl)
        #endif
    }
}

public struct InstallAttributionResult: Decodable {
    public let attributed: Bool
    public let isOrganic: Bool
    public let confidence: Double
    public let mediaSource: String?
    public let campaignId: String?
    public let adgroupId: String?
    public let creativeId: String?
    public let clickId: String?
    public let deepLinkValue: String?
    public let ruleName: String?
}

private struct BootstrapBody: Encodable {
    let occurredAt: String
    let device: SecureTargetDeviceDetails
}

private struct BootstrapResponse: Decodable {
    let sessionId: String
}

private struct IngestResponse: Decodable {
    let attribution: InstallAttributionResult?
}

public enum SecureTargetError: Error {
    case missingSession
    case http(Int, String)
    case decode
}

public final class SecureTargetSDK {
    private let config: SecureTargetConfig
    private let storageKey = "securetarget_session_id"
    private let firstOpenKey = "securetarget_first_open_sent"
    private let clickIdKey = "securetarget_click_id"
    private var sessionId: String?
    private var storedClickId: String?
    private var installCallbacks: [(InstallAttributionResult) -> Void] = []
    private let urlSession: URLSession

    public init(config: SecureTargetConfig, urlSession: URLSession = .shared) {
        self.config = config
        self.urlSession = urlSession
        if let s = UserDefaults.standard.string(forKey: storageKey) {
            self.sessionId = s
        }
        self.storedClickId = UserDefaults.standard.string(forKey: clickIdKey)
    }

    @available(*, deprecated, message: "Record token is the bootstrap sessionId; this method has no effect.")
    public func setLoginToken(_ token: String) {}

    public func clearSession() {
        sessionId = nil
        storedClickId = nil
        UserDefaults.standard.removeObject(forKey: storageKey)
        UserDefaults.standard.removeObject(forKey: firstOpenKey)
        UserDefaults.standard.removeObject(forKey: clickIdKey)
    }

    public func onInstallAttribution(_ callback: @escaping (InstallAttributionResult) -> Void) {
        installCallbacks.append(callback)
    }

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

        if !UserDefaults.standard.bool(forKey: firstOpenKey) {
            _ = try await trackInstall(eventId: UUID().uuidString, occurredAt: ISO8601DateFormatter().string(from: Date()))
            UserDefaults.standard.set(true, forKey: firstOpenKey)
        }
    }

    public func handleDeepLink(url: URL) async throws {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let clickId = components?.queryItems?.first(where: { $0.name == "st_click_id" })?.value
        if let clickId {
            storedClickId = clickId
            UserDefaults.standard.set(clickId, forKey: clickIdKey)
        }
        let mediaSource = components?.queryItems?.first(where: { $0.name == "pid" })?.value
        let campaignId = components?.queryItems?.first(where: { $0.name == "c" })?.value
        let adgroupId = components?.queryItems?.first(where: { $0.name == "adset" || $0.name == "af_adset" })?.value
        let creativeId = components?.queryItems?.first(where: { $0.name == "ad" || $0.name == "af_ad" })?.value
        try await trackRecord(
            eventId: UUID().uuidString,
            occurredAt: ISO8601DateFormatter().string(from: Date()),
            mediaSource: mediaSource,
            campaignId: campaignId,
            adgroupId: adgroupId,
            creativeId: creativeId,
            deepLinkUrl: url.absoluteString
        )
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

    private func post(path: String, body: [String: Any]) async throws -> Data {
        try await bootstrapSession()
        guard sessionId != nil else { throw SecureTargetError.missingSession }
        let url = config.endpoint.appendingPathComponent(path)
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        jsonHeaders().forEach { req.setValue($0.value, forHTTPHeaderField: $0.key) }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, res) = try await urlSession.data(for: req)
        guard let http = res as? HTTPURLResponse, (200 ... 299).contains(http.statusCode) else {
            throw SecureTargetError.http(-1, path)
        }
        return data
    }

    public func trackRecord(
        eventId: String,
        occurredAt: String,
        mediaSource: String? = nil,
        campaignId: String? = nil,
        adgroupId: String? = nil,
        creativeId: String? = nil,
        deepLinkUrl: String? = nil
    ) async throws {
        let sid = try await requireSessionId()
        var body: [String: Any] = [
            "actionType": "record",
            "eventId": eventId,
            "companyId": config.companyId,
            "occurredAt": occurredAt,
            "token": sid
        ]
        if let v = mediaSource { body["mediaSource"] = v }
        if let v = campaignId { body["campaignId"] = v }
        if let v = adgroupId { body["adgroupId"] = v }
        if let v = creativeId { body["creativeId"] = v }
        if let v = deepLinkUrl { body["landingUrl"] = v }
        _ = try await post(path: "/v1/record", body: body)
    }

    public func trackInstall(
        eventId: String,
        occurredAt: String,
        installReferrer: String? = nil,
        deepLinkUrl: String? = nil,
        clickId: String? = nil
    ) async throws -> InstallAttributionResult {
        let sid = try await requireSessionId()
        var body: [String: Any] = [
            "actionType": "install",
            "eventId": eventId,
            "companyId": config.companyId,
            "occurredAt": occurredAt,
            "token": sid
        ]
        if let v = installReferrer { body["installReferrer"] = v }
        if let v = deepLinkUrl { body["deepLinkUrl"] = v }
        if let v = clickId ?? storedClickId { body["clickId"] = v }
        let data = try await post(path: "/v1/record", body: body)
        let decoded = try? JSONDecoder().decode(IngestResponse.self, from: data)
        let result = decoded?.attribution ?? InstallAttributionResult(
            attributed: false, isOrganic: true, confidence: 0,
            mediaSource: nil, campaignId: nil, adgroupId: nil, creativeId: nil,
            clickId: nil, deepLinkValue: nil, ruleName: nil
        )
        installCallbacks.forEach { $0(result) }
        return result
    }

    public func trackLogin(eventId: String, occurredAt: String) async throws {
        let sid = try await requireSessionId()
        let body: [String: Any] = [
            "actionType": "login",
            "eventId": eventId,
            "companyId": config.companyId,
            "occurredAt": occurredAt,
            "token": sid
        ]
        _ = try await post(path: "/v1/record", body: body)
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
        _ = try await post(path: "/v1/record", body: body)
    }
}
