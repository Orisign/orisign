export function setCookie(name: string, value: string, days = 7) {
	if (typeof document === 'undefined') return

	const expires = new Date(Date.now() + days * 864e5).toUTCString()

	document.cookie = `${name}=${encodeURIComponent(
		value
	)}; expires=${expires}; path=/`
}

export function getCookie(name: string) {
	if (typeof document === 'undefined') return null

	const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))

	return match ? decodeURIComponent(match[2]) : null
}

export function deleteCookie(name: string) {
	if (typeof document === 'undefined') return

	document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
}
