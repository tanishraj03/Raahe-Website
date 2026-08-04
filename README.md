# Raahe.co - website

A static site. No build step, no framework, no `npm install`. Three files do the work:

```
index.html    all the content and structure
styles.css    all the styling (brand colours live at the very top)
main.js       all the motion and interaction
favicon.svg   the tab icon
images/       your photos go here
```

Because there's nothing to compile, Vercel deploys it in about 20 seconds and you can edit it
straight from VS Code without learning React first.

---

## 1. Get the files onto your computer

1. Download the files and put them in one folder called `raahe-website`.
2. Make sure the folder looks exactly like the tree above, with `index.html` at the top level
   (not inside another folder). Vercel looks for `index.html` at the root.

## 2. Open it in VS Code and see it running

1. Install [VS Code](https://code.visualstudio.com/) if you don't have it.
2. In VS Code: **File → Open Folder** → pick `raahe-website`.
3. Install the **Live Server** extension: click the Extensions icon in the left sidebar
   (four squares), search `Live Server`, install the one by Ritwick Dey.
4. Right-click `index.html` in the file list → **Open with Live Server**.

Your browser opens the site. Every time you save a file, the browser refreshes itself.

## 3. Drop in your photos and video

Full list with sizes is in `images/README.txt` and `video/README.txt`. The short version:

| Where | Files |
|---|---|
| Open mic band | `images/openmic-01.jpg` to `openmic-10.jpg` |
| Artists program band | `images/artist-01.jpg` to `artist-06.jpg` |
| Team | `images/tanish.jpg`, `images/smera.jpg` |
| About us film | `video/raahe.mp4` plus `images/video-poster.jpg` |
| Share preview | `images/og-image.jpg` |

**You have to save these yourself.** Instagram does not let a website pull individual slides
out of a carousel post, and it will not let a site strip the frame off an embedded video
either. So open each post on a computer, click to the slide you want, right click the photo
and choose Save image as, then rename the file to match the list. Same for the reel: save it
from the Instagram app, or use the original export if you still have it, and drop it in as
`video/raahe.mp4`.

Until you do, every photo slot shows a coloured tile and the video shows its placeholder.
Nothing looks broken while you collect them.

Keep every file under about 400 KB. Squoosh.app compresses for free.

## 3b. Links already wired up

| Button | Goes to |
|---|---|
| Host an open mic / Partner with us | email to raahe.co@gmail.com, subject Partnership Request - Open Mic |
| Get tickets | link.district.in/DSTRKT/0q8uw5ie |
| Apply to the program | forms.gle/EJzCDZ1ePk9BEDeB6 |
| Volunteer with us | forms.gle/J3LD7gMRJDp9Z1qB9 |
| Register / Send it | the form at the bottom, which emails raahe.co@gmail.com |

The footer Instagram link points at `instagram.com/raahe.co`. If that is not your handle,
search for it in `index.html` and change it. There is no company LinkedIn on the page yet,
so add one next to the Instagram link in the footer if you want it.

## 4. Put the code on GitHub

1. Install [Git](https://git-scm.com/downloads). On Windows accept every default in the installer.
2. Make a free account at [github.com](https://github.com).
3. Back in VS Code, click the **Source Control** icon in the left sidebar (branching-lines icon).
4. Click **Initialize Repository**.
5. Type a message in the box at the top, e.g. `first version of the site`, then click **Commit**.
   If it asks you to stage the changes first, click **Yes**.
6. Click **Publish Branch**. VS Code will ask you to sign in to GitHub - do that in the browser
   window it opens.
7. Choose **Publish to public repository** (or private - Vercel works with both) and name it
   `raahe-website`.

Your code is now on GitHub. Refresh github.com and you'll see it.

## 5. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Sign Up** → **Continue with GitHub**.
2. On your dashboard click **Add New… → Project**.
3. Find `raahe-website` in the list and click **Import**.
4. Vercel will show a settings screen. **Change nothing.** Framework Preset will say
   "Other" - that's correct for a static site.
5. Click **Deploy**.

After about 20 seconds you get a live URL like `raahe-website.vercel.app`. It's public and
shareable immediately.

## 6. Point raahe.co at it

1. In your Vercel project: **Settings → Domains**.
2. Type `raahe.co` and click **Add**.
3. Vercel shows you DNS records (an `A` record, and a `CNAME` for `www`).
4. Log in wherever you bought the domain (GoDaddy, Namecheap, Hostinger…), find
   **DNS settings** or **Manage DNS**, and add exactly the records Vercel showed you.
5. Wait. It's usually live in 10 minutes, occasionally a few hours. Vercel adds the HTTPS
   certificate on its own.

## 7. Updating the site from now on

This is the loop you'll repeat forever:

1. Edit a file in VS Code, save it.
2. Source Control panel → type what you changed → **Commit** → **Sync Changes**.
3. Vercel notices the push and redeploys automatically. Refresh your site in a minute.

You never touch the Vercel dashboard again after the first deploy.

---

## Making the sign-up form actually send

Right now the form validates what someone typed and then opens their email app with the
message pre-filled to `raahe.co@gmail.com`. That works, but it loses people who don't have
a mail app set up. When you want submissions to land in your inbox properly:

1. Make a free account at [formspree.io](https://formspree.io) and create a form. You'll get
   an endpoint URL like `https://formspree.io/f/abcdefgh`.
2. In `index.html`, find `<form class="signup" id="signup" novalidate>` and change it to:

   ```html
   <form class="signup" id="signup" action="https://formspree.io/f/abcdefgh" method="POST">
   ```

3. In `main.js`, find the section commented `9. Sign-up form` and delete that whole block
   (from `(function signup () {` down to its closing `})();`).

Commit, sync, done. Free tier covers 50 submissions a month.

---

## Where to change things

**Colours** - top of `styles.css`, in the `:root` block. They're the exact hex values from the
brand guide. Change one there and it updates everywhere on the site.

**Copy** - all of it is plain text inside `index.html`. Search for the sentence you want to
change and type over it.

**The numbers that count up** - in `index.html`, look for `data-count="200"`. Change the number
there and the label next to it. `data-prefix` and `data-suffix` control the `₹` and `+`.

**The logo** - `images/logo.png` is your logo with the black parts turned white so it reads on
the dark background. `favicon.png` and `apple-touch-icon.png` are the same mark on a dark
rounded square, used for the browser tab and the phone home screen.

**Section order and names** - each section has `data-slot`, `data-name`, `data-time` and
`data-gel`. Those feed the running-order rail on the right edge. `data-gel` sets that section's
accent colour and accepts `pink`, `violet`, `mindaro` or `orange`.

**Social and email links** - search `instagram.com`, `linkedin.com` and `raahe.co@gmail.com`
in `index.html` and replace with your real URLs. The Instagram and LinkedIn links are currently
placeholders pointing at the homepages of each site.

---

## A few things worth knowing

- The site respects "reduce motion" in a visitor's OS accessibility settings - all animation
  switches off for them, content stays.
- Fonts load from Google Fonts: **League Spartan** (your brand face) and **DM Mono** for the
  small uppercase labels.
- Everything is keyboard-navigable and there's a skip link for screen readers.
- Tested down to 390px wide.
