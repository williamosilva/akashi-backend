import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

interface ApiDataInfo {
  uriApi: string;
  ref?: string;
  dataReturn?: any;
}

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
      cliente: { uriApi: 'https://api.example.com/cliente', ref: 'data' },
      orcamento: 50000,
    },
    description: 'Informações adicionais do projeto',
  })
  dataInfo?: Record<string, ApiDataInfo | any>;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({
    example: {
      cliente: { uriApi: 'https://api.example.com/cliente', ref: 'data' },
      orcamento: 75000,
    },
    description: 'Informações atualizadas do projeto',
  })
  dataInfo?: Record<string, ApiDataInfo | any>;
}
