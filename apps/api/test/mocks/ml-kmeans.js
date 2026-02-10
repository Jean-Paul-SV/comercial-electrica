/**
 * Mock de ml-kmeans para tests E2E (evita cargar ESM en Jest).
 * El servicio de reportes usa kmeans() para customer-clusters.
 */
function kmeans(data, k) {
  const len = Array.isArray(data) ? data.length : 0;
  const clusters = Array.from({ length: len }, (_, i) => i % Math.max(1, k));
  const centroids = Array.from({ length: Math.min(k, len) }, () => [0, 0]);
  return { clusters, centroids };
}

module.exports = { kmeans };
