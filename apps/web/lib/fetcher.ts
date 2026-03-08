import { getCookie } from "./cookies"
import { parseJsonWithProtobufSupport } from "./protobuf"

export class ApiError<T = unknown> extends Error {
    constructor(
        public status: number,
        public body: T,
        message = `API error: ${status}`
    ) {
        super(message)
    }
}

export async function customFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers)
    const accessToken = getCookie('accessToken')

    if (accessToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${accessToken}`)
    }

    const res = await fetch(url, {
        credentials: 'include',
        ...options,
        headers
    })

    const text = await res.text()
    const body = text ? parseJsonWithProtobufSupport<T>(text) : undefined

    if (!res.ok) {
        throw new ApiError(res.status, body)
    }

    return body as T
}
