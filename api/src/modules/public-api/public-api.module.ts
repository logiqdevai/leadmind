import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { ContactsModule } from '@/modules/contacts/contacts.module';
import { ContactListsModule } from '@/modules/contact-lists/contact-lists.module';
import { RemindersModule } from '@/modules/reminders/reminders.module';
import { FormsModule } from '@/modules/forms/forms.module';
import { OutreachModule } from '@/modules/outreach/outreach.module';
import { PublicContactsController } from './contacts/public-contacts.controller';
import { PublicContactListsController } from './contact-lists/public-contact-lists.controller';
import { PublicRemindersController } from './reminders/public-reminders.controller';
import { PublicFormsController } from './forms/public-forms.controller';
import { PublicFormFieldsController } from './forms/public-form-fields.controller';
import { PublicFormCompletionsController } from './forms/public-form-completions.controller';
import { PublicOutreachController } from './outreach/public-outreach.controller';

@Module({
    imports: [
        PrismaModule,
        ContactsModule,
        ContactListsModule,
        RemindersModule,
        FormsModule,
        OutreachModule,
    ],
    controllers: [
        PublicContactsController,
        PublicContactListsController,
        PublicRemindersController,
        PublicFormsController,
        PublicFormFieldsController,
        PublicFormCompletionsController,
        PublicOutreachController,
    ],
})
export class PublicApiModule {}
