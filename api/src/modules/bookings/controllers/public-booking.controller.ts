import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RateLimit } from '@/shared/decorators/rate-limit.decorator';
import { RateLimitGuard } from '@/shared/guards/rate-limit.guard';
import { PublicBookingService } from '../services/public-booking.service';
import { BookingRateLimits } from '../constants/booking.constants';
import { BookingSlotsQueryDto } from '../dto/booking-slots-query.dto';
import { PublicCancelBookingDto, PublicCreateBookingDto, PublicRescheduleBookingDto } from '../dto/public-booking.dto';

/** Unauthenticated booking pages. Booking links are addressed by short codes, managed bookings by secret tokens. */
@ApiTags('public-bookings')
@UseGuards(RateLimitGuard)
@Controller('public/bookings')
export class PublicBookingController {
    constructor(private readonly publicBookingService: PublicBookingService) {}

    @Get('pages/:code')
    @RateLimit(BookingRateLimits.view)
    @ApiOperation({ summary: 'Public booking page content' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Link inactive or unknown' })
    getPage(@Param('code') code: string) {
        return this.publicBookingService.getPage(code);
    }

    @Get('pages/:code/slots')
    @RateLimit(BookingRateLimits.slots)
    @ApiOperation({ summary: 'Available slots grouped by date in the visitor timezone' })
    @ApiResponse({ status: 200 })
    getSlots(@Param('code') code: string, @Query() query: BookingSlotsQueryDto) {
        return this.publicBookingService.getSlots(code, query);
    }

    @Post('pages/:code/book')
    @RateLimit(BookingRateLimits.book)
    @ApiOperation({ summary: 'Book a slot' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 409, description: 'The slot was just taken' })
    @ApiResponse({ status: 429, description: 'Too many attempts' })
    book(@Param('code') code: string, @Body() dto: PublicCreateBookingDto) {
        return this.publicBookingService.book(code, dto);
    }

    @Get('manage/:token')
    @RateLimit(BookingRateLimits.view)
    @ApiOperation({ summary: 'A booking as seen by its invitee, with what they may still change' })
    @ApiResponse({ status: 200 })
    getManage(@Param('token') token: string) {
        return this.publicBookingService.getManage(token);
    }

    @Get('manage/:token/slots')
    @RateLimit(BookingRateLimits.slots)
    @ApiOperation({ summary: 'Slots the invitee can move their booking to' })
    @ApiResponse({ status: 200 })
    getManageSlots(@Param('token') token: string, @Query() query: BookingSlotsQueryDto) {
        return this.publicBookingService.getManageSlots(token, query);
    }

    @Post('manage/:token/cancel')
    @RateLimit(BookingRateLimits.manage)
    @ApiOperation({ summary: 'Cancel the booking (within the page deadline)' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 403, description: 'Deadline passed or cancellation disabled' })
    cancel(@Param('token') token: string, @Body() dto: PublicCancelBookingDto) {
        return this.publicBookingService.cancel(token, dto);
    }

    @Post('manage/:token/reschedule')
    @RateLimit(BookingRateLimits.manage)
    @ApiOperation({ summary: 'Move the booking to another offered slot' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 409, description: 'The slot was just taken' })
    reschedule(@Param('token') token: string, @Body() dto: PublicRescheduleBookingDto) {
        return this.publicBookingService.reschedule(token, dto);
    }
}
