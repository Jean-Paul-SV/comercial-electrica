'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { useOnboardingStatus, useUpdateOnboardingStatus } from '@features/onboarding/hooks';
import { useOpenCashSession } from '@features/cash/hooks';
import { Wallet, Package, CheckCircle2, Store } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const status = useOnboardingStatus();
  const updateStatus = useUpdateOnboardingStatus();
  const openSession = useOpenCashSession();
  const [skippedStep1, setSkippedStep1] = useState(false);
  const [skippedStep2, setSkippedStep2] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('0');

  const data = status.data;
  const apiStep = data?.step ?? 1;
  const onboardingStatus = data?.status ?? 'not_started';

  const stepToShow = skippedStep2
    ? 3
    : skippedStep1 || apiStep >= 2
      ? 2
      : apiStep;

  const showWelcome =
    onboardingStatus === 'not_started' && !skippedStep1 && apiStep === 1;

  useEffect(() => {
    if (onboardingStatus === 'completed' || onboardingStatus === 'skipped') {
      router.replace('/app');
    }
  }, [onboardingStatus, router]);

  const handleEmpezar = async () => {
    await updateStatus.mutateAsync('in_progress');
    status.refetch();
  };

  const handleIrAlSistema = async () => {
    await updateStatus.mutateAsync('skipped');
    router.replace('/app');
  };

  const handleAbrirCaja = async () => {
    const amount = Number(openingAmount) || 0;
    await openSession.mutateAsync({ openingAmount: amount });
    await status.refetch();
  };

  const handleOmitirPaso1 = () => setSkippedStep1(true);
  const handleOmitirPaso2 = () => setSkippedStep2(true);

  const handleIrAVentas = async () => {
    await updateStatus.mutateAsync('completed');
    router.replace('/sales');
  };

  const handleVerResumen = async () => {
    await updateStatus.mutateAsync('completed');
    router.replace('/app');
  };

  if (status.isLoading || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="flex justify-center mb-6">
          <Store className="h-16 w-16 text-primary" />
        </div>
        <Card className="border-0 shadow-md">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-xl">Bienvenido</CardTitle>
            <CardDescription className="text-base">
              En 3 pasos podrás registrar tu primera venta.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full"
              onClick={handleEmpezar}
              disabled={updateStatus.isPending}
            >
              Empezar
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full"
              onClick={handleIrAlSistema}
              disabled={updateStatus.isPending}
            >
              Entendido, ir al sistema
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Paso {stepToShow} de 3
        </span>
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-2 w-8 rounded-full ${
                i <= stepToShow ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>

      {stepToShow === 1 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Abrir caja
            </CardTitle>
            <CardDescription>
              Para registrar ventas necesitas tener la caja abierta. Es como
              abrir la gaveta al inicio del día. Indica con cuánto dinero
              empiezas (puede ser 0).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="monto">Monto inicial</Label>
              <Input
                id="monto"
                type="number"
                min="0"
                step="1"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                className="w-full"
                onClick={handleAbrirCaja}
                disabled={openSession.isPending}
              >
                Abrir caja
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="w-full"
                onClick={handleOmitirPaso1}
              >
                Omitir por ahora
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stepToShow === 2 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Tu primer producto
            </CardTitle>
            <CardDescription>
              Así tus ventas tendrán qué vender. Puedes agregar más después.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button size="lg" className="w-full" asChild>
              <Link href="/products">Agregar un producto ahora</Link>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full"
              onClick={handleOmitirPaso2}
            >
              Tengo muchos productos, los cargo después
            </Button>
          </CardContent>
        </Card>
      )}

      {stepToShow === 3 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              ¿Listo para vender?
            </CardTitle>
            <CardDescription>
              Ya puedes registrar tu primera venta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                {data.hasOpenCashSession ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border-2 shrink-0" />
                )}
                Caja abierta
              </li>
              <li className="flex items-center gap-2">
                {data.hasAtLeastOneProduct ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border-2 shrink-0" />
                )}
                Al menos un producto
              </li>
            </ul>
            <div className="flex flex-col gap-2">
              <Button size="lg" className="w-full" onClick={handleIrAVentas}>
                Ir a Ventas
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={handleVerResumen}
              >
                Ver mi resumen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
