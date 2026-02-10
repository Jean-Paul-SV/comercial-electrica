import type { Readable } from 'stream';

/**
 * Tipo para archivos subidos con Multer.
 * Definido localmente para no depender de la ampliación global Express.Multer
 * que puede fallar en algunos entornos de build (p. ej. Render).
 */
export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  stream?: Readable;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}
