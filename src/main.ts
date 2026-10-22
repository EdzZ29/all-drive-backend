import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { upgradeLegacySchema } from './database/legacy-upgrade';
import { shouldSynchronize } from './database/database.options';

async function bootstrap() {
  // Before TypeORM synchronizes the schema (see the function for why).
  if (shouldSynchronize((key) => process.env[key])) {
    await upgradeLegacySchema();
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve uploaded images at /uploads/<filename> (bypasses the /api prefix).
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Parse cookies so the auth guard can read the httpOnly access token.
  app.use(cookieParser());

  // CORS with credentials cannot use a wildcard origin — the browser rejects
  // it. Reflect the request origin (or set FRONTEND_URL) and allow cookies.
  // The public website talks to the backend server-to-server, so it needs no
  // CORS entry.
  const frontendUrl = process.env.FRONTEND_URL;
  app.enableCors({
    origin: frontendUrl ?? true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 5000;
  await app.listen(port);

  console.log(`Server running on http://localhost:${port}/api`);
}
bootstrap();
