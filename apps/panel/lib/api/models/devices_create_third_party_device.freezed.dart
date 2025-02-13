// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_create_third_party_device.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesCreateThirdPartyDevice _$DevicesCreateThirdPartyDeviceFromJson(
    Map<String, dynamic> json) {
  return _DevicesCreateThirdPartyDevice.fromJson(json);
}

/// @nodoc
mixin _$DevicesCreateThirdPartyDevice {
  /// Unique identifier for the device. Optional during creation and system-generated if not provided.
  String get id => throw _privateConstructorUsedError;

  /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
  DevicesDeviceCategory get category => throw _privateConstructorUsedError;

  /// Human-readable name of the device.
  String get name => throw _privateConstructorUsedError;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  List<DevicesCreateDeviceControl> get controls =>
      throw _privateConstructorUsedError;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  List<DevicesCreateDeviceChannel> get channels =>
      throw _privateConstructorUsedError;

  /// The address of the third-party service used by the third-party device. It can be a URL or IP address with an optional port.
  @JsonKey(name: 'service_address')
  String get serviceAddress => throw _privateConstructorUsedError;

  /// Specifies the type of device. This value is fixed as 'third-party' for third-party device integrations.
  String get type => throw _privateConstructorUsedError;

  /// Optional detailed description of the device.
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this DevicesCreateThirdPartyDevice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesCreateThirdPartyDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesCreateThirdPartyDeviceCopyWith<DevicesCreateThirdPartyDevice>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesCreateThirdPartyDeviceCopyWith<$Res> {
  factory $DevicesCreateThirdPartyDeviceCopyWith(
          DevicesCreateThirdPartyDevice value,
          $Res Function(DevicesCreateThirdPartyDevice) then) =
      _$DevicesCreateThirdPartyDeviceCopyWithImpl<$Res,
          DevicesCreateThirdPartyDevice>;
  @useResult
  $Res call(
      {String id,
      DevicesDeviceCategory category,
      String name,
      List<DevicesCreateDeviceControl> controls,
      List<DevicesCreateDeviceChannel> channels,
      @JsonKey(name: 'service_address') String serviceAddress,
      String type,
      String? description});
}

/// @nodoc
class _$DevicesCreateThirdPartyDeviceCopyWithImpl<$Res,
        $Val extends DevicesCreateThirdPartyDevice>
    implements $DevicesCreateThirdPartyDeviceCopyWith<$Res> {
  _$DevicesCreateThirdPartyDeviceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesCreateThirdPartyDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? category = null,
    Object? name = null,
    Object? controls = null,
    Object? channels = null,
    Object? serviceAddress = null,
    Object? type = null,
    Object? description = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as DevicesDeviceCategory,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      controls: null == controls
          ? _value.controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesCreateDeviceControl>,
      channels: null == channels
          ? _value.channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<DevicesCreateDeviceChannel>,
      serviceAddress: null == serviceAddress
          ? _value.serviceAddress
          : serviceAddress // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesCreateThirdPartyDeviceImplCopyWith<$Res>
    implements $DevicesCreateThirdPartyDeviceCopyWith<$Res> {
  factory _$$DevicesCreateThirdPartyDeviceImplCopyWith(
          _$DevicesCreateThirdPartyDeviceImpl value,
          $Res Function(_$DevicesCreateThirdPartyDeviceImpl) then) =
      __$$DevicesCreateThirdPartyDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      DevicesDeviceCategory category,
      String name,
      List<DevicesCreateDeviceControl> controls,
      List<DevicesCreateDeviceChannel> channels,
      @JsonKey(name: 'service_address') String serviceAddress,
      String type,
      String? description});
}

