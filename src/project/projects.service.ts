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
    if (entry.apiUrl) {
      try {
        const apiKeyEntry = Object.entries(entry).find(
          ([k]) =>
            !['apiUrl', 'JSONPath', 'dataReturn', 'objectId'].includes(k),
        );

        const headers = new AxiosHeaders();
        if (apiKeyEntry) {
          headers.set(apiKeyEntry[0], String(apiKeyEntry[1]));
        }

        const apiResponse = await axios.get(entry.apiUrl, { headers });
        let dataReturn;

        if (entry.JSONPath) {
          try {
            const results = jsonpath.query(apiResponse.data, entry.JSONPath);
            dataReturn =
              results.length > 0
                ? results[0]
                : `No data found for JSONPath: "${entry.JSONPath}"`;
          } catch (error) {
            dataReturn = `Invalid JSONPath: "${entry.JSONPath}". Error: ${error.message}`;
          }
        } else {
          dataReturn = apiResponse.data;
        }

        return { ...entry, dataReturn };
      } catch (error) {
        console.error(`Error fetching API (${entry.apiUrl}):`, error.message);
        return { ...entry, dataReturn: `Error: ${error.message}` };
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
        (value) => typeof value === 'object' && 'apiUrl' in value,
      );

      if (hasExternalApi && !['premium', 'admin'].includes(userPlan)) {
        throw new ForbiddenException(
          'External API integration requires Premium plan',
        );
      }

      for (const [key, value] of Object.entries(createProjectDto.dataInfo)) {
        const objectId = this.generateObjectId();
        let entry = { ...value, objectId };

        if (typeof value === 'object' && value.apiUrl) {
          entry = await this.processApiIntegration(entry);
        }

        processedDataInfo[key] = entry;
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

    for (const [objectId, entry] of Object.entries(dataInfo)) {
      if (entry['apiUrl']) {
        dataInfo[objectId] = await this.processApiIntegration(entry);
      }
    }

    project.dataInfo = dataInfo;
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

    // Atualizar dados mantendo o objectId existente
    let updatedEntry = {
      ...dataInfo[entryKey],
      ...updateData,
      objectId, // Garante que o ID não seja alterado
    };

    // Processar API se necessário
    if (updatedEntry.apiUrl) {
      updatedEntry = await this.processApiIntegration(updatedEntry);
    }

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
        let processedEntry = entry;

        // Gera novo ID se for uma nova entrada
        const objectId =
          currentDataInfo[key]?.objectId || this.generateObjectId();

        if (entry.apiUrl) {
          processedEntry = await this.processApiIntegration({
            ...entry,
            objectId,
          });
        }

        currentDataInfo[key] = { ...processedEntry, objectId };
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
