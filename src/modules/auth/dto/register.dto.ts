import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'usuario@exemplo.com',
    description: 'Email do usuário',
  })
  email: string;

  @ApiProperty({
    example: 'senha123',
    description: 'Senha do usuário',
  })
  @IsOptional()
  password: string;

  @ApiProperty({
    example: 'João da Silva',
    description: 'Nome completo do usuário',
  })
  fullName: string;
}
