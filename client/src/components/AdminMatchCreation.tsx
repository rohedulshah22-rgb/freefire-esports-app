import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface AdminMatchCreationProps {
  onMatchCreated?: () => void;
}

export default function AdminMatchCreation({ onMatchCreated }: AdminMatchCreationProps) {
  const [open, setOpen] = useState(false);
  const [matchType, setMatchType] = useState<"BR" | "CS" | "LW">("BR");
  const [mode, setMode] = useState<"1v1" | "2v2" | "4v4">("1v1");
  const [map, setMap] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [totalSlots, setTotalSlots] = useState("");
  const [prizePool, setPrizePool] = useState("");
  const [perKillReward, setPerKillReward] = useState("2");
  const [matchTime, setMatchTime] = useState("");

  const createMatchMutation = trpc.admin.createMatch.useMutation({
    onSuccess: () => {
      toast.success("Match created successfully!");
      setOpen(false);
      resetForm();
      onMatchCreated?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create match");
    },
  });

  const resetForm = () => {
    setMatchType("BR");
    setMode("1v1");
    setMap("");
    setEntryFee("");
    setTotalSlots("");
    setPrizePool("");
    setPerKillReward("2");
    setMatchTime("");
  };

  const handleCreateMatch = () => {
    if (!map || !entryFee || !totalSlots || !prizePool || !matchTime) {
      toast.error("Please fill in all fields");
      return;
    }

    createMatchMutation.mutate({
      matchType: matchType as any,
      mode: mode as any,
      mapName: map,
      entryFee: parseFloat(entryFee),
      totalSlots: parseInt(totalSlots),
      totalPrizePool: parseFloat(prizePool),
      perKillReward: parseFloat(perKillReward),
      scheduledStartTime: new Date(matchTime),
    });
  };

  const getModeOptions = () => {
    if (matchType === "BR") return ["1v1"];
    if (matchType === "CS") return ["1v1", "2v2", "4v4"];
    return ["1v1"];
  };

  const getTotalSlotsDefault = () => {
    if (mode === "1v1") return "2";
    if (mode === "2v2") return "4";
    if (mode === "4v4") return "8";
    return "48";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="btn-neon gap-2">
          <Plus className="h-4 w-4" />
          Create Match
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Match</DialogTitle>
          <DialogDescription>
            Set up a new tournament match with custom parameters
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Match Type & Mode */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Match Type</Label>
              <Select value={matchType} onValueChange={(v) => setMatchType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BR">Battle Royale (BR)</SelectItem>
                  <SelectItem value="CS">Clash Squad (CS)</SelectItem>
                  <SelectItem value="LW">Lone Wolf</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getModeOptions().map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Map & Entry Fee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Map Name</Label>
              <Input
                placeholder="e.g., Bermuda, Purgatory"
                value={map}
                onChange={(e) => setMap(e.target.value)}
              />
            </div>
            <div>
              <Label>Entry Fee (₹)</Label>
              <Input
                type="number"
                placeholder="50"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
              />
            </div>
          </div>

          {/* Total Slots & Prize Pool */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total Slots</Label>
              <Input
                type="number"
                placeholder={getTotalSlotsDefault()}
                value={totalSlots}
                onChange={(e) => setTotalSlots(e.target.value)}
              />
            </div>
            <div>
              <Label>Prize Pool (₹)</Label>
              <Input
                type="number"
                placeholder="1000"
                value={prizePool}
                onChange={(e) => setPrizePool(e.target.value)}
              />
            </div>
          </div>

          {/* Per Kill Reward & Match Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Per Kill Reward (₹)</Label>
              <Input
                type="number"
                placeholder="2"
                value={perKillReward}
                onChange={(e) => setPerKillReward(e.target.value)}
              />
            </div>
            <div>
              <Label>Match Start Time</Label>
              <Input
                type="datetime-local"
                value={matchTime}
                onChange={(e) => setMatchTime(e.target.value)}
              />
            </div>
          </div>

          {/* Info Box */}
          <Card className="bg-primary/10 border-primary/20 p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Auto-Cancel Rule:</strong> If fewer than 10 players join a BR match before start time, it will be automatically cancelled and all entry fees will be instantly refunded to players' wallets.
            </p>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="btn-neon"
              onClick={handleCreateMatch}
              disabled={createMatchMutation.isPending}
            >
              {createMatchMutation.isPending ? "Creating..." : "Create Match"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
