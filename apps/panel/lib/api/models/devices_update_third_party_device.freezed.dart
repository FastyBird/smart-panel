// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_update_third_party_device.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesUpdateThirdPartyDevice _$DevicesUpdateThirdPartyDeviceFromJson(
    Map<String, dynamic> json) {
  return _DevicesUpdateThirdPartyDevice.fromJson(json);
}

/// @nodoc
mixin _$DevicesUpdateThirdPartyDevice {
  /// Human-readable name of the device.
  String get name => throw _privateConstructorUsedError;

  /// The address of the third-party service used by the third-party device. It can be a URL or IP address with an optional port.
  @JsonKey(name: 'service_address')
  String get serviceAddress => throw _privateConstructorUsedError;

  /// Specifies the type of device. This value is fixed as 'third-party' for third-party device integrations.
  String get type => throw _privateConstructorUsedError;

  /// Optional detailed description of the device.
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this DevicesUpdateThirdPartyDevice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesUpdateThirdPartyDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesUpdateThirdPartyDeviceCopyWith<DevicesUpdateThirdPartyDevice>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesUpdateThirdPartyDeviceCopyWith<$Res> {
  factory $DevicesUpdateThirdPartyDeviceCopyWith(
          DevicesUpdateThirdPartyDevice value,
          $Res Function(DevicesUpdateThirdPartyDevice) then) =
      _$DevicesUpdateThirdPartyDeviceCopyWithImpl<$Res,
          DevicesUpdateThirdPartyDevice>;
  @useResult
  $Res call(
      {String name,
      @JsonKey(name: 'service_address') String serviceAddress,
      String type,
      String? description});
}

/// @nodoc
class _$DevicesUpdateThirdPartyDeviceCopyWithImpl<$Res,
        $Val extends DevicesUpdateThirdPartyDevice>
    implements $DevicesUpdateThirdPartyDeviceCopyWith<$Res> {
  _$DevicesUpdateThirdPartyDeviceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesUpdateThirdPartyDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? serviceAddress = null,
    Object? type = null,
    Object? description = freezed,
  }) {
    return _then(_value.copyWith(
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
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
abstract class _$$DevicesUpdateThirdPartyDeviceImplCopyWith<$Res>
    implements $DevicesUpdateThirdPartyDeviceCopyWith<$Res> {
  factory _$$DevicesUpdateThirdPartyDeviceImplCopyWith(
          _$DevicesUpdateThirdPartyDeviceImpl value,
          $Res Function(_$DevicesUpdateThirdPartyDeviceImpl) then) =
      __$$DevicesUpdateThirdPartyDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String name,
      @JsonKey(name: 'service_address') String serviceAddress,
      String type,
      String? description});
}

/// @nodoc
class __$$DevicesUpdateThirdPartyDeviceImplCopyWithImpl<$Res>
    extends _$DevicesUpdateThirdPartyDeviceCopyWithImpl<$Res,
        _$DevicesUpdateThirdPartyDeviceImpl>
    implements _$$DevicesUpdateThirdPartyDeviceImplCopyWith<$Res> {
  __$$DevicesUpdateThirdPartyDeviceImplCopyWithImpl(
      _$DevicesUpdateThirdPartyDeviceImpl _value,
      $Res Function(_$DevicesUpdateThirdPartyDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesUpdateThirdPartyDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? serviceAddress = null,
    Object? type = null,
    Object? description = freezed,
  }) {
    return _then(_$DevicesUpdateThirdPartyDeviceImpl(
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
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
class _$DevicesUpdateThirdPartyDeviceImpl
    implements _DevicesUpdateThirdPartyDevice {
  const _$DevicesUpdateThirdPartyDeviceImpl(
      {required this.name,
      @JsonKey(name: 'service_address') required this.serviceAddress,
      this.type = 'third-party',
      this.description});

  factory _$DevicesUpdateThirdPartyDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesUpdateThirdPartyDeviceImplFromJson(json);

  /// Human-readable name of the device.
  @override
  final String name;

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
    return 'DevicesUpdateThirdPartyDevice(name: $name, serviceAddress: $serviceAddress, type: $type, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesUpdateThirdPartyDeviceImpl &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.serviceAddress, serviceAddress) ||
                other.serviceAddress == serviceAddress) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, name, serviceAddress, type, description);

  /// Create a copy of DevicesUpdateThirdPartyDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesUpdateThirdPartyDeviceImplCopyWith<
          _$DevicesUpdateThirdPartyDeviceImpl>
      get copyWith => __$$DevicesUpdateThirdPartyDeviceImplCopyWithImpl<
          _$DevicesUpdateThirdPartyDeviceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesUpdateThirdPartyDeviceImplToJson(
      this,
    );
  }
}

abstract class _DevicesUpdateThirdPartyDevice
    implements DevicesUpdateThirdPartyDevice {
  const factory _DevicesUpdateThirdPartyDevice(
      {required final String name,
      @JsonKey(name: 'service_address') required final String serviceAddress,
      final String type,
      final String? description}) = _$DevicesUpdateThirdPartyDeviceImpl;

  factory _DevicesUpdateThirdPartyDevice.fromJson(Map<String, dynamic> json) =
      _$DevicesUpdateThirdPartyDeviceImpl.fromJson;

  /// Human-readable name of the device.
  @override
  String get name;

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

  /// Create a copy of DevicesUpdateThirdPartyDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesUpdateThirdPartyDeviceImplCopyWith<
          _$DevicesUpdateThirdPartyDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
