import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { resolveCorsOrigins } from './common/utils/cors.util';
import { resolveTrustProxyHops } from './common/utils/trust-proxy.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', resolveTrustProxyHops());
  app.enableCors({ origin: resolveCorsOrigins() });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API is running on http://localhost:${port}`);
}

bootstrap();
