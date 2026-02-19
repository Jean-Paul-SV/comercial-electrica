import { IsString, MaxLength, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePortalSessionDto {
  @ApiPropertyOptional({
    description:
      'URL a la que Stripe redirigirá al usuario al cerrar el portal. Por defecto se usa FRONTEND_URL + /settings/billing.',
    example: 'https://app.ejemplo.com/settings/billing',
    maxLength: 2048,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  returnUrl?: string;
}
