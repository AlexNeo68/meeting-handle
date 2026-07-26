import { IsArray, IsDateString, IsString } from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  title: string;

  @IsDateString()
  date: string;

  @IsArray()
  @IsString({ each: true })
  participants: string[];
}
