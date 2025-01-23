import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/project.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  async createProject(@Body() createProjectDto: CreateProjectDto) {
    const { userId, ...projectData } = createProjectDto;
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.projectsService.createProject(userId, projectData);
  }
}
