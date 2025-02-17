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

  async createProject(userId: string, createProjectDto: CreateProjectDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const userObjectId = new Types.ObjectId(userId);

    const user = await this.userModel.findById(userObjectId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingProjectsCount = await this.projectModel.countDocuments({
      user: userObjectId,
    });

    switch (user.plan) {
      case 'admin':
        break;
      case 'basic':
        if (existingProjectsCount >= 5) {
          throw new ConflictException('Pro users can create up to 5 projects');
        }
        break;
      case 'premium':
        if (existingProjectsCount >= 10) {
          throw new ConflictException(
            'Premium users can create up to 10 projects',
          );
        }
        break;
      default:
        if (existingProjectsCount >= 1) {
          throw new ConflictException('Free users can only create 1 project');
        }
    }

    if (createProjectDto.dataInfo) {
      const hasExternalApi = Object.values(createProjectDto.dataInfo).some(
        (value) => typeof value === 'object' && value.apiUrl,
      );

      if (hasExternalApi && user.plan !== 'premium' && user.plan !== 'admin') {
        throw new ForbiddenException(
          'External API integration is only available for Premium users',
        );
      }

      if (
        (user.plan === 'premium' || user.plan === 'admin') &&
        hasExternalApi
      ) {
        for (const [key, value] of Object.entries(createProjectDto.dataInfo)) {
          if (typeof value === 'object' && value.apiUrl) {
            try {
              const apiKeyEntry = Object.entries(value).find(
                ([k]) => !['apiUrl', 'JSONPath', 'dataReturn'].includes(k),
              );

              const headers = new AxiosHeaders();
              if (apiKeyEntry) {
                headers.set(apiKeyEntry[0], String(apiKeyEntry[1]));
              }

              const apiResponse = await axios.get(value.apiUrl, { headers });
              let dataReturn;

              if (value.JSONPath) {
                try {
                  const results = jsonpath.query(
                    apiResponse.data,
                    value.JSONPath,
                  );
                  dataReturn =
                    results.length > 0
                      ? results[0]
                      : `No data found for JSONPath expression: "${value.JSONPath}"`;
                } catch (jsonPathError) {
                  dataReturn = `Invalid JSONPath expression: "${value.JSONPath}". Error: ${jsonPathError.message}`;
                }
              } else {
                dataReturn = apiResponse.data;
              }

              createProjectDto.dataInfo[key] = {
                ...value,
                dataReturn,
              };
            } catch (error) {
              console.error(
                `Error fetching data from API (${value.apiUrl}):`,
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
        if (typeof value === 'object' && value.apiUrl) {
          try {
            const apiKeyEntry = Object.entries(value).find(
              ([k]) => !['apiUrl', 'JSONPath', 'dataReturn'].includes(k),
            );

            const headers = new AxiosHeaders();
            if (apiKeyEntry) {
              headers.set(apiKeyEntry[0], String(apiKeyEntry[1]));
            }

            const apiResponse = await axios.get(value.apiUrl, { headers });
            let dataReturn;

            if (value.JSONPath) {
              try {
                const results = jsonpath.query(
                  apiResponse.data,
                  value.JSONPath,
                );
                dataReturn =
                  results.length > 0
                    ? results[0]
                    : `No data found for JSONPath expression: "${value.JSONPath}"`;
              } catch (jsonPathError) {
                dataReturn = `Invalid JSONPath expression: "${value.JSONPath}". Error: ${jsonPathError.message}`;
              }
            } else {
              dataReturn = apiResponse.data;
            }

            project.dataInfo[key] = {
              ...value,
              dataReturn,
            };
          } catch (error) {
            console.error(
              `Error fetching data from API (${value.apiUrl}):`,
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
        if (typeof value === 'object' && value.apiUrl) {
          try {
            const apiKeyEntry = Object.entries(value).find(
              ([k]) => !['apiUrl', 'JSONPath', 'dataReturn'].includes(k),
            );

            const headers = new AxiosHeaders();
            if (apiKeyEntry) {
              headers.set(apiKeyEntry[0], String(apiKeyEntry[1]));
            }

            const apiResponse = await axios.get(value.apiUrl, { headers });
            let dataReturn;

            if (value.JSONPath) {
              try {
                const results = jsonpath.query(
                  apiResponse.data,
                  value.JSONPath,
                );
                dataReturn =
                  results.length > 0
                    ? results[0]
                    : `No data found for JSONPath expression: "${value.JSONPath}"`;
              } catch (jsonPathError) {
                dataReturn = `Invalid JSONPath expression: "${value.JSONPath}". Error: ${jsonPathError.message}`;
              }
            } else {
              dataReturn = apiResponse.data;
            }

            updateProjectDto.dataInfo[key] = {
              ...value,
              dataReturn,
            };
          } catch (error) {
            console.error(
              `Error fetching data from API (${value.apiUrl}):`,
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

    const projects = await this.projectModel.find({ user: userObjectId });

    if (!projects.length) {
      throw new NotFoundException('No projects found for this user');
    }

    return projects;
  }
}
