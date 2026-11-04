import { Link } from "react-router-dom";
import { DATA_CONTROLLER, legalPath } from "@/domain/legal";
import { Contact } from "../Contact";

export function Terms() {
  return (
    <>
      <h2>1. What this app is</h2>
      <p>
        A private corner for a couple: memories, special dates, little notes, chat and shared lists. It was made and is
        run by <strong>{DATA_CONTROLLER.name}</strong>. By creating your account or continuing to use it you accept these
        terms and the <Link to={legalPath("privacidad")}>privacy policy</Link>.
      </p>

      <h2>2. Who can use it</h2>
      <ul>
        <li>There is no public sign-up: you can only get in with an account created by the administrator or with an invitation.</li>
        <li>You must be of legal age or have authorization from your mother, father or legal guardian.</li>
        <li>Your account is personal. Look after your password and do not give it to anyone.</li>
      </ul>

      <h2>3. Free and with no strings attached</h2>
      <p>
        The app is <strong>free</strong>. There are no plans, subscriptions, in-app purchases or trial periods that turn
        into charges. More details in <Link to={legalPath("reembolsos")}>payments and refunds</Link>.
      </p>

      <h2>4. What you upload is yours</h2>
      <p>
        The photos, messages and texts you share are still yours. By uploading them you only give us permission to store
        them and show them to the people in the app who can see them, while they are in it. When you delete them, they
        stop being shown.
      </p>
      <p>By uploading something you agree that:</p>
      <ul>
        <li>You have the right to share it (it is yours or you have permission) and, if other people appear, they agree.</li>
        <li>It is not illegal, does not harass or threaten anyone and does not show minors inappropriately.</li>
        <li>It contains no viruses and does not try to break or bypass the app's security.</li>
      </ul>
      <p>The administrator may remove content or deactivate accounts that do not follow these rules.</p>

      <h2>5. The code</h2>
      <p>
        The app's code is open source, under the <Link to={legalPath("licencias")}>MIT license</Link>. The photos, personal
        texts and design of the couple's page are not covered by that license.
      </p>

      <h2>6. Availability</h2>
      <p>
        It is a personal project: we do our best to keep it always working, but there may be pauses, errors or changes.
        Keep your own copy of anything you do not want to lose. To the extent permitted by law, the app is offered "as is",
        without the guarantees of a commercial service.
      </p>

      <h2>7. Closing your account</h2>
      <p>
        You can stop using it whenever you want. To have your account and data deleted, ask <Contact />; it is done with
        no questions asked and at no cost.
      </p>

      <h2>8. Changes and governing law</h2>
      <p>
        If these terms change, the app will ask you to accept them again. They are governed by the laws of the Republic of
        Colombia. If you have any questions or disagreements, let's talk it over first <Contact />.
      </p>
    </>
  );
}
