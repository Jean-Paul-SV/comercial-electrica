# Indicadores que impulsan decisiones

**Autor:** Product Manager técnico – Data e IA  
**Objetivo:** **Transformar datos en acciones claras**: el sistema debe decir **“qué hacer”**, no solo “qué pasó”.  
**Contexto:** No solo gráficas; indicadores que ayuden a tomar decisiones (productos con pérdida, proveedores menos competitivos, patrones de venta por empleado, etc.).

---

## 1. Qué indicadores realmente importan

Un indicador importa cuando **responde una pregunta de negocio** y **sugiere una acción concreta**. Se priorizan los que afectan margen, flujo de caja, riesgo y eficiencia operativa.

### 1.1 Catálogo de indicadores accionables

| Indicador | Pregunta de negocio | Acción sugerida | Prioridad |
|-----------|---------------------|-----------------|-----------|
| **Productos con pérdida** | ¿Qué productos vendemos por debajo del costo? | Revisar precio o costo; dejar de vender o reponer costo. | Alta |
| **Margen erosionado** | ¿Qué productos tienen margen muy bajo (ej. &lt; 10 %)? | Subir precio o negociar costo con proveedor. | Alta |
| **Proveedores menos competitivos** | ¿Qué proveedores son más caros o entregan peor para el mismo tipo de producto? | Renegociar o cambiar proveedor. | Alta |
| **Patrones de venta por empleado** | ¿Quién vende más, quién tiene más devoluciones o descuentos? | Reconocer, capacitar o revisar procesos. | Media |
| **Productos sin rotación** | ¿Qué productos llevan X días sin venderse? | Promocionar, bajar precio o descontinuar. | Alta |
| **Stock muerto** | ¿Qué productos tienen stock alto y poca o ninguna venta reciente? | Liquidar o devolver a proveedor. | Alta |
| **Clientes que compran menos** | ¿Qué clientes antes compraban y dejaron de hacerlo? | Reactivar (oferta, contacto). | Media |
| **Concentración de ventas** | ¿Demasiado dependientes de pocos clientes o productos? | Diversificar oferta y clientes. | Media |
| **Riesgo de caja** | ¿Gastos y compromisos superan lo cobrado en el periodo? | Ajustar cobros o gastos. | Alta |
| **Facturas proveedor vencidas** | ¿Qué facturas están vencidas o por vencer? | Pagar o renegociar. | Alta |
| **Descuentos anómalos** | ¿Hay ventas con descuentos muy altos respecto al promedio? | Revisar política de descuentos. | Media |
| **Devoluciones por producto o empleado** | ¿Qué productos o quién genera más devoluciones? | Revisar calidad, proceso o capacitación. | Media |

Cada uno debe exponerse con: **insight** (qué pasó), **suggestedAction** (qué hacer), **actionHref** (dónde hacerlo) y opcionalmente **severity** (impacto).

---

## 2. Cómo calcularlos

### 2.1 Productos que generan pérdida

- **Definición:** Productos vendidos (en ventas PAID) donde el **precio de venta por unidad** (en la línea) es **menor que el costo** del producto (Product.cost o costo promedio si usas costos variables).
- **Cálculo:**  
  - Por cada SaleItem de ventas PAID: `unitPrice` vs `product.cost`.  
  - Si `unitPrice < product.cost` → pérdida por línea = (cost - unitPrice) × qty.  
  - Agrupar por producto: total unidades vendidas con pérdida, monto total de pérdida.
- **Datos:** Sale (status PAID), SaleItem (unitPrice, qty, productId), Product (cost).
- **Período:** Últimos 30/60/90 días (configurable).
- **Salida accionable:** Lista de productos con pérdida (nombre, unidades, monto pérdida). Acción: “Revisar precio o costo” → enlace a editar producto o a reporte de compras por producto.

### 2.2 Margen erosionado (margen muy bajo)

- **Definición:** Productos cuyo **margen unitario** (precio - costo) / precio es menor que un umbral (ej. 10 %).
- **Cálculo:** Por producto: promediar margen en ventas recientes (SaleItem.unitPrice - Product.cost) / unitPrice; o usar Product.price y Product.cost directamente. Marcar los que margen &lt; X %.
- **Datos:** Product (cost, price); opcional SaleItem para margen real vendido.
- **Acción:** “Subir precio o negociar costo” → /products o reporte de compras por producto.

### 2.3 Proveedores menos competitivos

- **Definición:** Para productos o categorías comparables, qué proveedores tienen **precio de compra mayor** o **peor desempeño** (entregas tarde, facturas vencidas).
- **Cálculo:**  
  - **Precio:** Por producto comprado a varios proveedores: promedio de unitCost por proveedor (PurchaseOrderItem.unitCost, agrupado por supplierId y productId). El proveedor con mayor costo medio para el mismo producto = “menos competitivo en precio”.  
  - **Desempeño:** % de órdenes recibidas tarde, % de facturas vencidas por proveedor.
