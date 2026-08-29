import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requestWithdrawal } from "@/lib/payments.functions";
import { formatBRL } from "@/lib/money";

type WalletType = "player" | "affiliate";
type PixKeyType = "cpf" | "email" | "phone" | "random";

interface Props {
  minPlayer: number;
  minAffiliate: number;
  playerBalance: number;
  affiliateBalance: number;
  onDone?: () => void;
  trigger?: React.ReactNode;
}

export function WithdrawDialog({
  minPlayer,
  minAffiliate,
  playerBalance,
  affiliateBalance,
  onDone,
  trigger,
}: Props) {
  const request = useServerFn(requestWithdrawal);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [walletType, setWalletType] = useState<WalletType>("player");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("cpf");
  const [pixKey, setPixKey] = useState("");
  const [amount, setAmount] = useState("");

  const min = walletType === "affiliate" ? minAffiliate : minPlayer;
  const balance = walletType === "affiliate" ? affiliateBalance : playerBalance;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await request({
        data: {
          amount: Number(amount),
          pixKey: pixKey.trim(),
          pixKeyType,
          walletType,
        },
      });
      toast.success("Saque solicitado! Aguarde a aprovação.");
      setOpen(false);
      setAmount("");
      setPixKey("");
      onDone?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao solicitar o saque.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button variant="secondary">Sacar</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar saque PIX</DialogTitle>
          <DialogDescription>
            Saldo disponível: {formatBRL(balance)} · mínimo {formatBRL(min)}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label>Carteira</Label>
            <Select value={walletType} onValueChange={(value) => setWalletType(value as WalletType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="player">Saldo de jogo ({formatBRL(playerBalance)})</SelectItem>
                <SelectItem value="affiliate">Comissões ({formatBRL(affiliateBalance)})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de chave PIX</Label>
            <Select value={pixKeyType} onValueChange={(value) => setPixKeyType(value as PixKeyType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="random">Chave aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pix-key">Chave PIX</Label>
            <Input id="pix-key" value={pixKey} onChange={(event) => setPixKey(event.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="withdraw-amount">Valor (R$)</Label>
            <Input
              id="withdraw-amount"
              type="number"
              step="0.01"
              min={min}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando..." : "Solicitar saque"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
