"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Cake, MessageCircle, Phone, Search } from "lucide-react";
import { generateWhatsAppBirthdayLink } from "@/lib/whatsapp-share";

interface Client {
  id: string;
  nombre: string;
  telefono: string | null;
  fecha_nacimiento: string;
}

interface BirthdaysContentProps {
  clients: Client[];
}

function getNextBirthdayInfo(fechaNacimiento: string) {
  const [year, month, day] = fechaNacimiento.split("-").map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }

  const daysUntil = Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const turningAge = next.getFullYear() - year;

  return { daysUntil, turningAge, day, month };
}

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function BirthdaysContent({ clients }: BirthdaysContentProps) {
  const base = "/admin";
  const [searchTerm, setSearchTerm] = useState("");

  const enriched = useMemo(() => {
    return clients
      .map((client) => ({ client, ...getNextBirthdayInfo(client.fecha_nacimiento) }))
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [clients]);

  const filtered = enriched.filter(({ client }) => {
    if (searchTerm.trim() === "") return true;
    return client.nombre.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <Card className="gap-0 py-4">
        <CardContent className="px-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="BUSCAR CLIENTE..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
              className="h-14 w-full rounded-xl pl-12 pr-4 text-lg font-semibold uppercase tracking-wide placeholder:text-sm placeholder:font-medium placeholder:tracking-normal sm:placeholder:text-base"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader className="px-4">
          <CardTitle className="text-sm uppercase">
            Cumpleaños de Clientes ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-4">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {clients.length === 0
                ? "Todavía no cargaste fechas de nacimiento. Agregá la fecha de nacimiento al editar un cliente."
                : "No se encontraron clientes con ese nombre."}
            </div>
          ) : (
            <>
              {/* Mobile View - Cards */}
              <div className="space-y-2 md:hidden">
                {filtered.map(({ client, daysUntil, turningAge, day, month }) => {
                  const isToday = daysUntil === 0;
                  const waLink = generateWhatsAppBirthdayLink(client.telefono, client.nombre);

                  return (
                    <div
                      key={client.id}
                      className={`rounded-lg border p-3 space-y-2 ${isToday ? "bg-primary/10 border-primary/40" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link href={`${base}/clientes/${client.id}`} className="truncate font-semibold text-primary hover:underline block">
                            {client.nombre}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {String(day).padStart(2, "0")} de {MONTH_NAMES[month - 1]} &middot; Cumple {turningAge} años
                          </p>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center justify-center rounded-md border px-2 py-1 text-xs font-semibold ${
                            isToday
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : daysUntil <= 7
                                ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                                : "border-border bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          {isToday ? "¡Hoy!" : `${daysUntil}d`}
                        </span>
                      </div>

                      <div className="flex gap-1 border-t pt-2">
                        {waLink && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(waLink, "_blank")}
                            className="h-8 flex-1 gap-1 text-xs"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Saludar por WhatsApp
                          </Button>
                        )}
                        {client.telefono && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`tel:${client.telefono}`, "_self")}
                            className="h-8 w-8 p-0"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View - Table */}
              <div className="hidden overflow-hidden md:block">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[10%] text-center">Faltan</TableHead>
                      <TableHead className="w-[30%]">Cliente</TableHead>
                      <TableHead className="w-[20%] text-center">Cumpleaños</TableHead>
                      <TableHead className="w-[15%] text-center">Cumple</TableHead>
                      <TableHead className="w-[25%] text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(({ client, daysUntil, turningAge, day, month }) => {
                      const isToday = daysUntil === 0;
                      const waLink = generateWhatsAppBirthdayLink(client.telefono, client.nombre);

                      return (
                        <TableRow key={client.id} className={isToday ? "bg-primary/10" : ""}>
                          <TableCell className="text-center">
                            <span
                              className={`inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 font-semibold ${
                                isToday
                                  ? "border-primary/40 bg-primary/10 text-primary"
                                  : daysUntil <= 7
                                    ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                                    : "border-border bg-muted/40 text-muted-foreground"
                              }`}
                            >
                              {isToday && <Cake className="h-3 w-3" />}
                              {isToday ? "¡Hoy!" : `${daysUntil}d`}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Link href={`${base}/clientes/${client.id}`} className="font-medium text-primary hover:underline">
                              {client.nombre}
                            </Link>
                          </TableCell>
                          <TableCell className="text-center">
                            {String(day).padStart(2, "0")}/{String(month).padStart(2, "0")}
                          </TableCell>
                          <TableCell className="text-center">{turningAge} años</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              {waLink ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(waLink, "_blank")}
                                  className="h-7 gap-1 px-2 text-xs"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  Saludar
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sin teléfono</span>
                              )}
                              {client.telefono && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(`tel:${client.telefono}`, "_self")}
                                  className="h-7 w-7 p-0"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
