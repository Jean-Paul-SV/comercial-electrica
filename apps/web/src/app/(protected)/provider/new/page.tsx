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
import { Select } from '@shared/components/ui/select';
import { ArrowLeft, Building2 } from 'lucide-react';
import { useCreateTenant, usePlans } from '@features/provider/hooks';

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
  adminEmail: z.string().email('Correo del administrador inválido'),
  adminName: z.string().max(200).optional(),
  adminPassword: z
    .string()
    .min(8, 'Mínimo 8 caracteres si se define')
    .optional()
    .or(z.literal('')),
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
      adminEmail: '',
      adminName: '',
      adminPassword: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await createTenant.mutateAsync({
        name: values.name,
        slug: values.slug,
        planId: values.planId?.trim() || undefined,
        adminEmail: values.adminEmail.trim(),
        adminName: values.adminName?.trim() || undefined,
        adminPassword: values.adminPassword?.trim() || undefined,
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
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/provider">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Volver</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Nueva empresa
          </h1>
          <p className="text-muted-foreground text-sm">
            Crear tenant y primer usuario administrador.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la empresa</CardTitle>
          <CardDescription>
            Crea la empresa (tenant) y su primer administrador en un solo paso. El identificador (slug) no se puede cambiar después.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-8 max-w-xl">
            {/* Datos de la empresa */}
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Datos de la empresa
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre (como aparecerá en la app)</Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    placeholder="Ej. Mi Comercio S.A.S."
                    className="rounded-lg"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (identificador único)</Label>
                  <Input
                    id="slug"
                    {...form.register('slug')}
                    placeholder="mi-empresa"
                    className="rounded-lg font-mono"
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
                <Label htmlFor="planId">Plan para esta empresa (opcional)</Label>
                <Select
                  id="planId"
                  {...form.register('planId')}
                  disabled={plansLoading}
                >
                  <option value="">
                    {plansLoading ? 'Cargando planes…' : 'Sin plan (acceso por defecto)'}
                  </option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.priceMonthly != null ? ` — $${p.priceMonthly.toLocaleString('es-CO')} / mes` : ''}
                    </option>
                  ))}
                </Select>
                {plansLoading ? (
                  <p className="text-xs text-muted-foreground">Obteniendo planes disponibles…</p>
                ) : plans.length === 0 ? (
                  <p className="text-xs text-amber-400">
                    Aún no hay planes creados. Ve a <span className="font-medium">Panel proveedor → Planes</span>{' '}
                    para definirlos y poder asignarlos a las nuevas empresas.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Si eliges un plan, la empresa tendrá acceso a los módulos incluidos y podrás controlar límites
                    como usuarios máximos.
                  </p>
                )}
                {form.formState.errors.planId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.planId.message}
                  </p>
                )}
              </div>
            </div>

            {/* Primer usuario administrador */}
            <div className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Primer usuario administrador
              </p>
              <p className="text-sm text-muted-foreground">
                Este usuario podrá gestionar la empresa desde el primer momento. Obligatorio indicar correo; el resto es opcional.
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">
                    Correo del admin <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    {...form.register('adminEmail')}
                    placeholder="admin@empresa.com"
                    className="rounded-lg"
                  />
                  {form.formState.errors.adminEmail && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.adminEmail.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminName">Nombre del admin (opcional)</Label>
                  <Input
                    id="adminName"
                    {...form.register('adminName')}
                    placeholder="Ej. Juan Pérez"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Contraseña inicial (opcional)</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    {...form.register('adminPassword')}
                    placeholder="Dejar vacío para generar una temporal"
                    className="rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo 8 caracteres. Si la dejas vacía, se generará una contraseña temporal que el admin deberá cambiar en el primer acceso.
                  </p>
                  {form.formState.errors.adminPassword && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.adminPassword.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={createTenant.isPending}>
                {createTenant.isPending ? 'Creando…' : 'Crear empresa y admin'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/provider">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
