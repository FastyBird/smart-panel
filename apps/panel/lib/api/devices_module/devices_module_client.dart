// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/devices_create_channel_control.dart';
import '../models/devices_create_channel_property.dart';
import '../models/devices_req_create_channel.dart';
import '../models/devices_req_create_channel_control.dart';
import '../models/devices_req_create_channel_property.dart';
import '../models/devices_req_create_device.dart';
import '../models/devices_req_create_device_channel.dart';
import '../models/devices_req_create_device_control.dart';
import '../models/devices_req_update_channel.dart';
import '../models/devices_req_update_channel_property.dart';
import '../models/devices_req_update_device.dart';
import '../models/devices_res_channel.dart';
import '../models/devices_res_channel_control.dart';
import '../models/devices_res_channel_controls.dart';
import '../models/devices_res_channel_properties.dart';
import '../models/devices_res_channel_property.dart';
import '../models/devices_res_channels.dart';
import '../models/devices_res_device.dart';
import '../models/devices_res_device_channel.dart';
import '../models/devices_res_device_channels.dart';
import '../models/devices_res_device_control.dart';
import '../models/devices_res_device_controls.dart';
import '../models/devices_res_devices.dart';
import '../models/devices_third_party_device_properties_update_request.dart';
import '../models/devices_update_channel_property.dart';

part 'devices_module_client.g.dart';

@RestApi()
abstract class DevicesModuleClient {
  factory DevicesModuleClient(Dio dio, {String? baseUrl}) = _DevicesModuleClient;

  /// Retrieve a list of available devices.
  ///
  /// Fetches a list of all devices currently registered in the system. Each device includes its metadata (e.g., ID, name, and category), along with associated channels, controls, and properties.
  @GET('/devices-module/devices')
  Future<HttpResponse<DevicesResDevices>> getDevicesModuleDevices();

  /// Create a new device.
  ///
  /// Creates a new device resource in the system. The request requires device-specific attributes such as category and name. The response includes the full representation of the created device, including its associated channels, controls, and properties. Additionally, a Location header is provided with the URI of the newly created resource.
  @POST('/devices-module/devices')
  Future<HttpResponse<DevicesResDevice>> createDevicesModuleDevice({
    @Body() DevicesReqCreateDevice? body,
  });

  /// Retrieve details of a specific device.
  ///
  /// Fetches the details of a specific device using its unique ID. The response includes the device’s metadata (e.g., ID, name, and category), associated channels, controls, and properties.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/devices-module/devices/{id}')
  Future<HttpResponse<DevicesResDevice>> getDevicesModuleDevice({
    @Path('id') required String id,
  });

  /// Update an existing device.
  ///
  /// Partially updates the attributes of an existing device identified by its unique ID. The update can modify metadata, such as the device’s name, category, or description, without requiring the full object.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/devices-module/devices/{id}')
  Future<HttpResponse<DevicesResDevice>> updateDevicesModuleDevice({
    @Path('id') required String id,
    @Body() DevicesReqUpdateDevice? body,
  });

  /// Delete an existing device.
  ///
  /// Deletes a specific device identified by its unique ID from the system. This action is irreversible and will remove the device and its associated data from the system.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/devices-module/devices/{id}')
  Future<HttpResponse<void>> deleteDevicesModuleDevice({
    @Path('id') required String id,
  });

  /// Retrieve a list of all available device controls.
  ///
  /// Fetches a list of controls associated with a specific device. Controls represent actions that can be performed on the device, such as reboot or calibration.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  @GET('/devices-module/devices/{deviceId}/controls')
  Future<HttpResponse<DevicesResDeviceControls>> getDevicesModuleDeviceControls({
    @Path('deviceId') required String deviceId,
  });

  /// Create a new control for a device.
  ///
  /// Creates a new control associated with a specific device. Controls represent actions or commands that can be executed on the device, such as reboot or factory reset.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  @POST('/devices-module/devices/{deviceId}/controls')
  Future<HttpResponse<DevicesResDeviceControl>> createDevicesModuleDeviceControl({
    @Path('deviceId') required String deviceId,
    @Body() DevicesReqCreateDeviceControl? body,
  });

  /// Retrieve details of a specific control for a device.
  ///
  /// Fetches detailed information about a specific control associated with a device using its unique ID. The response includes metadata such as the control’s name, ID, associated device, and timestamps.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/devices-module/devices/{deviceId}/controls/{id}')
  Future<HttpResponse<DevicesResDeviceControl>> getDevicesModuleDeviceControl({
    @Path('deviceId') required String deviceId,
    @Path('id') required String id,
  });

