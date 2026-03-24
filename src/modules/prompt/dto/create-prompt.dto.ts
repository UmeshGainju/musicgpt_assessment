import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreatePromptDto {
  @ApiProperty({
    example: 'Generate a relaxing lo-fi beat with piano and rain sounds',
    description: 'Text prompt for audio generation',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;
}
