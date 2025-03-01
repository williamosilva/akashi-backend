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

  private isApiIntegrationObject(obj: any): boolean {
    return obj && typeof obj === 'object' && 'apiUrl' in obj;
  }

  private findApiIntegrationKey(entry: any): string | null {
    if (!entry || typeof entry !== 'object') return null;

    for (const [key, value] of Object.entries(entry)) {
      if (this.isApiIntegrationObject(value) && !['dataReturn'].includes(key)) {
        return key;
      }
    }
    return null;
  }

  private async processApiIntegration(entry: any) {
    const apiIntegrationKey = this.findApiIntegrationKey(entry);

    if (apiIntegrationKey && entry[apiIntegrationKey].apiUrl) {
      try {
        const config = {
          headers: new AxiosHeaders(),
        };

        if (entry[apiIntegrationKey].x_api_key) {
          config.headers.set('x-api-key', entry[apiIntegrationKey].x_api_key);
        }

        const apiResponse = await axios.get(
          entry[apiIntegrationKey].apiUrl,
          config,
        );
        let dataReturn;

        if (entry[apiIntegrationKey].JSONPath) {
          try {
            const results = jsonpath.query(
              apiResponse.data,
              entry[apiIntegrationKey].JSONPath,
            );
            dataReturn =
              results.length > 0
                ? results[0]
                : `No data found for JSONPath: "${entry[apiIntegrationKey].JSONPath}"`;
          } catch (error) {
            dataReturn = `Invalid JSONPath: "${entry[apiIntegrationKey].JSONPath}". Error: ${error.message}`;
          }
        } else {
          dataReturn = apiResponse.data;
        }

        return {
          ...entry,
          [apiIntegrationKey]: {
            ...entry[apiIntegrationKey],
            dataReturn,
          },
        };
      } catch (error) {
        console.error(
          `Error fetching API (${entry[apiIntegrationKey].apiUrl}):`,
          error.message,
        );
        return {
          ...entry,
          [apiIntegrationKey]: {
            ...entry[apiIntegrationKey],
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

    const userPlan = user.plan ?? 'free';
    const existingProjectsCount = await this.projectModel.countDocuments({
      user: userObjectId,
    });
    this.checkUserPlan(userPlan, existingProjectsCount);

    const processedDataInfo: Record<string, any> = {};
    if (createProjectDto.dataInfo) {
      const hasExternalApi = Object.values(createProjectDto.dataInfo).some(
        (value) => {
          if (typeof value !== 'object') return false;
          return Object.values(value).some((subValue) =>
            this.isApiIntegrationObject(subValue),
          );
        },
      );

      if (hasExternalApi && !['premium', 'admin'].includes(userPlan)) {
        throw new ForbiddenException(
          'External API integration requires Premium plan',
        );
      }

      for (const [originalKey, value] of Object.entries(
        createProjectDto.dataInfo,
      )) {
        const newEntryId = this.generateObjectId();
        processedDataInfo[newEntryId] = { [originalKey]: value };
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
    const limits = { default: 2, basic: 5, premium: 10, admin: Infinity };
    const limit = limits[plan] || limits.default;
    if (count >= limit) {
      throw new ConflictException(
        `Plan ${plan} allows up to ${limit} projects`,
      );
    }
  }

  async getFormattedProject(projectId: string) {
    const project = await this.validateProject(projectId);
    const dataInfo = project.dataInfo || {};
    const formattedData = {};
    const nameCounts = new Map<string, number>();

    for (const entryId of Object.keys(dataInfo)) {
      let entry = dataInfo[entryId];
      const processedEntry = await this.deepProcessApiIntegrations(entry);
      const { akashiObjectName, ...rest } = processedEntry;

      if (akashiObjectName) {
        const count = (nameCounts.get(akashiObjectName) || 0) + 1;
        nameCounts.set(akashiObjectName, count);
        const finalKey =
          count > 1 ? `${akashiObjectName} ${count}` : akashiObjectName;

        formattedData[finalKey] = rest;
      } else {
        // console.warn(`Entry ${entryId} is missing akashiObjectName`);
        formattedData[entryId] = rest;
      }
    }

    return {
      [project.name]: formattedData,
    };
  }

  private async deepProcessApiIntegrations(obj: any): Promise<any> {
    if (typeof obj !== 'object' || obj === null) return obj;

    const clonedObj = { ...obj };

    for (const [key, value] of Object.entries(clonedObj)) {
      clonedObj[key] = await this.deepProcessApiIntegrations(value);
    }

    if (this.isApiIntegrationObject(clonedObj)) {
      return this.processSingleApiIntegration(clonedObj);
    }

    return clonedObj;
  }

  private async processSingleApiIntegration(apiConfig: any) {
    try {
      const config = {
        headers: new AxiosHeaders(),
      };

      if (apiConfig.x_api_key) {
        config.headers.set('x-api-key', apiConfig.x_api_key);
      }

      const apiResponse = await axios.get(apiConfig.apiUrl, config);
      let dataReturn;

      if (apiConfig.JSONPath) {
        try {
          const results = jsonpath.query(apiResponse.data, apiConfig.JSONPath);
          dataReturn =
            results.length > 0
              ? results[0]
              : `No data found for JSONPath: "${apiConfig.JSONPath}"`;
        } catch (error) {
          dataReturn = `Invalid JSONPath: "${apiConfig.JSONPath}". Error: ${error.message}`;
        }
      } else {
        dataReturn = apiResponse.data;
      }

      return {
        ...apiConfig,
        dataReturn,
      };
    } catch (error) {
      console.error(`Error fetching API (${apiConfig.apiUrl}):`, error.message);
      return {
        ...apiConfig,
        dataReturn: `Error: ${error.message}`,
      };
    }
  }

  async getProjectDataInfo(projectId: string) {
    const project = await this.validateProject(projectId);
    const dataInfo = project.dataInfo || {};
    const processedDataInfo = { ...dataInfo };

    for (const [entryId, entry] of Object.entries(dataInfo)) {
      if (this.findApiIntegrationKey(entry)) {
        const processedEntry = await this.processApiIntegration(entry);

        if (processedEntry && typeof processedEntry === 'object') {
          for (const [key, value] of Object.entries(processedEntry)) {
            if (value && typeof value === 'object' && 'dataReturn' in value) {
              const { dataReturn, ...apiConfigOnly } = value;
              processedEntry[key] = apiConfigOnly;
            }
          }
        }

        processedDataInfo[entryId] = processedEntry;
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
    entryId: string,
    updateData: Record<string, any>,
  ) {
    try {
      if (!Types.ObjectId.isValid(projectId)) {
        throw new BadRequestException('Invalid project ID');
      }

      const project = await this.projectModel.findById(projectId);
      if (!project) throw new NotFoundException('Project not found');

      const dataInfo = project.dataInfo || {};
      if (!dataInfo[entryId]) {
        throw new NotFoundException('Entry not found with provided ID');
      }

      const isEmptyObject = Object.keys(updateData).length === 0;

      const updatedEntry = isEmptyObject ? {} : { ...updateData };

      if (
        dataInfo[entryId].apigatos &&
        this.isApiIntegrationObject(dataInfo[entryId].apigatos)
      ) {
        const {
          apiUrl,
          JSONPath,
          'x-api-key': xApiKey,
        } = dataInfo[entryId].apigatos;

        if (!updateData.apigatos) {
          updatedEntry.apigatos = {
            apiUrl,
            JSONPath,
            'x-api-key': xApiKey,
          };
        }
      }

      const updateObject = {};
      updateObject[`dataInfo.${entryId}`] = updateData || {};

      const updatedProject = await this.projectModel.findByIdAndUpdate(
        projectId,
        { $set: updateObject },
        { new: true },
      );

      return updatedProject;
    } catch (error) {
      console.error('Erro ao atualizar o projeto:', error);
      throw error;
    }
  }

  async addProjectDataEntry(
    projectId: string,
    newEntryData: Record<string, any>,
  ) {
    try {
      if (!Types.ObjectId.isValid(projectId)) {
        throw new BadRequestException('Invalid project ID');
      }

      // Primeiro verificamos se o projeto existe
      const project = await this.validateProject(projectId);
      const user = await this.userModel.findById(project.user);
      if (!user) throw new NotFoundException('User not found');

      const userPlan = user.plan ?? 'free';

      // Verificar se há integração de API externa no novo objeto
      const hasExternalApi = Object.values(newEntryData).some((value) => {
        if (typeof value !== 'object') return false;
        return Object.values(value).some((subValue) =>
          this.isApiIntegrationObject(subValue),
        );
      });

      if (hasExternalApi && !['premium', 'admin'].includes(userPlan)) {
        throw new ForbiddenException(
          'External API integration requires Premium plan',
        );
      }

      const newEntryId = this.generateObjectId();

      const updateObject = {};
      updateObject[`dataInfo.${newEntryId}`] = newEntryData;

      const updatedProject = await this.projectModel.findByIdAndUpdate(
        projectId,
        { $set: updateObject },
        { new: true },
      );

      if (!updatedProject) {
        throw new NotFoundException('Project not found');
      }

      return {
        entryId: newEntryId,
        entry: newEntryData,
        project: updatedProject,
      };
    } catch (error) {
      console.error('Erro ao adicionar entry ao projeto:', error);
      throw error;
    }
  }

  private async validateProject(projectId: string) {
    if (!Types.ObjectId.isValid(projectId)) {
      throw new BadRequestException('Invalid project ID');
    }
    const project = await this.projectModel.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async deleteProjectDataEntry(projectId: string, entryId: string) {
    try {
      if (!Types.ObjectId.isValid(projectId)) {
        throw new BadRequestException('Invalid project ID');
      }

      const project = await this.validateProject(projectId);

      if (!project.dataInfo || !project.dataInfo[entryId]) {
        throw new NotFoundException('Entry not found');
      }

      const updateObject = {};
      updateObject[`dataInfo.${entryId}`] = 1;

      const updatedProject = await this.projectModel.findByIdAndUpdate(
        projectId,
        { $unset: updateObject },
        { new: true },
      );

      if (!updatedProject) {
        throw new NotFoundException('Project not found');
      }

      return {
        message: 'Entry deleted successfully',
        entryId,
        project: updatedProject,
      };
    } catch (error) {
      console.error('Erro ao deletar entry do projeto:', error);
      throw error;
    }
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

    return projects.length ? projects : [];
  }
}
