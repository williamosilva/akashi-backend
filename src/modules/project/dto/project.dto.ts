import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

interface ApiDataInfo {
  apiUrl: string;
  JSONPath?: string;
  dataReturn?: any;
  [apiKeyName: string]: string | any;
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
      cliente: {
        apiUrl: 'https://api.example.com/cliente',
        JSONPath: '$.store.book[0].client',
        x_api_key: 'your-api-key-here',
      },
      orcamento: 50000,
    },
    description: 'Informações adicionais do projeto',
  })
  dataInfo?: Record<string, ApiDataInfo | any>;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({
    example: {
      cliente: {
        apiUrl: 'https://api.example.com/cliente',
        JSONPath: 'data',
        custom_api_key: 'your-custom-key-here',
      },
      orcamento: 75000,
    },
    description: 'Informações atualizadas do projeto',
  })
  dataInfo?: Record<string, ApiDataInfo | any>;
}
