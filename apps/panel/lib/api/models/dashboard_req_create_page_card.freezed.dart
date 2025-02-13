// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_create_page_card.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqCreatePageCard _$DashboardReqCreatePageCardFromJson(
    Map<String, dynamic> json) {
  return _DashboardReqCreatePageCard.fromJson(json);
}

/// @nodoc
mixin _$DashboardReqCreatePageCard {
  DashboardCreateCard get data => throw _privateConstructorUsedError;

  /// Serializes this DashboardReqCreatePageCard to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqCreatePageCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqCreatePageCardCopyWith<DashboardReqCreatePageCard>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqCreatePageCardCopyWith<$Res> {
  factory $DashboardReqCreatePageCardCopyWith(DashboardReqCreatePageCard value,
          $Res Function(DashboardReqCreatePageCard) then) =
      _$DashboardReqCreatePageCardCopyWithImpl<$Res,
          DashboardReqCreatePageCard>;
  @useResult
  $Res call({DashboardCreateCard data});

  $DashboardCreateCardCopyWith<$Res> get data;
}

/// @nodoc
class _$DashboardReqCreatePageCardCopyWithImpl<$Res,
        $Val extends DashboardReqCreatePageCard>
    implements $DashboardReqCreatePageCardCopyWith<$Res> {
  _$DashboardReqCreatePageCardCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqCreatePageCard
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
              as DashboardCreateCard,
    ) as $Val);
  }

  /// Create a copy of DashboardReqCreatePageCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DashboardCreateCardCopyWith<$Res> get data {
    return $DashboardCreateCardCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardReqCreatePageCardImplCopyWith<$Res>
    implements $DashboardReqCreatePageCardCopyWith<$Res> {
  factory _$$DashboardReqCreatePageCardImplCopyWith(
          _$DashboardReqCreatePageCardImpl value,
          $Res Function(_$DashboardReqCreatePageCardImpl) then) =
      __$$DashboardReqCreatePageCardImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DashboardCreateCard data});

  @override
  $DashboardCreateCardCopyWith<$Res> get data;
}

/// @nodoc
class __$$DashboardReqCreatePageCardImplCopyWithImpl<$Res>
    extends _$DashboardReqCreatePageCardCopyWithImpl<$Res,
        _$DashboardReqCreatePageCardImpl>
    implements _$$DashboardReqCreatePageCardImplCopyWith<$Res> {
  __$$DashboardReqCreatePageCardImplCopyWithImpl(
      _$DashboardReqCreatePageCardImpl _value,
      $Res Function(_$DashboardReqCreatePageCardImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreatePageCard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DashboardReqCreatePageCardImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DashboardCreateCard,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqCreatePageCardImpl implements _DashboardReqCreatePageCard {
  const _$DashboardReqCreatePageCardImpl({required this.data});

  factory _$DashboardReqCreatePageCardImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreatePageCardImplFromJson(json);

  @override
  final DashboardCreateCard data;

  @override
  String toString() {
    return 'DashboardReqCreatePageCard(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreatePageCardImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DashboardReqCreatePageCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreatePageCardImplCopyWith<_$DashboardReqCreatePageCardImpl>
      get copyWith => __$$DashboardReqCreatePageCardImplCopyWithImpl<
          _$DashboardReqCreatePageCardImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqCreatePageCardImplToJson(
      this,
    );
  }
}

abstract class _DashboardReqCreatePageCard
    implements DashboardReqCreatePageCard {
  const factory _DashboardReqCreatePageCard(
          {required final DashboardCreateCard data}) =
      _$DashboardReqCreatePageCardImpl;

  factory _DashboardReqCreatePageCard.fromJson(Map<String, dynamic> json) =
      _$DashboardReqCreatePageCardImpl.fromJson;

  @override
  DashboardCreateCard get data;

  /// Create a copy of DashboardReqCreatePageCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreatePageCardImplCopyWith<_$DashboardReqCreatePageCardImpl>
      get copyWith => throw _privateConstructorUsedError;
}
