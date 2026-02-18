#!/usr/bin/env node

/**
 * Script de verificación de correcciones de seguridad (pruebas manuales automatizadas).
 * Requiere: API corriendo (npm run start o dev en apps/api) y credenciales válidas.
 *
 * Comprueba:
 *   1. Login con email/password.
 *   2. Que el JWT no incluya el campo "email" en el payload.
 *   3. Que las respuestas de error (ej. venta con cliente inexistente) no expongan UUIDs en el mensaje.
 *
 * Uso (desde la raíz del proyecto):
 *   node scripts/verificar-seguridad-api.js
 *
 * Con API en otro host/puerto o usuario distinto:
 *   API_URL=http://localhost:3000 API_EMAIL=admin@negocio.local API_PASSWORD=AdminNegocio1! node scripts/verificar-seguridad-api.js
 *
 * Usuarios por defecto del seed (prisma:seed):
 *   - Admin tenant:  API_EMAIL=admin@negocio.local  API_PASSWORD=AdminNegocio1!
 *   - Panel proveedor: API_EMAIL=platform@proveedor.local API_PASSWORD=PlatformProveedor1!
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const EMAIL = process.env.API_EMAIL || 'admin@negocio.local';
const PASSWORD = process.env.API_PASSWORD || 'AdminNegocio1!';

const UUID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
}

function getMessage(body) {
  if (!body) return '';
  const m = body.message;
  return Array.isArray(m) ? m.join(' ') : typeof m === 'string' ? m : '';
}

async function main() {
  console.log('🔒 Verificación de seguridad – API en', BASE_URL, '\n');

  let passed = 0;
  let failed = 0;

  // 1. Login
  console.log('1. Login...');
  const login = await request('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  if (!login.ok) {
    console.log('   ❌ Login falló:', login.data?.message || login.error);
    console.log('   Asegúrate de que la API está corriendo y de tener un usuario (ej. admin@negocio.local tras npm run prisma:seed -w api).');
    process.exit(1);
  }
  const token = login.data.accessToken;
  console.log('   ✅ Login OK\n');

  // 2. JWT sin email en el payload
  console.log('2. JWT sin campo "email" en el payload...');
  const payload = decodeJwtPayload(token);
  if (!payload) {
    console.log('   ❌ No se pudo decodificar el JWT');
    failed++;
  } else if (payload.hasOwnProperty('email')) {
    console.log('   ❌ El payload contiene "email":', payload.email);
    failed++;
  } else {
    console.log('   ✅ Payload sin email (sub, role, tenantId, etc. OK)');
    passed++;
  }

  // 3. Errores sin IDs internos (venta con cliente/sesión inexistentes)
  console.log('\n3. Respuesta de error sin UUIDs (cliente/sesión inexistentes)...');
  const fakeUuid1 = '00000000-0000-0000-0000-000000000001';
  const fakeUuid2 = '00000000-0000-0000-0000-000000000002';
  const fakeUuid3 = '00000000-0000-0000-0000-000000000003';
  const saleRes = await request(
    'POST',
    '/sales',
    {
      customerId: fakeUuid1,
      cashSessionId: fakeUuid2,
      paymentMethod: 'CASH',
      items: [{ productId: fakeUuid3, qty: 1 }],
    },
    token,
  );
  const message = getMessage(saleRes.data);
  const hasUuidInMessage = UUID_REGEX.test(message);
  if (saleRes.ok) {
    console.log('   ❌ Se esperaba error 4xx (cliente/sesión/producto inexistentes)');
    failed++;
  } else if (hasUuidInMessage) {
    console.log('   ❌ El mensaje de error contiene un UUID:', message);
    failed++;
  } else {
    console.log('   ✅ Error devuelto sin UUID en el mensaje:', message.slice(0, 60) + (message.length > 60 ? '...' : ''));
    passed++;
  }

  // Resumen
  console.log('\n' + '─'.repeat(50));
  console.log(`Resultado: ${passed} comprobaciones OK, ${failed} fallidas`);
  if (failed > 0) process.exit(1);
  console.log('✨ Verificación de seguridad completada.\n');
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
