import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator'

export class UpdateChatFolderRequestDto {
	@ApiPropertyOptional({
		description: 'Название папки',
		example: 'Избранные'
	})
	@IsOptional()
	@IsString()
	public name?: string

	@ApiPropertyOptional({ type: [String], example: ['chat_1', 'chat_2'] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	public includedChatIds?: string[]

	@ApiPropertyOptional({ type: [String], example: ['chat_3'] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	public excludedChatIds?: string[]

	@ApiPropertyOptional({ type: [String], example: ['contacts'] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	public includedTypes?: string[]

	@ApiPropertyOptional({ type: [String], example: ['read'] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	public excludedTypes?: string[]

	@ApiPropertyOptional({ example: 't.me/addlist/example' })
	@IsOptional()
	@IsString()
	public inviteLink?: string

	@ApiPropertyOptional({ example: 1 })
	@IsOptional()
	@IsInt()
	@Min(0)
	public sortOrder?: number
}
