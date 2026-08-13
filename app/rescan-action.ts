"use server";

import { revalidatePath } from "next/cache";
import { executeNinoxRescan, type ScanActionState } from "../src/rescan/rescanNinox.js";

export async function rescanNinox(_previousState: ScanActionState, _formData: FormData): Promise<ScanActionState> {
  const state = await executeNinoxRescan();
  if (state.status === "success") revalidatePath("/");
  return state;
}
