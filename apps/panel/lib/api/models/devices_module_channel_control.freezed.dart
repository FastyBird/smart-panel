// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_channel_control.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleChannelControl _$DevicesModuleChannelControlFromJson(
    Map<String, dynamic> json) {
  return _DevicesModuleChannelControl.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleChannelControl {
  /// System-generated unique identifier for the channel control.
  String get id => throw _privateConstructorUsedError;

  /// The name of the control, representing the action it performs.
  String get name => throw _privateConstructorUsedError;

  /// The channel to which this control belongs.
  String get channel => throw _privateConstructorUsedError;

  /// Timestamp when the control was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Timestamp when the control was last updated, if applicable.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleChannelControl to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleChannelControlCopyWith<DevicesModuleChannelControl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleChannelControlCopyWith<$Res> {
  factory $DevicesModuleChannelControlCopyWith(
          DevicesModuleChannelControl value,
          $Res Function(DevicesModuleChannelControl) then) =
      _$DevicesModuleChannelControlCopyWithImpl<$Res,
          DevicesModuleChannelControl>;
  @useResult
  $Res call(
      {String id,
      String name,
      String channel,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class _$DevicesModuleChannelControlCopyWithImpl<$Res,
        $Val extends DevicesModuleChannelControl>
    implements $DevicesModuleChannelControlCopyWith<$Res> {
  _$DevicesModuleChannelControlCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? channel = null,
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
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
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
abstract class _$$DevicesModuleChannelControlImplCopyWith<$Res>
    implements $DevicesModuleChannelControlCopyWith<$Res> {
  factory _$$DevicesModuleChannelControlImplCopyWith(
          _$DevicesModuleChannelControlImpl value,
          $Res Function(_$DevicesModuleChannelControlImpl) then) =
      __$$DevicesModuleChannelControlImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String name,
      String channel,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class __$$DevicesModuleChannelControlImplCopyWithImpl<$Res>
    extends _$DevicesModuleChannelControlCopyWithImpl<$Res,
        _$DevicesModuleChannelControlImpl>
    implements _$$DevicesModuleChannelControlImplCopyWith<$Res> {
  __$$DevicesModuleChannelControlImplCopyWithImpl(
      _$DevicesModuleChannelControlImpl _value,
      $Res Function(_$DevicesModuleChannelControlImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? channel = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
  }) {
    return _then(_$DevicesModuleChannelControlImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
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
class _$DevicesModuleChannelControlImpl
    implements _DevicesModuleChannelControl {
  const _$DevicesModuleChannelControlImpl(
      {required this.id,
      required this.name,
      required this.channel,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt});

  factory _$DevicesModuleChannelControlImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesModuleChannelControlImplFromJson(json);

  /// System-generated unique identifier for the channel control.
  @override
  final String id;

  /// The name of the control, representing the action it performs.
  @override
  final String name;

  /// The channel to which this control belongs.
  @override
  final String channel;

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
    return 'DevicesModuleChannelControl(id: $id, name: $name, channel: $channel, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleChannelControlImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, name, channel, createdAt, updatedAt);

  /// Create a copy of DevicesModuleChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleChannelControlImplCopyWith<_$DevicesModuleChannelControlImpl>
      get copyWith => __$$DevicesModuleChannelControlImplCopyWithImpl<
          _$DevicesModuleChannelControlImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleChannelControlImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleChannelControl
    implements DevicesModuleChannelControl {
  const factory _DevicesModuleChannelControl(
          {required final String id,
          required final String name,
          required final String channel,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt}) =
      _$DevicesModuleChannelControlImpl;

  factory _DevicesModuleChannelControl.fromJson(Map<String, dynamic> json) =
      _$DevicesModuleChannelControlImpl.fromJson;

  /// System-generated unique identifier for the channel control.
  @override
  String get id;

  /// The name of the control, representing the action it performs.
  @override
  String get name;

  /// The channel to which this control belongs.
  @override
  String get channel;

  /// Timestamp when the control was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// Timestamp when the control was last updated, if applicable.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// Create a copy of DevicesModuleChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleChannelControlImplCopyWith<_$DevicesModuleChannelControlImpl>
      get copyWith => throw _privateConstructorUsedError;
}
