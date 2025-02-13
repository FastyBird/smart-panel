// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/weather_res_geolocation_city_to_coordinates.dart';
import '../models/weather_res_geolocation_coordinates_to_city.dart';
import '../models/weather_res_location_weather.dart';

part 'weather_module_client.g.dart';

@RestApi()
abstract class WeatherModuleClient {
  factory WeatherModuleClient(Dio dio, {String? baseUrl}) = _WeatherModuleClient;

  /// Retrieve current weather conditions.
  ///
  /// Fetches real-time weather data, including temperature, humidity, wind speed, and other meteorological details for a specified location.
  @GET('/weather-module/weather')
  Future<HttpResponse<WeatherResLocationWeather>> getWeatherModuleWeather();

  /// Convert city name to geographical coordinates.
  ///
  /// Retrieves latitude and longitude based on a given city name. Useful for mapping and location-based services.
  ///
  /// [city] - The name of the city for which geographical coordinates are requested.
  @GET('/weather-module/geolocation/city-to-coordinates')
  Future<HttpResponse<WeatherResGeolocationCityToCoordinates>> getWeatherModuleGeolocation({
    @Query('city') required String city,
  });

  /// Convert coordinates to city name.
  ///
  /// Returns the city name based on provided latitude and longitude values. Useful for reverse geocoding applications.
  ///
  /// [lat] - Latitude of the location for reverse geocoding.
  ///
  /// [lon] - Longitude of the location for reverse geocoding.
  @GET('/weather-module/geolocation/coordinates-to-city')
  Future<HttpResponse<WeatherResGeolocationCoordinatesToCity>> getWeatherModuleGeolocationCoordinatesToCity({
    @Query('lat') required double lat,
    @Query('lon') required double lon,
  });
}
