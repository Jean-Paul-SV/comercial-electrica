import {
  encryptCertPayload,
  decryptCertPayload,
  decryptCertPayloadWithFallback,
} from './cert-encryption.util';

describe('cert-encryption.util', () => {
  const testKey1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const testKey2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
  const testData = Buffer.from('test certificate data');

  describe('encryptCertPayload y decryptCertPayload', () => {
    it('debe cifrar y descifrar correctamente', () => {
      const encrypted = encryptCertPayload(testData, testKey1);
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');

      const decrypted = decryptCertPayload(encrypted, testKey1);
      expect(decrypted).toEqual(testData);
    });

    it('debe fallar si se usa una clave incorrecta', () => {
      const encrypted = encryptCertPayload(testData, testKey1);
      expect(() => {
        decryptCertPayload(encrypted, testKey2);
      }).toThrow();
    });

    it('debe generar diferentes cifrados para el mismo contenido', () => {
      const encrypted1 = encryptCertPayload(testData, testKey1);
      const encrypted2 = encryptCertPayload(testData, testKey1);
      // Deben ser diferentes porque el IV es aleatorio
      expect(encrypted1).not.toBe(encrypted2);
      // Pero ambos deben descifrar al mismo contenido
      expect(decryptCertPayload(encrypted1, testKey1)).toEqual(testData);
      expect(decryptCertPayload(encrypted2, testKey1)).toEqual(testData);
    });
  });

  describe('decryptCertPayloadWithFallback', () => {
    it('debe descifrar con la primera clave que funcione', () => {
      const encrypted = encryptCertPayload(testData, testKey1);
      const result = decryptCertPayloadWithFallback(encrypted, [testKey1, testKey2]);
      expect(result.buffer).toEqual(testData);
      expect(result.keyIndex).toBe(0);
    });

    it('debe intentar con la segunda clave si la primera falla', () => {
      const encrypted = encryptCertPayload(testData, testKey2);
      const result = decryptCertPayloadWithFallback(encrypted, [testKey1, testKey2]);
      expect(result.buffer).toEqual(testData);
      expect(result.keyIndex).toBe(1);
    });

    it('debe intentar con múltiples claves hasta encontrar la correcta', () => {
      const wrongKey1 = '0000000000000000000000000000000000000000000000000000000000000000';
      const wrongKey2 = '1111111111111111111111111111111111111111111111111111111111111111';
      const encrypted = encryptCertPayload(testData, testKey2);
      const result = decryptCertPayloadWithFallback(encrypted, [
        wrongKey1,
        wrongKey2,
        testKey2,
      ]);
      expect(result.buffer).toEqual(testData);
      expect(result.keyIndex).toBe(2);
    });

    it('debe lanzar error si ninguna clave funciona', () => {
      const encrypted = encryptCertPayload(testData, testKey1);
      const wrongKey1 = '0000000000000000000000000000000000000000000000000000000000000000';
      const wrongKey2 = '1111111111111111111111111111111111111111111111111111111111111111';
      expect(() => {
        decryptCertPayloadWithFallback(encrypted, [wrongKey1, wrongKey2]);
      }).toThrow('No se pudo descifrar con ninguna de las');
    });

    it('debe lanzar error si no se proporcionan claves', () => {
      const encrypted = encryptCertPayload(testData, testKey1);
      expect(() => {
        decryptCertPayloadWithFallback(encrypted, []);
      }).toThrow('Se requiere al menos una clave para descifrar');
    });
  });
});
