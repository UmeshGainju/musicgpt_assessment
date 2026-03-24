import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateAudioDto {
  @ApiProperty({
    example: 'My Awesome Track',
    description: 'Updated audio title',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;
}
