import 'dart:async';

import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

class ChannelPropertiesRepository extends Repository<ChannelPropertyModel> {
  final SocketService _socketService;

  ChannelsRepository? _channelsRepository;

  final Map<String, ValueType?> _valueBackup = {};
  final Map<String, Timer> _debounceTimers = {};

  ChannelPropertiesRepository({
    required super.apiClient,
    required SocketService socketService,
  }) : _socketService = socketService;

  /// Set the channels repository after construction to avoid circular dependency
  void setChannelsRepository(ChannelsRepository channelsRepository) {
    _channelsRepository = channelsRepository;
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

    if (!_valueBackup.containsKey(id)) {
      _valueBackup[id] = property.value;
    }

    if (property.dataType == DevicesModuleDataType.bool) {
      try {
        property = property.copyWith(
          value: BooleanValueType(_valueToBoolean(value)),
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
          value: NumberValueType(_valueToNumber(value)),
        );
      } on ArgumentError {
        /// Clearing of backup value
        _valueBackup.remove(id);

        return false;
      }
    } else if (property.dataType == DevicesModuleDataType.string ||
        property.dataType == DevicesModuleDataType.valueEnum) {
      property = property.copyWith(
        value: StringValueType(value.toString()),
      );
    } else {
      /// Clearing of backup value
      _valueBackup.remove(id);

      return false;
    }

    replaceItem(property);

    ChannelModel? channel = _channelsRepository?.getItem(property.channel);

    if (channel != null) {
      final completer = Completer<bool>();

      // Cancel previous debounce if it exists
      _debounceTimers[id]?.cancel();

      // Start new debounce timer
      _debounceTimers[id] = Timer(const Duration(milliseconds: 300), () async {
        await _sendCommandToBackend(channel, property!, completer);

        _debounceTimers.remove(id);

        /// Clearing of backup value
        _valueBackup.remove(id);
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

  Future<void> _sendCommandToBackend(
    ChannelModel channel,
    ChannelPropertyModel property,
    Completer<bool> completer,
  ) async {
    // Generate a unique request ID for tracking this command through the intent system
    final requestId = const Uuid().v4();

    await _socketService.sendCommand(
      DevicesModuleConstants.channelPropertySetEvent,
      {
        'request_id': requestId,
        'properties': [
          {
            'device': channel.device,
            'channel': property.channel,
            'property': property.id,
            'value': property.value?.value,
          },
        ],
      },
      DevicesModuleEventHandlerName.internalSetProperty,
      onAck: (SocketCommandResponseModel? response) {
        if (response == null || response.status == false) {
          if (kDebugMode) {
            debugPrint(
              '[DEVICES MODULE][CHANNEL PROPERTIES] Failed process command by backend for property: ${property.id}, reason: ${response?.message ?? 'N/A'}',
            );
          }

          _revertValue(id: property.id);

          completer.complete(false);
        } else {
          if (kDebugMode) {
            debugPrint(
              '[DEVICES MODULE][CHANNEL PROPERTIES] Successfully send command to backend for property: ${property.id}, requestId: $requestId',
            );
          }

          completer.complete(true);
        }
      },
    );
  }

  void _revertValue({required String id}) {
    ChannelPropertyModel? property = getItem(id);

    if (property != null) {
      replaceItem(
        property.copyWith(
          value: _valueBackup[property.id],
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
