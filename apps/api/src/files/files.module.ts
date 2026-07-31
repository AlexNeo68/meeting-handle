import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { join, resolve } from 'node:path';
import { AuthModule } from '../auth/auth.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileTypeMimeDetector } from './mime-type-detector';
import { MIME_TYPE_DETECTOR, UPLOAD_DIR } from './files.constants';
import { multerDiskOptions } from './upload.options';

@Module({
  imports: [
    AuthModule,
    MulterModule.registerAsync({
      useFactory: () =>
        multerDiskOptions(resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'))),
    }),
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    {
      provide: UPLOAD_DIR,
      useValue: resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')),
    },
    {
      provide: MIME_TYPE_DETECTOR,
      useClass: FileTypeMimeDetector,
    },
  ],
})
export class FilesModule {}
