import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Subscription extends Document {
  @Prop({ required: true })
  email: string;

  @Prop({
    required: true,
    enum: ['basic', 'premium'],
  })
  plan: string;

  @Prop({ required: true })
  stripeSubscriptionId: string;

  @Prop({ required: true })
  endsAt: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
