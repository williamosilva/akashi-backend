import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Param,
  Delete,
  Get,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@ApiTags('Projects')
@Controller('projects')
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
          orcamento: {
            objectId: '663d1a5e8a9f6a4d9f4c7b1d',
            valor: 50000,
            moeda: 'BRL',
          },
          apiIntegracao: {
            objectId: '663d1a5e8a9f6a4d9f4c7b1e',
            apiUrl: 'https://api.example.com/data',
            JSONPath: '$..results',
            dataReturn: { results: [] },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'External API integration requires Premium plan',
    schema: {
      example: {
        statusCode: 403,
        message: 'External API integration requires Premium plan',
      },
    },
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
          metrics: {
            objectId: '663d1a5e8a9f6a4d9f4c7b1f',
            visits: 1500,
            conversions: 45,
          },
          apiData: {
            objectId: '663d1a5e8a9f6a4d9f4c7b1e',
            apiUrl: 'https://api.example.com/data',
            dataReturn: { results: [] },
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
  @ApiBody({
    description: 'Data for project update',
    type: UpdateProjectDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Project information updated successfully',
    schema: {
      example: {
        dataInfo: {
          orcamento: {
            objectId: '663d1a5e8a9f6a4d9f4c7b1d',
            valor: 75000,
            moeda: 'BRL',
          },
          newField: {
            objectId: '663d1a5e8a9f6a4d9f4c7b20',
            notes: 'Additional information',
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
          dataInfo: {
            budget: {
              objectId: '663d1a5e8a9f6a4d9f4c7b1d',
              total: 50000,
            },
          },
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
