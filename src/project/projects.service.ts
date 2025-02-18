import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project } from './schemas/project.schema';
import { User } from '../auth/schemas/user.schema';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import axios from 'axios';
import { AxiosHeaders } from 'axios';
import * as jsonpath from 'jsonpath';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  private generateObjectId(): string {
    return new Types.ObjectId().toHexString();
  }

  private async processApiIntegration(entry: any) {
    if (entry.apiIntegration && entry.apiIntegration.apiUrl) {
      try {
        const config = {
          headers: new AxiosHeaders(),
        };

        if (entry.apiIntegration.x_api_key) {
          config.headers.set('x-api-key', entry.apiIntegration.x_api_key);
        }

        const apiResponse = await axios.get(
          entry.apiIntegration.apiUrl,
          config,
        );
        let dataReturn;

        if (entry.apiIntegration.JSONPath) {
          try {
            const results = jsonpath.query(
              apiResponse.data,
              entry.apiIntegration.JSONPath,
            );
            dataReturn =
              results.length > 0
                ? results[0]
                : `No data found for JSONPath: "${entry.apiIntegration.JSONPath}"`;
          } catch (error) {
            dataReturn = `Invalid JSONPath: "${entry.apiIntegration.JSONPath}". Error: ${error.message}`;
          }
        } else {
          dataReturn = apiResponse.data;
        }

        return {
          ...entry,
          apiIntegration: {
            ...entry.apiIntegration,
            dataReturn,
          },
        };
      } catch (error) {
        console.error(
          `Error fetching API (${entry.apiIntegration.apiUrl}):`,
          error.message,
        );
        return {
          ...entry,
          apiIntegration: {
            ...entry.apiIntegration,
            dataReturn: `Error: ${error.message}`,
          },
        };
      }
    }
    return entry;
  }

  async createProject(userId: string, createProjectDto: CreateProjectDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userObjectId);
    if (!user) throw new NotFoundException('User not found');

    // Garante que user.plan tenha um valor válido
    const userPlan = user.plan ?? 'free';

    const existingProjectsCount = await this.projectModel.countDocuments({
      user: userObjectId,
    });
    this.checkUserPlan(userPlan, existingProjectsCount);

    const processedDataInfo: Record<string, any> = {};
    if (createProjectDto.dataInfo) {
      const hasExternalApi = Object.values(createProjectDto.dataInfo).some(
        (value) =>
          typeof value === 'object' &&
          value.apiIntegration &&
          value.apiIntegration.apiUrl,
      );

      if (hasExternalApi && !['premium', 'admin'].includes(userPlan)) {
        throw new ForbiddenException(
          'External API integration requires Premium plan',
        );
      }

      for (const [key, value] of Object.entries(createProjectDto.dataInfo)) {
        const objectId = this.generateObjectId();
        processedDataInfo[key] = { ...value, objectId };
      }
    }

    const newProject = new this.projectModel({
      ...createProjectDto,
      dataInfo: processedDataInfo,
      user: userObjectId,
    });

    return newProject.save();
  }

  private checkUserPlan(plan: string, count: number) {
    const limits = { default: 1, basic: 5, premium: 10 };
    const limit = limits[plan] || limits.default;
    if (count >= limit) {
      throw new ConflictException(
        `Plan ${plan} allows up to ${limit} projects`,
      );
    }
  }

  async getProjectDataInfo(projectId: string) {
    const project = await this.validateProject(projectId);
    const dataInfo = project.dataInfo || {};
    const processedDataInfo = { ...dataInfo };

    for (const [key, entry] of Object.entries(dataInfo)) {
      if (entry && entry.apiIntegration && entry.apiIntegration.apiUrl) {
        processedDataInfo[key] = await this.processApiIntegration(entry);
      }
    }

    project.dataInfo = processedDataInfo;
    await project.save();

    return {
      name: project.name,
      dataInfo: project.dataInfo,
    };
  }

  async updateDataInfoEntry(
    projectId: string,
    objectId: string,
    updateData: Record<string, any>,
  ) {
    const project = await this.validateProject(projectId);
    const dataInfo = project.dataInfo || {};

    // Encontrar a entrada pelo objectId
    const entryKey = Object.keys(dataInfo).find(
      (key) => dataInfo[key]?.objectId === objectId,
    );

    if (!entryKey) {
      throw new NotFoundException('Entry not found with provided objectId');
    }

    // Remove dataReturn if present in updateData.apiIntegration
    if (
      updateData.apiIntegration &&
      'dataReturn' in updateData.apiIntegration
    ) {
      delete updateData.apiIntegration.dataReturn;
    }

    // Atualizar dados mantendo o objectId existente
    let updatedEntry = {
      ...dataInfo[entryKey],
      ...updateData,
      objectId, // Garante que o ID não seja alterado
    };

    dataInfo[entryKey] = updatedEntry;
    project.dataInfo = dataInfo;

    await project.save();
    return project;
  }

  async updateProjectDataInfo(
    projectId: string,
    updateProjectDto: UpdateProjectDto,
  ) {
    const project = await this.validateProject(projectId);
    const currentDataInfo = project.dataInfo || {};

    if (updateProjectDto.dataInfo) {
      for (const [key, entry] of Object.entries(updateProjectDto.dataInfo)) {
        // Remove dataReturn if present in entry.apiIntegration
        if (entry.apiIntegration && 'dataReturn' in entry.apiIntegration) {
          delete entry.apiIntegration.dataReturn;
        }

        // Gera novo ID se for uma nova entrada
        const objectId =
          currentDataInfo[key]?.objectId || this.generateObjectId();

        currentDataInfo[key] = { ...entry, objectId };
      }

      project.dataInfo = currentDataInfo;
      await project.save();
    }

    return project;
  }

  private async validateProject(projectId: string) {
    if (!Types.ObjectId.isValid(projectId)) {
      throw new BadRequestException('Invalid project ID');
    }
    const project = await this.projectModel.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    return project;
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

    const projects = await this.projectModel
      .find({ user: userObjectId })
      .select('name _id')
      .lean();

    if (!projects.length) {
      throw new NotFoundException('No projects found for this user');
    }

    return projects;
  }
}
