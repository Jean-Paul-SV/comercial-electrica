'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { DianActivationDisclaimer } from '@shared/components/DianActivationDisclaimer';
import { Input } from '@shared/components/ui/input';
import { MoneyInput } from '@shared/components/ui/money-input';
import { Label } from '@shared/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@shared/components/ui/dialog';
import { Badge } from '@shared/components/ui/badge';
import { Skeleton } from '@shared/components/ui/skeleton';
import { ArrowLeft, CreditCard, Pencil, Plus } from 'lucide-react';
import { usePlans, useCreatePlan, useUpdatePlan } from '@features/provider/hooks';
import type { PlanListItem } from '@features/provider/types';
import { formatMoney } from '@shared/utils/format';

const editPlanSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().or(z.literal('')),
  priceMonthly: z.coerce.number().min(0).optional(),
  priceYearly: z.coerce.number().min(0).optional(),
  maxUsers: z
    .union([z.coerce.number().min(1, 'Mínimo 1'), z.literal('')])
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  stripePriceId: z.string().max(255).optional().or(z.literal('')),
  stripePriceIdYearly: z.string().max(255).optional().or(z.literal('')),
  isActive: z.boolean(),
});

type EditPlanFormValues = z.infer<typeof editPlanSchema>;

const newPlanSchema = z.object({
  name: z.string().min(1, 'Nombre obligatorio').max(200),
  slug: z.string().min(1, 'Slug obligatorio').max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones'),
  description: z.string().max(500).optional().or(z.literal('')),
  priceMonthly: z.coerce.number().min(0).optional(),
  priceYearly: z.coerce.number().min(0).optional(),
  maxUsers: z
    .union([z.coerce.number().min(1, 'Mínimo 1'), z.literal('')])
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  stripePriceId: z.string().max(255).optional().or(z.literal('')),
  stripePriceIdYearly: z.string().max(255).optional().or(z.literal('')),
  isActive: z.boolean(),
  includesDian: z.boolean(),
});
type NewPlanFormValues = z.infer<typeof newPlanSchema>;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'plan';
}

function toFormValues(p: PlanListItem): EditPlanFormValues {
  return {
    name: p.name,
    description: p.description ?? '',
    priceMonthly: p.priceMonthly ?? undefined,
    priceYearly: p.priceYearly ?? undefined,
    maxUsers: p.maxUsers ?? undefined,
    stripePriceId: p.stripePriceId ?? '',
    stripePriceIdYearly: p.stripePriceIdYearly ?? '',
    isActive: p.isActive,
  };
}

