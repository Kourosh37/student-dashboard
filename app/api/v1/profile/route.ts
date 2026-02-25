import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guards";
import { handleApiError, fail, ok, validationFail } from "@/lib/http";
import { publishUserEvent } from "@/lib/realtime";
import { getProfile, updateProfile } from "@/lib/services/profile-service";
import { updateProfileSchema } from "@/lib/validators/profile";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const profile = await getProfile(session.userId);
    if (!profile) {
      return fail("Profile not found", 404, "PROFILE_NOT_FOUND");
    }
    return ok(profile);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession(request);
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return validationFail(parsed.error.issues);
    }

    const updated = await updateProfile(session.userId, parsed.data);
    publishUserEvent(session.userId, "profile.updated", {
      profileId: updated.id,
    });
    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
