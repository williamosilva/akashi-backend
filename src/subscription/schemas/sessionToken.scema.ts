import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SessionTokenDocument = HydratedDocument<SessionToken>;

@Schema({ timestamps: true })
export class SessionToken {
  @Prop({ required: true, unique: true })
  token: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  planType: string;

  @Prop({
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  })
  status: string;

  @Prop()
  processedAt?: Date;
}

export const SessionTokenSchema = SchemaFactory.createForClass(SessionToken);
