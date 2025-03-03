import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Subscription,
  SubscriptionSchema,
} from 'src/modules/payment/schemas/subscription.schema';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { AuthModule } from 'src/modules/auth/auth.module';
import {
  SessionToken,
  SessionTokenSchema,
} from 'src/modules/payment/schemas/sessionToken.schema';
import { User, UserSchema } from 'src/modules/auth/schemas/user.schema';
import { EmailService } from './providers/email.service';
import { StripeService } from './providers/stripe.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthModule,
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SessionToken.name, schema: SessionTokenSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, EmailService, StripeService],
})
export class PaymentModule {}