  /// Delete an existing control for a device.
  ///
  /// Deletes a specific control associated with a device using its unique ID. This action is irreversible and removes the control from the system.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/devices-module/devices/{deviceId}/controls/{id}')
  Future<HttpResponse<void>> deleteDevicesModuleDeviceControl({
    @Path('deviceId') required String deviceId,
    @Path('id') required String id,
  });

  /// Retrieve a list of all available channels for a device.
  ///
  /// Fetches a list of channels associated with a specific device. Each channel includes metadata (e.g., ID, name, category), associated controls, and properties.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  @GET('/devices-module/devices/{deviceId}/channels')
  Future<HttpResponse<DevicesResDeviceChannels>> getDevicesModuleDeviceChannels({
    @Path('deviceId') required String deviceId,
  });

  /// Create a new channel for a device.
  ///
  /// Creates a new channel associated with a specific device. The channel can have attributes such as name, category, description, and optionally controls and properties.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  @POST('/devices-module/devices/{deviceId}/channels')
  Future<HttpResponse<DevicesResDeviceChannel>> createDevicesModuleDeviceChannel({
    @Path('deviceId') required String deviceId,
    @Body() DevicesReqCreateDeviceChannel? body,
  });

  /// Retrieve details of a specific channel for a device.
  ///
  /// Fetches detailed information about a specific channel associated with a device using its unique ID. The response includes metadata, category, associated controls, and properties for the channel.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/devices-module/devices/{deviceId}/channels/{id}')
  Future<HttpResponse<DevicesResDeviceChannel>> getDevicesModuleDeviceChannel({
    @Path('deviceId') required String deviceId,
    @Path('id') required String id,
  });

  /// Update an existing channel for a device.
  ///
  /// Partially updates the attributes of a specific channel associated with a device using its unique ID. The update can modify metadata, such as the channel’s name, category, or description, without requiring the full object.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/devices-module/devices/{deviceId}/channels/{id}')
  Future<HttpResponse<DevicesResDeviceChannel>> updateDevicesModuleDeviceChannel({
    @Path('deviceId') required String deviceId,
    @Path('id') required String id,
    @Body() DevicesReqUpdateChannel? body,
  });

  /// Delete a specific channel for a device.
  ///
  /// Deletes a specific channel associated with a device using its unique ID. This action is irreversible and will remove the channel and its associated data from the system.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/devices-module/devices/{deviceId}/channels/{id}')
  Future<HttpResponse<void>> deleteDevicesModuleDeviceChannel({
    @Path('deviceId') required String deviceId,
    @Path('id') required String id,
  });

  /// Retrieve a list of all available controls for a device’s channel.
  ///
  /// Fetches a list of controls associated with a specific channel of a device. Controls represent actions or commands that can be executed on the channel, such as reset or calibration.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  @GET('/devices-module/devices/{deviceId}/channels/{channelId}/controls')
  Future<HttpResponse<DevicesResChannelControls>> getDevicesModuleDeviceChannelControls({
    @Path('deviceId') required String deviceId,
    @Path('channelId') required String channelId,
  });

  /// Create a new control for a specific device’s channel.
  ///
  /// Creates a new control associated with a specific device channel. Controls represent actions or commands that can be executed on the channel, such as reset or calibration.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  @POST('/devices-module/devices/{deviceId}/channels/{channelId}/controls')
  Future<HttpResponse<DevicesResChannelControl>> createDevicesModuleDeviceChannelControl({
    @Path('deviceId') required String deviceId,
    @Path('channelId') required String channelId,
    @Body() DevicesReqCreateChannelControl? body,
  });

  /// Retrieve details of a specific control for a device’s channel.
  ///
  /// Fetches detailed information about a specific control associated with a device channel using its unique ID. The response includes metadata such as the control’s name, ID, associated channel, and timestamps.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/devices-module/devices/{deviceId}/channels/{channelId}/controls/{id}')
  Future<HttpResponse<DevicesResChannelControl>> getDevicesModuleDeviceChannelControl({
    @Path('deviceId') required String deviceId,
    @Path('channelId') required String channelId,
    @Path('id') required String id,
  });

  /// Delete a specific control from a device’s channel.
  ///
  /// Deletes a specific control associated with a device channel using its unique ID. This action is irreversible and removes the control from the system.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/devices-module/devices/{deviceId}/channels/{channelId}/controls/{id}')
  Future<HttpResponse<void>> deleteDevicesModuleDeviceChannelControl({
    @Path('deviceId') required String deviceId,
    @Path('channelId') required String channelId,
    @Path('id') required String id,
  });

