"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isOwnerEmail } from "@/src/lib/admin-auth";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginState = {
  message?: string;
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
};

export async function loginAdmin(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!isOwnerEmail(parsed.data.email)) {
    return { message: "This account is not authorized for owner access." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return {
      message:
        error?.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : error?.message ?? "Unable to sign in. Please try again.",
    };
  }

  if (!isOwnerEmail(data.user.email)) {
    await supabase.auth.signOut();
    return { message: "This account is not authorized for owner access." };
  }

  redirect("/admin");
}
