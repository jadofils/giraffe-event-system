import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class BookingDateDTO {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(23, { each: true })
  hours?: number[];
}

export class BookingDatesRequestDTO {
  @IsArray()
  dates!: BookingDateDTO[];
}
