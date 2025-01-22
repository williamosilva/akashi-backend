import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Project extends Document {
  //   @Prop({ required: true, unique: true })
  //   email: string;
  //   @Prop({ required: true })
  //   password: string;
  //   @Prop({ required: true })
  //   fullName: string;
}

export const ProjectsSchema = SchemaFactory.createForClass(Project);
