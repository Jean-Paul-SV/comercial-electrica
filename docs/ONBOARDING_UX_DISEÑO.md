# Onboarding y guía para usuarios no técnicos

**Autor:** Senior UX Designer – Software empresarial  
**Objetivo:** Que cualquier persona pueda administrar el negocio sin conocimientos técnicos: **reducir estrés operativo** y **guiar paso a paso** con mensajes claros y no técnicos.  
**Usuario objetivo:** Personas reales, no técnicas, bajo presión diaria (dueño de negocio, encargado, cajero).

---

## 1. Principios de diseño

### 1.1 Usuario bajo presión

- **Tiempo limitado:** No pueden leer manuales. Cada pantalla debe explicar en una frase qué hacer y por qué importa.
- **Miedo a equivocarse:** Evitar jerga técnica (“configuración”, “sesión”, “entidad”). Usar lenguaje del negocio: “Abrir caja”, “Dar de alta un producto”, “Cerrar el día”.
- **Necesidad de control:** Mostrar siempre en qué paso están y cuántos faltan. No bloquear todo el sistema si falta algo opcional; bloquear solo lo imprescindible (ej. no vender sin caja abierta).
- **Refuerzo positivo:** Celebrar pasos completados (“Listo, tu caja está abierta”). No castigar con mensajes largos ni listas de errores técnicas.

### 1.2 Guiar sin abrumar

- **Un paso a la vez:** En pantallas de onboarding, una sola acción principal. Opcional: “¿Quieres hacer algo más?” con enlace corto.
- **Mínimo viable primero:** Configuración mínima para “empezar a vender hoy”. El resto (reportes, proveedores, DIAN) puede ser después.
- **Checklists visibles pero no invasivas:** Una barra o panel de “Tu progreso” que no tape el contenido; que se pueda colapsar o cerrar y volver a abrir desde un enlace fijo.
- **Salida siempre visible:** “Omitir por ahora” o “Hacerlo después” en pasos no críticos, con recordatorio suave más adelante (ej. en el dashboard).

---

## 2. Flujo completo de onboarding

### 2.1 Momentos del usuario

| Momento | Qué pasa | Objetivo UX |
|--------|----------|-------------|
| **Primera vez (negocio nuevo)** | No hay datos: sin caja, sin productos, sin clientes. | Llevar al usuario a “puedo registrar mi primera venta” en pocos pasos. |
| **Cada día (operación)** | Abrir caja al inicio, cerrar al cierre. | Recordatorios claros (“Abre la caja para empezar”) y flujo corto. |
| **Configuración pendiente** | Falta algo recomendado (ej. categorías, datos fiscales). | Mostrar checklist de “Recomendado para tu negocio” sin bloquear. |
| **Ya configurado** | Todo listo para operar. | Dashboard tranquilo; alertas solo cuando haya algo que hacer (ver doc Estados operativos). |

### 2.2 Flujo de onboarding inicial (negocio nuevo)

Flujo lineal recomendado, con posibilidad de “Omitir por ahora” en pasos no críticos.

```
[Login o primer acceso]
        ↓
   ¿Es la primera vez? (no hay caja, no hay productos, o flag onboarding incompleto)
        ↓ Sí
   Pantalla de bienvenida (1 pantalla)
   "Bienvenido. En 3 pasos podrás registrar tu primera venta."
   [Empezar]  [Entendido, ir al sistema]
        ↓
   PASO 1: Abrir caja
   "Para registrar ventas necesitas tener la caja abierta."
   Mensaje: "Es como abrir la gaveta al inicio del día. Indica con cuánto dinero empiezas."
   Campo: Monto inicial (opcional, puede ser 0).
   [Abrir caja]  [Omitir por ahora] → si omite, al ir a Ventas se muestra recordatorio.
        ↓
   PASO 2: Tu primer producto (o “Catálogo”)
   "Así tus ventas tendrán qué vender. Puedes agregar más después."
   Opción A: "Agregar un producto ahora" → formulario corto (nombre, precio, cantidad en stock).
   Opción B: "Tengo muchos productos, los cargo después" [Omitir].
        ↓
   PASO 3: ¿Listo para vender?
   "Ya puedes registrar tu primera venta."
   Resumen: Caja abierta ✓ | Al menos 1 producto (o "Agregar en la venta") ✓
   [Ir a Ventas]  [Ver mi resumen]
        ↓
   [Fin onboarding] → Marcar onboarding completado. Entrar a Dashboard o a Ventas.
```

