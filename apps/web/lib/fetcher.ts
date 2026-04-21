import { getCookie } from "./cookies"
import { buildApiUrl, getApiBaseUrl } from "./app-config"
import { apiWsRequest } from "./api-ws"
import { parseJsonWithProtobufSupport } from "./protobuf"

const HTTP_ONLY_AUTH_POST_PATHS = new Set([
    '/auth/otp/send',
    '/auth/otp/verify',
    '/auth/refresh',
    '/auth/logout'
])

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
    const requestUrl = /^[a-z][a-z\d+\-.]*:/i.test(url) ? url : buildApiUrl(url)
    const method = (options.method ?? 'GET').toUpperCase()

    if (accessToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${accessToken}`)
    }

    if (shouldUseApiWs(requestUrl, method, options.body)) {
        const response = await apiWsRequest({
            method: 'POST',
            path: getApiWsPath(requestUrl),
            headers: headersToRecord(headers),
            bodyText: typeof options.body === 'string' ? options.body : undefined
        })
        const body = response.bodyText
            ? parseJsonWithProtobufSupport<T>(response.bodyText)
            : undefined

        if (!response.ok) {
            throw new ApiError(response.status, body)
        }

        return body as T
    }

    const res = await fetch(requestUrl, {
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

function shouldUseApiWs(
    requestUrl: string,
    method: string,
    body: BodyInit | null | undefined
) {
    if (typeof window === 'undefined') return false
    if (method !== 'POST') return false
    if (!isApiOrigin(requestUrl)) return false
    if (!isApiWsSerializableBody(body)) return false

    const pathname = new URL(requestUrl).pathname
    return !HTTP_ONLY_AUTH_POST_PATHS.has(pathname)
}

function isApiOrigin(requestUrl: string) {
    return new URL(requestUrl).origin === new URL(getApiBaseUrl()).origin
}

function isApiWsSerializableBody(body: BodyInit | null | undefined) {
    return body === undefined || body === null || typeof body === 'string'
}

function getApiWsPath(requestUrl: string) {
    const parsed = new URL(requestUrl)
    return `${parsed.pathname}${parsed.search}`
}

function headersToRecord(headers: Headers) {
    const record: Record<string, string> = {}

    headers.forEach((value, key) => {
        if (key === 'cookie' || key === 'host' || key === 'content-length') {
            return
        }

        record[key] = value
    })

    return record
}
