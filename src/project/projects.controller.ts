import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Param,
  Delete,
  Get,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { JwtAuthGuard } from 'src/auth/guards/auth.guard';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@ApiBearerAuth('refresh-token')
@ApiSecurity('secret-key')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({
    status: 201,
    description: 'Project created successfully',
    schema: {
      example: {
        _id: '663d1a5e8a9f6a4d9f4c7b1c',
        name: 'Marketing Project',
        userId: '60d5ecbdxx54b3b2c001f3e1234',
        dataInfo: {
          '663d1a5e8a9f6a4d9f4c7b1d': {
            orcamento: {
              valor: 50000,
              moeda: 'BRL',
            },
          },
          '663d1a5e8a9f6a4d9f4c7b1e': {
            integracaoexemplo: {
              apiUrl: 'https://api.example.com/cliente',
              JSONPath: '$.store.book[0].client',
              x_api_key: 'your-api-key-here',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'External API integration requires Premium plan',
  })
  async createProject(@Body() createProjectDto: CreateProjectDto) {
    const { userId, ...projectData } = createProjectDto;
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.projectsService.createProject(userId, projectData);
  }

  @Get(':projectId/datainfo')
  @ApiOperation({ summary: 'Get project dataInfo by project ID' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project information returned successfully',
    schema: {
      example: {
        name: 'Marketing Project',
        dataInfo: {
          '663d1a5e8a9f6a4d9f4c7b1d': {
            orcamento: {
              valor: 50000,
              moeda: 'BRL',
            },
          },
          '663d1a5e8a9f6a4d9f4c7b1e': {
            integracaoexemplo: {
              apiUrl: 'https://api.example.com/cliente',
              JSONPath: '$.store.book[0].client',
              x_api_key: 'your-api-key-here',
              dataReturn: {
                nome: 'Cliente Exemplo',
                email: 'cliente@example.com',
              },
            },
          },
        },
      },
    },
  })
  async getProjectDataInfo(@Param('projectId') projectId: string) {
    return this.projectsService.getProjectDataInfo(projectId);
  }

  @Put(':projectId/datainfo')
  @ApiOperation({ summary: 'Update project dataInfo' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({
    status: 200,
    description: 'Project information updated successfully',
    schema: {
      example: {
        _id: '663d1a5e8a9f6a4d9f4c7b1c',
        name: 'Marketing Project',
        dataInfo: {
          '663d1a5e8a9f6a4d9f4c7b1d': {
            orcamento: {
              valor: 75000,
              moeda: 'BRL',
            },
          },
          '663d1a5e8a9f6a4d9f4c7b1e': {
            integracaoexemplo: {
              apiUrl: 'https://api.example.com/cliente/updated',
              JSONPath: '$.store.book[0].client',
              x_api_key: 'updated-api-key',
            },
          },
          '663d1a5e8a9f6a4d9f4c7b20': {
            newField: {
              notes: 'Additional information',
            },
          },
        },
      },
    },
  })
  async updateProjectDataInfo(
    @Param('projectId') projectId: string,
    @Body() updateDataInfoDto: UpdateProjectDto,
  ) {
    return this.projectsService.updateProjectDataInfo(
      projectId,
      updateDataInfoDto,
    );
  }

  @Put(':projectId/datainfo/entry/:entryId')
  @ApiOperation({ summary: 'Update specific entry in dataInfo by entry ID' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'entryId', description: 'Entry ID within dataInfo' })
  @ApiBody({
    description: 'Data to update the entry',
    schema: {
      example: {
        integracaoexemplo: {
          apiUrl: 'https://api.new-example.com/data',
          JSONPath: '$..newResults',
          x_api_key: 'new-api-key',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Entry updated successfully',
    schema: {
      example: {
        _id: 'project123',
        name: 'Updated Project',
        dataInfo: {
          entry123: {
            orcamento: {
              valor: 85000,
            },
          },
          entry456: {
            integracaoexemplo: {
              apiUrl: 'https://api.new-example.com/data',
              JSONPath: '$..newResults',
              x_api_key: 'new-api-key',
            },
          },
        },
      },
    },
  })
  async updateDataInfoEntry(
    @Param('projectId') projectId: string,
    @Param('entryId') entryId: string,
    @Body() updateData: Record<string, any>,
  ) {
    return this.projectsService.updateDataInfoEntry(
      projectId,
      entryId,
      updateData,
    );
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get projects by User ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Projects found successfully',
    schema: {
      example: [
        {
          _id: '60d5ecb54b3xxb2c001f3e123',
          name: 'Project Name',
        },
      ],
    },
  })
  async getProjectByUser(@Param('userId') userId: string) {
    return this.projectsService.getProjectByUserId(userId);
  }

  @Delete(':projectId')
  @ApiOperation({ summary: 'Delete project by ID' })
  @ApiResponse({
    status: 200,
    description: 'Project deleted successfully',
    schema: {
      example: {
        message: 'Project deleted successfully',
      },
    },
  })
  async deleteProject(@Param('projectId') projectId: string) {
    return this.projectsService.deleteProject(projectId);
  }
}
