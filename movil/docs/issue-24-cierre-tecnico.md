# Issue #24 — cierre técnico documental

**Versión del documento:** 1.0. **Fecha:** 12 de noviembre de 2026 (Bolivia).
**Área:** aplicación móvil Flutter. **Fase:** 7, documentación y revisión.
**Issue:** [3.1 — Crear aplicación Flutter y navegación base](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/24).

Este documento no cierra GitHub ni acredita incorporación del código al
repositorio. La consulta directa del issue lo encontró **abierto**. El Contexto
Maestro v1.0 se usa como antecedente, no como estado actual ni ha sido modificado.

## 1. Clasificación de evidencia

| Etiqueta | Significado |
|---|---|
| DOCUMENTADO / APROBADO | Requisito oficial o alcance autorizado en esta conversación |
| CÓDIGO INSPECCIONADO | Archivo actual leído; no implica ejecución funcional |
| EJECUTADO AQUÍ | Comprobación realizada en ChatGPT Work, con resultado indicado |
| REPORTADO POR EL USUARIO | Resultado obtenido fuera de esta ejecución; sin reproducción independiente |
| PENDIENTE DE VERIFICACIÓN | Falta evidencia actual suficiente |

Las Fases 1–6 están IMPLEMENTADAS y el usuario reportó su validación en los
respectivos alcances. No se convierten retrospectivamente los fallos de Work en
pruebas aprobadas. La Fase 7 aporta documentación y auditoría, no funcionalidades.

## 2. Estado Git constatado al inicio

| Elemento | Resultado |
|---|---|
| Rama | `feature/24-base-flutter` |
| HEAD completo | `e438bf465b7ca9b3f926a78a7215f3739bfe80c9` |
| Archivos versionados dentro de movil | 0 |
| Archivos sin seguimiento dentro de movil | 44 antes de esta fase |
| Cambios de archivos versionados | Ninguno mostrado por status/diff |
| Upstream local | `origin/Develop` |
| Cambios documentales de esta fase | README actualizado y este documento creado |

**HEAD no identifica los archivos de movil**, todavía sin seguimiento.
El upstream observado no equivale a una rama remota publicada con el trabajo
móvil. No se realizó fetch ni se comprobó sincronización actual con el remoto.

## 3. Resumen de fases y archivos relevantes

| Fase | Resultado implementado | Evidencia de código actual |
|---|---|---|
| 1 | Aplicación mínima, Explorar, Material 3 y componente informativo | `lib/main.dart`, `app/unifundme_app.dart`, `app/theme/app_theme.dart`, `features/catalog/presentation/explore_page.dart`, `shared/widgets/feature_pending_view.dart` |
| 2 | Cuatro secciones y barra inferior, router con ciclo de vida | `app/router/app_router.dart`, `app/router/app_routes.dart`, `app/shell/main_shell.dart`; páginas de Cuenta, Seguimiento y Notificaciones |
| 3 | Cuenta → Acceso, retorno y recuperación de rutas desconocidas | Router, AccountPage y FeaturePendingView |
| 4 | Configuración por compilación, desarrollo sin API y producción HTTPS | `core/config/app_config.dart` y aplicación |
| 5 | Transporte JSON/binario, errores, token opcional y pruebas simuladas | `core/network/api_client.dart`, `api_exception.dart`, pubspec y lockfile |
| 6 | Internet, nombre Android y tráfico sin cifrar deshabilitado | Manifiestos main y debug; profile conservado |
| 7 | Guía reproducible, matriz y propuesta de incorporación | `README.md` y `docs/issue-24-cierre-tecnico.md` |

Las rutas de la tabla son relativas a `movil/lib/` cuando comienzan con
`app/`, `core/`, `features/` o `shared/`. No se añadieron capas de dominio
vacías. La organización futura por presentación y acceso a datos aún no implica
repositorios, modelos o ViewModels implementados.

## 4. Matriz de requisitos y aceptación

El issue oficial exige estructura Flutter, navegación entre pantallas principales,
organización inicial, componentes comunes y preparación de consumo posterior de
API. No prescribe bibliotecas ni una lista cerrada de pantallas.

