import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/project.dto';

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
}
