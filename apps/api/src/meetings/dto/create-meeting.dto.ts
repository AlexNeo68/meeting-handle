import { IsArray, IsDateString, IsString, MaxLength, ArrayMaxSize } from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsDateString()
  date: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  participants: string[];
}
