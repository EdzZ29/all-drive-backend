import { IsIn, IsOptional } from 'class-validator';

import { PageQueryDto } from '../../../common/pagination';

// Tabs of the admin inquiries list ("Open" = not closed yet).
export const INQUIRY_FILTERS = [
  'Open',
  'New',
  'Contacted',
  'Closed',
  'All',
] as const;
export type InquiryFilter = (typeof INQUIRY_FILTERS)[number];

export class InquiriesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(INQUIRY_FILTERS)
  filter?: InquiryFilter;
}
