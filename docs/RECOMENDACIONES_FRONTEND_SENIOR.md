# 🎨 Recomendaciones Frontend - Stack Profesional

> **Autor:** Recomendaciones de Senior Frontend Developer  
> **Fecha:** Enero 2026  
> **Contexto:** Sistema ERP Orion - Backend NestJS completo con Swagger

---

## 📊 Estado Actual

### ✅ Lo que ya tienes (Excelente base)
- **Next.js 15** con App Router ✅
- **React Query (TanStack Query)** para data fetching ✅
- **React Hook Form + Zod** para formularios ✅
- **Autenticación JWT** funcionando ✅
- **TypeScript** configurado ✅
- Estructura de features iniciada ✅

### ⚠️ Lo que falta (Para un frontend profesional)
- Sistema de diseño/componentes UI
- Estilos consistentes y modernos
- Componentes reutilizables
- Tablas avanzadas para datos
- Gráficos y visualizaciones
- Notificaciones/toasts
- Manejo de errores UX
- Loading states profesionales

---

## 🎯 Stack Recomendado (Producción-Ready)

### **1. Librería de Componentes UI: Shadcn/ui + Radix UI** ⭐⭐⭐⭐⭐

**¿Por qué Shadcn/ui?**
- ✅ **No es una dependencia**, copias componentes a tu código (control total)
- ✅ Basado en **Radix UI** (accesibilidad AAA)
- ✅ Estilos con **Tailwind CSS** (moderno, rápido, customizable)
- ✅ **TypeScript first** (tipado completo)
- ✅ Componentes profesionales y modernos
- ✅ Fácil de personalizar para tu marca
- ✅ Compatible con Next.js 15 App Router

**Instalación:**
```bash
cd apps/web
npx shadcn@latest init
```

**Componentes esenciales a agregar:**
```bash
npx shadcn@latest add button card input label select table dialog dropdown-menu toast badge avatar separator skeleton tabs form
```

**Alternativa si prefieres:** Mantine UI (más completo pero más pesado) o Ant Design (muy completo pero estilo más corporativo)

---

### **2. Sistema de Estilos: Tailwind CSS** ⭐⭐⭐⭐⭐

**¿Por qué Tailwind?**
- ✅ **Utility-first** (desarrollo rápido)
- ✅ **Dark mode** nativo (ya tienes dark mode)
- ✅ **Responsive** por defecto
- ✅ **Purge automático** (bundle pequeño)
- ✅ Compatible con Shadcn/ui
- ✅ Customizable con tu paleta de colores

**Configuración recomendada:**
```js
// tailwind.config.js
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        // Tu paleta personalizada
        primary: {
          DEFAULT: '#3b82f6', // Azul profesional
          dark: '#2563eb',
        },
        // ... más colores
      },
    },
  },
}
```

---

### **3. Tablas de Datos: TanStack Table (React Table v8)** ⭐⭐⭐⭐⭐

**¿Por qué TanStack Table?**
- ✅ **Headless** (control total del UI)
- ✅ **Paginación, sorting, filtering** built-in
- ✅ **Virtualización** para grandes datasets
- ✅ **TypeScript** completo
- ✅ Compatible con React Query
- ✅ Excelente performance

**Uso:**
```tsx
import { useReactTable, getCoreRowModel } from '@tanstack/react-table'

// Perfecto para listados de productos, ventas, clientes, etc.
```

**Alternativa:** AG Grid (muy potente pero más pesado, ideal si necesitas Excel-like features)

---

### **4. Gráficos y Visualizaciones: Recharts** ⭐⭐⭐⭐⭐

**¿Por qué Recharts?**
- ✅ **React-first** (componentes declarativos)
- ✅ **Responsive** automático
- ✅ **TypeScript** completo
- ✅ **Ligero** (~200KB)
- ✅ Fácil de personalizar
- ✅ Perfecto para dashboards

