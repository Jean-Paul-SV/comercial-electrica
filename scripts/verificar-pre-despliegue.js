#!/usr/bin/env node

/**
 * Script de verificación pre-despliegue
 * Verifica que todo está listo antes de desplegar a producción
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '../apps/api');
let errors = [];
let warnings = [];

console.log('🔍 Verificación Pre-Despliegue\n');
console.log('='.repeat(50));

// 1. Verificar que estamos en el directorio correcto
if (!fs.existsSync(API_DIR)) {
  console.error('❌ Error: No se encuentra apps/api');
  process.exit(1);
}

// 2. Verificar variables de entorno críticas
console.log('\n📋 1. Verificando variables de entorno...');
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

const envFile = path.join(__dirname, '../.env');
let envVars = {};

if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) {
      envVars[match[1]] = match[2];
    }
  });
}

// También leer de process.env (para CI/CD)
requiredEnvVars.forEach((varName) => {
  const value = process.env[varName] || envVars[varName];
  if (!value || value.trim() === '') {
    errors.push(`❌ ${varName} no está configurada`);
  } else {
    console.log(`   ✅ ${varName} configurada`);
  }
});

// 3. Verificar que el build funciona
console.log('\n🔨 2. Verificando build...');
try {
  process.chdir(API_DIR);
  console.log('   Compilando TypeScript...');
  execSync('npm run build', { stdio: 'inherit', timeout: 120000 });
  console.log('   ✅ Build exitoso');
} catch (error) {
  errors.push('❌ Build falló');
  console.error('   ❌ Build falló:', error.message);
}

// 4. Verificar migraciones
console.log('\n🗄️  3. Verificando migraciones...');
try {
  const migrationsDir = path.join(API_DIR, 'prisma/migrations');
  if (!fs.existsSync(migrationsDir)) {
    warnings.push('⚠️  Directorio de migraciones no encontrado');
  } else {
    const migrations = fs.readdirSync(migrationsDir).filter((f) =>
      fs.statSync(path.join(migrationsDir, f)).isDirectory(),
    );
    console.log(`   ✅ ${migrations.length} migraciones encontradas`);
  }
} catch (error) {
  warnings.push('⚠️  No se pudo verificar migraciones');
}

// 5. Verificar que Prisma Client está generado
console.log('\n📦 4. Verificando Prisma Client...');
try {
  const prismaClientPath = path.join(
    API_DIR,
    'node_modules/.prisma/client/index.js',
  );
  if (!fs.existsSync(prismaClientPath)) {
    console.log('   Generando Prisma Client...');
    execSync('npx prisma generate', { stdio: 'inherit', timeout: 60000 });
  }
  console.log('   ✅ Prisma Client disponible');
} catch (error) {
  warnings.push('⚠️  Prisma Client no generado (se generará en build)');
}

// 6. Verificar estructura de archivos críticos
console.log('\n📁 5. Verificando estructura de archivos...');
const criticalFiles = [
  'src/main.ts',
  'src/app.module.ts',
  'prisma/schema.prisma',
  'package.json',
];

criticalFiles.forEach((file) => {
  const filePath = path.join(API_DIR, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file} existe`);
  } else {
    errors.push(`❌ ${file} no encontrado`);
  }
});

// 7. Verificar dependencias
console.log('\n📚 6. Verificando dependencias...');
try {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(API_DIR, 'package.json'), 'utf-8'),
  );
  const nodeModulesExists = fs.existsSync(
    path.join(API_DIR, 'node_modules'),
  );
  if (!nodeModulesExists) {
    warnings.push('⚠️  node_modules no encontrado (ejecutar npm install)');
  } else {
    console.log('   ✅ Dependencias instaladas');
  }
} catch (error) {
  warnings.push('⚠️  No se pudo verificar dependencias');
}

// 8. Verificar tests (opcional)
console.log('\n🧪 7. Verificando tests...');
try {
  console.log('   Ejecutando tests...');
  execSync('npm run test -- --passWithNoTests', {
    stdio: 'inherit',
    timeout: 300000,
  });
  console.log('   ✅ Tests pasaron');
} catch (error) {
  warnings.push('⚠️  Algunos tests fallaron (revisar manualmente)');
}

// Resumen
console.log('\n' + '='.repeat(50));
console.log('\n📊 RESUMEN\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ Todo listo para desplegar!\n');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log('❌ ERRORES CRÍTICOS (deben resolverse antes de desplegar):');
    errors.forEach((error) => console.log(`   ${error}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  ADVERTENCIAS (revisar antes de desplegar):');
    warnings.forEach((warning) => console.log(`   ${warning}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.log('❌ No se puede desplegar hasta resolver los errores críticos.\n');
    process.exit(1);
  } else {
    console.log('⚠️  Se puede desplegar, pero revisa las advertencias.\n');
    process.exit(0);
  }
}