  /// Retrieve a list of all available properties for a device’s channel.
  ///
  /// Fetches a list of properties associated with a specific channel of a device. Properties represent attributes or measurements related to the channel, such as thermostat mode, temperature, or humidity.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  @GET('/devices-module/devices/{deviceId}/channels/{channelId}/properties')
  Future<HttpResponse<DevicesResChannelProperties>> getDevicesModuleDeviceChannelProperties({
    @Path('deviceId') required String deviceId,
    @Path('channelId') required String channelId,
  });

  /// Create a new property for a specific device’s channel.
  ///
  /// Creates a new property for a specific device channel. The property can include metadata such as category, permissions, data type, unit, and initial value. The response contains the full representation of the created property, including its unique identifier, associated channel, and metadata.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  @POST('/devices-module/devices/{deviceId}/channels/{channelId}/properties')
  Future<HttpResponse<DevicesResChannelProperty>> createDevicesModuleDeviceChannelProperty({
    @Path('deviceId') required String deviceId,
    @Path('channelId') required String channelId,
    @Body() DevicesReqCreateChannelProperty? body,
  });

  /// Retrieve details of a specific property for a device’s channel.
  ///
  /// Fetches detailed information about a specific property associated with a device channel using its unique ID. The response includes metadata such as the property’s name, category, value, and associated channel.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/devices-module/devices/{deviceId}/channels/{channelId}/properties/{id}')
  Future<HttpResponse<DevicesResChannelProperty>> getDevicesModuleDeviceChannelProperty({
    @Path('deviceId') required String deviceId,
    @Path('channelId') required String channelId,
    @Path('id') required String id,
  });

  /// Update and existing property for a specific device’s channel.
  ///
  /// Partially updates the details of a specific property associated with a device channel. This operation allows modifications to attributes such as the property’s name, value, or metadata, while preserving its unique identifier and association with the channel.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/devices-module/devices/{deviceId}/channels/{channelId}/properties/{id}')
  Future<HttpResponse<DevicesResChannelProperty>> updateDevicesModuleDeviceChannelProperty({
    @Path('deviceId') required String deviceId,
    @Path('channelId') required String channelId,
    @Path('id') required String id,
    @Body() DevicesReqUpdateChannelProperty? body,
  });

  /// Delete a specific property from a device’s channel.
  ///
  /// Deletes a specific property associated with a device channel using its unique ID. This operation is irreversible and removes the property from the system.
  ///
  /// [deviceId] - The ID of the device to retrieve.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/devices-module/devices/{deviceId}/channels/{channelId}/properties/{id}')
  Future<HttpResponse<void>> deleteDevicesModuleDeviceChannelProperty({
    @Path('deviceId') required String deviceId,
    @Path('channelId') required String channelId,
    @Path('id') required String id,
  });

  /// Retrieve a list of available channels.
  ///
  /// Fetches a list of channels in the system. The response includes metadata for each channel, such as its ID, name, category, associated device, controls, and properties.
  @GET('/devices-module/channels')
  Future<HttpResponse<DevicesResChannels>> getDevicesModuleChannels();

  /// Create a new channel.
  ///
  /// Creates a new channel in the system. The channel can have attributes such as name, category, description, and an associated device. Optionally, controls and properties can also be defined during creation.
  @POST('/devices-module/channels')
  Future<HttpResponse<DevicesResChannel>> createDevicesModuleChannel({
    @Body() DevicesReqCreateChannel? body,
  });

  /// Retrieve details of a specific channel.
  ///
  /// Fetches detailed information about a specific channel using its unique ID. The response includes metadata, associated device information, controls, and properties for the channel.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/devices-module/channels/{id}')
  Future<HttpResponse<DevicesResChannel>> getDevicesModuleChannel({
    @Path('id') required String id,
  });

  /// Update an existing channel.
  ///
  /// Partially updates the attributes of a specific channel using its unique ID. This allows modifications to properties such as the channel’s name, category, description, or associated controls and properties.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/devices-module/channels/{id}')
  Future<HttpResponse<DevicesResChannel>> updateDevicesModuleChannel({
    @Path('id') required String id,
    @Body() DevicesReqUpdateChannel? body,
  });

  /// Delete an existing channel.
  ///
  /// Deletes a specific channel using its unique ID. This action is irreversible and removes the channel and all associated data from the system.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/devices-module/channels/{id}')
  Future<HttpResponse<void>> deleteDevicesModuleChannel({
    @Path('id') required String id,
  });

