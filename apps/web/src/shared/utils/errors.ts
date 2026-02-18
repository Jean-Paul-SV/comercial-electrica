/**
 * Obtiene un mensaje de error legible para mostrar al usuario.
 * Prioriza el mensaje que devuelve la API; si no hay, usa mensajes genéricos por código HTTP.
 */
const NETWORK_ERROR_PHRASES = ['failed to fetch', 'network error', 'networkrequestfailed', 'load failed'];
function isNetworkErrorMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return NETWORK_ERROR_PHRASES.some((p) => lower.includes(p));
}

export function getErrorMessage(error: unknown, fallback = 'No se pudo completar la acción.'): string {
  if (error == null) return fallback;

  // Error con propiedad message (API client, Error)
  const obj = error as Record<string, unknown>;
  const msg = typeof obj.message === 'string' ? obj.message.trim() : '';
  if (msg) {
    if (isNetworkErrorMessage(msg)) {
      return 'No se pudo conectar con el servidor. Comprueba que la API esté en marcha (por ejemplo en http://localhost:3000).';
    }
    return msg;
  }

  // Códigos HTTP genéricos (solo si no había message)
  const status = typeof obj.status === 'number' ? obj.status : null;
  if (status !== null) {
    const byStatus: Record<number, string> = {
      400: 'Datos incorrectos. Revisa el formulario.',
      401: 'Sesión expirada. Inicia sesión de nuevo.',
      403: 'No tienes permiso para hacer esta acción.',
      404: 'No se encontró el recurso.',
      409: 'Conflicto: el recurso ya existe o fue modificado.',
      422: 'No se pudo procesar la solicitud. Revisa los datos.',
      500: 'Error del servidor. Intenta más tarde.',
      502: 'Servicio no disponible. Intenta más tarde.',
      503: 'Servicio no disponible. Intenta más tarde.',
    };
    if (byStatus[status]) return byStatus[status];
  }

  if (error instanceof Error && error.message) return error.message.trim();
  if (typeof error === 'string') return error.trim();

  return fallback;
}
