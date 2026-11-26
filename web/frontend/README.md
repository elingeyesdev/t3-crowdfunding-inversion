# Interfaz React

El código de la interfaz está integrado con Laravel. Usa Node 24.15+ (la rama 24 está indicada en `web/.nvmrc`) y ejecuta `npm ci`, `npm run build` y `composer dev` desde `web/`. Abre `http://localhost:8765`.

La configuración activa de Vite y las dependencias están en `web/`. `frontend/src` conserva las pantallas y componentes originales. El chat usa Laravel Echo y Reverb. Consulta [la guía principal](../../README.md).

Desde `web/`, ejecuta `npm test` para todas las regresiones React y utilidades de `frontend/tests/*.test.mjs`. También puedes ejecutar `npm test` desde `web/frontend/`; delega al mismo comando. No hace falta iniciar Laravel, Vite, Reverb ni un navegador: las pruebas usan Node Test Runner, JSDOM y servicios simulados. Cada archivo se ejecuta en un proceso separado, con la concurrencia predeterminada de Node.

Para ejecutar solo una prueba, desde `web/`: `node --test frontend/tests/kyc-preview.test.mjs`. Una aserción fallida produce un código de salida distinto de cero. Las pruebas deben exigir el comportamiento correcto y no considerar éxito reproducir un defecto. La compilación `npm run build` es una comprobación adicional y no sustituye estas regresiones.
