import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as express from 'express';
import { AuthExceptionFilter } from './common/filters/auth.exception.filter';
import * as basicAuth from 'express-basic-auth';
import * as cors from 'cors';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const globalCorsOptions = {
    origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : [],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'stripe-signature',
      'Refresh-Token',
    ],
    exposedHeaders: [
      'Content-Type',
      'Authorization',
      'stripe-signature',
      'Refresh-Token',
    ],
    credentials: true,
  };

  app.use(
    cors((req: cors.CorsRequest, callback) => {
      const isSpecialRoute = (req as any).path.match(
        /\/projects\/[^/]+\/formatted$/,
      );

      if (isSpecialRoute) {
        callback(null, {
          origin: '*',
          methods: ['GET', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization'],
        });
      } else {
        callback(null, globalCorsOptions);
      }
    }),
  );

  app.useGlobalFilters(new AuthExceptionFilter());
  app.useGlobalPipes(new ValidationPipe());

  // app.enableCors({
  //   origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : [],
  //   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  //   allowedHeaders: [
  //     'Content-Type',
  //     'Authorization',
  //     'stripe-signature',
  //     'Refresh-Token',
  //   ],
  //   exposedHeaders: [
  //     'Content-Type',
  //     'Authorization',
  //     'stripe-signature',
  //     'Refresh-Token',
  //   ],
  //   credentials: true,
  // });

  app.use(
    express.json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(
    '/api',
    basicAuth({
      users: { admin: process.env.SWAGGER_PASSWORD || '' },
      challenge: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Akashi API')
    .setDescription(
      'Welcome to the Akashi API documentation! This API is responsible for creating and managing objects used in producing content for websites. It was developed with **NestJS**, has unit tests and uses **MongoDB** as the database.',
    )
    .setVersion('1.0')
    .setContact(
      'Desenvolvedor Akashi',
      'https://www.williamsilva.dev',
      'williamsilva20062005@gmail.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')

    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access-token',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Refresh-Token',
        description: 'Enter refresh JWT token',
        in: 'header',
      },
      'refresh-token',
    )

    .build();

  const document = SwaggerModule.createDocument(app, config);

  document.security = [
    {
      'access-token': [],
      'refresh-token': [],
      'secret-key': [],
    },
  ];

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      filter: true,
      showRequestDuration: true,
      persistAuthorization: true,
    },
    customSiteTitle: 'Akashi API Docs',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
