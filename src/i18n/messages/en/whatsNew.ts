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
    "2026-11-11": {
      news: {
        birthdayPopup: {
          title: "A pop-up for her birthday",
          body: "On her birthday a little window shows a love message and, when the gift is opened, \"El color de tus ojos\" plays.",
        },
        specialMusic: {
          title: "Music on every special date",
          body: "Special dates now play soft background music: a mystery waltz on Halloween, \"Silent Night\" with bells at Christmas, \"Happy Birthday\" on your birthday… It starts when you tap the page and you can turn it off with the 🔊 button at the bottom left. In Appearance you can add your own songs, like a serenade for the birthday.",
        },
        specialScenes: {
          title: "Every date with its own decorations",
          body: "Each special date now brings its own animated scene across the app: skulls, bats, spiders and a full moon on Halloween; lights, snow, trees and the sleigh at Christmas; bunting and confetti on her birthday, and fireworks on New Year.",
        },
      },
      changes: [
        "Colors, background, header and cards also change with the date.",
      ],
    },
    "2026-11-10": {
      news: {
        specialDays: {
          title: "The page dresses up for the party",
          body: "On her birthday, our anniversary, Valentine's Day, Love and Friendship Day, Halloween, Christmas and New Year the whole page changes its colors, emojis and greeting for the entire day.",
        },
      },
      changes: [
        "Whoever manages the appearance sets her birthday, turns off the dates they don't want and can preview each theme before the day comes.",
      ],
    },
    "2026-11-09": {
      news: {
        photoReplace: {
          title: "Replace a photo",
          body: "If a photo uploaded badly or looks blurry, swap it with 🔄 without losing its message, date or place. It works in the panel album and in your dedications.",
        },
        seenBy: {
          title: "Who saw your dedication",
          body: "In your dedications you now know who already opened it and when, and who hasn't yet. The list shows 👀 Seen or how many people saw it.",
        },
        twoStep: {
          title: "Two-step verification",
          body: "If you like, in My account you can also require a code from an authenticator app when you sign in. Even if someone knows your password, they can't get in. It's optional.",
        },
        photoQuality: {
          title: "Sharper photos",
          body: "New photos are stored bigger (up to 2560 px), with better resizing and a touch of sharpening. We warn you with ⚠️ when a photo is too small.",
        },
      },
      changes: [
        "Thumbnails in the album, chat, lists and dedications look crisper.",
        "Before sending a dedication you can replace any of its photos.",
      ],
    },
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
