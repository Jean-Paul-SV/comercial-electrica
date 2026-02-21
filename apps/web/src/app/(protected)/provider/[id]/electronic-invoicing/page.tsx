'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Select } from '@shared/components/ui/select';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Badge } from '@shared/components/ui/badge';
import {
  AlertCircle,
  CheckCircle2,
  FileKey,
  Building2,
  Hash,
  ListOrdered,
  Loader2,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@shared/utils/errors';
import {
  useDianConfigForTenant,
  useDianConfigStatusForTenant,
  useUpdateDianConfigForTenant,
  useUploadCertificateForTenant,
} from '@features/dian/hooks';
import type {
  DianConfigStatus,
  DianEnvironment,
  UpdateDianConfigPayload,
} from '@features/dian/types';
import { useTenant } from '@features/provider/hooks';

const STATUS_CONFIG: Record<
  DianConfigStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; description: string }
> = {
  not_configured: {
    label: 'No configurado',
    variant: 'secondary',
    description: 'Configure los datos de facturación electrónica para enviar a la DIAN.',
  },
  incomplete: {
    label: 'Incompleto',
    variant: 'outline',
    description: 'Faltan datos obligatorios. Complete la configuración para poder facturar.',
  },
  cert_expired: {
    label: 'Certificado vencido',
    variant: 'destructive',
    description: 'El certificado de firma electrónica ha vencido. Renuévelo con su certificador.',
  },
  range_exhausted: {
    label: 'Rango agotado',
    variant: 'destructive',
    description: 'El rango de numeración autorizado se agotó. Solicite un nuevo rango a la DIAN.',
  },
  ready: {
    label: 'Listo para facturar',
    variant: 'default',
    description: 'La configuración está completa. Puede emitir facturas electrónicas a la DIAN.',
  },
};

