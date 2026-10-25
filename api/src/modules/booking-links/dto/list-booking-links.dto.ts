import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { QueryBooleanTransform } from '@/shared/transforms/query-boolean.transform';

export class ListBookingLinksDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    booking_page_uuid?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    contact_uuid?: string;

    @ApiPropertyOptional({ description: 'Only generic (non contact-specific) links' })
    @IsOptional()
    @QueryBooleanTransform
    @IsBoolean()
    generic_only?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @QueryBooleanTransform
    @IsBoolean()
    include_inactive?: boolean;
}
