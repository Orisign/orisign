import { FactoryProvider, ModuleMetadata } from '@nestjs/common'

import { SmsOptions } from './sms-options.type'

export interface SmsAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	useFactory: (...args: any[]) => Promise<SmsOptions> | SmsOptions
	inject?: FactoryProvider['inject']
}
