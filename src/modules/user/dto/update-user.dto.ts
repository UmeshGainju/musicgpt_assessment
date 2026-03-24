import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    example: 'New Display Name',
    description: 'Updated display name',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  display_name!: string;
}
