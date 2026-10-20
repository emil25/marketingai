import { z } from "zod";

export const MainChannelSchema = z.enum(["facebook", "instagram"]);
export type MainChannel = z.infer<typeof MainChannelSchema>;
export function mainChannel(profile?: { mainChannel?: string }) {
  return MainChannelSchema.safeParse(profile?.mainChannel).success
    ? (profile!.mainChannel as MainChannel)
    : "facebook";
}
