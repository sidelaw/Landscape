"use server";

import { revalidatePath } from "next/cache";
import { updateBusinessForCurrentUser } from "@/lib/business";
import { businessUpdateSchema, type BusinessUpdateInput } from "@/lib/schemas";

export async function saveBusiness(update: BusinessUpdateInput) {
  // Validate the client-supplied payload before it reaches the DB. RLS already
  // confines writes to the owner's own row; this guards against garbage/NaN
  // pricing that the estimate engine would later consume.
  const parsed = businessUpdateSchema.safeParse(update);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid values — please check the form." };
  }

  const res = await updateBusinessForCurrentUser(parsed.data);
  if (res.ok) revalidatePath("/dashboard");
  return res;
}
