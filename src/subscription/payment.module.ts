import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Subscription,
  SubscriptionSchema,
} from './schemas/subscription.schema';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { AuthModule } from '../auth/auth.module';
import { SessionToken, SessionTokenSchema } from './schemas/sessionToken.scema';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthModule,
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SessionToken.name, schema: SessionTokenSchema },
    ]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, ConfigService],
})
export class PaymentModule {}
