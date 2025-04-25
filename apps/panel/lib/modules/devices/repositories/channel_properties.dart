import 'dart:async';

import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/devices/types/data_types.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:flutter/foundation.dart';

class ChannelPropertiesRepository extends Repository<ChannelPropertyModel> {
  final SocketService _socketService;

  final ChannelsRepository _channelsRepository;

  final Map<String, ValueType?> _valueBackup = {};

  ChannelPropertiesRepository({
    required super.apiClient,
    required SocketService socketService,
    required ChannelsRepository channelsRepository,
  })  : _socketService = socketService,
        _channelsRepository = channelsRepository;

  void insert(List<Map<String, dynamic>> json) {
    late Map<String, ChannelPropertyModel> insertData = {...data};

    for (var row in json) {
      try {
        ChannelPropertyModel property = ChannelPropertyModel.fromJson(row);

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

    if (property.dataType != DataType.boolean) {
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

    if (property.dataType == DataType.boolean) {
      try {
        property = property.copyWith(
          value: BooleanValueType(_valueToBoolean(value)),
        );
      } on ArgumentError {
        /// Clearing of backup value
        _valueBackup.remove(id);

        return false;
      }
    } else if (property.dataType == DataType.char ||
        property.dataType == DataType.uchar ||
        property.dataType == DataType.short ||
        property.dataType == DataType.ushort ||
        property.dataType == DataType.int ||
        property.dataType == DataType.uint ||
        property.dataType == DataType.float) {
      try {
        property = property.copyWith(
          value: NumberValueType(_valueToNumber(value)),
        );
      } on ArgumentError {
        /// Clearing of backup value
        _valueBackup.remove(id);

        return false;
      }
    } else if (property.dataType == DataType.string ||
        property.dataType == DataType.enumerate) {
      property = property.copyWith(
        value: StringValueType(value.toString()),
      );
    } else {
      /// Clearing of backup value
      _valueBackup.remove(id);

      return false;
    }

    replaceItem(property);

    ChannelModel? channel = _channelsRepository.getItem(property.channel);

    if (channel != null) {
      final completer = Completer<bool>();

      await _socketService.sendEvent(
        DevicesModuleConstants.channelPropertySetEvent,
        {
          'properties': [
            {
              'device': channel.device,
              'channel': property.channel,
              'property': property.id,
              'value': property.value?.value,
            },
          ],
        },
        onAck: (SocketCommandAckModel? response) {
          bool isSuccess = _handleCommandResponse(
            id: id,
            response: response,
          );

          completer.complete(isSuccess);
        },
      );

      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][CHANNEL PROPERTIES] Updated property: ${property.id} value: ${property.value?.value}',
        );
      }

      notifyListeners();

      /// Clearing of backup value
      _valueBackup.remove(id);

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

  bool _handleCommandResponse({
    required String id,
    required SocketCommandAckModel? response,
  }) {
    bool cmdResult = false;

    if (response != null && response.status == 'ok') {
      for (var result in response.results) {
        if (result.handler == DevicesModuleConstants.setPropertyHandlerName) {
          /// Failed to set prop state
          if (result.success == false) {
            if (kDebugMode) {
              debugPrint(
                '[DEVICES MODULE][CHANNEL PROPERTIES] Failed process command by backend for property: $id, reason: ${result.reason}',
              );
            }

            _revertValue(id: id);

            return false;
          } else {
            if (kDebugMode) {
              debugPrint(
                '[DEVICES MODULE][CHANNEL PROPERTIES] Successfully send command to backend for property: $id',
              );
            }

            cmdResult = true;
          }
        }
      }
    } else {
      if (response != null && kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][CHANNEL PROPERTIES] Failed process command by backend for property: $id, reason: ${response.message}',
        );
      }

      _revertValue(id: id);

      return false;
    }

    return cmdResult;
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

  Future<void> fetchProperty(
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

  Future<void> fetchProperties(
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
