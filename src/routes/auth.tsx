import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { registerPlayer } from "@/lib/auth.functions";
import { isValidCPF, onlyDigits } from "@/lib/money";

type Mode = "login" | "register";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode: "login" | "register"; ref?: string } => {
    const mode = search["mode"] === "register" ? ("register" as const) : ("login" as const);
    const ref = typeof search["ref"] === "string" ? search["ref"] : null;
    return ref ? { mode, ref } : { mode };
  },
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta | Panda Pay" },
      {
        name: "description",
        content:
          "Acesse sua conta Panda Pay ou cadastre-se em segundos para depositar via PIX e jogar o Panda Jump.",
      },
      { property: "og:title", content: "Entrar ou criar conta | Panda Pay" },
      { property: "og:description", content: "Login e cadastro da plataforma Panda Pay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode, ref } = Route.useSearch();
  const navigate = useNavigate();
  const register = useServerFn(registerPlayer);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    cpf: "",
    phone: "",
    referralCode: ref ?? "",
  });

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });
    setLoading(false);
    if (error) {
      toast.error("E-mail ou senha inválidos.");
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/dashboard" });
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidCPF(form.cpf)) {
      toast.error("Informe um CPF válido.");
      return;
    }
    setLoading(true);
    try {
      await register({
        data: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          cpf: onlyDigits(form.cpf),
          phone: onlyDigits(form.phone),
          referralCode: form.referralCode.trim() || null,
        },
      });
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (error) throw new Error(error.message);
      toast.success("Conta criada com sucesso!");
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
  }

  const isRegister: boolean = mode === "register";

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{ background: "var(--gradient-hero)" }}
    >
      <Card className="w-full max-w-md border-border/60 bg-card/80 backdrop-blur">
        <CardHeader>
          <Link to="/" className="text-sm font-black tracking-tight text-foreground">
            Panda<span className="text-primary">Pay</span>
          </Link>
          <CardTitle className="pt-2 text-2xl">{isRegister ? "Criar conta" : "Entrar"}</CardTitle>
          <CardDescription>
            {isRegister
              ? "Preencha seus dados para começar a jogar e sacar via PIX."
              : "Acesse sua conta para depositar, jogar e sacar."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={isRegister ? handleRegister : handleLogin}>
            {isRegister ? (
              <>
                <Field id="fullName" label="Nome completo" value={form.fullName} onChange={set("fullName")} required />
                <Field id="cpf" label="CPF" value={form.cpf} onChange={set("cpf")} required placeholder="000.000.000-00" />
                <Field id="phone" label="Telefone" value={form.phone} onChange={set("phone")} required placeholder="(11) 99999-9999" />
              </>
            ) : null}
            <Field id="email" label="E-mail" type="email" value={form.email} onChange={set("email")} required />
            <Field id="password" label="Senha" type="password" value={form.password} onChange={set("password")} required />
            {isRegister ? (
              <Field
                id="referralCode"
                label="Código de indicação (opcional)"
                value={form.referralCode}
                onChange={set("referralCode")}
              />
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : isRegister ? "Criar conta" : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isRegister ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
            <Link
              to="/auth"
              search={{ mode: isRegister ? "login" : "register" }}
              className="font-medium text-primary hover:underline"
            >
              {isRegister ? "Entrar" : "Criar agora"}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}