- **Datos:** PurchaseOrder (supplierId, expectedDate, receivedDate), PurchaseOrderItem (productId, unitCost), SupplierInvoice (dueDate, status).
- **Salida:** Lista de proveedores con “precio por encima del promedio” o “X % facturas vencidas”. Acción: “Renegociar o cambiar proveedor” → /suppliers, /purchases.

### 2.4 Patrones de venta por empleado

- **Definición:** Por usuario que registra ventas: volumen vendido, ticket medio, descuentos aplicados, devoluciones asociadas.
- **Cálculo:**  
  - **Quién registró la venta:** Hoy Sale no tiene `createdBy`; hay que usar **AuditLog** (entity = 'sale', action = 'create', actorId) para asociar cada venta a un usuario, o **añadir campo `soldBy` (userId) a Sale** (recomendado para consultas simples).  
  - Por actorId: suma grandTotal, cuenta ventas, promedio ticket; suma descuentos (subtotal - (grandTotal - tax)); devoluciones (SaleReturn vinculadas a ventas de ese usuario si hay forma de asociar).  
- **Métricas por empleado:** Ventas totales, número de ventas, ticket medio, descuento medio por venta, cantidad/costo de devoluciones.
- **Acción:** “Revisar desempeño o políticas” → reporte por empleado o auditoría. No exponer como “ranking público” sin política de privacidad; uso interno para gerencia.

### 2.5 Productos sin rotación

- **Definición:** Productos activos que **no aparecen en ninguna SaleItem** de ventas PAID en los últimos N días (ej. 30, 60, 90).
- **Cálculo:** Productos activos cuyo id no está en SaleItem.saleId IN (Sale.id WHERE status PAID AND soldAt >= now - N days). Ya contemplado en doc Estados operativos.
- **Acción:** “Promocionar, bajar precio o descontinuar” → /products (filtro “sin rotación”) o reporte.

### 2.6 Stock muerto

- **Definición:** Productos con **stock alto** (ej. por encima de la mediana o del percentil 75) y **poca o ninguna venta** en el último periodo.
- **Cálculo:** Combinar StockBalance.qtyOnHand con cantidad vendida (SaleItem) en últimos 60/90 días. Ratio stock / ventas mensuales; si stock &gt; X meses de ventas (ej. 6) y ventas &gt; 0, o stock alto y 0 ventas → “stock muerto”.
- **Acción:** “Liquidar o devolver” → /inventory, /products.

### 2.7 Clientes que compran menos (reactivación)

- **Definición:** Clientes que compraron antes y en el último periodo (ej. 60 días) no tienen ventas o compran mucho menos.
- **Cálculo:** Por cliente: última fecha de venta (max(soldAt)), total vendido en últimos 90 vs 90 anteriores. Si último compra &gt; 30 días y antes compraba → candidato a reactivación.
- **Datos:** Sale (customerId, soldAt, grandTotal).
- **Acción:** “Reactivar con oferta o contacto” → /customers (lista “inactivos”) o export para campaña.

### 2.8 Concentración de ventas

- **Definición:** % de ventas totales que representan el top 5 clientes o el top 5 productos. Si &gt; X % (ej. 80 %) → alto riesgo de concentración.
- **Cálculo:** Suma grandTotal por customerId (o por productId vía SaleItem); ordenar descendente; suma acumulada / total ventas del periodo.
- **Acción:** “Diversificar clientes o productos” → reporte de concentración.

### 2.9 Riesgo de caja

- **Definición:** En un periodo, **egresos (gastos + pagos a proveedores)** superan **ingresos (ventas cobradas)**.
- **Cálculo:** Ingresos = ventas PAID del periodo (o CashMovement IN del periodo); Egresos = Expense + SupplierPayment del periodo. Si egresos &gt; ingresos → riesgo.
- **Acción:** “Ajustar cobros o gastos” → /cash, /expenses, /supplier-invoices.

### 2.10 Facturas proveedor vencidas / por vencer

- **Definición:** SupplierInvoice con status PENDING y dueDate &lt; hoy (vencidas) o dueDate en los próximos N días (por vencer).
- **Cálculo:** Ya tienes lógica similar en reportes/estados operativos. Listar con monto pendiente (grandTotal - paidAmount).
- **Acción:** “Pagar o renegociar” → /supplier-invoices.

### 2.11 Descuentos anómalos

- **Definición:** Ventas donde el **descuento** (en valor o en %) está muy por encima del promedio del negocio.
- **Cálculo:** Por venta: discountTotal o (subtotal + tax - grandTotal); promedio y desviación estándar del periodo. Marcar ventas con descuento &gt; promedio + 2× desviación (o &gt; percentil 95).
- **Acción:** “Revisar política de descuentos” → detalle de venta o reporte de ventas.

