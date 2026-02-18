import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { FeedbackStatus } from '@prisma/client';

export class UpdateFeedbackStatusDto {
  @ApiProperty({
    description: 'Nuevo estado de la sugerencia',
    enum: FeedbackStatus,
    example: 'READ',
  })
  @IsEnum(FeedbackStatus)
  status: FeedbackStatus;
}
