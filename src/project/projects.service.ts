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
        if (typeof value === 'object' && value.uriApi && value.ref) {
          try {
            const apiResponse = await axios.get(value.uriApi);
            createProjectDto.dataInfo[key] = {
              ...value,
              dataReturn: value.ref
                ? apiResponse.data[value.ref]
                : apiResponse.data,
            };
          } catch (error) {
            throw new BadRequestException(
              `Error fetching data from API in ${value.uriApi}`,
            );
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
        if (typeof value === 'object' && value.uriApi && value.ref) {
          try {
            const apiResponse = await axios.get(value.uriApi);
            const dataReturn = value.ref
              ? apiResponse.data[value.ref]
              : apiResponse.data;

            if (dataReturn && dataReturn.id) {
              delete dataReturn.id;
            }

            project.dataInfo[key] = {
              ...value,
              dataReturn: dataReturn,
            };
          } catch (error) {
            throw new BadRequestException(
              `Error fetching data from API in ${value.uriApi}`,
            );
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
      throw new BadRequestException('ID de projeto inválido');
    }

    // Lógica similar à criação para busca automática de API
    if (updateProjectDto.dataInfo) {
      for (const [key, value] of Object.entries(updateProjectDto.dataInfo)) {
        if (typeof value === 'object' && value.uriApi && value.ref) {
          try {
            const apiResponse = await axios.get(value.uriApi);
            updateProjectDto.dataInfo[key] = {
              ...value,
              dataReturn: value.ref
                ? apiResponse.data[value.ref]
                : apiResponse.data,
            };
          } catch (error) {
            throw new BadRequestException(
              `Error fetching data from API in ${value.uriApi}`,
            );
          }
        }
      }
    }

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
}
