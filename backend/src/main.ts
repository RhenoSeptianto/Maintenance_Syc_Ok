import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const originsEnv = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const defaultOrigins = ['http://localhost:3012', 'http://127.0.0.1:3012', 'http://frontend:3002'];
  const origins = (originsEnv.length > 0 ? originsEnv : defaultOrigins);
  const allowAll = origins.includes('*');
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      try {
        if (allowAll) return cb(null, true);
        const ok = origins.some(o => o === origin);
        cb(ok ? null : new Error('CORS blocked'), ok);
      } catch {
        cb(null, false);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    exposedHeaders: ['Content-Disposition','content-disposition'],
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } } as any));
  const bodyLimit = process.env.BODY_LIMIT || '5mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const port = Number(process.env.PORT) || 4010;
  await app.listen(port);
}
bootstrap();
