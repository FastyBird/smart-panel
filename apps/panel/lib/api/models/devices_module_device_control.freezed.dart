// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_device_control.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleDeviceControl _$DevicesModuleDeviceControlFromJson(
    Map<String, dynamic> json) {
  return _DevicesModuleDeviceControl.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleDeviceControl {
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

  /// Serializes this DevicesModuleDeviceControl to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleDeviceControlCopyWith<DevicesModuleDeviceControl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleDeviceControlCopyWith<$Res> {
  factory $DevicesModuleDeviceControlCopyWith(DevicesModuleDeviceControl value,
          $Res Function(DevicesModuleDeviceControl) then) =
      _$DevicesModuleDeviceControlCopyWithImpl<$Res,
          DevicesModuleDeviceControl>;
  @useResult
  $Res call(
      {String id,
      String name,
      String device,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class _$DevicesModuleDeviceControlCopyWithImpl<$Res,
        $Val extends DevicesModuleDeviceControl>
    implements $DevicesModuleDeviceControlCopyWith<$Res> {
  _$DevicesModuleDeviceControlCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleDeviceControl
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
abstract class _$$DevicesModuleDeviceControlImplCopyWith<$Res>
    implements $DevicesModuleDeviceControlCopyWith<$Res> {
  factory _$$DevicesModuleDeviceControlImplCopyWith(
          _$DevicesModuleDeviceControlImpl value,
          $Res Function(_$DevicesModuleDeviceControlImpl) then) =
      __$$DevicesModuleDeviceControlImplCopyWithImpl<$Res>;
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
class __$$DevicesModuleDeviceControlImplCopyWithImpl<$Res>
    extends _$DevicesModuleDeviceControlCopyWithImpl<$Res,
        _$DevicesModuleDeviceControlImpl>
    implements _$$DevicesModuleDeviceControlImplCopyWith<$Res> {
  __$$DevicesModuleDeviceControlImplCopyWithImpl(
      _$DevicesModuleDeviceControlImpl _value,
      $Res Function(_$DevicesModuleDeviceControlImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleDeviceControl
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
    return _then(_$DevicesModuleDeviceControlImpl(
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
class _$DevicesModuleDeviceControlImpl implements _DevicesModuleDeviceControl {
  const _$DevicesModuleDeviceControlImpl(
      {required this.id,
      required this.name,
      required this.device,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt});

  factory _$DevicesModuleDeviceControlImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesModuleDeviceControlImplFromJson(json);

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
    return 'DevicesModuleDeviceControl(id: $id, name: $name, device: $device, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleDeviceControlImpl &&
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

  /// Create a copy of DevicesModuleDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleDeviceControlImplCopyWith<_$DevicesModuleDeviceControlImpl>
      get copyWith => __$$DevicesModuleDeviceControlImplCopyWithImpl<
          _$DevicesModuleDeviceControlImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleDeviceControlImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleDeviceControl
    implements DevicesModuleDeviceControl {
  const factory _DevicesModuleDeviceControl(
          {required final String id,
          required final String name,
          required final String device,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt}) =
      _$DevicesModuleDeviceControlImpl;

  factory _DevicesModuleDeviceControl.fromJson(Map<String, dynamic> json) =
      _$DevicesModuleDeviceControlImpl.fromJson;

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

  /// Create a copy of DevicesModuleDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleDeviceControlImplCopyWith<_$DevicesModuleDeviceControlImpl>
      get copyWith => throw _privateConstructorUsedError;
}
