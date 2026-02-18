# Configurar API de OpenAI (resumen del día con IA)

El dashboard puede mostrar un **"Resumen del día"** en lenguaje natural generado con OpenAI (modelo `gpt-4o-mini`). Si no configuras la clave, se usa un resumen automático basado en los indicadores (sin LLM).

## Dónde se usa

- **Endpoint:** `GET /reports/dashboard-summary` (o el bloque "Resumen del día" en la página de inicio del app).
- **Código:** `apps/api/src/reports/reports.service.ts` → `getDashboardSummary()`.

## Pasos

### 1. Obtener la clave de OpenAI

1. Entra en [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Inicia sesión o crea una cuenta.
3. Crea una API key (Create new secret key) y cópiala. Empieza por `sk-...`.

### 2. Configurar en desarrollo (local)

En el **`.env`** de la **raíz del proyecto** añade (sin comillas):

```env
OPENAI_API_KEY=sk-tu-clave-aqui
```

La API carga este `.env` al arrancar; el resumen del día usará la IA cuando el dashboard lo pida.

### 3. Configurar en producción (Render)

1. En [Render](https://dashboard.render.com) → tu servicio **API** (backend).
2. **Environment** → **Environment Variables**.
3. Añade una variable:
   - **Key:** `OPENAI_API_KEY`
   - **Value:** tu clave (ej. `sk-...`).
4. Guarda y redeploya el servicio para que tome la nueva variable.

### 4. Comprobar

- **Local:** `npm run dev`, abre el dashboard (p. ej. http://localhost:3001/app). En el bloque "Resumen del día" debería decir que el resumen es generado por IA (o ver el texto generado).
- **Producción:** entra al dashboard en tu dominio; si la API tiene `OPENAI_API_KEY` en Render, el resumen se generará con OpenAI.

## Seguridad

- No subas la clave al repositorio (el `.env` debe estar en `.gitignore`).
- En Render usa Environment Variables / Secrets, no la pongas en el código.
