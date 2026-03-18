import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsString } from 'class-validator'

export class ReorderChatFoldersRequestDto {
	@ApiProperty({
		type: [String],
		description: 'Порядок id папок сверху вниз',
		example: ['folder_a', 'folder_b', 'folder_c']
	})
	@IsArray()
	@IsString({ each: true })
	public folderIds: string[]
}
