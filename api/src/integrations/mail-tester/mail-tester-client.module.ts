import { Module } from '@nestjs/common';
import { MailTesterClient } from './mail-tester.client';

@Module({
  providers: [MailTesterClient],
  exports: [MailTesterClient],
})
export class MailTesterClientModule {}
