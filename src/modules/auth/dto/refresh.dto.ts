import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'The refresh token received during login' })
  @IsString()
  refresh_token!: string;
}
