import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'Android rechaza enlaces externos con esquema o credenciales inválidos',
    (tester) async {
      const channel = MethodChannel('unifundme/external');
      for (final url in [
        'javascript:alert(1)',
        'file:///private',
        'intent://activity',
        'https://user:password@example.test',
        'https://example.test/\npath',
      ]) {
        expect(await channel.invokeMethod<bool>('open', {'url': url}), isFalse);
      }
    },
  );
}
