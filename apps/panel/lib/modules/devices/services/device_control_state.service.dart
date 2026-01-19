import 'dart:async';

import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/modules/devices/models/control_state.dart';
import 'package:fastybird_smart_panel/modules/devices/types/control_ui_state.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';

/// Function type for checking if device properties have converged to desired values.
///
/// Returns true if all properties in the group are within tolerance of desired values.
typedef DeviceConvergenceChecker = bool Function(
  String deviceId,
  List<PropertyConfig> properties,
);

/// Function type for checking if any property is locked by an active intent.
///
/// Returns true if any property in the group has an active intent lock.
typedef DeviceIntentLockChecker = bool Function(
  String deviceId,
  List<PropertyConfig> properties,
);

/// Configuration for a control group.
///
/// Defines convergence checking, settling timing, and intent lock checking
/// for a group of related properties (e.g., RGB color, single brightness).
class ControlGroupConfig {
  /// Unique identifier for this control group.
  final String id;

  /// Function to check if properties have converged to desired values.
  final DeviceConvergenceChecker? convergenceChecker;

  /// Function to check if any property is locked by an active intent.
  final DeviceIntentLockChecker? intentLockChecker;

  /// Duration to wait for device state to converge after intent completes (ms).
  final int settlingWindowMs;

  const ControlGroupConfig({
    required this.id,
    this.convergenceChecker,
    this.intentLockChecker,
    this.settlingWindowMs = 800,
  });
}

/// Service for managing optimistic UI state for device controls.
///
/// Enhanced version with support for:
/// - Single property controls (brightness, on/off) - backward compatible API
/// - Property groups (RGB color, HUE/SAT) - new group API
/// - Intent tracking via [IntentsRepository]
/// - Convergence checking
/// - 4-state machine: idle → pending → settling → idle/mixed
///
/// ## Single Property API (backward compatible)
///
/// Key format: `device:deviceId:channelId:propertyId`
///
/// ```dart
/// // When user changes brightness
/// controlStateService.setPending(deviceId, channelId, propertyId, 80.0);
///
/// // After command completes
/// controlStateService.setSettling(deviceId, channelId, propertyId);
///
/// // In build method
/// if (controlStateService.isLocked(deviceId, channelId, propertyId)) {
///   brightness = controlStateService.getDesiredValue(deviceId, channelId, propertyId);
/// }
/// ```
///
/// ## Property Group API (new)
///
/// Key format: `group:deviceId:groupId`
///
/// ```dart
/// // When user changes color (RGB)
/// controlStateService.setGroupPending(
///   deviceId,
///   'color',
///   [
///     PropertyConfig(channelId: channelId, propertyId: 'red', desiredValue: 255),
///     PropertyConfig(channelId: channelId, propertyId: 'green', desiredValue: 128),
///     PropertyConfig(channelId: channelId, propertyId: 'blue', desiredValue: 0),
///   ],
/// );
/// ```
class DeviceControlStateService extends ChangeNotifier {
  /// Optional intents repository for intent lock tracking.
  final IntentsRepository? _intentsRepository;

  /// In-memory state storage.
  /// Single property keys: "device:deviceId:channelId:propertyId"
  /// Group keys: "group:deviceId:groupId"
  final Map<String, DeviceControlState> _states = {};

  /// Control group configurations keyed by "group:deviceId:groupId".
  final Map<String, ControlGroupConfig> _configs = {};

  /// Track which groups were locked in previous update (for detecting unlocks).
  final Map<String, bool> _wasLocked = {};

  /// Default settling duration.
  static const Duration defaultSettlingDuration = Duration(milliseconds: 800);

  /// Track if disposed.
  bool _isDisposed = false;

  DeviceControlStateService({
    IntentsRepository? intentsRepository,
  }) : _intentsRepository = intentsRepository {
    // Listen to intent changes if repository is provided
    _intentsRepository?.addListener(_onIntentsChanged);
  }

  // ===========================================================================
  // SINGLE PROPERTY API (backward compatible)
  // ===========================================================================

  /// Generate state key for a single property.
  static String generateKey(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    return 'device:$deviceId:${channelId ?? '*'}:${propertyId ?? '*'}';
  }

