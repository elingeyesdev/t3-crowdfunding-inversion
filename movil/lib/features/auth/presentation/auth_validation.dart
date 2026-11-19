abstract final class AuthValidation {
  static String? email(String? value, {bool registration = false}) {
    final text = (value ?? '').trim();
    if (text.isEmpty) return 'Ingresa tu correo electrónico.';
    if (!RegExp(r'^[^@\s]+@[^@\s]+$').hasMatch(text)) {
      return 'Ingresa un correo válido.';
    }
    if (registration && text.runes.length > 255) {
      return 'El correo admite hasta 255 caracteres.';
    }
    return null;
  }

  static String? password(String? value, {bool registration = false}) {
    final text = value ?? '';
    if (text.trim().isEmpty) return 'Ingresa tu contraseña.';
    if (!registration) {
      return null;
    } // Login Laravel no impone las reglas de alta.
    if (text.runes.length < 8 || text.runes.length > 128) {
      return 'Usa entre 8 y 128 caracteres.';
    }
    if (!RegExp(r'[A-Z]').hasMatch(text) ||
        !RegExp(r'[0-9]').hasMatch(text) ||
        text.contains('\n') ||
        text.contains('\r')) {
      return 'Incluye una mayúscula y un número, sin saltos de línea.';
    }
    return null;
  }

  static String? phone(String? value) => (value ?? '').trim().runes.length > 20
      ? 'El teléfono admite hasta 20 caracteres.'
      : null;
}
