import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PlayerJoinFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchTitle: string;
  entryFee: number;
  teamSize?: number;
  initialIgn?: string | null;
  initialUid?: string | null;
  onConfirm: (ign: string, uid: string, teamMembers: Array<{ name: string; uid: string }>) => Promise<void>;
  isLoading?: boolean;
}

export function PlayerJoinForm({
  open,
  onOpenChange,
  matchTitle,
  entryFee,
  teamSize = 1,
  initialIgn,
  initialUid,
  onConfirm,
  isLoading = false,
}: PlayerJoinFormProps) {
  const [ign, setIgn] = useState("");
  const [uid, setUid] = useState("");
  const [teamMembers, setTeamMembers] = useState<Array<{ name: string; uid: string }>>(() => Array.from({ length: Math.max(0, teamSize - 1) }, () => ({ name: "", uid: "" })));
  useEffect(() => { if (open) { setIgn((value) => value || initialIgn || ""); setUid((value) => value || initialUid || ""); setTeamMembers((items) => items.length === Math.max(0, teamSize - 1) ? items : Array.from({ length: Math.max(0, teamSize - 1) }, () => ({ name: "", uid: "" }))); } }, [open, initialIgn, initialUid, teamSize]);

  const handleSubmit = async () => {
    if (!/^[A-Za-z0-9 _.-]{3,32}$/.test(ign.trim()) || !/[A-Za-z]/.test(ign) || /(.)\1{4}/.test(ign)) {
      toast.error("Enter a valid Free Fire IGN (letters, numbers, spaces, . or - only)");
      return;
    }
    if (!/^\d{8,12}$/.test(uid.trim())) {
      toast.error("Free Fire UID must contain only 8 to 12 digits");
      return;
    }

    try {
      if (teamMembers.some((member) => !member.name.trim() || !member.uid.trim())) { toast.error("Enter every teammate Name and Free Fire UID"); return; }
      await onConfirm(ign, uid, teamMembers);
      setIgn("");
      setUid("");
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="card-gaming max-h-[min(86dvh,44rem)] max-w-md overflow-y-auto overscroll-contain p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Join Match</DialogTitle>
          <DialogDescription>
            {matchTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pb-3">
          {/* Match Rules Alert */}
          <Alert className="border-accent/50 bg-accent/10">
            <AlertCircle className="h-4 w-4 text-accent" />
            <AlertDescription className="text-sm text-foreground">
              <strong>Match Rules:</strong>
              <ul className="mt-2 space-y-1 ml-4 list-disc">
                <li>No hacks or cheating allowed</li>
                <li>Must enter exact Free Fire UID</li>
                <li>Entry fee will be deducted from your wallet</li>
                <li>Match credentials will be shared 15 mins before start</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Entry Fee Info */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Entry Fee</p>
            <p className="text-lg font-bold text-secondary">{entryFee} Coins</p>
          </div>

          {/* Free Fire IGN */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Free Fire In-Game Name (IGN)
            </label>
            <Input
              placeholder="Enter your Free Fire IGN"
              value={ign}
              onChange={(e) => setIgn(e.target.value)}
              className="input-gaming"
              disabled={isLoading}
              maxLength={32}
            />
            <p className="text-xs text-muted-foreground mt-1">
              This will be recorded for match verification
            </p>
          </div>

          {/* Free Fire UID */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Free Fire UID
            </label>
            <Input
              placeholder="Enter your Free Fire UID (e.g., 123456789)"
              value={uid}
              onChange={(e) => setUid(e.target.value.replace(/\D/g, "").slice(0, 12))}
              className="input-gaming"
              disabled={isLoading}
              inputMode="numeric"
              maxLength={12}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Find your UID in Free Fire profile settings
            </p>
          </div>
          {teamSize > 1 && <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-3"><p className="text-sm font-bold text-primary">Team Members ({teamSize - 1})</p>{teamMembers.map((member, index) => <div key={index} className="grid grid-cols-2 gap-2"><Input placeholder={`Teammate ${index + 1} Name`} value={member.name} onChange={(e) => setTeamMembers((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: e.target.value } : item))} className="input-gaming" disabled={isLoading} maxLength={32} /><Input placeholder="Free Fire UID" inputMode="numeric" value={member.uid} onChange={(e) => setTeamMembers((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, uid: e.target.value.replace(/\D/g, "") } : item))} className="input-gaming" disabled={isLoading} maxLength={32} /></div>)}</div>}
        </div>

        <DialogFooter className="sticky bottom-0 -mx-4 border-t border-primary/15 bg-card/95 px-4 pb-1 pt-3 backdrop-blur sm:-mx-6 sm:px-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            className="btn-neon"
            onClick={handleSubmit}
            disabled={isLoading || !ign.trim() || !uid.trim()}
          >
            {isLoading ? "Joining..." : "Confirm Join"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