**Alternativas:**
- **Chart.js con react-chartjs-2** (más opciones, más pesado)
- **Victory** (muy customizable, más complejo)

---

### **5. Notificaciones/Toasts: Sonner (Shadcn)** ⭐⭐⭐⭐⭐

**¿Por qué Sonner?**
- ✅ Integrado con Shadcn/ui
- ✅ **Ligero** y rápido
- ✅ **Accesible**
- ✅ Animaciones suaves
- ✅ Stack de notificaciones

**Alternativa:** React Hot Toast (similar, también excelente)

---

### **6. Iconos: Lucide React** ⭐⭐⭐⭐⭐

**¿Por qué Lucide?**
- ✅ **Consistente** y moderno
- ✅ **Ligero** (tree-shakeable)
- ✅ **TypeScript** completo
- ✅ Compatible con Shadcn/ui
- ✅ Gran variedad de iconos

**Alternativa:** Heroicons (similar calidad)

---

### **7. Manejo de Formularios: React Hook Form + Zod (Ya lo tienes)** ✅

**Mantener:** Ya está perfecto. Solo agregar:
- Componentes de formulario con Shadcn/ui
- Validación visual mejorada
- Mensajes de error consistentes

---

### **8. Manejo de Estado: Zustand (Opcional)** ⭐⭐⭐⭐

**¿Cuándo usar?**
- Estado global simple (preferencias UI, modales, etc.)
- **NO** para data del servidor (usa React Query)

**Alternativa:** Context API (ya lo usas para Auth, está bien)

---

### **9. Fechas: date-fns** ⭐⭐⭐⭐⭐

**¿Por qué date-fns?**
- ✅ **Modular** (importa solo lo que usas)
- ✅ **Inmutable** (no muta fechas)
- ✅ **TypeScript** completo
- ✅ **Ligero**
- ✅ Formato en español fácil

---

### **10. Números/Monedas: Intl.NumberFormat (Nativo)** ⭐⭐⭐⭐⭐

**Usar nativo de JavaScript:**
```tsx
const formatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
});
```

**O helper library:** `react-currency-input-field` para inputs de moneda

---

## 📦 Instalación Completa Recomendada

```bash
cd apps/web

# Core UI
npx shadcn@latest init
npx shadcn@latest add button card input label select table dialog dropdown-menu toast badge avatar separator skeleton tabs form alert

# Tablas avanzadas
npm install @tanstack/react-table

# Gráficos
npm install recharts

# Iconos (ya viene con shadcn, pero por si acaso)
npm install lucide-react

# Fechas
npm install date-fns

# Utilidades adicionales
npm install clsx tailwind-merge class-variance-authority
npm install @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu
```

---

## 🏗️ Estructura de Carpetas Recomendada

```
apps/web/src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Rutas públicas
│   │   └── login/
│   ├── (protected)/             # Rutas protegidas
│   │   ├── layout.tsx            # Layout con AppShell
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── customers/
│   │   ├── sales/
│   │   ├── purchases/
│   │   ├── inventory/
│   │   ├── cash/
│   │   ├── suppliers/
│   │   └── reports/
│   └── layout.tsx
│
├── features/                     # Features por dominio
│   ├── auth/
│   │   ├── api.ts
│   │   ├── hooks.ts
│   │   ├── types.ts
│   │   └── components/
│   │       └── LoginForm.tsx
│   ├── products/
│   │   ├── api.ts
│   │   ├── hooks.ts
│   │   ├── types.ts
│   │   └── components/
│   │       ├── ProductList.tsx
│   │       ├── ProductForm.tsx
│   │       └── ProductTable.tsx
│   ├── sales/
│   ├── purchases/
│   └── ...
│
├── shared/                       # Código compartido
│   ├── components/              # Componentes reutilizables
│   │   ├── ui/                  # Componentes Shadcn/ui
│   │   ├── forms/               # Wrappers de formularios
│   │   ├── tables/              # Tablas reutilizables
│   │   └── charts/              # Gráficos reutilizables
│   ├── hooks/                   # Hooks compartidos
│   │   ├── usePagination.ts
│   │   ├── useDebounce.ts
│   │   └── useLocalStorage.ts
│   ├── utils/                   # Utilidades
│   │   ├── cn.ts                # clsx + tailwind-merge
│   │   ├── format.ts           # Formateo de fechas/monedas
│   │   └── validation.ts       # Validaciones compartidas
│   └── providers/              # Providers de React
│       ├── AuthProvider.tsx
│       ├── QueryClientProvider.tsx
│       └── ToastProvider.tsx
│
├── infrastructure/              # Configuración técnica
│   ├── api/
│   │   ├── client.ts
│   │   └── endpoints.ts        # Endpoints tipados
│   └── config/
│       └── env.ts              # Variables de entorno tipadas
│
└── lib/                         # Librerías/configuraciones
    ├── utils.ts                # Utilidades generales
    └── constants.ts            # Constantes
```

