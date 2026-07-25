import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Clock, Zap, Trophy } from "lucide-react";
import MatchCard from "./MatchCard";
import type { Match } from "@shared/types";

interface MatchStatusTabsProps {
  upcomingMatches: Match[];
  ongoingMatches: Match[];
  resultMatches: Match[];
  onJoinMatch?: (matchId: number) => void;
  joinedMatches?: number[];
}

export default function MatchStatusTabs({
  upcomingMatches,
  ongoingMatches,
  resultMatches,
  onJoinMatch,
  joinedMatches = [],
}: MatchStatusTabsProps) {
  return (
    <Tabs defaultValue="upcoming" className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6 bg-primary/10 border border-primary/20">
        <TabsTrigger value="upcoming" className="flex items-center gap-2 data-[state=active]:bg-primary">
          <Clock className="h-4 w-4" />
          <span className="hidden sm:inline">UPCOMING</span>
          <Badge variant="outline" className="ml-1">
            {upcomingMatches.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="ongoing" className="flex items-center gap-2 data-[state=active]:bg-green-600">
          <Zap className="h-4 w-4" />
          <span className="hidden sm:inline">ONGOING</span>
          <Badge variant="outline" className="ml-1">
            {ongoingMatches.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="results" className="flex items-center gap-2 data-[state=active]:bg-accent">
          <Trophy className="h-4 w-4" />
          <span className="hidden sm:inline">RESULTS</span>
          <Badge variant="outline" className="ml-1">
            {resultMatches.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming" className="space-y-4">
        {upcomingMatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onJoin={onJoinMatch}
                isJoined={joinedMatches.includes(match.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No upcoming matches at the moment</p>
            <p className="text-sm text-muted-foreground mt-2">Check back soon!</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="ongoing" className="space-y-4">
        {ongoingMatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ongoingMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onJoin={onJoinMatch}
                isJoined={joinedMatches.includes(match.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No matches currently active</p>
            <p className="text-sm text-muted-foreground mt-2">Check upcoming matches to join!</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="results" className="space-y-4">
        {resultMatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resultMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onJoin={onJoinMatch}
                isJoined={joinedMatches.includes(match.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No completed matches yet</p>
            <p className="text-sm text-muted-foreground mt-2">Results will appear here after matches complete</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
