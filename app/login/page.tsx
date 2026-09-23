"use client"

import React from "react"
import { AuthFrame } from "@/components/brand/auth-frame"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn, signInWithMagicLink } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wand2 } from "lucide-react"

/** Los errores de Supabase llegan en inglés y en lenguaje técnico. */
function friendlyAuthError(message: string) {
  const text = message.toLowerCase()
  if (text.includes("invalid login credentials")) return "El email o la contraseña no coinciden. Revisalos y probá de nuevo."
  if (text.includes("email not confirmed")) return "Todavía no confirmaste tu email. Buscá el correo de bienvenida."
  if (text.includes("rate limit") || text.includes("too many")) return "Hubo demasiados intentos. Esperá un minuto y probá otra vez."
  if (text.includes("network") || text.includes("fetch")) return "No hay conexión. Revisá internet y probá de nuevo."
  return message
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccessMessage("")

    console.log("Attempting sign in...");
    const { data, error } = await signIn(email, password);
    console.log("signIn function returned:", { data, error });

    if (error) {
      setError(friendlyAuthError(error.message));
      setLoading(false);
      return;
    }

    // Redirect based on user role - let middleware handle the role-based routing
    if (data.user && data.profile) {
      console.log("User data after signIn:", data.user);
      console.log("User profile after signIn:", data.profile);

      if (data.profile.role === "admin") {
        console.log("Login successful, redirecting to /admin");
        router.push("/admin");
      } else if (data.profile.role === "client") {
        console.log("Login successful, redirecting to /dashboard");
        router.push("/dashboard");
      } else {
        // Fallback for unknown roles or if profile.role is missing
        console.log("Login successful, but unknown role. Redirecting to / (home)");
        router.push("/");
      }
    } else {
      // This case should ideally not be reached if signIn returns user and profile
      console.log("Login successful, but no user or profile data. Redirecting to / (home)");
      router.push("/");
    }
    setLoading(false); // Ensure loading is set to false after redirection attempt
  }

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault() // Prevent form submission if wrapped in form
    if (!email) {
      setError("Escribí tu email para recibir el enlace.")
      return
    }

    setMagicLinkLoading(true)
    setError("")
    setSuccessMessage("")

    const { error } = await signInWithMagicLink(email)

    if (error) {
      setError(friendlyAuthError(error.message))
    } else {
      setSuccessMessage("Listo. Revisá tu correo y tocá el enlace para entrar.")
    }
    setMagicLinkLoading(false)
  }

  const clearMessages = () => {
    setError("")
    setSuccessMessage("")
  }

  return (
    <AuthFrame>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Ingresar</CardTitle>
          <CardDescription>Entrá con tu email y tu contraseña.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="password" className="w-full" onValueChange={clearMessages}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="password">Contraseña</TabsTrigger>
              <TabsTrigger value="magic-link">Sin contraseña</TabsTrigger>
            </TabsList>

            <TabsContent value="password">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-password">Email</Label>
                  <Input
                    id="email-password"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="tu@email.com"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? "Ingresando…" : "Ingresar"}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/forgot-password">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="magic-link">
              <form onSubmit={handleMagicLinkLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-magic">Email</Label>
                  <Input
                    id="email-magic"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="tu@email.com"
                    autoComplete="email"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Te mandamos un enlace a tu correo. Lo abrís y entrás, sin escribir contraseña.
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {successMessage && (
                  <Alert className="border-primary/40 bg-primary/15 text-foreground">
                    <AlertDescription>{successMessage}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" size="lg" className="w-full" disabled={magicLinkLoading}>
                  {magicLinkLoading ? (
                    "Enviando..."
                  ) : (
                    <>
                      <Wand2 />
                      Enviarme el enlace
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </AuthFrame>
  )
}