---

## 🎨 Sistema de Diseño Recomendado

### **Paleta de Colores (Dark Mode First)**

```ts
// tailwind.config.js o constants.ts
export const colors = {
  // Primario (Azul profesional)
  primary: {
    50: '#eff6ff',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },
  
  // Secundario (Verde para éxito)
  success: {
    500: '#10b981',
    600: '#059669',
  },
  
  // Error (Rojo)
  error: {
    500: '#ef4444',
    600: '#dc2626',
  },
  
  // Warning (Amarillo)
  warning: {
    500: '#f59e0b',
    600: '#d97706',
  },
  
  // Neutral (Grises para UI)
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    800: '#1f2937',
    900: '#111827',
    950: '#030712', // Tu fondo actual
  },
}
```

### **Tipografía**

```ts
// Usar sistema de fuentes de Next.js
// Inter o Geist (viene con Next.js 15)
```

### **Espaciado**

```ts
// Usar escala de Tailwind (4px base)
// 1 = 4px, 2 = 8px, 4 = 16px, etc.
```

---

## 🧩 Componentes Clave a Implementar

### **1. DataTable (Tabla Reutilizable)**

```tsx
// shared/components/tables/DataTable.tsx
// Con paginación, sorting, filtering
// Usando TanStack Table + Shadcn/ui Table
```

**Features:**
- Paginación del servidor
- Sorting por columnas
- Filtros por columna
- Selección de filas (opcional)
- Acciones por fila
- Loading states
- Empty states

---

### **2. Dashboard Cards**

```tsx
// Componentes de tarjetas para KPIs
// Con iconos, valores, tendencias
```

---

### **3. Form Components**

```tsx
// Wrappers de Shadcn/ui Form components
// Con React Hook Form + Zod
// Mensajes de error consistentes
```

---

### **4. Modal/Dialog Wrapper**

```tsx
// Para crear/editar entidades
// Con formularios integrados
```

---

### **5. Loading Skeletons**

```tsx
// Para mejorar UX durante carga
// Usando Shadcn/ui Skeleton
```

---

## 📱 Responsive Design

### **Breakpoints (Tailwind default)**
- `sm`: 640px (móvil grande)
- `md`: 768px (tablet)
- `lg`: 1024px (desktop)
- `xl`: 1280px (desktop grande)

### **Estrategia**
- **Mobile-first**: Diseñar primero para móvil
- **Sidebar colapsable** en móvil
- **Tablas scrollables** en móvil
- **Modales full-screen** en móvil

---

## ⚡ Performance

### **Optimizaciones Recomendadas**

1. **Code Splitting**
   - Next.js lo hace automático con App Router ✅

2. **Image Optimization**
   - Usar `next/image` para imágenes

3. **Lazy Loading**
   - Cargar componentes pesados con `dynamic()`

