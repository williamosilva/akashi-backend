import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({
    example: 'Projeto de Marketing',
    description: 'Nome do projeto',
  })
  name: string;

  @ApiPropertyOptional({
    example: '60d5ecb54b3b2c001f3e1234',
    description: 'ID do usuário associado ao projeto',
  })
  userId?: string;

  @ApiPropertyOptional({
    example: {
      cliente: 'Empresa X',
      orcamento: 50000,
    },
    description: 'Informações adicionais do projeto',
  })
  dataInfo?: Record<string, any>;
}
