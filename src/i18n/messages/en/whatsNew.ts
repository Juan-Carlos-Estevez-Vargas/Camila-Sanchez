/** What's new in each version (keys come from domain/whatsNew.ts). */
export const whatsNew = {
  title: "✨ What's new",
  version: (v: string) => `Version ${v}`,
  intro: "Here's what's new since you last visited:",
  historyIntro: "Everything that has come to the app, newest first.",
  showTour: "Show me how",
  also: "Also",
  close: "Got it!",
  showHistory: "See everything that's new",
  footerLink: "✨ What's new",
  releases: {
    "2026-11-08": {
      news: {
        dedications: {
          title: "Dedications with songs and photos",
          body: "Write a letter to someone (or to everyone) with photos and songs from YouTube, Spotify or your own audio. All the songs make a playlist that plays right here and that you can take to other apps.",
        },
        whatsNew: {
          title: "This what's new window",
          body: "Every time the app updates you'll see what changed here, and «Show me how» takes you to try it. You can open it again from the footer.",
        },
      },
      changes: [
        "The player keeps going when you change pages and pauses the home page music.",
        "Import songs by pasting links or opening an .m3u file.",
      ],
    },
    "2026-11-05": {
      news: {
        received: {
          title: "Your surprises stay",
          body: "The surprises made for you are kept in the Message box → Received so you can see them again whenever you want.",
        },
        audit: {
          title: "An easier audit log",
          body: "Filter by month, section, action and person, sort and page through without getting lost.",
        },
      },
      changes: [
        "A surprise notification takes you straight to the Message box.",
      ],
    },
    "2026-11-04": {
      news: {
        languages: {
          title: "The app in your language",
          body: "Spanish, English and Portuguese. It opens in your phone's language and you can change it with 🌐 in the header.",
        },
        install: {
          title: "Install it on your phone",
          body: "Its own icon, full screen, and it opens even offline. The steps are in «Get the app», in the footer.",
        },
      },
      changes: [
        "We let you know when there's a new version so you can update with one tap.",
        "The header and footer fit better in every language.",
      ],
    },
    "2026-11-03": {
      news: {
        chat: {
          title: "A real chat",
          body: "Find people, send requests, reply, react, edit, share photos and stickers, and see who's online.",
        },
        surprises: {
          title: "Surprises for one person",
          body: "Each surprise is made for someone: only that person sees it and gets the notification.",
        },
      },
      changes: [
        "Clear legal pages and a cookie notice.",
      ],
    },
    "2026-10-21": {
      news: {
        lists: {
          title: "Shared lists",
          body: "Make lists with other people: tasks, subtasks, materials, photos, due dates and who's in charge, all live.",
        },
        profile: {
          title: "Your profile",
          body: "Change your name, add a photo or an icon, a quote and your birthday.",
        },
      },
      changes: [
        "Notifications on your phone's screen, chat included.",
      ],
    },
  },
};
