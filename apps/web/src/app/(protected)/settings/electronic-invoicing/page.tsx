'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/components/ui/select';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@shared/utils/errors';
import {
  useDianConfig,
  useDianConfigStatus,
  useUpdateDianConfig,
  useUploadCertificate,
} from '@features/dian/hooks';
import type {
  DianConfigStatus,
  DianEnvironment,
  UpdateDianConfigPayload,
} from '@features/dian/types';

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

export default function ElectronicInvoicingPage() {
  const configQuery = useDianConfig();
  const statusQuery = useDianConfigStatus();
  const updateMutation = useUpdateDianConfig();
  const uploadCertMutation = useUploadCertificate();

  const [form, setForm] = useState<UpdateDianConfigPayload & { certPassword?: string }>({
    env: 'HABILITACION',
    issuerNit: '',
    issuerName: '',
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
  const status = (statusResponse && 'status' in statusResponse
    ? statusResponse.status
    : statusResponse?.readyForSend
      ? 'ready'
      : 'incomplete') as DianConfigStatus;
  const missing = statusResponse?.missing ?? [];
  const readyForSend = statusResponse?.readyForSend ?? false;

  useEffect(() => {
    if (!config) return;
    setForm((prev) => ({
      ...prev,
      env: config.env ?? 'HABILITACION',
      issuerNit: config.issuerNit ?? '',
      issuerName: config.issuerName ?? '',
      softwareId: config.softwareId ?? '',
      softwarePin: '', // never prefill
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
      issuerName: form.issuerName || undefined,
      softwareId: form.softwareId || undefined,
      softwarePin: form.softwarePin || undefined,
      resolutionNumber: form.resolutionNumber || undefined,
      prefix: form.prefix || undefined,
      rangeFrom: form.rangeFrom,
      rangeTo: form.rangeTo,
    };
    updateMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Configuración guardada.');
      },
      onError: (e) => {
        toast.error(getErrorMessage(e));
      },
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
            onError: (e) => {
              toast.error(getErrorMessage(e));
            },
          },
        );
      })
      .catch(() => {
        toast.error('No se pudo leer el archivo.');
      });
  };

  if (configQuery.isLoading || statusQuery.isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Facturación electrónica (DIAN)
        </h1>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (configQuery.isError || statusQuery.isError) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Facturación electrónica (DIAN)
        </h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {getErrorMessage(configQuery.error ?? statusQuery.error)}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[status] ?? STATUS_CONFIG.incomplete;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Facturación electrónica (DIAN)
      </h1>

      {/* Estado */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {readyForSend ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
            ) : status === 'cert_expired' || status === 'range_exhausted' ? (
              <ShieldAlert className="h-5 w-5 text-destructive" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
            )}
            Estado
          </CardTitle>
          <CardDescription>{statusInfo.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
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
          {status === 'range_exhausted' &&
            statusResponse?.nextNumber != null &&
            statusResponse?.rangeTo != null && (
              <p className="text-sm text-destructive">
                Próximo número: {statusResponse.nextNumber}. Rango autorizado hasta:{' '}
                {statusResponse.rangeTo}.
              </p>
            )}
        </CardContent>
      </Card>

      {/* 1. Datos del emisor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Datos del emisor
          </CardTitle>
          <CardDescription>
            NIT y razón social de su empresa (van en el XML ante la DIAN).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Label htmlFor="issuerName">Razón social</Label>
            <Input
              id="issuerName"
              placeholder="Mi Empresa S.A.S."
              value={form.issuerName}
              onChange={(e) => setForm((p) => ({ ...p, issuerName: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Software DIAN */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Software DIAN
          </CardTitle>
          <CardDescription>
            ID y PIN asignados por la DIAN al habilitar su software.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            {config?.hasSoftwarePin && (
              <p className="text-xs text-muted-foreground">
                Ya hay un PIN configurado. Ingrese uno nuevo solo si desea cambiarlo.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Certificado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileKey className="h-4 w-4" />
            Certificado de firma (.p12)
          </CardTitle>
          <CardDescription>
            Certificado de firma electrónica. Se almacena cifrado. No se muestra después de subir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config?.hasCert && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Certificado cargado. Suba uno nuevo para reemplazarlo.
            </p>
          )}
          <div className="grid gap-2">
            <Label>Archivo .p12</Label>
            <Input
              type="file"
              accept=".p12,.pfx"
              onChange={handleCertFileChange}
            />
            {certFile && (
              <p className="text-xs text-muted-foreground">{certFile.name}</p>
            )}
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
            {uploadCertMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Subir certificado
          </Button>
        </CardContent>
      </Card>

      {/* 4. Numeración y ambiente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ListOrdered className="h-4 w-4" />
            Numeración y ambiente
          </CardTitle>
          <CardDescription>
            Resolución de facturación, prefijo y rango autorizado. Ambiente DIAN.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="env">Ambiente</Label>
            <Select
              value={form.env ?? 'HABILITACION'}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, env: v as DianEnvironment }))
              }
            >
              <SelectTrigger id="env">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HABILITACION">Habilitación (pruebas)</SelectItem>
                <SelectItem value="PRODUCCION">Producción (real)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Use Producción solo cuando la DIAN haya habilitado su software.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="resolutionNumber">Número de resolución</Label>
            <Input
              id="resolutionNumber"
              placeholder="18764000000001"
              value={form.resolutionNumber ?? ''}
              onChange={(e) =>
                setForm((p) => ({ ...p, resolutionNumber: e.target.value }))
              }
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
        </CardContent>
      </Card>

      {/* Guardar configuración */}
      <Card>
        <CardContent className="pt-6">
          <Button
            onClick={handleSaveConfig}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Guardar configuración
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
