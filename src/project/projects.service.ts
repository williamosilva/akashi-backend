import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project } from './schemas/project.schema';
import { User } from '../auth/schemas/user.schema';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import axios from 'axios';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async createProject(userId: string, createProjectDto: CreateProjectDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const userObjectId = new Types.ObjectId(userId);

    const userExists = await this.userModel.findById(userObjectId);
    if (!userExists) {
      throw new NotFoundException('User not found');
    }

    const existingProject = await this.projectModel.findOne({
      user: userObjectId,
    });
    if (existingProject) {
      throw new ConflictException('User already has a registered project');
    }

    if (createProjectDto.dataInfo) {
      for (const [key, value] of Object.entries(createProjectDto.dataInfo)) {
        if (typeof value === 'object' && value.uriApi) {
          try {
            const apiResponse = await axios.get(value.uriApi);

            const dataReturn = value.ref
              ? apiResponse.data[value.ref]
              : apiResponse.data;

            createProjectDto.dataInfo[key] = {
              ...value,
              dataReturn:
                dataReturn !== undefined
                  ? dataReturn
                  : `API responded successfully, but key "${value.ref}" was not found.`,
            };
          } catch (error) {
            console.error(
              `Error fetching data from API (${value.uriApi}):`,
              error.message,
            );
            createProjectDto.dataInfo[key] = {
              ...value,
              dataReturn: `Error fetching data: ${error.message}`,
            };
          }
        }
      }
    }

    const newProject = new this.projectModel({
      ...createProjectDto,
      user: userObjectId,
    });

    return await newProject.save();
  }

  async getProjectDataInfo(projectId: string) {
    if (!Types.ObjectId.isValid(projectId)) {
      throw new BadRequestException('Invalid project ID');
    }

    const project = await this.projectModel
      .findById(projectId)
      .select('dataInfo');

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.dataInfo) {
      for (const [key, value] of Object.entries(project.dataInfo)) {
        if (typeof value === 'object' && value.uriApi) {
          try {
            const apiResponse = await axios.get(value.uriApi);

            const dataReturn = value.ref
              ? apiResponse.data[value.ref]
              : apiResponse.data;

            project.dataInfo[key] = {
              ...value,
              dataReturn:
                dataReturn !== undefined
                  ? dataReturn
                  : `API responded successfully, but key "${value.ref}" was not found.`,
            };
          } catch (error) {
            console.error(
              `Error fetching data from API (${value.uriApi}):`,
              error.message,
            );
            project.dataInfo[key] = {
              ...value,
              dataReturn: `Error fetching data: ${error.message}`,
            };
          }
        }
      }

      await project.save();
    }

    return project.dataInfo;
  }

  async updateProjectDataInfo(
    projectId: string,
    updateProjectDto: UpdateProjectDto,
  ) {
    if (!Types.ObjectId.isValid(projectId)) {
      throw new BadRequestException('Invalid project ID');
    }

    if (updateProjectDto.dataInfo) {
      for (const [key, value] of Object.entries(updateProjectDto.dataInfo)) {
        if (typeof value === 'object' && value.uriApi) {
          try {
            const apiResponse = await axios.get(value.uriApi);

            const dataReturn = value.ref
              ? apiResponse.data[value.ref]
              : apiResponse.data;

            updateProjectDto.dataInfo[key] = {
              ...value,
              dataReturn:
                dataReturn !== undefined
                  ? dataReturn
                  : `API responded successfully, but key "${value.ref}" was not found.`,
            };
          } catch (error) {
            console.error(
              `Error fetching data from API (${value.uriApi}):`,
              error.message,
            );
            updateProjectDto.dataInfo[key] = {
              ...value,
              dataReturn: `Error fetching data: ${error.message}`,
            };
          }
        }
      }
    }

    // Atualização com { new: true } para retornar o objeto atualizado
    const updatedProject = await this.projectModel.findByIdAndUpdate(
      projectId,
      { $set: updateProjectDto },
      { new: true, runValidators: true },
    );

    if (!updatedProject) {
      throw new NotFoundException('Project not found');
    }

    return updatedProject;
  }

  async deleteProject(projectId: string) {
    if (!Types.ObjectId.isValid(projectId)) {
      throw new BadRequestException('Invalid project ID');
    }

    const deletedProject = await this.projectModel.findByIdAndDelete(projectId);

    if (!deletedProject) {
      throw new NotFoundException('Project not found');
    }

    return { message: 'Project deleted successfully' };
  }

  async getProjectByUserId(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const userObjectId = new Types.ObjectId(userId);

    const userExists = await this.userModel.findById(userObjectId);
    if (!userExists) {
      throw new NotFoundException('User not found');
    }

    const project = await this.projectModel.findOne({ user: userObjectId });

    if (!project) {
      throw new NotFoundException('No project found for this user');
    }

    return project;
  }
}
