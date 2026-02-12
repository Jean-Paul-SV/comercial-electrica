# Cómo vender Facturación electrónica DIAN (Orion) y plan de ideas

Documento comercial y de producto para empaquetar, posicionar y vender el módulo de facturación electrónica DIAN en un SaaS multi-tenant.

**Objetivo:** vender **valor (cumplimiento + operación sin fricciones)**, no “XMLs y SOAP”.

**Principio clave:** en Colombia, DIAN no es “activar un switch”: requiere **certificado, resolución, rangos, habilitación, contingencias**. La propuesta ganadora suele ser **híbrida**: autoservicio guiado + opción administrada.

---

## 1) Modelo recomendado: Híbrido (autoservicio guiado + administrado opcional)

### Por qué no solo autoservicio
- Reduce costos, pero aumenta churn si el cliente se bloquea con habilitación/errores DIAN.
- Riesgo de “compré y no pude facturar” → tickets urgentes + mala reputación.

### Por qué no solo administrado
- No escala (cuello de botella operativo).
- “Picos” de soporte a fin de mes/fin de año.

### Híbrido (recomendado)
- **Autoservicio guiado** para escalar.
- **Servicio administrado** como add-on para clientes que quieren “llave en mano”.
- Mejor LTV: el add-on paga el esfuerzo real de onboarding y reduce devoluciones.

> Nota legal/operativa: **cada empresa debe tener su propio certificado** (.p12) y su propia configuración (NIT, resolución, rangos, Software ID/PIN). Tú no deberías ser dueño del certificado ni absorber ese costo.

---

## 2) Paquetes sugeridos (planes)

Adáptalos a tu segmento. Mantén el mensaje simple: **“Facturas DIAN sin dolores”**.

### Plan Base – “DIAN listo con asistente”
**Incluye:**
- Asistente paso a paso (checklist) para habilitación / producción.
- Validaciones automáticas (certificado vencido, rango agotado, campos faltantes).
- Bloqueos seguros: si no está “Listo”, no deja emitir electrónica.
- Reintentos controlados y mensajes claros de error.
- Soporte estándar (email/chat, horario).

**Ideal para:** micro/pyme con alguien técnico/contable dispuesto a configurar.

### Add-on Pro – “Onboarding DIAN administrado”
**Incluye:**
- Revisión de documentos y prerequisitos.
- Acompañamiento en habilitación (hasta “Listo para producir”).
- Configuración hecha por tu equipo (con accesos controlados).
- Capacitación corta (30–60 min) y checklist final.
- SLA de respuesta.

**Ideal para:** pymes/medianas que quieren facturar rápido sin aprender DIAN.

### Enterprise – “Operación crítica”
**Incluye:**
- SLA alto, canal prioritario, monitoreo y alertas.
- Reportes/auditoría (eventos, estados DIAN, trazabilidad).
- Flujos avanzados (multi-sede, integraciones, volumen, roles finos).

---

## 3) Qué prometer (propuesta de valor) y qué NO prometer

### Promesa clara (la que se entiende y compra)
- “Te dejamos **listo para facturar electrónicamente** y te alertamos antes de que DIAN te bloquee.”
- “Menos errores, menos rechazos, menos estrés de fin de mes.”
- “Soporte real cuando DIAN responde raro.”

### No prometer (para no quemarte)
- “Aprobación DIAN garantizada en X horas” (depende de DIAN/proveedor tecnológico/proceso del cliente).
- “Nosotros ponemos tu certificado” (no es escalable y te amarra riesgos).

---

## 4) Guion corto de venta (pitch)

### Pitch de 20 segundos
“Orion te permite emitir facturas electrónicas DIAN por empresa, con un asistente que valida todo antes de enviar. Si quieres, hacemos el onboarding por ti para que quedes listo en producción sin dolores.”

### Pitch de 60–90 segundos (con dolor)
“La DIAN no falla por ‘tu software’, falla por certificados vencidos, rangos agotados, resolución mal puesta o datos incompletos. Orion te muestra un estado claro (‘No configurado / Incompleto / Listo’) y te bloquea de forma segura antes de que emitas mal. Y si prefieres, nuestro equipo te acompaña en habilitación y te deja ‘Listo para producir’.”

---

## 5) Demo que vende (orden recomendado)

1. **Estado DIAN del tenant**: badge + explicación (“Listo / Incompleto / Certificado vencido / Rango agotado”).
2. **Asistente / checklist**: qué falta y cómo resolverlo.
3. **Subida de certificado** (seguro): “se almacena cifrado, no se vuelve a mostrar”.
4. **Numeración y resolución**: mostrar validación de rango.
5. **Simulación de emisión** (habilitación): evidencia de trazabilidad (IDs, logs, estados).
6. **Alertas**: “faltan 15 días para vencimiento” / “quedan 200 números”.

