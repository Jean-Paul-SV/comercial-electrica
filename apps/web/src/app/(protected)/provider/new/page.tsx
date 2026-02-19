'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
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
import { ArrowLeft, Building2, UserPlus, FileText, Phone } from 'lucide-react';
import { useCreateTenant, usePlans } from '@features/provider/hooks';

const formInputClass =
  'rounded-xl border border-input bg-background h-10 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors';
const formSelectClass =
  'flex h-10 w-full items-center rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 transition-colors';

const schema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200),
  slug: z
    .string()
    .min(1, 'Slug requerido')
    .max(80)
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
      'Solo minúsculas, números y guiones (ej: mi-empresa)'
    )
    .transform((s) => s.toLowerCase().trim()),
  planId: z.string().uuid().optional().or(z.literal('')),
  billingInterval: z.enum(['monthly', 'yearly']).optional().or(z.literal('')),
  adminEmail: z.string().email('Correo del administrador inválido'),
  adminName: z.string().max(200).optional(),
  adminPassword: z
    .string()
    .min(8, 'Mínimo 8 caracteres si se define')
    .optional()
    .or(z.literal('')),
  issuerName: z.string().max(200).optional().or(z.literal('')),
  contactPhone: z.string().max(50).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export default function ProviderNewTenantPage() {
  const router = useRouter();
  const createTenant = useCreateTenant();
  const { data: plans = [], isLoading: plansLoading } = usePlans(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      planId: '',
      billingInterval: '',
      adminEmail: '',
      adminName: '',
      adminPassword: '',
      issuerName: '',
      contactPhone: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await createTenant.mutateAsync({
        name: values.name,
        slug: values.slug,
        planId: values.planId?.trim() || undefined,
        billingInterval:
          (values.billingInterval === 'monthly' || values.billingInterval === 'yearly'
            ? values.billingInterval
            : undefined) as 'monthly' | 'yearly' | undefined,
        adminEmail: values.adminEmail.trim(),
        adminName: values.adminName?.trim() || undefined,
        adminPassword: values.adminPassword?.trim() || undefined,
        issuerName: values.issuerName?.trim() || undefined,
        contactPhone: values.contactPhone?.trim() || undefined,
      });
      toast.success(`Empresa "${res.tenant.name}" creada.`);
      if (res.tempAdminPassword) {
        toast.info(
          `Contraseña temporal del admin: ${res.tempAdminPassword}. El usuario deberá cambiarla en el primer login.`,
          { duration: 10000 }
        );
      }
      router.push('/provider');
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Error al crear la empresa.';
      toast.error(msg);
    }
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-xl shrink-0">
          <Link href="/provider">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Volver</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 text-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <Building2 className="h-5 w-5" />
            </span>
            Nueva empresa
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Crear la empresa (tenant) y su primer usuario administrador en un solo paso.
          </p>
        </div>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border/60 pb-6">
          <CardTitle className="text-lg font-semibold text-foreground">Datos de la empresa</CardTitle>
          <CardDescription className="text-muted-foreground">
            El identificador (slug) no se puede cambiar después. La razón social solo se define aquí.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="space-y-8">
            {/* Datos de la empresa */}
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0"></span>
                Datos de la empresa
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground font-medium">Nombre (como aparecerá en la app) *</Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    placeholder="Ej. Mi Comercio S.A.S."
                    className={formInputClass}
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug" className="text-foreground font-medium">Slug (identificador único) *</Label>
                  <Input
                    id="slug"
                    {...form.register('slug')}
                    placeholder="mi-empresa"
                    className={formInputClass + ' font-mono text-sm'}
                  />
                  <p className="text-xs text-muted-foreground">
                    Solo minúsculas, números y guiones. Debe ser único en el sistema.
                  </p>
                  {form.formState.errors.slug && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.slug.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="planId" className="text-foreground font-medium">Plan para esta empresa (opcional)</Label>
                <select
                  id="planId"
                  {...form.register('planId')}
                  disabled={plansLoading}
                  className={formSelectClass}
                >
                  <option value="">
                    {plansLoading ? 'Cargando planes…' : 'Sin plan (acceso por defecto)'}
                  </option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.includesDian ? 'Con DIAN' : 'Sin DIAN'}
                      {p.priceMonthly != null ? ` · $${p.priceMonthly.toLocaleString('es-CO')}/mes` : ''}
                    </option>
                  ))}
                </select>
                {plansLoading ? (
                  <p className="text-xs text-muted-foreground">Obteniendo planes disponibles…</p>
                ) : plans.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    Aún no hay planes. Ve a <span className="font-medium">Panel proveedor → Planes</span> para definirlos.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Si eliges un plan, la empresa tendrá acceso a los módulos incluidos y límites (ej. usuarios máximos).
                  </p>
                )}
                {form.formState.errors.planId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.planId.message}
                  </p>
                )}
                {plans.length > 0 && form.watch('planId') && (() => {
                  const selectedPlan = plans.find((p) => p.id === form.watch('planId'));
                  const hasYearly = selectedPlan?.stripePriceIdYearly && selectedPlan?.stripePriceId;
                  if (!hasYearly) return null;
                  return (
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <Label htmlFor="billingInterval" className="text-foreground font-medium">Cobro en Stripe</Label>
                      <select
                        id="billingInterval"
                        {...form.register('billingInterval')}
                        className={formSelectClass}
                      >
                        <option value="monthly">Mensual</option>
                        <option value="yearly">Anual</option>
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Este plan tiene precio mensual y anual en Stripe. Elige con cuál se creará la suscripción.
                      </p>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone" className="text-foreground font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  Número de contacto (opcional)
                </Label>
                <Input
                  id="contactPhone"
                  {...form.register('contactPhone')}
                  placeholder="Ej. +57 300 123 4567 o 601 234 5678"
                  className={formInputClass}
                  type="tel"
                />
                <p className="text-xs text-muted-foreground">
                  Teléfono del dueño o persona con quien desees que se comunique soporte (WhatsApp, llamada, etc.).
                </p>
                {form.formState.errors.contactPhone && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.contactPhone.message}
                  </p>
                )}
              </div>
            </div>

            {/* Razón social para facturas */}
            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/5 p-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                Razón social para facturas
              </h3>
              <div className="space-y-2">
                <Label htmlFor="issuerName" className="text-foreground font-medium">Razón social (opcional)</Label>
                <Input
                  id="issuerName"
                  {...form.register('issuerName')}
                  placeholder="Ej. Mi Empresa S.A.S."
                  className={formInputClass}
                />
                <p className="text-xs text-muted-foreground">
                  Este nombre aparecerá en las facturas. Si no lo indicas, se mostrará &quot;Mi Empresa&quot;. No se puede cambiar después desde la app.
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  <span>Debe ser la <strong>razón social legal</strong> registrada ante la DIAN. El cliente es responsable de que coincida con su registro tributario.</span>
                </p>
                {form.formState.errors.issuerName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.issuerName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Primer usuario administrador */}
            <div className="space-y-5 rounded-xl border border-border/60 bg-muted/5 p-4 border-l-4 border-l-primary/50">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary shrink-0" />
                Primer usuario administrador
              </h3>
              <p className="text-sm text-muted-foreground -mt-1">
                Este usuario podrá gestionar la empresa desde el primer momento. Solo el correo es obligatorio.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="adminEmail" className="text-foreground font-medium">Correo del admin *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    {...form.register('adminEmail')}
                    placeholder="admin@empresa.com"
                    className={formInputClass}
                  />
                  {form.formState.errors.adminEmail && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.adminEmail.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminName" className="text-foreground font-medium">Nombre del admin (opcional)</Label>
                  <Input
                    id="adminName"
                    {...form.register('adminName')}
                    placeholder="Ej. Juan Pérez"
                    className={formInputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPassword" className="text-foreground font-medium">Contraseña inicial (opcional)</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    {...form.register('adminPassword')}
                    placeholder="Vacío = se genera temporal"
                    className={formInputClass}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mín. 8 caracteres. Si se deja vacío, se genera una temporal que el admin debe cambiar al entrar.
                  </p>
                  {form.formState.errors.adminPassword && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.adminPassword.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2 border-t border-border/60">
              <Button type="submit" disabled={createTenant.isPending} className="rounded-xl font-medium">
                {createTenant.isPending ? 'Creando…' : 'Crear empresa y admin'}
              </Button>
              <Button type="button" variant="outline" asChild className="rounded-xl">
                <Link href="/provider">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
