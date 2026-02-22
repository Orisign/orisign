import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumberString,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class VerifyOtpRequest {
  @ApiProperty({
    example: '+79001234567',
    description: 'Номер телефона, на который был отправлен OTP-код'
  })
  @IsString()
  @Matches(/^\+?\d{10,15}$/, { message: 'Введён некорректный номер телефона' })
  public phone: string;

  @ApiProperty({
    example: '123456',
    minLength: 6,
    maxLength: 6,
    description: 'Одноразовый 6-значный OTP-код'
  })
  @IsNumberString()
  @IsNotEmpty()
  @Length(6)
  public code: string;

  @ApiProperty({
    example: '59a43f03-4d56-4adc-aee2-20d9c5dcbf69',
    description: 'Уникальный идентификатор устройства клиента',
  })
  @IsString()
  public deviceId: string;
}
