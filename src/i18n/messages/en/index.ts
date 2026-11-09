import type { Messages } from "@/i18n";
import { admin } from "./admin";
import { app } from "./app";
import { auth } from "./auth";
import { chat } from "./chat";
import { common } from "./common";
import { dates } from "./dates";
import { dedications } from "./dedications";
import { donate } from "./donate";
import { errors } from "./errors";
import { install } from "./install";
import { legal } from "./legal";
import { lists } from "./lists";
import { notes } from "./notes";
import { site } from "./site";
import { special } from "./special";
import { superAdmin } from "./superAdmin";
import { theme } from "./theme";
import { tour } from "./tour";
import { ui } from "./ui";
import { whatsNew } from "./whatsNew";

const messages: Messages = { admin, app, auth, chat, common, dates, dedications, donate, errors, install, legal, lists, notes, site, special, superAdmin, theme, tour, ui, whatsNew };

export default messages;
