import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Zap, Trophy, Clock, MapPin } from "lucide-react";
import { Link } from "wouter";
import type { Match } from "@shared/types";

interface MatchCardProps {
  match: Match;
  onJoin?: () => void;
  isJoined?: boolean;
}

export default function MatchCard({ match, onJoin, isJoined }: MatchCardProps) {
  const matchStatus = match.status as 'scheduled' | 'active' | 'completed' | 'cancelled';
  const timeUntilStart = new Date(match.scheduledStartTime).getTime() - Date.now();
  const hoursUntilStart = Math.floor(timeUntilStart / (1000 * 60 * 60));
  const minutesUntilStart = Math.floor((timeUntilStart % (1000 * 60 * 60)) / (1000 * 60));

  const getStatusColor = () => {
    switch (matchStatus) {
      case "scheduled":
        return "bg-blue-600";
      case "active":
        return "bg-green-600";
      case "completed":
        return "bg-gray-600";
      case "cancelled":
        return "bg-red-600";
      default:
        return "bg-primary";
    }
  };

  const getStatusText = () => {
    switch (matchStatus) {
      case "scheduled":
        return "UPCOMING";
      case "active":
        return "ONGOING";
      case "completed":
        return "RESULTS";
      case "cancelled":
        return "CANCELLED";
      default:
        return (match.status as string).toUpperCase();
    }
  };

  const slotPercentage = (match.currentPlayers / match.totalSlots) * 100;
  const isFull = match.currentPlayers >= match.totalSlots;

  return (
    <Card className="card-gaming overflow-hidden hover:shadow-lg hover:shadow-primary/50 transition-all duration-300">
      <div className="relative">
        {/* Header with status badge */}
        <div className="flex items-start justify-between p-4 border-b border-primary/20">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-accent mb-1">{match.matchTitle}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{match.mapName}</span>
            </div>
          </div>
          <Badge className={`${getStatusColor()} text-white font-bold`}>
            {getStatusText()}
          </Badge>
        </div>

        {/* Match details grid */}
        <div className="p-4 space-y-3">
          {/* Date & Time */}
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Date & Time</p>
              <p className="text-sm font-semibold">
                {new Date(match.scheduledStartTime).toLocaleDateString()} at{" "}
                {new Date(match.scheduledStartTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              {hoursUntilStart >= 0 && (
                <p className="text-xs text-primary font-bold mt-1">
                  Starts in {hoursUntilStart}h {minutesUntilStart}m
                </p>
              )}
            </div>
          </div>

          {/* Prize Pool & Per Kill */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Prize Pool</p>
              <p className="text-lg font-bold text-accent">
                ₹{Number(match.totalPrizePool).toFixed(0)}
              </p>
            </div>
            <div className="bg-primary/10 rounded-lg p-3">
              <div className="flex items-center gap-1">
                <Zap className="h-4 w-4 text-yellow-500" />
                <p className="text-xs text-muted-foreground">Per Kill</p>
              </div>
              <p className="text-lg font-bold text-yellow-500">
                ₹{Number(match.perKillReward).toFixed(0)}
              </p>
            </div>
          </div>

          {/* Slot Counter with Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold">
                  {match.currentPlayers}/{match.totalSlots} Slots
                </span>
              </div>
              <span className="text-xs font-bold text-primary">
                {Math.round(slotPercentage)}%
              </span>
            </div>
            <div className="w-full bg-background rounded-full h-2 overflow-hidden border border-primary/20">
              <div
                className="bg-gradient-to-r from-primary to-accent h-full transition-all duration-300"
                style={{ width: `${Math.min(slotPercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Entry Fee & Join Button */}
          <div className="flex items-center justify-between pt-2 border-t border-primary/20">
            <div>
              <p className="text-xs text-muted-foreground">Entry Fee</p>
              <p className="text-lg font-bold text-primary">
                ₹{Number(match.entryFee).toFixed(0)}
              </p>
            </div>
            {match.status === "scheduled" && !isFull ? (
              <Link href={`/match/${match.id}`}>
                <Button
                  className="btn-neon"
                  disabled={isJoined}
                  onClick={() => onJoin?.()}
                >
                  {isJoined ? "Joined" : "Join Now"}
                </Button>
              </Link>
            ) : match.status === "cancelled" ? (
              <Badge variant="destructive">Cancelled</Badge>
            ) : isFull ? (
              <Badge variant="outline">Full</Badge>
            ) : (
              <Badge variant="outline">{getStatusText()}</Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
