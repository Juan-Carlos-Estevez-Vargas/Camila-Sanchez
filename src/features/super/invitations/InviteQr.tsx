import { useEffect, useState } from "react";
import { Spinner } from "@/ui/Feedback";
import styles from "./Invitations.module.scss";

/** Código QR del enlace, con botón para descargarlo. La librería se carga sólo aquí. */
export function InviteQr({ url, fileName, alt = "Código QR de la invitación" }: { url: string; fileName: string; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null);

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
        {src ? <img src={src} alt={alt} width={240} height={240} /> : <Spinner label="Generando el código QR" />}
      </div>
      {src && <a className="btn btn--sm btn--soft" href={src} download={fileName}>Descargar QR</a>}
    </div>
  );
}
