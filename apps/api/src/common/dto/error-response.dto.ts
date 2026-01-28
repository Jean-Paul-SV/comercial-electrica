import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    example: '2b7b6b3a-3b5b-4f5a-9b1c-5a4f1a6d0c2e',
    description: 'ID de correlación de la petición (opcional)',
    required: false,
  })
  requestId?: string;

  @ApiProperty({ example: 400, description: 'Código de estado HTTP' })
  statusCode!: number;

  @ApiProperty({
    example: 'Bad Request',
    description: 'Tipo de error',
  })
  error!: string;

  @ApiProperty({
    example: 'Debe incluir items.',
    description: 'Mensaje de error descriptivo',
  })
  message!: string | string[];

  @ApiProperty({
    example: '2026-01-26T12:00:00.000Z',
    description: 'Timestamp del error',
  })
  timestamp!: string;

  @ApiProperty({
    example: '/sales',
    description: 'Ruta donde ocurrió el error',
  })
  path!: string;

  @ApiProperty({
    example: { field: 'campo inválido' },
    description: 'Detalles adicionales del error (opcional)',
    required: false,
  })
  details?: Record<string, any>;
}
