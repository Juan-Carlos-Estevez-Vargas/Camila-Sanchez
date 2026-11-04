import type { Messages } from "@/i18n";

export const common: Messages["common"] = {
  loading: "Loading",
  loadingEllipsis: "Loading…",
  close: "Close",
  cancel: "Cancel",
  confirm: "Confirm",
  save: "Save",
  saving: "Saving…",
  delete: "Delete",
  edit: "Edit",
  back: "Back",
  view: "View",
  reload: "Reload",
  oops: "Oops",
  someone: "Someone",
  newBadge: "New: ",
  opensNewTab: "(opens in a new tab)",
  closeToast: (title) => `Close notice: ${title}`,
  somethingNew: "You have something new",
  errorBoundary: "Something broke in this part",
};