export default function ProviderPlansPage() {
  const { data: plans = [], isLoading } = usePlans();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const [editingPlan, setEditingPlan] = useState<PlanListItem | null>(null);
  const [openNewPlan, setOpenNewPlan] = useState(false);

  const form = useForm<EditPlanFormValues>({
    resolver: zodResolver(editPlanSchema),
    defaultValues: toFormValues({
      id: '',
      name: '',
      slug: '',
      description: null,
      priceMonthly: null,
      priceYearly: null,
      maxUsers: null,
      stripePriceId: null,
      stripePriceIdYearly: null,
      isActive: true,
      includesDian: false,
    } as PlanListItem),
  });

  const newPlanForm = useForm<NewPlanFormValues>({
    resolver: zodResolver(newPlanSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      priceMonthly: undefined,
      priceYearly: undefined,
      maxUsers: undefined,
      stripePriceId: '',
      stripePriceIdYearly: '',
      isActive: true,
      includesDian: true,
    },
  });

  useEffect(() => {
    if (openNewPlan) {
      newPlanForm.reset({
        name: '',
        slug: '',
        description: '',
        priceMonthly: undefined,
        priceYearly: undefined,
        maxUsers: undefined,
        stripePriceId: '',
        stripePriceIdYearly: '',
        isActive: true,
        includesDian: true,
      });
    }
  }, [openNewPlan, newPlanForm]);

  const openEdit = (plan: PlanListItem) => {
    setEditingPlan(plan);
    form.reset(toFormValues(plan));
  };

  const syncSlugFromName = (name: string) => {
    newPlanForm.setValue('slug', slugify(name));
  };

  const onSubmitNew = (values: NewPlanFormValues) => {
    createPlan.mutate(
      {
        name: values.name,
        slug: values.slug,
        description: values.description || undefined,
        priceMonthly: values.priceMonthly,
        priceYearly: values.priceYearly,
        maxUsers: values.maxUsers ?? null,
        stripePriceId: values.stripePriceId || null,
        stripePriceIdYearly: values.stripePriceIdYearly || null,
        isActive: values.isActive,
        includesDian: values.includesDian,
      },
      {
        onSuccess: () => {
          toast.success('Plan creado');
          setOpenNewPlan(false);
          newPlanForm.reset({
            name: '',
            slug: '',
            description: '',
            priceMonthly: undefined,
            priceYearly: undefined,
            maxUsers: undefined,
            stripePriceId: '',
            stripePriceIdYearly: '',
            isActive: true,
            includesDian: true,
          });
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo crear el plan');
        },
      }
    );
  };

  const onSave = (values: EditPlanFormValues) => {
    if (!editingPlan) return;
    updatePlan.mutate(
      {
        id: editingPlan.id,
        payload: {
          name: values.name,
          description: values.description || undefined,
          priceMonthly: values.priceMonthly,
          priceYearly: values.priceYearly,
          maxUsers: values.maxUsers ?? null,
          stripePriceId: values.stripePriceId || null,
          stripePriceIdYearly: values.stripePriceIdYearly || null,
          isActive: values.isActive,
        },
      },
      {
        onSuccess: () => {
          toast.success('Plan actualizado');
          setEditingPlan(null);
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo actualizar el plan');
        },
      }
    );
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <CreditCard className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            Planes
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Gestiona planes y precios: <strong>plan sin DIAN</strong> (solo documento interno) y <strong>plan con DIAN</strong> (facturación electrónica). Asigna un Stripe Price ID para suscripciones automáticas.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
            <Link href="/provider">
              <ArrowLeft className="h-4 w-4" />
              Volver al panel
            </Link>
          </Button>
          <Button size="sm" onClick={() => setOpenNewPlan(true)} className="gap-2 rounded-xl bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4" />
            Nuevo plan
          </Button>
        </div>
      </header>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="p-6 pb-4 border-b border-border/60">
          <p className="text-lg font-medium text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 shrink-0 text-primary" />
            Listado de planes
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            La columna Facturación indica si el plan incluye DIAN. Solo los planes activos aparecen al asignar plan a una empresa.
          </p>
        </div>
        <div className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/80">
                  <TableHead className="font-medium text-muted-foreground">Nombre</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Slug</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Facturación</TableHead>
                  <TableHead className="text-right font-medium text-muted-foreground">Lím. usuarios</TableHead>
                  <TableHead className="text-right font-medium text-muted-foreground">P. mensual</TableHead>
                  <TableHead className="text-right font-medium text-muted-foreground">P. anual</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Stripe Price ID</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id} className="hover:bg-muted/40">
                    <TableCell className="font-medium text-foreground">{plan.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{plan.slug}</TableCell>
                    <TableCell>
                      <Badge variant={plan.includesDian ? 'default' : 'outline'} className="font-normal">
                        {plan.includesDian ? 'Con DIAN' : 'Sin DIAN'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {plan.maxUsers != null ? plan.maxUsers : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {plan.priceMonthly != null ? formatMoney(plan.priceMonthly) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {plan.priceYearly != null ? formatMoney(plan.priceYearly) : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {plan.stripePriceId ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                        {plan.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => openEdit(plan)}
                        title="Editar plan"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoading && plans.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay planes. Crea uno con &quot;Nuevo plan&quot;.
            </div>
          )}
        </div>
      </div>

      {/* Dialog: Nuevo plan */}
      <Dialog open={openNewPlan} onOpenChange={setOpenNewPlan}>
        <DialogContent showClose className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo plan</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Elige si el plan incluye facturación electrónica DIAN o no. Define nombre, precios y, si cobras por Stripe, el ID del precio.
            </p>
          </DialogHeader>
          <form onSubmit={newPlanForm.handleSubmit(onSubmitNew)} className="space-y-6">
            {/* Facturación DIAN */}
            <div className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Facturación electrónica</p>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="new-includesDian"
                  {...newPlanForm.register('includesDian')}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="new-includesDian" className="cursor-pointer text-sm font-medium">
                  Incluir facturación electrónica DIAN (plan con DIAN)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Si lo marcas, la empresa podrá configurar certificado y emitir facturas electrónicas a la DIAN. Si no, solo tendrá documentos internos.
              </p>
              <DianActivationDisclaimer variant="inline" className="text-xs mt-2" />
            </div>

            {/* Datos del plan */}
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Datos del plan</p>
              <div className="space-y-2">
                <Label htmlFor="new-name">Nombre (como lo verá el cliente)</Label>
                <Input
                  id="new-name"
                  {...newPlanForm.register('name', {
                    onChange: (e) => syncSlugFromName((e.target as HTMLInputElement).value),
                  })}
                  className="rounded-lg"
                  placeholder="Ej. Plan básico"
                />
                {newPlanForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{newPlanForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-slug">Identificador (slug)</Label>
                <Input
                  id="new-slug"
                  {...newPlanForm.register('slug')}
                  className="rounded-lg font-mono text-sm"
                  placeholder="plan-basico"
                />
                <p className="text-xs text-muted-foreground">
                  Se rellena solo al escribir el nombre. Solo minúsculas, números y guiones. No puede cambiarse después.
                </p>
                {newPlanForm.formState.errors.slug && (
                  <p className="text-sm text-destructive">{newPlanForm.formState.errors.slug.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-desc">Descripción (opcional)</Label>
                <textarea
                  id="new-desc"
                  {...newPlanForm.register('description')}
                  rows={2}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Breve descripción del plan para uso interno"
                />
              </div>
            </div>

            {/* Precios y límite de usuarios */}
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Precios y límite (opcional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-monthly">Mensual (COP)</Label>
                  <Controller
                    control={newPlanForm.control}
                    name="priceMonthly"
                    render={({ field }) => (
                      <MoneyInput
                        id="new-monthly"
                        className="rounded-lg"
                        placeholder="0"
                        value={field.value ?? undefined}
                        onChangeValue={(val) => field.onChange(val ?? undefined)}
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-yearly">Anual (COP)</Label>
                  <Controller
                    control={newPlanForm.control}
                    name="priceYearly"
                    render={({ field }) => (
                      <MoneyInput
                        id="new-yearly"
                        className="rounded-lg"
                        placeholder="0"
                        value={field.value ?? undefined}
                        onChangeValue={(val) => field.onChange(val ?? undefined)}
                      />
                    )}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-maxUsers">Límite de usuarios por empresa (opcional)</Label>
                <Input
                  id="new-maxUsers"
                  type="number"
                  min="1"
                  {...newPlanForm.register('maxUsers')}
                  className="rounded-lg w-28"
                  placeholder="Sin límite"
                />
                <p className="text-xs text-muted-foreground">
                  Máximo de usuarios que puede tener una empresa con este plan. Vacío = sin límite.
                </p>
                {newPlanForm.formState.errors.maxUsers && (
                  <p className="text-sm text-destructive">{newPlanForm.formState.errors.maxUsers.message}</p>
                )}
              </div>
            </div>

            {/* Stripe */}
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cobro con Stripe (opcional)</p>
              <div className="space-y-2">
                <Label htmlFor="new-stripe">Stripe Price ID (mensual)</Label>
                <Input
                  id="new-stripe"
                  placeholder="price_1ABC..."
                  {...newPlanForm.register('stripePriceId')}
                  className="rounded-lg font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-stripe-yearly">Stripe Price ID (anual)</Label>
                <Input
                  id="new-stripe-yearly"
                  placeholder="price_1XYZ..."
                  {...newPlanForm.register('stripePriceIdYearly')}
                  className="rounded-lg font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Mensual y/o anual. Al crear una empresa podrás elegir cobro mensual o anual si el plan tiene ambos.
                </p>
              </div>
            </div>

            {/* Estado */}
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              <input
                type="checkbox"
                id="new-active"
                {...newPlanForm.register('isActive')}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="new-active" className="cursor-pointer text-sm font-normal">
                Plan activo — visible en el selector al crear o cambiar plan de una empresa
              </Label>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setOpenNewPlan(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createPlan.isPending}>
                {createPlan.isPending ? 'Creando…' : 'Crear plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent showClose className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar plan</DialogTitle>
            {editingPlan && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Identificador: <span className="font-mono font-medium">{editingPlan.slug}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Se usa en la configuración y en el selector de planes; no se puede modificar después de crear el plan.
                </p>
              </div>
            )}
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
            {/* Datos del plan */}
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Datos del plan</p>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre (como lo verá el cliente)</Label>
                <Input id="edit-name" {...form.register('name')} className="rounded-lg" />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Descripción (opcional)</Label>
                <textarea
                  id="edit-desc"
                  {...form.register('description')}
                  rows={2}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Breve descripción del plan para uso interno"
                />
              </div>
            </div>

            {/* Precios y límite de usuarios */}
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Precios y límite (opcional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-monthly">Mensual (COP)</Label>
                  <Controller
                    control={form.control}
                    name="priceMonthly"
                    render={({ field }) => (
                      <MoneyInput
                        id="edit-monthly"
                        className="rounded-lg"
                        placeholder="0"
                        value={field.value ?? undefined}
                        onChangeValue={(val) => field.onChange(val ?? undefined)}
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-yearly">Anual (COP)</Label>
                  <Controller
                    control={form.control}
                    name="priceYearly"
                    render={({ field }) => (
                      <MoneyInput
                        id="edit-yearly"
                        className="rounded-lg"
                        placeholder="0"
                        value={field.value ?? undefined}
                        onChangeValue={(val) => field.onChange(val ?? undefined)}
                      />
                    )}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-maxUsers">Límite de usuarios por empresa (opcional)</Label>
                <Input
                  id="edit-maxUsers"
                  type="number"
                  min="1"
                  {...form.register('maxUsers')}
                  className="rounded-lg w-28"
                  placeholder="Sin límite"
                />
                <p className="text-xs text-muted-foreground">
                  Máximo de usuarios que puede tener una empresa con este plan. Vacío = sin límite.
                </p>
                {form.formState.errors.maxUsers && (
                  <p className="text-sm text-destructive">{form.formState.errors.maxUsers.message}</p>
                )}
              </div>
            </div>

            {/* Stripe */}
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cobro con Stripe (opcional)</p>
              <div className="space-y-2">
                <Label htmlFor="edit-stripe">Stripe Price ID (mensual)</Label>
                <Input
                  id="edit-stripe"
                  placeholder="price_1ABC..."
                  {...form.register('stripePriceId')}
                  className="rounded-lg font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-stripe-yearly">Stripe Price ID (anual)</Label>
                <Input
                  id="edit-stripe-yearly"
                  placeholder="price_1XYZ..."
                  {...form.register('stripePriceIdYearly')}
                  className="rounded-lg font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Mensual y/o anual. La empresa puede elegir cobro mensual o anual si el plan tiene ambos.
                </p>
              </div>
            </div>

            {/* Estado */}
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Estado</p>
              <div className="flex items-center gap-3 rounded-lg border-2 border-border/70 bg-muted/30 p-4">
                <input
                  type="checkbox"
                  id="edit-active"
                  {...form.register('isActive')}
                  className="h-4 w-4 rounded border-input"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="edit-active" className="cursor-pointer text-sm font-medium">
                    Plan activo
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Si está activo, aparecerá en el selector al crear o cambiar el plan de una empresa. Si lo desactivas, no se podrá asignar a nuevas empresas.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setEditingPlan(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updatePlan.isPending}>
                {updatePlan.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
