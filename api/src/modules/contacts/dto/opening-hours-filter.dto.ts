import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { WEEKDAYS, type Weekday } from '../utils/opening-hours.utils';

/** Opening-hours filter shared by every contact filter surface (contacts, lists, audience stats, campaigns). */
export class OpeningHoursFilterDto {
    @ApiPropertyOptional({
        enum: WEEKDAYS,
        description: 'Only contacts that are open on this weekday (combine with open_from/open_to for a time range)',
    })
    @IsOptional()
    @IsIn(WEEKDAYS)
    open_day?: Weekday;

    @ApiPropertyOptional({
        example: '10:00',
        description:
            'HH:MM (24h). Only contacts open for the whole range open_from-open_to; with just one of the two, open at that time. Contacts without opening hours are excluded.',
    })
    @IsOptional()
    @Matches(/^([01]?\d|2[0-3]):[0-5]\d$/, { message: 'open_from must be HH:MM' })
    open_from?: string;

    @ApiPropertyOptional({ example: '12:00', description: 'HH:MM (24h); see open_from' })
    @IsOptional()
    @Matches(/^(([01]?\d|2[0-3]):[0-5]\d|24:00)$/, { message: 'open_to must be HH:MM' })
    open_to?: string;
}
