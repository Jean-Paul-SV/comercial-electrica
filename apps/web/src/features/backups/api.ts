import { apiClient } from '@infrastructure/api/client';
import type { BackupRun, CreateBackupResponse, VerifyBackupResponse } from './types';

const API_BASE_URL =
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000'
    : 'http://localhost:3000';

export function listBackups(authToken: string): Promise<BackupRun[]> {
  return apiClient.get('/backups', { authToken });
}

export function createBackup(authToken: string): Promise<CreateBackupResponse> {
  return apiClient.post('/backups', undefined, { authToken });
}

export function getBackup(id: string, authToken: string): Promise<BackupRun> {
  return apiClient.get(`/backups/${id}`, { authToken });
}

export function verifyBackup(
  id: string,
  authToken: string,
): Promise<VerifyBackupResponse> {
  return apiClient.post(`/backups/${id}/verify`, undefined, { authToken });
}

export function deleteBackup(
  id: string,
  authToken: string,
): Promise<void> {
  return apiClient.delete(`/backups/${id}`, { authToken });
}

/** Descarga el archivo del backup; dispara la descarga en el navegador. */
export async function downloadBackup(
  id: string,
  authToken: string,
): Promise<void> {
  const url = `${API_BASE_URL}/backups/${id}/download`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = 'Error al descargar backup';
    try {
      const json = JSON.parse(text);
      message = json?.message ?? json?.error ?? message;
    } catch {
      message = text || message;
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  let fileName = `backup-${id}.dump`;
  if (disposition) {
    const match = /filename="?([^";\n]+)"?/.exec(disposition);
    if (match?.[1]) fileName = match[1].trim();
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}
