import { Component, Suspense } from 'react';
import type { ReactNode } from 'react';

class ContentErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <section
          role="alert"
          className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-8 my-10 text-center"
        >
          <h1 className="text-xl font-bold text-gray-900">No pudimos mostrar esta sección</h1>
          <p className="mt-3 text-gray-600">
            Comprueba tu conexión y vuelve a cargar la página para intentarlo de nuevo.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-[#72B626] px-5 py-3 font-bold text-white"
          >
            Recargar página
          </button>
          <a href="/" className="ml-5 inline-block underline text-gray-700">
            Ir al inicio
          </a>
        </section>
      );
    }
    return this.props.children;
  }
}

/** A failed module can stay cached by the browser; an explicit reload gets the current build. */
export function AsyncContent({
  children,
  label = 'Cargando página...',
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <ContentErrorBoundary>
      <Suspense
        fallback={
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-48 items-center justify-center gap-3 p-10 text-gray-600"
          >
            <span
              aria-hidden="true"
              className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#72B626]"
            />
            <p>{label}</p>
          </div>
        }
      >
        {children}
      </Suspense>
    </ContentErrorBoundary>
  );
}
