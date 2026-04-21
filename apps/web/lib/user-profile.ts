import type { UserResponseDto } from "@/api/generated";

export function hasCompletedOnboarding(
  user: Pick<UserResponseDto, "firstName" | "lastName" | "username"> | null | undefined,
) {
  const firstName = user?.firstName?.trim() ?? "";
  const lastName = user?.lastName?.trim() ?? "";
  const username = user?.username?.trim() ?? "";

  return Boolean(firstName && lastName && username);
}