4. **React Query**
   - Ya lo tienes ✅
   - Configurar `staleTime` y `cacheTime` apropiados

5. **Bundle Size**
   - Usar `next/bundle-analyzer` para monitorear

---

## 🧪 Testing (Opcional pero Recomendado)

### **Stack de Testing**

```bash
npm install -D @testing-library/react @testing-library/jest-dom vitest
```

**Estrategia:**
- **Unit tests**: Componentes individuales
- **Integration tests**: Features completas
- **E2E tests**: Playwright (más adelante)

---

## 🚀 Plan de Implementación

### **Fase 1: Setup Base (1-2 días)**
1. ✅ Instalar Shadcn/ui
2. ✅ Configurar Tailwind CSS
3. ✅ Agregar componentes básicos (Button, Card, Input, etc.)
4. ✅ Configurar tema dark mode
5. ✅ Crear estructura de carpetas

### **Fase 2: Componentes Core (3-5 días)**
1. ✅ DataTable reutilizable
2. ✅ Form components wrapper
3. ✅ Modal/Dialog wrapper
4. ✅ Toast/Notifications
5. ✅ Loading states y Skeletons

### **Fase 3: Features Principales (2-3 semanas)**
1. ✅ Dashboard con KPIs y gráficos
2. ✅ CRUD de Productos (listado, crear, editar)
3. ✅ CRUD de Clientes
4. ✅ Gestión de Ventas
5. ✅ Gestión de Inventario
6. ✅ Gestión de Caja
7. ✅ Gestión de Compras/Proveedores
8. ✅ Reportes con gráficos

### **Fase 4: Polish (1 semana)**
1. ✅ Mejorar UX/UI
2. ✅ Agregar animaciones sutiles
3. ✅ Optimizar performance
4. ✅ Testing básico
5. ✅ Documentación de componentes

---

## 📚 Recursos y Documentación

### **Shadcn/ui**
- Docs: https://ui.shadcn.com
- Ejemplos: https://ui.shadcn.com/examples

### **TanStack Table**
- Docs: https://tanstack.com/table/latest

### **Recharts**
- Docs: https://recharts.org

### **Tailwind CSS**
- Docs: https://tailwindcss.com
- Playground: https://play.tailwindcss.com

---

## 🎯 Resumen Ejecutivo

### **Stack Final Recomendado:**

| Categoría | Tecnología | Prioridad |
|-----------|-----------|-----------|
| **UI Components** | Shadcn/ui + Radix UI | 🔴 Crítico |
| **Estilos** | Tailwind CSS | 🔴 Crítico |
| **Tablas** | TanStack Table | 🔴 Crítico |
| **Gráficos** | Recharts | 🟡 Alto |
| **Notificaciones** | Sonner | 🟡 Alto |
| **Iconos** | Lucide React | 🟡 Alto |
| **Fechas** | date-fns | 🟢 Medio |
| **Estado Global** | Zustand (opcional) | 🟢 Medio |

### **Tiempo Estimado Total:**
- **Setup inicial:** 1-2 días
- **Desarrollo completo:** 4-6 semanas
- **Total:** ~5-7 semanas para frontend completo y profesional

---

## ✅ Checklist de Implementación

- [ ] Instalar Shadcn/ui
- [ ] Configurar Tailwind CSS
- [ ] Crear estructura de carpetas
- [ ] Implementar DataTable reutilizable
- [ ] Implementar componentes de formulario
- [ ] Configurar tema dark mode
- [ ] Agregar notificaciones/toasts
- [ ] Implementar Dashboard
- [ ] CRUD de Productos
- [ ] CRUD de Clientes
- [ ] Gestión de Ventas
- [ ] Gestión de Inventario
- [ ] Gestión de Caja
- [ ] Gestión de Compras/Proveedores
- [ ] Reportes con gráficos
- [ ] Optimizar performance
- [ ] Testing básico

---

**Última actualización:** Enero 2026
