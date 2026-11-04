import { useEffect, useState } from "react";
import { Spinner } from "@/ui/Feedback";
import styles from "./Invitations.module.scss";
import { useT } from "@/i18n";

/** Código QR del enlace, con botón para descargarlo. La librería se carga sólo aquí. */
export function InviteQr({ url, fileName, alt }: { url: string; fileName: string; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const t = useT().superAdmin.links;

  useEffect(() => {
    let alive = true;
    void import("qrcode")
      .then(({ toDataURL }) =>
        toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: "M", color: { dark: "#3d0a24", light: "#ffffff" } }))
      .then((dataUrl) => alive && setSrc(dataUrl));
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <div className={styles.qrBlock}>
      <div className={styles.qr}>
        {src ? <img src={src} alt={alt ?? t.inviteQrAlt} width={240} height={240} /> : <Spinner label={t.generatingQr} />}
      </div>
      {src && <a className="btn btn--sm btn--soft" href={src} download={fileName}>{t.downloadQr}</a>}
    </div>
  );
}
