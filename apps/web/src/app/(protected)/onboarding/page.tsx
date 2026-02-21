'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

  /** Formatea número con punto como separador de miles (ej: 20000 → "20.000"). */
  const formatMonto = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOpeningAmount(formatMonto(e.target.value));
  };

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
    const amount = Number(openingAmount.replace(/\./g, '')) || 0;
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
      <div className="max-w-md mx-auto py-12 px-4 space-y-10">
        <header className="text-center">
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center justify-center gap-2">
            <Store className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            Bienvenido
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">En 3 pasos podrás registrar tu primera venta.</p>
        </header>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937] flex flex-col gap-3">
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
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4 space-y-10">
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
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <p className="text-base font-medium text-foreground flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Abrir caja
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Para registrar ventas necesitas tener la caja abierta. Es como
            abrir la gaveta al inicio del día. Indica con cuánto dinero
            empiezas (puede ser 0).
          </p>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="monto">Monto inicial</Label>
              <Input
                id="monto"
                type="text"
                inputMode="numeric"
                value={openingAmount}
                onChange={handleMontoChange}
                placeholder="0"
                aria-label="Monto inicial con formato de miles (ej: 20.000)"
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
          </div>
        </div>
      )}

      {stepToShow === 2 && (
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <p className="text-base font-medium text-foreground flex items-center gap-2">
            <Package className="h-5 w-5" />
            Tu primer producto
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Así tus ventas tendrán qué vender. Puedes agregar más después.
          </p>
          <div className="mt-4 space-y-4">
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
          </div>
        </div>
      )}

      {stepToShow === 3 && (
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <p className="text-base font-medium text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            ¿Listo para vender?
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ya puedes registrar tu primera venta.
          </p>
          <div className="mt-4 space-y-4">
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
          </div>
        </div>
      )}
    </div>
  );
}
