import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;
const SALT_LEN = 32;
const KEY_LEN = 32;

/**
 * Obtiene la clave de 32 bytes desde DIAN_CERT_ENCRYPTION_KEY.
 * Acepta: 64 caracteres hex, o 44 caracteres base64, o cualquier string (se deriva con scrypt).
 */
function getEncryptionKey(envKey: string | undefined): Buffer {
  if (!envKey || !envKey.trim()) {
    throw new Error(
      'DIAN_CERT_ENCRYPTION_KEY no configurada. Necesaria para cifrar/descifrar certificados por tenant.',
    );
  }
  const trimmed = envKey.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  try {
    const b = Buffer.from(trimmed, 'base64');
    if (b.length === 32) return b;
  } catch {
    // ignore
  }
  return scryptSync(trimmed, 'dian-cert-salt', KEY_LEN);
}

/**
 * Cifra un buffer con AES-256-GCM. Formato: iv (16) + authTag (16) + ciphertext.
 * Devuelve base64.
 */
export function encryptCertPayload(plaintext: Buffer, envKey: string): string {
  const key = getEncryptionKey(envKey);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv, { authTagLength: AUTH_TAG_LEN });
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Descifra un payload cifrado con encryptCertPayload.
 * @param encryptedBase64 Base64 de (iv + authTag + ciphertext)
 */
export function decryptCertPayload(
  encryptedBase64: string,
  envKey: string,
): Buffer {
  const key = getEncryptionKey(envKey);
  const raw = Buffer.from(encryptedBase64, 'base64');
  if (raw.length < IV_LEN + AUTH_TAG_LEN) {
    throw new Error('Payload cifrado inválido (muy corto).');
  }
  const iv = raw.subarray(0, IV_LEN);
  const authTag = raw.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN + AUTH_TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv, {
    authTagLength: AUTH_TAG_LEN,
  });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * C3.3: Intenta descifrar con múltiples claves (útil durante rotación).
 * Intenta con cada clave en orden hasta que una funcione.
 * 
 * @param encryptedBase64 Payload cifrado
 * @param keys Array de claves a intentar (en orden de prioridad)
 * @returns Buffer descifrado y el índice de la clave que funcionó
 */
export function decryptCertPayloadWithFallback(
  encryptedBase64: string,
  keys: string[],
): { buffer: Buffer; keyIndex: number } {
  if (keys.length === 0) {
    throw new Error('Se requiere al menos una clave para descifrar');
  }

  let lastError: Error | null = null;
  for (let i = 0; i < keys.length; i++) {
    try {
      const buffer = decryptCertPayload(encryptedBase64, keys[i]);
      return { buffer, keyIndex: i };
    } catch (err) {
      lastError = err as Error;
      // Continuar con la siguiente clave
    }
  }

  throw new Error(
    `No se pudo descifrar con ninguna de las ${keys.length} claves proporcionadas. Último error: ${lastError?.message}`,
  );
}
