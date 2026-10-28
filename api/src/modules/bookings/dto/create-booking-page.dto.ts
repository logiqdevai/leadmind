import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsEmail,
    IsEnum,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    IsUrl,
    IsUUID,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from 'class-validator';
import { BookingAssignmentMode, BookingLocationType, BookingUnavailableSlotsMode } from '@/generated/prisma';

export const BOOKING_QUESTION_TYPES = ['TEXT', 'TEXTAREA', 'SELECT', 'CHECKBOX'] as const;

export class BookingQuestionDto {
    @ApiProperty({ description: 'Stable id used as the answers key', example: 'company_size' })
    @Matches(/^[a-z0-9_]{1,40}$/, { message: 'question id must be lowercase letters, digits or _' })
    id: string;

    @ApiProperty({ maxLength: 200 })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    label: string;

    @ApiProperty({ enum: BOOKING_QUESTION_TYPES })
    @IsIn(BOOKING_QUESTION_TYPES)
    type: (typeof BOOKING_QUESTION_TYPES)[number];

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    required?: boolean;

    @ApiPropertyOptional({ type: [String], description: 'Choices for SELECT questions' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    options?: string[];
}

export class BookingPageMemberDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    user_uuid: string;

    @ApiPropertyOptional({ default: 0, description: 'Higher wins ties during automatic assignment' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(100)
    priority?: number;
}

export class CreateBookingPageDto {
    @ApiProperty({ maxLength: 120, example: 'Sales call' })
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name: string;

    @ApiPropertyOptional({ description: 'URL-friendly identifier, unique per organisation; derived from name when omitted' })
    @IsOptional()
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug may contain lowercase letters, digits and dashes' })
    @MaxLength(60)
    slug?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiPropertyOptional({ description: 'Page used for {{booking_link}} when a template/step picks none' })
    @IsOptional()
    @IsBoolean()
    is_default?: boolean;

    // Public page content & branding
    @ApiPropertyOptional({ maxLength: 160 }) @IsOptional() @IsString() @MaxLength(160) title?: string;
    @ApiPropertyOptional({ maxLength: 5000 }) @IsOptional() @IsString() @MaxLength(5000) description?: string;
    @ApiPropertyOptional({ maxLength: 5000 }) @IsOptional() @IsString() @MaxLength(5000) intro_text?: string;

    @ApiPropertyOptional({ type: [String], description: '"What to expect" points shown on the public page' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(8)
    @IsString({ each: true })
    @MinLength(1, { each: true })
    @MaxLength(120, { each: true })
    expectations?: string[];

    @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @IsString() @MaxLength(120) brand_name?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
    @MaxLength(1000)
    logo_url?: string;

    @ApiPropertyOptional({ example: '#2563eb' })
    @IsOptional()
    @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'primary_color must be a #RRGGBB colour' })
    primary_color?: string;

    @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) confirmation_message?: string;

    @ApiPropertyOptional({ description: 'Redirect invitees here after booking' })
    @IsOptional()
    @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
    @MaxLength(1000)
    redirect_url?: string;

    @ApiPropertyOptional({ maxLength: 60, description: 'Button label used for the appended email CTA' })
    @IsOptional()
    @IsString()
    @MaxLength(60)
    cta_label?: string;

    @ApiPropertyOptional() @IsOptional() @IsBoolean() show_team_member?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() show_timezone?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() require_phone?: boolean;

    @ApiPropertyOptional({ type: [BookingQuestionDto] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => BookingQuestionDto)
    questions?: BookingQuestionDto[];

    // Scheduling rules
    @ApiPropertyOptional({ default: 30 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(5)
    @Max(720)
    duration_minutes?: number;

    @ApiPropertyOptional({ type: [Number], description: 'Additional durations the invitee may pick' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(8)
    @IsInt({ each: true })
    @Min(5, { each: true })
    @Max(720, { each: true })
    duration_options?: number[];

    @ApiPropertyOptional({ nullable: true, description: 'Minutes between offered start times; null = duration' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(5)
    @Max(720)
    slot_interval_minutes?: number | null;

    @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60 * 24 * 30) min_notice_minutes?: number;
    @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(730) max_advance_days?: number;
    @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(240) buffer_before_minutes?: number;
    @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(240) buffer_after_minutes?: number;
    @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(720) min_gap_minutes?: number;

    @ApiPropertyOptional({ nullable: true })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(720)
    max_gap_minutes?: number | null;

    @ApiPropertyOptional({ nullable: true })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    max_bookings_per_day?: number | null;

    @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) seats_per_slot?: number;

    @ApiPropertyOptional({ enum: BookingAssignmentMode })
    @IsOptional()
    @IsEnum(BookingAssignmentMode)
    assignment_mode?: BookingAssignmentMode;

    @ApiPropertyOptional({ description: 'Let invitees pick the team member (off by default)' })
    @IsOptional()
    @IsBoolean()
    allow_invitee_member_choice?: boolean;

    @ApiPropertyOptional({
        enum: BookingUnavailableSlotsMode,
        description: 'HIDE (default) drops unbookable times; SHOW_DISABLED lists them greyed out on public pages',
    })
    @IsOptional()
    @IsEnum(BookingUnavailableSlotsMode)
    unavailable_slots_mode?: BookingUnavailableSlotsMode;

    @ApiPropertyOptional({ description: 'Invitee bookings start as PENDING until confirmed internally' })
    @IsOptional()
    @IsBoolean()
    requires_confirmation?: boolean;

    @ApiPropertyOptional({
        default: true,
        description: 'When a booking is marked completed, log a meeting with outcome COMPLETED on its contact',
    })
    @IsOptional()
    @IsBoolean()
    auto_log_meeting?: boolean;

    @ApiPropertyOptional({ type: [BookingPageMemberDto], description: 'Eligible team members; defaults to the creator' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => BookingPageMemberDto)
    members?: BookingPageMemberDto[];

    // Location
    @ApiPropertyOptional({ enum: BookingLocationType })
    @IsOptional()
    @IsEnum(BookingLocationType)
    location_type?: BookingLocationType;

    @ApiPropertyOptional({ maxLength: 500, description: 'Address, phone number or custom details' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    location_value?: string;

    // Cancellation & rescheduling
    @ApiPropertyOptional() @IsOptional() @IsBoolean() allow_cancellation?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() allow_reschedule?: boolean;
    @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60 * 24 * 30) cancellation_deadline_minutes?: number;
    @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60 * 24 * 30) reschedule_deadline_minutes?: number;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() require_cancellation_reason?: boolean;

    // Notifications
    @ApiPropertyOptional() @IsOptional() @IsBoolean() send_confirmation_email?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() send_reminder_emails?: boolean;

    @ApiPropertyOptional({ type: [Number], example: [1440, 60], description: 'Minutes before the start to send reminders' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(6)
    @IsInt({ each: true })
    @Min(5, { each: true })
    @Max(60 * 24 * 14, { each: true })
    reminder_offsets_minutes?: number[];

    @ApiPropertyOptional() @IsOptional() @IsBoolean() send_cancellation_email?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() send_reschedule_email?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() notify_assignee?: boolean;

    @ApiPropertyOptional({ type: [String], description: 'Internal addresses copied on booking notifications' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10)
    @IsEmail({}, { each: true })
    additional_recipients?: string[];

    @ApiPropertyOptional() @IsOptional() @IsBoolean() include_meeting_link?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() include_calendar_details?: boolean;

    @ApiPropertyOptional({ description: "Create a Meeting reminder on the contact's Reminders for confirmed bookings" })
    @IsOptional()
    @IsBoolean()
    create_team_reminder?: boolean;

    @ApiPropertyOptional({ description: 'Minutes before the start the team reminder is due', default: 60 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(5)
    @Max(60 * 24 * 14)
    team_reminder_offset_minutes?: number;

    @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() confirmation_template_uuid?: string | null;
    @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() reminder_template_uuid?: string | null;
    @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() cancellation_template_uuid?: string | null;
    @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() reschedule_template_uuid?: string | null;

    @ApiPropertyOptional({ maxLength: 200, description: 'Supports booking variables' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    calendar_event_title?: string;

    @ApiPropertyOptional({ maxLength: 5000, description: 'Supports booking variables' })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    calendar_event_description?: string;
}
