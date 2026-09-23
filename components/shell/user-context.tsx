"use client"

import { createContext, useContext } from "react"

export interface ShellUser {
  displayName: string
}

export const ShellUserContext = createContext<ShellUser | null>(null)

export function useShellUser() {
  return useContext(ShellUserContext)
}
