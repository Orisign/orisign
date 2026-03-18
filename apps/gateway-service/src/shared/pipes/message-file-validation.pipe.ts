import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common'

@Injectable()
export class MessageFileValidationPipe implements PipeTransform {
	private readonly maxSizeInBytes = 1024 * 1024 * 1024
	private readonly allowedMimeTypes = new Set([
		'image/jpeg',
		'image/png',
		'image/webp',
		'image/gif',
		'image/avif',
		'video/mp4',
		'video/webm',
		'video/quicktime',
		'audio/mpeg',
		'audio/mp4',
		'audio/aac',
		'audio/ogg',
		'audio/wav',
		'audio/webm',
		'audio/opus',
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.ms-excel',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'application/zip',
		'application/x-zip-compressed',
		'text/plain'
	])

	public transform(
		value: Express.Multer.File | undefined
	): Express.Multer.File {
		if (!value) {
			throw new BadRequestException('Attachment file is required')
		}

		if (value.size > this.maxSizeInBytes) {
			throw new BadRequestException(
				'Attachment file must be less than 1GB'
			)
		}

		if (!this.allowedMimeTypes.has(value.mimetype)) {
			throw new BadRequestException('Unsupported attachment format')
		}

		return value
	}
}
