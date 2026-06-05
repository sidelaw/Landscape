"use server";

import { revalidatePath } from "next/cache";
import { updateBusinessForCurrentUser, type BusinessUpdate } from "@/lib/business";

export async function saveBusiness(update: BusinessUpdate) {
  const res = await updateBusinessForCurrentUser(update);
  if (res.ok) revalidatePath("/dashboard");
  return res;
}
