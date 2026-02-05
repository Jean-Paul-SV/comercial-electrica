import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';

@Injectable()
export class StorageService {
  private readonly basePath: string;
  private readonly provider: string;

  constructor(private readonly config: ConfigService) {
    this.provider = this.config.get<string>('OBJECT_STORAGE_PROVIDER', 'local');
    this.basePath = this.config.get<string>(
      'OBJECT_STORAGE_BASE_PATH',
      './storage',
    );
  }

  /**
   * Guarda un archivo en el almacenamiento local.
   * Retorna la URL relativa para acceder al archivo.
   */
  async saveFile(
    file: Express.Multer.File,
    subfolder: string = 'uploads',
  ): Promise<string> {
    if (this.provider !== 'local') {
      throw new BadRequestException(
        'Storage provider no soportado. Solo "local" está implementado.',
      );
    }

    // Validar tipo de archivo (solo imágenes)
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Solo se permiten imágenes (JPEG, PNG, WebP)',
      );
    }

    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('La imagen no puede exceder 5MB');
    }

    // Crear directorio si no existe
    const uploadDir = join(this.basePath, subfolder);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generar nombre único
    const ext = extname(file.originalname);
    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
    const filePath = join(uploadDir, filename);

    // Guardar archivo
    await writeFile(filePath, file.buffer);

    // Retornar ruta relativa para servir el archivo
    return `/storage/${subfolder}/${filename}`;
  }

  /**
   * Elimina un archivo del almacenamiento local.
   */
  async deleteFile(fileUrl: string): Promise<void> {
    if (this.provider !== 'local') {
      return; // No hacer nada si no es local
    }

    // Extraer ruta del archivo desde la URL
    // Ejemplo: /storage/uploads/1234567890-abc123.jpg
    const match = fileUrl.match(/\/storage\/(.+)$/);
    if (!match) {
      return; // URL inválida, no hacer nada
    }

    const relativePath = match[1];
    const filePath = join(this.basePath, relativePath);

    if (existsSync(filePath)) {
      try {
        await unlink(filePath);
      } catch (err) {
        // Ignorar errores al eliminar (archivo ya no existe, etc.)
        console.warn(`Error al eliminar archivo ${filePath}:`, err);
      }
    }
  }

  /**
   * Retorna la ruta completa del directorio de storage.
   */
  getStoragePath(): string {
    return this.basePath;
  }
}
