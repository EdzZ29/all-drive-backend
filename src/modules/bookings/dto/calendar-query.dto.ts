import { Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ?from=2026-09-27&to=2026-11-07: the days a calendar view shows.
export class CalendarQueryDto {
  @Matches(DATE, { message: 'from must be a YYYY-MM-DD date' })
  from!: string;

  @Matches(DATE, { message: 'to must be a YYYY-MM-DD date' })
  to!: string;
}
