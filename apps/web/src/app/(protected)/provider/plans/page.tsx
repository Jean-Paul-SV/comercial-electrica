'use client';

import Link from 'next/link';
import { useState } from 'react';
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
import { ArrowLeft, CreditCard, Pencil } from 'lucide-react';
import { usePlans, useUpdatePlan } from '@features/provider/hooks';
import type { PlanListItem } from '@features/provider/types';
import { formatMoney } from '@shared/utils/format';

const editPlanSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().or(z.literal('')),
  priceMonthly: z.coerce.number().min(0).optional(),
  priceYearly: z.coerce.number().min(0).optional(),
  stripePriceId: z.string().max(255).optional().or(z.literal('')),
  isActive: z.boolean(),
});

type EditPlanFormValues = z.infer<typeof editPlanSchema>;

function toFormValues(p: PlanListItem): EditPlanFormValues {
  return {
    name: p.name,
    description: p.description ?? '',
    priceMonthly: p.priceMonthly ?? undefined,
    priceYearly: p.priceYearly ?? undefined,
    stripePriceId: p.stripePriceId ?? '',
    isActive: p.isActive,
  };
}

export default function ProviderPlansPage() {
  const { data: plans = [], isLoading } = usePlans();
  const updatePlan = useUpdatePlan();
  const [editingPlan, setEditingPlan] = useState<PlanListItem | null>(null);

  const form = useForm<EditPlanFormValues>({
    resolver: zodResolver(editPlanSchema),
    defaultValues: toFormValues({
      id: '',
      name: '',
      slug: '',
      description: null,
      priceMonthly: null,
      priceYearly: null,
      stripePriceId: null,
      isActive: true,
    } as PlanListItem),
  });

  const openEdit = (plan: PlanListItem) => {
    setEditingPlan(plan);
    form.reset(toFormValues(plan));
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
          stripePriceId: values.stripePriceId || null,
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/provider">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al panel
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
          Planes
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestiona planes y precios. Asigna un <strong>Stripe Price ID</strong> para que al crear una empresa se cree la suscripción en Stripe.
        </p>
      </div>

      <Card className="border border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
            <CreditCard className="h-5 w-5 shrink-0 text-primary" />
            Listado de planes
          </CardTitle>
          <CardDescription>
            Solo los planes activos aparecen en el selector al crear o cambiar plan de una empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
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
              No hay planes. Crea planes desde la base de datos o el seed.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar plan</DialogTitle>
            {editingPlan && (
              <p className="text-sm text-muted-foreground">
                Slug: <span className="font-mono">{editingPlan.slug}</span> (no editable)
              </p>
            )}
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input id="edit-name" {...form.register('name')} className="rounded-lg" />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Descripción</Label>
              <Input id="edit-desc" {...form.register('description')} className="rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-monthly">Precio mensual</Label>
                <Input
                  id="edit-monthly"
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register('priceMonthly')}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-yearly">Precio anual</Label>
                <Input
                  id="edit-yearly"
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register('priceYearly')}
                  className="rounded-lg"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-stripe">Stripe Price ID</Label>
              <Input
                id="edit-stripe"
                placeholder="price_xxx"
                {...form.register('stripePriceId')}
                className="rounded-lg font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                ID del precio recurrente en Stripe. Si está definido, al crear una empresa con este plan se crea la suscripción en Stripe.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-active"
                {...form.register('isActive')}
                className="rounded border-input"
              />
              <Label htmlFor="edit-active">Plan activo (visible en selector)</Label>
            </div>
            <DialogFooter>
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
