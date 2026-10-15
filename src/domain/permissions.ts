import type { Role } from "./types";

/** Catálogo de permisos. Debe coincidir con la tabla public.permissions. */
export const PERMISSIONS = {
  siteView: "site.view",
  contentEdit: "content.edit",
  photosManage: "photos.manage",
  datesManage: "dates.manage",
  interruptionsManage: "interruptions.manage",
  notesSend: "notes.send",
  chatUse: "chat.use",
  sectionsManage: "sections.manage",
  themeManage: "theme.manage",
  themePalette: "theme.palette",
  settingsManage: "settings.manage",
  usersManage: "users.manage",
  auditView: "audit.view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super administrador",
  editor: "Editora",
  viewer: "Invitado",
};

/** Permisos por defecto (espejo del seed de la migración 001). */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: Object.values(PERMISSIONS),
  editor: [
    PERMISSIONS.siteView, PERMISSIONS.contentEdit, PERMISSIONS.photosManage,
    PERMISSIONS.datesManage, PERMISSIONS.interruptionsManage, PERMISSIONS.notesSend,
    PERMISSIONS.chatUse, PERMISSIONS.themePalette,
  ],
  viewer: [PERMISSIONS.siteView, PERMISSIONS.notesSend, PERMISSIONS.chatUse],
};

/**
 * Política de acceso en el cliente. Sólo decide qué se muestra: la base de
 * datos vuelve a comprobar cada operación con RLS.
 */
export class AccessPolicy {
  private readonly granted: ReadonlySet<string>;

  constructor(
    readonly role: Role | null,
    permissions: Iterable<string>,
  ) {
    this.granted = new Set(permissions);
  }

  static anonymous(): AccessPolicy {
    return new AccessPolicy(null, []);
  }

  can(permission: Permission): boolean {
    return this.role === "super_admin" || this.granted.has(permission);
  }

  canAny(...permissions: Permission[]): boolean {
    return permissions.some((p) => this.can(p));
  }

  get isSuperAdmin(): boolean {
    return this.role === "super_admin";
  }

  /** ¿Tiene acceso al panel de contenido (el de Camila)? */
  get canUseContentPanel(): boolean {
    return this.canAny(
      PERMISSIONS.contentEdit, PERMISSIONS.photosManage,
      PERMISSIONS.datesManage, PERMISSIONS.interruptionsManage, PERMISSIONS.themePalette,
    );
  }

  /** ¿Tiene acceso al panel de super administración? */
  get canUseSuperPanel(): boolean {
    return this.canAny(
      PERMISSIONS.usersManage, PERMISSIONS.themeManage, PERMISSIONS.settingsManage,
      PERMISSIONS.sectionsManage, PERMISSIONS.auditView,
    );
  }
}
