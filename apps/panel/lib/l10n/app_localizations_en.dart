import 'package:intl/intl.dart' as intl;

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
  String get action_retry => 'Retry';

  @override
  String domain_data_load_failed(String domain) {
    return 'Failed to load $domain';
  }

  @override
  String get domain_data_load_failed_description => 'Unable to retrieve data. Please check your connection and try again.';

  @override
  String get services_not_available => 'Services not available';

  @override
  String get button_ok => 'Ok';

  @override
  String get button_cancel => 'Cancel';

  @override
  String get button_close => 'Close';

  @override
  String get button_confirm => 'Confirm';

  @override
  String get button_done => 'Done';

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
  String get device_status_offline => 'Offline';

  @override
  String get device_offline_message => 'Device is offline';

  @override
  String get device_offline_title => 'Device Offline';

  @override
  String get device_offline_description => 'Unable to communicate with this device. Check if the device is powered on and connected to your network.';

  @override
  String get device_offline_retry => 'Retry Connection';

  @override
  String device_offline_last_seen(String time) {
    return 'Last seen $time';
  }

  @override
  String devices_offline_skipped(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Skipped $count offline devices',
      one: 'Skipped 1 offline device',
    );
    return '$_temp0';
  }

  @override
  String get all_devices_offline => 'All devices are offline';

  @override
  String get time_ago_just_now => 'just now';

  @override
  String time_ago_minutes(int count) {
    return '$count min ago';
  }

  @override
  String time_ago_hours(int count) {
    return '$count h ago';
  }

  @override
  String time_ago_days(int count) {
    return '$count d ago';
  }

  @override
  String time_ago_medium_minutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count minutes ago',
      one: '1 minute ago',
    );
    return '$_temp0';
  }

  @override
  String time_ago_medium_hours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count hours ago',
      one: '1 hour ago',
    );
    return '$_temp0';
  }

  @override
  String time_ago_medium_days(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count days ago',
      one: '1 day ago',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_minutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count minutes ago',
      one: '1 minute ago',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_hours_minutes(int hours, int minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      hours,
      locale: localeName,
      other: '$hours hours',
      one: '1 hour',
    );
    String _temp1 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: '$minutes minutes',
      one: '1 minute',
    );
    return '$_temp0 $_temp1 ago';
  }

  @override
  String time_ago_full_hours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count hours ago',
      one: '1 hour ago',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_days_hours(int days, int hours) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days days',
      one: '1 day',
    );
    String _temp1 = intl.Intl.pluralLogic(
      hours,
      locale: localeName,
      other: '$hours hours',
      one: '1 hour',
    );
    return '$_temp0 $_temp1 ago';
  }

  @override
  String time_ago_full_days(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count days ago',
      one: '1 day ago',
    );
    return '$_temp0';
  }

  @override
  String get device_config_issue => 'Configuration issue';

  @override
  String get device_details => 'Device Details';

  @override
  String get message_error_page_not_found_title => 'Page Not Found!';

  @override
  String get message_error_page_not_found_description => 'Requested page could not be found in the application.';

  @override
  String get electrical_energy_consumption_title => 'Energy Consumption';

  @override
  String get electrical_energy_consumption_description => 'Total energy consumed over time';

  @override
  String get electrical_energy_average_power_title => 'Average Power';

  @override
  String get electrical_energy_average_power_description => 'Average power draw over the last reporting interval';

  @override
  String get electrical_generation_production_title => 'Energy Production';

  @override
  String get electrical_generation_production_description => 'Total energy produced by the generation source';

  @override
  String get electrical_generation_power_title => 'Generation Power';

  @override
  String get electrical_generation_power_description => 'Current power output from the generation source';

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
  String get light_state_on => 'On';

  @override
  String get light_state_on_description => 'Light is on';

  @override
  String get light_state_off => 'Off';

  @override
  String get light_state_failed => 'Failed';

  @override
  String get light_state_off_description => 'Light is off';

  @override
  String get light_state_brightness_description => 'Current brightness';

  @override
  String get light_state_mixed_description => 'Devices have different values';

  @override
  String get light_state_syncing_description => 'Syncing devices...';

  @override
  String get light_state_not_synced_description => 'Devices are not synced';

  @override
  String get light_role_main => 'Main';

  @override
  String get light_role_task => 'Task';

  @override
  String get light_role_ambient => 'Ambient';

  @override
  String get light_role_accent => 'Accent';

  @override
  String get light_role_night => 'Night';

  @override
  String get light_role_other => 'Other';

  @override
  String get light_role_hidden => 'Hidden';

  @override
  String get light_role_on_description => 'Lights are on';

  @override
  String get light_role_off_description => 'Lights are off';

  @override
  String get light_role_not_synced_description => 'Lights failed to sync';

  @override
  String get light_role_syncing_description => 'Lights are syncing';

  @override
  String get light_role_mixed_description => 'Lights have different values';

  @override
  String get light_state_out_of_sync => 'Out of sync';

  @override
  String get light_mode_off => 'Off';

  @override
  String get light_mode_on => 'On';

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
  String get contact_sensor_window => 'Window';

  @override
  String get contact_sensor_open => 'Open';

  @override
  String get contact_sensor_closed => 'Closed';

  @override
  String get leak_sensor_water => 'Water Leak';

  @override
  String get leak_sensor_detected => 'Detected';

  @override
  String get leak_sensor_dry => 'Dry';

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
  String thermostat_state_heating_to(String temperature) {
    return 'Heating to $temperature';
  }

  @override
  String get thermostat_state_cooling => 'Cooling';

  @override
  String thermostat_state_cooling_to(String temperature) {
    return 'Cooling to $temperature';
  }

  @override
  String get thermostat_state_idling => 'Idling';

  @override
  String thermostat_state_idle_at(String temperature) {
    return 'Idle at $temperature';
  }

  @override
  String get thermostat_with_invalid_configuration => 'This thermostat device is wrongly configured.';

  @override
  String get on_state_on => 'On';

  @override
  String get on_state_off => 'Off';

  @override
  String get power_hint_tap_to_turn_on => 'Tap to turn on';

  @override
  String get power_hint_tap_to_turn_off => 'Tap to turn off';

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
  String get discovery_button_try_again => 'Try Again';

  @override
  String get discovery_button_manual => 'Enter Manually';

  @override
  String get discovery_button_cancel => 'Cancel';

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
  String get climate_role_auxiliary => 'Auxiliary';

  @override
  String get climate_tap_for_details => 'Tap for details';

  @override
  String get climate_role_ventilation => 'Ventilation';

  @override
  String get climate_role_humidity => 'Humidity Control';

  @override
  String get climate_role_other => 'Other Devices';

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

  @override
  String get house_overview_no_spaces_title => 'No Spaces Configured';

  @override
  String get house_overview_no_spaces_description => 'Create spaces in the admin app to see them here';

  @override
  String get house_overview_no_space_page => 'No room page configured for this space';

  @override
  String get house_overview_tap_to_view => 'Tap to view';

  @override
  String get house_modes_home => 'Home';

  @override
  String get house_modes_home_description => 'Normal home operation';

  @override
  String get house_modes_away => 'Away';

  @override
  String get house_modes_away_description => 'Away from home';

  @override
  String get house_modes_night => 'Night';

  @override
  String get house_modes_night_description => 'Night time settings';

  @override
  String get house_modes_changed_success => 'House mode changed successfully';

  @override
  String get house_modes_changed_error => 'Failed to change house mode';

  @override
  String get house_modes_confirm_title => 'Confirm Mode Change';

  @override
  String get house_modes_confirm_away_description => 'Are you sure you want to set the house to Away mode? This may affect automation rules and security settings.';

  @override
  String get space_scenes_title => 'Quick Scenes';

  @override
  String get space_scene_triggered => 'Scene activated';

  @override
  String get space_scene_partial_success => 'Scene partially activated';

  @override
  String get window_covering_status_open => 'Open';

  @override
  String get window_covering_status_closed => 'Closed';

  @override
  String get window_covering_status_opening => 'Opening';

  @override
  String get window_covering_status_closing => 'Closing';

  @override
  String get window_covering_status_stopped => 'Stopped';

  @override
  String get window_covering_type_curtain => 'Curtain';

  @override
  String get window_covering_type_blind => 'Blind';

  @override
  String get window_covering_type_roller => 'Roller';

  @override
  String get window_covering_type_outdoor_blind => 'Outdoor Blind';

  @override
  String get window_covering_type_venetian_blind => 'Venetian Blind';

  @override
  String get window_covering_type_vertical_blind => 'Vertical Blind';

  @override
  String get window_covering_type_shutter => 'Shutter';

  @override
  String get window_covering_type_awning => 'Awning';

  @override
  String get window_covering_command_open => 'Open';

  @override
  String get window_covering_command_close => 'Close';

  @override
  String get window_covering_command_stop => 'Stop';

  @override
  String get window_covering_position_label => 'Position';

  @override
  String get window_covering_position_description => 'Current position';

  @override
  String get window_covering_tilt_label => 'Tilt';

  @override
  String get window_covering_tilt_description => 'Adjust slat angle';

  @override
  String get window_covering_obstruction_warning => 'Obstruction detected';

  @override
  String get window_covering_fault_warning => 'Fault detected';

  @override
  String get window_covering_preset_morning => 'Morning';

  @override
  String get window_covering_preset_day => 'Day';

  @override
  String get window_covering_preset_evening => 'Evening';

  @override
  String get window_covering_preset_night => 'Night';

  @override
  String get window_covering_preset_privacy => 'Privacy';

  @override
  String get window_covering_preset_away => 'Away';

  @override
  String get window_covering_presets_label => 'Presets';

  @override
  String get window_covering_channels_label => 'Blinds';

  @override
  String get window_covering_info_status => 'Status';

  @override
  String get window_covering_info_obstruction => 'Obstruction';

  @override
  String get window_covering_obstruction_detected => 'Detected';

  @override
  String get window_covering_obstruction_clear => 'Clear';

  @override
  String window_covering_position_open_percent(int position) {
    return '$position% Open';
  }

  @override
  String get battery_title => 'Battery';

  @override
  String get config_error_title => 'Configuration Required';

  @override
  String get config_error_hint_prefix => 'Configure this display in';

  @override
  String get config_error_hint_path => 'Admin > Displays';

  @override
  String get connection_lost_title => 'Connection Lost';

  @override
  String get connection_lost_message => 'Unable to connect to the gateway. Please check your network connection and try again.';

  @override
  String get connection_lost_button_reconnect => 'Reconnect';

  @override
  String get connection_lost_button_change_gateway => 'Change Gateway';

  @override
  String get button_retry => 'Retry';

  @override
  String get button_sync_all => 'Sync All';

  @override
  String get system_view_room => 'Room';

  @override
  String get system_view_master => 'Home';

  @override
  String get deck_nav_more => 'More';

  @override
  String get system_view_entry => 'Entry';

  @override
  String get domain_lights => 'Lights';

  @override
  String get domain_lights_other => 'Other Lights';

  @override
  String get domain_lights_empty_title => 'No Lights';

  @override
  String get domain_lights_empty_description => 'No lighting devices found in this room';

  @override
  String domain_lights_count_on(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count lights on',
      one: '1 light on',
    );
    return '$_temp0';
  }

  @override
  String get domain_lights_all_off => 'all off';

  @override
  String get domain_lights_all_on => 'all on';

  @override
  String get domain_lights_button_all_off => 'All Off';

  @override
  String get domain_lights_button_all_on => 'All On';

  @override
  String get domain_lights_syncing => 'syncing';

  @override
  String get domain_lights_unsynced => 'unsynced';

  @override
  String get domain_lights_mixed => 'mixed';

  @override
  String get domain_climate => 'Climate';

  @override
  String get domain_media => 'Media';

  @override
  String media_devices_summary(Object count) {
    return '$count devices';
  }

  @override
  String media_devices_summary_on(Object count, Object on) {
    return '$count devices • $on on';
  }

  @override
  String get media_modes_title => 'Modes';

  @override
  String get media_action_power_on => 'Power on';

  @override
  String get media_action_power_off => 'Power off';

  @override
  String get media_action_mute => 'Mute';

  @override
  String get media_action_unmute => 'Unmute';

  @override
  String get media_mode_off => 'Off';

  @override
  String get media_mode_background => 'Background';

  @override
  String get media_mode_focused => 'Focused';

  @override
  String get media_mode_party => 'Party';

  @override
  String get media_roles_title => 'Roles';

  @override
  String media_role_summary(Object on, Object total) {
    return '$on of $total on';
  }

  @override
  String get media_roles_unassigned => 'Unassigned devices';

  @override
  String get media_role_primary => 'Primary';

  @override
  String get media_role_secondary => 'Secondary';

  @override
  String get media_role_background => 'Background';

  @override
  String get media_role_gaming => 'Gaming';

  @override
  String get media_role_hidden => 'Hidden';

  @override
  String get media_targets_title => 'Devices';

  @override
  String get media_capability_power => 'Power';

  @override
  String get media_capability_volume => 'Volume';

  @override
  String get media_capability_mute => 'Mute';

  @override
  String get media_capability_none => 'No capabilities';

  @override
  String get media_no_endpoints_title => 'No Media Devices';

  @override
  String get media_no_endpoints_description => 'This room has no media-capable devices. Add a TV, speaker, or streamer to get started.';

  @override
  String get media_no_bindings_description => 'Media activities are being configured. Pull to refresh.';

  @override
  String get media_ws_offline_title => 'Connection Lost';

  @override
  String get media_ws_offline_description => 'Media controls require a live connection. Reconnecting...';

  @override
  String get domain_sensors => 'Sensors';

  @override
  String get domain_energy => 'Energy';

  @override
  String get energy_consumption => 'Consumption';

  @override
  String get energy_production => 'Production';

  @override
  String get energy_net => 'Net';

  @override
  String get energy_range_today => 'Today';

  @override
  String get energy_range_week => 'Week';

  @override
  String get energy_range_month => 'Month';

  @override
  String get energy_top_consumers => 'Top Consumers';

  @override
  String get energy_chart_title => 'Usage Over Time';

  @override
  String get energy_summary_title => 'Summary';

  @override
  String get energy_unit_kwh => 'kWh';

  @override
  String get energy_empty_title => 'No Energy Data';

  @override
  String get energy_empty_description => 'No energy monitoring devices found in this space';

  @override
  String energy_device_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count devices',
      one: '1 device',
    );
    return '$_temp0';
  }

  @override
  String get device_category_lighting => 'Lights';

  @override
  String get device_category_climate => 'Climate';

  @override
  String get device_category_sensors => 'Sensors';

  @override
  String get device_category_media => 'Media';

  @override
  String get master_rooms => 'Rooms';

  @override
  String get master_devices => 'Devices';

  @override
  String get master_scenes => 'Scenes';

  @override
  String get master_quick_actions => 'Quick Actions';

  @override
  String get entry_mode_activated => 'Mode activated';

  @override
  String get entry_house_modes => 'House Modes';

  @override
  String get entry_mode_home => 'Home';

  @override
  String get entry_mode_away => 'Away';

  @override
  String get entry_mode_night => 'Night';

  @override
  String get entry_mode_movie => 'Movie';

  @override
  String get entry_security => 'Security';

  @override
  String get entry_no_security_devices => 'No security devices configured';

  @override
  String get entry_locks => 'Locks';

  @override
  String get entry_alarm => 'Alarm';

  @override
  String get entry_cameras => 'Cameras';

  @override
  String get air_quality_level_excellent => 'Excellent';

  @override
  String get air_quality_level_good => 'Good';

  @override
  String get air_quality_level_fair => 'Fair';

  @override
  String get air_quality_level_inferior => 'Inferior';

  @override
  String get air_quality_level_poor => 'Poor';

  @override
  String get air_quality_level_unknown => 'Unknown';

  @override
  String get aqi_label_good => 'Good';

  @override
  String get aqi_label_moderate => 'Moderate';

  @override
  String get aqi_label_unhealthy_sensitive => 'Unhealthy (Sensitive)';

  @override
  String get aqi_label_unhealthy => 'Unhealthy';

  @override
  String get aqi_label_very_unhealthy => 'Very Unhealthy';

  @override
  String get aqi_label_hazardous => 'Hazardous';

  @override
  String get particulate_label_pm1 => 'PM1';

  @override
  String get particulate_label_pm25 => 'PM2.5';

  @override
  String get particulate_label_pm10 => 'PM10';

  @override
  String get sensor_enum_voc_level_low => 'Low';

  @override
  String get sensor_enum_voc_level_low_long => 'Low VOC';

  @override
  String get sensor_enum_voc_level_medium => 'Med';

  @override
  String get sensor_enum_voc_level_medium_long => 'Medium VOC';

  @override
  String get sensor_enum_voc_level_high => 'High';

  @override
  String get sensor_enum_voc_level_high_long => 'High VOC';

  @override
  String get fan_mode_auto => 'Auto';

  @override
  String get fan_mode_manual => 'Manual';

  @override
  String get fan_mode_eco => 'Eco';

  @override
  String get fan_mode_sleep => 'Sleep';

  @override
  String get fan_mode_natural => 'Natural';

  @override
  String get fan_mode_turbo => 'Turbo';

  @override
  String get fan_speed_off => 'Off';

  @override
  String get fan_speed_low => 'Low';

  @override
  String get fan_speed_medium => 'Med';

  @override
  String get fan_speed_high => 'High';

  @override
  String get fan_speed_turbo => 'Turbo';

  @override
  String get fan_speed_auto => 'Auto';

  @override
  String get fan_timer_off => 'Off';

  @override
  String get fan_timer_30m => '30m';

  @override
  String get fan_timer_1h => '1h';

  @override
  String get fan_timer_2h => '2h';

  @override
  String get fan_timer_4h => '4h';

  @override
  String get fan_timer_8h => '8h';

  @override
  String get fan_timer_12h => '12h';

  @override
  String get fan_direction_clockwise => 'Clockwise';

  @override
  String get fan_direction_counter_clockwise => 'Counter-Clockwise';

  @override
  String get filter_status_good => 'Good';

  @override
  String get filter_status_replace_soon => 'Due Soon';

  @override
  String get filter_status_replace_now => 'Replace';

  @override
  String get filter_status_unknown => 'Unknown';

  @override
  String get dehumidifier_mode_auto => 'Auto';

  @override
  String get dehumidifier_mode_manual => 'Manual';

  @override
  String get dehumidifier_mode_continuous => 'Continuous';

  @override
  String get dehumidifier_mode_laundry => 'Laundry';

  @override
  String get dehumidifier_mode_quiet => 'Quiet';

  @override
  String get dehumidifier_status_idle => 'Idle';

  @override
  String get dehumidifier_status_dehumidifying => 'Dehumidifying';

  @override
  String get dehumidifier_status_defrosting => 'Defrosting';

  @override
  String get dehumidifier_timer_off => 'Off';

  @override
  String get dehumidifier_timer_30m => '30 min';

  @override
  String get dehumidifier_timer_1h => '1 hour';

  @override
  String get dehumidifier_timer_2h => '2 hours';

  @override
  String get dehumidifier_timer_4h => '4 hours';

  @override
  String get dehumidifier_timer_8h => '8 hours';

  @override
  String get dehumidifier_timer_12h => '12 hours';

  @override
  String get dehumidifier_water_tank => 'Water Tank';

  @override
  String get dehumidifier_defrost => 'Defrost';

  @override
  String get dehumidifier_defrost_active => 'Defrosting';

  @override
  String get humidifier_mode_auto => 'Auto';

  @override
  String get humidifier_mode_manual => 'Manual';

  @override
  String get humidifier_mode_sleep => 'Sleep';

  @override
  String get humidifier_mode_baby => 'Baby';

  @override
  String get humidifier_status_idle => 'Idle';

  @override
  String get humidifier_status_humidifying => 'Humidifying';

  @override
  String get humidifier_mist_level => 'Mist Level';

  @override
  String get humidifier_mist_level_off => 'Off';

  @override
  String get humidifier_mist_level_low => 'Low';

  @override
  String get humidifier_mist_level_medium => 'Medium';

  @override
  String get humidifier_mist_level_high => 'High';

  @override
  String get humidifier_timer_off => 'Off';

  @override
  String get humidifier_timer_30m => '30 min';

  @override
  String get humidifier_timer_1h => '1 hour';

  @override
  String get humidifier_timer_2h => '2 hours';

  @override
  String get humidifier_timer_4h => '4 hours';

  @override
  String get humidifier_timer_8h => '8 hours';

  @override
  String get humidifier_timer_12h => '12 hours';

  @override
  String get humidifier_water_tank => 'Water Tank';

  @override
  String get humidifier_warm_mist => 'Warm Mist';

  @override
  String get device_current_humidity => 'Current';

  @override
  String get device_current_temperature => 'Temperature';

  @override
  String get device_fan_speed => 'Fan Speed';

  @override
  String get device_fan_mode => 'Fan Mode';

  @override
  String get device_timer => 'Timer';

  @override
  String get device_child_lock => 'Child Lock';

  @override
  String get device_oscillation => 'Oscillation';

  @override
  String get device_direction => 'Direction';

  @override
  String get device_natural_breeze => 'Natural Breeze';

  @override
  String get device_auto_off_timer => 'Auto-Off Timer';

  @override
  String get device_filter_life => 'Filter Life';

  @override
  String get device_filter_status => 'Filter';

  @override
  String get device_voc => 'VOC';

  @override
  String get device_co2 => 'CO₂';

  @override
  String get device_co => 'CO';

  @override
  String get device_no2 => 'NO₂';

  @override
  String get device_o3 => 'O₃';

  @override
  String get device_so2 => 'SO₂';

  @override
  String get device_pressure => 'Pressure';

  @override
  String get air_quality_healthy => 'Healthy';

  @override
  String get air_quality_unhealthy => 'Unhealthy';

  @override
  String get gas_detected => 'Detected';

  @override
  String get gas_clear => 'Clear';

  @override
  String get gas_level_low => 'Low';

  @override
  String get gas_level_medium => 'Medium';

  @override
  String get gas_level_high => 'High';

  @override
  String get device_humidity => 'Humidity';

  @override
  String get device_air_quality_index => 'Air Quality Index';

  @override
  String get device_temperature => 'Temp';

  @override
  String get device_sensors => 'Sensors';

  @override
  String get device_controls => 'Controls';

  @override
  String duration_format_hours_minutes(int hours, int minutes) {
    return '${hours}h ${minutes}m';
  }

  @override
  String duration_format_hours(int hours) {
    return '${hours}h';
  }

  @override
  String duration_format_minutes(int minutes) {
    return '${minutes}m';
  }

  @override
  String get media_playing => 'Playing';

  @override
  String get media_idle => 'Idle';

  @override
  String get media_standby => 'Standby';

  @override
  String get media_volume => 'Volume';

  @override
  String get media_source => 'Source';

  @override
  String get media_queue => 'Queue';

  @override
  String get media_up_next => 'Up Next';

  @override
  String get media_other_devices => 'Other Devices';

  @override
  String get device_status_standby => 'Standby';

  @override
  String get device_status_active => 'Active';

  @override
  String get device_status_inactive => 'Inactive';

  @override
  String get climate_devices_section => 'Climate Devices';

  @override
  String get domain_shading => 'Shading';

  @override
  String get domain_shading_empty_title => 'No Window Coverings';

  @override
  String get domain_shading_empty_description => 'No window covering devices found in this room';

  @override
  String get shading_modes_title => 'Modes';

  @override
  String get shading_devices_title => 'Devices';

  @override
  String shading_devices_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count devices',
      one: '1 device',
    );
    return '$_temp0';
  }

  @override
  String get shading_action_open => 'Open';

  @override
  String get shading_action_close => 'Close';

  @override
  String get shading_action_stop => 'Stop';

  @override
  String get shading_state_open => 'Open';

  @override
  String get shading_state_closed => 'Closed';

  @override
  String shading_state_partial(int position) {
    return '$position% open';
  }

  @override
  String get shading_position => 'Position';

  @override
  String get shading_tap_for_controls => 'Tap for controls';

  @override
  String get shading_hide_controls => 'Hide controls';

  @override
  String get covers_mode_open => 'Open';

  @override
  String get covers_mode_closed => 'Closed';

  @override
  String get covers_mode_privacy => 'Privacy';

  @override
  String get covers_mode_daylight => 'Daylight';

  @override
  String get covers_role_primary => 'Primary';

  @override
  String get covers_role_blackout => 'Blackout';

  @override
  String get covers_role_sheer => 'Sheer';

  @override
  String get covers_role_outdoor => 'Outdoor';

  @override
  String get covers_role_hidden => 'Hidden';

  @override
  String get cover_type_curtain => 'Curtain';

  @override
  String get cover_type_blind => 'Blind';

  @override
  String get cover_type_roller => 'Roller';

  @override
  String get cover_type_outdoor_blind => 'Outdoor Blind';

  @override
  String get cover_type_cover => 'Cover';

  @override
  String get light_preset_candle => 'Candle';

  @override
  String get light_preset_warm => 'Warm';

  @override
  String get light_preset_daylight => 'Daylight';

  @override
  String get light_preset_cool => 'Cool';

  @override
  String get light_color_red => 'Red';

  @override
  String get light_color_orange => 'Orange';

  @override
  String get light_color_yellow => 'Yellow';

  @override
  String get light_color_green => 'Green';

  @override
  String get light_color_cyan => 'Cyan';

  @override
  String get light_color_blue => 'Blue';

  @override
  String get light_color_purple => 'Purple';

  @override
  String get light_color_pink => 'Pink';

  @override
  String get connection_banner_reconnecting => 'Reconnecting...';

  @override
  String get connection_banner_retry => 'Retry';

  @override
  String get connection_overlay_title_reconnecting => 'Reconnecting';

  @override
  String get connection_overlay_message_reconnecting => 'Attempting to reconnect...';

  @override
  String get connection_overlay_message_still_trying => 'Still trying to reconnect...';

  @override
  String get connection_overlay_retry => 'Retry Now';

  @override
  String get connection_overlay_retrying => 'Retrying...';

  @override
  String get connection_recovery_connected => 'Connected';

  @override
  String get connection_auth_error_title => 'Session Expired';

  @override
  String get connection_auth_error_message => 'Your session has expired or was revoked. Please reset the device to reconnect.';

  @override
  String get connection_auth_error_button_reset => 'Reset Device';

  @override
  String get connection_network_error_title => 'Network Unavailable';

  @override
  String get connection_network_error_message => 'Unable to reach the server. Please check your network connection.';

  @override
  String get connection_network_error_button_retry => 'Try Again';

  @override
  String get connection_server_error_title => 'Server Unavailable';

  @override
  String get connection_server_error_message => 'The server is temporarily unavailable. Please try again later.';

  @override
  String get connection_server_error_button_retry => 'Try Again';

  @override
  String get sensor_enum_illuminance_bright => 'Bright';

  @override
  String get sensor_enum_illuminance_bright_long => 'Bright';

  @override
  String get sensor_enum_illuminance_moderate => 'Moderate';

  @override
  String get sensor_enum_illuminance_moderate_long => 'Moderate';

  @override
  String get sensor_enum_illuminance_dusky => 'Dusky';

  @override
  String get sensor_enum_illuminance_dusky_long => 'Dusky';

  @override
  String get sensor_enum_illuminance_dark => 'Dark';

  @override
  String get sensor_enum_illuminance_dark_long => 'Dark';

  @override
  String get sensor_enum_gas_status_normal => 'OK';

  @override
  String get sensor_enum_gas_status_normal_long => 'Normal';

  @override
  String get sensor_enum_gas_status_warning => 'Warn';

  @override
  String get sensor_enum_gas_status_warning_long => 'Warning';

  @override
  String get sensor_enum_gas_status_alarm => 'Alarm';

  @override
  String get sensor_enum_gas_status_alarm_long => 'Gas Alarm';

  @override
  String get sensor_enum_leak_level_low => 'Low';

  @override
  String get sensor_enum_leak_level_low_long => 'Low Leak';

  @override
  String get sensor_enum_leak_level_medium => 'Med';

  @override
  String get sensor_enum_leak_level_medium_long => 'Medium Leak';

  @override
  String get sensor_enum_leak_level_high => 'High';

  @override
  String get sensor_enum_leak_level_high_long => 'Severe Leak';

  @override
  String get sensor_enum_battery_level_critical => 'Crit';

  @override
  String get sensor_enum_battery_level_critical_long => 'Critical';

  @override
  String get sensor_enum_battery_level_low => 'Low';

  @override
  String get sensor_enum_battery_level_low_long => 'Low';

  @override
  String get sensor_enum_battery_level_medium => 'Med';

  @override
  String get sensor_enum_battery_level_medium_long => 'Medium';

  @override
  String get sensor_enum_battery_level_high => 'High';

  @override
  String get sensor_enum_battery_level_high_long => 'High';

  @override
  String get sensor_enum_battery_level_full => 'Full';

  @override
  String get sensor_enum_battery_level_full_long => 'Full';

  @override
  String get sensor_enum_battery_status_ok => 'OK';

  @override
  String get sensor_enum_battery_status_ok_long => 'Battery OK';

  @override
  String get sensor_enum_battery_status_low => 'Low';

  @override
  String get sensor_enum_battery_status_low_long => 'Low Battery';

  @override
  String get sensor_enum_battery_status_charging => 'Chrg';

  @override
  String get sensor_enum_battery_status_charging_long => 'Charging';

  @override
  String get sensor_enum_alarm_alarm_idle => 'Idle';

  @override
  String get sensor_enum_alarm_alarm_idle_long => 'Alarm Idle';

  @override
  String get sensor_enum_alarm_alarm_pending => 'Pend';

  @override
  String get sensor_enum_alarm_alarm_pending_long => 'Alarm Pending';

  @override
  String get sensor_enum_alarm_alarm_triggered => 'Trig';

  @override
  String get sensor_enum_alarm_alarm_triggered_long => 'Alarm Triggered';

  @override
  String get sensor_enum_alarm_alarm_silenced => 'Muted';

  @override
  String get sensor_enum_alarm_alarm_silenced_long => 'Alarm Silenced';

  @override
  String get sensor_enum_alarm_disarmed => 'Off';

  @override
  String get sensor_enum_alarm_disarmed_long => 'Disarmed';

  @override
  String get sensor_enum_alarm_armed_home => 'Home';

  @override
  String get sensor_enum_alarm_armed_home_long => 'Armed Home';

  @override
  String get sensor_enum_alarm_armed_away => 'Away';

  @override
  String get sensor_enum_alarm_armed_away_long => 'Armed Away';

  @override
  String get sensor_enum_alarm_armed_night => 'Night';

  @override
  String get sensor_enum_alarm_armed_night_long => 'Armed Night';

  @override
  String get sensor_enum_filter_good => 'Good';

  @override
  String get sensor_enum_filter_good_long => 'Filter Good';

  @override
  String get sensor_enum_filter_replace_soon => 'Soon';

  @override
  String get sensor_enum_filter_replace_soon_long => 'Replace Soon';

  @override
  String get sensor_enum_filter_replace_now => 'Now!';

  @override
  String get sensor_enum_filter_replace_now_long => 'Replace Now';

  @override
  String get sensor_enum_door_opened => 'Open';

  @override
  String get sensor_enum_door_opened_long => 'Door Opened';

  @override
  String get sensor_enum_door_closed => 'Closed';

  @override
  String get sensor_enum_door_closed_long => 'Door Closed';

  @override
  String get sensor_enum_door_opening => 'Opening';

  @override
  String get sensor_enum_door_opening_long => 'Door Opening';

  @override
  String get sensor_enum_door_closing => 'Closing';

  @override
  String get sensor_enum_door_closing_long => 'Door Closing';

  @override
  String get sensor_enum_door_stopped => 'Stopped';

  @override
  String get sensor_enum_door_stopped_long => 'Door Stopped';

  @override
  String get sensor_enum_lock_locked => 'Locked';

  @override
  String get sensor_enum_lock_locked_long => 'Lock Locked';

  @override
  String get sensor_enum_lock_unlocked => 'Open';

  @override
  String get sensor_enum_lock_unlocked_long => 'Lock Unlocked';

  @override
  String get sensor_enum_camera_available => 'On';

  @override
  String get sensor_enum_camera_available_long => 'Camera Available';

  @override
  String get sensor_enum_camera_in_use => 'In Use';

  @override
  String get sensor_enum_camera_in_use_long => 'Camera In Use';

  @override
  String get sensor_enum_camera_unavailable => 'N/A';

  @override
  String get sensor_enum_camera_unavailable_long => 'Camera Unavailable';

  @override
  String get sensor_enum_camera_offline => 'Off';

  @override
  String get sensor_enum_camera_offline_long => 'Camera Offline';

  @override
  String get sensor_enum_camera_initializing => 'Init';

  @override
  String get sensor_enum_camera_initializing_long => 'Camera Initializing';

  @override
  String get sensor_enum_camera_error => 'Err';

  @override
  String get sensor_enum_camera_error_long => 'Camera Error';

  @override
  String get sensor_enum_device_info_connected => 'On';

  @override
  String get sensor_enum_device_info_connected_long => 'Connected';

  @override
  String get sensor_enum_device_info_disconnected => 'Off';

  @override
  String get sensor_enum_device_info_disconnected_long => 'Disconnected';

  @override
  String get sensor_enum_device_info_init => 'Init';

  @override
  String get sensor_enum_device_info_init_long => 'Initializing';

  @override
  String get sensor_enum_device_info_ready => 'Ready';

  @override
  String get sensor_enum_device_info_ready_long => 'Ready';

  @override
  String get sensor_enum_device_info_running => 'Run';

  @override
  String get sensor_enum_device_info_running_long => 'Running';

  @override
  String get sensor_enum_device_info_sleeping => 'Sleep';

  @override
  String get sensor_enum_device_info_sleeping_long => 'Sleeping';

  @override
  String get sensor_enum_device_info_stopped => 'Stop';

  @override
  String get sensor_enum_device_info_stopped_long => 'Stopped';

  @override
  String get sensor_enum_device_info_lost => 'Lost';

  @override
  String get sensor_enum_device_info_lost_long => 'Connection Lost';

  @override
  String get sensor_enum_device_info_alert => 'Alert';

  @override
  String get sensor_enum_device_info_alert_long => 'Alert';

  @override
  String get sensor_enum_device_info_unknown => 'N/A';

  @override
  String get sensor_enum_device_info_unknown_long => 'Unknown';

  @override
  String get sensor_freshness_live => 'Live';

  @override
  String get sensor_freshness_stale => 'Stale';

  @override
  String get sensor_freshness_offline => 'Offline';

  @override
  String get media_input_select_title => 'Select Input';

  @override
  String get media_input_hdmi1 => 'HDMI 1';

  @override
  String get media_input_hdmi2 => 'HDMI 2';

  @override
  String get media_input_hdmi3 => 'HDMI 3';

  @override
  String get media_input_hdmi4 => 'HDMI 4';

  @override
  String get media_input_hdmi5 => 'HDMI 5';

  @override
  String get media_input_hdmi6 => 'HDMI 6';

  @override
  String get media_input_arc => 'ARC';

  @override
  String get media_input_earc => 'eARC';

  @override
  String get media_input_tv => 'TV';

  @override
  String get media_input_cable => 'Cable';

  @override
  String get media_input_satellite => 'Satellite';

  @override
  String get media_input_antenna => 'Antenna';

  @override
  String get media_input_av1 => 'AV 1';

  @override
  String get media_input_av2 => 'AV 2';

  @override
  String get media_input_component => 'Component';

  @override
  String get media_input_vga => 'VGA';

  @override
  String get media_input_dvi => 'DVI';

  @override
  String get media_input_usb => 'USB';

  @override
  String get media_input_bluetooth => 'Bluetooth';

  @override
  String get media_input_wifi => 'Wi-Fi';

  @override
  String get media_input_airplay => 'AirPlay';

  @override
  String get media_input_cast => 'Chromecast';

  @override
  String get media_input_dlna => 'DLNA';

  @override
  String get media_input_miracast => 'Miracast';

  @override
  String get media_input_app_netflix => 'Netflix';

  @override
  String get media_input_app_youtube => 'YouTube';

  @override
  String get media_input_app_spotify => 'Spotify';

  @override
  String get media_input_app_prime_video => 'Prime Video';

  @override
  String get media_input_app_disney_plus => 'Disney+';

  @override
  String get media_input_app_hbo_max => 'HBO Max';

  @override
  String get media_input_app_apple_tv => 'Apple TV';

  @override
  String get media_input_app_plex => 'Plex';

  @override
  String get media_input_app_kodi => 'Kodi';

  @override
  String get media_input_other => 'Other';

  @override
  String get media_off_title => 'Media Off';

  @override
  String get media_off_subtitle => 'Select an activity to begin';

  @override
  String media_starting_activity(String activityName) {
    return 'Starting $activityName...';
  }

  @override
  String media_activity_failed(String activityName) {
    return '$activityName Failed';
  }

  @override
  String get media_activity_failed_description => 'Activity failed to apply. Check device connectivity.';

  @override
  String get media_activity_retry => 'Retry';

  @override
  String get media_activity_turn_off => 'Turn Off';

  @override
  String get media_warning_audio_offline => 'Audio output offline – using display speakers';

  @override
  String get media_warning_some_devices_offline => 'Some devices offline';

  @override
  String media_warning_steps_failed(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'warnings',
      one: 'warning',
    );
    return 'Some steps failed ($count $_temp0)';
  }

  @override
  String get media_warning_steps_had_issues => 'Some steps had issues';

  @override
  String get media_remote => 'Remote';

  @override
  String get media_remote_control => 'Remote Control';

  @override
  String media_volume_percent(int volume) {
    return '$volume%';
  }

  @override
  String get media_failure_details_title => 'Activation Details';

  @override
  String get media_failure_summary_total => 'Total';

  @override
  String get media_failure_summary_ok => 'OK';

  @override
  String get media_failure_summary_errors => 'Errors';

  @override
  String get media_failure_summary_warnings => 'Warnings';

  @override
  String get media_failure_errors_critical => 'Errors (critical)';

  @override
  String get media_failure_warnings_non_critical => 'Warnings (non-critical)';

  @override
  String get media_failure_warnings_label => 'Warnings';

  @override
  String get media_failure_retry_activity => 'Retry activity';

  @override
  String get media_failure_deactivate => 'Deactivate';

  @override
  String media_failure_device_label(String deviceId) {
    return 'Device: $deviceId';
  }

  @override
  String media_failure_inline(int errors, int warnings) {
    String _temp0 = intl.Intl.pluralLogic(
      errors,
      locale: localeName,
      other: 'errors',
      one: 'error',
    );
    String _temp1 = intl.Intl.pluralLogic(
      warnings,
      locale: localeName,
      other: 'warnings',
      one: 'warning',
    );
    return 'Activity failed to apply ($errors $_temp0, $warnings $_temp1)';
  }

  @override
  String get media_activity_watch => 'Watch';

  @override
  String get media_activity_listen => 'Listen';

  @override
  String get media_activity_gaming => 'Gaming';

  @override
  String get media_activity_background => 'Bgnd';

  @override
  String get media_activity_off => 'Off';

  @override
  String media_activity_active(String activityName) {
    return '$activityName active';
  }

  @override
  String get media_status_standby => 'Standby';

  @override
  String get media_status_activating => 'Activating...';

  @override
  String get media_status_failed => 'Failed';

  @override
  String get media_status_stopping => 'Stopping...';

  @override
  String get media_status_active_with_issues => 'Active with issues';

  @override
  String get media_status_active => 'Active';

  @override
  String get media_status_ready => 'Ready';

  @override
  String get media_remote_up => 'Up';

  @override
  String get media_remote_down => 'Down';

  @override
  String get media_remote_left => 'Left';

  @override
  String get media_remote_right => 'Right';

  @override
  String get media_remote_ok => 'OK';

  @override
  String get media_remote_back => 'Back';

  @override
  String get media_remote_exit => 'Exit';

  @override
  String get media_remote_info => 'Info';

  @override
  String get media_remote_rewind => 'Rewind';

  @override
  String get media_remote_fast_forward => 'FF';

  @override
  String get media_remote_play => 'Play';

  @override
  String get media_remote_pause => 'Pause';

  @override
  String get media_remote_next => 'Next';

  @override
  String get media_remote_prev => 'Prev';

  @override
  String get media_detail_connection_lost => 'Connection lost';

  @override
  String get media_detail_connection_lost_description => 'Media controls require a live WebSocket connection.';

  @override
  String get media_detail_go_back => 'Go back';

  @override
  String get media_detail_section_display => 'Display';

  @override
  String get media_detail_section_audio => 'Audio';

  @override
  String get media_detail_section_source => 'Source';

  @override
  String get media_detail_section_remote => 'Remote';

  @override
  String get media_detail_input => 'Input';

  @override
  String get media_detail_select => 'Select';

  @override
  String get media_detail_now_playing => 'Now Playing';

  @override
  String get media_detail_no_track_info => 'No track information available';

  @override
  String get media_detail_home => 'Home';

  @override
  String get media_detail_menu => 'Menu';

  @override
  String get media_playback => 'Playback';

  @override
  String get filter_all => 'All';

  @override
  String sensor_alert_high_title(String name) {
    return 'High $name Alert';
  }

  @override
  String sensor_alert_exceeded_threshold(String name) {
    return '$name exceeded threshold';
  }

  @override
  String get sensor_state_detected => 'Detected';

  @override
  String get sensor_state_not_detected => 'Not Detected';

  @override
  String get sensor_state_clear => 'Clear';

  @override
  String get sensor_state_open => 'Open';

  @override
  String get sensor_state_closed => 'Closed';

  @override
  String get sensor_state_active => 'Active';

  @override
  String get sensor_state_inactive => 'Inactive';

  @override
  String get sensor_state_occupied => 'Occupied';

  @override
  String get sensor_state_unoccupied => 'Unoccupied';

  @override
  String get sensor_state_smoke_detected => 'Smoke detected';

  @override
  String get sensor_state_gas_detected => 'Gas detected';

  @override
  String get sensor_state_leak_detected => 'Leak detected';

  @override
  String get sensor_state_co_detected => 'CO detected';

  @override
  String get sensor_label_temperature => 'Temperature';

  @override
  String get sensor_label_humidity => 'Humidity';

  @override
  String get sensor_label_pressure => 'Pressure';

  @override
  String get sensor_label_illuminance => 'Illuminance';

  @override
  String get sensor_label_carbon_dioxide => 'Carbon Dioxide';

  @override
  String get sensor_label_carbon_monoxide => 'Carbon Monoxide';

  @override
  String get sensor_label_ozone => 'Ozone';

  @override
  String get sensor_label_nitrogen_dioxide => 'Nitrogen Dioxide';

  @override
  String get sensor_label_sulphur_dioxide => 'Sulphur Dioxide';

  @override
  String get sensor_label_voc => 'VOC';

  @override
  String get sensor_label_particulate_matter => 'Particulate Matter';

  @override
  String get sensor_label_motion => 'Motion';

  @override
  String get sensor_label_occupancy => 'Occupancy';

  @override
  String get sensor_label_contact => 'Contact';

  @override
  String get sensor_label_leak => 'Leak';

  @override
  String get sensor_label_smoke => 'Smoke';

  @override
  String get sensor_label_battery => 'Battery';

  @override
  String get sensor_label_alarm => 'Alarm';

  @override
  String get sensor_label_door => 'Door';

  @override
  String get sensor_label_lock => 'Lock';

  @override
  String get sensor_label_camera => 'Camera';

  @override
  String get sensor_label_filter => 'Filter';

  @override
  String get sensor_label_device_info => 'Device Info';

  @override
  String get sensor_label_gas => 'Gas';

  @override
  String get sensor_label_electrical_energy => 'Energy';

  @override
  String get sensor_label_electrical_generation => 'Generation';

  @override
  String get sensor_label_electrical_power => 'Power';

  @override
  String get sensor_alert_high_level => 'High Level';

  @override
  String get sensor_alert_low_battery => 'Low Battery';

  @override
  String get sensor_alert_charging => 'Charging';

  @override
  String get sensor_category_temperature => 'Temperature';

  @override
  String get sensor_category_humidity => 'Humidity';

  @override
  String get sensor_category_air_quality => 'Air Quality';

  @override
  String get sensor_category_motion => 'Motion';

  @override
  String get sensor_category_safety => 'Safety';

  @override
  String get sensor_category_light => 'Light';

  @override
  String get sensor_category_energy => 'Energy';

  @override
  String get sensor_ui_event_log => 'Event Log';

  @override
  String get sensor_ui_history => 'History';

  @override
  String get sensor_ui_current => 'Current';

  @override
  String sensor_ui_current_value(String name) {
    return 'Current $name';
  }

  @override
  String get sensor_ui_min => 'Min';

  @override
  String get sensor_ui_max => 'Max';

  @override
  String get sensor_ui_avg => 'Avg';

  @override
  String sensor_ui_period_min(String period) {
    return '$period Min';
  }

  @override
  String sensor_ui_period_max(String period) {
    return '$period Max';
  }

  @override
  String sensor_ui_period_avg(String period) {
    return '$period Avg';
  }

  @override
  String get sensor_ui_online => 'Online';

  @override
  String get sensor_ui_offline => 'Offline';

  @override
  String get sensor_ui_period_1h => '1H';

  @override
  String get sensor_ui_period_24h => '24H';

  @override
  String get sensor_ui_period_7d => '7D';

  @override
  String get sensor_ui_period_30d => '30D';

  @override
  String get sensor_empty_no_events => 'No events recorded';

  @override
  String get sensor_empty_no_state_changes => 'No state changes';

  @override
  String get sensor_empty_no_history => 'No history data available';

  @override
  String get sensor_empty_no_data => 'No data available';

  @override
  String get sensor_status_loading => 'Loading data...';

  @override
  String get sensor_status_failed => 'Failed to load data';

  @override
  String get sensor_status_retry => 'Retry';

  @override
  String get sensors_domain_title => 'Sensors';

  @override
  String get sensors_domain_empty_title => 'No Sensors';

  @override
  String get sensors_domain_empty_description => 'No sensors are assigned to this room yet.';

  @override
  String sensors_domain_alerts_active(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Alerts Active',
      one: 'Alert Active',
    );
    return '$_temp0';
  }

  @override
  String get sensors_domain_no_sensors => 'No sensors configured';

  @override
  String sensors_domain_health_stale(int count) {
    return '$count stale';
  }

  @override
  String sensors_domain_health_offline(int count) {
    return '$count offline';
  }

  @override
  String get sensors_domain_health_normal => 'All normal';

  @override
  String get sensors_domain_avg_temperature => 'Avg Temperature';

  @override
  String get sensors_domain_avg_humidity => 'Avg Humidity';

  @override
  String get sensors_domain_all_sensors => 'All sensors';

  @override
  String sensors_domain_sensor_count(int count) {
    return '$count sensors';
  }

  @override
  String get security_tab_entry_points => 'Entry Points';

  @override
  String get security_tab_alerts => 'Alerts';

  @override
  String get security_tab_events => 'Events';

  @override
  String get security_header_recent_events => 'Recent Events';

  @override
  String get security_status_triggered => 'Triggered';

  @override
  String get security_status_warning => 'Warning';

  @override
  String get security_status_secure => 'Secure';

  @override
  String get security_armed_disarmed => 'Disarmed';

  @override
  String get security_armed_home => 'Armed Home';

  @override
  String get security_armed_away => 'Armed Away';

  @override
  String get security_armed_night => 'Armed Night';

  @override
  String get security_armed_unknown => 'Unknown';

  @override
  String get security_alarm_idle => 'Idle';

  @override
  String get security_alarm_pending => 'Pending';

  @override
  String get security_alarm_triggered => 'Triggered';

  @override
  String get security_alarm_silenced => 'Silenced';

  @override
  String get security_alarm_unknown => 'Unknown';

  @override
  String security_entry_open_count(int count) {
    return '$count Open';
  }

  @override
  String get security_entry_all_secure => 'All Secure';

  @override
  String get security_entry_status_breach => 'Breach';

  @override
  String get security_entry_status_open => 'Open';

  @override
  String get security_entry_status_unknown => 'Unknown';

  @override
  String get security_entry_status_closed => 'Closed';

  @override
  String security_summary_all_clear(int count) {
    return 'All clear · $count entry points secured';
  }

  @override
  String security_summary_alerts(int count) {
    return '$count alerts';
  }

  @override
  String security_summary_entry_points_open(int count) {
    return '$count entry points open';
  }

  @override
  String get security_no_active_alerts => 'No active alerts';

  @override
  String get security_ack_all => 'Ack All';

  @override
  String get security_no_recent_events => 'No recent events';

  @override
  String get security_events_load_failed => 'Failed to load events';

  @override
  String get security_retry => 'Retry';

  @override
  String get security_alert_type_intrusion => 'Intrusion detected';

  @override
  String get security_alert_type_entry_open => 'Entry open';

  @override
  String get security_alert_type_smoke => 'Smoke detected';

  @override
  String get security_alert_type_co => 'CO detected';

  @override
  String get security_alert_type_water_leak => 'Water leak';

  @override
  String get security_alert_type_gas => 'Gas detected';

  @override
  String get security_alert_type_tamper => 'Tamper detected';

  @override
  String get security_alert_type_fault => 'System fault';

  @override
  String get security_alert_type_device_offline => 'Device offline';

  @override
  String get security_alert_type_unknown => 'Unknown';

  @override
  String get security_event_alert_raised => 'Alert Raised';

  @override
  String get security_event_alert_resolved => 'Alert Resolved';

  @override
  String get security_event_alert_acknowledged => 'Alert Acknowledged';

  @override
  String get security_event_alarm_state_changed => 'Alarm State Changed';

  @override
  String get security_event_arming_mode_changed => 'Arming Mode Changed';

  @override
  String security_event_title_alert_raised(String alertType) {
    return 'Alert raised: $alertType';
  }

  @override
  String security_event_title_alert_resolved(String alertType) {
    return 'Alert resolved: $alertType';
  }

  @override
  String security_event_title_alert_acknowledged(String alertType) {
    return 'Alert acknowledged: $alertType';
  }

  @override
  String security_event_title_alarm_state_changed(String from, String to) {
    return 'Alarm state changed: $from → $to';
  }

  @override
  String security_event_title_arming_mode_changed(String from, String to) {
    return 'Arming mode changed: $from → $to';
  }

  @override
  String security_state_transition(String from, String to) {
    return '$from → $to';
  }

  @override
  String get security_state_unknown => 'unknown';

  @override
  String get security_overlay_alarm_triggered => 'Alarm triggered';

  @override
  String get security_overlay_default_title => 'Security alert';
}
