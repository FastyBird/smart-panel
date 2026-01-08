import 'dart:async';

import 'package:flutter/foundation.dart';

/// Cache entry for role control state.
///
/// Stores user-set values for a specific role (space + domain + role key).
/// Used to maintain UI stability when devices are temporarily out of sync.
class RoleCacheEntry {
  /// On/off state (null = not set by user)
  final bool? isOn;

  /// Brightness percentage (0-100, null = not set by user)
  final double? brightness;

  /// Hue value (0-360, null = not set by user)
  final double? hue;

  /// Color temperature in Kelvin (null = not set by user)
  final double? temperature;

  /// White channel value (0-255, null = not set by user)
  final double? white;

  /// Timestamp when this entry was created/last updated
  final DateTime timestamp;

  /// TTL duration for this entry
  final Duration ttl;

  const RoleCacheEntry({
    this.isOn,
    this.brightness,
    this.hue,
    this.temperature,
    this.white,
    required this.timestamp,
    this.ttl = const Duration(minutes: 30),
  });

  /// Check if this entry has expired
  bool get isExpired => DateTime.now().difference(timestamp) > ttl;

  /// Check if this entry has any cached values
  bool get hasValues =>
      isOn != null ||
      brightness != null ||
      hue != null ||
      temperature != null ||
      white != null;

  /// Create a copy with updated values
  RoleCacheEntry copyWith({
    bool? isOn,
    double? brightness,
    double? hue,
    double? temperature,
    double? white,
    DateTime? timestamp,
    Duration? ttl,
    bool clearIsOn = false,
    bool clearBrightness = false,
    bool clearHue = false,
    bool clearTemperature = false,
    bool clearWhite = false,
  }) {
    return RoleCacheEntry(
      isOn: clearIsOn ? null : (isOn ?? this.isOn),
      brightness: clearBrightness ? null : (brightness ?? this.brightness),
      hue: clearHue ? null : (hue ?? this.hue),
      temperature: clearTemperature ? null : (temperature ?? this.temperature),
      white: clearWhite ? null : (white ?? this.white),
      timestamp: timestamp ?? DateTime.now(),
      ttl: ttl ?? this.ttl,
    );
  }

  @override
  String toString() =>
      'RoleCacheEntry(isOn: $isOn, brightness: $brightness, hue: $hue, temp: $temperature, white: $white, age: ${DateTime.now().difference(timestamp).inSeconds}s)';
}

/// Repository for caching role control state.
///
/// Provides ephemeral in-memory storage for user-set values in lighting roles.
/// This prevents UI jitter when devices are temporarily out of sync after commands.
///
/// Key format: `room:<spaceId>:lighting:<roleKey>`
///
/// Usage:
/// - When user sets a value, call `set()` to cache it
/// - When displaying UI, call `get()` to retrieve cached value
/// - When devices are fully synced, call `updateFromSync()` to update cache
/// - Cache entries automatically expire after TTL (default 30 minutes)
class RoleControlStateRepository extends ChangeNotifier {
  /// In-memory cache storage
  final Map<String, RoleCacheEntry> _cache = {};

  /// Default TTL for cache entries
  static const Duration defaultTtl = Duration(minutes: 30);

  /// Maximum number of cache entries to prevent unbounded growth
  static const int maxCacheSize = 100;

  /// Periodic cleanup timer for expired entries
  Timer? _cleanupTimer;

  /// Track if disposed
  bool _isDisposed = false;

  /// Generate cache key from components
  static String generateKey(String spaceId, String domain, String roleKey) {
    return 'room:$spaceId:$domain:$roleKey';
  }

  /// Get cached entry for a role.
  ///
  /// Returns null if:
  /// - No entry exists for this key
  /// - Entry has expired (and removes it)
  RoleCacheEntry? get(String key) {
    final entry = _cache[key];

    if (entry == null) {
      return null;
    }

    // Check TTL expiration
    if (entry.isExpired) {
      _cache.remove(key);
      if (kDebugMode) {
        debugPrint('[ROLE_CACHE] Entry expired and removed: $key');
      }
      return null;
    }

    return entry;
  }

  /// Start periodic cleanup of expired entries
  /// Called automatically when repository is first used
  void _startPeriodicCleanup() {
    if (_cleanupTimer != null || _isDisposed) return;

    // Clean up expired entries every 5 minutes
    _cleanupTimer = Timer.periodic(const Duration(minutes: 5), (_) {
      if (_isDisposed) {
        _cleanupTimer?.cancel();
        _cleanupTimer = null;
        return;
      }
      cleanupExpired();
    });
  }

  /// Get cached entry using components
  RoleCacheEntry? getByComponents(String spaceId, String domain, String roleKey) {
    return get(generateKey(spaceId, domain, roleKey));
  }

