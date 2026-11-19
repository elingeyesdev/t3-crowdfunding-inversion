/// Distingue omisión de un valor explícito, incluido null en campos anulables.
class FieldUpdate<T> {
  const FieldUpdate.absent() : isPresent = false, _value = null;
  const FieldUpdate.value(T value) : isPresent = true, _value = value;
  final bool isPresent;
  final T? _value;
  T get value {
    if (!isPresent) throw StateError('Campo ausente.');
    return _value as T;
  }
}

enum InvestorType { individual, institutional, angel }
