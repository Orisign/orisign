import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common'

@Injectable()
export class FileValidationPipe implements PipeTransform {
	private readonly maxSizeInBytes = 5 * 1024 * 1024
	private readonly allowedMimeTypes = new Set([
		'image/jpeg',
		'image/png',
		'image/webp'
	])

	public transform(
		value: Express.Multer.File | undefined
	): Express.Multer.File {
		if (!value) {
			throw new BadRequestException('Avatar file is required')
		}

		if (value.size > this.maxSizeInBytes) {
			throw new BadRequestException('Avatar file must be less than 5MB')
		}

		if (!this.allowedMimeTypes.has(value.mimetype)) {
			throw new BadRequestException(
				'Unsupported avatar format. Allowed: jpeg, png, webp'
			)
		}

		return value
	}
}
