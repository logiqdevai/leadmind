import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { BookingSource, BookingStatus } from '@/generated/prisma';

const toArray = ({ value }: { value: unknown }) =>
    value === undefined || value === '' ? undefined : Array.isArray(value) ? value : String(value).split(',');

export class BookingFiltersDto {
    @ApiPropertyOptional({ description: 'ISO 8601 - bookings starting at or after' })
    @IsOptional()
    @IsDateString()
    from?: string;

    @ApiPropertyOptional({ description: 'ISO 8601 - bookings starting before' })
    @IsOptional()
    @IsDateString()
    to?: string;

    @ApiPropertyOptional({ enum: BookingStatus, isArray: true, description: 'Comma separated' })
    @IsOptional()
    @Transform(toArray)
    @IsArray()
    @IsEnum(BookingStatus, { each: true })
    status?: BookingStatus[];

    @ApiPropertyOptional({ format: 'uuid', description: 'Team member; "unassigned" for bookings without one' })
    @IsOptional()
    @IsString()
    assigned_user_uuid?: string;

    @ApiPropertyOptional({ format: 'uuid', description: 'Booking page (booking type)' })
    @IsOptional()
    @IsUUID()
    booking_page_uuid?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    contact_uuid?: string;

    @ApiPropertyOptional({ enum: BookingSource })
    @IsOptional()
    @IsEnum(BookingSource)
    source?: BookingSource;

    @ApiPropertyOptional({ description: 'Invitee name, email or phone' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    search?: string;
}

export class ListBookingsDto extends BookingFiltersDto {
    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 25, maximum: 200 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit?: number = 25;

    @ApiPropertyOptional({ enum: ['start_at', 'created_at'], default: 'start_at' })
    @IsOptional()
    @IsIn(['start_at', 'created_at'])
    order_by?: 'start_at' | 'created_at' = 'start_at';

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    order_direction?: 'asc' | 'desc' = 'asc';
}
