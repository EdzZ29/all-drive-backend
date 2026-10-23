import { IsIn, IsOptional } from 'class-validator';

import { PageQueryDto } from '../../../common/pagination';

// Tabs of the admin bookings list.
export const BOOKING_FILTERS = ['Pending', 'Active', 'History', 'All'] as const;
export type BookingFilter = (typeof BOOKING_FILTERS)[number];

export class BookingsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(BOOKING_FILTERS)
  filter?: BookingFilter;
}
