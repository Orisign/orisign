'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { deleteCookie, getCookie, setCookie } from '@/lib/cookies'

import {
	authControllerRefresh,
	type AccountResponseDto,
	getAccountControllerMeQueryKey,
	useAccountControllerMe
} from '@/api/generated'
import { ApiError } from '@/lib/fetcher'

const ACCESS_TOKEN_COOKIE = 'accessToken'
const TOKEN_REFRESH_BEFORE_EXPIRY_MS = 30_000

let refreshInFlightPromise: Promise<string | null> | null = null

function parseJwtExpiresAt(token: string) {
	try {
		const [, payload = ''] = token.split('.')
		const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
		const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
		const parsed = JSON.parse(atob(padded)) as { exp?: unknown }

		if (typeof parsed.exp !== 'number' || !Number.isFinite(parsed.exp)) {
			return null
		}

		return parsed.exp * 1000
	} catch {
		return null
	}
}

function isTokenExpired(token: string, skewMs = 0) {
	const expiresAt = parseJwtExpiresAt(token)
	if (!expiresAt) return false
	return Date.now() >= expiresAt - skewMs
}

async function refreshAccessTokenOnce() {
	if (refreshInFlightPromise) {
		return refreshInFlightPromise
	}

	refreshInFlightPromise = (async () => {
		try {
			const response = await authControllerRefresh({
				credentials: 'include'
			})
			setCookie(ACCESS_TOKEN_COOKIE, response.accessToken)
			return response.accessToken
		} catch {
			deleteCookie(ACCESS_TOKEN_COOKIE)
			return null
		} finally {
			refreshInFlightPromise = null
		}
	})()

	return refreshInFlightPromise
}

type AuthStore = {
	isAuthenticated: boolean
	deviceId: string | null
	user: AccountResponseDto | null
	setAuthenticated: (value: boolean) => void
	setUser: (user: AccountResponseDto | null) => void
	ensureDeviceId: () => string
}

const useAuthStore = create<AuthStore>()(
	persist(
		(set, get) => ({
			isAuthenticated: false,
			deviceId: null,
			user: null,
			setAuthenticated: value => set({ isAuthenticated: value }),
			setUser: user => set({ user }),
			ensureDeviceId: () => {
				const existing = get().deviceId
				if (existing) return existing

				const next = crypto.randomUUID()

				set({ deviceId: next })
				return next
			}
		}),
		{
			name: 'auth-store',
			storage: createJSONStorage(() => localStorage),
			partialize: ({ isAuthenticated, deviceId, user }) => ({
				isAuthenticated,
				deviceId,
				user
			})
		}
	)
)

