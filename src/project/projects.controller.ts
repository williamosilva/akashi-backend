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
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project information returned successfully',
    schema: {
      example: {
        title: 'Updated Project',
        subtitle: 'Project Details',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid project ID',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid project ID',
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
        title: 'Updated Project',
        subtitle: 'New project details',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid project ID',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid project ID',
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
  @ApiOperation({ summary: 'Get project by User ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Project found successfully',
    schema: {
      example: {
        _id: '60d5ecb54b3xxb2c001f3e123',
        name: 'Project Name',
        description: 'Project Description',
        dataInfo: {
          key1: {
            uriApi: 'https://api.example.com/data',
            ref: 'data',
            dataReturn: 'API Response Data',
          },
        },
        user: '60d5ecb54b3xxb2c001f3e124',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid User ID',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid user ID',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found or No project found for this user',
    schema: {
      example: {
        statusCode: 404,
        message: 'No project found for this user',
      },
    },
  })
  async getProjectByUser(@Param('userId') userId: string) {
    return this.projectsService.getProjectByUserId(userId);
  }

  @Delete(':projectId')
  @ApiOperation({ summary: 'Delete project by ID' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project deleted successfully',
    schema: {
      example: {
        message: 'Project deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid Project ID',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid Project ID',
      },
    },
  })
  async deleteProject(@Param('projectId') projectId: string) {
    return this.projectsService.deleteProject(projectId);
  }
}
