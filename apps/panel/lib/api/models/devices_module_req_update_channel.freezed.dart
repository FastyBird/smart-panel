// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_req_update_channel.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleReqUpdateChannel _$DevicesModuleReqUpdateChannelFromJson(
    Map<String, dynamic> json) {
  return _DevicesModuleReqUpdateChannel.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleReqUpdateChannel {
  DevicesModuleUpdateChannel get data => throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleReqUpdateChannel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleReqUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleReqUpdateChannelCopyWith<DevicesModuleReqUpdateChannel>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleReqUpdateChannelCopyWith<$Res> {
  factory $DevicesModuleReqUpdateChannelCopyWith(
          DevicesModuleReqUpdateChannel value,
          $Res Function(DevicesModuleReqUpdateChannel) then) =
      _$DevicesModuleReqUpdateChannelCopyWithImpl<$Res,
          DevicesModuleReqUpdateChannel>;
  @useResult
  $Res call({DevicesModuleUpdateChannel data});

  $DevicesModuleUpdateChannelCopyWith<$Res> get data;
}

/// @nodoc
class _$DevicesModuleReqUpdateChannelCopyWithImpl<$Res,
        $Val extends DevicesModuleReqUpdateChannel>
    implements $DevicesModuleReqUpdateChannelCopyWith<$Res> {
  _$DevicesModuleReqUpdateChannelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleReqUpdateChannel
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
              as DevicesModuleUpdateChannel,
    ) as $Val);
  }

  /// Create a copy of DevicesModuleReqUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DevicesModuleUpdateChannelCopyWith<$Res> get data {
    return $DevicesModuleUpdateChannelCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DevicesModuleReqUpdateChannelImplCopyWith<$Res>
    implements $DevicesModuleReqUpdateChannelCopyWith<$Res> {
  factory _$$DevicesModuleReqUpdateChannelImplCopyWith(
          _$DevicesModuleReqUpdateChannelImpl value,
          $Res Function(_$DevicesModuleReqUpdateChannelImpl) then) =
      __$$DevicesModuleReqUpdateChannelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DevicesModuleUpdateChannel data});

  @override
  $DevicesModuleUpdateChannelCopyWith<$Res> get data;
}

/// @nodoc
class __$$DevicesModuleReqUpdateChannelImplCopyWithImpl<$Res>
    extends _$DevicesModuleReqUpdateChannelCopyWithImpl<$Res,
        _$DevicesModuleReqUpdateChannelImpl>
    implements _$$DevicesModuleReqUpdateChannelImplCopyWith<$Res> {
  __$$DevicesModuleReqUpdateChannelImplCopyWithImpl(
      _$DevicesModuleReqUpdateChannelImpl _value,
      $Res Function(_$DevicesModuleReqUpdateChannelImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleReqUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DevicesModuleReqUpdateChannelImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DevicesModuleUpdateChannel,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesModuleReqUpdateChannelImpl
    implements _DevicesModuleReqUpdateChannel {
  const _$DevicesModuleReqUpdateChannelImpl({required this.data});

  factory _$DevicesModuleReqUpdateChannelImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesModuleReqUpdateChannelImplFromJson(json);

  @override
  final DevicesModuleUpdateChannel data;

  @override
  String toString() {
    return 'DevicesModuleReqUpdateChannel(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleReqUpdateChannelImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DevicesModuleReqUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleReqUpdateChannelImplCopyWith<
          _$DevicesModuleReqUpdateChannelImpl>
      get copyWith => __$$DevicesModuleReqUpdateChannelImplCopyWithImpl<
          _$DevicesModuleReqUpdateChannelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleReqUpdateChannelImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleReqUpdateChannel
    implements DevicesModuleReqUpdateChannel {
  const factory _DevicesModuleReqUpdateChannel(
          {required final DevicesModuleUpdateChannel data}) =
      _$DevicesModuleReqUpdateChannelImpl;

  factory _DevicesModuleReqUpdateChannel.fromJson(Map<String, dynamic> json) =
      _$DevicesModuleReqUpdateChannelImpl.fromJson;

  @override
  DevicesModuleUpdateChannel get data;

  /// Create a copy of DevicesModuleReqUpdateChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleReqUpdateChannelImplCopyWith<
          _$DevicesModuleReqUpdateChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
