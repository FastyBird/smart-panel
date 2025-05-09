// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/devices_home_assistant_plugin_res_discovered_device.dart';
import '../models/devices_home_assistant_plugin_res_discovered_devices.dart';
import '../models/devices_home_assistant_plugin_res_state.dart';
import '../models/devices_home_assistant_plugin_res_states.dart';

part 'devices_home_assistant_plugin_client.g.dart';

@RestApi()
abstract class DevicesHomeAssistantPluginClient {
  factory DevicesHomeAssistantPluginClient(Dio dio, {String? baseUrl}) = _DevicesHomeAssistantPluginClient;

  /// Retrieve a list of all available Home Assistant Devices.
  ///
  /// Retrieves a list of devices discovered from the connected Home Assistant instance. Each device includes metadata, associated entities, and their current states.
  @GET('/plugins/devices-home-assistant-plugin/discovered-devices')
  Future<HttpResponse<DevicesHomeAssistantPluginResDiscoveredDevices>> getDevicesHomeAssistantPluginDevices();

  /// Retrieve details of a specific Home Assistant Device.
  ///
  /// Fetches details of a specific Home Assistant device by its Home Assistant ID. The response includes associated entities and their current states.
  ///
  /// [id] - The ID of the Home Assisant discovered device to retrieve.
  @GET('/plugins/devices-home-assistant-plugin/discovered-devices/{id}')
  Future<HttpResponse<DevicesHomeAssistantPluginResDiscoveredDevice>> getDevicesHomeAssistantPluginDevice({
    @Path('id') required String id,
  });

  /// Retrieve a list of all available Home Assistant States.
  ///
  /// Fetches the current state information for all known entities from the connected Home Assistant instance. Each state includes metadata such as attributes and timestamps.
  @GET('/plugins/devices-home-assistant-plugin/states')
  Future<HttpResponse<DevicesHomeAssistantPluginResStates>> getDevicesHomeAssistantPluginStates();

  /// Retrieve details of a specific Home Assistant State.
  ///
  /// Fetches the current state and attributes for a single entity by its Home Assistant entity ID. This includes state value and timestamp details.
  ///
  /// [entityId] - The ID of the Home Assisant entity to retrieve state.
  @GET('/plugins/devices-home-assistant-plugin/states/{entityId}')
  Future<HttpResponse<DevicesHomeAssistantPluginResState>> getDevicesHomeAssistantPluginState({
    @Path('entityId') required String entityId,
  });
}
