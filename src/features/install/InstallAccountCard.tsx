import { Link } from "react-router-dom";
import { INSTALL_PATH } from "@/core/seo";
import { useInstallState } from "@/services/pwa/install";
import { useT } from "@/i18n";
import { InstallButton } from "./InstallButton";

/** Tarjeta de Mi cuenta: instalar la app en este dispositivo. */
export function InstallAccountCard() {
  const t = useT().install.account;
  const state = useInstallState();
  return (
    <section className="card row-between" style={{ marginTop: 16 }} data-tour="account-install">
      <div>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t.title}</h2>
        <p className="muted" style={{ margin: 0 }}>{state.installed ? t.installedHint : t.hint}</p>
      </div>
      {!state.installed && (state.canPrompt
        ? <InstallButton />
        : <Link className="btn btn--soft" to={INSTALL_PATH}>{t.open}</Link>)}
    </section>
  );
}