export function useAuth() {
	const {
		isAuthenticated,
		deviceId,
		user,
		setAuthenticated,
		setUser,
		ensureDeviceId
	} = useAuthStore()

	const [accessToken, setAccessToken] = useState<string | null>(() =>
		getCookie(ACCESS_TOKEN_COOKIE)
	)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const hasAttemptedInitialRefreshRef = useRef(false)
	const isRecoveringUnauthorizedRef = useRef(false)

	const syncAccessTokenFromCookie = useCallback(() => {
		const next = getCookie(ACCESS_TOKEN_COOKIE)
		setAccessToken(prev => (prev === next ? prev : next))
		return next
	}, [])

	const refreshAccessToken = useCallback(async () => {
		setIsRefreshing(true)
		try {
			const nextToken = await refreshAccessTokenOnce()
			setAccessToken(nextToken)
			return nextToken
		} finally {
			setIsRefreshing(false)
		}
	}, [])

	const logout = () => {
		deleteCookie(ACCESS_TOKEN_COOKIE)
		setAccessToken(null)
		setAuthenticated(false)
		setUser(null)
		window.location.assign('/auth')
	}

	const meQuery = useAccountControllerMe({
		query: {
			queryKey: getAccountControllerMeQueryKey(),
			retry: false,
			refetchOnWindowFocus: false,
			enabled: !!accessToken
		},
		request: {
			credentials: 'include'
		}
	})
	const {
		data: meData,
		error: meError,
		isError: isMeError,
		isLoading: isMeLoading,
		isSuccess: isMeSuccess,
		refetch: refetchMe
	} = meQuery

	useEffect(() => {
		ensureDeviceId()
	}, [ensureDeviceId])

	useEffect(() => {
		const token = syncAccessTokenFromCookie()

		if (hasAttemptedInitialRefreshRef.current) {
			return
		}

		hasAttemptedInitialRefreshRef.current = true

		if (!token || isTokenExpired(token, TOKEN_REFRESH_BEFORE_EXPIRY_MS)) {
			void refreshAccessToken()
		}
	}, [refreshAccessToken, syncAccessTokenFromCookie])

	useEffect(() => {
		const handleCookieChange = (
			event: Event & { detail?: { name?: string; value?: string | null } }
		) => {
			if (event.detail?.name !== ACCESS_TOKEN_COOKIE) return
			setAccessToken(event.detail.value ?? getCookie(ACCESS_TOKEN_COOKIE))
		}

		window.addEventListener('app:cookie-change', handleCookieChange as EventListener)
		return () =>
			window.removeEventListener(
				'app:cookie-change',
				handleCookieChange as EventListener
			)
	}, [])

	useEffect(() => {
		if (!accessToken) {
			return
		}

		const expiresAt = parseJwtExpiresAt(accessToken)
		if (!expiresAt) {
			return
		}

		const delay = Math.max(
			expiresAt - Date.now() - TOKEN_REFRESH_BEFORE_EXPIRY_MS,
			0
		)
		const timer = window.setTimeout(() => {
			void refreshAccessToken()
		}, delay)

		return () => {
			window.clearTimeout(timer)
		}
	}, [accessToken, refreshAccessToken])

	useEffect(() => {
		const refreshIfNeeded = () => {
			const token = getCookie(ACCESS_TOKEN_COOKIE)
			if (!token) return

			if (isTokenExpired(token, TOKEN_REFRESH_BEFORE_EXPIRY_MS)) {
				void refreshAccessToken()
			}
		}

		const handleVisibility = () => {
			if (document.visibilityState === 'visible') {
				refreshIfNeeded()
			}
		}

		window.addEventListener('focus', refreshIfNeeded)
		document.addEventListener('visibilitychange', handleVisibility)

		return () => {
			window.removeEventListener('focus', refreshIfNeeded)
			document.removeEventListener('visibilitychange', handleVisibility)
		}
	}, [refreshAccessToken])

	useEffect(() => {
		if (!accessToken) {
			setAuthenticated(false)
			setUser(null)
			return
		}

		if (isMeSuccess) {
			isRecoveringUnauthorizedRef.current = false
			setAuthenticated(true)
			setUser(meData)
			return
		}

		if (isMeError) {
			const isUnauthorized =
				meError instanceof ApiError && meError.status === 401

			if (isUnauthorized) {
				if (isRecoveringUnauthorizedRef.current) {
					return
				}

				isRecoveringUnauthorizedRef.current = true
				void (async () => {
					const refreshedToken = await refreshAccessToken()
					if (!refreshedToken) {
						isRecoveringUnauthorizedRef.current = false
						setAuthenticated(false)
						setUser(null)
						return
					}

					await refetchMe()
					isRecoveringUnauthorizedRef.current = false
				})()
				return
			}

			isRecoveringUnauthorizedRef.current = false
			setAuthenticated(false)
			setUser(null)
		}
	}, [
		isMeError,
		isMeSuccess,
		meData,
		meError,
		refetchMe,
		accessToken,
		refreshAccessToken,
		setAuthenticated,
		setUser
	])

	return {
		isAuthenticated,
		deviceId,
		user,
		ensureDeviceId,
		logout,
		isLoading: isMeLoading || isRefreshing,
		refetchMe
	}
}
