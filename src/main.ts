import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.enableCors({
    origin: ['http://localhost:3000', process.env.FRONTEND_URL],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'stripe-signature',
      'x-secret-key',
      'Refresh-Token',
    ],
    credentials: true,
  });

  app.use(
    express.json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      },
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
    // Adiciona configurações de autenticação
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
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-secret-key',
        in: 'header',
        description: 'Enter secret key',
      },
      'secret-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Configuração de segurança global para todos os endpoints no Swagger
  const securitySchemes = {
    'access-token': {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    'refresh-token': {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    'secret-key': {
      type: 'apiKey',
      name: 'x-secret-key',
      in: 'header',
    },
  };

  // Aplicar requisitos de segurança para todas as rotas
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
  console.log(`🚀 Server running on http://localhost:${port}`);
}

bootstrap();
