export type BackupRun = {
  id: string;
  tenantId: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  storagePath: string | null;
  checksum: string | null;
  createdAt: string;
};

export type CreateBackupResponse = {
  id: string;
  storagePath: string;
  checksum: string;
  status: string;
};

export type VerifyBackupResponse = {
  id: string;
  isValid: boolean;
};
