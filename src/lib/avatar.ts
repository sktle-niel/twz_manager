import avatarBoy from "../assets/avatar-boy.webp"
import avatarGirl from "../assets/avatar-girl.webp"
import type { AvatarKind } from "./api/types"

/*
 * The stock profile pictures, for accounts that have not uploaded their own.
 * An empty circle reads as something broken; a face reads as a person.
 *
 * Which face is the account's own choice, made on the Account page. Until
 * they choose, everyone is the girl — a fixed default, not a guess, because
 * the system does not know anyone's gender and inferring it from a name
 * would be worse than being wrong consistently.
 */
export const STOCK_AVATARS: Record<AvatarKind, string> = {
  girl: avatarGirl,
  boy: avatarBoy,
}

/** The stock picture an account shows: their chosen kind, girl until chosen */
export function stockAvatar(kind?: AvatarKind | null): string {
  return STOCK_AVATARS[kind ?? "girl"]
}
