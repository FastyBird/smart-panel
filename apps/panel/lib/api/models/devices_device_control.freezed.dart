// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_device_control.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesDeviceControl _$DevicesDeviceControlFromJson(Map<String, dynamic> json) {
  return _DevicesDeviceControl.fromJson(json);
}

/// @nodoc
mixin _$DevicesDeviceControl {
  /// System-generated unique identifier for the control.
  String get id => throw _privateConstructorUsedError;

  /// The name of the control, representing the action it performs.
  String get name => throw _privateConstructorUsedError;

  /// The device to which this control belongs.
  String get device => throw _privateConstructorUsedError;

  /// Timestamp when the control was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Timestamp when the control was last updated, if applicable.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this DevicesDeviceControl to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesDeviceControlCopyWith<DevicesDeviceControl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesDeviceControlCopyWith<$Res> {
  factory $DevicesDeviceControlCopyWith(DevicesDeviceControl value,
          $Res Function(DevicesDeviceControl) then) =
      _$DevicesDeviceControlCopyWithImpl<$Res, DevicesDeviceControl>;
  @useResult
  $Res call(
      {String id,
      String name,
      String device,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class _$DevicesDeviceControlCopyWithImpl<$Res,
        $Val extends DevicesDeviceControl>
    implements $DevicesDeviceControlCopyWith<$Res> {
  _$DevicesDeviceControlCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? device = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesDeviceControlImplCopyWith<$Res>
    implements $DevicesDeviceControlCopyWith<$Res> {
  factory _$$DevicesDeviceControlImplCopyWith(_$DevicesDeviceControlImpl value,
          $Res Function(_$DevicesDeviceControlImpl) then) =
      __$$DevicesDeviceControlImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String name,
      String device,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class __$$DevicesDeviceControlImplCopyWithImpl<$Res>
    extends _$DevicesDeviceControlCopyWithImpl<$Res, _$DevicesDeviceControlImpl>
    implements _$$DevicesDeviceControlImplCopyWith<$Res> {
  __$$DevicesDeviceControlImplCopyWithImpl(_$DevicesDeviceControlImpl _value,
      $Res Function(_$DevicesDeviceControlImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? device = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
  }) {
    return _then(_$DevicesDeviceControlImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesDeviceControlImpl implements _DevicesDeviceControl {
  const _$DevicesDeviceControlImpl(
      {required this.id,
      required this.name,
      required this.device,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt});

  factory _$DevicesDeviceControlImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesDeviceControlImplFromJson(json);

  /// System-generated unique identifier for the control.
  @override
  final String id;

  /// The name of the control, representing the action it performs.
  @override
  final String name;

  /// The device to which this control belongs.
  @override
  final String device;

  /// Timestamp when the control was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// Timestamp when the control was last updated, if applicable.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  @override
  String toString() {
    return 'DevicesDeviceControl(id: $id, name: $name, device: $device, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesDeviceControlImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, name, device, createdAt, updatedAt);

  /// Create a copy of DevicesDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesDeviceControlImplCopyWith<_$DevicesDeviceControlImpl>
      get copyWith =>
          __$$DevicesDeviceControlImplCopyWithImpl<_$DevicesDeviceControlImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesDeviceControlImplToJson(
      this,
    );
  }
}

abstract class _DevicesDeviceControl implements DevicesDeviceControl {
  const factory _DevicesDeviceControl(
          {required final String id,
          required final String name,
          required final String device,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt}) =
      _$DevicesDeviceControlImpl;

  factory _DevicesDeviceControl.fromJson(Map<String, dynamic> json) =
      _$DevicesDeviceControlImpl.fromJson;

  /// System-generated unique identifier for the control.
  @override
  String get id;

  /// The name of the control, representing the action it performs.
  @override
  String get name;

  /// The device to which this control belongs.
  @override
  String get device;

  /// Timestamp when the control was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// Timestamp when the control was last updated, if applicable.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// Create a copy of DevicesDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesDeviceControlImplCopyWith<_$DevicesDeviceControlImpl>
      get copyWith => throw _privateConstructorUsedError;
}
