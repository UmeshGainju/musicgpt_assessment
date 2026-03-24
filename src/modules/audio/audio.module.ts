import { Module } from '@nestjs/common';
import { AUDIO_REPOSITORY } from './interfaces/audio-repository.interface';
import { AudioRepository } from './audio.repository';
import { AudioService } from './audio.service';
import { AudioController } from './audio.controller';

@Module({
  controllers: [AudioController],
  providers: [
    AudioService,
    {
      provide: AUDIO_REPOSITORY,
      useClass: AudioRepository,
    },
  ],
  exports: [AudioService, AUDIO_REPOSITORY],
})
export class AudioModule {}