| Requisito / criterio derivado aprobado | Evidencia | Estado y límite |
|---|---|---|
| Base Flutter y organización inicial | main, app, core, features y shared | CÓDIGO INSPECCIONADO |
| Navegación principal | Explorar, Seguimiento, Notificaciones y Cuenta | Código inspeccionado; recorrido reportado en Samsung |
| Componentes comunes | Tema único y FeaturePendingView | Código inspeccionado; presentación inicial reportada |
| Preparación API | AppConfig y ApiClient inyectable | Código inspeccionado; MockClient, sin integración Laravel |
| Ruta complementaria y retorno | `/acceso`, push/pop, fallback de flecha | Código inspeccionado; pruebas/manual reportados |
| Recuperación de ruta desconocida | errorBuilder y acción a Explorar | Código inspeccionado; sin mostrar URI recibida |
| Entornos | development/production y URL normalizada /api/v1/ | Código inspeccionado y pruebas reportadas |
| Seguridad de producción | HTTPS en AppConfig y política Android | Código y APK existente inspeccionados; no prueba de servidor real |
| Análisis, pruebas y APK | Matriz de la sección 6 | Separar ejecución aquí y reporte externo |
| Documentación | README y este documento | Alcance de Fase 7 |
| Incorporación al repositorio y revisión | Ningún archivo móvil versionado | PENDIENTE de autorización |
| APK release y firma definitiva | No entregados | Requisito posterior de entrega, no condición añadida al #24 |

## 5. Pruebas existentes

| Archivo | Cobertura inspeccionada | Casos esperados por lectura |
|---|---|---:|
| `test/widget_test.dart` | Arranque, configuración visible, Material 3 y pantalla pequeña | 6 |
| `test/app/navigation_test.dart` | Raíz, cuatro destinos, ruta directa y reconstrucción | 4 |
| `test/app/complementary_navigation_test.dart` | Acceso, retorno de sistema, recuperación y texto ampliado | 7 |
| `test/core/config/app_config_test.dart` | Desarrollo, producción, URL, puertos y mensajes | 27 |
| `test/core/network/api_client_test.dart` | MockClient, métodos, cabeceras, JSON/binario, errores, timeout, rutas y cierre | 54 |
| **Total esperado / reportado** | El recuento por código no acredita ejecución | **98** |

No hay suite de integración real con Laravel. Las pruebas de texto ampliado y
retorno simulan escenarios concretos; no certifican todos los dispositivos,
gestos, tamaños, accesibilidad o restauración tras cierre del proceso.

## 6. Matriz de verificaciones

### Resultado reportado por el usuario, previo a esta fase

| Comprobación | Resultado comunicado | Procedencia |
|---|---|---|
| dart analyze | Sin problemas | PowerShell normal, reporte del usuario |
| flutter analyze --no-pub | Sin problemas | PowerShell normal, reporte del usuario |
| flutter test --no-pub | 98 pruebas superadas | PowerShell normal, reporte del usuario |
| flutter build apk --debug --no-pub | Compilación exitosa | PowerShell normal, reporte del usuario |
| Manifiesto del APK | Internet, UniFundMe y cleartext false | Reportado por el usuario; también se inspeccionó el APK existente aquí |
| Ocho comprobaciones manuales | Satisfactorias | Samsung SM-N986N, Android 13; reporte, no observación directa aquí |

El reporte manual acredita el alcance comunicado: navegación principal y
complementaria, arranque y presentación. No se dispone en esta tarea del detalle
completo de cada una de las ocho comprobaciones; no se inventa su contenido ni se
extiende el resultado a integración API, release o cobertura visual exhaustiva.

### Verificación final de esta fase en ChatGPT Work

| Comprobación | Resultado |
|---|---|
| Formato, solo comprobación sin escribir Dart | EJECUTADO AQUÍ: 19 archivos, 0 cambios; formato correcto |
| dart analyze | EJECUTADO AQUÍ: código 0, No issues found! |
| flutter analyze --no-pub | Intentado aquí: código 1 antes del análisis, acceso al lockfile del SDK bloqueado |
| flutter test --no-pub | Intentado aquí: código 1 antes de ejecutar pruebas, mismo bloqueo |
| flutter build apk --debug --no-pub | Intentado aquí: código 1 antes de compilar, mismo bloqueo; sin APK nuevo |
| Lectura de código, manifiestos y exclusiones | EJECUTADO AQUÍ |
| Inspección de APK existente con aapt | EJECUTADO AQUÍ, código de salida 0 |
| Auditoría limitada de secretos | Sin coincidencias de firmas conocidas ni nombres sensibles entre los 44 candidatos originales |

La búsqueda de secretos no es una certificación: revisó nombres y firmas
conocidas de claves privadas/API en candidatos de texto; no incluyó un análisis
forense de cachés, historial completo o contenido del APK. Los valores de pruebas
son fixtures y no deben confundirse con credenciales o servidores reales.

El formato se comprobó con `dart format --output=none --set-exit-if-changed lib test`.
Se utilizó el ejecutable Dart del SDK con `--suppress-analytics`. Para los tres
comandos Flutter se invocó `flutter_tools.snapshot` con ese ejecutable, conservando
los argumentos indicados; no se atribuye la ejecución a un PowerShell normal del
usuario. La salida completa común fue:

```text
Flutter failed to open a file at "C:\flutter\bin\cache\lockfile". The flutter tool cannot access the file or directory.
Please ensure that the SDK and/or project is installed in a location that has read/write permissions for the current user.
```

El mensaje no especifica `Access is denied`, un proceso bloqueante ni una causa
raíz. No se modificaron permisos ni se reparó el SDK. Las 98 pruebas y el build
exitoso siguen clasificados como reporte del usuario, no como éxito de estos
intentos. Los fallos de Work no invalidan ni reproducen ese reporte externo.

## 7. APK existente inspeccionado independientemente

No se generó este APK durante la inspección inicial de Fase 7.

| Propiedad | Valor observado |
|---|---|
| Ruta | `movil/build/app/outputs/flutter-apk/app-debug.apk` |
| Tamaño | 92.428.422 bytes |
| Última modificación UTC | 2026-11-12T15:55:13.3970139Z |
| SHA-256 | `054C8A4C078697F2872A8F68A1F8A492E498C05FDCB9B78C2EFA9EE2C18F4D4A` |
| Package | `com.unifoundme.movil` |
| Version name / code | 1.0.0 / 1 |
| Target SDK | 36 |
| Label | UniFundMe |
| Permiso | android.permission.INTERNET |
| Cleartext | false; aapt muestra booleano 0x0 |

Se utilizaron, en modo consulta, `aapt dump badging` y
`aapt dump xmltree ... AndroidManifest.xml` de build-tools 36.0.0.
La presencia y contenido del binario no prueban que coincida exactamente con
todos los fuentes actuales ni lo vinculan al HEAD, dado que movil no está
versionado. El hash identifica solo ese artefacto.

## 8. Inventario propuesto para versionar

Los 44 candidatos originales están sin seguimiento. Este documento agrega un
candidato, para un total esperado de **45** al finalizar. No se ejecuta staging.

| Categoría | Qué incorporar tras autorización |
|---|---|
| Código | Todos los Dart de lib y test listados abajo |
| Configuración compartida | pubspec.yaml, pubspec.lock, analysis_options.yaml |
| Metadatos | .metadata y .gitignore del proyecto móvil |
| Android de origen | Gradle Kotlin DSL, propiedades compartidas, manifiestos, MainActivity, XML de recursos e iconos PNG |
| Documentación | README y matriz de cierre |

Inventario completo (rutas relativas a la raíz del repositorio):

- `movil/.gitignore`
- `movil/.metadata`
- `movil/README.md`
- `movil/analysis_options.yaml`
- `movil/android/.gitignore`
- `movil/android/app/build.gradle.kts`
- `movil/android/app/src/debug/AndroidManifest.xml`
- `movil/android/app/src/main/AndroidManifest.xml`
- `movil/android/app/src/main/kotlin/com/unifoundme/movil/MainActivity.kt`
- `movil/android/app/src/main/res/drawable-v21/launch_background.xml`
- `movil/android/app/src/main/res/drawable/launch_background.xml`
- `movil/android/app/src/main/res/mipmap-hdpi/ic_launcher.png`
- `movil/android/app/src/main/res/mipmap-mdpi/ic_launcher.png`
- `movil/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png`
- `movil/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png`
- `movil/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`
- `movil/android/app/src/main/res/values-night/styles.xml`
- `movil/android/app/src/main/res/values/styles.xml`
- `movil/android/app/src/profile/AndroidManifest.xml`
- `movil/android/build.gradle.kts`
- `movil/android/gradle.properties`
- `movil/android/gradle/wrapper/gradle-wrapper.properties`
- `movil/android/settings.gradle.kts`
- `movil/docs/issue-24-cierre-tecnico.md`
- `movil/lib/app/router/app_router.dart`
- `movil/lib/app/router/app_routes.dart`
- `movil/lib/app/shell/main_shell.dart`
- `movil/lib/app/theme/app_theme.dart`
- `movil/lib/app/unifundme_app.dart`
- `movil/lib/core/config/app_config.dart`
- `movil/lib/core/network/api_client.dart`
- `movil/lib/core/network/api_exception.dart`
- `movil/lib/features/account/presentation/account_page.dart`
- `movil/lib/features/catalog/presentation/explore_page.dart`
- `movil/lib/features/notifications/presentation/notifications_page.dart`
- `movil/lib/features/tracking/presentation/tracking_page.dart`
- `movil/lib/main.dart`
- `movil/lib/shared/widgets/feature_pending_view.dart`
- `movil/pubspec.lock`
- `movil/pubspec.yaml`
- `movil/test/app/complementary_navigation_test.dart`
- `movil/test/app/navigation_test.dart`
- `movil/test/core/config/app_config_test.dart`
- `movil/test/core/network/api_client_test.dart`
- `movil/test/widget_test.dart`