  /// Retrieve a list of all available channel controls.
  ///
  /// Fetches a list of all controls available for channels in the system. Each control represents an actionable operation associated with a channel. The response includes details such as the control’s ID, name, associated channel, and timestamps.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  @GET('/devices-module/channels/{channelId}/controls')
  Future<HttpResponse<DevicesResChannelControls>> getDevicesModuleChannelControls({
    @Path('channelId') required String channelId,
  });

  /// Create a new control for a channel.
  ///
  /// Allows the creation of a new control for a specific channel. A control represents an actionable operation or command associated with the channel. The response includes the complete details of the newly created control, including its ID, name, associated channel, and metadata.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  @POST('/devices-module/channels/{channelId}/controls')
  Future<HttpResponse<DevicesResChannelControl>> createDevicesModuleChannelControl({
    @Path('channelId') required String channelId,
    @Body() DevicesCreateChannelControl? body,
  });

  /// Retrieve details of a specific control for a channel.
  ///
  /// Fetches the details of a specific control associated with a channel. The response includes the control’s unique identifier, name, associated channel, and metadata such as creation and update timestamps.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/devices-module/channels/{channelId}/controls/{id}')
  Future<HttpResponse<DevicesResChannelControl>> getDevicesModuleChannelControl({
    @Path('channelId') required String channelId,
    @Path('id') required String id,
  });

  /// Delete an existing control for a channel.
  ///
  /// Deletes an existing control associated with a specific channel. This operation is irreversible and will remove the control permanently from the system.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/devices-module/channels/{channelId}/controls/{id}')
  Future<HttpResponse<void>> deleteDevicesModuleChannelControl({
    @Path('channelId') required String channelId,
    @Path('id') required String id,
  });

  /// Retrieve a list of all available channel properties.
  ///
  /// Fetches all properties associated with a specific channel. The response includes metadata for each property, such as category, name, permissions, data type, unit, and current value, along with the associated channel’s unique identifier.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  @GET('/devices-module/channels/{channelId}/properties')
  Future<HttpResponse<DevicesResChannelProperties>> getDevicesModuleChannelProperties({
    @Path('channelId') required String channelId,
  });

  /// Create a new property for a channel.
  ///
  /// Creates a new property for a channel, such as thermostat mode or brightness level. The property includes metadata like category, permissions, data type, unit, and initial value. The response provides the full representation of the created property along with a Location header containing the URI for the new property resource.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  @POST('/devices-module/channels/{channelId}/properties')
  Future<HttpResponse<DevicesResChannelProperty>> createDevicesModuleChannelProperty({
    @Path('channelId') required String channelId,
    @Body() DevicesCreateChannelProperty? body,
  });

  /// Retrieve details of a specific property for a channel.
  ///
  /// Fetches detailed information about a specific property associated with a channel. The response includes metadata such as the property’s unique ID, category, permissions, data type, unit, and current value, along with timestamps and the associated channel’s identifier.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/devices-module/channels/{channelId}/properties/{id}')
  Future<HttpResponse<DevicesResChannelProperty>> getDevicesModuleChannelProperty({
    @Path('channelId') required String channelId,
    @Path('id') required String id,
  });

  /// Update an existing property for a channel.
  ///
  /// Allows partial updates to an existing property associated with a channel. You can update specific attributes such as the name, category, permissions, data type, unit, or current value. The response includes the updated representation of the property.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/devices-module/channels/{channelId}/properties/{id}')
  Future<HttpResponse<DevicesResChannelProperty>> updateDevicesModuleChannelProperty({
    @Path('channelId') required String channelId,
    @Path('id') required String id,
    @Body() DevicesUpdateChannelProperty? body,
  });

  /// Delete an existing property for a channel.
  ///
  /// Deletes an existing property associated with a channel. This operation is irreversible and permanently removes the property from the system.
  ///
  /// [channelId] - The ID of the channel to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/devices-module/channels/{channelId}/properties/{id}')
  Future<HttpResponse<void>> deleteDevicesModuleChannelProperty({
    @Path('channelId') required String channelId,
    @Path('id') required String id,
  });

  /// Send command to third-party device.
  ///
  /// This endpoint is used to send property update commands to a third-party device. The backend calls this webhook with one or more property updates. The third-party device should process the updates and return a status response.
  ///
  /// **The actual webhook path must be defined on the third-party device level**, and the backend must be configured accordingly to call the correct endpoint.
  @PUT('/third-party/webhook')
  Future<HttpResponse<void>> putThirdPartyWebhook({
    @Body() DevicesThirdPartyDevicePropertiesUpdateRequest? body,
  });
}
