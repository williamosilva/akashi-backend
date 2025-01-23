import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectsSchema } from './schemas/project.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectsSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
