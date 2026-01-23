#!/usr/bin/env node

/**
 * Script de prueba básico para la API
 * Ejecuta: node scripts/test-api.js
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = {
    method,
    headers,
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const data = await res.json().catch(() => ({ text: await res.text() }));
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function main() {
  console.log('🧪 Iniciando pruebas de la API...\n');

  // 1. Bootstrap Admin
  console.log('1️⃣  Creando admin inicial...');
  const bootstrap = await request('POST', '/auth/bootstrap-admin', {
    email: 'test@example.com',
    password: 'Test123!',
  });
  if (!bootstrap.ok && bootstrap.status !== 400) {
    console.log('   ⚠️  Admin ya existe o error:', bootstrap.data);
  } else {
    console.log('   ✅ Admin creado');
  }

  // 2. Login
  console.log('\n2️⃣  Iniciando sesión...');
  const login = await request('POST', '/auth/login', {
    email: 'test@example.com',
    password: 'Test123!',
  });
  if (!login.ok) {
    console.error('   ❌ Error en login:', login.data);
    process.exit(1);
  }
  const token = login.data.accessToken;
  console.log('   ✅ Login exitoso');

  // 3. Crear Categoría
  console.log('\n3️⃣  Creando categoría...');
  const category = await request('POST', '/categories', { name: 'Test Cables' }, token);
  if (!category.ok) {
    console.error('   ❌ Error creando categoría:', category.data);
  } else {
    console.log('   ✅ Categoría creada:', category.data.id);
    const categoryId = category.data.id;

    // 4. Crear Producto
    console.log('\n4️⃣  Creando producto...');
    const product = await request(
      'POST',
      '/products',
      {
        internalCode: 'TEST-001',
        name: 'Producto de Prueba',
        categoryId: categoryId,
        cost: 1000,
        price: 2000,
        taxRate: 19,
      },
      token,
    );
    if (!product.ok) {
      console.error('   ❌ Error creando producto:', product.data);
    } else {
      console.log('   ✅ Producto creado:', product.data.id);
      const productId = product.data.id;

      // 5. Agregar Stock
      console.log('\n5️⃣  Agregando stock...');
      const movement = await request(
        'POST',
        '/inventory/movements',
        {
          type: 'IN',
          reason: 'Prueba',
          items: [{ productId: productId, qty: 50, unitCost: 1000 }],
        },
        token,
      );
      if (!movement.ok) {
        console.error('   ❌ Error agregando stock:', movement.data);
      } else {
        console.log('   ✅ Stock agregado');
      }

      // 6. Crear Cliente
      console.log('\n6️⃣  Creando cliente...');
      const customer = await request(
        'POST',
        '/customers',
        {
          docType: 'CC',
          docNumber: '9999999999',
          name: 'Cliente Prueba',
          email: 'cliente@test.com',
        },
        token,
      );
      if (!customer.ok) {
        console.error('   ❌ Error creando cliente:', customer.data);
      } else {
        console.log('   ✅ Cliente creado:', customer.data.id);
        const customerId = customer.data.id;

        // 7. Abrir Caja
        console.log('\n7️⃣  Abriendo sesión de caja...');
        const cashSession = await request(
          'POST',
          '/cash/sessions',
          { openingAmount: 50000 },
          token,
        );
        if (!cashSession.ok) {
          console.error('   ❌ Error abriendo caja:', cashSession.data);
        } else {
          console.log('   ✅ Caja abierta:', cashSession.data.id);
          const sessionId = cashSession.data.id;

          // 8. Crear Venta
          console.log('\n8️⃣  Creando venta...');
          const sale = await request(
            'POST',
            '/sales',
            {
              customerId: customerId,
              cashSessionId: sessionId,
              paymentMethod: 'CASH',
              items: [{ productId: productId, qty: 2 }],
            },
            token,
          );
          if (!sale.ok) {
            console.error('   ❌ Error creando venta:', sale.data);
          } else {
            console.log('   ✅ Venta creada exitosamente');
            console.log('      - Venta ID:', sale.data.sale.id);
            console.log('      - Factura ID:', sale.data.invoice.id);
            console.log('      - Documento DIAN ID:', sale.data.dianDocument.id);
          }
        }
      }
    }
  }

  // 9. Listar recursos
  console.log('\n9️⃣  Listando recursos...');
  const [products, customers, sales, sessions] = await Promise.all([
    request('GET', '/products', null, token),
    request('GET', '/customers', null, token),
    request('GET', '/sales', null, token),
    request('GET', '/cash/sessions', null, token),
  ]);

  console.log(`   ✅ Productos: ${products.data?.length || 0}`);
  console.log(`   ✅ Clientes: ${customers.data?.length || 0}`);
  console.log(`   ✅ Ventas: ${sales.data?.length || 0}`);
  console.log(`   ✅ Sesiones de caja: ${sessions.data?.length || 0}`);

  console.log('\n✨ Pruebas completadas!\n');
}

main().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
