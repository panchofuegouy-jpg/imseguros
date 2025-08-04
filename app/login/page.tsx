"use client"

import React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
          <CardDescription>Accede a tu panel de gestión de pólizas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
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
        </CardContent>
      </Card>
    </div>
  )
}