/// @nodoc
class __$$DevicesCreateThirdPartyDeviceImplCopyWithImpl<$Res>
    extends _$DevicesCreateThirdPartyDeviceCopyWithImpl<$Res,
        _$DevicesCreateThirdPartyDeviceImpl>
    implements _$$DevicesCreateThirdPartyDeviceImplCopyWith<$Res> {
  __$$DevicesCreateThirdPartyDeviceImplCopyWithImpl(
      _$DevicesCreateThirdPartyDeviceImpl _value,
      $Res Function(_$DevicesCreateThirdPartyDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesCreateThirdPartyDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? category = null,
    Object? name = null,
    Object? controls = null,
    Object? channels = null,
    Object? serviceAddress = null,
    Object? type = null,
    Object? description = freezed,
  }) {
    return _then(_$DevicesCreateThirdPartyDeviceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as DevicesDeviceCategory,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      controls: null == controls
          ? _value._controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesCreateDeviceControl>,
      channels: null == channels
          ? _value._channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<DevicesCreateDeviceChannel>,
      serviceAddress: null == serviceAddress
          ? _value.serviceAddress
          : serviceAddress // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesCreateThirdPartyDeviceImpl
    implements _DevicesCreateThirdPartyDevice {
  const _$DevicesCreateThirdPartyDeviceImpl(
      {required this.id,
      required this.category,
      required this.name,
      required final List<DevicesCreateDeviceControl> controls,
      required final List<DevicesCreateDeviceChannel> channels,
      @JsonKey(name: 'service_address') required this.serviceAddress,
      this.type = 'third-party',
      this.description})
      : _controls = controls,
        _channels = channels;

  factory _$DevicesCreateThirdPartyDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesCreateThirdPartyDeviceImplFromJson(json);

  /// Unique identifier for the device. Optional during creation and system-generated if not provided.
  @override
  final String id;

  /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
  @override
  final DevicesDeviceCategory category;

  /// Human-readable name of the device.
  @override
  final String name;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  final List<DevicesCreateDeviceControl> _controls;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  @override
  List<DevicesCreateDeviceControl> get controls {
    if (_controls is EqualUnmodifiableListView) return _controls;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_controls);
  }

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  final List<DevicesCreateDeviceChannel> _channels;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  @override
  List<DevicesCreateDeviceChannel> get channels {
    if (_channels is EqualUnmodifiableListView) return _channels;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_channels);
  }

  /// The address of the third-party service used by the third-party device. It can be a URL or IP address with an optional port.
  @override
  @JsonKey(name: 'service_address')
  final String serviceAddress;

  /// Specifies the type of device. This value is fixed as 'third-party' for third-party device integrations.
  @override
  @JsonKey()
  final String type;

  /// Optional detailed description of the device.
  @override
  final String? description;

  @override
  String toString() {
    return 'DevicesCreateThirdPartyDevice(id: $id, category: $category, name: $name, controls: $controls, channels: $channels, serviceAddress: $serviceAddress, type: $type, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesCreateThirdPartyDeviceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.name, name) || other.name == name) &&
            const DeepCollectionEquality().equals(other._controls, _controls) &&
            const DeepCollectionEquality().equals(other._channels, _channels) &&
            (identical(other.serviceAddress, serviceAddress) ||
                other.serviceAddress == serviceAddress) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      category,
      name,
      const DeepCollectionEquality().hash(_controls),
      const DeepCollectionEquality().hash(_channels),
      serviceAddress,
      type,
      description);

  /// Create a copy of DevicesCreateThirdPartyDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesCreateThirdPartyDeviceImplCopyWith<
          _$DevicesCreateThirdPartyDeviceImpl>
      get copyWith => __$$DevicesCreateThirdPartyDeviceImplCopyWithImpl<
          _$DevicesCreateThirdPartyDeviceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesCreateThirdPartyDeviceImplToJson(
      this,
    );
  }
}

abstract class _DevicesCreateThirdPartyDevice
    implements DevicesCreateThirdPartyDevice {
  const factory _DevicesCreateThirdPartyDevice(
      {required final String id,
      required final DevicesDeviceCategory category,
      required final String name,
      required final List<DevicesCreateDeviceControl> controls,
      required final List<DevicesCreateDeviceChannel> channels,
      @JsonKey(name: 'service_address') required final String serviceAddress,
      final String type,
      final String? description}) = _$DevicesCreateThirdPartyDeviceImpl;

  factory _DevicesCreateThirdPartyDevice.fromJson(Map<String, dynamic> json) =
      _$DevicesCreateThirdPartyDeviceImpl.fromJson;

  /// Unique identifier for the device. Optional during creation and system-generated if not provided.
  @override
  String get id;

  /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
  @override
  DevicesDeviceCategory get category;

  /// Human-readable name of the device.
  @override
  String get name;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  @override
  List<DevicesCreateDeviceControl> get controls;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  @override
  List<DevicesCreateDeviceChannel> get channels;

  /// The address of the third-party service used by the third-party device. It can be a URL or IP address with an optional port.
  @override
  @JsonKey(name: 'service_address')
  String get serviceAddress;

  /// Specifies the type of device. This value is fixed as 'third-party' for third-party device integrations.
  @override
  String get type;

  /// Optional detailed description of the device.
  @override
  String? get description;

  /// Create a copy of DevicesCreateThirdPartyDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesCreateThirdPartyDeviceImplCopyWith<
          _$DevicesCreateThirdPartyDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
