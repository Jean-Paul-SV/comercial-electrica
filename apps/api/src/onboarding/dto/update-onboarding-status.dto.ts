import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateOnboardingStatusDto {
  @ApiProperty({
    example: 'in_progress',
    description: 'Estado del onboarding',
    enum: ['in_progress', 'completed', 'skipped'],
  })
  @IsIn(['in_progress', 'completed', 'skipped'])
  status!: 'in_progress' | 'completed' | 'skipped';
}
