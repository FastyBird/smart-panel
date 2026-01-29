import 'dart:async';

import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/devices.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

class ChannelPropertiesRepository extends Repository<ChannelPropertyModel> {
  final CommandDispatchService _commandDispatch;

  ChannelsRepository? _channelsRepository;
  DevicesRepository? _devicesRepository;

  final Map<String, PropertyValueState?> _valueBackup = {};
  final Map<String, Timer> _debounceTimers = {};

  ChannelPropertiesRepository({
    required super.apiClient,
    required CommandDispatchService commandDispatch,
  }) : _commandDispatch = commandDispatch;

  /// Set the channels repository after construction to avoid circular dependency
  void setChannelsRepository(ChannelsRepository channelsRepository) {
    _channelsRepository = channelsRepository;
  }

  /// Set the devices repository after construction to avoid circular dependency
  void setDevicesRepository(DevicesRepository devicesRepository) {
    _devicesRepository = devicesRepository;
  }

  void insert(List<Map<String, dynamic>> json) {
    late Map<String, ChannelPropertyModel> insertData = {...data};

    for (var row in json) {
      if (!row.containsKey('type')) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][CHANNELS PROPERTIES] Missing required attribute: "type" for property: "${row['id']}"',
          );
        }

        continue;
      }

      try {
        ChannelPropertyModel property =
            buildChannelPropertyModel(row['type'], row);

        insertData[property.id] = property;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][CHANNELS PROPERTIES] Failed to create property model: ${e.toString()}',
          );
        }

        /// Failed to create new model
      }
    }

    if (!mapEquals(data, insertData)) {
      data = insertData;

      notifyListeners();
    }
  }

  void delete(String id) {
    if (data.containsKey(id) && data.remove(id) != null) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][CHANNELS PROPERTIES] Removed property: $id',
        );
      }

      notifyListeners();
    }
  }

  Future<bool> toggleValue(String id) async {
    final ChannelPropertyModel? property = getItem(id);

    if (property == null) {
      return false;
    }

    if (property.dataType != DevicesModuleDataType.bool) {
      debugPrint(
        '[DEVICES MODULE][CHANNEL PROPERTIES] Only boolean values could be toggled',
      );
    }

    bool newValue = false;

    if (property.value == null) {
      newValue = true;
    } else {
      newValue = !(property.value as BooleanValueType).value;
    }

    return await setValue(
      id,
      newValue,
    );
  }

  Future<bool> setValue(String id, dynamic value) async {
    ChannelPropertyModel? property = getItem(id);

    if (property == null) {
      return false;
    }

    // Check if the device is offline before proceeding
    ChannelModel? channel = _channelsRepository?.getItem(property.channel);
    if (channel != null && _devicesRepository != null) {
      final device = _devicesRepository!.getItem(channel.device);
      if (device != null && !device.isOnline) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][CHANNEL PROPERTIES] Rejecting command for property: $id - device is offline',
          );
        }
        return false;
      }
    }

    if (!_valueBackup.containsKey(id)) {
      _valueBackup[id] = property.valueState;
    }

    if (property.dataType == DevicesModuleDataType.bool) {
      try {
        property = property.copyWith(
          valueState: PropertyValueState(value: BooleanValueType(_valueToBoolean(value))),
        );
      } on ArgumentError {
        /// Clearing of backup value
        _valueBackup.remove(id);

        return false;
      }
    } else if (property.dataType == DevicesModuleDataType.char ||
        property.dataType == DevicesModuleDataType.uchar ||
        property.dataType == DevicesModuleDataType.short ||
        property.dataType == DevicesModuleDataType.ushort ||
        property.dataType == DevicesModuleDataType.int ||
        property.dataType == DevicesModuleDataType.uint ||
        property.dataType == DevicesModuleDataType.float) {
      try {
        property = property.copyWith(
          valueState: PropertyValueState(value: NumberValueType(_valueToNumber(value))),
        );
      } on ArgumentError {
        /// Clearing of backup value
        _valueBackup.remove(id);

        return false;
      }
    } else if (property.dataType == DevicesModuleDataType.string ||
        property.dataType == DevicesModuleDataType.valueEnum) {
      property = property.copyWith(
        valueState: PropertyValueState(value: StringValueType(value.toString())),
      );
    } else {
      /// Clearing of backup value
      _valueBackup.remove(id);

      return false;
    }

    replaceItem(property);

    // Reuse the channel from offline check, or fetch if not already loaded
    channel ??= _channelsRepository?.getItem(property.channel);

    if (channel != null) {
      final completer = Completer<bool>();

      // Cancel previous debounce if it exists
      _debounceTimers[id]?.cancel();

      // Start new debounce timer
      _debounceTimers[id] = Timer(const Duration(milliseconds: 300), () async {
        // Send command and wait for result
        await _sendCommandToBackend(channel!, property!, completer);

        _debounceTimers.remove(id);

        // Note: _valueBackup is cleared in _sendCommandToBackend on success,
        // or used for revert on failure. Don't clear here as ack is async.
      });

      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][CHANNEL PROPERTIES] Updated property: ${property.id} value: ${property.value?.value}',
        );
      }

      notifyListeners();

      return completer.future;
    }

    if (kDebugMode) {
      debugPrint(
        '[DEVICES MODULE][CHANNEL PROPERTIES] Failed to load property channel. Property: ${property.id} value can not be propagated to backend',
      );
    }

    _revertValue(id: id);

    /// Clearing of backup value
    _valueBackup.remove(id);

    return false;
  }

  /// Send command to backend via WebSocket with API fallback.
  ///
  /// Uses WebSocket as primary channel. If WebSocket is unavailable or fails,
  /// falls back to API call.
  Future<void> _sendCommandToBackend(
    ChannelModel channel,
    ChannelPropertyModel property,
    Completer<bool> completer,
  ) async {
    // Generate a unique request ID for tracking this command through the intent system
    final requestId = const Uuid().v4();

    final payload = {
      'request_id': requestId,
      'properties': [
        {
          'device': channel.device,
          'channel': property.channel,
          'property': property.id,
          'value': property.value?.value,
        },
      ],
    };

    try {
      // Use command dispatch with WebSocket primary and API fallback
      final result = await _commandDispatch.dispatch(
        event: DevicesModuleConstants.setPropertyEvent,
        handler: DevicesModuleEventHandlerName.setProperty,
        payload: payload,
        apiFallback: () => _setPropertyValueViaApi(
          channel.id,
          property.id,
          property.value?.value,
        ),
      );

      if (result.success) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][CHANNEL PROPERTIES] Successfully sent command via ${result.channel.name} for property: ${property.id}, requestId: $requestId',
          );
        }

        // Clear backup on success - server now has the new value
        _valueBackup.remove(property.id);

        completer.complete(true);
      } else {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][CHANNEL PROPERTIES] Failed to process command for property: ${property.id}, reason: ${result.reason}',
          );
        }

        _revertValue(id: property.id);

        // Clear backup after revert
        _valueBackup.remove(property.id);

        completer.complete(false);
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][CHANNEL PROPERTIES] Exception sending command for property: ${property.id}: $e',
        );
      }

      _revertValue(id: property.id);
      _valueBackup.remove(property.id);

      completer.complete(false);
    }
  }

  /// Set property value via API (used as fallback when WebSocket is unavailable)
  ///
  /// Note: Device property updates are primarily handled via WebSocket.
  /// The REST API for individual property updates is not currently available,
  /// so this fallback returns null to indicate the operation should fail gracefully.
  Future<Map<String, dynamic>?> _setPropertyValueViaApi(
    String channelId,
    String propertyId,
    dynamic value,
  ) async {
    // REST API for property updates is not available - WebSocket is the only channel
    // Return null to indicate fallback is not available
    if (kDebugMode) {
      debugPrint(
        '[DEVICES MODULE][CHANNEL PROPERTIES] API fallback not available for property updates',
      );
    }
    return null;
  }

  /// Set multiple property values in a single command
  ///
  /// This creates a single intent on the backend for all properties.
  /// Uses WebSocket as primary channel with API fallback for each property
  /// when WebSocket is unavailable.
  Future<bool> setMultipleValues({
    required List<PropertyCommandItem> properties,
    PropertyCommandContext? context,
  }) async {
    if (properties.isEmpty) {
      return true;
    }

    // Check if any target device is offline before proceeding
    if (_devicesRepository != null) {
      for (final prop in properties) {
        final device = _devicesRepository!.getItem(prop.deviceId);
        if (device != null && !device.isOnline) {
          if (kDebugMode) {
            debugPrint(
              '[DEVICES MODULE][CHANNEL PROPERTIES] Rejecting batch command - device ${prop.deviceId} is offline',
            );
          }
          return false;
        }
      }
    }

    try {
      // Generate single request ID for tracking
      final requestId = const Uuid().v4();

      // Build properties payload
      final propertiesPayload = properties.map((prop) => prop.toJson()).toList();

      // Build context payload if provided
      Map<String, dynamic>? contextPayload;
      if (context != null) {
        contextPayload = context.toJson();
      }

      // Build command payload
      final payload = <String, dynamic>{
        'request_id': requestId,
        'properties': propertiesPayload,
      };
      if (contextPayload != null && contextPayload.isNotEmpty) {
        payload['context'] = contextPayload;
      }

      // Use command dispatch with WebSocket primary and API fallback
      final result = await _commandDispatch.dispatch(
        event: DevicesModuleConstants.setPropertyEvent,
        handler: DevicesModuleEventHandlerName.setProperty,
        payload: payload,
        apiFallback: () => _setMultiplePropertiesViaApi(properties),
      );

      if (result.success) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][CHANNEL PROPERTIES] Successfully sent batch command via ${result.channel.name} for ${properties.length} properties, requestId: $requestId',
          );
        }
        return true;
      } else {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][CHANNEL PROPERTIES] Failed batch command for ${properties.length} properties, reason: ${result.reason}',
          );
        }
        return false;
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][CHANNEL PROPERTIES] Exception in batch command: ${e.toString()}',
        );
      }
      return false;
    }
  }

  /// Set multiple properties via API (used as fallback when WebSocket is unavailable)
  ///
  /// Note: Device property updates are primarily handled via WebSocket.
  /// The REST API for batch property updates is not currently available,
  /// so this fallback returns null to indicate the operation should fail gracefully.
  Future<Map<String, dynamic>?> _setMultiplePropertiesViaApi(
    List<PropertyCommandItem> properties,
  ) async {
    try {
      bool allSuccess = true;

      for (final prop in properties) {
        final result = await _setPropertyValueViaApi(
          prop.channelId,
          prop.propertyId,
          prop.value,
        );

        if (result == null) {
          allSuccess = false;
          if (kDebugMode) {
            debugPrint(
              '[DEVICES MODULE][CHANNEL PROPERTIES] API fallback failed for property: ${prop.propertyId}',
            );
          }
        }
      }

      // Return a result map to indicate success/failure
      return allSuccess ? {'success': true} : null;
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][CHANNEL PROPERTIES] API batch fallback error: $e',
        );
      }
      return null;
    }
  }

  void _revertValue({required String id}) {
    ChannelPropertyModel? property = getItem(id);

    if (property != null) {
      replaceItem(
        property.copyWith(
          valueState: _valueBackup[property.id],
          clearValue: _valueBackup[property.id] == null,
        ),
      );

      notifyListeners();
    }
  }

  bool _valueToBoolean(dynamic value) {
    if (value is bool) {
      return value;
    }

    if (value is String) {
      return value.toLowerCase() == 'true' || value == '1';
    }

    if (value is num) {
      return value != 0;
    }

    throw ArgumentError('Cannot convert value to boolean: $value');
  }

  num _valueToNumber(dynamic value) {
    if (value is num) {
      return value;
    }

    if (value is String) {
      final parsedValue = num.tryParse(value);

      if (parsedValue != null) {
        return parsedValue;
      }
    }

    throw ArgumentError('Cannot convert value to number: $value');
  }

  Future<void> fetchOne(
    String channelId,
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleChannelProperty(
          channelId: channelId,
          id: id,
        );

        final raw = response.response.data['data'] as Map<String, dynamic>;

        insert([raw]);
      },
      'fetch channel property',
    );
  }

  Future<void> fetchAll(
    String channelId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleChannelProperties(
          channelId: channelId,
        );

        final raw = response.response.data['data'] as List;

        insert(raw.cast<Map<String, dynamic>>());
      },
      'fetch channel properties',
    );
  }
}
