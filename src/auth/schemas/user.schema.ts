import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: false })
  password?: string;

  @Prop({ required: true })
  fullName: string;

  @Prop({ enum: ['local', 'google', 'github'], default: 'local' })
  provider: string;

  @Prop()
  providerId: string;

  @Prop()
  photo?: string;

  @Prop({ default: 'free' })
  plan?: 'free' | 'basic' | 'premium' | 'admin';

  @Prop({ default: 0 })
  tokenVersion: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
