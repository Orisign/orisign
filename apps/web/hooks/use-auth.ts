'use client'

import { useEffect } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { deleteCookie, getCookie } from '@/lib/cookies'

import {
	type AccountResponseDto,
	getAccountControllerMeQueryKey,
	useAccountControllerMe
} from '@/api/generated'

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

	const accessToken = getCookie('accessToken')

	const logout = () => {
		deleteCookie('accessToken')
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

	useEffect(() => {
		ensureDeviceId()
	}, [ensureDeviceId])

	useEffect(() => {
		if (!accessToken) {
			setAuthenticated(false)
			setUser(null)
			return
		}

		if (meQuery.isSuccess) {
			setAuthenticated(true)
			setUser(meQuery.data)
			return
		}

		if (meQuery.isError) {
			setAuthenticated(false)
			setUser(null)
		}
	}, [
		meQuery.isError,
		meQuery.isSuccess,
		meQuery.data,
		accessToken,
		setAuthenticated,
		setUser
	])

	return {
		isAuthenticated,
		deviceId,
		user,
		ensureDeviceId,
		logout,
		isLoading: meQuery.isLoading,
		refetchMe: meQuery.refetch
	}
}
