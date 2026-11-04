import type { Messages } from "@/i18n";
import { app } from "./app";
import { auth } from "./auth";
import { common } from "./common";
import { dates } from "./dates";
import { errors } from "./errors";
import { legal } from "./legal";
import { theme } from "./theme";
import { ui } from "./ui";

const messages: Messages = { app, auth, common, dates, errors, legal, theme, ui };

export default messages;
