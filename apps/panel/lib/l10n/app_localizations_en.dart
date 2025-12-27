import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get value_not_available => 'N/A';

  @override
  String get value_not_set => 'Not Set';

  @override
  String get value_loading => 'Loading';

  @override
  String get information => 'Information';

  @override
  String get warning => 'Warning';

  @override
  String get error => 'Error';

  @override
  String get action_failed => 'Action could not be processed';

  @override
  String get button_ok => 'Ok';

  @override
  String get button_cancel => 'Cancel';

  @override
  String get button_close => 'Close';

  @override
  String get button_confirm => 'Confirm';

  @override
  String get unit_celsius => 'Celsius';

  @override
  String get unit_fahrenheit => 'Fahrenheit';

  @override
  String get time_format_12h => '12-hour';

  @override
  String get time_format_24h => '24-hour';

  @override
  String get day_monday => 'Monday';

  @override
  String get day_tuesday => 'Tuesday';

  @override
  String get day_wednesday => 'Wednesday';

  @override
  String get day_thursday => 'Thursday';

  @override
  String get day_friday => 'Friday';

  @override
  String get day_saturday => 'Saturday';

  @override
  String get day_sunday => 'Sunday';

  @override
  String get day_monday_short => 'Mon';

  @override
  String get day_tuesday_short => 'Tue';

  @override
  String get day_wednesday_short => 'Wed';

  @override
  String get day_thursday_short => 'Thu';

  @override
  String get day_friday_short => 'Fri';

  @override
  String get day_saturday_short => 'Sat';

  @override
  String get day_sunday_short => 'Sun';

  @override
  String get message_error_tiles_not_configured_title => 'No tiles configured!';

  @override
  String get message_error_tiles_not_configured_description => 'Please configure at least one tile on the screen.';

  @override
  String get message_error_cards_not_configured_title => 'No cards configured!';

  @override
  String get message_error_cards_not_configured_description => 'Please configure at least one card on the screen.';

  @override
  String get message_error_device_not_found_title => 'Device Not Found!';

  @override
  String get message_error_device_not_found_description => 'Requested device could not be found in the application.';

  @override
  String get message_error_no_device_detail_title => 'No device detail!';

  @override
  String get message_error_no_device_detail_description => 'For selected device is not available a detail page.';

  @override
  String get message_error_no_device_detail_preparing_title => 'Device detail not ready!';

  @override
  String get message_error_no_device_detail_preparing_description => 'For selected device detail page is not ready yet.';

  @override
  String get message_error_page_not_found_title => 'Page Not Found!';

  @override
  String get message_error_page_not_found_description => 'Requested page could not be found in the application.';

  @override
  String get electrical_energy_consumption_title => 'Energy Consumption';

  @override
  String get electrical_energy_consumption_description => 'Total energy consumed over time';

  @override
  String get electrical_energy_rate_title => 'Current Power Rate';

  @override
  String get electrical_energy_rate_description => 'Real-time power usage in kilowatts';

  @override
  String get electrical_power_current_title => 'Current';

  @override
  String get electrical_power_current_description => 'How much electricity is flowing';

  @override
  String get electrical_power_voltage_title => 'Voltage';

  @override
  String get electrical_power_voltage_description => 'The strength of the electricity';

  @override
  String get electrical_power_power_title => 'Power';

  @override
  String get electrical_power_power_description => 'How much energy is being used';

  @override
  String get electrical_power_frequency_title => 'Frequency';

  @override
  String get electrical_power_frequency_description => 'How steady the electricity is';

  @override
  String get electrical_power_over_current_title => 'Over Current';

  @override
  String get electrical_power_over_current_description => 'Warning: Too much electricity is flowing';

  @override
  String get electrical_power_over_voltage_title => 'Over Voltage';

  @override
  String get electrical_power_over_voltage_description => 'Warning: Electricity is too strong';

  @override
  String get electrical_power_over_power_title => 'Over Power';

  @override
  String get electrical_power_over_power_description => 'Warning: Power consumption is too high';

  @override
  String get light_state_off => 'Off';

  @override
  String get light_state_off_description => 'Light is turned off';

  @override
  String get light_state_brightness_description => 'Current brightness';

  @override
  String get light_mode_off => 'Off';

  @override
  String get light_mode_brightness => 'Brightness';

  @override
  String get light_mode_color => 'Color';

  @override
  String get light_mode_temperature => 'Temperature';

  @override
  String get light_mode_white => 'White';

  @override
  String get light_mode_swatches => 'Swatches';

  @override
  String get thermostat_state_title => 'Thermostat state';

  @override
  String get thermostat_state_configured_temperature_description => 'Configured temperature';

  @override
  String get thermostat_state_current_temperature_description => 'Current temperature';

  @override
  String get thermostat_state_current_humidity_description => 'Current humidity';

  @override
  String get thermostat_child_lock_title => 'Child lock';

  @override
  String get thermostat_openings_state_title => 'Window is opened';

  @override
  String get thermostat_openings_state_description => 'Thermostat is disabled';

  @override
  String get thermostat_lock_locked => 'Locked';

  @override
  String get thermostat_lock_unlocked => 'Unlocked';

  @override
  String get thermostat_mode_off => 'Off';

  @override
  String get thermostat_mode_heat => 'Heat';

  @override
  String get thermostat_mode_cool => 'Cool';

  @override
  String get thermostat_mode_auto => 'Auto';

  @override
  String get thermostat_mode_manual => 'Manual';

  @override
  String get thermostat_min => 'min';

  @override
  String get thermostat_max => 'max';

  @override
  String get thermostat_state_off => 'Off';

  @override
  String get thermostat_state_heating => 'Heating';

  @override
  String get thermostat_state_cooling => 'Cooling';

  @override
  String get thermostat_state_idling => 'Idling';

  @override
  String get thermostat_with_invalid_configuration => 'This thermostat device is wrongly configured.';

  @override
  String get on_state_on => 'On';

  @override
  String get on_state_off => 'Off';

  @override
  String get message_info_app_reboot_title => 'Rebooting Device!';

  @override
  String get message_info_app_reboot_description => 'Please wait while the device reboots. This may take a few moments. The system will restart automatically once the process is complete.';

  @override
  String get message_info_app_power_off_title => 'Shutting Down!';

  @override
  String get message_info_app_power_off_description => 'The device is powering off. To turn it back on, please use the power button. Thank you for using FastyBird! Smart Panel.';

  @override
  String get message_info_factory_reset_title => 'Resetting Device!';

  @override
  String get message_info_factory_reset_description => 'All settings and data will be erased, and the device will be restored to its factory defaults. Please do not turn off the device during the reset process. This may take a few minutes.';

  @override
  String get settings_general_settings_title => 'General Settings';

  @override
  String get settings_general_settings_button_display_settings => 'Display settings';

  @override
  String get settings_general_settings_button_language_settings => 'Language settings';

  @override
  String get settings_general_settings_button_audio_settings => 'Audio settings';

  @override
  String get settings_general_settings_button_weather_settings => 'Weather settings';

  @override
  String get settings_general_settings_button_about => 'About application';

  @override
  String get settings_general_settings_button_maintenance => 'Maintenance';

  @override
  String get settings_weather_settings_title => 'Weather Settings';

  @override
  String get settings_weather_settings_temperature_unit_title => 'Temperature Unit';

  @override
  String get settings_weather_settings_temperature_unit_description => 'Set the preferred temperature unit for weather display.';

  @override
  String get settings_weather_settings_temperature_location_title => 'Weather Location';

  @override
  String get settings_weather_settings_temperature_location_description => 'Select from available locations configured in the administrator app.';

  @override
  String get settings_weather_settings_temperature_location_single => 'Location is configured in the administrator app.';

  @override
  String get settings_maintenance_title => 'Maintenance';

  @override
  String get settings_maintenance_restart_title => 'Restart';

  @override
  String get settings_maintenance_restart_description => 'Restart the device to apply changes or resolve issues.';

  @override
  String get settings_maintenance_restart_confirm_title => 'Restart Device';

  @override
  String get settings_maintenance_restart_confirm_description => 'Are you sure you want to restart the device? This action will temporarily interrupt functionality.';

  @override
  String get settings_maintenance_power_off_title => 'Power Off';

  @override
  String get settings_maintenance_power_off_description => 'Power off the device completely.';

  @override
  String get settings_maintenance_power_off_confirm_title => 'Power Off Device';

  @override
  String get settings_maintenance_power_off_confirm_description => 'Are you sure you want to power off the device? It will need to be manually turned on again.';

  @override
  String get settings_maintenance_factory_reset_title => 'Factory Reset';

  @override
  String get settings_maintenance_factory_reset_description => 'Restore the device to its original factory settings.';

  @override
  String get settings_maintenance_factory_reset_confirm_title => 'Factory Reset Device';

  @override
  String get settings_maintenance_factory_reset_confirm_description => 'Are you sure you want to erase all data and restore the device to its factory settings? This action is irreversible.';

  @override
  String get settings_language_settings_title => 'Language Settings';

  @override
  String get settings_language_settings_language_title => 'Language';

  @override
  String get settings_language_settings_language_description => 'Select your preferred language.';

  @override
  String get settings_language_settings_timezone_title => 'Timezone';

  @override
  String get settings_language_settings_timezone_description => 'Select your timezone.';

  @override
  String get settings_language_settings_time_format_title => 'Time Format';

  @override
  String get settings_language_settings_time_format_description => 'Select your preferred time format.';

  @override
  String get settings_display_settings_title => 'Display Settings';

  @override
  String get settings_display_settings_theme_mode_title => 'Theme Mode';

  @override
  String get settings_display_settings_theme_mode_description => 'Choose between light or dark mode.';

  @override
  String get settings_display_settings_brightness_title => 'Brightness';

  @override
  String get settings_display_settings_screen_lock_title => 'Screen Lock';

  @override
  String get settings_display_settings_screen_lock_description => 'Set screen lock delay duration.';

  @override
  String get settings_display_settings_screen_saver_title => 'Screen Saver';

  @override
  String get settings_display_settings_screen_saver_description => 'Enable or disable the screen saver.';

  @override
  String get settings_audio_settings_title => 'Audio Settings';

  @override
  String get settings_audio_settings_speaker_title => 'Speaker';

  @override
  String get settings_audio_settings_speaker_description => 'Enable or disable the speaker.';

  @override
  String get settings_audio_settings_speaker_volume_title => 'Speaker Volume';

  @override
  String get settings_audio_settings_microphone_title => 'Microphone';

  @override
  String get settings_audio_settings_microphone_description => 'Enable or disable the microphone.';

  @override
  String get settings_audio_settings_microphone_volume_title => 'Microphone Volume';

  @override
  String get settings_audio_settings_no_support => 'This display does not support audio input or output.';

  @override
  String get settings_about_title => 'About Application';

  @override
  String get settings_about_about_heading => 'About';

  @override
  String get settings_about_about_info => 'FastyBird Smart Panel is a home automation app that enables seamless integration with your smart devices, offering enhanced control and monitoring capabilities.';

  @override
  String get settings_about_developed_by_heading => 'Developed By';

  @override
  String get settings_about_license_heading => 'License';

  @override
  String get settings_about_device_information_heading => 'Device Information';

  @override
  String get settings_about_show_license_button => 'View License';

  @override
  String get settings_about_ip_address_title => 'IP Address';

  @override
  String get settings_about_mac_address_title => 'MAC Address';

  @override
  String get settings_about_cpu_usage_title => 'CPU Usage';

  @override
  String get settings_about_memory_usage_title => 'Memory Usage';

  @override
  String get weather_forecast_title => 'Weather forecast';

  @override
  String get weather_forecast_feels_like => 'Feels like:';

  @override
  String get weather_forecast_humidity => 'Humidity:';

  @override
  String get weather_condition_thunderstorm_with_light_rain => 'Thunderstorm with light rain';

  @override
  String get weather_condition_thunderstorm_with_rain => 'Thunderstorm with rain';

  @override
  String get weather_condition_thunderstorm_with_heavy_rain => 'Thunderstorm with heavy rain';

  @override
  String get weather_condition_light_thunderstorm => 'Light thunderstorm';

  @override
  String get weather_condition_thunderstorm => 'Thunderstorm';

  @override
  String get weather_condition_heavy_thunderstorm => 'Heavy thunderstorm';

  @override
  String get weather_condition_ragged_thunderstorm => 'Ragged thunderstorm';

  @override
  String get weather_condition_thunderstorm_with_light_drizzle => 'Thunderstorm with light drizzle';

  @override
  String get weather_condition_thunderstorm_with_drizzle => 'Thunderstorm with drizzle';

  @override
  String get weather_condition_thunderstorm_with_heavy_drizzle => 'Thunderstorm with heavy drizzle';

  @override
  String get weather_condition_light_intensity_drizzle => 'Light intensity drizzle';

  @override
  String get weather_condition_drizzle => 'Drizzle';

  @override
  String get weather_condition_heavy_intensity_drizzle => 'Heavy intensity drizzle';

  @override
  String get weather_condition_light_intensity_drizzle_rain => 'Light intensity drizzle rain';

  @override
  String get weather_condition_drizzle_rain => 'Drizzle rain';

  @override
  String get weather_condition_heavy_intensity_drizzle_rain => 'Heavy intensity drizzle rain';

  @override
  String get weather_condition_shower_rain_and_drizzle => 'Shower rain and drizzle';

  @override
  String get weather_condition_heavy_shower_rain_and_drizzle => 'Heavy shower rain and drizzle';

  @override
  String get weather_condition_shower_drizzle => 'Shower drizzle';

  @override
  String get weather_condition_light_rain => 'Light rain';

  @override
  String get weather_condition_moderate_rain => 'Moderate rain';

  @override
  String get weather_condition_heavy_intensity_rain => 'Heavy intensity rain';

  @override
  String get weather_condition_very_heavy_rain => 'Very heavy rain';

  @override
  String get weather_condition_extreme_rain => 'Extreme rain';

  @override
  String get weather_condition_freezing_rain => 'Freezing rain';

  @override
  String get weather_condition_light_intensity_shower_rain => 'Light intensity shower rain';

  @override
  String get weather_condition_shower_rain => 'Shower rain';

  @override
  String get weather_condition_heavy_intensity_shower_rain => 'Heavy intensity shower rain';

  @override
  String get weather_condition_ragged_shower_rain => 'Ragged shower rain';

  @override
  String get weather_condition_light_snow => 'Light snow';

  @override
  String get weather_condition_snow => 'Snow';

  @override
  String get weather_condition_heavy_snow => 'Heavy snow';

  @override
  String get weather_condition_sleet => 'Sleet';

  @override
  String get weather_condition_light_shower_sleet => 'Light shower sleet';

  @override
  String get weather_condition_shower_sleet => 'Shower sleet';

  @override
  String get weather_condition_light_rain_and_snow => 'Light rain and snow';

  @override
  String get weather_condition_rain_and_snow => 'Rain and snow';

  @override
  String get weather_condition_light_shower_snow => 'Light shower snow';

  @override
  String get weather_condition_shower_snow => 'Shower snow';

  @override
  String get weather_condition_heavy_shower_snow => 'Heavy shower snow';

  @override
  String get weather_condition_mist => 'Mist';

  @override
  String get weather_condition_smoke => 'Smoke';

  @override
  String get weather_condition_haze => 'Haze';

  @override
  String get weather_condition_fog => 'Fog';

  @override
  String get weather_condition_sand => 'Sand';

  @override
  String get weather_condition_dust => 'Dust';

  @override
  String get weather_condition_volcanic_ash => 'Volcanic ash';

  @override
  String get weather_condition_squalls => 'Squalls';

  @override
  String get weather_condition_tornado => 'Tornado';

  @override
  String get weather_condition_clear_sky => 'Clear sky';

  @override
  String get weather_condition_few_clouds => 'Few clouds';

  @override
  String get weather_condition_scattered_clouds => 'Scattered clouds';

  @override
  String get weather_condition_broken_clouds => 'Broken clouds';

  @override
  String get weather_condition_overcast_clouds => 'Overcast clouds';

  @override
  String get weather_condition_unknown => 'Unknown';

  @override
  String get discovery_searching_title => 'Searching for Gateways';

  @override
  String get discovery_searching_description => 'Looking for FastyBird Smart Panel gateways on your network...';

  @override
  String discovery_found_count(int count) {
    return 'Found $count gateway(s)...';
  }

  @override
  String get discovery_select_title => 'Select a Gateway';

  @override
  String discovery_select_description(int count) {
    return 'Found $count gateway(s) on your network:';
  }

  @override
  String get discovery_not_found_title => 'No Gateway Found';

  @override
  String get discovery_not_found_description => 'Could not find any FastyBird Smart Panel gateway on your network.\n\nMake sure the gateway is running and connected to the same network as this device.';

  @override
  String get discovery_error_title => 'Discovery Error';

  @override
  String get discovery_error_description => 'An error occurred while searching for gateways.\n\nPlease check your network connection and try again.';

  @override
  String discovery_error_failed(String error) {
    return 'Discovery failed: $error';
  }

  @override
  String get discovery_connecting_title => 'Connecting to Gateway';

  @override
  String discovery_connecting_description(String address) {
    return 'Contacting $address...';
  }

  @override
  String get discovery_connecting_fallback => 'gateway';

  @override
  String get discovery_manual_entry_title => 'Enter Gateway Address';

  @override
  String get discovery_manual_entry_hint => '192.168.1.100:3000';

  @override
  String get discovery_manual_entry_label => 'Gateway Address';

  @override
  String get discovery_manual_entry_help => 'Enter IP address or hostname with optional port.\nExamples: 192.168.1.100:3000, gateway.local, 10.0.0.5';

  @override
  String get discovery_validation_empty => 'Please enter a gateway address';

  @override
  String get discovery_validation_invalid => 'Invalid address. Enter a valid IP address or hostname.';

  @override
  String get discovery_button_back => 'Back';

  @override
  String get discovery_button_connect => 'Connect';

  @override
  String get discovery_button_connect_selected => 'Connect to Selected Gateway';

  @override
  String get discovery_button_rescan => 'Rescan';

  @override
  String get discovery_button_manual => 'Manual';

  @override
  String get action_success => 'Action completed successfully';

  @override
  String get space_lighting_controls_title => 'Lighting Controls';

  @override
  String get space_lighting_mode_off => 'Off';

  @override
  String get space_lighting_mode_work => 'Work';

  @override
  String get space_lighting_mode_relax => 'Relax';

  @override
  String get space_lighting_mode_night => 'Night';

  @override
  String get space_devices_title => 'Devices';

  @override
  String get space_devices_placeholder => 'Devices in this space will be displayed here';

  @override
  String get space_climate_controls_title => 'Climate';

  @override
  String get space_climate_current_label => 'Current';

  @override
  String get space_climate_target_label => 'Target';

  @override
  String get space_suggestion_applied => 'Suggestion applied';

  @override
  String get space_suggestion_dismissed => 'Suggestion dismissed';

  @override
  String get space_undo_success => 'Action undone';

  @override
  String get space_undo_button => 'Undo';

  @override
  String get space_empty_state_title => 'No Controls Available';

  @override
  String get space_empty_state_description => 'This space has no controllable devices configured yet';

  @override
  String get space_sensors_only_title => 'Sensors Only';

  @override
  String get space_sensors_only_description => 'This space only has sensors — no controllable devices';
}