### 2.12 Devoluciones por producto o empleado

- **Definición:** Productos o usuarios con **mayor cantidad o monto de devoluciones** respecto al total vendido.
- **Cálculo:** SaleReturn + SaleReturnItem: por productId suma qty/costo; por “quién registró la venta original” (vía AuditLog o soldBy) suma devoluciones. Ratio devoluciones / ventas por producto o por empleado.
- **Acción:** “Revisar calidad o proceso” → /returns, reporte por producto o por empleado.

---

## 3. Cómo mostrarlos sin abrumar

### 3.1 Principios

- **Una acción principal por bloque:** Cada tarjeta o sección tiene un solo mensaje tipo “Qué hacer” y un solo CTA (ej. “Revisar 3 productos con pérdida” → /reports/products-loss).
- **Prioridad y severidad:** Mostrar primero lo que más impacta (pérdida, riesgo de caja, facturas vencidas). Severidad: crítica / alta / media / baja; condicionar color e intensidad.
- **Top N, no listas enormes:** Máximo 5–10 ítems por indicador en la vista principal; “Ver todos” lleva al reporte completo.
- **Progressive disclosure:** Dashboard con resumen (número + acción); al hacer clic, detalle o reporte con filtros.
- **Evitar jerga:** “3 productos se venden por debajo del costo” en vez de “Margen negativo en 3 SKU”.

### 3.2 Estructura de cada indicador en UI/API

Cada indicador se expone como objeto con:

- **id / code:** Identificador (ej. `products_loss`, `suppliers_less_competitive`).
- **title:** Título corto (“Productos con pérdida”).
- **insight:** Frase que describe qué pasó (“3 productos se vendieron por debajo del costo en los últimos 30 días”).
- **metric:** Valor principal (ej. 3 productos, $ 150.000 pérdida).
- **severity:** critical | high | medium | low | info.
- **suggestedAction:** Qué hacer (“Revisar precio o costo de estos productos”).
- **actionLabel:** Texto del botón (“Ver productos”, “Revisar precios”).
- **actionHref:** Ruta o query del reporte (/reports/products-loss, /products?filter=loss).
- **items:** Lista corta (top 5) con nombre, valor relevante; opcional entityId para enlace directo.

Así el sistema **dice qué hacer** y **lleva a dónde hacerlo**.

### 3.3 Vista recomendada: “Acciones recomendadas”

- **Sección principal del dashboard:** “Acciones recomendadas” (o “Qué hacer hoy”) con lista de indicadores **con incidencia** (productos con pérdida &gt; 0, facturas vencidas &gt; 0, etc.), ordenados por severidad y prioridad.
- **Máximo 5–7 ítems** en la vista principal; el resto en “Más indicadores” o en reportes por categoría (Rentabilidad, Proveedores, Ventas por persona, Caja).
- **Si no hay incidencias:** Mensaje positivo (“No hay productos con pérdida este periodo” o “Al día con facturas de proveedores”) y opcional enlace a reportes.

### 3.4 Reportes por categoría

- **Rentabilidad:** Productos con pérdida, margen erosionado, descuentos anómalos.  
- **Proveedores:** Menos competitivos, facturas vencidas/por vencer.  
- **Ventas y equipos:** Patrones por empleado, concentración, clientes inactivos.  
- **Inventario:** Sin rotación, stock muerto, stock bajo (ya existente).  
- **Caja:** Riesgo de caja, gastos vs ingresos.

Cada reporte puede incluir la misma estructura (insight, suggestedAction, actionHref) por fila o por sección.

---

## 4. Dónde tiene sentido aplicar IA

La IA se usa donde **automatizar el juicio** o **detectar patrones** que un humano no revisaría uno a uno mejora la decisión, sin reemplazar el criterio final del usuario.

### 4.1 Áreas de aplicación

| Área | Uso de IA | Descripción | Prioridad |
|------|-----------|-------------|-----------|
| **Detección de anomalías** | Ventas o márgenes que se desvían mucho del patrón reciente (por día, por producto, por empleado). | Alertar “Ventas hoy muy por debajo de lo habitual” o “Margen de producto X cayó”. | Alta |
| **Pronóstico de demanda** | Predecir ventas o consumo por producto en los próximos 7/30 días (series temporales). | Base para “sugerir pedido a proveedor” o “riesgo de quiebre de stock”. | Alta |
| **Recomendación de reorden** | “Productos que probablemente necesiten reposición pronto” según ventas recientes y lead time. | Lista priorizada para compras. | Media |
| **Clustering de clientes** | Segmentar clientes por frecuencia, ticket medio, antigüedad. | Personalizar ofertas o mensajes de reactivación. | Media |
| **Resumen en lenguaje natural** | Una o dos frases que resuman el dashboard o el reporte (“Ventas subieron 10 %; 3 productos con pérdida; 2 facturas vencidas”). | Reducir carga cognitiva; útil en móvil o email. | Media |
| **Precio sugerido** | Para productos con margen bajo o pérdida: sugerir precio mínimo dado el costo y un margen objetivo. | Apoyo a decisión; el usuario sigue fijando el precio. | Baja |
| **Proveedores** | Comparar “competitividad” combinando precio, plazo de pago y cumplimiento (entregas a tiempo, facturas al día). | Ranking o score por proveedor. | Media |