  /// Set partial state for a role.
  ///
  /// Only updates the provided values, preserving other cached values.
  /// Resets the timestamp on each update.
  /// Evicts oldest entries if cache exceeds maxCacheSize.
  void set(
    String key, {
    bool? isOn,
    double? brightness,
    double? hue,
    double? temperature,
    double? white,
  }) {
    // Start periodic cleanup on first use
    _startPeriodicCleanup();

    final existing = _cache[key];

    if (existing != null) {
      // Update existing entry
      _cache[key] = existing.copyWith(
        isOn: isOn,
        brightness: brightness,
        hue: hue,
        temperature: temperature,
        white: white,
        timestamp: DateTime.now(),
      );
    } else {
      // Evict oldest entries if cache is at capacity before adding new entry
      _evictIfNeeded();

      // Create new entry
      _cache[key] = RoleCacheEntry(
        isOn: isOn,
        brightness: brightness,
        hue: hue,
        temperature: temperature,
        white: white,
        timestamp: DateTime.now(),
      );
    }

    if (kDebugMode) {
      debugPrint('[ROLE_CACHE] Set: $key -> ${_cache[key]}');
    }

    if (!_isDisposed) {
      notifyListeners();
    }
  }

  /// Evict oldest entries if cache exceeds max size (LRU eviction)
  void _evictIfNeeded() {
    if (_cache.length < maxCacheSize) return;

    // Sort entries by timestamp (oldest first)
    final sortedEntries = _cache.entries.toList()
      ..sort((a, b) => a.value.timestamp.compareTo(b.value.timestamp));

    // Remove oldest 10% of entries to avoid frequent eviction
    final entriesToRemove = (maxCacheSize * 0.1).ceil();
    for (var i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
      _cache.remove(sortedEntries[i].key);
      if (kDebugMode) {
        debugPrint('[ROLE_CACHE] Evicted oldest entry: ${sortedEntries[i].key}');
      }
    }
  }

  /// Set partial state using components
  void setByComponents(
    String spaceId,
    String domain,
    String roleKey, {
    bool? isOn,
    double? brightness,
    double? hue,
    double? temperature,
    double? white,
  }) {
    set(
      generateKey(spaceId, domain, roleKey),
      isOn: isOn,
      brightness: brightness,
      hue: hue,
      temperature: temperature,
      white: white,
    );
  }

  /// Update cache when devices are fully synced.
  ///
  /// Called when all devices in a role have converged to the same values.
  /// Updates the cache with the confirmed synced values.
  void updateFromSync(
    String key, {
    bool? isOn,
    double? brightness,
    double? hue,
    double? temperature,
    double? white,
  }) {
    // Only update if we have an existing entry (user has interacted)
    // or if we have synced values to store
    final hasValues = isOn != null ||
        brightness != null ||
        hue != null ||
        temperature != null ||
        white != null;

    if (!hasValues) return;

    _cache[key] = RoleCacheEntry(
      isOn: isOn,
      brightness: brightness,
      hue: hue,
      temperature: temperature,
      white: white,
      timestamp: DateTime.now(),
    );

    if (kDebugMode) {
      debugPrint('[ROLE_CACHE] Updated from sync: $key -> ${_cache[key]}');
    }

    if (!_isDisposed) {
      notifyListeners();
    }
  }

  /// Update cache from sync using components
  void updateFromSyncByComponents(
    String spaceId,
    String domain,
    String roleKey, {
    bool? isOn,
    double? brightness,
    double? hue,
    double? temperature,
    double? white,
  }) {
    updateFromSync(
      generateKey(spaceId, domain, roleKey),
      isOn: isOn,
      brightness: brightness,
      hue: hue,
      temperature: temperature,
      white: white,
    );
  }

  /// Clear cache entry for a role
  void clear(String key) {
    if (_cache.remove(key) != null) {
      if (kDebugMode) {
        debugPrint('[ROLE_CACHE] Cleared: $key');
      }
      if (!_isDisposed) {
        notifyListeners();
      }
    }
  }

  /// Clear cache entry using components
  void clearByComponents(String spaceId, String domain, String roleKey) {
    clear(generateKey(spaceId, domain, roleKey));
  }

  /// Clear all cached entries
  void clearAll() {
    _cache.clear();
    if (kDebugMode) {
      debugPrint('[ROLE_CACHE] All entries cleared');
    }
    if (!_isDisposed) {
      notifyListeners();
    }
  }

  /// Remove all expired entries
  void cleanupExpired() {
    final expiredKeys = <String>[];

    for (final entry in _cache.entries) {
      if (entry.value.isExpired) {
        expiredKeys.add(entry.key);
      }
    }

    for (final key in expiredKeys) {
      _cache.remove(key);
    }

    if (expiredKeys.isNotEmpty && kDebugMode) {
      debugPrint('[ROLE_CACHE] Cleaned up ${expiredKeys.length} expired entries');
    }
  }

  /// Check if a cached entry exists and is valid
  bool hasValidEntry(String key) {
    return get(key) != null;
  }

  /// Check if a cached entry exists using components
  bool hasValidEntryByComponents(String spaceId, String domain, String roleKey) {
    return hasValidEntry(generateKey(spaceId, domain, roleKey));
  }

  /// Get the number of cached entries
  int get length => _cache.length;

  @override
  void dispose() {
    _isDisposed = true;
    _cleanupTimer?.cancel();
    _cleanupTimer = null;
    _cache.clear();
    super.dispose();
  }
}
