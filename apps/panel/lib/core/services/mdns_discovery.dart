import 'dart:async';
import 'dart:io';

import 'package:bonsoir/bonsoir.dart';
import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/core/models/discovered_backend.dart';

/// Service for discovering FastyBird Smart Panel backends via mDNS
class MdnsDiscoveryService {
  /// Default service type for FastyBird Smart Panel backends
  static const String defaultServiceType = '_fastybird-panel._tcp';

  /// Default discovery timeout in milliseconds
  static const int defaultDiscoveryTimeoutMs = 10000;

  BonsoirDiscovery? _discovery;
  StreamSubscription<BonsoirDiscoveryEvent>? _subscription;
  final List<DiscoveredBackend> _discoveredBackends = [];

  /// Services found but not yet resolved — used for fallback resolution.
  final Map<String, BonsoirService> _pendingServices = {};
  final Map<String, Timer> _resolutionTimers = {};

  /// Check if mDNS discovery is supported on this platform
  bool get isSupported {
    // Bonsoir supports Android, iOS, macOS, Windows, Linux
    return Platform.isAndroid ||
        Platform.isIOS ||
        Platform.isMacOS ||
        Platform.isWindows ||
        Platform.isLinux;
  }

  /// Check if mDNS discovery is enabled (always enabled if platform supports it)
  bool get isEnabled => isSupported;

  /// Get discovery timeout duration
  Duration get timeout => const Duration(milliseconds: defaultDiscoveryTimeoutMs);

  /// Get list of currently discovered backends
  List<DiscoveredBackend> get discoveredBackends =>
      List.unmodifiable(_discoveredBackends);

  /// Get fallback backend from environment variables (for dev mode)
  DiscoveredBackend? _getFallbackBackend() {
    final bool isAndroidEmulator = Platform.isAndroid && !kReleaseMode;

    const String appHost = String.fromEnvironment(
      'FB_APP_HOST',
      defaultValue: '',
    );
    const String backendPort = String.fromEnvironment(
      'FB_BACKEND_PORT',
      defaultValue: '3000',
    );

    if (appHost.isNotEmpty) {
      // Parse the appHost to extract protocol and hostname
      // appHost may include protocol (e.g., "http://localhost" or "https://192.168.1.100")
      String hostname;
      bool isSecure = false;

      if (isAndroidEmulator) {
        // For Android emulator, use the special IP
        hostname = '10.0.2.2';
      } else {
        // Parse URL to extract hostname and protocol
        // appHost may be:
        // - Full URL: "http://localhost" or "https://192.168.1.100"
        // - Just hostname: "localhost" or "192.168.1.100"
        final uri = Uri.tryParse(appHost);
        if (uri != null && uri.hasScheme) {
          // URL has a protocol scheme (http:// or https://)
          hostname = uri.host.isNotEmpty ? uri.host : uri.authority.split(':').first;
          isSecure = uri.scheme == 'https';
        } else {
          // No protocol scheme, assume it's just a hostname/IP
          // Remove any trailing slashes or paths
          hostname = appHost.split('/').first.split(':').first;
        }
      }

      final int port = int.tryParse(backendPort) ?? 3000;

      if (kDebugMode) {
        debugPrint(
          '[MDNS DISCOVERY] Using fallback backend from environment: $hostname:$port (secure: $isSecure)',
        );
      }

      return DiscoveredBackend(
        name: 'FastyBird Smart Panel (Dev)',
        host: hostname,
        port: port,
        apiPath: '/api/v1',
        version: null,
        isSecure: isSecure,
      );
    }

    return null;
  }

