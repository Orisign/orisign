import { ApiPropertyOptional } from '@nestjs/swagger'
import {
	IsArray,
	IsDateString,
	IsOptional,
	IsString,
	Matches,
	MinLength
} from 'class-validator'

export class PatchUserRequestDto {
	@ApiPropertyOptional({
		example: 'vllad',
		description: 'Новый username'
	})
	@IsOptional()
	@IsString()
	@MinLength(3)
	@Matches(/^[A-Za-z0-9_]+$/, {
		message: 'Username может содержать только английские буквы, цифры и _'
	})
	public username?: string

	@ApiPropertyOptional({
		example: 'Vlad',
		description: 'Имя'
	})
	@IsOptional()
	@IsString()
	public firstName?: string

	@ApiPropertyOptional({
		example: 'Ivanov',
		description: 'Фамилия'
	})
	@IsOptional()
	@IsString()
	public lastName?: string

	@ApiPropertyOptional({
		example: 'Backend engineer from Novosibirsk',
		description: 'О себе'
	})
	@IsOptional()
	@IsString()
	public bio?: string

	@ApiPropertyOptional({
		type: [String],
		example: ['https://cdn.example.com/avatar.jpg'],
		description: 'Ссылки на аватары пользователя'
	})
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	public avatars?: string[]

	@ApiPropertyOptional({
		example: '1998-01-20T00:00:00.000Z',
		description: 'Дата рождения в ISO-формате'
	})
	@IsOptional()
	@IsDateString()
	public birthDate?: string
}
