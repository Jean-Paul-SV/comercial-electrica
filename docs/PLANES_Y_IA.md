# Planes y módulo IA

Qué planes incluyen el módulo de IA y cómo funciona.

---

## Qué planes tienen IA

El **módulo `ai`** da acceso al **resumen del dashboard en lenguaje natural** (una o dos frases generadas con IA a partir de los indicadores accionables). Requiere `OPENAI_API_KEY` en el servidor para usar el LLM; si no está configurada, se devuelve un resumen automático basado en los primeros insights.

| Plan | ¿Tiene IA? |
|------|------------|
| **Básico sin DIAN** | No |
| **Básico con DIAN** | No |
| **Premium sin DIAN** | Sí |
| **Premium con DIAN** | Sí |
| **Enterprise** | Sí |
| **Todo incluido** (compatibilidad) | Sí |

**Criterio:** Los planes **Premium** y **Enterprise** incluyen el módulo `ai`. Los planes **Básicos** no, para mantener un precio más bajo y diferenciar la oferta.

---

## Cómo se aplica

- En la **API**, el endpoint `GET /reports/dashboard-summary` está protegido con `@RequireModule('ai')`. Si el tenant no tiene el módulo `ai` (por su plan), responde **403** con mensaje de módulo no contratado.
- En la **web**, el dashboard muestra el resumen cuando la respuesta es correcta. Si la respuesta es 403, se muestra: *"El resumen con IA está disponible en Plan Premium o Enterprise."*
- El **seed** asigna el módulo `ai` a los planes Premium (sin y con DIAN), Enterprise y Todo incluido. Tras cambiar el seed, hay que ejecutar `npm run prisma:seed -w api` (o con `SEED_PLANS_ONLY=true` si solo quieres actualizar planes).

---

## Añadir IA a un plan personalizado (panel proveedor)

Al **crear o editar un plan** desde el panel proveedor, la lista de módulos por defecto incluye `ai`. Puedes activar o desactivar módulos según el plan que definas. Los tenants con ese plan tendrán acceso al resumen con IA si el módulo `ai` está en las features del plan.
