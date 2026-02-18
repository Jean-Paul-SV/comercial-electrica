import { ConfigValidationModule } from './config-validation.module';

/** Mock de ConfigService para probar la validación sin el contenedor Nest. */
function createConfigMock(get: (key: string) => string | undefined) {
  return { get } as any;
}

describe('ConfigValidationModule (seguridad: validación al arranque)', () => {
  it('debe lanzar error si falta DATABASE_URL', () => {
    const config = createConfigMock((key) =>
      key === 'JWT_ACCESS_SECRET' ? 'test-secret' : undefined,
    );
    const module = new ConfigValidationModule(config);
    expect(() => module.onModuleInit()).toThrow(
      /Variables de entorno faltantes/,
    );
    expect(() => module.onModuleInit()).toThrow(/DATABASE_URL/);
  });

  it('debe lanzar error si DATABASE_URL está vacío', () => {
    const config = createConfigMock((key) =>
      key === 'DATABASE_URL'
        ? ''
        : key === 'JWT_ACCESS_SECRET'
          ? 'secret'
          : undefined,
    );
    const module = new ConfigValidationModule(config);
    expect(() => module.onModuleInit()).toThrow(/DATABASE_URL/);
  });

  it('debe lanzar error si falta JWT_ACCESS_SECRET', () => {
    const config = createConfigMock((key) =>
      key === 'DATABASE_URL' ? 'postgresql://localhost/test' : undefined,
    );
    const module = new ConfigValidationModule(config);
    expect(() => module.onModuleInit()).toThrow(
      /Variables de entorno faltantes/,
    );
    expect(() => module.onModuleInit()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('no debe lanzar si DATABASE_URL y JWT_ACCESS_SECRET están definidos', () => {
    const config = createConfigMock((key) => {
      if (key === 'DATABASE_URL') return 'postgresql://localhost/test';
      if (key === 'JWT_ACCESS_SECRET') return 'secret';
      return undefined;
    });
    const module = new ConfigValidationModule(config);
    expect(() => module.onModuleInit()).not.toThrow();
  });
});
