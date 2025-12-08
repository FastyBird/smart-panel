import 'dart:async';
import 'dart:io';

import 'package:bonsoir/bonsoir.dart';
import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/core/models/discovered_backend.dart';

/// Service for discovering FastyBird Smart Panel backends via mDNS
class MdnsDiscoveryService {
  /// Default service type for FastyBird Smart Panel backends
  static const String defaultServiceType = '_fastybird-panel._tcp';

  /// Default discovery timeout in seconds
  static const int defaultTimeoutSeconds = 10;

  /// mDNS discovery enabled flag from environment
  static const bool _discoveryEnabled = bool.fromEnvironment(
    'FB_MDNS_DISCOVERY_ENABLED',
    defaultValue: true,
  );

  /// Discovery timeout from environment (in milliseconds)
  static const int _discoveryTimeoutMs = int.fromEnvironment(
    'FB_MDNS_DISCOVERY_TIMEOUT',
    defaultValue: 10000,
  );

  BonsoirDiscovery? _discovery;
  StreamSubscription<BonsoirDiscoveryEvent>? _subscription;
  final List<DiscoveredBackend> _discoveredBackends = [];

  /// Check if mDNS discovery is supported on this platform
  bool get isSupported {
    // Bonsoir supports Android, iOS, macOS, Windows, Linux
    return Platform.isAndroid ||
        Platform.isIOS ||
        Platform.isMacOS ||
        Platform.isWindows ||
        Platform.isLinux;
  }

  /// Check if mDNS discovery is enabled
  bool get isEnabled => _discoveryEnabled && isSupported;

  /// Get discovery timeout duration
  Duration get timeout => Duration(milliseconds: _discoveryTimeoutMs);

  /// Get list of currently discovered backends
  List<DiscoveredBackend> get discoveredBackends =>
      List.unmodifiable(_discoveredBackends);

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
    if (!isEnabled) {
      if (kDebugMode) {
        debugPrint(
          '[MDNS DISCOVERY] mDNS discovery is disabled or not supported on this platform',
        );
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
      final completer = Completer<List<DiscoveredBackend>>();

      _subscription = _discovery!.eventStream?.listen((event) {
        if (event.type == BonsoirDiscoveryEventType.discoveryServiceFound) {
          if (kDebugMode) {
            debugPrint(
              '[MDNS DISCOVERY] Service found: ${event.service?.name}',
            );
          }
        } else if (event.type ==
            BonsoirDiscoveryEventType.discoveryServiceResolved) {
          final service = event.service;
          if (service != null && service is ResolvedBonsoirService) {
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
          // Optionally remove lost services
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

      if (!completer.isCompleted) {
        completer.complete(_discoveredBackends);
      }

      return _discoveredBackends;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[MDNS DISCOVERY] Error during discovery: $e');
      }
      await stop();
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

      if (kDebugMode) {
        debugPrint('[MDNS DISCOVERY] Discovery stopped');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[MDNS DISCOVERY] Error stopping discovery: $e');
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
