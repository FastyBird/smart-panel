// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/config_module_req_update_section.dart';
import '../models/config_module_res_app.dart';
import '../models/config_module_res_section.dart';
import '../models/section.dart';

part 'configuration_module_client.g.dart';

@RestApi()
abstract class ConfigurationModuleClient {
  factory ConfigurationModuleClient(Dio dio, {String? baseUrl}) = _ConfigurationModuleClient;

  /// Retrieve full configuration.
  ///
  /// Retrieves the complete smart panel configuration, including audio, display, language, and weather settings.
  @GET('/config-module/config')
  Future<HttpResponse<ConfigModuleResApp>> getConfigModuleConfig();

  /// Retrieve specific configuration section.
  ///
  /// Retrieves a specific configuration section, such as audio, display, language, or weather.
  ///
  /// [section] - The configuration section name.
  @GET('/config-module/config/{section}')
  Future<HttpResponse<ConfigModuleResSection>> getConfigModuleConfigSection({
    @Path('section') required Section section,
  });

  /// Update specific configuration section.
  ///
  /// Updates a specific configuration section, such as audio, display, language, or weather. Only the provided fields will be modified.
  ///
  /// [section] - The configuration section name.
  @PATCH('/config-module/config/{section}')
  Future<HttpResponse<ConfigModuleResSection>> updateConfigModuleConfigSection({
    @Path('section') required Section section,
    @Body() ConfigModuleReqUpdateSection? body,
  });
}
