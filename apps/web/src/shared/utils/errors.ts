/**
 * Obtiene un mensaje de error legible para mostrar al usuario.
 * Prioriza el mensaje que devuelve la API; si no hay, usa mensajes genéricos por código HTTP.
 */
const NETWORK_ERROR_PHRASES = ['failed to fetch', 'network error', 'networkrequestfailed', 'load failed'];
function isNetworkErrorMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return NETWORK_ERROR_PHRASES.some((p) => lower.includes(p));
}

function normalizeMessage(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) return raw.map((m) => String(m)).join(', ').trim();
  return '';
}

export function getErrorMessage(error: unknown, fallback = 'No se pudo completar la acción.'): string {
  if (error == null) return fallback;

  const obj = error as Record<string, unknown>;
  const res = obj.response as Record<string, unknown> | undefined;
  const data = res?.data ?? obj.data;
  const dataObj = data && typeof data === 'object' ? data as Record<string, unknown> : null;
  // Mensaje directo o anidado (API client / Axios: error.response.data.message)
  const msg =
    normalizeMessage(obj.message) ||
    (dataObj && normalizeMessage(dataObj.message ?? (typeof data === 'string' ? data : null))) ||
    (typeof data === 'string' ? data.trim() : '');
  if (msg) {
    if (isNetworkErrorMessage(msg)) {
      return 'No se pudo conectar con el servidor. Comprueba que la API esté en marcha (por ejemplo en http://localhost:3000).';
    }
    return msg;
  }

  // Códigos HTTP genéricos (status en error o en response)
  const status =
    typeof obj.status === 'number' ? obj.status
      : obj.response && typeof obj.response === 'object' && typeof (obj.response as Record<string, unknown>).status === 'number'
        ? (obj.response as Record<string, unknown>).status as number
        : null;
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