  /// Set state to PENDING for a property.
  ///
  /// Called when user initiates a command. The UI will show [desiredValue]
  /// instead of actual device state until settling completes.
  void setPending(
    String deviceId,
    String? channelId,
    String? propertyId,
    dynamic desiredValue,
  ) {
    final key = generateKey(deviceId, channelId, propertyId);

    // Cancel any existing timer for this key
    _states[key]?.cancelTimer();

    _states[key] = DeviceControlState(
      state: DeviceControlUIState.pending,
      properties: [
        PropertyConfig(
          channelId: channelId,
          propertyId: propertyId ?? '*',
          desiredValue: desiredValue,
        ),
      ],
      createdAt: DateTime.now(),
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICE_CONTROL_STATE] Set PENDING: $key = $desiredValue',
      );
    }

    _notifyIfNotDisposed();
  }

  /// Transition state to SETTLING for a property.
  ///
  /// Called after command completes. Starts a timer that will clear
  /// the state after [duration] (default 800ms).
  void setSettling(
    String deviceId,
    String? channelId,
    String? propertyId, {
    Duration duration = defaultSettlingDuration,
  }) {
    final key = generateKey(deviceId, channelId, propertyId);
    final currentState = _states[key];

    if (currentState == null) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICE_CONTROL_STATE] setSettling called but no pending state for: $key',
        );
      }
      return;
    }

    // Cancel any existing timer
    currentState.cancelTimer();

    _states[key] = DeviceControlState(
      state: DeviceControlUIState.settling,
      properties: currentState.properties,
      settlingStartedAt: DateTime.now(),
      settlingTimer: Timer(duration, () {
        _onSettlingTimeout(key);
      }),
      createdAt: currentState.createdAt,
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICE_CONTROL_STATE] Set SETTLING: $key (${duration.inMilliseconds}ms)',
      );
    }

    _notifyIfNotDisposed();
  }

  /// Clear state for a property.
  ///
  /// Called when settling timer expires or when state should be cleared manually.
  void clear(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    final key = generateKey(deviceId, channelId, propertyId);
    _clearState(key);
  }

  /// Check if a property is currently locked (pending or settling).
  ///
  /// When locked, the UI should show the desired value instead of actual state.
  bool isLocked(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    final key = generateKey(deviceId, channelId, propertyId);
    return _states[key]?.isLocked ?? false;
  }

  /// Get the desired value for a locked property.
  ///
  /// Returns null if the property is not locked.
  dynamic getDesiredValue(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    final key = generateKey(deviceId, channelId, propertyId);
    return _states[key]?.desiredValue;
  }

  /// Get the full state for a property.
  ///
  /// Returns null if no state exists.
  DeviceControlState? getState(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    final key = generateKey(deviceId, channelId, propertyId);
    return _states[key];
  }

  /// Check if a property is in settling state.
  bool isSettling(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    final key = generateKey(deviceId, channelId, propertyId);
    return _states[key]?.isSettling ?? false;
  }

  /// Check if a property is in mixed state.
  bool isMixed(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    final key = generateKey(deviceId, channelId, propertyId);
    return _states[key]?.isMixed ?? false;
  }

  // ===========================================================================
  // PROPERTY GROUP API (new)
  // ===========================================================================

  /// Generate state key for a property group.
  static String generateGroupKey(String deviceId, String groupId) {
    return 'group:$deviceId:$groupId';
  }

  /// Register a control group configuration for a device.
  ///
  /// Call this to set up convergence checking and custom settling times.
  void registerGroupConfig(
    String deviceId,
    String groupId,
    ControlGroupConfig config,
  ) {
    final key = generateGroupKey(deviceId, groupId);
    _configs[key] = config;
    _wasLocked[key] = false;

    if (kDebugMode) {
      debugPrint(
        '[DEVICE_CONTROL_STATE] Registered group config: $key (settling: ${config.settlingWindowMs}ms)',
      );
    }
  }

  /// Unregister a control group configuration.
  void unregisterGroupConfig(String deviceId, String groupId) {
    final key = generateGroupKey(deviceId, groupId);
    _configs.remove(key);
    _wasLocked.remove(key);
    clearGroup(deviceId, groupId);
  }

  /// Set state to PENDING for a property group.
  ///
  /// Called when user initiates a command affecting multiple properties.
  void setGroupPending(
    String deviceId,
    String groupId,
    List<PropertyConfig> properties,
  ) {
    final key = generateGroupKey(deviceId, groupId);

    // Cancel any existing timer for this key
    _states[key]?.cancelTimer();

    _states[key] = DeviceControlState(
      state: DeviceControlUIState.pending,
      properties: properties,
      createdAt: DateTime.now(),
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICE_CONTROL_STATE] Set GROUP PENDING: $key with ${properties.length} properties',
      );
    }

    _notifyIfNotDisposed();
  }

  /// Start settling window for a property group.
  void setGroupSettling(String deviceId, String groupId) {
    final key = generateGroupKey(deviceId, groupId);
    final currentState = _states[key];

    if (currentState == null) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICE_CONTROL_STATE] setGroupSettling called but no state for: $key',
        );
      }
      return;
    }

    // Cancel any existing timer
    currentState.cancelTimer();

    final config = _configs[key];
    final settlingDuration = Duration(
      milliseconds:
          config?.settlingWindowMs ?? defaultSettlingDuration.inMilliseconds,
    );

    final timer = Timer(settlingDuration, () {
      _onSettlingTimeout(key);
    });

    _states[key] = DeviceControlState(
      state: DeviceControlUIState.settling,
      properties: currentState.properties,
      settlingTimer: timer,
      settlingStartedAt: DateTime.now(),
      createdAt: currentState.createdAt,
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICE_CONTROL_STATE] Set GROUP SETTLING: $key (${settlingDuration.inMilliseconds}ms)',
      );
    }

    _notifyIfNotDisposed();
  }

  /// Clear state for a property group.
  void clearGroup(String deviceId, String groupId) {
    final key = generateGroupKey(deviceId, groupId);
    _clearState(key);
  }

  /// Check if a property group is locked.
  bool isGroupLocked(String deviceId, String groupId) {
    final key = generateGroupKey(deviceId, groupId);
    return _states[key]?.isLocked ?? false;
  }

  /// Get the state for a property group.
  DeviceControlState? getGroupState(String deviceId, String groupId) {
    final key = generateGroupKey(deviceId, groupId);
    return _states[key];
  }

  /// Get desired values for a property group as a map.
  Map<String, dynamic>? getGroupDesiredValues(String deviceId, String groupId) {
    final key = generateGroupKey(deviceId, groupId);
    return _states[key]?.desiredValuesMap;
  }

  /// Get desired value for a specific property in a group.
  dynamic getGroupPropertyValue(
    String deviceId,
    String groupId,
    String? channelId,
    String propertyId,
  ) {
    final key = generateGroupKey(deviceId, groupId);
    return _states[key]?.getDesiredValueForProperty(channelId, propertyId);
  }

  /// Check for convergence and potentially transition to idle.
  ///
  /// Call this when device data changes.
  void checkGroupConvergence(String deviceId, String groupId) {
    final key = generateGroupKey(deviceId, groupId);
    final currentState = _states[key];
    final config = _configs[key];

    if (currentState == null || config?.convergenceChecker == null) return;

    // Only check convergence during settling or mixed states
    if (!currentState.isSettling && !currentState.isMixed) return;

    if (config!.convergenceChecker!(deviceId, currentState.properties)) {
      _transitionToIdle(key);
    }
  }

  /// Handle intent unlock detection for a group.
  void checkGroupIntentUnlock(String deviceId, String groupId) {
    final key = generateGroupKey(deviceId, groupId);
    final currentState = _states[key];
    final config = _configs[key];

    if (currentState == null || config?.intentLockChecker == null) return;
    if (currentState.state != DeviceControlUIState.pending) return;

    final isNowLocked =
        config!.intentLockChecker!(deviceId, currentState.properties);
    final wasLocked = _wasLocked[key] ?? false;

    _wasLocked[key] = isNowLocked;

    // Detect unlock (was locked, now not locked)
    if (wasLocked && !isNowLocked) {
      setGroupSettling(deviceId, groupId);
    }
  }

  // ===========================================================================
  // DEVICE-WIDE OPERATIONS
  // ===========================================================================

  /// Clear all states for a specific device.
  void clearForDevice(String deviceId) {
    final keysToRemove = _states.keys
        .where((key) =>
            key.startsWith('device:$deviceId:') ||
            key.startsWith('group:$deviceId:'))
        .toList();

    for (final key in keysToRemove) {
      final state = _states.remove(key);
      state?.cancelTimer();
    }

    if (keysToRemove.isNotEmpty) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICE_CONTROL_STATE] Cleared ${keysToRemove.length} states for device: $deviceId',
        );
      }

      _notifyIfNotDisposed();
    }
  }

  /// Clear all states.
  ///
  /// Called on disconnect or when all states should be reset.
  void clearAll() {
    for (final state in _states.values) {
      state.cancelTimer();
    }
    _states.clear();

    for (final key in _wasLocked.keys) {
      _wasLocked[key] = false;
    }

    if (kDebugMode) {
      debugPrint('[DEVICE_CONTROL_STATE] All states cleared');
    }

    _notifyIfNotDisposed();
  }

  /// Get the number of active states.
  int get activeCount => _states.length;

  /// Get all active state keys (for debugging).
  List<String> get activeKeys => _states.keys.toList();

  /// Check if any state is active (non-idle).
  bool get hasActiveState =>
      _states.values.any((s) => s.state != DeviceControlUIState.idle);

  // ===========================================================================
  // INTENT INTEGRATION
  // ===========================================================================

  /// Check if any property in a group is locked by an active intent.
  bool isLockedByIntent(String deviceId, List<PropertyConfig> properties) {
    if (_intentsRepository == null) return false;

    for (final prop in properties) {
      if (_intentsRepository.isPropertyLocked(
        deviceId,
        prop.channelId,
        prop.propertyId,
      )) {
        return true;
      }
    }
    return false;
  }

  /// Get overlay value from active intent for a property.
  dynamic getIntentOverlayValue(
    String deviceId,
    String? channelId,
    String propertyId,
  ) {
    if (_intentsRepository == null) return null;

    final intentId = _intentsRepository.getIntentIdForProperty(
      deviceId,
      channelId,
      propertyId,
    );
    if (intentId == null) return null;

    final intent = _intentsRepository.getIntent(intentId);
    if (intent == null) return null;

    return intent.getValueForProperty(deviceId, channelId, propertyId);
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  void _onSettlingTimeout(String key) {
    if (_isDisposed) return;

    final currentState = _states[key];
    if (currentState?.state != DeviceControlUIState.settling) return;

    // Settling window expired without convergence - transition to mixed
    _states[key] = DeviceControlState(
      state: DeviceControlUIState.mixed,
      properties: currentState!.properties,
      createdAt: currentState.createdAt,
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICE_CONTROL_STATE] Settling timeout, set MIXED: $key',
      );
    }

    _notifyIfNotDisposed();
  }

  void _transitionToIdle(String key) {
    final currentState = _states[key];
    currentState?.cancelTimer();

    _states[key] = DeviceControlState(
      state: DeviceControlUIState.idle,
      createdAt: DateTime.now(),
    );

    if (kDebugMode) {
      debugPrint('[DEVICE_CONTROL_STATE] Set IDLE: $key');
    }

    _notifyIfNotDisposed();
  }

  void _clearState(String key) {
    final state = _states.remove(key);
    if (state != null) {
      state.cancelTimer();

      if (kDebugMode) {
        debugPrint('[DEVICE_CONTROL_STATE] Cleared: $key');
      }

      _notifyIfNotDisposed();
    }
  }

  void _onIntentsChanged() {
    // Check all pending states for intent unlock (both single and group)
    // Use toList() to avoid concurrent modification
    for (final entry in _states.entries.toList()) {
      final key = entry.key;
      final state = entry.value;

      if (state.state != DeviceControlUIState.pending) continue;

      final parts = key.split(':');
      if (parts.length < 3) continue;

      final deviceId = parts[1];

      if (key.startsWith('group:')) {
        // Group key: group:deviceId:groupId
        final groupId = parts.sublist(2).join(':');
        final config = _configs[key];

        if (config?.intentLockChecker == null) {
          _checkAndTransitionToSettling(
            key,
            deviceId,
            state,
            () => setGroupSettling(deviceId, groupId),
          );
        }
      } else if (key.startsWith('device:')) {
        // Single property key: device:deviceId:channelId:propertyId
        if (parts.length < 4) continue;

        final channelId = parts[2] == '*' ? null : parts[2];
        final propertyId = parts[3] == '*' ? null : parts[3];

        _checkAndTransitionToSettling(
          key,
          deviceId,
          state,
          () => setSettling(deviceId, channelId, propertyId),
        );
      }
    }
  }

  /// Helper to check intent lock and transition to settling if unlocked.
  void _checkAndTransitionToSettling(
    String key,
    String deviceId,
    DeviceControlState state,
    void Function() transitionFn,
  ) {
    final isStillLocked = isLockedByIntent(deviceId, state.properties);
    final wasLocked = _wasLocked[key] ?? true;

    if (wasLocked && !isStillLocked) {
      // Intent completed, start settling
      _wasLocked[key] = false;

      if (kDebugMode) {
        debugPrint(
          '[DEVICE_CONTROL_STATE] Intent unlocked, starting settling: $key',
        );
      }

      transitionFn();
    } else {
      _wasLocked[key] = isStillLocked;
    }
  }

  void _notifyIfNotDisposed() {
    if (!_isDisposed) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _isDisposed = true;

    _intentsRepository?.removeListener(_onIntentsChanged);

    for (final state in _states.values) {
      state.cancelTimer();
    }
    _states.clear();

    super.dispose();
  }
}
