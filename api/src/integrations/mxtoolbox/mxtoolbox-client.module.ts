import { Module } from '@nestjs/common';
import { MxToolboxClient } from './mxtoolbox.client';

@Module({
  providers: [MxToolboxClient],
  exports: [MxToolboxClient],
})
export class MxToolboxClientModule {}
