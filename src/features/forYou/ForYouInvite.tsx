/**
 * Tarjeta del inicio que lleva a una carta («Tengo algo para ti 💌» o, para la
 * despedida, «Tengo algo que decirte»).
 * Sale unos segundos después de abrir la página, hasta que la carta se abra
 * en este navegador. «Luego» la esconde hasta la próxima visita.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { postponeForYou, wasForYouOpened, wasForYouPostponed } from "@/domain/forYouSeen";
import { LETTERS, type LetterId } from "@/domain/forYou";
import { useT } from "@/i18n";
import styles from "./ForYouInvite.module.scss";

const DELAY_MS = 1200;

export function ForYouInvite({ letter = "forYou" }: { letter?: LetterId }) {
  const t = useT()[letter].invite;
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (wasForYouOpened(letter) || wasForYouPostponed(letter)) return;
    const timer = window.setTimeout(() => setShow(true), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [letter]);

  if (!show) return null;
  const later = () => {
    postponeForYou(letter);
    setShow(false);
  };
  return (
    <aside className={styles.invite} aria-labelledby="para-ti-invitacion">
      <span className={styles.envelope} aria-hidden>💌</span>
      <div className={styles.text}>
        <p id="para-ti-invitacion" className={styles.title}>{t.title}</p>
        <p className={styles.body}>{t.body}</p>
      </div>
      <div className={styles.actions}>
        <Link to={LETTERS[letter].path} className={styles.open}>{t.open}</Link>
        <button type="button" className={styles.later} onClick={later}>{t.later}</button>
      </div>
    </aside>
  );
}
