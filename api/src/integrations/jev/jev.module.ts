import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JevClient } from './jev.client';

@Module({
  imports: [ConfigModule],
  providers: [JevClient],
  exports: [JevClient],
})
export class JevClientModule {}
