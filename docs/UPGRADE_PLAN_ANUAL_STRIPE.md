# Upgrade de plan anual dentro de la misma suscripción (Stripe)

## Reglas de negocio

- El cliente tiene **Plan Básico anual** ya pagado (o cualquier plan anual).
- La suscripción tiene **billing_cycle_anchor** activo y **no debe reiniciarse**.
- El cliente quiere cambiar a **Plan Premium anual** (u otro plan superior) antes de que termine el periodo actual.

Requisitos:

1. El cambio se hace **dentro de la misma suscripción** (no se crea una nueva).
2. **No se reinicia** el `billing_cycle_anchor` (la fecha de renovación se mantiene).
3. Se genera **prorrateo automático**.
4. Stripe genera **crédito** por el tiempo no usado del plan anterior y **cargo proporcional** por el nuevo plan hasta la misma fecha de renovación.
5. Se cobra **solo la diferencia** en una factura inmediata.
6. En la **siguiente renovación** se cobra únicamente el valor completo del nuevo plan anual (sin duplicar periodo ni adelantar el año completo).

---

## Cómo lo implementa el backend

- Se llama a **`subscriptions.update`** con el nuevo `price` (Price ID del plan destino), **sin** pasar `billing_cycle_anchor`, de modo que Stripe mantiene la fecha de anclaje.
- Se usa **`proration_behavior: 'always_invoice'`** para que:
  - Stripe cree las líneas de prorrateo (crédito plan anterior + cargo proporcional plan nuevo).
  - Stripe **genere de inmediato** una factura con solo esas líneas y **intente cobrarla ya**.
  - La próxima factura (en la fecha de renovación) sea solo el **precio anual completo** del nuevo plan.

**Nota sobre `create_prorations`:**  
Si se usara `proration_behavior: 'create_prorations'`, Stripe crearía las líneas de prorrateo pero **no** emitiría factura en ese momento; esas líneas se añadirían a la **próxima** factura (la de la renovación). Eso haría que en la renovación el cliente viera una factura que mezcla prorrateo + año completo (por ejemplo 1.449.896 en lugar de solo 1.149.900). Para cumplir “factura inmediata solo con la diferencia” y “próxima factura solo año completo”, el backend usa `always_invoice`.

---

## Cómo Stripe genera la factura

1. **Al hacer el upgrade** (misma suscripción, mismo `billing_cycle_anchor`):
   - Stripe calcula el **crédito** por el tiempo no usado del plan actual (ej. Básico anual).
   - Stripe calcula el **cargo** proporcional por el nuevo plan (Premium anual) desde hoy hasta la **misma** fecha de renovación.
   - La **factura inmediata** contiene solo: `cargo proporcional Premium − crédito proporcional Básico` (la diferencia). Si el crédito es mayor que el cargo, el total puede ser 0 o un crédito para el cliente.
   - Stripe intenta cobrar esa factura con el método de pago por defecto.

2. **En la fecha de renovación** (sin reinicio de ciclo):
   - La siguiente factura generada por Stripe es **solo** el precio recurrente del nuevo plan (ej. 1.149.900 por un año de Premium).
   - No se duplica periodo ni se adelanta el cobro del año completo.

---

## Casos especiales y validaciones

- **Upgrade el mismo día de la compra:** El prorrateo puede ser muy pequeño o cero (mismo día = poco o ningún crédito/cargo). Stripe lo calcula correctamente.
- **Diferencia negativa o cero:** Si el crédito es mayor o igual al cargo, Stripe genera una factura con total 0 o con crédito. No se bloquea el cambio de plan; el backend no valida un mínimo (Stripe lo resuelve).
- **Error de pago (tarjeta falla):** Stripe no considera el update de la suscripción como fallido; la suscripción ya tiene el nuevo precio. La **factura** queda en estado de pago fallido y Stripe la reintentará según su política. El webhook **`invoice.payment_failed`** está manejado en la API para registrar el fallo y, si aplica, notificar o limitar acceso según tu lógica.

---

## Testing en staging (modo prueba Stripe)

1. **Crear suscripción anual de prueba**
   - Desde la app o desde Stripe Dashboard, crear una suscripción anual (ej. Básico anual) y asegurarse de que está activa y con `current_period_end` en el futuro.

2. **Hacer upgrade a Premium anual**
   - Desde la app: Facturación → elegir Plan Premium anual → confirmar cambio.
   - El backend actualiza la suscripción en Stripe con el nuevo precio y `proration_behavior: 'always_invoice'`.

3. **Comprobar en Stripe Dashboard**
   - **Customers** → el cliente → **Subscriptions**: la suscripción debe seguir siendo la misma (mismo ID), con el nuevo precio (Premium anual).
   - **Invoices**: debe aparecer una factura **recién creada** con solo líneas de prorrateo (crédito + cargo proporcional), no con el año completo del nuevo plan.
   - La **fecha de renovación** de la suscripción debe ser la misma que antes del cambio (no se reinicia el ciclo).

4. **Comprobar la próxima factura**
   - En Stripe: **Invoices** → “Upcoming” o la próxima factura programada para esa suscripción debe mostrar **solo** el monto anual del nuevo plan (ej. 1.149.900), sin líneas de prorrateo del upgrade.

5. **Probar fallo de pago (opcional)**
   - Usar una tarjeta de prueba que falle (ej. `4000 0000 0000 0341`).
   - Hacer upgrade y verificar que se recibe `invoice.payment_failed` y que la lógica de la API (logs, estado, etc.) es la esperada.

---

## Resumen técnico

| Requisito                         | Implementación                                                                 |
|-----------------------------------|---------------------------------------------------------------------------------|
| Misma suscripción                 | `subscriptions.update(subscription_id, { items: [...] })`                      |
| No reiniciar billing_cycle_anchor | No se envía `billing_cycle_anchor` en el update                               |
| Prorrateo automático              | Stripe lo calcula al cambiar el ítem de precio                                |
| Factura inmediata solo diferencia | `proration_behavior: 'always_invoice'`                                       |
| Próxima factura solo año completo | Al no reiniciar el ciclo, la siguiente factura es solo el recurrente del plan |
| Errores de pago                   | Webhook `invoice.payment_failed` + reintentos de Stripe                        |

Código backend: método `updateSubscriptionForUpgrade` en `apps/api/src/billing/billing.service.ts`, llamado desde `applyUpgrade` cuando ya existe suscripción en Stripe y el cliente hace upgrade (mismo intervalo, plan distinto).