**Duración objetivo:** Menos de 5 minutos si el usuario no omite nada. Si omite, puede volver desde “Tu progreso” o desde recordatorios en Dashboard/Caja/Ventas.

### 2.3 Definición de “primera vez”

- **Condición sugerida:**  
  - No existe ninguna sesión de caja cerrada ni abierta **o**  
  - No hay productos activos **o**  
  - Flag explícito `onboardingCompletedAt = null` (si se guarda en backend).
- **Comportamiento:** Tras login, si “primera vez” → redirigir a pantalla de bienvenida del onboarding. Si no, ir al Dashboard (o a la ruta que tenía antes).

### 2.4 Integración con el resto de la app

- **Durante el onboarding:** Mostrar barra superior simple (nombre del sistema, “Paso X de 3”) sin menú lateral completo, para no distraer.
- **Después del onboarding:** Menú normal. En Dashboard (o en un panel “Tu progreso”) seguir mostrando checklist de “Recomendado” hasta que se complete o el usuario lo cierre de forma persistente.

---

## 3. Estados de progreso

### 3.1 Progreso del onboarding inicial

| Estado | Código | Descripción | Qué ve el usuario |
|--------|--------|-------------|-------------------|
| No iniciado | `onboarding_not_started` | Primera vez, no ha pasado por la bienvenida. | Pantalla de bienvenida → flujo 3 pasos. |
| En progreso | `onboarding_in_progress` | Ha empezado pero no ha llegado a “Ir a Ventas”. | Continuar desde el último paso incompleto (ej. si omitió caja, siguiente vez sugerir “Abrir caja” primero). |
| Completado | `onboarding_completed` | Llegó al paso final y eligió “Ir a Ventas” o “Ver mi resumen”. | No volver a mostrar flujo; sí mostrar checklist “Recomendado” si aplica. |
| Omitido | `onboarding_skipped` | Clic en “Entendido, ir al sistema” en bienvenida. | No bloquear; mostrar recordatorio suave en Dashboard: “¿Quieres configurar en 3 pasos?” con enlace a reanudar. |

### 3.2 Checklist de configuración mínima (post-onboarding)

Estado por ítem: **pendiente** | **hecho** | **omitido por ahora**.

| Ítem | Necesario para… | Mensaje corto (no técnico) |
|------|------------------|----------------------------|
| Caja abierta | Registrar ventas y movimientos | “Abre la caja para poder registrar ventas.” |
| Al menos un producto | Vender con producto en catálogo (o permitir “producto libre”) | “Agrega al menos un producto para vender desde el catálogo.” |
| (Opcional) Un cliente | Facturar a nombre de alguien (si aplica) | “Agrega un cliente para facturar con nombre.” |
| (Opcional) Categorías | Ordenar productos | “Crea categorías para organizar tus productos.” |

**Representación en UI:**

- **Panel “Tu progreso” o “Configuración recomendada”** (colapsable) en Dashboard o en una esquina.
- Lista con icono ✓ (hecho), ○ (pendiente), — (omitido). Clic en pendiente → enlace directo a la pantalla (Caja, Productos, Clientes).
- No bloquear ninguna pantalla con este checklist; solo invitar.

### 3.3 Progreso operativo diario (caja)

