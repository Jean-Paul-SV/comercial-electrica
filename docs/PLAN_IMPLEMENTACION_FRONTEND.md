# 🚀 Plan de Implementación Frontend - Paso a Paso

> **Objetivo:** Transformar el frontend básico en una aplicación profesional y moderna  
> **Tiempo estimado:** 5-7 semanas  
> **Prioridad:** Alta

---

## 📋 Fase 1: Setup Base (Día 1-2)

### **Paso 1.1: Instalar Dependencias Base**

```bash
cd apps/web

# Tailwind CSS (requisito para Shadcn/ui)
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Shadcn/ui (sigue las instrucciones interactivas)
npx shadcn@latest init
# Selecciona:
# - TypeScript: Yes
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes

# Componentes esenciales de Shadcn
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add select
npx shadcn@latest add table
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add toast
npx shadcn@latest add badge
npx shadcn@latest add avatar
npx shadcn@latest add separator
npx shadcn@latest add skeleton
npx shadcn@latest add tabs
npx shadcn@latest add form
npx shadcn@latest add alert

# Tablas avanzadas
npm install @tanstack/react-table

# Gráficos
npm install recharts

# Utilidades
npm install clsx tailwind-merge class-variance-authority
npm install date-fns
```

### **Paso 1.2: Configurar Tailwind**

Editar `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/shared/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

Instalar plugin de animaciones:
```bash
npm install -D tailwindcss-animate
```

### **Paso 1.3: Actualizar globals.css**

Reemplazar contenido de `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### **Paso 1.4: Crear Utilidades**

Crear `src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 📋 Fase 2: Componentes Core (Día 3-7)

### **Paso 2.1: Actualizar AppShell con Shadcn/ui**

Reemplazar `AppShell.tsx` con componentes de Shadcn/ui.

### **Paso 2.2: Crear DataTable Reutilizable**

Crear `src/shared/components/tables/DataTable.tsx` con TanStack Table.

### **Paso 2.3: Crear Form Components**

Crear wrappers de formularios con React Hook Form + Shadcn/ui.

### **Paso 2.4: Configurar Toasts**

Agregar `Toaster` de Shadcn/ui al layout.

---

## 📋 Fase 3: Features (Semana 2-4)

### **Semana 2: Dashboard y Productos**
- Dashboard con KPIs y gráficos
- CRUD completo de Productos

### **Semana 3: Clientes, Ventas, Inventario**
- CRUD de Clientes
- Gestión de Ventas
- Gestión de Inventario

### **Semana 4: Caja, Compras, Reportes**
- Gestión de Caja
- Gestión de Compras/Proveedores
- Reportes con gráficos

---

## 📋 Fase 4: Polish (Semana 5)

- Mejorar UX/UI
- Optimizar performance
- Testing básico
- Documentación

---

## ✅ Checklist de Verificación

Después de cada fase, verificar:

- [ ] Componentes renderizan correctamente
- [ ] Dark mode funciona
- [ ] Responsive en móvil/tablet/desktop
- [ ] Formularios validan correctamente
- [ ] Tablas tienen paginación y sorting
- [ ] Notificaciones aparecen correctamente
- [ ] Loading states funcionan
- [ ] Errores se manejan apropiadamente
- [ ] Performance es aceptable

---

**Fase 1 completada (2026-01-29):**
- Tailwind CSS v3 instalado y configurado
- Shadcn-style components: Button, Card, Input, Label
- Toaster (Sonner), lib/utils.ts (cn)
- AppShell actualizado con Tailwind + Lucide
- Login y Dashboard con nuevos componentes
- Páginas placeholder: Products, Customers, Cash, Reports
- Build OK

**Siguiente paso:** Fase 2 - DataTable reutilizable y formularios
