import { ArgumentsHost, HttpStatus, NotFoundException, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

/** UUID v4 pattern: no debe aparecer en mensajes de error al cliente (seguridad). */
const UUID_REGEX =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

function createMockHost(jsonCapture: { body: unknown }) {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn((body: unknown) => {
      jsonCapture.body = body;
    }),
  };
  const ctx = {
    getResponse: () => res,
    getRequest: () => ({ url: '/test', method: 'GET', get: () => undefined, ip: '127.0.0.1' }),
    switchToHttp: () => ctx,
  };
  const host = {
    switchToHttp: () => ctx,
  } as unknown as ArgumentsHost;
  return host;
}

describe('AllExceptionsFilter (seguridad: mensajes sin IDs)', () => {
  let filter: AllExceptionsFilter;
  const jsonCapture: { body: unknown } = { body: undefined };

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('las respuestas de NotFoundException no deben incluir UUIDs en el mensaje', () => {
    const host = createMockHost(jsonCapture);
    filter.catch(new NotFoundException('Cliente no encontrado.'), host);

    const body = jsonCapture.body as { message?: string | string[] };
    const messageStr = Array.isArray(body.message) ? body.message.join(' ') : body.message || '';
    expect(messageStr).not.toMatch(UUID_REGEX);
    expect(body.message).toBe('Cliente no encontrado.');
  });

  it('las respuestas de BadRequestException no deben incluir UUIDs en el mensaje', () => {
    const host = createMockHost(jsonCapture);
    filter.catch(new BadRequestException('Uno o más productos no existen o están inactivos.'), host);

    const body = jsonCapture.body as { message?: string | string[] };
    const messageStr = Array.isArray(body.message) ? body.message.join(' ') : body.message || '';
    expect(messageStr).not.toMatch(UUID_REGEX);
  });

  it('si por error se incluyera un ID en el mensaje, el test fallaría (regresión)', () => {
    const host = createMockHost(jsonCapture);
    const leakMessage = 'Cliente con id 550e8400-e29b-41d4-a716-446655440000 no encontrado.';
    filter.catch(new NotFoundException(leakMessage), host);

    const body = jsonCapture.body as { message?: string | string[] };
    const messageStr = Array.isArray(body.message) ? body.message.join(' ') : body.message || '';
    expect(messageStr).toMatch(UUID_REGEX);
  });
});