### 4.2 Qué no sustituir con IA

- **Decisiones finales:** Qué producto descontinuar, qué proveedor cambiar, qué precio poner: la IA sugiere; el usuario decide.  
- **Transparencia:** Los indicadores y las acciones sugeridas deben ser explicables (qué dato, qué regla). Evitar cajas negras que solo digan “recomendamos X”.  
- **Datos mínimos:** Con poco historial (pocas ventas, pocos meses), modelos de pronóstico o clustering son poco fiables; mejor reglas simples (umbrales, promedios) hasta tener suficiente data.

### 4.3 Implementación pragmática

- **Fase 1 (sin ML):** Indicadores con reglas fijas (umbrales, promedios, top N). Ya cubre productos con pérdida, proveedores menos competitivos (por precio promedio), sin rotación, facturas vencidas, riesgo de caja, etc.  
- **Fase 2 (anomalías simples):** Desviación respecto a la media o al percentil (ventas del día vs media de últimos 7 días; margen de producto vs media). Sin modelo entrenado; solo estadística descriptiva. **Implementado:** `SALES_ANOMALY_TODAY` (ventas hoy &lt; 50 % media 7 días); `MARGIN_BELOW_AVERAGE` (margen producto &lt; 50 % de la media del catálogo).  
- **Fase 3 (IA):** **Implementado:** (1) **Precio sugerido:** en indicadores PRODUCTS_LOSS y PRODUCTS_LOW_MARGIN cada ítem incluye `suggestedPrice` (precio mínimo para margen objetivo 15 %). (2) **Resumen en lenguaje natural:** GET /reports/dashboard-summary — si OPENAI_API_KEY está configurado usa gpt-4o-mini; si no, fallback. (3) **Recomendación de reorden:** indicador `REORDER_SUGGESTION` — productos con menos de 7 días de stock según ventas de los últimos 30 días (regla simple, sin ML). (4) **Pronóstico de demanda:** indicador `DEMAND_FORECAST` — ventas esperadas próximos 7 y 30 días (media diaria × días). (5) **Segmentación de clientes:** indicador `CUSTOMER_SEGMENTS` — premium (top 20 % por monto), regulares, inactivos (>60 días sin compra). (6) **Score de proveedores:** indicador `SUPPLIER_SCORE` — score 1–5 por precio vs promedio, % entregas a tiempo y facturas vencidas. (7) **Pronóstico de demanda:** media ponderada (más peso a días recientes) para ventas esperadas 7 y 30 días. (8) **Clustering K-means:** GET /reports/customer-clusters (days, k) — segmenta clientes por monto total, días desde última compra y cantidad de compras; pestaña "Clusters (K-means)" en Reportes. Futuro: pronóstico con ARIMA/Prophet.

---

## 5. Resumen: de datos a acciones

| Entregable | Contenido |
|------------|-----------|
| **Indicadores que importan** | Catálogo con pregunta de negocio, acción sugerida y prioridad: productos con pérdida, margen erosionado, proveedores menos competitivos, patrones por empleado, sin rotación, stock muerto, clientes inactivos, concentración, riesgo de caja, facturas vencidas, descuentos anómalos, devoluciones. |
| **Cómo calcularlos** | Fórmulas y fuentes de datos (Sale, SaleItem, Product.cost/price, PurchaseOrderItem, AuditLog/soldBy, StockBalance, Expense, SupplierPayment); período configurable; salida con insight + suggestedAction + actionHref. |
| **Cómo mostrarlos** | Una acción por bloque; prioridad y severidad; top N; progressive disclosure; sección “Acciones recomendadas” en dashboard; reportes por categoría (Rentabilidad, Proveedores, Ventas, Inventario, Caja). |
| **Dónde aplicar IA** | Anomalías, pronóstico de demanda, reorden sugerido, clustering de clientes, resumen en lenguaje natural, precio sugerido, score de proveedores; fases 1–3 (reglas → estadística → modelos). |

Con esto el sistema **transforma datos en acciones claras**: indicadores que dicen “qué hacer” y llevan a la pantalla o reporte correcto, sin abrumar, y con un camino claro para incorporar IA donde aporte valor.