  /// Start mDNS discovery and return discovered backends
  ///
  /// [onBackendFound] - Optional callback called when a new backend is found
  /// [timeoutDuration] - Optional timeout duration (defaults to environment config)
  ///
  /// Returns a list of discovered backends after timeout or manual stop
  Future<List<DiscoveredBackend>> discover({
    void Function(DiscoveredBackend)? onBackendFound,
    Duration? timeoutDuration,
  }) async {
    // Stop any ongoing discovery before starting a new one
    // This prevents memory leaks and interference from previous discovery sessions
    await stop();

    if (!isEnabled) {
      if (kDebugMode) {
        debugPrint(
          '[MDNS DISCOVERY] mDNS discovery is not supported on this platform',
        );
      }
      // If mDNS is not supported, try fallback backend (dev mode)
      final fallbackBackend = _getFallbackBackend();
      if (fallbackBackend != null) {
        if (kDebugMode) {
          debugPrint(
            '[MDNS DISCOVERY] Using fallback backend (mDNS not supported)',
          );
        }
        _discoveredBackends.clear();
        _discoveredBackends.add(fallbackBackend);
        onBackendFound?.call(fallbackBackend);
        return [fallbackBackend];
      }
      return [];
    }

    // Clear previous results
    _discoveredBackends.clear();

    try {
      if (kDebugMode) {
        debugPrint('[MDNS DISCOVERY] Starting mDNS discovery...');
      }

      // Create discovery instance
      _discovery = BonsoirDiscovery(type: defaultServiceType);

      // Start discovery
      await _discovery!.ready;

      // Listen for discovery events
      _subscription = _discovery!.eventStream?.listen((event) {
        if (event.type == BonsoirDiscoveryEventType.discoveryServiceFound) {
          final service = event.service;
          if (kDebugMode) {
            debugPrint(
              '[MDNS DISCOVERY] Service found: ${service?.name}',
            );
          }

          // Track the service and start a fallback timer.
          // If resolution doesn't complete within 3 seconds, try to use
          // the service with default values. Some Android devices fail TXT
          // record resolution but the service host/port are still available.
          if (service != null) {
            _pendingServices[service.name] = service;
            _resolutionTimers[service.name]?.cancel();
            _resolutionTimers[service.name] = Timer(
              const Duration(seconds: 3),
              () => _handleUnresolvedService(service, onBackendFound),
            );
          }
        } else if (event.type ==
            BonsoirDiscoveryEventType.discoveryServiceResolved) {
          final service = event.service;
          if (service != null && service is ResolvedBonsoirService) {
            // Cancel fallback timer — service resolved normally
            _resolutionTimers.remove(service.name)?.cancel();
            _pendingServices.remove(service.name);

            final backend = _parseService(service);
            if (backend != null && !_discoveredBackends.contains(backend)) {
              _discoveredBackends.add(backend);

              if (kDebugMode) {
                debugPrint(
                  '[MDNS DISCOVERY] Backend resolved: ${backend.name} at ${backend.displayAddress}',
                );
              }

              onBackendFound?.call(backend);
            }
          }
        } else if (event.type ==
            BonsoirDiscoveryEventType.discoveryServiceLost) {
          if (kDebugMode) {
            debugPrint(
              '[MDNS DISCOVERY] Service lost: ${event.service?.name}',
            );
          }
          final name = event.service?.name;
          if (name != null) {
            _resolutionTimers.remove(name)?.cancel();
            _pendingServices.remove(name);
          }
          _discoveredBackends.removeWhere(
            (b) => b.name == event.service?.name,
          );
        }
      });

      // Start the discovery
      await _discovery!.start();

      // Wait for timeout
      final effectiveTimeout = timeoutDuration ?? timeout;

      await Future.delayed(effectiveTimeout);

      // Stop discovery
      await stop();

      if (kDebugMode) {
        debugPrint(
          '[MDNS DISCOVERY] Discovery completed. Found ${_discoveredBackends.length} backend(s)',
        );
      }

      // If no backends found, try fallback
      if (_discoveredBackends.isEmpty) {
        final fallback = _getFallbackBackend();
        if (fallback != null) {
          if (kDebugMode) {
            debugPrint(
              '[MDNS DISCOVERY] No backends found via mDNS, using fallback backend',
            );
          }
          _discoveredBackends.add(fallback);
          onBackendFound?.call(fallback);
        }
      }

      return _discoveredBackends;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[MDNS DISCOVERY] Error during discovery: $e');
      }
      await stop();

      // If discovery failed, try fallback
      final fallback = _getFallbackBackend();
      if (fallback != null) {
        if (kDebugMode) {
          debugPrint(
            '[MDNS DISCOVERY] Discovery failed, using fallback backend',
          );
        }
        return [fallback];
      }

      return [];
    }
  }

  /// Stop ongoing mDNS discovery
  Future<void> stop() async {
    try {
      await _subscription?.cancel();
      _subscription = null;

      await _discovery?.stop();
      _discovery = null;

      // Clean up fallback timers
      for (final timer in _resolutionTimers.values) {
        timer.cancel();
      }
      _resolutionTimers.clear();
      _pendingServices.clear();

      if (kDebugMode) {
        debugPrint('[MDNS DISCOVERY] Discovery stopped');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[MDNS DISCOVERY] Error stopping discovery: $e');
      }
    }
  }

  /// Fallback handler for services that were found but not resolved within
  /// the timeout. Attempts to use the service's IP/port with default TXT
  /// record values. This handles Android devices where TXT record resolution
  /// fails but the service host is still available from the initial discovery.
  Future<void> _handleUnresolvedService(
    BonsoirService service,
    void Function(DiscoveredBackend)? onBackendFound,
  ) async {
    _pendingServices.remove(service.name);
    _resolutionTimers.remove(service.name);

    // Check if already resolved normally
    if (_discoveredBackends.any((b) => b.name == service.name)) {
      return;
    }

    // Try multiple strategies to get the host:
    // 1. From the service attributes (some platforms set this)
    // 2. From the service object if partially resolved
    // 3. Extract hostname from service name and do DNS lookup
    String? host = service.attributes['host'] ??
        (service is ResolvedBonsoirService ? service.host : null);
    int port = service.port > 0 ? service.port : 3000;

    // Strategy 3: Extract hostname from service name pattern
    // "FastyBird Smart Panel (smart-panel-server)" → "smart-panel-server.local"
    if (host == null || host.isEmpty) {
      final match = RegExp(r'\(([^)]+)\)').firstMatch(service.name);
      if (match != null) {
        final hostname = match.group(1)!;
        try {
          final addresses = await InternetAddress.lookup('$hostname.local');
          if (addresses.isNotEmpty) {
            host = addresses.first.address;

            if (kDebugMode) {
              debugPrint(
                '[MDNS DISCOVERY] Resolved "$hostname.local" to $host via DNS lookup',
              );
            }
          }
        } catch (e) {
          if (kDebugMode) {
            debugPrint(
              '[MDNS DISCOVERY] DNS lookup for "$hostname.local" failed: $e',
            );
          }
        }
      }
    }

    if (host != null && host.isNotEmpty) {
      final backend = DiscoveredBackend(
        name: service.name,
        host: host.endsWith('.') ? host.substring(0, host.length - 1) : host,
        port: port,
        apiPath: '/api/v1',
        version: null,
        isSecure: false,
      );

      if (!_discoveredBackends.contains(backend)) {
        _discoveredBackends.add(backend);

        if (kDebugMode) {
          debugPrint(
            '[MDNS DISCOVERY] Backend added via fallback (TXT resolution failed): '
            '${backend.name} at ${backend.displayAddress}',
          );
        }

        onBackendFound?.call(backend);
      }
    } else {
      if (kDebugMode) {
        debugPrint(
          '[MDNS DISCOVERY] Service "${service.name}" found but no host available for fallback',
        );
      }
    }
  }

  /// Parse a resolved Bonsoir service into a DiscoveredBackend
  DiscoveredBackend? _parseService(ResolvedBonsoirService service) {
    try {
      // Get host from service (prefer IP address)
      String? host = service.host;

      if (host == null || host.isEmpty) {
        if (kDebugMode) {
          debugPrint(
            '[MDNS DISCOVERY] Service ${service.name} has no host, skipping',
          );
        }
        return null;
      }

      // Remove trailing dot from hostname if present
      if (host.endsWith('.')) {
        host = host.substring(0, host.length - 1);
      }

      final port = service.port;
      final attributes = service.attributes;

      // Parse TXT records
      final apiPath = attributes['api'];
      final version = attributes['version'];
      final secure = attributes['secure']?.toLowerCase() == 'true';

      return DiscoveredBackend(
        name: service.name,
        host: host,
        port: port,
        apiPath: apiPath,
        version: version,
        isSecure: secure,
      );
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[MDNS DISCOVERY] Error parsing service ${service.name}: $e',
        );
      }
      return null;
    }
  }

  /// Dispose resources
  ///
  /// Immediately cancels subscriptions and nullifies references to prevent
  /// callbacks, then performs async cleanup. Uses unawaited() to signal
  /// intentional fire-and-forget pattern since dispose() must be synchronous.
  void dispose() {
    // Store references before nullifying to allow async cleanup
    final subscription = _subscription;
    final discovery = _discovery;

    // Immediately nullify to prevent further callbacks and operations
    _subscription = null;
    _discovery = null;

    // Perform async cleanup in background (fire-and-forget)
    // Using unawaited() to signal intentionality
    unawaited(_performAsyncCleanup(subscription, discovery));
  }

  /// Perform asynchronous cleanup operations
  Future<void> _performAsyncCleanup(
    StreamSubscription<BonsoirDiscoveryEvent>? subscription,
    BonsoirDiscovery? discovery,
  ) async {
    try {
      // Cancel subscription if it exists
      await subscription?.cancel();

      // Stop discovery if it exists
      await discovery?.stop();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[MDNS DISCOVERY] Error during async cleanup: $e');
      }
    }
  }
}
