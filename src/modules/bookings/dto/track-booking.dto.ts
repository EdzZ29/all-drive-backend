import { IsString, Length } from 'class-validator';

// "Track my booking" on the website: the booking code plus the email or mobile
// number the customer booked with.
export class TrackBookingDto {
  @IsString()
  @Length(4, 30)
  reference!: string;

  @IsString()
  @Length(3, 120)
  contact!: string;
}
