// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/system_res_system_info.dart';
import '../models/system_res_throttle_status.dart';

part 'system_module_client.g.dart';

@RestApi()
abstract class SystemModuleClient {
  factory SystemModuleClient(Dio dio, {String? baseUrl}) = _SystemModuleClient;

  /// Retrieve system information.
  ///
  /// Fetches detailed system information, including CPU load, memory usage, storage details, temperature readings, OS version, network statistics, and display settings.
  @GET('/system-module/system/info')
  Future<HttpResponse<SystemResSystemInfo>> getSystemModuleSystemInfo();

  /// Retrieve system throttling status.
  ///
  /// Checks the system’s throttling status to determine if any CPU, power, or thermal restrictions have been applied.
  @GET('/system-module/system/throttle')
  Future<HttpResponse<SystemResThrottleStatus>> getSystemModuleSystemThrottle();
}
