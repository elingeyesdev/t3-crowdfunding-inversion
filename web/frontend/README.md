# Interfaz React

El código de la interfaz está integrado con Laravel. Usa Node 24.15+ (la rama 24 está indicada en `web/.nvmrc`) y ejecuta `npm ci`, `npm run build` y `composer dev` desde `web/`. Abre `http://localhost:8765`.

La configuración activa de Vite y las dependencias están en `web/`. `frontend/src` conserva las pantallas y componentes originales. El chat usa Laravel Echo y Reverb. Consulta [la guía principal](../../README.md).

Las rutas se cargan con `React.lazy` y las estadísticas al abrir su sección. Conserva esas fronteras al agregar pantallas: una importación estática puede llevar código privado o gráficos a la portada. `AsyncContent` proporciona los estados de carga y error. Después de `npm run build`, ejecuta `npm run bundle:check`; `npm run bundle:report` muestra los tamaños incluyendo dependencias compartidas. Consulta [la medición, los límites y las pruebas de navegación](../../docs/FRONTEND_BUNDLE.md).

Desde `web/`, ejecuta `npm test` para todas las regresiones React y utilidades de `frontend/tests/*.test.mjs`. También puedes ejecutar `npm test` desde `web/frontend/`; delega al mismo comando. No hace falta iniciar Laravel, Vite, Reverb ni un navegador: las pruebas usan Node Test Runner, JSDOM y servicios simulados. Cada archivo se ejecuta en un proceso separado, de forma secuencial (`--test-concurrency=1`), con un límite de 60 segundos por prueba (`--test-timeout=60000`). Esta configuración evita los bloqueos observados al ejecutar la suite en paralelo, tanto localmente como en CI.

Para ejecutar solo una prueba, desde `web/`: `node --test frontend/tests/kyc-preview.test.mjs`. Una aserción fallida produce un código de salida distinto de cero. Las pruebas deben exigir el comportamiento correcto y no considerar éxito reproducir un defecto. La compilación `npm run build` es una comprobación adicional y no sustituye estas regresiones.

Ejecuta `npm run lint` desde `web/` o `web/frontend/`. Se exigen cero errores y cero advertencias mediante `--max-warnings 0`, antes de las pruebas y la compilación en GitHub Actions. La configuración conserva las reglas recomendadas de ESLint, TypeScript, React Hooks y React Refresh para `.ts` y `.tsx`.

Las reglas comprueban tipos sin `any` explícito, declaraciones sin uso, dependencias de efectos y callbacks, referencias fuera del renderizado, cálculos puros y componentes con identidad estable. Los valores externos desconocidos se estrechan antes de usarse; los DTO y respuestas conocidos tienen contratos concretos. Un parámetro con prefijo `_` se permite cuando debe conservarse por compatibilidad de una firma; esto no permite variables locales o importaciones sin uso. Las utilidades que se exporten junto a un componente se separan para conservar React Refresh.

Las cargas de recursos derivan el estado de carga de la identidad de la solicitud y descartan respuestas anteriores o posteriores al desmontaje. Los cambios locales confirmados invalidan las lecturas pendientes. Los formularios se inicializan con sus datos y ajustan su estado cuando cambia el registro; los componentes auxiliares se definen a nivel de módulo para conservar campos y foco. El reloj se suscribe mediante un hook, con temporizadores que se liberan al desmontar. `react-lifecycle.test.mjs` cubre estas regresiones.
