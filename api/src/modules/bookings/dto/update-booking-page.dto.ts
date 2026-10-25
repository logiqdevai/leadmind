import { PartialType } from '@nestjs/swagger';
import { CreateBookingPageDto } from './create-booking-page.dto';

export class UpdateBookingPageDto extends PartialType(CreateBookingPageDto) {}
