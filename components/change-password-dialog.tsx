"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface ChangePasswordDialogProps {
  open: boolean
  onPasswordChanged: () => void
}

export function ChangePasswordDialog({ open, onPasswordChanged }: ChangePasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const validatePassword = (password: string): string[] => {
    const errors: string[] = []
    
    if (password.length < 8) {
      errors.push("Debe tener al menos 8 caracteres")
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("Debe incluir al menos una letra mayúscula")
    }
    if (!/[a-z]/.test(password)) {
      errors.push("Debe incluir al menos una letra minúscula")
    }
    if (!/[0-9]/.test(password)) {
      errors.push("Debe incluir al menos un número")
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push("Debe incluir al menos un carácter especial")
    }
    
    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess(false)

    // Validar contraseñas
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      setLoading(false)
      return
    }

    const passwordErrors = validatePassword(newPassword)
    if (passwordErrors.length > 0) {
      setError("La contraseña no cumple con los requisitos:\n" + passwordErrors.join("\n"))
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()

      // Cambiar la contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        throw updateError
      }

      // Marcar que el usuario ya no es de primer login
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ first_login: false })
        .eq('id', (await supabase.auth.getUser()).data.user?.id)

      if (profileError) {
        console.error('Error updating profile:', profileError)
        // No lanzamos error aquí porque el cambio de contraseña ya fue exitoso
      }

      setSuccess(true)
      
      // Esperar un momento para mostrar el mensaje de éxito
      setTimeout(() => {
        onPasswordChanged()
      }, 2000)

    } catch (error: any) {
      console.error('Error changing password:', error)
      setError(error.message || "Error al cambiar la contraseña")
    } finally {
      setLoading(false)
    }
  }

  const passwordErrors = newPassword ? validatePassword(newPassword) : []
  const isPasswordValid = passwordErrors.length === 0
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== ""

  if (success) {
    return (
      <Dialog open={open}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              ¡Contraseña Cambiada!
            </DialogTitle>
            <DialogDescription>
              Tu contraseña ha sido actualizada exitosamente. Ahora puedes acceder normalmente a tu cuenta.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <CheckCircle className="h-16 w-16 text-primary animate-pulse" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cambiar Contraseña</DialogTitle>
          <DialogDescription>
            Por seguridad, debes cambiar tu contraseña temporal antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nueva Contraseña</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Ingresa tu nueva contraseña"
                className={`pr-10 ${newPassword && !isPasswordValid ? 'border-destructive' : ''}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {/* Mostrar requisitos de contraseña */}
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">La contraseña debe cumplir:</p>
              <ul className="space-y-0.5 text-xs">
                {[
                  { check: newPassword.length >= 8, text: "Al menos 8 caracteres" },
                  { check: /[A-Z]/.test(newPassword), text: "Una letra mayúscula" },
                  { check: /[a-z]/.test(newPassword), text: "Una letra minúscula" },
                  { check: /[0-9]/.test(newPassword), text: "Un número" },
                  { check: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword), text: "Un carácter especial" },
                ].map((req, idx) => (
                  <li key={idx} className={`flex items-center gap-2 ${
                    newPassword === "" ? "text-muted-foreground" : 
                    req.check ? "text-primary" : "text-destructive"
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      newPassword === "" ? "bg-muted-foreground" :
                      req.check ? "bg-primary" : "bg-destructive"
                    }`} />
                    {req.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirma tu nueva contraseña"
                className={`pr-10 ${
                  confirmPassword && !passwordsMatch ? 'border-destructive' : 
                  confirmPassword && passwordsMatch ? 'border-primary' : ''
                }`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
            )}
            {confirmPassword && passwordsMatch && (
              <p className="text-xs text-primary">✓ Las contraseñas coinciden</p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button 
              type="submit" 
              disabled={loading || !isPasswordValid || !passwordsMatch}
              className="w-full"
            >
              {loading ? "Cambiando..." : "Cambiar Contraseña"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
