"use client";

import { toast as sonnerToast } from "sonner";
import { shortError } from "@/lib/errors";

export function toastSuccess(message: string) {
  sonnerToast.success(message);
}

export function toastError(err: unknown) {
  sonnerToast.error(shortError(err));
}

export function toastInfo(message: string) {
  sonnerToast(message);
}
