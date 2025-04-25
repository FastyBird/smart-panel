// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/auth_module_req_check_email.dart';
import '../models/auth_module_req_check_username.dart';
import '../models/auth_module_req_login.dart';
import '../models/auth_module_req_refresh_token.dart';
import '../models/auth_module_req_register.dart';
import '../models/auth_module_res_check_email.dart';
import '../models/auth_module_res_check_username.dart';
import '../models/auth_module_res_login.dart';
import '../models/auth_module_res_profile.dart';
import '../models/auth_module_res_refresh.dart';
import '../models/auth_module_res_register_display.dart';

part 'auth_module_client.g.dart';

@RestApi()
abstract class AuthModuleClient {
  factory AuthModuleClient(Dio dio, {String? baseUrl}) = _AuthModuleClient;

  /// Register a new user.
  ///
  /// Endpoint to register a new user by providing username, password, and optional profile information.
  @POST('/auth-module/auth/register')
  Future<HttpResponse<void>> createAuthModuleRegister({
    @Body() AuthModuleReqRegister? body,
  });

  /// Register a display-only user.
  ///
  /// Endpoint to register a user with limited permissions, designed for display-only functionalities.
  ///
  /// [userAgent] - A string identifying the requesting device. Required for registering display-only users.
  @POST('/auth-module/auth/register-display')
  Future<HttpResponse<AuthModuleResRegisterDisplay>> createAuthModuleRegisterDisplay({
    @Header('User-Agent') required String userAgent,
  });

  /// User login.
  ///
  /// Endpoint for user login, requiring username and password to generate an authentication token.
  @POST('/auth-module/auth/login')
  Future<HttpResponse<AuthModuleResLogin>> createAuthModuleLogin({
    @Body() AuthModuleReqLogin? body,
  });

  /// Check username availability.
  ///
  /// Endpoint to check whether a given username is already in use in the system.
  @POST('/auth-module/auth/check/username')
  Future<HttpResponse<AuthModuleResCheckUsername>> validateAuthModuleCheckUsername({
    @Body() AuthModuleReqCheckUsername? body,
  });

  /// Check email availability.
  ///
  /// Endpoint to check whether a given email address is already in use in the system.
  @POST('/auth-module/auth/check/email')
  Future<HttpResponse<AuthModuleResCheckEmail>> validateAuthModuleCheckEmail({
    @Body() AuthModuleReqCheckEmail? body,
  });

  /// Retrieve authenticated user's profile.
  ///
  /// Endpoint to retrieve the profile information of the authenticated user, including username, email, and role.
  @GET('/auth-module/auth/profile')
  Future<HttpResponse<AuthModuleResProfile>> getAuthModuleProfile();

  /// Refresh user access token.
  ///
  /// Endpoint for user access token refresh, requiring refresh token to generate an authentication token.
  @POST('/auth-module/auth/refresh')
  Future<HttpResponse<AuthModuleResRefresh>> updateAuthModuleRefresh({
    @Body() AuthModuleReqRefreshToken? body,
  });
}