| Estado | Mensaje sugerido | Dónde mostrarlo |
|--------|------------------|-----------------|
| Sin caja abierta | “Para registrar ventas, abre la caja primero.” | Banner en Dashboard y en Ventas; botón destacado “Abrir caja”. |
| Caja abierta | “Caja abierta. Puedes registrar ventas.” | Indicador discreto (ej. punto verde + “Caja abierta”) en barra o Dashboard. |
| Varias cajas abiertas | “Hay más de una caja abierta. Revisa en Caja y cierra la que no uses.” | Alerta en Dashboard (ver Estados operativos). |
| Caja abierta hace muchas horas | “Llevas varias horas con la caja abierta. ¿Quieres cerrar el día?” | Alerta en Dashboard o en Caja. |

Estos mensajes deben ser **frases cortas**, sin códigos ni jerga.

---

## 4. Mensajes claros y no técnicos

### 4.1 Reglas de redacción

- **Una idea por mensaje.** Evitar: “Debes configurar la sesión de caja y asegurarte de que exista al menos una sesión abierta para poder registrar transacciones.”  
  Preferir: “Abre la caja para poder registrar ventas.”
- **Verbo + objeto.** “Abre la caja”, “Agrega un producto”, “Cierra el día”.
- **Evitar jerga.** No usar: “sesión”, “entidad”, “configuración”, “recurso”, “umbral”. Usar: “caja”, “producto”, “cliente”, “cerrar el día”, “cantidad”.
- **Motivo en una línea.** Después del qué, opcional: “Así podrás registrar ventas” / “Así no se mezclan los turnos”.
- **Errores:** No mostrar stack ni código. Ejemplo: en vez de “Validation failed: stock insufficient”, mostrar “No hay suficiente cantidad de [nombre del producto]. Revisa el inventario o reduce la cantidad.”

### 4.2 Glosario de mensajes sugeridos

| Contexto | Evitar | Usar |
|----------|--------|------|
| Caja cerrada | “No hay sesión de caja abierta.” | “Abre la caja para poder registrar ventas.” |
| Sin productos | “El catálogo está vacío.” | “Agrega al menos un producto para vender.” |
| Stock insuficiente | “Stock insufficient for product X.” | “No hay suficiente cantidad de [producto]. Revisa el inventario.” |
| Cotización vencida | “Quote validUntil has expired.” | “Esta cotización ya venció. Puedes actualizar la fecha o cancelarla.” |
| Guardado correcto | “Entity saved successfully.” | “Listo, quedó guardado.” |
| Error genérico | “An error occurred. Try again.” | “Algo falló. Vuelve a intentarlo; si sigue igual, anota qué estabas haciendo y coméntalo con soporte.” |
| Cierre de caja | “Close session?” | “¿Cerrar el día? Anota el monto que hay en caja.” |
| Onboarding paso 1 | “Configure initial cash session.” | “Abre la caja. Indica con cuánto dinero empiezas (puede ser 0).” |
| Onboarding paso 2 | “Add at least one product to catalog.” | “Agrega tu primer producto: nombre, precio y cantidad.” |
| Onboarding paso 3 | “Onboarding complete.” | “Ya puedes registrar tu primera venta.” |

### 4.3 Tono

- **Cercano y calmado:** “Listo”, “Ya puedes”, “Siguiente paso”.
- **No culpar:** “Aún no has abierto la caja” en vez de “Error: no has configurado la caja.”
- **Opciones claras:** Siempre que se pueda, ofrecer “Hacerlo ahora” y “Después” u “Omitir por ahora”.

---

## 5. Recomendaciones UX para guiar sin abrumar

### 5.1 Pantalla de bienvenida (onboarding)

- **Una sola pantalla.** Título corto + 1–2 frases + botón “Empezar” y opcional “Ir al sistema”.
- **Sin formularios.** Solo mensaje y acción.
- **Ilustración o icono** sencillo (caja, tienda, checklist), no técnico.
- **No pedir datos** en esta pantalla (nombre del negocio, etc. puede ir en “Recomendado” después).

### 5.2 Cada paso del onboarding

