import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './common/guards/auth.guard';
import { validate } from './config/env.validation';
import { ProjectsModule } from './modules/project/projects.module';
import { PaymentModule } from 'src/modules/payment/payment.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PingService } from './modules/health/ping.service';
import { HealthController } from 'src/modules/health/ping.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      validate,
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    ProjectsModule,
    PaymentModule,
  ],
  controllers: [HealthController],

  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    PingService,
  ],
})
export class AppModule {}