---

## 6) Objeciones típicas y respuestas

### “¿Por qué tengo que subir mi certificado?”
Porque el certificado de firma **es de tu empresa** y DIAN exige que cada emisor firme con su propia identidad. Orion lo guarda **cifrado** y solo lo usa al momento de firmar.

### “¿No puedes usar un certificado para todos?”
Técnica y legalmente es un mal diseño: mezclar identidad rompe trazabilidad y abre riesgos. En SaaS multi-tenant cada empresa debe firmar con su propia identidad.

### “Yo no sé configurar DIAN”
Por eso hay dos caminos: **autoservicio guiado** (asistente paso a paso) o **onboarding administrado** (nosotros lo hacemos contigo).

### “¿Qué pasa si DIAN está caída?”
Orion registra el intento, aplica reintentos controlados y deja evidencia. (Si implementas contingencia, se explica el flujo y tiempos.)

---

## 7) Proceso de onboarding recomendado (operación)

### Autoservicio guiado (Base)
1. Cliente crea empresa (tenant) y usuarios.
2. Abre **Cuenta → Facturación electrónica**.
3. Completa emisor + software + resolución/rangos.
4. Sube certificado (.p12) + contraseña.
5. Estado pasa a “Listo para facturar”.
6. Emite primera factura en habilitación / producción (según aplique).

### Onboarding administrado (Add-on)
1. Reunión de 30 min (recolección: NIT, razón social, software, resolución, certificado).
2. Carga/validación por tu equipo (con checklist).
3. Prueba controlada + capacitación.
4. “Go-live” con monitoreo 48–72h (opcional).

---

## 8) Métricas que importan (para vender y para producto)

### De negocio
- Activación: % tenants que pasan a “Listo para facturar” en 7 días.
- Conversión al add-on administrado.
- Churn a 30/60/90 días del módulo DIAN.

### De operación/DIAN
- Tasa de rechazo DIAN y causas principales.
- Tiempo promedio de resolución de errores.
- Certificados por vencer (pipeline de riesgo).
- Rangos por agotarse.

---

## 9) Ideas de producto (backlog) por fases

### Fase 1 (MVP vendible)
- Estado claro + checklist (No configurado / Incompleto / Listo).
- Subida de certificado cifrado.
- Validaciones: certificado vencido, rango agotado, campos faltantes.
- Logs de envío y trazabilidad por documento.

### Fase 2 (Reducir tickets y churn)
- Alertas por email/in-app: vencimiento certificado, rango bajo, errores repetidos.
- “Diagnóstico” automático con recomendaciones accionables.
- Plantillas de configuración por tipo de empresa (básico).

### Fase 3 (Operación seria / escala)
- Contingencia (si aplica a tu alcance): colas, reintentos y “modo contingencia” documentado.
- Auditoría: quién cambió config, cuándo, y por qué.
- Roles finos: solo ciertos usuarios pueden subir certificado/editar resolución.

### Fase 4 (Revenue expand)
- Servicio administrado con SLA + panel interno de onboarding.
- Integraciones (ERP, e-commerce, POS).
- Reportes: estado DIAN por periodo, causas de rechazo, tiempos.

---

## 10) Recomendación de pricing (guía, no regla)

Estructura simple:
- **Base:** incluido en plan o como módulo extra mensual por empresa (tenant).
- **Administrado (add-on):** pago único de onboarding + opcional mensual por soporte premium.
- **Enterprise:** contrato anual con SLA y volumen.

> Importante: el costo del certificado **lo paga la empresa**, no el SaaS. Tu valor es la habilitación/operación y el soporte, no el certificado.

---

## 11) Texto listo para web (landing / sección de precios)

### Título
**Facturación electrónica DIAN sin complicaciones**

### Subtítulo
Configura tu empresa con un asistente paso a paso o deja que lo hagamos por ti. Orion valida y te avisa antes de que un certificado vencido o un rango agotado te frene.

### Bullets
- Estado claro: No configurado / Incompleto / Listo para facturar
- Certificado cifrado y seguro
- Validaciones automáticas (vencimiento, rangos, datos)
- Trazabilidad completa por documento
- Onboarding administrado opcional con SLA

---

## 12) Enlaces útiles del repo (operación/tech)

- `docs/CONFIGURAR_FACTURACION_ELECTRONICA_PASOS.md` (paso a paso de configuración)
- `docs/DIAN_PRODUCCION_RENDER.md` (qué se configura en Render)
- `docs/GUIA_CONFIGURACION_DIAN_Y_TROUBLESHOOTING.md` (errores típicos)