- **Un objetivo por pantalla.** Ej.: “Abrir caja” → solo campos de monto inicial y botón “Abrir caja”.
- **Indicador de progreso:** “Paso 1 de 3” (o “Paso 2 de 3”). Barra o puntos, siempre visible.
- **Botón principal único.** Un solo CTA destacado (ej. “Abrir caja”). Secundario: “Omitir por ahora”.
- **Ayuda contextual:** Una línea debajo del título: “Es como abrir la gaveta al inicio del día.”
- **Sin menú lateral** durante el flujo para no perder el foco.

### 5.3 Dashboard después del onboarding

- **Primera sección:** Estado del día: caja abierta/cerrada + acción clara (“Abrir caja” o “Cerrar el día”).
- **Segunda sección:** Resumen útil (ventas del día, alertas importantes) con enlaces a la acción (ver Estados operativos).
- **Panel “Tu progreso” o “Recomendado”:** Colapsable, no por defecto a pantalla completa. Lista corta con enlaces a Caja, Productos, Clientes, etc. Se puede ocultar de forma persistente cuando el usuario lo marque como “Ya no mostrar”.
- **Sin saturar:** Máximo 3–5 bloques principales; el resto en menú o reportes.

### 5.4 Recordatorios (sin abrumar)

- **Una alerta principal a la vez** en lugar de 10 mensajes. Orden por prioridad (ej. sin caja > stock bajo > cotizaciones por vencer).
- **Un solo banner** en la parte superior o un panel de “Acción recomendada” con una acción principal y “Ver todas” para el resto.
- **No modales bloqueantes** para cosas que no son críticas. Preferir banners o cards con “Ahora” / “Después”.
- **Recordatorio de cierre de caja:** Si la caja lleva muchas horas abierta, un aviso suave (“¿Quieres cerrar el día?”) con enlace a Caja, no un pop-up que interrumpa cada pantalla.

### 5.5 Checklist “Recomendado” (configuración mínima)

- **Máximo 5–7 ítems.** Los imprescindibles: caja abierta, al menos un producto. El resto: opcionales (cliente, categorías, etc.).
- **Estado visible:** Hecho (✓), Pendiente (○), Omitir (—“Lo haré después”).
- **Un clic al destino:** Cada ítem pendiente es un enlace a la pantalla correspondiente.
- **Cerrar/ocultar:** “No volver a mostrar” guardado en preferencias o localStorage, para no molestar a quien ya sabe.

### 5.6 Accesibilidad y estrés

- **Botones grandes** en pasos críticos (“Abrir caja”, “Guardar venta”).
- **Contraste suficiente** y texto legible (tamaño y contraste).
- **No depender solo de color** para estado (usar icono + texto: “Caja abierta” con ✓).
- **Confirmaciones solo cuando duele:** Confirmar “Cerrar el día” o “Anular venta”; no confirmar cada “Guardar” en un formulario.
- **Guardar borradores** donde aplique (ej. cotización a medias) para no perder trabajo si cierran por error.

---

## 6. Resumen de entregables

| Entregable | Contenido |
|------------|-----------|
| **Flujo completo de onboarding** | Bienvenida → Paso 1 (Abrir caja) → Paso 2 (Primer producto) → Paso 3 (Listo para vender) → Dashboard; condición “primera vez”; opción de omitir y reanudar. |
| **Estados de progreso** | `onboarding_not_started` / `in_progress` / `completed` / `skipped`; checklist “Recomendado” con estados pendiente/hecho/omitido; estado operativo diario (caja abierta/cerrada). |
| **Mensajes claros y no técnicos** | Reglas de redacción; glosario Evitar/Usar; tono cercano y no culpabilizador; errores sin códigos ni stacks. |
| **Recomendaciones UX** | Un paso a la vez; un CTA principal; indicador de progreso; panel “Tu progreso” colapsable; una alerta principal; recordatorios no bloqueantes; botones grandes y confirmaciones solo cuando duele. |

Con esto el sistema **orienta sin abrumar** y **reduce estrés operativo** para usuarios reales, no técnicos, bajo presión diaria.
