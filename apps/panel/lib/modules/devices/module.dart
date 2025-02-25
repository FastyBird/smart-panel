import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/api/devices_module/devices_module_client.dart';
import 'package:fastybird_smart_panel/api/models/devices_res_devices_data_union.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_controls.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/device_controls.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/devices.dart';
import 'package:flutter/foundation.dart';

class DevicesModuleService {
  final DevicesModuleClient _apiClient;

  late DevicesRepository _devicesRepository;
  late DeviceControlsRepository _deviceControlsRepository;
  late ChannelsRepository _channelsRepository;
  late ChannelControlsRepository _channelControlsRepository;
  late ChannelPropertiesRepository _channelPropertiesRepository;

  bool _isLoading = true;

  DevicesModuleService({
    required ApiClient apiClient,
  }) : _apiClient = apiClient.devicesModule {
    _devicesRepository = DevicesRepository(
      apiClient: apiClient.devicesModule,
    );
    _deviceControlsRepository = DeviceControlsRepository(
      apiClient: apiClient.devicesModule,
    );
    _channelsRepository = ChannelsRepository(
      apiClient: apiClient.devicesModule,
    );
    _channelControlsRepository = ChannelControlsRepository(
      apiClient: apiClient.devicesModule,
    );
    _channelPropertiesRepository = ChannelPropertiesRepository(
      apiClient: apiClient.devicesModule,
    );

    locator.registerSingleton(_devicesRepository);
    locator.registerSingleton(_deviceControlsRepository);

    locator.registerSingleton(_channelsRepository);
    locator.registerSingleton(_channelControlsRepository);
    locator.registerSingleton(_channelPropertiesRepository);
  }

  Future<void> initialize() async {
    _isLoading = true;

    await _initializeDevices();

    _isLoading = false;
  }

  bool get isLoading => _isLoading;

  Future<void> _initializeDevices() async {
    var apiDevices = await _fetchDevices();

    List<Map<String, dynamic>> devices = [];

    for (var device in apiDevices) {
      devices.add(jsonDecode(jsonEncode(device)));
    }

    _devicesRepository.insertDevices(devices);

    for (var apiDevice in apiDevices) {
      List<Map<String, dynamic>> deviceControls = [];

      for (var control in apiDevice.controls) {
        deviceControls.add(jsonDecode(jsonEncode(control)));
      }

      _deviceControlsRepository.insertControls(deviceControls);

      List<Map<String, dynamic>> channels = [];

      for (var channel in apiDevice.channels) {
        channels.add(jsonDecode(jsonEncode(channel)));
      }

      _channelsRepository.insertChannels(channels);

      for (var apiChannel in apiDevice.channels) {
        List<Map<String, dynamic>> channelControls = [];

        for (var control in apiChannel.controls) {
          channelControls.add(jsonDecode(jsonEncode(control)));
        }

        _channelControlsRepository.insertControls(channelControls);

        List<Map<String, dynamic>> properties = [];

        for (var property in apiChannel.properties) {
          properties.add(jsonDecode(jsonEncode(property)));
        }

        _channelPropertiesRepository.insertProperties(properties);
      }
    }
  }

  /// ////////////
  /// API HANDLERS
  /// ////////////

  Future<List<DevicesResDevicesDataUnion>> _fetchDevices() async {
    return _handleApiCall(
      () async {
        final response = await _apiClient.getDevicesModuleDevices();

        return response.data.data;
      },
      'fetch devices',
    );
  }

  Future<T> _handleApiCall<T>(
    Future<T> Function() apiCall,
    String operation,
  ) async {
    try {
      return await apiCall();
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][${operation.toUpperCase()}] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to $operation: ${e.response?.statusCode}');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][${operation.toUpperCase()}] Unexpected error: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
  }
}