## 9. Exclusiones verificadas y riesgos

| Elemento | Estado y tratamiento |
|---|---|
| .dart_tool/, build/, APK y cobertura | Excluidos; no versionar artefactos ni cachés |
| .idea/, *.iml, .gradle/, .cxx/ | Configuración local y cachés; conservar excluidos |
| android/local.properties | Ignorado; rutas particulares de SDK |
| android/key.properties, *.jks, *.keystore | Ignorados; no incorporar claves |
| GeneratedPluginRegistrant.java | Ignorado; generado |
| .env | Ignorado por regla de la raíz |
| .env.production y config.production.json | No cubiertos por las reglas comprobadas; nombres hipotéticos, no archivos encontrados |
| gradlew, gradlew.bat, gradle-wrapper.jar | Existen, pero android/.gitignore los excluye; revisar estrategia de reproducción |

Los iconos PNG del código fuente no son basura de compilación: deben conservarse.
No incluir secretos por usar extensiones JSON u otros nombres que Git no ignora.
No se modificó ningún .gitignore en esta fase.

El wrapper merece una decisión explícita: comprobar que una copia limpia pueda
preparar y compilar Android con el procedimiento documentado, o autorizar su
incorporación con reglas apropiadas. No forzar su inclusión ni regenerar el
proyecto encima del existente sin revisión.

## 10. Límites y riesgos técnicos

- Acceso es informativo; no hay autenticación ni persistencia de sesión.
- Las cuatro secciones no implementan catálogo, aportes, seguimiento o
  notificaciones reales. Son puntos de entrada para los siguientes issues.
- ApiClient está separado y no conectado a las pantallas. No hay repositorios ni
  modelos del dominio; no se acredita seguridad/autorización de endpoints reales.
- Las URLs de tests son fixtures; no existe una dirección productiva aprobada
  dentro de la configuración.
- El timeout limita la espera por etapa, no garantiza cancelar una escritura
  enviada. No reintentar aportes sin diseño explícito de idempotencia.
- Las descargas binarias se acumulan en memoria. No se admiten rutas absolutas,
  incluidos enlaces firmados externos: ese caso debe diseñarse posteriormente.
- AppConfig permite HTTP en desarrollo, pero Android declara tráfico sin cifrar
  deshabilitado sin excepciones. No se promete conexión HTTP local.
- Solo Android está creado. No hay APK release certificado ni firma definitiva.
  Gradle todavía asigna firma debug al bloque release.
- Se conserva deliberadamente `com.unifoundme.movil`; el nombre visible es
  UniFundMe. La descripción de pubspec aún conserva la variante UniFoundMe.
- No se acredita compatibilidad universal ni coincidencia remota.
- Los cambios sin seguimiento no están protegidos por un commit ni por HEAD.

## 11. Reproducción y siguiente revisión

Los comandos de instalación, entorno, análisis, pruebas y APK están en
[README](../README.md). No ejecutan operaciones de Git, pero Flutter puede
escribir cachés y outputs.

Antes de una integración y cierre formal:

1. Revisar el alcance oficial y esta matriz con el responsable del issue.
2. Resolver o verificar la reproducción del wrapper desde una copia limpia.
3. Confirmar el inventario y revisar archivos sensibles; mantener outputs fuera.
4. Repetir análisis, 98 pruebas y compilación desde PowerShell normal si Work
   sigue bloqueado; adjuntar resultados identificables y hash del APK.
5. Vincular la evidencia manual a la versión del código y mantener su procedencia.
6. Con autorización posterior, incorporar solo el alcance aprobado a Git y
   revisar el diff preparado antes de commit.
7. Publicar rama/PR y actualizar seguimiento únicamente tras autorización.
8. Cerrar #24 solo tras revisión de criterios; no confundir este cierre
   documental con el cierre formal de GitHub.
9. Preparar, sin aplicar automáticamente, actualización identificable para el
   Contexto Maestro y seguimiento.

## 12. Conclusión técnica

La estructura y preparación requeridas por #24 están presentes en el código
inspeccionado. Existe evidencia reportada de análisis, 98 pruebas, compilación
debug y recorrido en Samsung, complementada aquí por inspección del artefacto.
La base está preparada para revisión e incorporación controlada; no se declara
integración real con Laravel, entrega release ni trabajo formalmente integrado.

El cierre técnico documental queda condicionado a conservar la trazabilidad de
los resultados y resolver la revisión de versionado/reproducción. El issue
permanece abierto y no se realizaron commits, pushes, merges ni cambios de rama.
