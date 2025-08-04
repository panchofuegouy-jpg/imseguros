"use client"

import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/auth'

export function useFirstLogin() {
  const [isFirstLogin, setIsFirstLogin] = useState<boolean | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkFirstLogin() {
      try {
        const userData = await getCurrentUser()
        
        if (userData?.profile) {
          const { role, first_login } = userData.profile
          setIsClient(role === 'client')
          setIsFirstLogin(first_login === true)
        } else {
          setIsClient(false)
          setIsFirstLogin(false)
        }
      } catch (error) {
        console.error('Error checking first login status:', error)
        setIsClient(false)
        setIsFirstLogin(false)
      } finally {
        setLoading(false)
      }
    }

    checkFirstLogin()
  }, [])

  const markPasswordChanged = () => {
    setIsFirstLogin(false)
  }

  return {
    isFirstLogin,
    isClient,
    loading,
    needsPasswordChange: isClient && isFirstLogin,
    markPasswordChanged
  }
}
