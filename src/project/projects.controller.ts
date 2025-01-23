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
        name: 'Marketing Project',
        userId: '60d5ecbdxx54b3b2c001f3e1234',
        dataInfo: {
          title: 'I am a Title',
          subtitle: 'I am a Subtitle',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'User ID not provided',
    schema: {
      example: {
        statusCode: 400,
        message: 'User ID is required',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'User not found',
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'User already has a project',
    schema: {
      example: {
        statusCode: 409,
        message: 'User already has a registered project',
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
  @ApiParam({ name: 'projectId', description: 'ID do projeto' })
  @ApiResponse({
    status: 200,
    description: 'Informações do projeto retornadas com sucesso',
    schema: {
      example: {
        title: 'Projeto Atualizado',
        subtitle: 'Detalhes do projeto',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'ID de projeto inválido',
    schema: {
      example: {
        statusCode: 400,
        message: 'ID de projeto inválido',
      },
    },
  })
  async getProjectDataInfo(@Param('projectId') projectId: string) {
    return this.projectsService.getProjectDataInfo(projectId);
  }

  @Put(':projectId/datainfo')
  @ApiOperation({ summary: 'Update project dataInfo' })
  @ApiParam({ name: 'projectId', description: 'ID do projeto' })
  @ApiBody({
    description: 'Dados para atualização do projeto',
    type: UpdateProjectDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Informações do projeto atualizadas com sucesso',
    schema: {
      example: {
        title: 'Projeto Atualizado',
        subtitle: 'Novos detalhes do projeto',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'ID de projeto inválido',
    schema: {
      example: {
        statusCode: 400,
        message: 'ID de projeto inválido',
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

  @Delete(':projectId')
  @ApiOperation({ summary: 'Delete project by ID' })
  @ApiParam({ name: 'projectId', description: 'ID do projeto' })
  @ApiResponse({
    status: 200,
    description: 'Projeto excluído com sucesso',
    schema: {
      example: {
        message: 'Projeto excluído com sucesso',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'ID de projeto inválido',
    schema: {
      example: {
        statusCode: 400,
        message: 'ID de projeto inválido',
      },
    },
  })
  async deleteProject(@Param('projectId') projectId: string) {
    return this.projectsService.deleteProject(projectId);
  }
}
