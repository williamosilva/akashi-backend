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
import { CreateProjectDto } from './dto/project.dto';

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
}
