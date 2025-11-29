"use client"

import React from "react"

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
      setError(error.message);
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
      setError("Por favor ingresa tu email para usar Magic Link")
      return
    }

    setMagicLinkLoading(true)
    setError("")
    setSuccessMessage("")

    const { error } = await signInWithMagicLink(email)

    if (error) {
      setError(error.message)
    } else {
      setSuccessMessage("¡Enlace mágico enviado! Revisa tu correo electrónico.")
    }
    setMagicLinkLoading(false)
  }

  const clearMessages = () => {
    setError("")
    setSuccessMessage("")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-6 flex items-center justify-center">
            <img
              src="/IM_IDEINTIDAD-LOGO.png"
              alt="IM Seguros Logo"
              className="h-12 w-auto max-w-[200px] object-contain"
            />
          </div>
          <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
          <CardDescription>Accede a tu panel de gestión de pólizas</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="password" className="w-full" onValueChange={clearMessages}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="password">Contraseña</TabsTrigger>
              <TabsTrigger value="magic-link">Magic Link</TabsTrigger>
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
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
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
                  Te enviaremos un enlace a tu correo para que puedas iniciar sesión sin contraseña.
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {successMessage && (
                  <Alert className="bg-green-50 text-green-900 border-green-200">
                    <AlertDescription>{successMessage}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={magicLinkLoading}>
                  {magicLinkLoading ? (
                    "Enviando..."
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Enviar Magic Link
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
