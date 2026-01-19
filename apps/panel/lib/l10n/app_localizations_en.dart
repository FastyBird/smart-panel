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
  String get climate_role_auxiliary => 'Auxiliary';

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
  String get battery_title => 'Battery';

  @override
  String get config_error_title => 'Configuration Required';

  @override
  String get config_error_hint => 'Configure this display in Admin > Displays';

  @override
  String get button_retry => 'Retry';

  @override
  String get system_view_room => 'Room';

  @override
  String get system_view_master => 'Home';

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
  String get domain_sensors => 'Sensors';

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
  String get voc_level_good => 'Good';

  @override
  String get voc_level_moderate => 'Moderate';

  @override
  String get voc_level_poor => 'Poor';

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
  String get device_timer => 'Timer';

  @override
  String get device_child_lock => 'Child Lock';

  @override
  String get device_oscillation => 'Oscillation';

  @override
  String get device_direction => 'Direction';

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
  String get device_humidity => 'Humidity';

  @override
  String get device_air_quality_index => 'Air Quality Index';

  @override
  String get device_temperature => 'Temp';

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
}
