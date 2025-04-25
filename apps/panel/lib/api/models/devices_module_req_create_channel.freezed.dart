// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_req_create_channel.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleReqCreateChannel _$DevicesModuleReqCreateChannelFromJson(
    Map<String, dynamic> json) {
  return _DevicesModuleReqCreateChannel.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleReqCreateChannel {
  DevicesModuleCreateChannel get data => throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleReqCreateChannel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleReqCreateChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleReqCreateChannelCopyWith<DevicesModuleReqCreateChannel>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleReqCreateChannelCopyWith<$Res> {
  factory $DevicesModuleReqCreateChannelCopyWith(
          DevicesModuleReqCreateChannel value,
          $Res Function(DevicesModuleReqCreateChannel) then) =
      _$DevicesModuleReqCreateChannelCopyWithImpl<$Res,
          DevicesModuleReqCreateChannel>;
  @useResult
  $Res call({DevicesModuleCreateChannel data});

  $DevicesModuleCreateChannelCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesModuleReqCreateChannelCopyWithImpl<$Res,
        $Val extends DevicesModuleReqCreateChannel>
    implements $DevicesModuleReqCreateChannelCopyWith<$Res> {
  _$DevicesModuleReqCreateChannelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleReqCreateChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_value.copyWith(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesModuleCreateChannel,
    ) as $Val);
  }

  /// Create a copy of DevicesModuleReqCreateChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesModuleCreateChannelCopyWith<$Res> get data {
    return $DevicesModuleCreateChannelCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesModuleReqCreateChannelImplCopyWith<$Res>
    implements $DevicesModuleReqCreateChannelCopyWith<$Res> {
  factory _$$DevicesModuleReqCreateChannelImplCopyWith(
          _$DevicesModuleReqCreateChannelImpl value,
          $Res Function(_$DevicesModuleReqCreateChannelImpl) then) =
      __$$DevicesModuleReqCreateChannelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesModuleCreateChannel data});

  @override
  $DevicesModuleCreateChannelCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesModuleReqCreateChannelImplCopyWithImpl<$Res>
    extends _$DevicesModuleReqCreateChannelCopyWithImpl<$Res,
        _$DevicesModuleReqCreateChannelImpl>
    implements _$$DevicesModuleReqCreateChannelImplCopyWith<$Res> {
  __$$DevicesModuleReqCreateChannelImplCopyWithImpl(
      _$DevicesModuleReqCreateChannelImpl _value,
      $Res Function(_$DevicesModuleReqCreateChannelImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleReqCreateChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesModuleReqCreateChannelImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesModuleCreateChannel,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesModuleReqCreateChannelImpl
    implements _DevicesModuleReqCreateChannel {
  const _$DevicesModuleReqCreateChannelImpl({required this.data});

  factory _$DevicesModuleReqCreateChannelImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesModuleReqCreateChannelImplFromJson(json);

  @override
  final DevicesModuleCreateChannel data;

  @override
  String toString() {
    return 'DevicesModuleReqCreateChannel(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleReqCreateChannelImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesModuleReqCreateChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleReqCreateChannelImplCopyWith<
          _$DevicesModuleReqCreateChannelImpl>
      get copyWith => __$$DevicesModuleReqCreateChannelImplCopyWithImpl<
          _$DevicesModuleReqCreateChannelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleReqCreateChannelImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleReqCreateChannel
    implements DevicesModuleReqCreateChannel {
  const factory _DevicesModuleReqCreateChannel(
          {required final DevicesModuleCreateChannel data}) =
      _$DevicesModuleReqCreateChannelImpl;

  factory _DevicesModuleReqCreateChannel.fromJson(Map<String, dynamic> json) =
      _$DevicesModuleReqCreateChannelImpl.fromJson;

  @override
  DevicesModuleCreateChannel get data;

  /// Create a copy of DevicesModuleReqCreateChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleReqCreateChannelImplCopyWith<
          _$DevicesModuleReqCreateChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
