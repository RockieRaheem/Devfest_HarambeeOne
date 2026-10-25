import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Legacy NestJS bootstrap retained for migration reference.
// The root development command and new operational workflows use apps/backend.
async function bootstrap(){
 const app=await NestFactory.create(AppModule);
 app.setGlobalPrefix('api/v1');
 app.enableCors({origin:true,credentials:true});
 app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));
 await app.listen(process.env.PORT || 4000);
}
bootstrap();
