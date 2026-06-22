"use client";

import { useActionState } from "react";
import { loginAdmin, type LoginState } from "@/app/admin/login/actions";

const initialState: LoginState = {};

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(loginAdmin, initialState);

  return (
    <form action={action} className="mt-6 grid gap-4">
      {state.message ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
        >
          {state.message}
        </div>
      ) : null}
      <label className="grid gap-2 text-sm font-semibold text-stone-800">
        Email
        <input
          required
          autoComplete="email"
          name="email"
          type="email"
          placeholder="owner@example.com"
          className="h-12 rounded-lg border border-stone-200 bg-white px-4 font-normal shadow-sm"
        />
        {state.fieldErrors?.email ? (
          <span className="text-xs text-red-700">
            {state.fieldErrors.email[0]}
          </span>
        ) : null}
      </label>
      <label className="grid gap-2 text-sm font-semibold text-stone-800">
        Password
        <input
          required
          autoComplete="current-password"
          name="password"
          type="password"
          className="h-12 rounded-lg border border-stone-200 bg-white px-4 font-normal shadow-sm"
        />
        {state.fieldErrors?.password ? (
          <span className="text-xs text-red-700">
            {state.fieldErrors.password[0]}
          </span>
        ) : null}
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-12 rounded-full bg-green-800 px-6 text-sm font-bold text-white transition hover:bg-green-900 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Login"}
      </button>
    </form>
  );
}