const MISSING_LABELS: Record<string, string> = {
  issuer_nit: 'NIT del emisor',
  issuer_name: 'Razón social del emisor',
  software_id: 'ID del software DIAN',
  software_pin: 'PIN del software DIAN',
  certificate: 'Certificado .p12',
  dian_url: 'URL DIAN (configuración del servidor)',
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result.startsWith('data:')) {
        const base64 = result.split(',')[1];
        resolve(base64 ?? '');
      } else {
        reject(new Error('No se pudo leer el archivo en base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ProviderElectronicInvoicingPage() {
  const params = useParams();
  const tenantId = typeof params.id === 'string' ? params.id : null;

  const { data: tenant } = useTenant(tenantId);
  const configQuery = useDianConfigForTenant(tenantId);
  const statusQuery = useDianConfigStatusForTenant(tenantId);
  const updateMutation = useUpdateDianConfigForTenant(tenantId);
  const uploadCertMutation = useUploadCertificateForTenant(tenantId);

  const [form, setForm] = useState<UpdateDianConfigPayload & { certPassword?: string }>({
    env: 'HABILITACION',
    issuerNit: '',
    softwareId: '',
    softwarePin: '',
    resolutionNumber: '',
    prefix: 'FAC',
    rangeFrom: 1,
    rangeTo: 999999,
  });
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');

  const config = configQuery.data ?? null;
  const statusResponse = statusQuery.data;
  const status: DianConfigStatus =
    statusResponse?.status ??
    (statusResponse?.readyForSend ? 'ready' : 'incomplete');
  const missing = statusResponse?.missing ?? [];
  const readyForSend = statusResponse?.readyForSend ?? false;
  const statusExt = statusResponse as { certExpiresInDays?: number; rangeRemaining?: number } | undefined;
  const certExpiresInDays = statusExt?.certExpiresInDays;
  const rangeRemaining = statusExt?.rangeRemaining;

  useEffect(() => {
    if (!config) return;
    setForm((prev) => ({
      ...prev,
      env: config.env ?? 'HABILITACION',
      issuerNit: config.issuerNit ?? '',
      softwareId: config.softwareId ?? '',
      softwarePin: '',
      resolutionNumber: config.resolutionNumber ?? '',
      prefix: config.prefix ?? 'FAC',
      rangeFrom: config.rangeFrom ?? 1,
      rangeTo: config.rangeTo ?? 999999,
    }));
  }, [config?.id]);

  const handleSaveConfig = () => {
    const payload: UpdateDianConfigPayload = {
      env: form.env,
      issuerNit: form.issuerNit || undefined,
      softwareId: form.softwareId || undefined,
      softwarePin: form.softwarePin || undefined,
      resolutionNumber: form.resolutionNumber || undefined,
      prefix: form.prefix || undefined,
      rangeFrom: form.rangeFrom,
      rangeTo: form.rangeTo,
    };
    updateMutation.mutate(payload, {
      onSuccess: () => toast.success('Configuración guardada.'),
      onError: (e) => toast.error(getErrorMessage(e)),
    });
  };

  const handleCertFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.p12') && !file.name.toLowerCase().endsWith('.pfx')) {
        toast.error('Seleccione un archivo .p12 o .pfx');
        return;
      }
      setCertFile(file);
    }
  };

  const handleUploadCertificate = () => {
    if (!certFile || !certPassword.trim()) {
      toast.error('Seleccione el archivo .p12 e ingrese la contraseña.');
      return;
    }
    fileToBase64(certFile)
      .then((certBase64) => {
        uploadCertMutation.mutate(
          { certBase64, password: certPassword },
          {
            onSuccess: () => {
              toast.success('Certificado guardado correctamente.');
              setCertFile(null);
              setCertPassword('');
            },
            onError: (e) => toast.error(getErrorMessage(e)),
          },
        );
      })
      .catch(() => toast.error('No se pudo leer el archivo.'));
  };

  if (!tenantId) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground">ID de empresa no válido.</p>
        <Button variant="link" asChild>
          <Link href="/provider">Volver a empresas</Link>
        </Button>
      </div>
    );
  }

  if (configQuery.isLoading || statusQuery.isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-6 dark:border-[#1F2937] space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (configQuery.isError || statusQuery.isError) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <p className="text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {getErrorMessage(configQuery.error ?? statusQuery.error)}
        </p>
        <Button variant="link" asChild>
          <Link href={`/provider/${tenantId}`}>Volver a la empresa</Link>
        </Button>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[status] ?? STATUS_CONFIG.incomplete;

  return (
    <div className="space-y-10 max-w-5xl mx-auto">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/provider/${tenantId}`}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
              <FileKey className="h-7 w-7 shrink-0 text-primary" aria-hidden />
              Facturación electrónica (DIAN)
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Configuración para {tenant?.name ?? 'esta empresa'}.
            </p>
          </div>
        </div>
      </header>

      {/* Estado + Qué hacer: misma fila cuando hay pasos pendientes */}
      <div className={`grid gap-4 ${!readyForSend ? 'md:grid-cols-2' : ''}`}>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <p className="text-base font-medium text-foreground flex items-center gap-2">
            {readyForSend ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
            ) : status === 'cert_expired' || status === 'range_exhausted' ? (
              <ShieldAlert className="h-5 w-5 text-destructive" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
            )}
            Estado
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">{statusInfo.description}</p>
          <div className="mt-4 space-y-2">
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            {missing.length > 0 && (
              <div className="text-sm text-muted-foreground mt-2">
                <span className="font-medium">Falta:</span>{' '}
                {missing.map((key) => MISSING_LABELS[key] ?? key).join(', ')}
              </div>
            )}
            {statusResponse?.certValidUntil && (
              <p className="text-sm text-muted-foreground">
                Certificado válido hasta:{' '}
                {new Date(statusResponse.certValidUntil).toLocaleDateString('es-CO', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
            {readyForSend && (
              <div className="mt-3 space-y-2 border-t pt-3">
                {certExpiresInDays != null && certExpiresInDays < 30 && (
                  <p className={certExpiresInDays < 15 ? 'text-sm text-destructive' : 'text-sm text-amber-600 dark:text-amber-500'}>
                    Certificado vence en {certExpiresInDays} día{certExpiresInDays !== 1 ? 's' : ''}.
                  </p>
                )}
                {rangeRemaining != null && rangeRemaining < 500 && (
                  <p className="text-sm text-amber-600 dark:text-amber-500">
                    Quedan {rangeRemaining} números en el rango.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        {!readyForSend && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-6 dark:border-[#1F2937]">
            <p className="text-base font-medium text-foreground">Qué hacer</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Complete los datos obligatorios: NIT, Software ID, PIN, certificado .p12 y numeración.
            </p>
          </div>
        )}
      </div>

      {/* Plantilla: acción rápida */}
      <div className="rounded-2xl border border-border/50 bg-muted/20 p-5 shadow-sm dark:bg-[#111827] dark:border-[#1F2937] sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-medium text-foreground">Plantilla rápida</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Aplique valores típicos de habilitación y luego complete NIT, software y certificado.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 w-full sm:w-auto rounded-xl"
            onClick={() =>
              setForm((p) => ({
                ...p,
                env: 'HABILITACION',
                prefix: 'FAC',
                rangeFrom: 1,
                rangeTo: 999999,
              }))
            }
          >
            Aplicar plantilla: Pyme básico (habilitación)
          </Button>
        </div>
      </div>

      {/* Formulario en 2 columnas: emisor + software | certificado + numeración */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Columna izquierda: Datos del emisor + Software DIAN */}
        <div className="space-y-6">
      {/* Datos del emisor */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
        <p className="text-base font-medium text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Datos del emisor
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          NIT y razón social (deben coincidir con DIAN y Cámara de Comercio).
        </p>
        <div className="mt-4 space-y-4">
          <p className="text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
            <strong>Obligación legal:</strong> NIT y razón social exactos respecto al contribuyente en DIAN.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="issuerNit">NIT</Label>
            <Input
              id="issuerNit"
              placeholder="900123456-7"
              value={form.issuerNit}
              onChange={(e) => setForm((p) => ({ ...p, issuerNit: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label>Razón social</Label>
            <p className="text-sm text-muted-foreground py-2 px-3 rounded-md bg-muted/50 border border-border">
              {config?.issuerName ? (
                <span className="font-medium text-foreground">{config.issuerName}</span>
              ) : (
                <span className="italic">No definida (se establece al crear la empresa)</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Software DIAN */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
        <p className="text-base font-medium text-foreground flex items-center gap-2">
          <Hash className="h-4 w-4" />
          Software DIAN
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">ID y PIN asignados por la DIAN.</p>
        <div className="mt-4 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="softwareId">Software ID</Label>
            <Input
              id="softwareId"
              placeholder="UUID asignado por la DIAN"
              value={form.softwareId}
              onChange={(e) => setForm((p) => ({ ...p, softwareId: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="softwarePin">PIN</Label>
            <Input
              id="softwarePin"
              type="password"
              placeholder={config?.hasSoftwarePin ? '••••••••' : 'PIN del software'}
              value={form.softwarePin}
              onChange={(e) => setForm((p) => ({ ...p, softwarePin: e.target.value }))}
              autoComplete="off"
            />
          </div>
        </div>
      </div>
        </div>

        {/* Columna derecha: Certificado + Numeración */}
        <div className="space-y-6">
      {/* Certificado */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
        <p className="text-base font-medium text-foreground flex items-center gap-2">
          <FileKey className="h-4 w-4" />
          Certificado .p12
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Certificado de firma electrónica. Se almacena cifrado.
        </p>
        <div className="mt-4 space-y-4">
          {config?.hasCert && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Certificado cargado. Suba uno nuevo para reemplazarlo.
            </p>
          )}
          <div className="grid gap-2">
            <Label>Archivo .p12</Label>
            <Input type="file" accept=".p12,.pfx" onChange={handleCertFileChange} />
            {certFile && <p className="text-xs text-muted-foreground">{certFile.name}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="certPassword">Contraseña del certificado</Label>
            <Input
              id="certPassword"
              type="password"
              placeholder="Contraseña del .p12"
              value={certPassword}
              onChange={(e) => setCertPassword(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button
            onClick={handleUploadCertificate}
            disabled={!certFile || !certPassword.trim() || uploadCertMutation.isPending}
          >
            {uploadCertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Subir certificado
          </Button>
        </div>
      </div>

      {/* Numeración y ambiente */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
        <p className="text-base font-medium text-foreground flex items-center gap-2">
          <ListOrdered className="h-4 w-4" />
          Numeración y ambiente
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">Resolución, prefijo, rango y ambiente DIAN.</p>
        <div className="mt-4 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="env">Ambiente</Label>
            <Select
              id="env"
              value={form.env ?? 'HABILITACION'}
              onChange={(e) =>
                setForm((p) => ({ ...p, env: e.target.value as DianEnvironment }))
              }
            >
              <option value="HABILITACION">Habilitación (pruebas)</option>
              <option value="PRODUCCION">Producción (real)</option>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="resolutionNumber">Número de resolución</Label>
            <Input
              id="resolutionNumber"
              placeholder="18764000000001"
              value={form.resolutionNumber ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, resolutionNumber: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="prefix">Prefijo</Label>
              <Input
                id="prefix"
                placeholder="FAC"
                value={form.prefix ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, prefix: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Rango (desde – hasta)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="1"
                  value={form.rangeFrom ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      rangeFrom: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    }))
                  }
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="999999"
                  value={form.rangeTo ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      rangeTo: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-muted/20 p-5 shadow-sm dark:bg-[#111827] dark:border-[#1F2937] sm:p-6">
        <Button
          onClick={handleSaveConfig}
          disabled={updateMutation.isPending}
          className="rounded-xl bg-primary hover:bg-primary/90"
        >
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}
