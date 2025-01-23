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

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async createProject(userId: string, createProjectDto: CreateProjectDto) {
    // Validar se o userId é um ObjectId válido
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('ID de usuário inválido');
    }

    // Converter userId para ObjectId
    const userObjectId = new Types.ObjectId(userId);

    // Verificar se o usuário existe
    const userExists = await this.userModel.findById(userObjectId);
    if (!userExists) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Verificar se já existe um projeto para este usuário
    const existingProject = await this.projectModel.findOne({
      user: userObjectId,
    });
    if (existingProject) {
      throw new ConflictException('Usuário já possui um projeto cadastrado');
    }

    // Criar novo projeto
    const newProject = new this.projectModel({
      ...createProjectDto,
      user: userObjectId,
    });
    return await newProject.save();
  }
  async getProjectDataInfo(projectId: string) {
    if (!Types.ObjectId.isValid(projectId)) {
      throw new BadRequestException('ID de projeto inválido');
    }

    const project = await this.projectModel
      .findById(projectId)
      .select('dataInfo');

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
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

    const updatedProject = await this.projectModel.findByIdAndUpdate(
      projectId,
      { $set: updateProjectDto },
      { new: true, runValidators: true },
    );

    if (!updatedProject) {
      throw new NotFoundException('Projeto não encontrado');
    }

    return updatedProject;
  }

  async deleteProject(projectId: string) {
    if (!Types.ObjectId.isValid(projectId)) {
      throw new BadRequestException('ID de projeto inválido');
    }

    const deletedProject = await this.projectModel.findByIdAndDelete(projectId);

    if (!deletedProject) {
      throw new NotFoundException('Projeto não encontrado');
    }

    return { message: 'Projeto excluído com sucesso' };
  }
}
