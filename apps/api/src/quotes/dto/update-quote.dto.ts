import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { QuoteStatus } from '@prisma/client';
import { CreateQuoteDto } from './create-quote.dto';

export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {
  @ApiPropertyOptional({
    enum: QuoteStatus,
    example: QuoteStatus.SENT,
    description: 'Estado de la cotización',
  })
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @ApiPropertyOptional({
    example: '2026-02-15T00:00:00Z',
    description: 'Fecha de validez de la cotización',
  })
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
