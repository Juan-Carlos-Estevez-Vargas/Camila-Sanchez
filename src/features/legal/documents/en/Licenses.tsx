import { AUTHOR } from "@/core/author";
import { FONTS, LIBRARIES } from "../Licenses";

export function Licenses() {
  return (
    <>
      <h2>The app's code</h2>
      <p>
        It was written by {AUTHOR.name} and it is open source, under the <a href={`${AUTHOR.repository}/blob/master/LICENSE`} target="_blank" rel="noopener noreferrer">MIT license</a>.
        You can see the <a href={AUTHOR.repository} target="_blank" rel="noopener noreferrer">repository on GitHub</a>.
      </p>

      <h2>Photos and texts</h2>
      <p>
        The page's photos, personal texts and screenshots belong to the couple and to whoever uploads them. They are <strong>not</strong>
        under the MIT license and may not be copied or reused without their permission. Everyone who uploads a photo states
        that they have the right to do so and permission from the people in it. The app does not use stock photos.
      </p>

      <h2>Icons, stickers and drawings</h2>
      <p>
        The heart in the icon and the chat stickers were drawn for this app (original SVGs, same license as the code).
        Emojis are drawn by your device with its own emoji font (Apple, Google, Microsoft…), so they are not distributed
        with the app.
      </p>

      <h2>Typefaces</h2>
      <p>
        {FONTS.join(", ")}: all under the <a href="https://openfontlicense.org" target="_blank" rel="noopener noreferrer">SIL Open Font License 1.1</a>,
        served by Google Fonts only if you accept them in the cookie notice.
      </p>

      <h2>Libraries</h2>
      <table>
        <thead><tr><th scope="col">Library</th><th scope="col">License</th></tr></thead>
        <tbody>
          {LIBRARIES.map((lib) => (
            <tr key={lib.name}>
              <td><a href={lib.url} target="_blank" rel="noopener noreferrer">{lib.name}</a></td>
              <td>{lib.license}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Along with their dependencies (all MIT, ISC, Apache 2.0 or 0BSD). An automated test checks that no app dependency
        has a license that does not allow this use.
      </p>

      <h2>Music</h2>
      <p>
        If the page has background music, it is a link set up by the administrator. Whoever adds it is responsible for
        having permission to use that song.
      </p>
    </>
  );
}
