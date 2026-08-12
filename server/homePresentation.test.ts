import { describe, expect, it } from "vitest";
import { getWelcomeIdentity } from "../client/src/lib/playerPresentation";

describe("Home welcome identity", () => {
  it("prefers a signed-in player name and safely falls back to email", () => {
    expect(getWelcomeIdentity({ name: "Rosidul Shah", email: "rosidulshah4@gmail.com" })).toBe("Rosidul Shah");
    expect(getWelcomeIdentity({ name: " ", email: "rosidulshah4@gmail.com" })).toBe("rosidulshah4@gmail.com");
    expect(getWelcomeIdentity(null)).toBe("Player");
  });
});
