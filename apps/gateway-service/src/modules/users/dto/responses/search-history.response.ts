import { ApiProperty } from '@nestjs/swagger'

export class SearchHistoryEntryResponseDto {
	@ApiProperty({ example: 'cmmbf8h6m0004s4ur0xxr2n8v' })
	public id: string

	@ApiProperty({ example: 'cmm3fwmg50000p0ur3jrgls1c' })
	public userId: string

	@ApiProperty({ example: 'design docs' })
	public query: string

	@ApiProperty({ example: 1736150400000 })
	public createdAt: number

	@ApiProperty({ example: 1736236800000 })
	public updatedAt: number
}

export class SearchHistoryListResponseDto {
	@ApiProperty({ type: [SearchHistoryEntryResponseDto] })
	public entries: SearchHistoryEntryResponseDto[]
}

export class SearchHistorySingleResponseDto {
	@ApiProperty({ type: SearchHistoryEntryResponseDto })
	public entry: SearchHistoryEntryResponseDto
}
