// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_update_device.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesUpdateDevice _$DevicesUpdateDeviceFromJson(Map<String, dynamic> json) {
  return _DevicesUpdateDevice.fromJson(json);
}

/// @nodoc
mixin _$DevicesUpdateDevice {
  /// Human-readable name of the device.
  String get name => throw _privateConstructorUsedError;

  /// Optional detailed description of the device.
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this DevicesUpdateDevice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesUpdateDeviceCopyWith<DevicesUpdateDevice> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesUpdateDeviceCopyWith<$Res> {
  factory $DevicesUpdateDeviceCopyWith(
          DevicesUpdateDevice value, $Res Function(DevicesUpdateDevice) then) =
      _$DevicesUpdateDeviceCopyWithImpl<$Res, DevicesUpdateDevice>;
  @useResult
  $Res call({String name, String? description});
}

/// @nodoc
class _$DevicesUpdateDeviceCopyWithImpl<$Res, $Val extends DevicesUpdateDevice>
    implements $DevicesUpdateDeviceCopyWith<$Res> {
  _$DevicesUpdateDeviceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? description = freezed,
  }) {
    return _then(_value.copyWith(
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesUpdateDeviceImplCopyWith<$Res>
    implements $DevicesUpdateDeviceCopyWith<$Res> {
  factory _$$DevicesUpdateDeviceImplCopyWith(_$DevicesUpdateDeviceImpl value,
          $Res Function(_$DevicesUpdateDeviceImpl) then) =
      __$$DevicesUpdateDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String name, String? description});
}

/// @nodoc
class __$$DevicesUpdateDeviceImplCopyWithImpl<$Res>
    extends _$DevicesUpdateDeviceCopyWithImpl<$Res, _$DevicesUpdateDeviceImpl>
    implements _$$DevicesUpdateDeviceImplCopyWith<$Res> {
  __$$DevicesUpdateDeviceImplCopyWithImpl(_$DevicesUpdateDeviceImpl _value,
      $Res Function(_$DevicesUpdateDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? description = freezed,
  }) {
    return _then(_$DevicesUpdateDeviceImpl(
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
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
class _$DevicesUpdateDeviceImpl implements _DevicesUpdateDevice {
  const _$DevicesUpdateDeviceImpl({required this.name, this.description});

  factory _$DevicesUpdateDeviceImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesUpdateDeviceImplFromJson(json);

  /// Human-readable name of the device.
  @override
  final String name;

  /// Optional detailed description of the device.
  @override
  final String? description;

  @override
  String toString() {
    return 'DevicesUpdateDevice(name: $name, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesUpdateDeviceImpl &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, name, description);

  /// Create a copy of DevicesUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesUpdateDeviceImplCopyWith<_$DevicesUpdateDeviceImpl> get copyWith =>
      __$$DevicesUpdateDeviceImplCopyWithImpl<_$DevicesUpdateDeviceImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesUpdateDeviceImplToJson(
      this,
    );
  }
}

abstract class _DevicesUpdateDevice implements DevicesUpdateDevice {
  const factory _DevicesUpdateDevice(
      {required final String name,
      final String? description}) = _$DevicesUpdateDeviceImpl;

  factory _DevicesUpdateDevice.fromJson(Map<String, dynamic> json) =
      _$DevicesUpdateDeviceImpl.fromJson;

  /// Human-readable name of the device.
  @override
  String get name;

  /// Optional detailed description of the device.
  @override
  String? get description;

  /// Create a copy of DevicesUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesUpdateDeviceImplCopyWith<_$DevicesUpdateDeviceImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
