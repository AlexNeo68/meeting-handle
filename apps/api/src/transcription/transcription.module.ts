import { forwardRef, Module } from '@nestjs/common';
import { join, resolve } from 'node:path';
import { FilesModule } from '../files/files.module';
import { UPLOAD_DIR } from '../files/files.constants';
import { StoragePathService } from '../files/storage-path.service';
import { WHISPER_ENGINE } from './transcription.constants';
import { TranscriptionController } from './transcription.controller';
import { TranscriptionService } from './transcription.service';
import { WhisperCppEngine } from './whisper-engine';

@Module({
  imports: [forwardRef(() => FilesModule)],
  controllers: [TranscriptionController],
  providers: [
    TranscriptionService,
    StoragePathService,
    {
      provide: UPLOAD_DIR,
      useValue: resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')),
    },
    {
      provide: WHISPER_ENGINE,
      useClass: WhisperCppEngine,
    },
  ],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}
