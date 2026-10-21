import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Crowdfunding API')
    .setDescription('API para plataforma de crowdfunding')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Autenticación — login y verificación de token')
    .addTag('users', 'Gestión de usuarios — registro y consulta')
    .addTag('entrepreneur-profile', 'Gestión de perfil de emprendedor')
    .addTag('entrepreneur-campaigns', 'Campañas del emprendedor')
    .addTag('entrepreneur-finances', 'Seguimiento financiero')
    .addTag('investor-profile', 'Gestión de perfil de inversor')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Application running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
